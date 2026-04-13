const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
// Need increased limit for base64 image data
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Endpoint to save captured selfie
app.post('/save-image', (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Remove proper base64 metadata
    const base64Data = image.replace(/^data:image\/png;base64,/, "");
    const fileName = `selfie_${Date.now()}.png`;
    const filePath = path.join(uploadsDir, fileName);

    fs.writeFile(filePath, base64Data, 'base64', (err) => {
      if (err) {
        console.error('Error saving image:', err);
        return res.status(500).json({ error: 'Failed to save image' });
      }
      console.log('Image saved successfully:', fileName);
      return res.status(200).json({ success: true, fileName: fileName, message: 'Image successfully saved' });
    });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`Selfie Analyzer server running on http://localhost:${PORT}`);
});
