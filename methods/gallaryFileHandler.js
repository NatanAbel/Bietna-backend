const sharp = require("sharp"); //Sharp is a high-performance Node.js image processing library that supports image compression and resizing.
const { bucket } = require("../firebaseAdmin");
const { v4: uuidv4 } = require("uuid");

const gallaryValidateFiles = async (files) => {
    const validTypes = ["image/jpeg", "image/png", "image/gif"];
    const maxSize = 5 * 1024 * 1024; // 5MB
  
    // Define valid magic bytes (file signatures)
    const validSignatures = {
      "image/jpeg": [0xff, 0xd8], // JPEG (FFD8)
      "image/png": [0x89, 0x50], // PNG (8950)
      "image/gif": [0x47, 0x49], // GIF (4749)
    };
  
    for (const file of files) {
      // MIME Type Check (based on file extension or metadata)
      const mimeType = file.mimetype; // Get MIME type based on file extension
  
      if (!mimeType || !validTypes.includes(mimeType)) {
        return {
          valid: false,
          message: "Invalid MIME type",
        };
      }
  
      // File Size Check
      if (file.size > maxSize) {
        return {
          valid: false,
          message: "File size exceeds the 5MB limit",
        };
      }
  
      // Magic Byte Validation
      const fileBuffer = file.buffer.slice(0, validSignatures[mimeType].length); // Slice enough bytes for the signature
      const signature = [...fileBuffer];
  
      // Check the magic bytes for the expected MIME type
      const expectedSignature = validSignatures[mimeType];
  
      if (
        !expectedSignature ||
        !signature.every((byte, idx) => byte === expectedSignature[idx])
      ) {
        return {
          valid: false,
          message: "Invalid file signature (magic bytes) or MIME type mismatch",
        };
      }
    }
  
    return { valid: true };
  };
  
  const sanitizeFileName = (originalName) => {
    const sanitized = originalName
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 100)
      .replace(/\.\.+/, "_"); // Remove dangerous characters like "..";
    const uniqueSuffix = uuidv4(); // Use UUID for uniqueness
    return sanitized + "-" + uniqueSuffix;
  };
  
  // Background job for processing image uploads
  const gallaryImageUpload = async (file, userId, timestamp) => {
    const sanitizedFileName = sanitizeFileName(file.originalname);
  
    try {
      // Sanitize image (resize and optimize)
      const sanitizedImage = await sharp(file.buffer)
        .resize(800, 800, { fit: "inside" }) // Resize to max 800x800
        .toBuffer();
  
      const filePath = `house_images/${userId}/${sanitizedFileName}-${timestamp}`;
      const blob = bucket.file(filePath);
      const blobStream = blob.createWriteStream({
        resumable: false,
        contentType: file.mimetype,
        predefinedAcl: "publicRead", // Public bucket access
      });
  
      return new Promise((resolve, reject) => {
        blobStream.on("error", (err) => reject(err));
  
        blobStream.on("finish", () => {
          const publicUrl = `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET}/${filePath}`;
          resolve(publicUrl);
        });
  
        blobStream.end(sanitizedImage);
      });
    } catch (error) {
      console.error("Error processing image:", error);
      throw error;
    }
  };

  const sanitizeHouseResponse = async (house) => {
    if (!house) return null;
  
    const houseObj = house.toObject ? house.toObject() : { ...house };
    const { __v, ...cleanHouse } = houseObj;
  
    // Encode IDs
    if (cleanHouse._id) {
      cleanHouse._id = `house_${Buffer.from(cleanHouse._id.toString()).toString('base64')}`;
    }
  
    if (cleanHouse.postedBy) {
      cleanHouse.postedBy = `user_${Buffer.from(cleanHouse.postedBy.toString()).toString('base64')}`;
    }
    // Trim all string fields
    Object.keys(cleanHouse).forEach(key => {
      if (typeof cleanHouse[key] === 'string') {
        cleanHouse[key] = cleanHouse[key].trim();
      }
    });
  
    // Remove null fields
    Object.keys(cleanHouse).forEach(key => {
      if (cleanHouse[key] === null) {
        delete cleanHouse[key];
      }
    });
  
    // Format dates consistently
    if (cleanHouse.createdAt) {
      cleanHouse.createdAt = new Date(cleanHouse.createdAt).toLocaleDateString();
    }
    if (cleanHouse.updatedAt) {
      cleanHouse.updatedAt = new Date(cleanHouse.updatedAt).toLocaleDateString();
    }
  
    // Create a more unique version hash using multiple values
    cleanHouse.version = Buffer.from(
      `${cleanHouse._id}${cleanHouse.updatedAt}${Math.random()}`
    ).toString('base64').slice(0, 12);
  
    return cleanHouse;
  };

  module.exports = {
    gallaryValidateFiles,
    gallaryImageUpload,
    sanitizeHouseResponse
  };
  