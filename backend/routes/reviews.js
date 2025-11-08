// backend/routes/reviews.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { cloudinary } = require('../config/cloudinary');
const multer = require('multer');

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// ============================================
// MARK JOB AS COMPLETE (with invoice upload)
// ============================================
router.post('/complete-job', verifyToken, upload.single('invoice'), async (req, res) => {
  try {
    const { bookingId, totalAmount, notes } = req.body;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Invoice image is required'
      });
    }

    if (!totalAmount || !bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID and total amount are required'
      });
    }

    // Get booking details and verify authorization
    const bookingResult = await query(
      `SELECT b.*, wp.user_id as worker_user_id, j.id as job_id
       FROM bookings b
       JOIN worker_profiles wp ON b.worker_id = wp.id
       JOIN jobs j ON b.job_id = j.id
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
    const isCustomer = userId === booking.customer_id;
    const isWorker = userId === booking.worker_user_id;

    if (!isCustomer && !isWorker) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to complete this booking'
      });
    }

    // Upload invoice to Cloudinary
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'invoices', resource_type: 'image' },
      async (error, result) => {
        if (error) {
          return res.status(500).json({
            success: false,
            message: 'Failed to upload invoice',
            error: error.message
          });
        }

        const invoiceUrl = result.secure_url;
        const userType = isCustomer ? 'customer' : 'worker';

        // Update booking with completion info
        const updateQuery = isCustomer 
          ? `UPDATE bookings 
             SET customer_marked_complete = TRUE,
                 customer_invoice_url = $1,
                 customer_completion_amount = $2,
                 customer_completion_date = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`
          : `UPDATE bookings 
             SET worker_marked_complete = TRUE,
                 worker_invoice_url = $1,
                 worker_completion_amount = $2,
                 worker_completion_date = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`;

        const updatedBooking = await query(updateQuery, [invoiceUrl, totalAmount, bookingId]);

        // Create completion request record
        await query(
          `INSERT INTO completion_requests 
           (booking_id, requester_id, requester_type, invoice_image_url, total_amount, notes, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
          [bookingId, userId, userType, invoiceUrl, totalAmount, notes || null]
        );

        // Create notification for other party
        const otherPartyId = isCustomer ? booking.worker_user_id : booking.customer_id;
        const notificationMessage = isCustomer 
          ? 'Customer has marked the job as complete. Please review and confirm.'
          : 'Worker has marked the job as complete. Please review and confirm.';

        await query(
          `INSERT INTO notifications (user_id, type, title, message, data)
           VALUES ($1, 'completion_request', 'Job Completion Request', $2, $3)`,
          [
            otherPartyId,
            notificationMessage,
            JSON.stringify({ bookingId, invoiceUrl, amount: totalAmount })
          ]
        );

        // Check if both parties completed
        const final = updatedBooking.rows[0];
        const bothCompleted = final.customer_marked_complete && final.worker_marked_complete;

        res.json({
          success: true,
          message: bothCompleted 
            ? 'Job completed by both parties! You can now submit reviews.'
            : 'Completion request submitted. Waiting for other party confirmation.',
          data: {
            booking: final,
            bothCompleted,
            canSubmitReview: bothCompleted
          }
        });
      }
    );

    uploadStream.end(req.file.buffer);

  } catch (error) {
    console.error('Complete job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark job as complete',
      error: error.message
    });
  }
});

// ============================================
// SUBMIT REVIEW (after both parties complete)
// ============================================
router.post('/submit', verifyToken, async (req, res) => {
  try {
    const { bookingId, revieweeId, rating, comment, categories } = req.body;
    const reviewerId = req.user.id;

    console.log('📝 Review submission request:', {
      bookingId,
      revieweeId,
      reviewerId,
      rating
    });

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Check if booking is completed by both parties
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

    console.log('📋 Booking details:', {
      customer_id: booking.customer_id,
      worker_id: booking.worker_id,
      worker_user_id: booking.worker_user_id,
      customer_complete: booking.customer_marked_complete,
      worker_complete: booking.worker_marked_complete
    });

    // Verify both parties marked complete
    if (!booking.customer_marked_complete || !booking.worker_marked_complete) {
      return res.status(400).json({
        success: false,
        message: 'Both parties must mark job as complete before submitting reviews'
      });
    }

    // Verify reviewer is part of this booking
    const isCustomer = reviewerId === booking.customer_id;
    const isWorker = reviewerId === booking.worker_user_id;

    if (!isCustomer && !isWorker) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to review this booking'
      });
    }

    // Determine the correct reviewee user_id
    // If revieweeId matches worker_id (profile ID), convert to user_id
    let actualRevieweeId = revieweeId;
    
    if (isCustomer) {
      // Customer is reviewing worker - use worker's user_id
      actualRevieweeId = booking.worker_user_id;
      console.log('👤 Customer reviewing worker, using worker_user_id:', actualRevieweeId);
    } else {
      // Worker is reviewing customer - use customer_id
      actualRevieweeId = booking.customer_id;
      console.log('👤 Worker reviewing customer, using customer_id:', actualRevieweeId);
    }

    // Verify the reviewee is the other party
    const correctReviewee = isCustomer ? booking.worker_user_id : booking.customer_id;
    if (actualRevieweeId !== correctReviewee) {
      console.warn('⚠️ Reviewee ID mismatch, using correct ID:', correctReviewee);
      actualRevieweeId = correctReviewee;
    }

    console.log('🎯 Final reviewee ID:', actualRevieweeId);

    // Check if review already exists
    const existingReview = await query(
      `SELECT id FROM reviews WHERE booking_id = $1 AND reviewer_id = $2`,
      [bookingId, reviewerId]
    );

    if (existingReview.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted a review for this booking'
      });
    }

    // Get invoice URL and amount
    const invoiceUrl = isCustomer ? booking.customer_invoice_url : booking.worker_invoice_url;
    const invoiceAmount = isCustomer ? booking.customer_completion_amount : booking.worker_completion_amount;
    const reviewerType = isCustomer ? 'customer' : 'worker';

    // Insert review
    const reviewResult = await query(
      `INSERT INTO reviews 
       (booking_id, reviewer_id, reviewee_id, rating, comment, categories, invoice_image_url, invoice_amount, reviewer_type, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
       RETURNING *`,
      [
        bookingId,
        reviewerId,
        actualRevieweeId,
        rating,
        comment || null,
        JSON.stringify(categories || {}),
        invoiceUrl,
        invoiceAmount,
        reviewerType
      ]
    );

    console.log('✅ Review created successfully:', reviewResult.rows[0].id);

    // Create notification for reviewee
    await query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, 'new_review', 'New Review Received', $2, $3)`,
      [
        actualRevieweeId,
        `You received a ${rating}-star review for your completed job.`,
        JSON.stringify({ bookingId, reviewId: reviewResult.rows[0].id, rating })
      ]
    );

    res.json({
      success: true,
      message: 'Review submitted successfully',
      data: {
        review: reviewResult.rows[0]
      }
    });

  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit review',
      error: error.message
    });
  }
});

// ============================================
// GET REVIEWS FOR A USER (Worker or Customer)
// ============================================
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const reviewsResult = await query(
      `SELECT 
        r.*,
        reviewer.full_name as reviewer_name,
        reviewer.profile_picture as reviewer_picture,
        reviewee.full_name as reviewee_name,
        b.id as booking_id,
        j.title as job_title,
        j.category_id
       FROM reviews r
       JOIN users reviewer ON r.reviewer_id = reviewer.id
       JOIN users reviewee ON r.reviewee_id = reviewee.id
       JOIN bookings b ON r.booking_id = b.id
       JOIN jobs j ON b.job_id = j.id
       WHERE r.reviewee_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    // Get average rating and total count
    const statsResult = await query(
      `SELECT 
        COUNT(*) as total_reviews,
        ROUND(AVG(rating)::numeric, 2) as average_rating,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
        COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
        COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
        COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
        COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star
       FROM reviews
       WHERE reviewee_id = $1`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        reviews: reviewsResult.rows,
        stats: statsResult.rows[0]
      }
    });

  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews',
      error: error.message
    });
  }
});

// ============================================
// GET COMPLETION STATUS FOR BOOKING
// ============================================
router.get('/completion-status/:bookingId', verifyToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const result = await query(
      `SELECT 
        b.*,
        wp.user_id as worker_user_id,
        (SELECT COUNT(*) FROM reviews WHERE booking_id = b.id) as reviews_count
       FROM bookings b
       JOIN worker_profiles wp ON b.worker_id = wp.id
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
    const isCustomer = userId === booking.customer_id;
    const isWorker = userId === booking.worker_user_id;

    if (!isCustomer && !isWorker) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const bothCompleted = booking.customer_marked_complete && booking.worker_marked_complete;
    const userMarkedComplete = isCustomer ? booking.customer_marked_complete : booking.worker_marked_complete;
    const otherPartyMarkedComplete = isCustomer ? booking.worker_marked_complete : booking.customer_marked_complete;

    // Check if user already submitted review
    const userReviewResult = await query(
      `SELECT id FROM reviews WHERE booking_id = $1 AND reviewer_id = $2`,
      [bookingId, userId]
    );

    res.json({
      success: true,
      data: {
        bookingId,
        status: booking.status,
        userMarkedComplete,
        otherPartyMarkedComplete,
        bothCompleted,
        canSubmitReview: bothCompleted && userReviewResult.rows.length === 0,
        userReviewSubmitted: userReviewResult.rows.length > 0,
        totalReviews: booking.reviews_count,
        customerInvoiceUrl: booking.customer_invoice_url,
        workerInvoiceUrl: booking.worker_invoice_url,
        customerAmount: booking.customer_completion_amount,
        workerAmount: booking.worker_completion_amount
      }
    });

  } catch (error) {
    console.error('Get completion status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch completion status',
      error: error.message
    });
  }
});

// ============================================
// DISPUTE COMPLETION
// ============================================
router.post('/dispute', verifyToken, upload.array('evidence', 5), async (req, res) => {
  try {
    const { bookingId, reason, description } = req.body;
    const userId = req.user.id;

    // Verify authorization
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
        message: 'Not authorized'
      });
    }

    // Upload evidence files if any
    let evidenceUrls = [];
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file => {
        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'disputes', resource_type: 'auto' },
            (error, result) => {
              if (error) reject(error);
              else resolve(result.secure_url);
            }
          );
          uploadStream.end(file.buffer);
        });
      });
      evidenceUrls = await Promise.all(uploadPromises);
    }

    // Create dispute
    const disputeResult = await query(
      `INSERT INTO disputes 
       (booking_id, raised_by, reason, description, evidence, status)
       VALUES ($1, $2, $3, $4, $5, 'open')
       RETURNING *`,
      [bookingId, userId, reason, description, JSON.stringify(evidenceUrls)]
    );

    // Update booking status
    await query(
      `UPDATE bookings SET status = 'disputed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [bookingId]
    );

    // Notify admin and other party
    const otherPartyId = userId === booking.customer_id ? booking.worker_user_id : booking.customer_id;
    
    await query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, 'dispute_raised', 'Dispute Raised', 'A dispute has been raised for your booking.', $2)`,
      [otherPartyId, JSON.stringify({ bookingId, disputeId: disputeResult.rows[0].id })]
    );

    res.json({
      success: true,
      message: 'Dispute submitted successfully. Admin will review shortly.',
      data: {
        dispute: disputeResult.rows[0]
      }
    });

  } catch (error) {
    console.error('Dispute error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit dispute',
      error: error.message
    });
  }
});

module.exports = router;