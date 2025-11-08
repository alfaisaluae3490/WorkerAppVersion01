-- Drop old constraint
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_status_check;

-- Add new constraint
ALTER TABLE reports ADD CONSTRAINT reports_status_check 
CHECK (status IN ('pending', 'seen', 'processing', 'resolved', 'dismissed'));

-- Update any invalid statuses
UPDATE reports SET status = 'processing' WHERE status = 'reviewing';