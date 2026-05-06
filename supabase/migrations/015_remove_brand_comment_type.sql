-- Migration 015: Remove 'brand' comment type — redundant with 'general' in brand-scoped cycles
BEGIN;

-- Migrate existing brand comments → general
UPDATE comments SET comment_type = 'general' WHERE comment_type = 'brand';

-- Drop old check constraint (name from migration 010)
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_comment_type_check;

-- Add new constraint
ALTER TABLE comments ADD CONSTRAINT comments_comment_type_check
  CHECK (comment_type IN ('general', 'metric'));

COMMIT;
