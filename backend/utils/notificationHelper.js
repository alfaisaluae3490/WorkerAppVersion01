// backend/utils/notificationHelper.js
const { query } = require('../config/database');

/**
 * Create a notification
 */
async function createNotification({
  user_id,
  type,
  title,
  message,
  related_job_id = null,
  related_bid_id = null,
  related_user_id = null
}) {
  try {
    const result = await query(
      `INSERT INTO notifications 
       (user_id, type, title, message, related_job_id, related_bid_id, related_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [user_id, type, title, message, related_job_id, related_bid_id, related_user_id]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('Create notification error:', error);
    throw error;
  }
}

/**
 * Notification Templates
 */
const NotificationTemplates = {
  // When someone places a bid on customer's job
  BID_RECEIVED: (jobTitle, workerName) => ({
    type: 'bid_received',
    title: 'New bid on your job',
    message: `${workerName} has placed a bid on "${jobTitle}"`
  }),

  // When customer accepts a bid
  BID_ACCEPTED: (jobTitle) => ({
    type: 'bid_accepted',
    title: 'Your bid was accepted!',
    message: `Your bid on "${jobTitle}" has been accepted`
  }),

  // When a bid is rejected
  BID_REJECTED: (jobTitle) => ({
    type: 'bid_rejected',
    title: 'Bid not accepted',
    message: `Your bid on "${jobTitle}" was not accepted`
  }),

  // When job is completed
  JOB_COMPLETED: (jobTitle) => ({
    type: 'job_completed',
    title: 'Job completed',
    message: `"${jobTitle}" has been marked as completed`
  }),

  // When new message received
  NEW_MESSAGE: (senderName) => ({
    type: 'new_message',
    title: 'New message',
    message: `${senderName} sent you a message`
  }),

  // When job is assigned
  JOB_ASSIGNED: (jobTitle) => ({
    type: 'job_assigned',
    title: 'Job assigned to you',
    message: `You have been assigned to work on "${jobTitle}"`
  }),

  // When payment is received
  PAYMENT_RECEIVED: (amount) => ({
    type: 'payment_received',
    title: 'Payment received',
    message: `You received a payment of Rs${amount}`
  }),

  // When review is received
  REVIEW_RECEIVED: (rating, reviewerName) => ({
    type: 'review_received',
    title: 'New review',
    message: `${reviewerName} left you a ${rating}-star review`
  })
};

/**
 * Helper functions for common notification scenarios
 */

// Notify customer when bid is received
async function notifyBidReceived(customerId, jobId, jobTitle, workerId, workerName) {
  const template = NotificationTemplates.BID_RECEIVED(jobTitle, workerName);
  return createNotification({
    user_id: customerId,
    ...template,
    related_job_id: jobId,
    related_user_id: workerId
  });
}

// Notify worker when bid is accepted
async function notifyBidAccepted(workerId, jobId, jobTitle, bidId) {
  const template = NotificationTemplates.BID_ACCEPTED(jobTitle);
  return createNotification({
    user_id: workerId,
    ...template,
    related_job_id: jobId,
    related_bid_id: bidId
  });
}

// Notify worker when bid is rejected
async function notifyBidRejected(workerId, jobId, jobTitle, bidId) {
  const template = NotificationTemplates.BID_REJECTED(jobTitle);
  return createNotification({
    user_id: workerId,
    ...template,
    related_job_id: jobId,
    related_bid_id: bidId
  });
}

// Notify both when job is completed
async function notifyJobCompleted(userId, jobId, jobTitle) {
  const template = NotificationTemplates.JOB_COMPLETED(jobTitle);
  return createNotification({
    user_id: userId,
    ...template,
    related_job_id: jobId
  });
}

// Notify when new message
async function notifyNewMessage(recipientId, senderId, senderName) {
  const template = NotificationTemplates.NEW_MESSAGE(senderName);
  return createNotification({
    user_id: recipientId,
    ...template,
    related_user_id: senderId
  });
}

module.exports = {
  createNotification,
  NotificationTemplates,
  notifyBidReceived,
  notifyBidAccepted,
  notifyBidRejected,
  notifyJobCompleted,
  notifyNewMessage
};