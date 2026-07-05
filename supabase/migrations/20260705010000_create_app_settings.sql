-- Create app_settings table to store global configurations
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(255) PRIMARY KEY,
  value VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default value for global_debug_mode
INSERT INTO app_settings (key, value) 
VALUES ('global_debug_mode', 'false') 
ON CONFLICT (key) DO NOTHING;
