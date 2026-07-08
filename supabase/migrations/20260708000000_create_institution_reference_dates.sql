-- Create institution_reference_dates table
-- Intentionally separated from institutions table to support future "year" dimension
-- without requiring a schema redesign.
CREATE TABLE IF NOT EXISTS institution_reference_dates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  sk_sp_date DATE,
  fkp_date DATE,
  skm_date DATE,
  tl_skm_date DATE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(institution_id)
);

-- Reuse existing trigger function from schema.sql
CREATE TRIGGER update_institution_reference_dates_updated_at
  BEFORE UPDATE ON institution_reference_dates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
