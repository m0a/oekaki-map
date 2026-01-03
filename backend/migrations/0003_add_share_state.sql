-- Add share state columns to canvas table

ALTER TABLE canvas ADD COLUMN share_lat REAL CHECK (share_lat IS NULL OR (share_lat >= -90 AND share_lat <= 90));
ALTER TABLE canvas ADD COLUMN share_lng REAL CHECK (share_lng IS NULL OR (share_lng >= -180 AND share_lng <= 180));
ALTER TABLE canvas ADD COLUMN share_zoom INTEGER CHECK (share_zoom IS NULL OR (share_zoom >= 1 AND share_zoom <= 19));
