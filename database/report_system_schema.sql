-- database/report_system_schema.sql
-- Enhanced Report System with Chat Support

-- Drop existing reports table if needed (backup data first!)
-- DROP TABLE IF EXISTS report_messages CASCADE;
-- DROP TABLE IF EXISTS reports CASCADE;

-- Enhanced Reports Table
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id VARCHAR(20) UNIQUE NOT NULL, -- e.g., "RPT-2024-001234"
  reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reported_type VARCHAR(50) NOT NULL CHECK (reported_type IN ('worker', 'job', 'message', 'user', 'review')),
  reported_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  reason VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  images JSONB DEFAULT '[]', -- Array of Cloudinary URLs
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'seen', 'processing', 'resolved', 'dismissed')),
  admin_notes TEXT,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Report Messages (Admin-Customer Chat)
CREATE TABLE IF NOT EXISTS report_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('customer', 'admin')),
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_reports_case_id ON reports(case_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_messages_report ON report_messages(report_id);
CREATE INDEX IF NOT EXISTS idx_report_messages_created ON report_messages(created_at);

-- Function to generate case_id
CREATE OR REPLACE FUNCTION generate_case_id()
RETURNS TEXT AS $$
DECLARE
  new_case_id TEXT;
  counter INT;
BEGIN
  -- Get current count for today
  SELECT COUNT(*) INTO counter 
  FROM reports 
  WHERE created_at::DATE = CURRENT_DATE;
  
  -- Generate case_id format: RPT-YYYYMMDD-XXXX
  new_case_id := 'RPT-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((counter + 1)::TEXT, 4, '0');
  
  RETURN new_case_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate case_id
CREATE OR REPLACE FUNCTION set_case_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.case_id IS NULL OR NEW.case_id = '' THEN
    NEW.case_id := generate_case_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_case_id ON reports;
CREATE TRIGGER trigger_set_case_id
  BEFORE INSERT ON reports
  FOR EACH ROW
  EXECUTE FUNCTION set_case_id();

-- Updated_at trigger for reports
DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
CREATE TRIGGER update_reports_updated_at 
  BEFORE UPDATE ON reports 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Notification trigger when admin sends message
CREATE OR REPLACE FUNCTION notify_customer_on_admin_reply()
RETURNS TRIGGER AS $$
DECLARE
  report_reporter_id UUID;
BEGIN
  IF NEW.sender_type = 'admin' THEN
    -- Get reporter_id from reports table
    SELECT reporter_id INTO report_reporter_id
    FROM reports
    WHERE id = NEW.report_id;
    
    -- Create notification for customer
    INSERT INTO notifications (user_id, type, title, message, data, created_at)
    VALUES (
      report_reporter_id,
      'report_update',
      'Admin Response on Your Report',
      'You have received a response from admin regarding your report.',
      jsonb_build_object('report_id', NEW.report_id, 'message_id', NEW.id),
      CURRENT_TIMESTAMP
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_customer ON report_messages;
CREATE TRIGGER trigger_notify_customer
  AFTER INSERT ON report_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_customer_on_admin_reply();