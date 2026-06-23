-- Update existing NULL notes to empty strings to avoid migration failure
UPDATE assessments SET notes = '' WHERE notes IS NULL;

-- Make assessments.notes NOT NULL with a default empty string
ALTER TABLE assessments ALTER COLUMN notes SET NOT NULL;
ALTER TABLE assessments ALTER COLUMN notes SET DEFAULT '';

-- Explicitly ensure assessments.score is NULLABLE (nullable by default, but dropping constraint if any)
ALTER TABLE assessments ALTER COLUMN score DROP NOT NULL;
