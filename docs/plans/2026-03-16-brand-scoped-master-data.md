# OTB Automation — Ad-Hoc Sprint: Brand-Scoped Master Data

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure master data so that brand is the root entity owning all its master data. Introduce a proper `wear_types` table, eliminate the `wear_type_mappings` junction table, and remove wear_types from cycle creation.

**Why:** The current schema has brand-agnostic sub_categories/channels/genders and a clunky `wear_type_mappings` junction table. This causes invalid dimension combinations to pass validation (e.g. a TIGC sub-category accepted for Bewakoof uploads). The new hierarchy makes the data model self-describing.

**New Hierarchy:**
```
Brand
├── Sub Brands        (brand_id)              — already works this way
├── Wear Types        (brand_id)              — NEW table
│   └── Sub Categories (brand_id, wear_type_id) — now under wear type
├── Channels          (brand_id)              — add brand_id
└── Genders           (brand_id)              — add brand_id
```

**Key Eliminations:**
- `wear_type_mappings` table → dropped (replaced by `wear_types` table + `sub_categories.wear_type_id`)
- `otb_cycles.wear_types` JSON column → dropped (wear types are master data, not per-cycle config)
- Wear types field on cycle creation form → removed

---

## Impact Summary

| File | Change |
|------|--------|
| `supabase/migrations/008_brand_scoped_master_data.sql` | **New** — full schema migration |
| `src/types/otb.ts` | **Modify** — add WearType, SubCategory, Channel, Gender types; remove wear_types from OtbCycle |
| `src/app/api/master-data/[type]/route.ts` | **Modify** — brand filtering on GET, brand_id required on POST |
| `src/app/api/cycles/route.ts` | **Modify** — remove wear_types from create cycle |
| `src/app/api/cycles/[cycleId]/upload/[fileType]/route.ts` | **Modify** — loadMasterData filters by brand |
| `src/lib/templateGenerator.ts` | **Modify** — derive wear_type from sub_categories join instead of wear_type_mappings |
| `src/components/MasterDataManager.tsx` | **Modify** — brand selector, Wear Types tab, Sub Categories under wear type |
| `src/app/admin/wear-type-mappings/page.tsx` | **Delete** — replaced by Wear Types tab in MasterDataManager |
| `src/app/cycles/new/page.tsx` | **Modify** — remove wear_types field |
| `src/app/cycles/[cycleId]/page.tsx` | **Modify** — remove wear_types display |
| `src/components/AppLayout.tsx` | **Modify** — remove Wear Type Mappings nav link |
| `tests/unit/uploadValidator.test.ts` | **Review** — still valid (MasterDataContext unchanged) |
| `tests/integration/brandScopedMasterData.test.ts` | **New** — integration tests |

---

## Task 1: Database Migration

**File:** Create `supabase/migrations/008_brand_scoped_master_data.sql`

**Step 1: Create `wear_types` table**

```sql
CREATE TABLE wear_types (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  brand_id uuid REFERENCES brands(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(brand_id, name)
);

CREATE INDEX idx_wear_types_brand ON wear_types(brand_id);

-- RLS
ALTER TABLE wear_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read wear_types"
  ON wear_types FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin manages wear_types"
  ON wear_types FOR ALL USING (get_user_role() IN ('Admin', 'Planning'));
```

**Step 2: Seed wear_types from existing wear_type_mappings data**

```sql
-- Extract unique wear_types from current mappings, assign to Bewakoof
INSERT INTO wear_types (name, brand_id)
SELECT DISTINCT wm.wear_type, b.id
FROM wear_type_mappings wm
CROSS JOIN brands b
WHERE b.name = 'Bewakoof'
ON CONFLICT (brand_id, name) DO NOTHING;
```

**Step 3: Add `brand_id` to `sub_categories`, `channels`, `genders`**

```sql
ALTER TABLE sub_categories ADD COLUMN brand_id uuid REFERENCES brands(id);
ALTER TABLE channels ADD COLUMN brand_id uuid REFERENCES brands(id);
ALTER TABLE genders ADD COLUMN brand_id uuid REFERENCES brands(id);
```

**Step 4: Add `wear_type_id` to `sub_categories`**

```sql
ALTER TABLE sub_categories ADD COLUMN wear_type_id uuid REFERENCES wear_types(id);
```

**Step 5: Migrate existing data — duplicate across all brands**

```sql
DO $$
DECLARE
  b record;
  r record;
  wt_id uuid;
BEGIN
  -- sub_categories: for each brand, copy global rows
  -- For Bewakoof specifically, also set wear_type_id from existing wear_type_mappings
  FOR b IN SELECT id, name FROM brands LOOP
    FOR r IN SELECT name FROM sub_categories WHERE brand_id IS NULL LOOP
      -- Look up wear_type from wear_type_mappings for this brand
      -- (only Bewakoof has mappings in seed data)
      SELECT wt.id INTO wt_id
      FROM wear_type_mappings wtm
      JOIN wear_types wt ON wt.name = wtm.wear_type AND wt.brand_id = b.id
      WHERE wtm.sub_category = r.name
      LIMIT 1;

      INSERT INTO sub_categories (name, brand_id, wear_type_id)
      VALUES (r.name, b.id, wt_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
  DELETE FROM sub_categories WHERE brand_id IS NULL;

  -- channels: duplicate across all brands
  FOR b IN SELECT id FROM brands LOOP
    FOR r IN SELECT name FROM channels WHERE brand_id IS NULL LOOP
      INSERT INTO channels (name, brand_id)
      VALUES (r.name, b.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
  DELETE FROM channels WHERE brand_id IS NULL;

  -- genders: duplicate across all brands
  FOR b IN SELECT id FROM brands LOOP
    FOR r IN SELECT name FROM genders WHERE brand_id IS NULL LOOP
      INSERT INTO genders (name, brand_id)
      VALUES (r.name, b.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
  DELETE FROM genders WHERE brand_id IS NULL;
END $$;
```

**Step 6: Make columns NOT NULL, replace unique constraints**

```sql
-- sub_categories
ALTER TABLE sub_categories ALTER COLUMN brand_id SET NOT NULL;
-- wear_type_id stays nullable for now — non-Bewakoof brands won't have it set yet
-- Admin must configure this per brand via UI
ALTER TABLE sub_categories DROP CONSTRAINT sub_categories_name_key;
ALTER TABLE sub_categories ADD CONSTRAINT sub_categories_brand_wt_name_key UNIQUE(brand_id, wear_type_id, name);

-- channels
ALTER TABLE channels ALTER COLUMN brand_id SET NOT NULL;
ALTER TABLE channels DROP CONSTRAINT channels_name_key;
ALTER TABLE channels ADD CONSTRAINT channels_brand_name_key UNIQUE(brand_id, name);

-- genders
ALTER TABLE genders ALTER COLUMN brand_id SET NOT NULL;
ALTER TABLE genders DROP CONSTRAINT genders_name_key;
ALTER TABLE genders ADD CONSTRAINT genders_brand_name_key UNIQUE(brand_id, name);
```

**Step 7: Convert `master_mappings.brand` from text to `brand_id` uuid**

```sql
ALTER TABLE master_mappings ADD COLUMN brand_id uuid REFERENCES brands(id);

UPDATE master_mappings SET brand_id = b.id
FROM brands b WHERE b.name = master_mappings.brand;

ALTER TABLE master_mappings DROP CONSTRAINT master_mappings_mapping_type_raw_value_brand_key;
ALTER TABLE master_mappings DROP COLUMN brand;
ALTER TABLE master_mappings ADD CONSTRAINT master_mappings_type_raw_brand_key
  UNIQUE(mapping_type, raw_value, brand_id);

-- Prevent duplicate global mappings where brand_id IS NULL
CREATE UNIQUE INDEX idx_master_mappings_global
  ON master_mappings(mapping_type, raw_value) WHERE brand_id IS NULL;
```

**Step 8: Drop `wear_type_mappings` table and `otb_cycles.wear_types` column**

```sql
DROP TABLE IF EXISTS wear_type_mappings;
ALTER TABLE otb_cycles DROP COLUMN IF EXISTS wear_types;
```

**Step 9: Drop migration 006/007 artifacts (policies on dropped table)**

```sql
-- wear_type_mappings RLS policies and indexes are dropped with the table
-- No action needed
```

**Commit:**
```bash
git add supabase/migrations/008_brand_scoped_master_data.sql
git commit -m "feat: migration for brand-scoped master data with wear_types hierarchy"
```

---

## Task 2: Update TypeScript Types

**File:** Modify `src/types/otb.ts`

**Step 1: Add new interfaces** (after existing SubBrand interface):

```typescript
export interface WearType {
  id: string;
  name: string;
  brand_id: string;
}

export interface SubCategory {
  id: string;
  name: string;
  brand_id: string;
  wear_type_id: string | null;
  // Joined
  wear_types?: WearType;
}

export interface Channel {
  id: string;
  name: string;
  brand_id: string;
}

export interface Gender {
  id: string;
  name: string;
  brand_id: string;
}

export interface MasterMapping {
  id: string;
  mapping_type: string;
  raw_value: string;
  standard_value: string;
  brand_id: string | null;
}
```

**Step 2: Remove `wear_types` from OtbCycle interface:**

```typescript
// REMOVE these lines from OtbCycle:
//   wear_types: string[];

// The OtbCycle interface should no longer have wear_types
```

**Commit:**
```bash
git add src/types/otb.ts
git commit -m "feat: TypeScript types for brand-scoped master data hierarchy"
```

---

## Task 3: Update Master Data API

**File:** Modify `src/app/api/master-data/[type]/route.ts`

**Step 1: Add `wear_types` to VALID_TYPES, remove `wear_type_mappings`:**

```typescript
const VALID_TYPES = ['brands', 'sub_brands', 'wear_types', 'sub_categories', 'channels', 'genders', 'master_mappings'];
```

**Step 2: Update GET handler** — extend `?brandId=` filter to all brand-scoped tables:

```typescript
const BRAND_SCOPED_TABLES = ['sub_brands', 'wear_types', 'sub_categories', 'channels', 'genders'];

// Replace the existing sub_brands-only filter block with:
if (BRAND_SCOPED_TABLES.includes(type)) {
  const brandId = req.nextUrl.searchParams.get('brandId');
  if (brandId) {
    query = query.eq('brand_id', brandId);
  }
}

// For sub_categories, also support ?wearTypeId= filter
if (type === 'sub_categories') {
  const wearTypeId = req.nextUrl.searchParams.get('wearTypeId');
  if (wearTypeId) {
    query = query.eq('wear_type_id', wearTypeId);
  }
}

// For master_mappings: include brand-specific + global fallback
if (type === 'master_mappings') {
  const brandId = req.nextUrl.searchParams.get('brandId');
  if (brandId) {
    query = query.or(`brand_id.eq.${brandId},brand_id.is.null`);
  }
}
```

**Step 3: Update POST handler** — require `brand_id` for brand-scoped tables:

```typescript
if (BRAND_SCOPED_TABLES.includes(type) && !body.brand_id) {
  return NextResponse.json({ error: 'brand_id is required' }, { status: 400 });
}
```

**Commit:**
```bash
git add src/app/api/master-data/[type]/route.ts
git commit -m "feat: brand-scoped filtering in master data API"
```

---

## Task 4: Update Cycle API & UI — Remove wear_types

**Files:**
- Modify: `src/app/api/cycles/route.ts`
- Modify: `src/app/cycles/new/page.tsx`
- Modify: `src/app/cycles/[cycleId]/page.tsx`

**Step 1: Cycles API** — remove wear_types from POST handler (`src/app/api/cycles/route.ts`):

- Line 22: Remove `wear_types` from destructuring
- Line 74: Remove `wear_types: Array.isArray(wear_types) ? wear_types : []` from insert

**Step 2: Cycle creation form** — remove wear_types field (`src/app/cycles/new/page.tsx`):

- Remove the entire `Form.Item` block for `wear_types` (lines 79-89)
- Remove `wear_types: values.wear_types` from the POST body (line 39)

**Step 3: Cycle detail page** — remove wear_types display (`src/app/cycles/[cycleId]/page.tsx`):

- Remove the `Descriptions.Item` for "Wear Types" (lines 160-162)

**Commit:**
```bash
git add src/app/api/cycles/route.ts src/app/cycles/new/page.tsx src/app/cycles/[cycleId]/page.tsx
git commit -m "feat: remove wear_types from cycle creation and display"
```

---

## Task 5: Update Upload Route — Brand-Scoped Validation

**File:** Modify `src/app/api/cycles/[cycleId]/upload/[fileType]/route.ts`

**Step 1:** Expand cycle query to include `brand_id` (line ~22):
```typescript
.select('id, status, brand_id')
```

**Step 2:** Pass `brand_id` to `loadMasterData` (line ~50):
```typescript
const masterData = await loadMasterData(supabase, cycle.brand_id);
```

**Step 3:** Update `loadMasterData` function to accept `brandId` and filter all queries:

```typescript
async function loadMasterData(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  brandId: string
): Promise<MasterDataContext> {
  const [subBrandsRes, subCatsRes, channelsRes, gendersRes, mappingsRes] = await Promise.all([
    supabase.from('sub_brands').select('name').eq('brand_id', brandId),
    supabase.from('sub_categories').select('name').eq('brand_id', brandId),
    supabase.from('channels').select('name').eq('brand_id', brandId),
    supabase.from('genders').select('name').eq('brand_id', brandId),
    supabase.from('master_mappings').select('*').or(`brand_id.eq.${brandId},brand_id.is.null`),
  ]);

  const mappings = new Map<string, string>();
  for (const m of mappingsRes.data || []) {
    mappings.set(`${m.mapping_type}:${m.raw_value.toLowerCase()}`, m.standard_value.toLowerCase());
  }

  return {
    subBrands: new Set((subBrandsRes.data || []).map(r => r.name.toLowerCase())),
    subCategories: new Set((subCatsRes.data || []).map(r => r.name.toLowerCase())),
    channels: new Set((channelsRes.data || []).map(r => r.name.toLowerCase())),
    genders: new Set((gendersRes.data || []).map(r => r.name.toLowerCase())),
    mappings,
  };
}
```

Note: `uploadValidator.ts` and `MasterDataContext` interface need NO changes — they use `Set<string>`, which is now populated from brand-filtered queries.

**Commit:**
```bash
git add src/app/api/cycles/[cycleId]/upload/[fileType]/route.ts
git commit -m "feat: upload validation uses brand-scoped master data"
```

---

## Task 6: Update Template Generator

**File:** Modify `src/lib/templateGenerator.ts`

**Change:** Replace `wear_type_mappings` query with a `sub_categories` join to get wear_type.

The current code (lines 57-64) queries `wear_type_mappings` for `sub_brand × sub_category → wear_type`. Replace with querying `sub_categories` joined with `wear_types`:

```typescript
// Replace the wear_type_mappings query with:
const { data: subCategoryData } = await adminDb
  .from('sub_categories')
  .select('name, wear_type_id, wear_types(name)')
  .eq('brand_id', cycle.brand_id)
  .not('wear_type_id', 'is', null);

// Build lookup: sub_category name → wear_type name
const subCatWearTypeMap = new Map<string, string>();
for (const sc of subCategoryData || []) {
  if (sc.wear_types?.name) {
    subCatWearTypeMap.set(sc.name.toLowerCase(), sc.wear_types.name);
  }
}
```

Then update the loop (lines 72-94) that builds `dimensionCombos`. Currently it builds the key from `sub_brand + sub_category` to lookup wear_type. Change to lookup by `sub_category` only (since sub_category now inherently knows its wear_type):

```typescript
for (const row of uploadedData.opening_stock) {
  const subCategory = String(row.sub_category || '').toLowerCase();
  const wearType = subCatWearTypeMap.get(subCategory);

  if (!wearType) {
    missingWearTypes.add(subCategory);
    continue;
  }

  const combo: DimensionKey = {
    sub_brand: String(row.sub_brand || '').toLowerCase(),
    wear_type: wearType,
    sub_category: subCategory,
    gender: String(row.gender || '').toLowerCase(),
    channel: String(row.channel || '').toLowerCase(),
  };
  // ... rest unchanged
}
```

Update the warning message to say "Missing wear_type for sub_category" instead of "Missing wear_type mapping for".

**Commit:**
```bash
git add src/lib/templateGenerator.ts
git commit -m "feat: template generator derives wear_type from sub_categories hierarchy"
```

---

## Task 7: Update MasterDataManager UI

**File:** Modify `src/components/MasterDataManager.tsx`

This is the largest change. Redesign the UI to be brand-first with the hierarchy.

**Step 1: Add brand selector at top of page.** `selectedBrandId` state. When no brand selected, show "Select a brand to manage its master data".

**Step 2: Update TABS config:**

```typescript
const TABS = [
  { key: 'brands', label: 'Brands', fields: ['name'], brandScoped: false },
  { key: 'sub_brands', label: 'Sub Brands', fields: ['name'], brandScoped: true },
  { key: 'wear_types', label: 'Wear Types', fields: ['name'], brandScoped: true },
  { key: 'sub_categories', label: 'Sub Categories', fields: ['name', 'wear_type_id'], brandScoped: true },
  { key: 'channels', label: 'Channels', fields: ['name'], brandScoped: true },
  { key: 'genders', label: 'Genders', fields: ['name'], brandScoped: true },
];
```

**Step 3: Load data with brand filter:**

```typescript
const url = tabConfig.brandScoped && selectedBrandId
  ? `/api/master-data/${type}?brandId=${selectedBrandId}`
  : `/api/master-data/${type}`;
```

**Step 4: For sub_categories tab**, load wear_types for the selected brand and show a "Wear Type" column + wear_type_id selector in the form.

**Step 5: Auto-set `brand_id`** from `selectedBrandId` when creating new records (hidden field).

**Step 6: Show "Brand" column** for all brand-scoped tabs.

**Step 7: Hide brand-scoped tabs** (or disable them) when no brand is selected.

**Commit:**
```bash
git add src/components/MasterDataManager.tsx
git commit -m "feat: brand-first master data manager with wear types hierarchy"
```

---

## Task 8: Remove Wear Type Mappings Page & Update Nav

**Files:**
- Delete: `src/app/admin/wear-type-mappings/page.tsx`
- Modify: `src/components/AppLayout.tsx`

**Step 1:** Delete the wear-type-mappings page entirely — its functionality is replaced by the Wear Types tab in MasterDataManager.

**Step 2:** Remove the "Wear Type Mappings" nav item from AppLayout sidebar. Currently the nav likely has an entry for `/admin/wear-type-mappings`.

**Commit:**
```bash
git rm src/app/admin/wear-type-mappings/page.tsx
git add src/components/AppLayout.tsx
git commit -m "feat: remove wear type mappings page, consolidate into master data manager"
```

---

## Task 9: Update Tests

**Files:**
- Review: `tests/unit/uploadValidator.test.ts` — `MasterDataContext` interface unchanged, tests stay valid
- Create: `tests/integration/brandScopedMasterData.test.ts`

**New integration tests:**

```typescript
describe('Brand-Scoped Master Data', () => {
  it('sub_categories require brand_id (NOT NULL constraint)');
  it('same sub_category name allowed for different brands');
  it('sub_category must reference a valid wear_type under the same brand');
  it('upload validation rejects sub_category not belonging to cycle brand');
  it('template generator derives wear_type from sub_category hierarchy');
  it('master data API filters by brandId param');
  it('wear_types table is brand-scoped');
  it('otb_cycles no longer has wear_types column');
});
```

**Commit:**
```bash
git add tests/
git commit -m "test: brand-scoped master data integration tests"
```

---

## Task Dependency Graph

```
Task 1 (Migration) ──┬── Task 3 (Master Data API) ── Task 7 (MasterData UI)
                      │
Task 2 (Types) ──────┤── Task 4 (Cycle API & UI)
                      │
                      ├── Task 5 (Upload Route)
                      │
                      ├── Task 6 (Template Generator)
                      │
                      ├── Task 8 (Remove Wear Type Mappings)
                      │
                      └── Task 9 (Tests) — after all above
```

Tasks 1 + 2 are parallel. Tasks 3-8 can be parallel after 1+2 are done (except Task 7 depends on Task 3).

---

## Verification

After all tasks:

1. **Apply migration 008** to Supabase (via SQL Editor or CLI)
2. **Run `npx vitest run`** — all unit + integration tests pass
3. **Master Data Admin UI:**
   - Select brand → see Wear Types tab → add NWW, WW
   - Sub Categories tab → each sub_category shows its wear_type → add new sub_category under a wear_type
   - Channels, Genders tabs → scoped to selected brand
4. **Cycle creation:** No wear_types field on form; cycle created without wear_types column
5. **File upload:** V-003 validation only checks against the cycle's brand's master data
6. **Template generation:** Wear type derived from sub_category's parent wear_type, not from junction table
7. **Existing plan data:** Unaffected (text-based dimensions in otb_plan_rows don't break)
8. **Wear Type Mappings page:** Gone from nav; 404 if visited directly
