require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { analyzeSkin } = require('./lib/gemini');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/analyze-skin', async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) {
            return res.status(400).json({ error: 'No image data provided' });
        }

        const analysis = await analyzeSkin(image);
        return res.status(200).json({ success: true, analysis });
    } catch (error) {
        console.error('Error analyzing skin:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Skin Analyzer server running on http://localhost:${PORT}`);
});
