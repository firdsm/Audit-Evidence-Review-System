-- Migration: 20260717040000_add_ratio_columns_to_weight_configurations.sql
-- Add configurable F-02 / F-03 ratio columns to weight_configurations.
-- Defaults to the previously-hardcoded 75/25 split so existing rows stay valid.

ALTER TABLE weight_configurations
  ADD COLUMN IF NOT EXISTS f02_ratio NUMERIC NOT NULL DEFAULT 0.75,
  ADD COLUMN IF NOT EXISTS f03_ratio NUMERIC NOT NULL DEFAULT 0.25;

-- Optional: add a check constraint so the pair always sums to 1
ALTER TABLE weight_configurations
  ADD CONSTRAINT chk_ratio_sum CHECK (ABS(f02_ratio + f03_ratio - 1) < 0.0001);
