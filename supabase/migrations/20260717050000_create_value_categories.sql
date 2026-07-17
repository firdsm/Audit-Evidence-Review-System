-- Migration: 20260717050000_create_value_categories.sql
-- Create global rating/grading classifications based on final scores (scale 0-5)

CREATE TABLE IF NOT EXISTS value_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL UNIQUE,
    min_score NUMERIC(3, 2) NOT NULL CHECK (min_score >= 0.0 AND min_score <= 5.0),
    max_score NUMERIC(3, 2) NOT NULL CHECK (max_score >= 0.0 AND max_score <= 5.0),
    color TEXT NOT NULL DEFAULT 'zinc',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT chk_min_less_than_max CHECK (min_score < max_score)
);

-- Enable Row Level Security
ALTER TABLE value_categories ENABLE ROW LEVEL SECURITY;

-- Read policy: all authenticated users can read classifications to view badges
CREATE POLICY "Allow read for authenticated" ON value_categories
    FOR SELECT TO authenticated USING (true);

-- Write policy: superadmins only (managed on server-side actions/API endpoints)
CREATE POLICY "Allow full access for superadmins" ON value_categories
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
