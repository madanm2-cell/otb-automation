-- Drop master_mappings table and related policies
-- Mappings replaced by enhanced V-003 validation errors with valid value lists

DROP POLICY IF EXISTS "All authenticated read mappings" ON master_mappings;
DROP POLICY IF EXISTS "Admin manages mappings" ON master_mappings;
DROP INDEX IF EXISTS idx_master_mappings_global;
DROP TABLE IF EXISTS master_mappings;
