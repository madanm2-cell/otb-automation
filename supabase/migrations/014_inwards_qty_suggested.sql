-- Add suggested inwards quantity column for auto-suggestion feature
ALTER TABLE otb_plan_data ADD COLUMN IF NOT EXISTS inwards_qty_suggested NUMERIC;
