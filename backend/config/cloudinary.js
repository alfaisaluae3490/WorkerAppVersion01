// backend/config/cloudinary.js
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Upload image helper
const uploadImage = async (fileBuffer, folder = 'marketplace') => {
  return new Promise((resolve, reject) => {
    // Convert ArrayBuffer to Buffer if needed
    const buffer = fileBuffer instanceof ArrayBuffer 
      ? Buffer.from(fileBuffer) 
      : fileBuffer;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: 'auto',
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto:good' }
        ]
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

// Upload multiple images
const uploadMultipleImages = async (files, folder = 'marketplace') => {
  const uploadPromises = files.map(file => uploadImage(file.buffer, folder));
  const results = await Promise.all(uploadPromises);
  return results.map(result => result.secure_url);
};

// Delete image
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
};

// Generate thumbnail URL
const getThumbnailUrl = (publicId, width = 300, height = 300) => {
  return cloudinary.url(publicId, {
    width,
    height,
    crop: 'fill',
    quality: 'auto:low'
  });
};

module.exports = {
  cloudinary,
  uploadImage,
  uploadSingleImage: uploadImage,  // ← Added alias
  uploadMultipleImages,
  deleteImage,
  getThumbnailUrl
};