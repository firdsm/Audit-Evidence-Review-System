-- 1. Create weight configurations table
CREATE TABLE IF NOT EXISTS weight_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INTEGER NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index to guarantee only one active configuration at a time
CREATE UNIQUE INDEX IF NOT EXISTS active_weight_config_idx ON weight_configurations (is_active) WHERE is_active = true;

-- 2. Create aspect weights table
CREATE TABLE IF NOT EXISTS aspect_weights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    weight_configuration_id UUID REFERENCES weight_configurations(id) ON DELETE CASCADE NOT NULL,
    aspect_id UUID REFERENCES aspects(id) ON DELETE CASCADE NOT NULL,
    weight NUMERIC NOT NULL DEFAULT 0.0 CHECK (weight >= 0),
    CONSTRAINT unique_config_aspect UNIQUE(weight_configuration_id, aspect_id)
);

-- 3. Create indicator weights table
CREATE TABLE IF NOT EXISTS indicator_weights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    weight_configuration_id UUID REFERENCES weight_configurations(id) ON DELETE CASCADE NOT NULL,
    indicator_id UUID REFERENCES indicators(id) ON DELETE CASCADE NOT NULL,
    weight NUMERIC NOT NULL DEFAULT 0.0 CHECK (weight >= 0),
    CONSTRAINT unique_config_indicator UNIQUE(weight_configuration_id, indicator_id)
);
