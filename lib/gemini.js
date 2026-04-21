async function analyzeSkin(dataUrl) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `Kamu adalah seorang ahli dermatologi AI profesional. Analisis foto wajah ini dan berikan penilaian kulit yang komprehensif.

Berikan response dalam format JSON berikut (HANYA JSON murni, tanpa markdown code block atau teks lain):
{
  "overallScore": <angka 0-100>,
  "skinType": "<Berminyak/Kering/Kombinasi/Normal/Sensitif>",
  "hydrationLevel": "<Rendah/Sedang/Baik/Sangat Baik>",
  "concerns": [
    {"name": "<nama masalah>", "severity": "<rendah/sedang/tinggi>", "icon": "<emoji>", "description": "<penjelasan 1-2 kalimat>"}
  ],
  "strengths": ["<kelebihan 1>", "<kelebihan 2>"],
  "recommendations": ["<saran 1>", "<saran 2>", "<saran 3>"],
  "summary": "<ringkasan kondisi kulit 2-3 kalimat bahasa Indonesia>"
}

Penting:
- Penilaian jujur dan profesional
- overallScore realistis
- Minimal 2 concerns dan 3 recommendations
- Semua teks dalam bahasa Indonesia`;

    const requestBody = {
        contents: [{
            parts: [
                { text: prompt },
                { inline_data: { mime_type: 'image/png', data: base64 } }
            ]
        }],
        generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
        }
    };

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // Retry up to 2 times on parse failure
    let lastError;
    for (let attempt = 0; attempt < 2; attempt++) {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(`Gemini API error: ${result.error?.message || response.statusText}`);
        }

        // Check if response was truncated
        const finishReason = result.candidates?.[0]?.finishReason;
        if (finishReason === 'MAX_TOKENS') {
            lastError = new Error('Response terlalu panjang, mencoba lagi...');
            continue;
        }

        const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textContent) {
            throw new Error('No response from Gemini API');
        }

        // Parse JSON (handle potential markdown wrapping)
        let jsonStr = textContent.trim();
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }

        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            lastError = new Error(`Failed to parse Gemini response: ${e.message}`);
            console.error(`Attempt ${attempt + 1} failed, raw response:`, textContent.substring(0, 200));
        }
    }

    throw lastError;
}

module.exports = { analyzeSkin };
