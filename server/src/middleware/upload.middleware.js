import multer from 'multer';

// Use in-memory buffer so magic byte inspection and integrity checks occur
// before any file touches permanent disk storage
const storage = multer.memoryStorage();

export const uploadPaymentProof = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB maximum
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    // Preliminary check on extension and declared MIME
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];

    const ext = (file.originalname.slice(file.originalname.lastIndexOf('.')) || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();

    if (!allowedExtensions.includes(ext) || !allowedMimes.includes(mime)) {
      const err = new Error(
        'Invalid file type. Only JPEG, PNG, WEBP, and PDF files are accepted.'
      );
      err.statusCode = 400;
      return cb(err);
    }

    cb(null, true);
  },
});
