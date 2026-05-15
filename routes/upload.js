// File Path: /routes/upload.js
// Purpose: Handle image uploads to Cloudinary via multipart form
// Linked Files: config/cloudinary.js, multer middleware

const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('../config/cloudinary');

// Use multer memory storage – the file buffer will be streamed to Cloudinary
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'), false);
    }
  },
});

// POST /api/upload – expects a single file field named "image"
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    // Upload buffer to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'adult-clothing' }, // optional folder in Cloudinary
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    res.json({
      message: 'Image uploaded successfully.',
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
    });
  } catch (err) {
    console.error('Upload error:', err.message);
    res.status(500).json({ error: 'Image upload failed.' });
  }
});

module.exports = router;