-- Alter indicators table to add explanation column
ALTER TABLE indicators
ADD COLUMN IF NOT EXISTS explanation TEXT NULL;
