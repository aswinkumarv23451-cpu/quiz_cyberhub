import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base directory for local development storage
const UPLOADS_ROOT = path.resolve(__dirname, '../../../uploads/payment-proofs');

// Maximum allowed upload size: 5 MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed extensions and corresponding MIME types
const EXTENSION_MAP = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

/**
 * Detects real file format by inspecting binary magic bytes / file signature.
 *
 * @param {Buffer} buffer - File buffer
 * @returns {{ ext: string, mime: string } | null}
 */
export const detectFileType = (buffer) => {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: 'png', mime: 'image/png' };
  }

  // 3. PDF: %PDF- (25 50 44 46 2D)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return { ext: 'pdf', mime: 'application/pdf' };
  }

  // 4. WEBP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }

  return null;
};

/**
 * Validates file extension, declared MIME, and binary magic bytes.
 * Rejects mismatches, spoofed files, HTML, SVG, executables, scripts, etc.
 *
 * @param {Buffer} buffer
 * @param {string} originalFilename
 * @param {string} declaredMime
 * @returns {{ ext: string, mime: string }} Validated file type
 */
export const validateFileIntegrity = (buffer, originalFilename, declaredMime) => {
  if (!buffer || buffer.length === 0) {
    const err = new Error('Payment proof file is empty.');
    err.statusCode = 400;
    throw err;
  }

  if (buffer.length > MAX_FILE_SIZE) {
    const err = new Error('Payment proof exceeds the maximum allowed size of 5 MB.');
    err.statusCode = 400;
    throw err;
  }

  // Check declared extension
  const ext = path.extname(originalFilename || '').toLowerCase();
  const expectedMime = EXTENSION_MAP[ext];
  if (!expectedMime) {
    const err = new Error(
      'Invalid file extension. Only JPEG, PNG, WEBP, and PDF files are accepted.'
    );
    err.statusCode = 400;
    throw err;
  }

  // Check declared MIME type
  const normalizedMime = (declaredMime || '').toLowerCase().trim();
  if (normalizedMime !== expectedMime) {
    const err = new Error(
      'File type mismatch. Declared MIME type does not match extension.'
    );
    err.statusCode = 400;
    throw err;
  }

  // Check actual binary magic bytes
  const detected = detectFileType(buffer);
  if (!detected) {
    const err = new Error(
      'Invalid file content. The file does not match any allowed file signature.'
    );
    err.statusCode = 400;
    throw err;
  }

  // Check signature matches declared type (allow jpg/jpeg equivalence)
  const isJpeg =
    (detected.ext === 'jpg' || detected.ext === 'jpeg') &&
    (ext === '.jpg' || ext === '.jpeg');
  const isMatch = isJpeg || detected.ext === ext.slice(1);

  if (!isMatch || detected.mime !== expectedMime) {
    const err = new Error(
      'File signature mismatch. The file content does not match its declared type.'
    );
    err.statusCode = 400;
    throw err;
  }

  return detected;
};

/**
 * Local filesystem implementation of PaymentProofStorage.
 * Keeps storage behind an abstraction so it can be swapped for S3/Blob storage later.
 */
class LocalPaymentProofStorage {
  constructor() {
    // Ensure storage directory exists
    if (!fs.existsSync(UPLOADS_ROOT)) {
      fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
    }
  }

  /**
   * Validates and saves a payment proof buffer.
   * Generates a cryptographically random server-side filename.
   * NEVER uses the client-provided original filename.
   *
   * @param {Buffer} buffer - File binary content
   * @param {string} originalFilename - Uploaded filename (for extension checking only)
   * @param {string} declaredMime - Uploaded MIME type
   * @returns {Promise<string>} Safe relative storage reference
   */
  async saveProof(buffer, originalFilename, declaredMime) {
    const validated = validateFileIntegrity(buffer, originalFilename, declaredMime);

    // Cryptographically secure randomized server filename
    const uniqueId = crypto.randomUUID();
    const safeFilename = `proof-${uniqueId}.${validated.ext}`;
    const destinationPath = path.join(UPLOADS_ROOT, safeFilename);

    // Prevent any possibility of directory traversal
    const resolvedPath = path.resolve(destinationPath);
    if (!resolvedPath.startsWith(UPLOADS_ROOT)) {
      throw new Error('Path traversal detected');
    }

    await fs.promises.writeFile(resolvedPath, buffer);

    // Return safe relative reference for database storage
    return `uploads/payment-proofs/${safeFilename}`;
  }

  /**
   * Deletes an uploaded payment proof file from disk.
   * Used for rolling back orphaned uploads if a database transaction fails.
   *
   * @param {string} storageRef - Relative storage reference
   * @returns {Promise<boolean>}
   */
  async deleteProof(storageRef) {
    if (!storageRef || typeof storageRef !== 'string') {
      return false;
    }

    const filename = path.basename(storageRef);
    const targetPath = path.join(UPLOADS_ROOT, filename);
    const resolvedPath = path.resolve(targetPath);

    // Prevent deletion outside the uploads folder
    if (!resolvedPath.startsWith(UPLOADS_ROOT)) {
      return false;
    }

    try {
      if (fs.existsSync(resolvedPath)) {
        await fs.promises.unlink(resolvedPath);
        return true;
      }
    } catch (e) {
      console.error('Failed to cleanup payment proof:', e.message);
    }
    return false;
  }

  /**
   * Checks if a proof exists.
   * @param {string} storageRef
   * @returns {Promise<boolean>}
   */
  async exists(storageRef) {
    if (!storageRef) return false;
    const filename = path.basename(storageRef);
    const targetPath = path.resolve(path.join(UPLOADS_ROOT, filename));
    if (!targetPath.startsWith(UPLOADS_ROOT)) return false;
    return fs.existsSync(targetPath);
  }

  /**
   * Returns a readable stream for a stored payment proof.
   * Used by admin endpoints to securely serve proof downloads.
   * NEVER exposes raw filesystem paths.
   *
   * @param {string} storageRef - Relative storage reference from database
   * @returns {Promise<{ stream: fs.ReadStream, filename: string, contentType: string }>}
   */
  async getProofReadStream(storageRef) {
    if (!storageRef || typeof storageRef !== 'string') {
      const err = new Error('Payment proof not found.');
      err.statusCode = 404;
      throw err;
    }

    const filename = path.basename(storageRef);
    const targetPath = path.resolve(path.join(UPLOADS_ROOT, filename));

    // Path traversal prevention
    if (!targetPath.startsWith(UPLOADS_ROOT)) {
      const err = new Error('Payment proof not found.');
      err.statusCode = 404;
      throw err;
    }

    if (!fs.existsSync(targetPath)) {
      const err = new Error('Payment proof file not found on server.');
      err.statusCode = 404;
      throw err;
    }

    // Determine content type from extension
    const ext = path.extname(filename).toLowerCase();
    const MIME_MAP = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
    };
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    return {
      stream: fs.createReadStream(targetPath),
      filename,
      contentType,
    };
  }
}

// Export singleton instance
export const paymentProofStorage = new LocalPaymentProofStorage();
