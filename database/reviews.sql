-- Add missing columns to reviews table
ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS invoice_image_url TEXT,
ADD COLUMN IF NOT EXISTS invoice_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS response TEXT,
ADD COLUMN IF NOT EXISTS response_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS helpful_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reviewer_type VARCHAR(20) CHECK (reviewer_type IN ('customer', 'worker'));

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_reviews_booking ON reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating DESC);

-- Recalculate all worker ratings and stats
UPDATE worker_profiles wp
SET 
  average_rating = COALESCE((
    SELECT ROUND(AVG(r.rating)::numeric, 2)
    FROM reviews r
    JOIN bookings b ON r.booking_id = b.id
    WHERE b.worker_id = wp.id
  ), 0.00),
  total_reviews = COALESCE((
    SELECT COUNT(*)
    FROM reviews r
    JOIN bookings b ON r.booking_id = b.id
    WHERE b.worker_id = wp.id
  ), 0),
  updated_at = CURRENT_TIMESTAMP;


-- Recreate the update_worker_rating trigger function
CREATE OR REPLACE FUNCTION update_worker_rating()
RETURNS TRIGGER AS $$
DECLARE
  worker_profile_id UUID;
BEGIN
  -- Get worker profile ID from the booking
  SELECT worker_id INTO worker_profile_id
  FROM bookings
  WHERE id = NEW.booking_id;
  
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_update_worker_rating ON reviews;
CREATE TRIGGER trigger_update_worker_rating
AFTER INSERT ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_worker_rating();