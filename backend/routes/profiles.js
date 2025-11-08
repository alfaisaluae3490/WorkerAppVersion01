// backend/routes/profiles.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken, requireRole } = require('../middleware/auth');
const { uploadSingleImage, deleteImage } = require('../config/cloudinary');
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage });

// ============================================
// GET /api/profiles/worker/me - Get my worker profile
// ============================================
router.get('/worker/me', verifyToken, requireRole('worker'), async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM worker_profiles WHERE user_id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Worker profile not found.'
      });
    }

    res.status(200).json({
      success: true,
      data: { profile: { ...result.rows[0], average_rating: Number(result.rows[0].average_rating) || 0, total_reviews: Number(result.rows[0].total_reviews) || 0, total_jobs_completed: Number(result.rows[0].total_jobs_completed) || 0 } }
    });

  } catch (error) {
    console.error('Error fetching worker profile:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ============================================
// GET /api/profiles/user/:userId - Get user profile by ID
// ============================================
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await query(
      'SELECT id, email, phone, full_name, role, profile_picture, address, city, province, bio, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ============================================
// GET /api/profiles/worker/:userId - Get worker profile by user ID
// ============================================
router.get('/worker/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await query(
      `SELECT wp.*, u.full_name, u.profile_picture, u.email 
       FROM worker_profiles wp 
       JOIN users u ON wp.user_id = u.id 
       WHERE wp.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Worker profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching worker profile:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ============================================
// GET /api/profiles/worker/profile/:profileId - Get worker profile by profile ID (public)
// ============================================
router.get('/worker/profile/:profileId', async (req, res) => {
  try {
    const { profileId } = req.params;
    
    const result = await query(
      `SELECT 
        wp.*,
        u.id as user_id,
        u.full_name,
        u.profile_picture,
        u.email
       FROM worker_profiles wp 
       JOIN users u ON wp.user_id = u.id 
       WHERE wp.id = $1`,
      [profileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Worker profile not found'
      });
    }

    const profile = result.rows[0];
    
    res.status(200).json({
      success: true,
      data: {
        profile: {
          id: profile.id,
          bio: profile.bio,
          services: profile.services,
          experience_years: profile.experience_years,
          city: profile.city,
          province: profile.province,
          average_rating: parseFloat(profile.average_rating) || 0,
          total_reviews: profile.total_reviews || 0,
          total_jobs_completed: profile.total_jobs_completed || 0,
          languages: profile.languages,
          is_verified: profile.is_verified
        },
        user: {
          id: profile.user_id,
          full_name: profile.full_name,
          profile_picture: profile.profile_picture,
          email: profile.email
        }
      }
    });

  } catch (error) {
    console.error('Error fetching worker profile by ID:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ============================================
// PUT /api/profiles/worker - Update worker profile (REMOVED HOURLY_RATE)
// ============================================
router.put('/worker', verifyToken, requireRole('worker'), upload.single('image'), async (req, res) => {
  const { bio, experience_years, city, province, address, services, languages } = req.body;
  const userId = req.user.id;

  try {
    let imageUrl = req.user.profile_picture; // Default to existing picture

    // Handle image upload
    if (req.file) {
      const userResult = await query('SELECT profile_picture FROM users WHERE id = $1', [userId]);
      const oldImageUrl = userResult.rows[0]?.profile_picture;
      if (oldImageUrl && oldImageUrl.includes('cloudinary')) {
         // Optional: delete old image
      }
      
      const uploadResult = await uploadSingleImage(req.file.buffer, 'worker-profiles');
      imageUrl = uploadResult.secure_url;
    }

    // Check if a profile already exists
    const existingProfile = await query(
      'SELECT * FROM worker_profiles WHERE user_id = $1',
      [userId]
    );


    // Parse arrays from request - FIX: Handle JSON strings from FormData
    let servicesArray = [];
    let languagesArray = [];
    
    console.log('Received services:', services, 'Type:', typeof services);
    console.log('Received languages:', languages, 'Type:', typeof languages);
    
    // If services is a string (from FormData JSON.stringify), parse it
    if (typeof services === 'string') {
      try {
        servicesArray = JSON.parse(services);
        console.log('Parsed services array:', servicesArray);
      } catch (e) {
        console.error('Failed to parse services:', e);
        servicesArray = [services];
      }
    } else if (Array.isArray(services)) {
      servicesArray = services;
    } else if (services) {
      servicesArray = [services];
    }
    
    // If languages is a string (from FormData JSON.stringify), parse it
    if (typeof languages === 'string') {
      try {
        languagesArray = JSON.parse(languages);
        console.log('Parsed languages array:', languagesArray);
      } catch (e) {
        console.error('Failed to parse languages:', e);
        languagesArray = [languages];
      }
    } else if (Array.isArray(languages)) {
      languagesArray = languages;
    } else if (languages) {
      languagesArray = [languages];
    }

    let profileResult;

    if (existingProfile.rows.length > 0) {
      // Update existing profile (NO hourly_rate)
      console.log('Updating profile with services:', servicesArray, 'and languages:', languagesArray);
      profileResult = await query(
        `UPDATE worker_profiles 
         SET bio = $1, experience_years = $2, city = $3, province = $4, 
             address = $5, services = $6, languages = $7, updated_at = NOW()
         WHERE user_id = $8
         RETURNING *`,
        [bio, experience_years, city, province, address, JSON.stringify(servicesArray), JSON.stringify(languagesArray), userId]
      );
    } else {
      // Create new profile (NO hourly_rate)
      console.log('Creating new profile with services:', servicesArray, 'and languages:', languagesArray);
      profileResult = await query(
        `INSERT INTO worker_profiles (user_id, bio, experience_years, city, province, address, services, languages)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [userId, bio, experience_years, city, province, address, JSON.stringify(servicesArray), JSON.stringify(languagesArray)]
      );
    }
    
    // Also update the main users table with the new profile picture URL
    if (req.file) {
        await query('UPDATE users SET profile_picture = $1 WHERE id = $2', [imageUrl, userId]);
    }

    res.status(200).json({
      success: true,
      message: 'Worker profile updated successfully',
      data: { 
  profile: profileResult.rows[0],
  profile_picture: imageUrl
}
    });

  } catch (error) {
    console.error('Error updating worker profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update worker profile',
      error: error.message
    });
  }
});

// ============================================
// PUT /api/profiles/me - Update user personal profile
// ============================================
router.put("/me", verifyToken, upload.single("image"), async (req, res) => {
  try {
    const { full_name, phone, address, city, province, bio } = req.body;
    const userId = req.user.id;

    if (!full_name || full_name.trim().length < 2) {
      return res.status(400).json({ success: false, message: "Name must be at least 2 characters" });
    }

    if (!phone || phone.length < 10) {
      return res.status(400).json({ success: false, message: "Please provide a valid phone number" });
    }

    let profilePictureUrl = req.user.profile_picture;
    if (req.file) {
      try {
        console.log("Uploading image to Cloudinary...");
        if (profilePictureUrl) await deleteImage(profilePictureUrl);
        const uploadResult = await uploadSingleImage(req.file.buffer, 'profile-pictures');
        profilePictureUrl = uploadResult.secure_url;
        console.log("Image uploaded successfully:", profilePictureUrl);
      } catch (uploadError) {
        console.error("Image upload error:", uploadError);
        // Don't fail the entire request if image upload fails
      }
    }

    const updateResult = await query(
      `UPDATE users 
       SET full_name = $1, phone = $2, address = $3, city = $4, province = $5, 
           bio = $6, profile_picture = $7, updated_at = NOW() 
       WHERE id = $8 
       RETURNING id, email, phone, full_name, role, is_verified, is_active, 
                 profile_picture, address, city, province, bio, created_at, updated_at`,
      [full_name, phone, address, city, province, bio, profilePictureUrl, userId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ 
      success: true, 
      message: "Profile updated successfully", 
      user: updateResult.rows[0] 
    });
  } catch (error) {
    console.error("Update user profile error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update profile", 
      error: error.message 
    });
  }
});

// ============================================
// PUT /api/profiles/user - Alternative route for user profile update
// ============================================
router.put("/user", verifyToken, upload.single("image"), async (req, res) => {
  try {
    const { full_name, phone, address, city, province, bio } = req.body;
    const userId = req.user.id;

    if (!full_name || full_name.trim().length < 2) {
      return res.status(400).json({ success: false, message: "Name must be at least 2 characters" });
    }

    if (!phone || phone.length < 10) {
      return res.status(400).json({ success: false, message: "Please provide a valid phone number" });
    }

    let profilePictureUrl = req.user.profile_picture;
    if (req.file) {
      try {
        console.log("Uploading image to Cloudinary...");
        if (profilePictureUrl) await deleteImage(profilePictureUrl);
        const uploadResult = await uploadSingleImage(req.file.buffer, 'profile-pictures');
        profilePictureUrl = uploadResult.secure_url;
        console.log("Image uploaded successfully:", profilePictureUrl);
      } catch (uploadError) {
        console.error("Image upload error:", uploadError);
      }
    }

    const updateResult = await query(
      `UPDATE users 
       SET full_name = $1, phone = $2, address = $3, city = $4, province = $5, 
           bio = $6, profile_picture = $7, updated_at = NOW() 
       WHERE id = $8 
       RETURNING id, email, phone, full_name, role, is_verified, is_active, 
                 profile_picture, address, city, province, bio, created_at, updated_at`,
      [full_name, phone, address, city, province, bio, profilePictureUrl, userId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ 
      success: true, 
      message: "Profile updated successfully", 
      data: { user: updateResult.rows[0] } 
    });
  } catch (error) {
    console.error("Update user profile error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update profile", 
      error: error.message 
    });
  }
});


module.exports = router;