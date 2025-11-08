// backend/routes/bids.js
const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

// ============================================
// GET MY BIDS (Worker Dashboard)
// ============================================
router.get('/my-bids', verifyToken, async (req, res) => {
  try {
    // First get worker_profile id from user id
    const workerProfile = await query(
      'SELECT id FROM worker_profiles WHERE user_id = $1',
      [req.user.id]
    );

    if (workerProfile.rows.length === 0) {
      return res.json({
        success: true,
        data: { bids: [] }
      });
    }

    const workerProfileId = workerProfile.rows[0].id;

    const result = await query(
      `SELECT 
        b.*,
        j.title as job_title,
        j.description as job_description,
        j.budget_min,
        j.budget_max,
        j.city,
        j.province,
        j.status as job_status,
        j.images as job_images,
        u.full_name as customer_name,
        u.email as customer_email,
        u.phone as customer_phone,
        c.name as category_name,
        bk.id as booking_id
      FROM bids b
      JOIN jobs j ON b.job_id = j.id
      JOIN users u ON j.customer_id = u.id
      LEFT JOIN categories c ON j.category_id = c.id
      LEFT JOIN bookings bk ON b.id = bk.bid_id
      WHERE b.worker_id = $1
      ORDER BY b.created_at DESC`,
      [workerProfileId]
    );

    res.json({
      success: true,
      data: {
        bids: result.rows
      }
    });
  } catch (error) {
    console.error('Get my bids error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your bids'
    });
  }
});

// ============================================
// GET BIDS FOR A JOB (Customer View)
// ============================================
router.get('/job/:jobId', verifyToken, async (req, res) => {
  try {
    const { jobId } = req.params;
    const customerId = req.user.id;

    // Verify job belongs to customer
    const jobCheck = await query(
      'SELECT customer_id FROM jobs WHERE id = $1',
      [jobId]
    );

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (jobCheck.rows[0].customer_id !== customerId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these bids'
      });
    }

// Get all bids with worker details including profile stats
    const result = await query(
  `SELECT 
    b.*,
    u.full_name as worker_name,
    u.email as worker_email,
    u.phone as worker_phone,
    u.profile_picture as worker_picture,
    wp.city as worker_city,
    wp.province as worker_province,
    wp.average_rating as worker_rating,
    wp.total_reviews as worker_reviews,
    wp.total_jobs_completed as worker_jobs_completed,
    wp.id as worker_profile_id,
    bk.id as booking_id
  FROM bids b
  JOIN worker_profiles wp ON b.worker_id = wp.id
  JOIN users u ON wp.user_id = u.id
  LEFT JOIN bookings bk ON b.id = bk.bid_id
  WHERE b.job_id = $1
  ORDER BY b.created_at DESC`,
  [jobId]
);

    res.json({
      success: true,
      data: {
        bids: result.rows
      }
    });
  } catch (error) {
    console.error('Get job bids error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bids'
    });
  }
});

// ============================================
// PLACE A BID
// ============================================
router.post('/', verifyToken, async (req, res) => {
  try {
    const workerId = req.user.id;
    const { job_id, bid_amount, proposal, estimated_duration } = req.body;

    // Validation
    if (!job_id || !bid_amount || !proposal) {
      return res.status(400).json({
        success: false,
        message: 'Job ID, bid amount, and proposal are required'
      });
    }

    if (parseFloat(bid_amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Bid amount must be greater than 0'
      });
    }

    if (proposal.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Proposal must be at least 10 characters'
      });
    }

    // Check if worker has a profile
    const profileCheck = await query(
      'SELECT id, city FROM worker_profiles WHERE user_id = $1',
      [workerId]
    );

    if (profileCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please complete your worker profile before placing bids'
      });
    }

    const workerProfileId = profileCheck.rows[0].id;
    const workerCity = profileCheck.rows[0].city;

    // Check if job exists and is open
    const jobCheck = await query(
      'SELECT id, customer_id, status, title, city FROM jobs WHERE id = $1',
      [job_id]
    );

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    const job = jobCheck.rows[0];

    // CITY MATCHING VALIDATION: Worker and job must be in same city
    if (workerCity && job.city && workerCity.toLowerCase() !== job.city.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: `You can only bid on jobs in your city (${workerCity}). This job is in ${job.city}.`
      });
    }

    if (job.customer_id === workerId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot bid on your own job'
      });
    }

    if (job.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: 'This job is no longer accepting bids'
      });
    }

    // Check if worker already bid on this job
    const existingBid = await query(
      'SELECT id FROM bids WHERE job_id = $1 AND worker_id = $2',
      [job_id, workerProfileId]
    );

    if (existingBid.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have already placed a bid on this job'
      });
    }

    // Insert bid using transaction
    const result = await transaction(async (client) => {
      // Insert bid
      const bidResult = await client.query(
        `INSERT INTO bids 
         (job_id, worker_id, amount, message, estimated_duration, status) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [job_id, workerProfileId, bid_amount, proposal, estimated_duration || null, 'pending']
      );

      // Create notification for customer
      await client.query(
        `INSERT INTO notifications 
         (user_id, type, title, message, data) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          job.customer_id,
          'new_bid',
          'New Bid Received',
          `You received a new bid of Rs${bid_amount} on "${job.title}"`,
          JSON.stringify({
            bid_id: bidResult.rows[0].id,
            job_id: job_id,
            job_title: job.title,
            bid_amount: bid_amount
          })
        ]
      );

      return bidResult.rows[0];
    });

    res.status(201).json({
      success: true,
      message: 'Bid placed successfully',
      data: {
        bid: result
      }
    });
  } catch (error) {
    console.error('Place bid error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to place bid',
      error: error.message
    });
  }
});

// ============================================
// ACCEPT A BID (Customer)
// ============================================
router.post('/:bidId/accept', verifyToken, async (req, res) => {
  try {
    const { bidId } = req.params;
    const customerId = req.user.id;

    // Get bid details with job info
    const bidCheck = await query(
      `SELECT b.*, j.customer_id, j.status as job_status, j.title as job_title,
              j.city as job_city, j.province as job_province, 
              j.budget_min, j.budget_max
       FROM bids b
       JOIN jobs j ON b.job_id = j.id
       WHERE b.id = $1`,
      [bidId]
    );

    if (bidCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bid not found'
      });
    }

    const bid = bidCheck.rows[0];

    // Verify customer owns the job
    if (bid.customer_id !== customerId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to accept this bid'
      });
    }

    // Check if job is still open
    if (bid.job_status !== 'open') {
      return res.status(400).json({
        success: false,
        message: 'This job is no longer accepting bids'
      });
    }

    // Check if bid is pending
    if (bid.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This bid has already been processed'
      });
    }

    // Use transaction to accept bid and update job
    const bookingId = await transaction(async (client) => {
      // Accept this bid
      await client.query(
        `UPDATE bids SET status = 'accepted', updated_at = NOW() WHERE id = $1`,
        [bidId]
      );

      // Reject all other bids for this job
      await client.query(
        `UPDATE bids 
         SET status = 'rejected', updated_at = NOW() 
         WHERE job_id = $1 AND id != $2 AND status = 'pending'`,
        [bid.job_id, bidId]
      );

      // Update job status to assigned
      await client.query(
        `UPDATE jobs SET status = 'assigned', updated_at = NOW() WHERE id = $1`,
        [bid.job_id]
      );

      // *** CREATE BOOKING FOR CHAT SYSTEM ***
      const bookingResult = await client.query(
        `INSERT INTO bookings 
         (job_id, customer_id, worker_id, bid_id, agreed_amount, status, scheduled_date, scheduled_time)
         VALUES ($1, $2, $3, $4, $5, 'confirmed', CURRENT_DATE, CURRENT_TIME)
         RETURNING id`,
        [bid.job_id, customerId, bid.worker_id, bidId, bid.amount]
      );

      const newBookingId = bookingResult.rows[0].id;
      console.log(`✅ Booking created: ${newBookingId} for job ${bid.job_id}`);

      // Get worker user_id from worker_profiles
      const workerUserResult = await client.query(
        `SELECT user_id FROM worker_profiles WHERE id = $1`,
        [bid.worker_id]
      );

      if (workerUserResult.rows.length > 0) {
        // Create notification for accepted worker
        await client.query(
          `INSERT INTO notifications 
           (user_id, type, title, message, data) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            workerUserResult.rows[0].user_id,
            'bid_accepted',
            '🎉 Your Bid Was Accepted!',
            `Congratulations! Your bid of Rs${bid.amount} for "${bid.job_title}" was accepted. Click to chat with the customer.`,
            JSON.stringify({
              bid_id: bidId,
              job_id: bid.job_id,
              booking_id: newBookingId,
              job_title: bid.job_title,
              bid_amount: bid.amount,
              job_location: `${bid.job_city}, ${bid.job_province}`,
              budget_range: `Rs${bid.budget_min}-${bid.budget_max}`
            }),
          ]
        );
      }

      // Get all rejected bids to notify workers
      const rejectedBidsResult = await client.query(
        `SELECT b.worker_id, b.amount, wp.user_id
         FROM bids b
         JOIN worker_profiles wp ON b.worker_id = wp.id
         WHERE b.job_id = $1 AND b.id != $2 AND b.status = 'rejected'`,
        [bid.job_id, bidId]
      );

      // Create notifications for rejected workers
      for (const rejectedBid of rejectedBidsResult.rows) {
        await client.query(
          `INSERT INTO notifications 
           (user_id, type, title, message, data) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            rejectedBid.user_id,
            'bid_rejected',
            'Bid Not Selected',
            `Your bid of Rs${rejectedBid.amount} for "${bid.job_title}" was not selected.`,
            JSON.stringify({
              job_id: bid.job_id,
              job_title: bid.job_title,
              bid_amount: rejectedBid.amount
            })
          ]
        );
      }

      return newBookingId;
    });

    res.json({
      success: true,
      message: 'Bid accepted successfully',
      data: {
        booking_id: bookingId
      }
    });
  } catch (error) {
    console.error('Accept bid error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept bid',
      error: error.message
    });
  }
});

// ============================================
// REJECT A BID (Customer)
// ============================================
router.post('/:bidId/reject', verifyToken, async (req, res) => {
  try {
    const { bidId } = req.params;
    const customerId = req.user.id;

    // Get bid details
    const bidCheck = await query(
      `SELECT b.*, j.customer_id, j.title as job_title
       FROM bids b
       JOIN jobs j ON b.job_id = j.id
       WHERE b.id = $1`,
      [bidId]
    );

    if (bidCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bid not found'
      });
    }

    const bid = bidCheck.rows[0];

    // Verify customer owns the job
    if (bid.customer_id !== customerId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reject this bid'
      });
    }

    // Check if bid is pending
    if (bid.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This bid has already been processed'
      });
    }

    // Use transaction to reject bid and create notification
    await transaction(async (client) => {
      // Reject this bid
      await client.query(
        `UPDATE bids SET status = 'rejected', updated_at = NOW() WHERE id = $1`,
        [bidId]
      );

      // Get worker user_id
      const workerUserResult = await client.query(
        `SELECT user_id FROM worker_profiles WHERE id = $1`,
        [bid.worker_id]
      );

      if (workerUserResult.rows.length > 0) {
        // Create notification for worker
        await client.query(
          `INSERT INTO notifications 
           (user_id, type, title, message, data) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            workerUserResult.rows[0].user_id,
            'bid_rejected',
            'Bid Not Selected',
            `Your bid of Rs${bid.amount} for "${bid.job_title}" was not selected.`,
            JSON.stringify({
              job_id: bid.job_id,
              job_title: bid.job_title,
              bid_amount: bid.amount
            })
          ]
        );
      }
    });

    res.json({
      success: true,
      message: 'Bid rejected successfully'
    });
  } catch (error) {
    console.error('Reject bid error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject bid',
      error: error.message
    });
  }
});

// ============================================
// WITHDRAW A BID (Worker)
// ============================================
router.delete('/:bidId', verifyToken, async (req, res) => {
  try {
    const { bidId } = req.params;
    const userId = req.user.id;

    // Get worker profile id
    const workerProfile = await query(
      'SELECT id FROM worker_profiles WHERE user_id = $1',
      [userId]
    );

    if (workerProfile.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Worker profile not found'
      });
    }

    const workerProfileId = workerProfile.rows[0].id;

    // Get bid details
    const bidCheck = await query(
      'SELECT * FROM bids WHERE id = $1 AND worker_id = $2',
      [bidId, workerProfileId]
    );

    if (bidCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bid not found'
      });
    }

    const bid = bidCheck.rows[0];

    // Check if bid is still pending
    if (bid.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot withdraw a bid that has already been processed'
      });
    }

    // Withdraw bid
    await query(
      `UPDATE bids SET status = 'withdrawn', updated_at = NOW() WHERE id = $1`,
      [bidId]
    );

    res.json({
      success: true,
      message: 'Bid withdrawn successfully'
    });
  } catch (error) {
    console.error('Withdraw bid error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to withdraw bid',
      error: error.message
    });
  }
});

module.exports = router;