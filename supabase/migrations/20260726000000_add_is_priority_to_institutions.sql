-- Migration: 20260726000000_add_is_priority_to_institutions.sql
-- Add is_priority column to institutions table

ALTER TABLE institutions
ADD COLUMN is_priority BOOLEAN NOT NULL DEFAULT false;
