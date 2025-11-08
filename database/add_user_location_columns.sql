-- Add location columns to users table for personal profiles
-- Run this migration on your Neon.tech database

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS province VARCHAR(100),
ADD COLUMN IF NOT EXISTS bio TEXT;

-- Create index for faster location queries
CREATE INDEX IF NOT EXISTS idx_users_location ON users(city, province);