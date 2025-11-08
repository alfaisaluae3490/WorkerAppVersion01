-- Fix city column in worker_profiles table
-- Run this in your Neon.tech SQL editor

-- Check if city column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'worker_profiles' 
        AND column_name = 'city'
    ) THEN
        ALTER TABLE worker_profiles ADD COLUMN city VARCHAR(100);
    END IF;
END $$;

-- Check if province column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'worker_profiles' 
        AND column_name = 'province'
    ) THEN
        ALTER TABLE worker_profiles ADD COLUMN province VARCHAR(100);
    END IF;
END $$;

-- Verify the fix
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'worker_profiles' 
AND column_name IN ('city', 'province', 'address')
ORDER BY column_name;