-- Migration: 20260717020000_create_f03_scores.sql
-- Create table for manually-assigned F-03 scores per institution (scale 1-5)

CREATE TABLE IF NOT EXISTS f03_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE NOT NULL UNIQUE,
    score NUMERIC NOT NULL CHECK (score >= 1.0 AND score <= 5.0),
    updated_by UUID REFERENCES auditors(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE f03_scores ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow read access for authenticated users" ON f03_scores
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow write access for superadmins" ON f03_scores
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
