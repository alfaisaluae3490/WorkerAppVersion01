// backend/routes/bookings.js
const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

// ============================================
// GET SINGLE BOOKING DETAILS
// ============================================
router.get('/:bookingId', verifyToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const result = await query(
    `SELECT 
        b.*,
        j.title as job_title,
        j.description as job_description,
        j.city as job_city,
        j.province as job_province,
        j.location_address as job_address,
        j.budget_min,
        j.budget_max,
        c.name as category_name,
        c_user.full_name as customer_name,
        c_user.email as customer_email,
        c_user.phone as customer_phone,
        c_user.profile_picture as customer_picture,
        w_user.id as worker_user_id,
        w_user.full_name as worker_name,
        w_user.email as worker_email,
        w_user.phone as worker_phone,
        w_user.profile_picture as worker_picture,
        wp.hourly_rate as worker_hourly_rate,
        wp.experience_years as worker_experience
      FROM bookings b
      JOIN jobs j ON b.job_id = j.id
      LEFT JOIN categories c ON j.category_id = c.id
      JOIN users c_user ON b.customer_id = c_user.id
      JOIN worker_profiles wp ON b.worker_id = wp.id
      JOIN users w_user ON wp.user_id = w_user.id
      WHERE b.id = $1`,
      [bookingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = result.rows[0];

    // Check authorization - user must be either customer or worker
    const workerUserId = await query(
      'SELECT user_id FROM worker_profiles WHERE id = $1',
      [booking.worker_id]
    );

    const isAuthorized = userId === booking.customer_id || 
                        (workerUserId.rows.length > 0 && userId === workerUserId.rows[0].user_id);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this booking'
      });
    }

    res.json({
      success: true,
      data: {
        booking: booking
      }
    });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking',
      error: error.message
    });
  }
});

// ============================================
// GET ALL USER BOOKINGS
// ============================================
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, role } = req.query; // role: 'customer' or 'worker'

    let queryText = `
      SELECT 
        b.*,
        j.title as job_title,
        j.city as job_city,
        j.province as job_province,
        c_user.full_name as customer_name,
        c_user.profile_picture as customer_picture,
        w_user.full_name as worker_name,
        w_user.profile_picture as worker_picture,
        (SELECT COUNT(*) FROM messages WHERE booking_id = b.id) as message_count,
        (SELECT COUNT(*) FROM messages WHERE booking_id = b.id AND sender_id != $1 AND is_read = FALSE) as unread_count
      FROM bookings b
      JOIN jobs j ON b.job_id = j.id
      JOIN users c_user ON b.customer_id = c_user.id
      JOIN worker_profiles wp ON b.worker_id = wp.id
      JOIN users w_user ON wp.user_id = w_user.id
      WHERE (b.customer_id = $1 OR wp.user_id = $1)
    `;

    const params = [userId];

    // Filter by status if provided
    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      const statusPlaceholders = statuses.map((_, idx) => `$${params.length + idx + 1}`).join(',');
      queryText += ` AND b.status IN (${statusPlaceholders})`;
      params.push(...statuses);
    }

    // Filter by role if provided
    if (role === 'customer') {
      queryText += ` AND b.customer_id = $1`;
    } else if (role === 'worker') {
      queryText += ` AND wp.user_id = $1`;
    }

    queryText += ` ORDER BY b.created_at DESC`;

    const result = await query(queryText, params);

    res.json({
      success: true,
      data: {
        bookings: result.rows
      }
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message
    });
  }
});

// ============================================
// UPDATE BOOKING STATUS
// ============================================
router.put('/:bookingId/status', verifyToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    // Validate status
    const validStatuses = ['confirmed', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    // Check authorization
    const booking = await query(
      `SELECT b.*, wp.user_id as worker_user_id
       FROM bookings b
       JOIN worker_profiles wp ON b.worker_id = wp.id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (booking.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const isAuthorized = userId === booking.rows[0].customer_id || 
                        userId === booking.rows[0].worker_user_id;

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this booking'
      });
    }

    // Update status
    const result = await query(
      `UPDATE bookings 
       SET status = $1, 
           updated_at = CURRENT_TIMESTAMP,
           completion_date = CASE WHEN $1 = 'completed' THEN CURRENT_TIMESTAMP ELSE completion_date END
       WHERE id = $2
       RETURNING *`,
      [status, bookingId]
    );

    // If completed, also update job status
    if (status === 'completed') {
      await query(
        `UPDATE jobs 
         SET status = 'completed', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [booking.rows[0].job_id]
      );
    }

    res.json({
      success: true,
      message: 'Booking status updated successfully',
      data: {
        booking: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking status',
      error: error.message
    });
  }
});

// ============================================
// CANCEL BOOKING
// ============================================
router.put('/:bookingId/cancel', verifyToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    // Check authorization
    const booking = await query(
      `SELECT b.*, wp.user_id as worker_user_id
       FROM bookings b
       JOIN worker_profiles wp ON b.worker_id = wp.id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (booking.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const isAuthorized = userId === booking.rows[0].customer_id || 
                        userId === booking.rows[0].worker_user_id;

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this booking'
      });
    }

    // Update booking status to cancelled
    await query(
      `UPDATE bookings 
       SET status = 'cancelled', 
           cancellation_reason = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [reason || null, bookingId]
    );

    // Update job status back to open
    await query(
      `UPDATE jobs 
       SET status = 'open', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [booking.rows[0].job_id]
    );

    // Update bid status back to pending
    if (booking.rows[0].bid_id) {
      await query(
        `UPDATE bids 
         SET status = 'pending', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [booking.rows[0].bid_id]
      );
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking',
      error: error.message
    });
  }
});

module.exports = router;