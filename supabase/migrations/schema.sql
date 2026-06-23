-- Create custom enum type for assessment finding status
CREATE TYPE finding_status_type AS ENUM ('tidak_ada_temuan', 'perlu_perbaikan', 'bukti_tidak_tersedia');

-- Create auditors table
CREATE TABLE auditors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create institutions table
CREATE TABLE institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    drive_folder_id VARCHAR(255) UNIQUE,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create aspects table
CREATE TABLE aspects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    order_number INTEGER NOT NULL
);

-- Create indicators table
CREATE TABLE indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aspect_id UUID REFERENCES aspects(id) ON DELETE CASCADE NOT NULL,
    code VARCHAR(50) NOT NULL,
    name TEXT NOT NULL,
    order_number INTEGER NOT NULL
);

-- Create assessments table
CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE NOT NULL,
    indicator_id UUID REFERENCES indicators(id) ON DELETE CASCADE NOT NULL,
    auditor_id UUID REFERENCES auditors(id) ON DELETE SET NULL,
    score INTEGER CHECK (score >= 0 AND score <= 5),
    finding_status finding_status_type NOT NULL DEFAULT 'tidak_ada_temuan',
    notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_institution_indicator UNIQUE (institution_id, indicator_id)
);

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for assessments
CREATE TRIGGER update_assessments_updated_at
    BEFORE UPDATE ON assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
