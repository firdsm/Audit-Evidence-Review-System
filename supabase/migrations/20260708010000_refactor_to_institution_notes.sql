-- Rename table and replace 4 date columns with a single free-text note column.
-- The intent of the table (per-institution contextual reference) is the same;
-- only the data model changes.

-- 1. Rename table
ALTER TABLE institution_reference_dates RENAME TO institution_notes;

-- 2. Drop the 4 date columns
ALTER TABLE institution_notes DROP COLUMN IF EXISTS sk_sp_date;
ALTER TABLE institution_notes DROP COLUMN IF EXISTS fkp_date;
ALTER TABLE institution_notes DROP COLUMN IF EXISTS skm_date;
ALTER TABLE institution_notes DROP COLUMN IF EXISTS tl_skm_date;

-- 3. Add free-text note column
ALTER TABLE institution_notes ADD COLUMN IF NOT EXISTS note TEXT;

-- 4. Rename the trigger to match new table name (drop old, create new)
DROP TRIGGER IF EXISTS update_institution_reference_dates_updated_at ON institution_notes;

CREATE TRIGGER update_institution_notes_updated_at
  BEFORE UPDATE ON institution_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
