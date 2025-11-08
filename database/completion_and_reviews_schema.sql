-- database/completion_and_reviews_schema.sql
-- Schema updates for completion requests and enhanced review system

-- ============================================
-- COMPLETION REQUESTS TABLE
-- Both parties must submit completion request with invoice
-- ============================================
CREATE TABLE IF NOT EXISTS completion_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
  requester_type VARCHAR(20) NOT NULL CHECK (requester_type IN ('customer', 'worker')),
  invoice_image_url TEXT NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'disputed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(booking_id, requester_id)
);

-- ============================================
-- UPDATE BOOKINGS TABLE
-- Add fields for completion tracking
-- ============================================
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS customer_marked_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS worker_marked_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS customer_invoice_url TEXT,
ADD COLUMN IF NOT EXISTS worker_invoice_url TEXT,
ADD COLUMN IF NOT EXISTS customer_completion_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS worker_completion_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS customer_completion_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS worker_completion_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS final_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS completion_confirmed_at TIMESTAMP;

-- ============================================
-- UPDATE REVIEWS TABLE
-- Add invoice reference and amount verification
-- ============================================
ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS invoice_image_url TEXT,
ADD COLUMN IF NOT EXISTS invoice_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS response TEXT,
ADD COLUMN IF NOT EXISTS response_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS helpful_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reviewer_type VARCHAR(20) CHECK (reviewer_type IN ('customer', 'worker'));

-- ============================================
-- DISPUTES TABLE UPDATE
-- Link to completion requests
-- ============================================
ALTER TABLE disputes
ADD COLUMN IF NOT EXISTS completion_request_id UUID REFERENCES completion_requests(id) ON DELETE SET NULL;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_completion_requests_booking ON completion_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_completion_requests_requester ON completion_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_completion_requests_status ON completion_requests(status);
CREATE INDEX IF NOT EXISTS idx_reviews_booking ON reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_completion ON bookings(customer_marked_complete, worker_marked_complete);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_completion_requests_updated_at 
BEFORE UPDATE ON completion_requests 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTION: Auto-complete booking when both parties submit
-- ============================================
CREATE OR REPLACE FUNCTION check_mutual_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if both customer and worker have marked complete
  IF (SELECT customer_marked_complete AND worker_marked_complete 
      FROM bookings 
      WHERE id = NEW.booking_id) THEN
    
    -- Update booking to completed
    UPDATE bookings 
    SET 
      status = 'completed',
      completion_confirmed_at = CURRENT_TIMESTAMP,
      completed_at = CURRENT_TIMESTAMP
    WHERE id = NEW.booking_id;
    
    -- Update job to completed
    UPDATE jobs 
    SET 
      status = 'completed',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = (SELECT job_id FROM bookings WHERE id = NEW.booking_id);
    
    -- Update worker stats
    UPDATE worker_profiles
    SET 
      total_jobs_completed = total_jobs_completed + 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = (SELECT worker_id FROM bookings WHERE id = NEW.booking_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Check mutual completion after each update
-- ============================================
DROP TRIGGER IF EXISTS trigger_check_mutual_completion ON bookings;
CREATE TRIGGER trigger_check_mutual_completion
AFTER UPDATE OF customer_marked_complete, worker_marked_complete ON bookings
FOR EACH ROW
WHEN (NEW.customer_marked_complete = TRUE OR NEW.worker_marked_complete = TRUE)
EXECUTE FUNCTION check_mutual_completion();

-- ============================================
-- FUNCTION: Update worker average rating after review
-- ============================================
CREATE OR REPLACE FUNCTION update_worker_rating()
RETURNS TRIGGER AS $$
DECLARE
  worker_profile_id UUID;
BEGIN
  -- Get worker profile ID from the booking
  SELECT worker_id INTO worker_profile_id
  FROM bookings
  WHERE id = NEW.booking_id;
  
  -- Only update if reviewing a worker (reviewee is worker)
  IF EXISTS (
    SELECT 1 FROM worker_profiles wp
    JOIN users u ON wp.user_id = u.id
    WHERE u.id = NEW.reviewee_id
  ) THEN
    -- Update worker's average rating and total reviews
    UPDATE worker_profiles
    SET 
      average_rating = (
        SELECT ROUND(AVG(rating)::numeric, 2)
        FROM reviews r
        JOIN bookings b ON r.booking_id = b.id
        WHERE b.worker_id = worker_profile_id
      ),
      total_reviews = (
        SELECT COUNT(*)
        FROM reviews r
        JOIN bookings b ON r.booking_id = b.id
        WHERE b.worker_id = worker_profile_id
      ),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = worker_profile_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Update ratings after review insert
-- ============================================
DROP TRIGGER IF EXISTS trigger_update_worker_rating ON reviews;
CREATE TRIGGER trigger_update_worker_rating
AFTER INSERT ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_worker_rating();

-- ============================================
-- VIEW: Booking completion summary
-- ============================================
CREATE OR REPLACE VIEW booking_completion_status AS
SELECT 
  b.id as booking_id,
  b.job_id,
  b.customer_id,
  b.worker_id,
  b.status,
  b.customer_marked_complete,
  b.worker_marked_complete,
  b.customer_invoice_url,
  b.worker_invoice_url,
  b.customer_completion_amount,
  b.worker_completion_amount,
  b.customer_completion_date,
  b.worker_completion_date,
  b.completion_confirmed_at,
  CASE 
    WHEN b.customer_marked_complete AND b.worker_marked_complete THEN 'both_completed'
    WHEN b.customer_marked_complete THEN 'customer_completed'
    WHEN b.worker_marked_complete THEN 'worker_completed'
    ELSE 'pending'
  END as completion_status,
  (SELECT COUNT(*) FROM reviews WHERE booking_id = b.id) as reviews_submitted,
  (SELECT COUNT(*) FROM completion_requests WHERE booking_id = b.id AND status = 'disputed') as dispute_count
FROM bookings b;

COMMENT ON VIEW booking_completion_status IS 'Provides quick overview of booking completion status for both parties';