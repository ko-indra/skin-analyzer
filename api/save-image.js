export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // On Vercel we can't persist files to disk, so we simply acknowledge the save.
    // The actual image download is handled client-side via browser download.
    const fileName = `selfie_${Date.now()}.png`;
    return res.status(200).json({
      success: true,
      fileName: fileName,
      message: 'Image processed successfully'
    });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
