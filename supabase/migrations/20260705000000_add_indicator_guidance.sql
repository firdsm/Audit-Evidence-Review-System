-- Alter indicators table to add scoring_scale and required_documents columns
ALTER TABLE indicators 
ADD COLUMN IF NOT EXISTS scoring_scale JSONB NULLABLE,
ADD COLUMN IF NOT EXISTS required_documents JSONB NULLABLE;
