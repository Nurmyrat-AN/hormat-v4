-- Keep development-owned keys even when their last explicit value is cleared.
-- Existing non-empty constraint remains; the management service normalizes blanks to NULL.
ALTER TABLE interface_translations ALTER COLUMN translation_value DROP NOT NULL;
