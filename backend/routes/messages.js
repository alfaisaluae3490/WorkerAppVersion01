// backend/routes/messages.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

// ============================================
// SEND MESSAGE
// ============================================
router.post('/send', verifyToken, async (req, res) => {
  try {
    const { bookingId, message } = req.body;
    const senderId = req.user.id;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
    }

    // Verify user is part of this booking
    const bookingResult = await query(
      `SELECT b.*, wp.user_id as worker_user_id
       FROM bookings b
       JOIN worker_profiles wp ON b.worker_id = wp.id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookingResult.rows[0];
    const isAuthorized = senderId === booking.customer_id || senderId === booking.worker_user_id;

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send messages in this booking'
      });
    }

    // ✅ NEW: Block messages if job is completed
    if (booking.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot send messages. Job has been completed.'
      });
    }

    // ✅ NEW: Block messages if both parties marked complete
    if (booking.customer_marked_complete && booking.worker_marked_complete) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send messages. Both parties have marked this job as complete.'
      });
    }

    // Insert message
    const messageResult = await query(
      `INSERT INTO messages (booking_id, sender_id, message, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       RETURNING *`,
      [bookingId, senderId, message.trim()]
    );

    // Create notification for receiver
    const receiverId = senderId === booking.customer_id ? booking.worker_user_id : booking.customer_id;
    
    await query(
      `INSERT INTO notifications (user_id, type, title, message, data, created_at)
       VALUES ($1, 'new_message', 'New Message', $2, $3, CURRENT_TIMESTAMP)`,
      [
        receiverId,
        'You have a new message',
        JSON.stringify({ bookingId, messageId: messageResult.rows[0].id })
      ]
    );

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: {
        message: messageResult.rows[0]
      }
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
});

// ============================================
// GET MESSAGES FOR A BOOKING
// ============================================
router.get('/:bookingId', verifyToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    // Verify user is part of this booking
    const bookingResult = await query(
      `SELECT b.*, wp.user_id as worker_user_id
       FROM bookings b
       JOIN worker_profiles wp ON b.worker_id = wp.id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookingResult.rows[0];
    const isAuthorized = userId === booking.customer_id || userId === booking.worker_user_id;

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view messages'
      });
    }

    // Get messages
    const messagesResult = await query(
      `SELECT 
        m.*,
        u.full_name as sender_name,
        u.profile_picture as sender_picture
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.booking_id = $1
       ORDER BY m.created_at ASC`,
      [bookingId]
    );

    // Mark messages as read for current user
    await query(
      `UPDATE messages 
       SET is_read = TRUE
       WHERE booking_id = $1 AND sender_id != $2 AND is_read = FALSE`,
      [bookingId, userId]
    );

    res.json({
      success: true,
      data: {
        messages: messagesResult.rows
      }
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
});

// ============================================
// GET ALL CONVERSATIONS FOR USER
// ============================================
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const conversationsResult = await query(
      `SELECT DISTINCT
        b.id as booking_id,
        b.status,
        j.title as job_title,
        CASE 
          WHEN b.customer_id = $1 THEN w_user.full_name
          ELSE c_user.full_name
        END as other_party_name,
        CASE 
          WHEN b.customer_id = $1 THEN w_user.profile_picture
          ELSE c_user.profile_picture
        END as other_party_picture,
        (SELECT message FROM messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
        (SELECT COUNT(*) FROM messages WHERE booking_id = b.id AND sender_id != $1 AND is_read = FALSE) as unread_count
       FROM bookings b
       JOIN jobs j ON b.job_id = j.id
       JOIN users c_user ON b.customer_id = c_user.id
       JOIN worker_profiles wp ON b.worker_id = wp.id
       JOIN users w_user ON wp.user_id = w_user.id
       WHERE b.customer_id = $1 OR wp.user_id = $1
       ORDER BY last_message_time DESC NULLS LAST`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        conversations: conversationsResult.rows
      }
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations',
      error: error.message
    });
  }
});

// ============================================
// MARK MESSAGES AS READ
// ============================================
router.put('/:bookingId/read', verifyToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    await query(
      `UPDATE messages 
       SET is_read = TRUE
       WHERE booking_id = $1 AND sender_id != $2 AND is_read = FALSE`,
      [bookingId, userId]
    );

    res.json({
      success: true,
      message: 'Messages marked as read'
    });

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read',
      error: error.message
    });
  }
});

module.exports = router;