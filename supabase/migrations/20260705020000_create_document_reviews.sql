-- Create document_reviews table
CREATE TABLE IF NOT EXISTS document_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  document_id VARCHAR(255) NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(assessment_id, document_id)
);

-- Remove old columns from assessments table
ALTER TABLE assessments DROP COLUMN IF EXISTS finding_status;
ALTER TABLE assessments DROP COLUMN IF EXISTS notes;
