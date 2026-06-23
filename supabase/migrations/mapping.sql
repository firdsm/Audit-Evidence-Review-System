-- Drop existing table if it exists
DROP TABLE IF EXISTS indicator_folder_mapping CASCADE;

-- Create indicator_folder_mapping table
CREATE TABLE indicator_folder_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    indicator_id UUID REFERENCES indicators(id) ON DELETE CASCADE NOT NULL UNIQUE,
    folder_position INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
