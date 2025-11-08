// backend/routes/admin.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const { uploadSingleImage, deleteImage } = require('../config/cloudinary');

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Apply admin middleware to all routes
router.use(verifyToken);
router.use(requireAdmin);
// ============================================
// DASHBOARD ANALYTICS
// ============================================
router.get('/dashboard/analytics', async (req, res) => {
  try {
    // Get overall platform statistics
    const stats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'customer') as total_customers,
        (SELECT COUNT(*) FROM users WHERE role = 'worker' OR role = 'both') as total_workers,
        (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users,
        (SELECT COUNT(*) FROM jobs) as total_jobs,
        (SELECT COUNT(*) FROM jobs WHERE status = 'open') as open_jobs,
        (SELECT COUNT(*) FROM jobs WHERE status = 'completed') as completed_jobs,
        (SELECT COUNT(*) FROM bids) as total_bids,
        (SELECT COUNT(*) FROM bookings) as total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status = 'completed') as completed_bookings,
        (SELECT COUNT(*) FROM disputes WHERE status = 'open') as open_disputes,
        (SELECT COUNT(*) FROM reports WHERE status = 'pending') as pending_reports,
        (SELECT COALESCE(SUM(agreed_amount), 0) FROM bookings WHERE status = 'completed') as total_revenue
    `);

    // Get recent activity (last 30 days)
    const recentActivity = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        'users' as type
      FROM users 
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      UNION ALL
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        'jobs' as type
      FROM jobs 
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      UNION ALL
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        'bookings' as type
      FROM bookings 
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC, type
    `);

    // Get revenue by month (last 12 months)
    const revenueByMonth = await query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', completed_at), 'YYYY-MM') as month,
        COUNT(*) as bookings_count,
        COALESCE(SUM(agreed_amount), 0) as total_amount
      FROM bookings
      WHERE status = 'completed' 
        AND completed_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', completed_at)
      ORDER BY month DESC
    `);

    // Get top categories
    const topCategories = await query(`
      SELECT 
        c.name,
        COUNT(j.id) as job_count
      FROM categories c
      LEFT JOIN jobs j ON c.id = j.category_id
      GROUP BY c.id, c.name
      ORDER BY job_count DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        stats: stats.rows[0],
        recentActivity: recentActivity.rows,
        revenueByMonth: revenueByMonth.rows,
        topCategories: topCategories.rows
      }
    });

  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});








// ============================================
// USER MANAGEMENT
// ============================================

// Reset user password
router.patch('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(new_password, salt);

    const result = await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, full_name',
      [password_hash, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'reset_password', 'user', id, JSON.stringify({ reset_by: 'admin' })]
    );

    await query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, $2, $3, $4)`,
      [id, 'security', 'Password Reset', 'Your password has been reset by an administrator. Please login with your new password.']
    );

    res.json({
      success: true,
      message: 'Password reset successfully',
      data: { user: result.rows[0] }
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: error.message
    });
  }
});




// Get all users with filters
router.get('/users', async (req, res) => {
  try {
    const { search, role, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    let params = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (u.full_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR u.phone ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (role) {
      whereClause += ` AND u.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (status === 'active') {
      whereClause += ` AND u.is_active = true`;
    } else if (status === 'inactive') {
      whereClause += ` AND u.is_active = false`;
    }

    const result = await query(
      `SELECT 
        u.*,
        wp.average_rating,
        wp.total_jobs_completed,
        wp.is_verified as worker_verified,
        (SELECT COUNT(*) FROM jobs WHERE customer_id = u.id) as jobs_posted,
        (SELECT COUNT(*) FROM bids b JOIN worker_profiles wp2 ON b.worker_id = wp2.id WHERE wp2.user_id = u.id) as bids_placed
      FROM users u
      LEFT JOIN worker_profiles wp ON u.id = wp.user_id
      WHERE ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM users u WHERE ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        users: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].count),
          pages: Math.ceil(countResult.rows[0].count / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// Get single user details
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

   const userResult = await query(
  `SELECT 
    u.*,
    COALESCE(wp.bio, u.bio) as bio,
    wp.services,
    wp.hourly_rate,
    wp.address as wp_address,
    wp.city as wp_city,
    wp.province as wp_province,
    wp.average_rating,
    wp.total_reviews,
    wp.total_jobs_completed,
    wp.is_verified as worker_verified,
    wp.experience_years,
    wp.languages
  FROM users u
  LEFT JOIN worker_profiles wp ON u.id = wp.user_id
  WHERE u.id = $1`,
  [id]
);

if (userResult.rows.length === 0) {
  return res.status(404).json({
    success: false,
    message: 'User not found'
  });
}

const userData = userResult.rows[0];

// Merge worker profile data with user data
const mergedData = {
  ...userData,
  address: userData.wp_address || userData.address,
  city: userData.wp_city || userData.city,
  province: userData.wp_province || userData.province
};

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's jobs (if customer)
    const jobsResult = await query(
      `SELECT id, title, status, created_at, 
        (SELECT COUNT(*) FROM bids WHERE job_id = jobs.id) as bids_count
      FROM jobs 
      WHERE customer_id = $1 
      ORDER BY created_at DESC 
      LIMIT 10`,
      [id]
    );

    // Get user's bids (if worker)
    const bidsResult = await query(
      `SELECT b.*, j.title as job_title, j.status as job_status
      FROM bids b
      JOIN jobs j ON b.job_id = j.id
      JOIN worker_profiles wp ON b.worker_id = wp.id
      WHERE wp.user_id = $1
      ORDER BY b.created_at DESC
      LIMIT 10`,
      [id]
    );

    // Get user's bookings
    const bookingsResult = await query(
      `SELECT * FROM bookings 
      WHERE customer_id = $1 OR worker_id IN (SELECT id FROM worker_profiles WHERE user_id = $1)
      ORDER BY created_at DESC 
      LIMIT 10`,
      [id]
    );

    // Get admin logs for this user
    const logsResult = await query(
      `SELECT al.*, u.full_name as admin_name
      FROM admin_logs al
      LEFT JOIN users u ON al.admin_id = u.id
      WHERE al.target_id = $1
      ORDER BY al.created_at DESC
      LIMIT 20`,
      [id]
    );

res.json({
  success: true,
  data: {
    user: mergedData,
    jobs: jobsResult.rows,
    bids: bidsResult.rows,
    bookings: bookingsResult.rows,
    adminLogs: logsResult.rows
  }
});

  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user details',
      error: error.message
    });
  }
});

// Verify worker
router.patch('/users/:id/verify-worker', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user has worker profile
    const workerCheck = await query(
      'SELECT id FROM worker_profiles WHERE user_id = $1',
      [id]
    );

    if (workerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Worker profile not found'
      });
    }

    // Update verification status
    await query(
      'UPDATE worker_profiles SET is_verified = true WHERE user_id = $1',
      [id]
    );

    // Log admin action
    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'verify_worker', 'user', id, JSON.stringify({ verified: true })]
    );

    // Send notification to worker
    await query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, $2, $3, $4)`,
      [id, 'verification', 'Profile Verified', 'Your worker profile has been verified by admin']
    );

    res.json({
      success: true,
      message: 'Worker verified successfully'
    });

  } catch (error) {
    console.error('Verify worker error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify worker',
      error: error.message
    });
  }
});

// Suspend/Unsuspend user
router.patch('/users/:id/toggle-active', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Get current status
    const userResult = await query(
      'SELECT is_active FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const newStatus = !userResult.rows[0].is_active;

    // Update status
    await query(
      'UPDATE users SET is_active = $1 WHERE id = $2',
      [newStatus, id]
    );

    // Log admin action
    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        newStatus ? 'activate_user' : 'suspend_user',
        'user',
        id,
        JSON.stringify({ reason, newStatus })
      ]
    );

    // Send notification
    await query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, $2, $3, $4)`,
      [
        id,
        'account_status',
        newStatus ? 'Account Activated' : 'Account Suspended',
        newStatus 
          ? 'Your account has been reactivated' 
          : `Your account has been suspended. Reason: ${reason || 'Terms violation'}`
      ]
    );

    res.json({
      success: true,
      message: `User ${newStatus ? 'activated' : 'suspended'} successfully`,
      data: { is_active: newStatus }
    });

  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: error.message
    });
  }
});










// Update user details
router.patch('/users/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, phone, role, address, city, province, bio } = req.body;
    
    console.log('=== UPDATE USER REQUEST ===');
    console.log('User ID:', id);
    console.log('Full req.body:', req.body);
    console.log('City received:', city);
    console.log('Province received:', province);

    let profile_picture = null;

    // Handle image upload
    if (req.file) {
      try {
        const uploadResult = await uploadSingleImage(req.file.buffer);
        // Extract just the secure_url from the Cloudinary response
        profile_picture = uploadResult.secure_url || uploadResult.url;
        
        console.log('Uploaded image URL:', profile_picture);
        
        // Delete old image if exists
        const oldUserData = await query('SELECT profile_picture FROM users WHERE id = $1', [id]);
        if (oldUserData.rows[0]?.profile_picture) {
          await deleteImage(oldUserData.rows[0].profile_picture);
        }
      } catch (uploadError) {
        console.error('Image upload error:', uploadError);
      }
    }

    const result = await query(
      `UPDATE users 
       SET full_name = COALESCE($1, full_name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           role = COALESCE($4, role),
           address = COALESCE($5, address),
           city = COALESCE($6, city),
           province = COALESCE($7, province),
           bio = COALESCE($8, bio),
           profile_picture = COALESCE($9, profile_picture)
       WHERE id = $10
       RETURNING *`,
      [full_name, email, phone, role, address, city, province, bio, profile_picture, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Log admin action
    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'update_user', 'user', id, JSON.stringify({ full_name, email, phone, role })]
    );

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user: result.rows[0] }
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message
    });
  }
});
























// Create new user (worker or customer) - WITH IMAGE UPLOAD SUPPORT
router.post('/users/create', upload.single('image'), async (req, res) => {
  try {
  const { email, phone, password, full_name, role, address, city, province, bio } = req.body;
    
    console.log('=== CREATE USER REQUEST ===');
    console.log('Full req.body:', req.body);
    console.log('City received:', city);
    console.log('Province received:', province);
    console.log('Address received:', address);
    console.log('Bio received:', bio);
    console.log('Has file?', req.file ? 'YES' : 'NO');

    if (!email || !phone || !password || !full_name || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, phone, password, full name, and role are required'
      });
    }

    const normalizedRole = String(role).toLowerCase().trim();

    if (!['customer', 'worker', 'both', 'admin'].includes(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role: ${normalizedRole}`
      });
    }

    // Check if user exists
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
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Handle image upload if provided
    let profile_picture = null;
    if (req.file) {
      try {
        const uploadResult = await uploadSingleImage(req.file.buffer);
        profile_picture = uploadResult.secure_url || uploadResult.url;
        console.log('Uploaded profile picture:', profile_picture);
      } catch (uploadError) {
        console.error('Image upload error:', uploadError);
      }
    }

    // Create user with all fields including profile picture
    const userResult = await query(
      `INSERT INTO users (email, phone, password_hash, full_name, role, address, city, province, bio, profile_picture, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
       RETURNING *`,
      [
        email.trim(), 
        phone.trim(), 
        password_hash, 
        full_name.trim(), 
        normalizedRole, 
        address || null, 
        city || null, 
        province || null, 
        bio || null,
        profile_picture
      ]
    );

    const user = userResult.rows[0];

    // Create worker profile if needed
    if (normalizedRole === 'worker' || normalizedRole === 'both') {
      await query(
        `INSERT INTO worker_profiles (user_id, address, city, province, bio) 
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, address || null, city || null, province || null, bio || null]
      );
    }

    // Log admin action
    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'create_user', 'user', user.id, JSON.stringify({ email, phone, role: normalizedRole, full_name })]
    );

    delete user.password_hash;

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { user }
    });

  } catch (error) {
    console.error('CREATE USER ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message,
      detail: error.detail
    });
  }
});


















// Update worker profile details
router.patch('/users/:id/worker-profile', async (req, res) => {
  try {
    const { id } = req.params;
    const { bio, services, experience_years, hourly_rate, address, city, province, languages, gender } = req.body;

    console.log('Worker profile update request for user:', id);
    console.log('Data received:', { bio, services, experience_years, hourly_rate, gender, languages: languages?.length });

    // Check if user has worker profile, if not create one
    const workerCheck = await query(
      'SELECT id FROM worker_profiles WHERE user_id = $1',
      [id]
    );

    let workerId;

    if (workerCheck.rows.length === 0) {
      console.log('Creating new worker profile for user:', id);
      // Create worker profile
      const newWorker = await query(
        `INSERT INTO worker_profiles (user_id, address, city, province, bio)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [id, address || null, city || null, province || null, bio || null]
      );
      
      workerId = newWorker.rows[0].id;
      console.log('Created worker profile with ID:', workerId);
    } else {
      workerId = workerCheck.rows[0].id;
      console.log('Using existing worker profile ID:', workerId);
    }

    // Parse services and languages as JSONB if provided as strings
    let servicesJson = services;
    let languagesJson = languages;

    if (typeof services === 'string') {
      try {
        servicesJson = JSON.parse(services);
      } catch (e) {
        servicesJson = [services];
      }
    }

    if (typeof languages === 'string') {
      try {
        languagesJson = JSON.parse(languages);
      } catch (e) {
        languagesJson = [languages];
      }
    }

    // Ensure arrays for JSONB columns
    const finalServices = Array.isArray(servicesJson) ? servicesJson : [];
    const finalLanguages = Array.isArray(languagesJson) ? languagesJson : [];

    console.log('Updating worker profile with services:', finalServices.length, 'languages:', finalLanguages.length);

// Update worker profile
    const result = await query(
      `UPDATE worker_profiles
       SET bio = COALESCE($1, bio),
           services = $2,
           experience_years = $3,
           hourly_rate = $4,
           address = COALESCE($5, address),
           city = COALESCE($6, city),
           province = COALESCE($7, province),
           languages = $8,
           gender = $9,
           updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        bio,
        JSON.stringify(finalServices),
        experience_years ? parseInt(experience_years) : null,
        hourly_rate ? parseFloat(hourly_rate) : null,
        address,
        city,
        province,
        JSON.stringify(finalLanguages),
        gender || null,
        workerId
      ]
    );

    // Also update users table with same location data
    if (city || province || address || bio) {
      await query(
        `UPDATE users
         SET city = COALESCE($1, city),
             province = COALESCE($2, province),
             address = COALESCE($3, address),
             bio = COALESCE($4, bio)
         WHERE id = $5`,
        [city, province, address, bio, id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Worker profile not found'
      });
    }

    console.log('Worker profile updated successfully');

    // Log admin action
    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'update_worker_profile', 'user', id, JSON.stringify({
        services_count: finalServices.length,
        languages_count: finalLanguages.length,
        has_experience: !!experience_years,
        has_rate: !!hourly_rate
      })]
    );

    res.json({
      success: true,
      message: 'Worker profile updated successfully',
      data: { profile: result.rows[0] }
    });

  } catch (error) {
    console.error('Update worker profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update worker profile',
      error: error.message
    });
  }
});
























// Update customer profile details
router.patch('/users/:id/customer-profile', async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, phone, address, city, province, bio } = req.body;

    const result = await query(
      `UPDATE users
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           address = COALESCE($3, address),
           city = COALESCE($4, city),
           province = COALESCE($5, province),
           bio = COALESCE($6, bio),
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, email, phone, full_name, role, address, city, province, bio, is_verified, is_active, created_at, updated_at`,
      [full_name, phone, address, city, province, bio, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Log admin action
    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'update_customer_profile', 'user', id, JSON.stringify(req.body)]
    );

    res.json({
      success: true,
      message: 'Customer profile updated successfully',
      data: { user: result.rows[0] }
    });

  } catch (error) {
    console.error('Update customer profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update customer profile',
      error: error.message
    });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting own account
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Log before deletion
    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'delete_user', 'user', id, JSON.stringify({ deleted: true })]
    );

    // Delete user (cascade will handle related records)
    const result = await query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
});

// ============================================
// JOB & BID MANAGEMENT
// ============================================

// Get all jobs
router.get('/jobs', async (req, res) => {
  try {
    const { status, category, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    let params = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND j.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (category) {
      whereClause += ` AND j.category_id = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (j.title ILIKE $${paramIndex} OR j.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const result = await query(
      `SELECT 
        j.*,
        c.name as category_name,
        u.full_name as customer_name,
        u.email as customer_email,
        (SELECT COUNT(*) FROM bids WHERE job_id = j.id) as bids_count,
        (SELECT COUNT(*) FROM reports WHERE reported_type = 'job' AND reported_id = j.id) as reports_count
      FROM jobs j
      LEFT JOIN categories c ON j.category_id = c.id
      LEFT JOIN users u ON j.customer_id = u.id
      WHERE ${whereClause}
      ORDER BY j.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM jobs j WHERE ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        jobs: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].count),
          pages: Math.ceil(countResult.rows[0].count / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch jobs',
      error: error.message
    });
  }
});

// Get job details with bids
router.get('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const jobResult = await query(
      `SELECT 
        j.*,
        c.name as category_name,
        u.full_name as customer_name,
        u.email as customer_email,
        u.phone as customer_phone
      FROM jobs j
      LEFT JOIN categories c ON j.category_id = c.id
      LEFT JOIN users u ON j.customer_id = u.id
      WHERE j.id = $1`,
      [id]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Get all bids for this job
    const bidsResult = await query(
      `SELECT 
        b.*,
        u.full_name as worker_name,
        u.email as worker_email,
        wp.average_rating,
        wp.total_jobs_completed
      FROM bids b
      JOIN worker_profiles wp ON b.worker_id = wp.id
      JOIN users u ON wp.user_id = u.id
      WHERE b.job_id = $1
      ORDER BY b.created_at DESC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        job: jobResult.rows[0],
        bids: bidsResult.rows
      }
    });

  } catch (error) {
    console.error('Get job details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job details',
      error: error.message
    });
  }
});

// Update job status
router.patch('/jobs/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['open', 'assigned', 'in_progress', 'completed', 'cancelled', 'disputed'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const result = await query(
      'UPDATE jobs SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Log admin action
    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'update_job_status', 'job', id, JSON.stringify({ status })]
    );

    res.json({
      success: true,
      message: 'Job status updated successfully',
      data: { job: result.rows[0] }
    });

  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update job status',
      error: error.message
    });
  }
});
























// Update/Edit job
router.put('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category_id, budget_min, budget_max, location_address, city, province, preferred_date, preferred_time, status, gender_preference, requires_verification, requires_insurance, images } = req.body;

    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    const existingJob = await query('SELECT * FROM jobs WHERE id = $1', [id]);
    if (existingJob.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

  let imagesArray = null;
    if (images) {
      try {
        let parsedImages = Array.isArray(images) ? images : (typeof images === 'string' ? JSON.parse(images) : []);
        if (Array.isArray(parsedImages) && parsedImages.length > 0) {
          imagesArray = parsedImages;
        }
      } catch (parseError) {
        console.error('Image parsing error:', parseError);
        imagesArray = existingJob.rows[0].images;
      }
    } else {
      imagesArray = existingJob.rows[0].images;
    }

    const result = await query(
      `UPDATE jobs SET title = $1, description = $2, category_id = $3, budget_min = $4, budget_max = $5, location_address = $6, city = $7, province = $8, preferred_date = $9, preferred_time = $10, status = $11, gender_preference = $12, requires_verification = $13, requires_insurance = $14, images = $15, updated_at = CURRENT_TIMESTAMP WHERE id = $16 RETURNING *`,
      [title, description, category_id || null, budget_min || null, budget_max || null, location_address, city, province, preferred_date || null, preferred_time || null, status || existingJob.rows[0].status, gender_preference || 'any', requires_verification || false, requires_insurance || false, imagesArray ? JSON.stringify(imagesArray) : null, id]

    );

    await query(`INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)`, [req.user.id, 'update_job', 'job', id, JSON.stringify({ title, description })]);

    res.json({ success: true, message: 'Job updated successfully', data: { job: result.rows[0] } });
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ success: false, message: 'Failed to update job', error: error.message });
  }
});















// Delete job
router.delete('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Log before deletion
    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'delete_job', 'job', id, JSON.stringify({ deleted: true })]
    );

    const result = await query('DELETE FROM jobs WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    res.json({
      success: true,
      message: 'Job deleted successfully'
    });

  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete job',
      error: error.message
    });
  }
});

// ============================================
// DISPUTE & COMPLAINT MANAGEMENT
// ============================================

// Get all reports
router.get('/reports', async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    let params = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND r.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (type) {
      whereClause += ` AND r.reported_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    const result = await query(
      `SELECT 
        r.id, r.case_id, r.reporter_id, r.reported_type, r.reported_id,
        r.title, r.reason, r.description, r.status, r.admin_notes, r.resolved_by,
        r.created_at, r.resolved_at,
        COALESCE(r.images, '[]'::jsonb)::text as images,
        u.full_name as reporter_name,
        u.email as reporter_email,
        resolver.full_name as resolver_name
      FROM reports r
      JOIN users u ON r.reporter_id = u.id
      LEFT JOIN users resolver ON r.resolved_by = resolver.id
      WHERE ${whereClause}
      ORDER BY 
        CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
        r.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM reports r WHERE ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        reports: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].count),
          pages: Math.ceil(countResult.rows[0].count / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reports',
      error: error.message
    });
  }
});

// Get report details
router.get('/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const reportResult = await query(
      `SELECT 
        r.id, r.case_id, r.reporter_id, r.reported_type, r.reported_id,
        r.title, r.reason, r.description, r.status, r.admin_notes, r.resolved_by,
        r.created_at, r.resolved_at,
        COALESCE(r.images, '[]'::jsonb)::text as images,
        u.full_name as reporter_name,
        u.email as reporter_email,
        u.phone as reporter_phone,
        resolver.full_name as resolver_name
      FROM reports r
      JOIN users u ON r.reporter_id = u.id
      LEFT JOIN users resolver ON r.resolved_by = resolver.id
      WHERE r.id = $1`,
      [id]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    const report = reportResult.rows[0];
    let reportedContent = null;

    // Fetch the reported content based on type
    if (report.reported_type === 'job') {
      const jobResult = await query(
        `SELECT j.*, u.full_name as customer_name 
         FROM jobs j 
         JOIN users u ON j.customer_id = u.id 
         WHERE j.id = $1`,
        [report.reported_id]
      );
      reportedContent = jobResult.rows[0];
    } else if (report.reported_type === 'user') {
      const userResult = await query(
        `SELECT u.*, wp.average_rating, wp.total_jobs_completed
         FROM users u
         LEFT JOIN worker_profiles wp ON u.id = wp.user_id
         WHERE u.id = $1`,
        [report.reported_id]
      );
      reportedContent = userResult.rows[0];
    } else if (report.reported_type === 'review') {
      const reviewResult = await query(
        `SELECT r.*, 
          reviewer.full_name as reviewer_name,
          reviewee.full_name as reviewee_name
         FROM reviews r
         JOIN users reviewer ON r.reviewer_id = reviewer.id
         JOIN users reviewee ON r.reviewee_id = reviewee.id
         WHERE r.id = $1`,
        [report.reported_id]
      );
      reportedContent = reviewResult.rows[0];
    }

    res.json({
      success: true,
      data: {
        report: report,
        reportedContent: reportedContent
      }
    });

  } catch (error) {
    console.error('Get report details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch report details',
      error: error.message
    });
  }
});

// Update report status
router.patch('/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    const validStatuses = ['pending', 'reviewing', 'resolved', 'dismissed'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const result = await query(
      `UPDATE reports 
       SET status = $1, 
           admin_notes = COALESCE($2, admin_notes),
           resolved_by = CASE WHEN $1 IN ('resolved', 'dismissed') THEN $3 ELSE resolved_by END,
           resolved_at = CASE WHEN $1 IN ('resolved', 'dismissed') THEN NOW() ELSE resolved_at END
       WHERE id = $4
       RETURNING *`,
      [status, admin_notes, req.user.id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Log admin action
    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'update_report', 'report', id, JSON.stringify({ status, admin_notes })]
    );

    // Notify reporter
    const report = result.rows[0];
    await query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, $2, $3, $4)`,
      [
        report.reporter_id,
        'report_update',
        'Report Updated',
        `Your report has been ${status}. ${admin_notes || ''}`
      ]
    );

    res.json({
      success: true,
      message: 'Report updated successfully',
      data: { report: result.rows[0] }
    });

  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update report',
      error: error.message
    });
  }
});

// Get all disputes
router.get('/disputes', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    let params = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND d.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const result = await query(
      `SELECT 
        d.*,
        u.full_name as raised_by_name,
        u.email as raised_by_email,
        b.id as booking_id,
        j.title as job_title,
        customer.full_name as customer_name,
        worker_user.full_name as worker_name,
        resolver.full_name as resolver_name
      FROM disputes d
      JOIN users u ON d.raised_by = u.id
      JOIN bookings b ON d.booking_id = b.id
      JOIN jobs j ON b.job_id = j.id
      JOIN users customer ON b.customer_id = customer.id
      JOIN worker_profiles wp ON b.worker_id = wp.id
      JOIN users worker_user ON wp.user_id = worker_user.id
      LEFT JOIN users resolver ON d.resolved_by = resolver.id
      WHERE ${whereClause}
      ORDER BY 
        CASE WHEN d.status = 'open' THEN 0 ELSE 1 END,
        d.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM disputes d WHERE ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        disputes: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].count),
          pages: Math.ceil(countResult.rows[0].count / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get disputes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch disputes',
      error: error.message
    });
  }
});

// Get dispute details with messages
router.get('/disputes/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const disputeResult = await query(
      `SELECT 
        d.*,
        u.full_name as raised_by_name,
        b.id as booking_id,
        j.title as job_title,
        j.description as job_description,
        customer.id as customer_id,
        customer.full_name as customer_name,
        customer.email as customer_email,
        worker_user.id as worker_id,
        worker_user.full_name as worker_name,
        worker_user.email as worker_email
      FROM disputes d
      JOIN users u ON d.raised_by = u.id
      JOIN bookings b ON d.booking_id = b.id
      JOIN jobs j ON b.job_id = j.id
      JOIN users customer ON b.customer_id = customer.id
      JOIN worker_profiles wp ON b.worker_id = wp.id
      JOIN users worker_user ON wp.user_id = worker_user.id
      WHERE d.id = $1`,
      [id]
    );

    if (disputeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found'
      });
    }

    const dispute = disputeResult.rows[0];

    // Get chat messages for this booking
    const messagesResult = await query(
      `SELECT 
        m.*,
        u.full_name as sender_name,
        u.role as sender_role
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.booking_id = $1
      ORDER BY m.created_at ASC`,
      [dispute.booking_id]
    );

    res.json({
      success: true,
      data: {
        dispute: dispute,
        messages: messagesResult.rows
      }
    });

  } catch (error) {
    console.error('Get dispute details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dispute details',
      error: error.message
    });
  }
});

// Resolve dispute
router.patch('/disputes/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution } = req.body;

    const validStatuses = ['investigating', 'resolved', 'closed'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const result = await query(
      `UPDATE disputes 
       SET status = $1,
           resolution = COALESCE($2, resolution),
           resolved_by = CASE WHEN $1 IN ('resolved', 'closed') THEN $3 ELSE resolved_by END,
           resolved_at = CASE WHEN $1 IN ('resolved', 'closed') THEN NOW() ELSE resolved_at END
       WHERE id = $4
       RETURNING *`,
      [status, resolution, req.user.id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found'
      });
    }

    const dispute = result.rows[0];

    // Log admin action
    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'resolve_dispute', 'dispute', id, JSON.stringify({ status, resolution })]
    );

    // Get booking details to notify both parties
    const bookingResult = await query(
      `SELECT customer_id, wp.user_id as worker_user_id
       FROM bookings b
       JOIN worker_profiles wp ON b.worker_id = wp.id
       WHERE b.id = $1`,
      [dispute.booking_id]
    );

    if (bookingResult.rows.length > 0) {
      const booking = bookingResult.rows[0];
      
      // Notify both customer and worker
      const notificationMessage = `Dispute ${status}. ${resolution || ''}`;
      
      await query(
        `INSERT INTO notifications (user_id, type, title, message)
         VALUES ($1, $2, $3, $4), ($5, $2, $3, $4)`,
        [
          booking.customer_id,
          'dispute_update',
          'Dispute Updated',
          notificationMessage,
          booking.worker_user_id
        ]
      );
    }

    res.json({
      success: true,
      message: 'Dispute updated successfully',
      data: { dispute: result.rows[0] }
    });

  } catch (error) {
    console.error('Resolve dispute error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve dispute',
      error: error.message
    });
  }
});

// ============================================
// CATEGORY MANAGEMENT
// ============================================

// Get all categories
router.get('/categories', async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        c.*,
        (SELECT COUNT(*) FROM jobs WHERE category_id = c.id) as jobs_count,
        parent.name as parent_name
      FROM categories c
      LEFT JOIN categories parent ON c.parent_id = parent.id
      ORDER BY c.display_order ASC, c.name ASC`
    );

    res.json({
      success: true,
      data: { categories: result.rows }
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
});

// Create category
router.post('/categories', async (req, res) => {
  try {
    const { name, slug, icon, description, parent_id, display_order } = req.body;

    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        message: 'Name and slug are required'
      });
    }

    const result = await query(
      `INSERT INTO categories (name, slug, icon, description, parent_id, display_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, slug, icon, description, parent_id, display_order || 0]
    );

    // Log admin action
    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'create_category', 'category', result.rows[0].id, JSON.stringify({ name, slug })]
    );

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { category: result.rows[0] }
    });

  } catch (error) {
    console.error('Create category error:', error);
    
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({
        success: false,
        message: 'Category with this name or slug already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create category',
      error: error.message
    });
  }
});

// Update category
router.patch('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, icon, description, is_active, display_order } = req.body;

    const result = await query(
      `UPDATE categories
       SET name = COALESCE($1, name),
           slug = COALESCE($2, slug),
           icon = COALESCE($3, icon),
           description = COALESCE($4, description),
           is_active = COALESCE($5, is_active),
           display_order = COALESCE($6, display_order)
       WHERE id = $7
       RETURNING *`,
      [name, slug, icon, description, is_active, display_order, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Log admin action
    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'update_category', 'category', id, JSON.stringify(req.body)]
    );

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: { category: result.rows[0] }
    });

  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update category',
      error: error.message
    });
  }
});

// Delete category
router.delete('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category has jobs
    const jobsCheck = await query(
      'SELECT COUNT(*) FROM jobs WHERE category_id = $1',
      [id]
    );

    if (parseInt(jobsCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with existing jobs. Please reassign jobs first.'
      });
    }

    // Log before deletion
    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'delete_category', 'category', id, JSON.stringify({ deleted: true })]
    );

    const result = await query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });

  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete category',
      error: error.message
    });
  }
});


// ============================================
// LOCATION MANAGEMENT (Provinces & Cities)
// ============================================

// Get all provinces
router.get('/locations/provinces', async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, 
        (SELECT COUNT(*) FROM cities WHERE province_id = p.id) as cities_count
      FROM provinces p
      ORDER BY p.name ASC`
    );

    res.json({
      success: true,
      data: { provinces: result.rows }
    });

  } catch (error) {
    console.error('Get provinces error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch provinces',
      error: error.message
    });
  }
});

// Create province
router.post('/locations/provinces', async (req, res) => {
  try {
    const { id, name, capital } = req.body;

    if (!id || !name) {
      return res.status(400).json({
        success: false,
        message: 'Province ID and name are required'
      });
    }

    const result = await query(
      `INSERT INTO provinces (id, name, capital)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, name, capital]
    );

    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'create_province', 'province', result.rows[0].id, JSON.stringify({ name, capital })]
    );

    res.status(201).json({
      success: true,
      message: 'Province created successfully',
      data: { province: result.rows[0] }
    });

  } catch (error) {
    console.error('Create province error:', error);
    
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Province with this ID or name already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create province',
      error: error.message
    });
  }
});

// Update province
router.patch('/locations/provinces/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, capital, is_active } = req.body;

    const result = await query(
      `UPDATE provinces
       SET name = COALESCE($1, name),
           capital = COALESCE($2, capital),
           is_active = COALESCE($3, is_active)
       WHERE id = $4
       RETURNING *`,
      [name, capital, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Province not found'
      });
    }

    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'update_province', 'province', id, JSON.stringify(req.body)]
    );

    res.json({
      success: true,
      message: 'Province updated successfully',
      data: { province: result.rows[0] }
    });

  } catch (error) {
    console.error('Update province error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update province',
      error: error.message
    });
  }
});

// Delete province
router.delete('/locations/provinces/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const citiesCheck = await query(
      'SELECT COUNT(*) FROM cities WHERE province_id = $1',
      [id]
    );

    if (parseInt(citiesCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete province with existing cities. Please delete cities first.'
      });
    }

    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'delete_province', 'province', id, JSON.stringify({ deleted: true })]
    );

    const result = await query('DELETE FROM provinces WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Province not found'
      });
    }

    res.json({
      success: true,
      message: 'Province deleted successfully'
    });

  } catch (error) {
    console.error('Delete province error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete province',
      error: error.message
    });
  }
});

// Get all cities
router.get('/locations/cities', async (req, res) => {
  try {
    const { province_id, search } = req.query;

    let whereClause = '1=1';
    let params = [];
    let paramIndex = 1;

    if (province_id) {
      whereClause += ` AND c.province_id = $${paramIndex}`;
      params.push(province_id);
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND c.name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const result = await query(
      `SELECT c.*, p.name as province_name
       FROM cities c
       JOIN provinces p ON c.province_id = p.id
       WHERE ${whereClause}
       ORDER BY c.name ASC`,
      params
    );

    res.json({
      success: true,
      data: { cities: result.rows }
    });

  } catch (error) {
    console.error('Get cities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cities',
      error: error.message
    });
  }
});

// Create city
router.post('/locations/cities', async (req, res) => {
  try {
    const { name, province_id } = req.body;

    if (!name || !province_id) {
      return res.status(400).json({
        success: false,
        message: 'City name and province_id are required'
      });
    }

    const result = await query(
      `INSERT INTO cities (name, province_id)
       VALUES ($1, $2)
       RETURNING *`,
      [name, province_id]
    );

    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'create_city', 'city', result.rows[0].id, JSON.stringify({ name, province_id })]
    );

    res.status(201).json({
      success: true,
      message: 'City created successfully',
      data: { city: result.rows[0] }
    });

  } catch (error) {
    console.error('Create city error:', error);
    
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'City already exists in this province'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create city',
      error: error.message
    });
  }
});

// Update city
router.patch('/locations/cities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, province_id, is_active } = req.body;

    const result = await query(
      `UPDATE cities
       SET name = COALESCE($1, name),
           province_id = COALESCE($2, province_id),
           is_active = COALESCE($3, is_active)
       WHERE id = $4
       RETURNING *`,
      [name, province_id, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'City not found'
      });
    }

    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'update_city', 'city', id, JSON.stringify(req.body)]
    );

    res.json({
      success: true,
      message: 'City updated successfully',
      data: { city: result.rows[0] }
    });

  } catch (error) {
    console.error('Update city error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update city',
      error: error.message
    });
  }
});

// Delete city
router.delete('/locations/cities/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'delete_city', 'city', id, JSON.stringify({ deleted: true })]
    );

    const result = await query('DELETE FROM cities WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'City not found'
      });
    }

    res.json({
      success: true,
      message: 'City deleted successfully'
    });

  } catch (error) {
    console.error('Delete city error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete city',
      error: error.message
    });
  }
});

// ============================================
// ADMIN ACTIVITY LOGS
// ============================================

router.get('/logs', async (req, res) => {
  try {
    const { action, admin_id, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    let params = [];
    let paramIndex = 1;

    if (action) {
      whereClause += ` AND al.action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }

    if (admin_id) {
      whereClause += ` AND al.admin_id = $${paramIndex}`;
      params.push(admin_id);
      paramIndex++;
    }

    const result = await query(
      `SELECT 
        al.*,
        u.full_name as admin_name,
        u.email as admin_email
      FROM admin_logs al
      LEFT JOIN users u ON al.admin_id = u.id
      WHERE ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM admin_logs al WHERE ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        logs: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].count),
          pages: Math.ceil(countResult.rows[0].count / limit)
        }
      }
    });

} catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch logs',
      error: error.message
    });
  }
});

// ============================================
// REPORT MANAGEMENT
// ============================================

// Get all reports with filters
router.get('/reports', async (req, res) => {
  try {
    const { status, reported_type, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    let params = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND r.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (reported_type) {
      whereClause += ` AND r.reported_type = $${paramIndex}`;
      params.push(reported_type);
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (r.case_id ILIKE $${paramIndex} OR r.title ILIKE $${paramIndex} OR reporter.full_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const result = await query(
      `SELECT 
        r.id, r.case_id, r.reporter_id, r.reported_type, r.reported_id, 
        r.title, r.reason, r.description, r.status, r.admin_notes, r.resolved_by,
        r.created_at, r.resolved_at,
        COALESCE(r.images, '[]'::jsonb)::text as images,
        reporter.full_name as reporter_name,
        reporter.email as reporter_email,
        reporter.profile_picture as reporter_picture,
        reported_user.full_name as reported_user_name,
        reported_user.email as reported_user_email,
        resolved_by_user.full_name as resolved_by_name,
        (SELECT COUNT(*) FROM report_messages WHERE report_id = r.id) as total_messages,
        (SELECT COUNT(*) FROM report_messages WHERE report_id = r.id AND sender_type = 'customer' AND is_read = false) as unread_customer_messages
       FROM reports r
       JOIN users reporter ON r.reporter_id = reporter.id
       LEFT JOIN users reported_user ON r.reported_id = reported_user.id AND r.reported_type IN ('worker', 'user')
       LEFT JOIN users resolved_by_user ON r.resolved_by = resolved_by_user.id
       WHERE ${whereClause}
       ORDER BY 
         CASE 
           WHEN r.status = 'pending' THEN 1
           WHEN r.status = 'seen' THEN 2
           WHEN r.status = 'processing' THEN 3
           ELSE 4
         END,
         r.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM reports r WHERE ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        reports: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].count),
          pages: Math.ceil(countResult.rows[0].count / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reports',
      error: error.message
    });
  }
});

// Get single report details
router.get('/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        r.*,
        reporter.full_name as reporter_name,
        reporter.email as reporter_email,
        reporter.phone as reporter_phone,
        reporter.profile_picture as reporter_picture,
        reported_user.full_name as reported_user_name,
        reported_user.email as reported_user_email,
        reported_user.phone as reported_user_phone,
        reported_user.profile_picture as reported_user_picture,
        resolved_by_user.full_name as resolved_by_name
       FROM reports r
       JOIN users reporter ON r.reporter_id = reporter.id
       LEFT JOIN users reported_user ON r.reported_id = reported_user.id AND r.reported_type IN ('worker', 'user')
       LEFT JOIN users resolved_by_user ON r.resolved_by = resolved_by_user.id
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    res.json({
      success: true,
      data: { report: result.rows[0] }
    });

  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch report',
      error: error.message
    });
  }
});

// Update report status
router.patch('/reports/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

const validStatuses = ['pending', 'processing', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value. Must be: pending, processing, resolved, or dismissed'
      });
    }

    let updateQuery = 'UPDATE reports SET status = $1';
    let params = [status];
    let paramIndex = 2;

    if (admin_notes) {
      updateQuery += `, admin_notes = $${paramIndex}`;
      params.push(admin_notes);
      paramIndex++;
    }

    if (status === 'resolved' || status === 'dismissed') {
      updateQuery += `, resolved_by = $${paramIndex}, resolved_at = CURRENT_TIMESTAMP`;
      params.push(req.user.id);
      paramIndex++;
    }

    updateQuery += ` WHERE id = $${paramIndex} RETURNING *`;
    params.push(id);

    const result = await query(updateQuery, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    const report = result.rows[0];

    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'update_report_status', 'report', id, JSON.stringify({ status, admin_notes })]
    );

    await query(
      `INSERT INTO notifications (user_id, type, title, message, data, created_at)
       VALUES ($1, 'report_update', 'Report Status Updated', $2, $3, CURRENT_TIMESTAMP)`,
      [
        report.reporter_id,
        `Your report (${report.case_id}) status has been updated to: ${status}`,
        JSON.stringify({ report_id: id, case_id: report.case_id, status })
      ]
    );

    res.json({
      success: true,
      message: 'Report status updated successfully',
      data: { report: result.rows[0] }
    });

  } catch (error) {
    console.error('Update report status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update report status',
      error: error.message
    });
  }
});

// Send message to customer (Admin reply in report chat)
router.post('/reports/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const adminId = req.user.id;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    const reportResult = await query(
      'SELECT * FROM reports WHERE id = $1',
      [id]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    const report = reportResult.rows[0];

    const messageResult = await query(
      `INSERT INTO report_messages (report_id, sender_id, sender_type, message, created_at)
       VALUES ($1, $2, 'admin', $3, CURRENT_TIMESTAMP)
       RETURNING *`,
      [id, adminId, message.trim()]
    );

    if (report.status === 'pending' || report.status === 'seen') {
      await query(
        `UPDATE reports SET status = 'processing' WHERE id = $1`,
        [id]
      );
    }

    // Notify reporter (customer who filed report)
    await query(
      `INSERT INTO notifications (user_id, type, title, message, data, created_at)
       VALUES ($1, 'report_reply', 'Admin Response', $2, $3, CURRENT_TIMESTAMP)`,
      [
        report.reporter_id,
        `Admin replied to your report ${report.case_id}`,
        JSON.stringify({ report_id: id, case_id: report.case_id })
      ]
    );

    // Notify reported user (person being reported) if it's a user/worker report
    if ((report.reported_type === 'user' || report.reported_type === 'worker') && report.reported_id) {
      await query(
        `INSERT INTO notifications (user_id, type, title, message, data, created_at)
         VALUES ($1, 'report_about_you', 'Support Message', $2, $3, CURRENT_TIMESTAMP)`,
        [
          report.reported_id,
          `You have a message from support regarding case ${report.case_id}`,
          JSON.stringify({ report_id: id, case_id: report.case_id })
        ]
      );
    }

    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [adminId, 'send_report_message', 'report', id, JSON.stringify({ case_id: report.case_id })]
    );

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: { message: messageResult.rows[0] }
    });

  } catch (error) {
    console.error('Send report message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
});

// Get report messages
router.get('/reports/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;

    const reportResult = await query(
      'SELECT id FROM reports WHERE id = $1',
      [id]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    const messagesResult = await query(
      `SELECT 
        rm.*,
        u.full_name as sender_name,
        u.profile_picture as sender_picture
       FROM report_messages rm
       JOIN users u ON rm.sender_id = u.id
       WHERE rm.report_id = $1
       ORDER BY rm.created_at ASC`,
      [id]
    );

    await query(
      `UPDATE report_messages 
       SET is_read = TRUE
       WHERE report_id = $1 AND sender_type = 'customer' AND is_read = FALSE`,
      [id]
    );

    res.json({
      success: true,
      data: {
        messages: messagesResult.rows
      }
    });

  } catch (error) {
    console.error('Get report messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
});

// Delete report
router.delete('/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const reportResult = await query(
      'SELECT case_id FROM reports WHERE id = $1',
      [id]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    await query('DELETE FROM reports WHERE id = $1', [id]);

    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'delete_report', 'report', id, JSON.stringify({ case_id: reportResult.rows[0].case_id })]
    );

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });

  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete report',
      error: error.message
    });
  }
});


module.exports = router;