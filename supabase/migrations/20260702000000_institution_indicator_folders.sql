-- Create institution_indicator_folders table
CREATE TABLE IF NOT EXISTS institution_indicator_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  indicator_id UUID NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
  drive_folder_id TEXT NOT NULL,
  last_resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(institution_id, indicator_id)
);

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_iif_institution_indicator 
  ON institution_indicator_folders(institution_id, indicator_id);
