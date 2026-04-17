# Remove Mappings & Improve Validation Errors — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the `master_mappings` system (table, admin page, mapping logic) and enhance V-003 validation errors with valid value lists so uploaders can self-fix CSVs.

**Architecture:** The mapping layer (`applyMapping()` + DB lookups) is removed from the upload validation pipeline. `MasterDataContext` loses its `mappings` field. V-003 errors now include the full set of valid values for each dimension. A new migration drops the `master_mappings` table and its RLS policies.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL), TypeScript, Vitest

---

### Task 1: Update `uploadValidator.ts` — Remove mapping, enhance V-003

**Files:**
- Modify: `src/lib/uploadValidator.ts:50-72` (MasterDataContext + applyMapping)
- Modify: `src/lib/uploadValidator.ts:109-146` (dimension validation block)

**Step 1: Remove `mappings` from `MasterDataContext` and delete `applyMapping`**

Remove the `mappings` field from the interface and delete the `applyMapping` function:

```typescript
// BEFORE (lines 50-72)
export interface MasterDataContext {
  subBrands: Set<string>;
  subCategories: Set<string>;
  channels: Set<string>;
  genders: Set<string>;
  mappings: Map<string, string>;  // key: "type:rawValue" → standardValue
}

function applyMapping(mappings: Map<string, string>, type: string, raw: string): string {
  const key = `${type}:${raw.toLowerCase()}`;
  return mappings.get(key) ?? raw;
}

// AFTER
export interface MasterDataContext {
  subBrands: Set<string>;
  subCategories: Set<string>;
  channels: Set<string>;
  genders: Set<string>;
}
// applyMapping function deleted entirely
```

**Step 2: Update dimension validation to remove mapping calls and add valid values to errors**

```typescript
// BEFORE (lines 112-136)
if (col === 'sub_brand') {
  val = applyMapping(masterData.mappings, 'sub_brand', val);
  normalizedRow[col] = val;
  if (!masterData.subBrands.has(val)) {
    errors.push({ row: rowNum, field: col, rule: 'V-003', message: `Unknown sub_brand: "${val}"` });
  }
} else if (col === 'sub_category') { ... }

// AFTER
if (col === 'sub_brand') {
  normalizedRow[col] = val;
  if (!masterData.subBrands.has(val)) {
    const valid = [...masterData.subBrands].join(', ');
    errors.push({ row: rowNum, field: col, rule: 'V-003', message: `Unknown sub_brand: "${val}". Valid values: ${valid}` });
  }
} else if (col === 'sub_category') {
  normalizedRow[col] = val;
  if (!masterData.subCategories.has(val)) {
    const valid = [...masterData.subCategories].join(', ');
    errors.push({ row: rowNum, field: col, rule: 'V-003', message: `Unknown sub_category: "${val}". Valid values: ${valid}` });
  }
} else if (col === 'channel') {
  normalizedRow[col] = val;
  if (!masterData.channels.has(val)) {
    const valid = [...masterData.channels].join(', ');
    errors.push({ row: rowNum, field: col, rule: 'V-003', message: `Unknown channel: "${val}". Valid values: ${valid}` });
  }
} else if (col === 'gender') {
  normalizedRow[col] = val;
  if (!masterData.genders.has(val)) {
    const valid = [...masterData.genders].join(', ');
    errors.push({ row: rowNum, field: col, rule: 'V-003', message: `Unknown gender: "${val}". Valid values: ${valid}` });
  }
}
```

**Step 3: Run unit tests to verify compilation**

Run: `cd otb-automation && npx vitest run tests/unit/uploadValidator.test.ts`
Expected: Some tests will FAIL (the mapping-specific tests). That's expected — we fix them in Task 2.

**Step 4: Commit**

```bash
git add src/lib/uploadValidator.ts
git commit -m "refactor: remove mapping logic from uploadValidator, enhance V-003 errors with valid values"
```

---

### Task 2: Update unit tests for uploadValidator

**Files:**
- Modify: `tests/unit/uploadValidator.test.ts`

**Step 1: Remove `mappings` field from test `masterData` fixtures**

```typescript
// BEFORE (lines 4-15)
const masterData: MasterDataContext = {
  subBrands: new Set(['bewakoof', 'bewakoof air']),
  subCategories: new Set(['t-shirts', 'jeans', 'hoodies']),
  channels: new Set(['amazon_cocoblu', 'flipkart_sor', 'myntra_sor', 'offline', 'others']),
  genders: new Set(['male', 'female', 'unisex']),
  mappings: new Map([
    ['sub_brand:bob', 'bewakoof'],
    ['sub_brand:BOB', 'bewakoof'],
    ['channel:unicommerce', 'others'],
    ['channel:website', 'others'],
  ]),
};

// AFTER
const masterData: MasterDataContext = {
  subBrands: new Set(['bewakoof', 'bewakoof air']),
  subCategories: new Set(['t-shirts', 'jeans', 'hoodies']),
  channels: new Set(['amazon_cocoblu', 'flipkart_sor', 'myntra_sor', 'offline', 'others']),
  genders: new Set(['male', 'female', 'unisex']),
};
```

Also remove `mappings: new Map()` from `actMasterData` (line 106).

**Step 2: Rewrite mapping-dependent tests**

The test `'V-003: unknown sub_brand fails, but mapping resolves it'` (lines 36-44) tested mapping behavior. Replace it with a test for the new enhanced error message:

```typescript
it('V-003: unknown sub_brand fails with valid values in message', () => {
  const rows = [
    { sub_brand: 'bob', sub_category: 'T-Shirts', gender: 'Male', channel: 'myntra_sor', month: '2025-01-01', nsq: 100 },
  ];
  const result = validateUpload('ly_sales', rows, masterData);
  expect(result.valid).toBe(false);
  const err = result.errors.find(e => e.rule === 'V-003' && e.field === 'sub_brand');
  expect(err).toBeDefined();
  expect(err!.message).toContain('Valid values:');
  expect(err!.message).toContain('bewakoof');
});
```

The test `'channel mapping: unicommerce → others'` (lines 81-88) also tested mapping. Replace it:

```typescript
it('V-003: unknown channel fails with valid values in message', () => {
  const rows = [
    { sub_brand: 'bewakoof', sub_category: 'T-Shirts', gender: 'Male', channel: 'unicommerce', month: '2025-10-01', nsq: 100 },
  ];
  const result = validateUpload('recent_sales', rows, masterData);
  expect(result.valid).toBe(false);
  const err = result.errors.find(e => e.rule === 'V-003' && e.field === 'channel');
  expect(err).toBeDefined();
  expect(err!.message).toContain('Valid values:');
  expect(err!.message).toContain('myntra_sor');
});
```

**Step 3: Run tests to verify all pass**

Run: `cd otb-automation && npx vitest run tests/unit/uploadValidator.test.ts`
Expected: All tests PASS.

**Step 4: Commit**

```bash
git add tests/unit/uploadValidator.test.ts
git commit -m "test: update uploadValidator tests — remove mapping tests, add enhanced V-003 error tests"
```

---

### Task 3: Remove mapping loading from upload API routes

**Files:**
- Modify: `src/app/api/cycles/[cycleId]/upload/[fileType]/route.ts:110-134`
- Modify: `src/app/api/cycles/[cycleId]/actuals/upload/route.ts:256-280`

Both files have identical `loadMasterData()` functions. In each:

**Step 1: Remove mapping fetch and Map construction**

```typescript
// BEFORE (file upload route, lines 110-134)
async function loadMasterData(...): Promise<MasterDataContext> {
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
    subBrands: new Set(...),
    subCategories: new Set(...),
    channels: new Set(...),
    genders: new Set(...),
    mappings,
  };
}

// AFTER
async function loadMasterData(...): Promise<MasterDataContext> {
  const [subBrandsRes, subCatsRes, channelsRes, gendersRes] = await Promise.all([
    supabase.from('sub_brands').select('name').eq('brand_id', brandId),
    supabase.from('sub_categories').select('name').eq('brand_id', brandId),
    supabase.from('channels').select('name').eq('brand_id', brandId),
    supabase.from('genders').select('name').eq('brand_id', brandId),
  ]);

  return {
    subBrands: new Set((subBrandsRes.data || []).map(r => r.name.toLowerCase())),
    subCategories: new Set((subCatsRes.data || []).map(r => r.name.toLowerCase())),
    channels: new Set((channelsRes.data || []).map(r => r.name.toLowerCase())),
    genders: new Set((gendersRes.data || []).map(r => r.name.toLowerCase())),
  };
}
```

**Step 2: Commit**

```bash
git add src/app/api/cycles/[cycleId]/upload/[fileType]/route.ts src/app/api/cycles/[cycleId]/actuals/upload/route.ts
git commit -m "refactor: remove master_mappings fetch from upload routes"
```

---

### Task 4: Remove `master_mappings` from master-data API route

**Files:**
- Modify: `src/app/api/master-data/[type]/route.ts:5-6,44-49`

**Step 1: Remove `master_mappings` from VALID_TYPES and its special query logic**

```typescript
// BEFORE (line 5)
const VALID_TYPES = ['brands', 'sub_brands', 'wear_types', 'sub_categories', 'channels', 'genders', 'master_mappings'];

// AFTER
const VALID_TYPES = ['brands', 'sub_brands', 'wear_types', 'sub_categories', 'channels', 'genders'];
```

Remove the `master_mappings` special filter block (lines 44-49):

```typescript
// DELETE these lines entirely:
// For master_mappings: include brand-specific + global fallback
if (type === 'master_mappings') {
  const brandId = req.nextUrl.searchParams.get('brandId');
  if (brandId) {
    query = query.or(`brand_id.eq.${brandId},brand_id.is.null`);
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/master-data/[type]/route.ts
git commit -m "refactor: remove master_mappings from master-data API route"
```

---

### Task 5: Delete the Mappings admin page and remove sidebar link

**Files:**
- Delete: `src/app/admin/mappings/page.tsx` (entire file)
- Modify: `src/components/AppLayout.tsx:45`

**Step 1: Delete the mappings page**

```bash
rm src/app/admin/mappings/page.tsx
```

Check if there's a `layout.tsx` in that directory too:

```bash
ls src/app/admin/mappings/
```

If the directory is now empty, remove it:

```bash
rmdir src/app/admin/mappings
```

**Step 2: Remove sidebar nav entry**

```typescript
// BEFORE (AppLayout.tsx, lines 42-45)
if (hasPermission(role, 'manage_master_data')) {
  menuItems.push({ key: '/admin/master-data', icon: <SettingOutlined />, label: 'Master Data' });
  menuItems.push({ key: '/admin/master-defaults', icon: <SettingOutlined />, label: 'Master Defaults' });
  menuItems.push({ key: '/admin/mappings', icon: <SettingOutlined />, label: 'Mappings' });
}

// AFTER
if (hasPermission(role, 'manage_master_data')) {
  menuItems.push({ key: '/admin/master-data', icon: <SettingOutlined />, label: 'Master Data' });
  menuItems.push({ key: '/admin/master-defaults', icon: <SettingOutlined />, label: 'Master Defaults' });
}
```

**Step 3: Commit**

```bash
git add -A src/app/admin/mappings src/components/AppLayout.tsx
git commit -m "feat: remove Mappings admin page and sidebar link"
```

---

### Task 6: Update integration tests

**Files:**
- Modify: `tests/integration/fullFlow.test.ts:39-42`

**Step 1: Remove `mappings` field from integration test masterData**

```typescript
// BEFORE (lines 39-42)
mappings: new Map([
  ['sub_brand:bob', 'bewakoof'],
  ['channel:unicommerce', 'others'],
]),

// AFTER — remove the mappings property entirely
// (just delete lines 39-42 and adjust any trailing comma)
```

**Step 2: Run all tests**

Run: `cd otb-automation && npx vitest run`
Expected: All tests PASS.

**Step 3: Commit**

```bash
git add tests/integration/fullFlow.test.ts
git commit -m "test: remove mapping references from integration tests"
```

---

### Task 7: Create migration to drop `master_mappings` table

**Files:**
- Create: `supabase/migrations/012_drop_master_mappings.sql`

**Step 1: Write the migration**

```sql
-- Drop master_mappings table and related policies
-- Mappings replaced by enhanced V-003 validation errors with valid value lists

DROP POLICY IF EXISTS "All authenticated read mappings" ON master_mappings;
DROP POLICY IF EXISTS "Admin manages mappings" ON master_mappings;
DROP INDEX IF EXISTS idx_master_mappings_global;
DROP TABLE IF EXISTS master_mappings;
```

**Step 2: Commit**

```bash
git add supabase/migrations/012_drop_master_mappings.sql
git commit -m "migration: drop master_mappings table and RLS policies"
```

---

### Task 8: Build verification

**Step 1: Run the full build**

Run: `cd otb-automation && npm run build`
Expected: Build succeeds with no TypeScript errors.

**Step 2: Run the full test suite**

Run: `cd otb-automation && npx vitest run`
Expected: All tests pass.

**Step 3: Run lint**

Run: `cd otb-automation && npm run lint`
Expected: No lint errors.

**Step 4: Manual verification checklist**

- [ ] `/admin/mappings` route returns 404
- [ ] Sidebar no longer shows "Mappings" link
- [ ] Uploading a CSV with a typo in `channel` shows error message with valid values list
- [ ] Uploading a CSV with correct values works as before
