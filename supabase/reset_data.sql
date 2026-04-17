-- ============================================================
-- RESET: Clear all transactional data, keep master data
-- Run this for a clean slate before testing
-- ============================================================

BEGIN;

-- Safely truncate tables that may or may not exist
DO $$
BEGIN
  -- Tables from migration 011 (may not be applied yet)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'otb_actuals') THEN
    TRUNCATE otb_actuals CASCADE;
  END IF;

  -- Tables from migration 010
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comments') THEN
    TRUNCATE comments CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'approval_tracking') THEN
    TRUNCATE approval_tracking CASCADE;
  END IF;

  -- Core tables (always present)
  TRUNCATE otb_plan_data CASCADE;
  TRUNCATE otb_plan_rows CASCADE;
  TRUNCATE version_history CASCADE;
  TRUNCATE file_uploads CASCADE;
  TRUNCATE otb_cycles CASCADE;
  TRUNCATE audit_logs CASCADE;
END $$;

COMMIT;

-- Verify clean state
SELECT 'otb_cycles' AS table_name, count(*) FROM otb_cycles
UNION ALL SELECT 'otb_plan_rows', count(*) FROM otb_plan_rows
UNION ALL SELECT 'otb_plan_data', count(*) FROM otb_plan_data
UNION ALL SELECT 'file_uploads', count(*) FROM file_uploads
UNION ALL SELECT 'version_history', count(*) FROM version_history
UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs;
