// backend/routes/notifications.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

// ============================================
// GET /api/notifications - Get all notifications for current user
// ============================================
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, unread_only = false } = req.query;

 let sql = `
      SELECT 
        n.*
      FROM notifications n
      WHERE n.user_id = $1
    `;

    const params = [userId];

    if (unread_only === 'true') {
      sql += ` AND n.is_read = FALSE`;
    }

    sql += ` ORDER BY n.created_at DESC LIMIT $2 OFFSET $3`;
    params.push(limit, offset);

    const result = await query(sql, params);

    res.json({
      success: true,
      data: {
        notifications: result.rows,
        count: result.rows.length
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
});

// ============================================
// GET /api/notifications/unread-count - Get unread count
// ============================================
router.get('/unread-count', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        count: parseInt(result.rows[0].count)
      }
    });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unread count',
      error: error.message
    });
  }
});

// ============================================
// PUT /api/notifications/:id/read - Mark notification as read
// ============================================
router.put('/:id/read', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const result = await query(
     `UPDATE notifications 
       SET is_read = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: { notification: result.rows[0] }
    });

  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
});

// ============================================
// PUT /api/notifications/:id/unread - Mark notification as unread
// ============================================
router.put('/:id/unread', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const result = await query(
     `UPDATE notifications 
       SET is_read = FALSE
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as unread',
      data: { notification: result.rows[0] }
    });

  } catch (error) {
    console.error('Mark notification as unread error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as unread',
      error: error.message
    });
  }
});

// ============================================
// PUT /api/notifications/mark-all-read - Mark all as read
// ============================================
router.put('/mark-all-read', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
     `UPDATE notifications 
       SET is_read = TRUE
       WHERE user_id = $1 AND is_read = FALSE
       RETURNING id`,
      [userId]
    );

    res.json({
      success: true,
      message: 'All notifications marked as read',
      data: { count: result.rows.length }
    });

  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all as read',
      error: error.message
    });
  }
});

// ============================================
// DELETE /api/notifications/:id - Delete notification
// ============================================
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const result = await query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id`,
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    });
  }
});

// ============================================
// DELETE /api/notifications - Delete all read notifications
// ============================================
router.delete('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `DELETE FROM notifications WHERE user_id = $1 AND is_read = TRUE RETURNING id`,
      [userId]
    );

    res.json({
      success: true,
      message: 'All read notifications deleted',
      data: { count: result.rows.length }
    });

  } catch (error) {
    console.error('Delete all read notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notifications',
      error: error.message
    });
  }
});

// ============================================
// POST /api/notifications - Create notification (internal use)
// ============================================
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      user_id,
      type,
      title,
      message,
      related_job_id,
      related_bid_id,
      related_user_id
    } = req.body;

   const result = await query(
      `INSERT INTO notifications 
       (user_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [user_id, type, title, message, JSON.stringify({ related_job_id, related_bid_id, related_user_id })]
    );

    res.json({
      success: true,
      message: 'Notification created',
      data: { notification: result.rows[0] }
    });

  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notification',
      error: error.message
    });
  }
});

module.exports = router;