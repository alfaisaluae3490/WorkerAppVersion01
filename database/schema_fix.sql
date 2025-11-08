-- Fix the bids table foreign key constraint
-- Run this in your Neon PostgreSQL database

-- Step 1: Drop the existing incorrect foreign key constraint
ALTER TABLE bids 
DROP CONSTRAINT IF EXISTS bids_worker_id_fkey;

-- Step 2: Add the correct foreign key constraint
-- worker_id should reference worker_profiles.id, not users.id
ALTER TABLE bids 
ADD CONSTRAINT bids_worker_id_fkey 
FOREIGN KEY (worker_id) 
REFERENCES worker_profiles(id) 
ON DELETE CASCADE;

-- Verify the change
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name='bids'
    AND kcu.column_name = 'worker_id';