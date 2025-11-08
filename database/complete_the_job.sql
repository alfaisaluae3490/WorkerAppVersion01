-- Add completion tracking columns to bookings table
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
ADD COLUMN IF NOT EXISTS completion_confirmed_at TIMESTAMP;

-- Create completion_requests table if not exists
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

-- Create trigger function for mutual completion check
CREATE OR REPLACE FUNCTION check_mutual_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT customer_marked_complete AND worker_marked_complete 
      FROM bookings 
      WHERE id = NEW.id) THEN
    
    UPDATE bookings 
    SET 
      status = 'completed',
      completion_confirmed_at = CURRENT_TIMESTAMP,
      completed_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
    
    UPDATE jobs 
    SET 
      status = 'completed',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = (SELECT job_id FROM bookings WHERE id = NEW.id);
    
    UPDATE worker_profiles
    SET 
      total_jobs_completed = total_jobs_completed + 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = (SELECT worker_id FROM bookings WHERE id = NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_check_mutual_completion ON bookings;
CREATE TRIGGER trigger_check_mutual_completion
AFTER UPDATE OF customer_marked_complete, worker_marked_complete ON bookings
FOR EACH ROW
WHEN (NEW.customer_marked_complete = TRUE OR NEW.worker_marked_complete = TRUE)
EXECUTE FUNCTION check_mutual_completion();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_completion_requests_booking ON completion_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_completion ON bookings(customer_marked_complete, worker_marked_complete);