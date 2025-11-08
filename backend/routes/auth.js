// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { validateSignup, validateLogin, validateOTP } = require('../middleware/validation');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Generate OTP code
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// ============================================
// POST /api/auth/signup
// Register new user
// ============================================
router.post('/signup', validateSignup, async (req, res) => {
  try {
    const { email, phone, password, full_name, role = 'customer' } = req.body;

    // Check if user exists (case-insensitive for email)
    const existingUser = await query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) OR phone = $2',
      [email, phone]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or phone already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Create user
    const result = await query(
      `INSERT INTO users (email, phone, password_hash, full_name, role, is_verified)
       VALUES ($1, $2, $3, $4, $5, false)
       RETURNING id, email, phone, full_name, role, is_verified, created_at`,
      [email, phone, password_hash, full_name, role]
    );

    const user = result.rows[0];

    // Generate OTP for phone verification
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await query(
      `INSERT INTO otp_codes (phone, code, purpose, expires_at)
       VALUES ($1, $2, 'verification', $3)`,
      [phone, otp, expiresAt]
    );

    // In development, return OTP in response
    // In production, send via SMS
    console.log(`📱 OTP for ${phone}: ${otp}`);

    // Generate token
    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please verify your phone.',
      data: {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          full_name: user.full_name,
          role: user.role,
          is_verified: user.is_verified
        },
        token,
        otp: process.env.NODE_ENV === 'development' ? otp : undefined // Only in dev
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during signup',
      error: error.message
    });
  }
});

// ============================================
// POST /api/auth/verify-otp
// Verify phone with OTP
// ============================================
router.post('/verify-otp', validateOTP, async (req, res) => {
  try {
    const { phone, code } = req.body;

    // Find valid OTP
    const result = await query(
      `SELECT * FROM otp_codes
       WHERE phone = $1 AND code = $2 AND purpose = 'verification'
         AND expires_at > NOW() AND is_used = false
       ORDER BY created_at DESC
       LIMIT 1`,
      [phone, code]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP code'
      });
    }

    // Mark OTP as used
    await query(
      'UPDATE otp_codes SET is_used = true WHERE id = $1',
      [result.rows[0].id]
    );

    // Update user verification status
    const userResult = await query(
      `UPDATE users SET is_verified = true
       WHERE phone = $1
       RETURNING id, email, phone, full_name, role, is_verified`,
      [phone]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];
    const token = generateToken(user.id);

    res.json({
      success: true,
      message: 'Phone verified successfully',
      data: {
        user,
        token
      }
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during verification',
      error: error.message
    });
  }
});

// ============================================
// POST /api/auth/resend-otp
// Resend OTP code
// ============================================
router.post('/resend-otp', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Check if user exists
    const userResult = await query(
      'SELECT id, is_verified FROM users WHERE phone = $1',
      [phone]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (userResult.rows[0].is_verified) {
      return res.status(400).json({
        success: false,
        message: 'Phone already verified'
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await query(
      `INSERT INTO otp_codes (phone, code, purpose, expires_at)
       VALUES ($1, $2, 'verification', $3)`,
      [phone, otp, expiresAt]
    );

    console.log(`📱 New OTP for ${phone}: ${otp}`);

    res.json({
      success: true,
      message: 'OTP sent successfully',
      otp: process.env.NODE_ENV === 'development' ? otp : undefined
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// ============================================
// POST /api/auth/login
// Login with email/phone and password
// ============================================
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier = email or phone

    // Find user by email or phone (case-insensitive for email)
    const result = await query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR phone = $2',
      [identifier, identifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = result.rows[0];

    // Check if account is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated'
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken(user.id);

    // Remove sensitive data
    delete user.password_hash;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          full_name: user.full_name,
          role: user.role,
          is_verified: user.is_verified,
          profile_picture: user.profile_picture,
          city: user.city,
          province: user.province,
          address: user.address,
          bio: user.bio
        },
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
    });
  }
});

// ============================================
// GET /api/auth/me
// Get current user profile
// ============================================
router.get('/me', verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.*, 
              wp.bio, wp.services, wp.average_rating, wp.total_reviews, 
              wp.is_verified as worker_verified, wp.subscription_tier
       FROM users u
       LEFT JOIN worker_profiles wp ON u.id = wp.user_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = result.rows[0];
    delete user.password_hash;

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// ============================================
// POST /api/auth/switch-role
// Switch between customer and worker roles
// FIXED: Accept both 'role' and 'new_role' parameters
// ============================================
router.post('/switch-role', verifyToken, async (req, res) => {
  try {
    // Accept both 'role' and 'new_role' for backwards compatibility
    const newRole = req.body.role || req.body.new_role;

    if (!newRole) {
      return res.status(400).json({
        success: false,
        message: 'Role parameter is required'
      });
    }

    if (!['customer', 'worker', 'both'].includes(newRole)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be: customer, worker, or both'
      });
    }

    // Update user role
    const result = await query(
      `UPDATE users SET role = $1 
       WHERE id = $2 
       RETURNING id, email, phone, full_name, role, is_verified, profile_picture, is_active`,
      [newRole, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const updatedUser = result.rows[0];

    // If switching to worker, create worker profile if doesn't exist
    if (newRole === 'worker' || newRole === 'both') {
      await query(
        `INSERT INTO worker_profiles (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
        [req.user.id]
      );
    }

    res.json({
      success: true,
      message: `Role switched to ${newRole} successfully`,
      data: {
        user: updatedUser
      }
    });

  } catch (error) {
    console.error('Switch role error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router;