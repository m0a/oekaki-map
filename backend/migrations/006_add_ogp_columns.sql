-- Migration: Add OGP columns to canvas table
-- Feature: 006-ogp-share-preview

ALTER TABLE canvas ADD COLUMN ogp_image_key TEXT;
ALTER TABLE canvas ADD COLUMN ogp_place_name TEXT CHECK (ogp_place_name IS NULL OR length(ogp_place_name) <= 100);
ALTER TABLE canvas ADD COLUMN ogp_generated_at TEXT;
