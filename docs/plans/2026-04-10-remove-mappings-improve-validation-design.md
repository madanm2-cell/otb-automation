# Design: Remove Mappings, Improve Validation Errors

**Date:** 2026-04-10
**Status:** Approved
**Context:** The `master_mappings` table and admin Mappings page add complexity for minimal value. The planning team is small, data is mostly consistent, and fix-and-reupload is only mildly annoying. Better error messages eliminate the need for a mapping layer entirely.

## Decision

Remove the mappings system. Enhance V-003 validation errors with "Did you mean?" suggestions and valid value lists so uploaders can fix CSVs in seconds.

## What to Remove

1. **Admin Mappings page** — `src/app/admin/mappings/page.tsx`
2. **Sidebar nav entry** — "Mappings" link in `AppLayout.tsx`
3. **Mapping logic in validator** — `applyMapping()` function in `src/lib/uploadValidator.ts`
4. **Mapping loading in upload routes** — mapping fetch + Map construction in:
   - `src/app/api/cycles/[cycleId]/upload/[fileType]/route.ts`
   - `src/app/api/cycles/[cycleId]/actuals/upload/route.ts`
5. **`mappings` field from `MasterDataContext`** type in `src/types/otb.ts` (if defined there)
6. **Database** — `master_mappings` table, RLS policies, unique indexes (new migration to drop)
7. **API route handling** — remove `master_mappings` case from `src/app/api/master-data/[type]/route.ts`

## What to Add

### Enhanced V-003 Error Messages

**Before:**
```
Unknown channel: "website"
```

**After:**
```
Unknown channel: "website". Valid values: myntra_sor, amazon_cocoblu, flipkart_sor, offline, others
```

Implementation: When a dimension value fails master data lookup, include the full set of valid values in the error message. The valid values are already loaded in `MasterDataContext` as Sets — just join them into the error string.

**Location:** `src/lib/uploadValidator.ts`, within the V-003 error generation blocks for `sub_brand`, `sub_category`, `channel`, `gender`.

### Auto-normalization (already exists, verify)

- `trim()` + `toLowerCase()` — already applied at line 66 of `uploadValidator.ts`
- No additional normalization needed (pluralization matching like `t-shirt` → `t-shirts` is too risky for false positives)

## What Stays the Same

- Upload flow unchanged
- Validation rules V-001 through V-007 unchanged (except V-003 message enhancement)
- Master data tables (`brands`, `sub_brands`, `sub_categories`, `channels`, `genders`) unchanged
- All other admin pages unchanged
- `MasterDataContext` still loaded with Sets for validation — just without `mappings` field

## Migration Plan

1. Create new migration (e.g., `013_drop_master_mappings.sql`):
   ```sql
   DROP POLICY IF EXISTS "All authenticated read mappings" ON master_mappings;
   DROP POLICY IF EXISTS "Admin manages mappings" ON master_mappings;
   DROP TABLE IF EXISTS master_mappings;
   ```

2. Remove all application code referencing mappings
3. Enhance V-003 error messages

## Risks

- **Existing mappings lost** — Any currently saved mappings will be deleted. Since the team is small and data is consistent, this should not cause disruption. Admins should be informed.
- **Slightly more re-uploads** — Users who relied on mappings will need to fix CSVs manually. Better error messages mitigate this.

## Verification

1. Upload a CSV with a typo in `channel` column → should get clear error with valid values listed
2. Upload a CSV with correct but differently-cased values → should pass (existing behavior)
3. Confirm Mappings page is no longer accessible
4. Confirm sidebar no longer shows "Mappings" link
5. Run existing unit tests for `uploadValidator` — update any that test mapping logic
