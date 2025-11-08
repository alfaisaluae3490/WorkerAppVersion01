// backend/routes/reports.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const multer = require('multer');
const { uploadMultipleImages } = require('../config/cloudinary');

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB per file
});

// ============================================
// CUSTOMER: CREATE REPORT (Report Worker)
// ============================================
router.post('/create', verifyToken, upload.array('images', 5), async (req, res) => {
  try {
    const { reported_id, reported_type, title, reason, description } = req.body;
    const reporter_id = req.user.id;

    // Validation
    if (!reported_id || !reported_type || !title || !reason || !description) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: reported_id, reported_type, title, reason, description'
      });
    }

    if (!['worker', 'job', 'user', 'message', 'review'].includes(reported_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report type'
      });
    }

    // Check if reporter is trying to report themselves
    if (reported_type === 'worker' || reported_type === 'user') {
      const reportedUserCheck = await query(
        'SELECT id FROM users WHERE id = $1',
        [reported_id]
      );

      if (reportedUserCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Reported user not found'
        });
      }

      if (reported_id === reporter_id) {
        return res.status(400).json({
          success: false,
          message: 'You cannot report yourself'
        });
      }
    }

  // Upload images if any
    console.log('📸 Report image upload check:', {
      hasFiles: !!req.files,
      fileCount: req.files?.length || 0,
      files: req.files?.map(f => ({ name: f.originalname, size: f.size, mimetype: f.mimetype }))
    });
    
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      try {
        imageUrls = await uploadMultipleImages(req.files);
        console.log('✅ Images uploaded successfully:', imageUrls);
      } catch (uploadError) {
        console.error('❌ Image upload error:', uploadError);
        // Continue without images if upload fails
      }
    } else {
      console.log('⚠️ No images received in request');
    }

    // Create report
    const result = await query(
      `INSERT INTO reports 
        (reporter_id, reported_type, reported_id, title, reason, description, images, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', CURRENT_TIMESTAMP)
       RETURNING *`,
      [reporter_id, reported_type, reported_id, title, reason, description, JSON.stringify(imageUrls)]
    );

    const report = result.rows[0];

    // Create notification for admins
    const adminsResult = await query(
      "SELECT id FROM users WHERE role = 'admin' AND is_active = true"
    );

    for (const admin of adminsResult.rows) {
      await query(
        `INSERT INTO notifications (user_id, type, title, message, data, created_at)
         VALUES ($1, 'new_report', 'New Report Received', $2, $3, CURRENT_TIMESTAMP)`,
        [
          admin.id,
          `A new ${reported_type} report has been submitted. Case ID: ${report.case_id}`,
          JSON.stringify({ report_id: report.id, case_id: report.case_id, reported_type })
        ]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      data: {
        report: {
          id: report.id,
          case_id: report.case_id,
          status: report.status,
          created_at: report.created_at
        }
      }
    });

  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create report',
      error: error.message
    });
  }
});

// ============================================
// CUSTOMER: GET MY REPORTS
// ============================================
router.get('/my-reports', verifyToken, async (req, res) => {
  try {
    const reporter_id = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'reporter_id = $1';
    let params = [reporter_id];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const result = await query(
      `SELECT 
        r.*,
        u.full_name as reported_user_name,
        u.profile_picture as reported_user_picture,
        (SELECT COUNT(*) FROM report_messages WHERE report_id = r.id) as message_count,
        (SELECT COUNT(*) FROM report_messages WHERE report_id = r.id AND sender_type = 'admin' AND is_read = false) as unread_admin_messages
       FROM reports r
       LEFT JOIN users u ON r.reported_id = u.id AND r.reported_type IN ('worker', 'user')
       WHERE ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM reports WHERE ${whereClause}`,
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
    console.error('Get my reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reports',
      error: error.message
    });
  }
});

// ============================================
// CUSTOMER: GET SINGLE REPORT DETAILS
// ============================================
router.get('/:reportId', verifyToken, async (req, res) => {
  try {
    const { reportId } = req.params;
    const userId = req.user.id;

    const result = await query(
      `SELECT 
        r.*,
        u.full_name as reported_user_name,
        u.profile_picture as reported_user_picture,
        u.email as reported_user_email,
        u.phone as reported_user_phone,
        admin_user.full_name as resolved_by_name
       FROM reports r
       LEFT JOIN users u ON r.reported_id = u.id AND r.reported_type IN ('worker', 'user')
       LEFT JOIN users admin_user ON r.resolved_by = admin_user.id
       WHERE r.id = $1`,
      [reportId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    const report = result.rows[0];

    // Check authorization (only reporter or admin can view)
    if (report.reporter_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this report'
      });
    }

    res.json({
      success: true,
      data: { report }
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

// ============================================
// CUSTOMER: SEND MESSAGE IN REPORT CHAT
// ============================================
router.post('/:reportId/messages', verifyToken, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { message, attachments } = req.body;
    const userId = req.user.id;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // Verify report exists and user is the reporter
    const reportResult = await query(
      'SELECT * FROM reports WHERE id = $1',
      [reportId]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    const report = reportResult.rows[0];

    if (report.reporter_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send messages in this report'
      });
    }

    // Insert message
const messageResult = await query(
  `INSERT INTO report_messages (report_id, sender_id, sender_type, message, attachments, created_at)
   VALUES ($1, $2, 'customer', $3, $4, CURRENT_TIMESTAMP)
   RETURNING *`,
  [reportId, userId, message?.trim() || '📎 Image attachment', JSON.stringify(attachments || [])]
);

    // Update report status to 'seen' if it was 'pending'
    if (report.status === 'pending') {
      await query(
        `UPDATE reports SET status = 'seen' WHERE id = $1`,
        [reportId]
      );
    }

    // Notify admins
    const adminsResult = await query(
      "SELECT id FROM users WHERE role = 'admin' AND is_active = true"
    );

    for (const admin of adminsResult.rows) {
      await query(
        `INSERT INTO notifications (user_id, type, title, message, data, created_at)
         VALUES ($1, 'report_message', 'New Report Message', $2, $3, CURRENT_TIMESTAMP)`,
        [
          admin.id,
          `New message in report case ${report.case_id}`,
          JSON.stringify({ report_id: reportId, case_id: report.case_id })
        ]
      );
    }

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

// ============================================
// CUSTOMER: GET REPORT MESSAGES (CHAT HISTORY)
// ============================================
router.get('/:reportId/messages', verifyToken, async (req, res) => {
  try {
    const { reportId } = req.params;
    const userId = req.user.id;

    // Verify authorization
    const reportResult = await query(
      'SELECT reporter_id FROM reports WHERE id = $1',
      [reportId]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    const isAuthorized = reportResult.rows[0].reporter_id === userId || req.user.role === 'admin';

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these messages'
      });
    }

    // Get messages
    const messagesResult = await query(
      `SELECT 
        rm.*,
        u.full_name as sender_name,
        u.profile_picture as sender_picture
       FROM report_messages rm
       JOIN users u ON rm.sender_id = u.id
       WHERE rm.report_id = $1
       ORDER BY rm.created_at ASC`,
      [reportId]
    );

    // Mark admin messages as read for customer
    if (req.user.role !== 'admin') {
      await query(
        `UPDATE report_messages 
         SET is_read = TRUE
         WHERE report_id = $1 AND sender_type = 'admin' AND is_read = FALSE`,
        [reportId]
      );
    }

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

module.exports = router;