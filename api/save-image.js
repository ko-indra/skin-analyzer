const { sendPhotoToTelegram } = require('../lib/telegram');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { image } = req.body;
        if (!image) {
            return res.status(400).json({ error: 'No image data provided' });
        }

        const { caption } = await sendPhotoToTelegram(image);
        return res.status(200).json({ success: true, caption });
    } catch (error) {
        console.error('Error sending to Telegram:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
};
