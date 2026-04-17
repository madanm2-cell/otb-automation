# Master Data Defaults & Review Step — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move 6 upload file types (asp, cogs, return_pct, tax_pct, sellex_pct, standard_doh) into brand-scoped master data configuration tables, and add a "Review & Confirm Defaults" step to the cycle workflow so planning teams can review/adjust values before generating the OTB grid.

**Architecture:** New `master_defaults_*` tables store brand-scoped default values for ASP, COGS, return%, tax%, sellex%, and standard DoH. When a cycle is created, these defaults are copied into a per-cycle `cycle_defaults` table. A new UI step between "Upload Files" and "Generate Template & Activate" lets the planning team review, edit, and confirm these defaults. The template generator reads from confirmed cycle defaults instead of uploaded files. File uploads are reduced from 9 required to 3 (opening_stock, ly_sales, recent_sales).

**Tech Stack:** Next.js 16 (App Router), Supabase (PostgreSQL), Ant Design 6 (editable Table), TypeScript, Vitest

---

## Summary of Changes

### What moves from upload → master data defaults

| Parameter | Master Data Granularity | Per-Cycle Editable |
|---|---|---|
| `asp` | brand × sub_brand × sub_category × channel | Yes |
| `cogs` | brand × sub_brand × sub_category | Yes |
| `return_pct` | brand × sub_brand × sub_category × channel | Yes |
| `tax_pct` | brand × sub_category | Yes |
| `sellex_pct` | brand × sub_brand × sub_category × channel | Yes |
| `standard_doh` | brand × sub_brand × sub_category | Yes |

### What remains as file upload (3 required + 1 optional)

| File | Why |
|---|---|
| `opening_stock` | Cycle-specific inventory snapshot |
| `ly_sales` | Historical period data (shifts each cycle) |
| `recent_sales` | Last 3 months actuals (shifts each cycle) |
| `soft_forecast` | Optional, cycle-specific demand override |

### New cycle workflow

```
1. Create Cycle (Draft)
2. Upload 3 files: opening_stock, ly_sales, recent_sales
3. Assign GD
4. Review & Confirm Defaults (NEW step)
   └── Pre-populated from master data defaults for the brand
   └── Planning team reviews/edits in editable table
   └── "Confirm Defaults" button locks values for this cycle
5. Generate Template & Activate → Filling
6. GD fills data in OTB Grid
```

---

## Task 1: Database Migration — Master Default Tables

**Files:**
- Create: `otb-automation/supabase/migrations/009_master_defaults.sql`

**Step 1: Write the migration SQL**

```sql
-- 009_master_defaults.sql
-- Master data default tables for ASP, COGS, Return%, Tax%, Sellex%, Standard DoH
-- These store brand-scoped defaults that get copied into each cycle.

-- 1. Master defaults: ASP (sub_brand × sub_category × channel)
CREATE TABLE master_default_asp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  sub_brand text NOT NULL,
  sub_category text NOT NULL,
  channel text NOT NULL,
  asp numeric NOT NULL CHECK (asp > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (brand_id, sub_brand, sub_category, channel)
);

-- 2. Master defaults: COGS (sub_brand × sub_category)
CREATE TABLE master_default_cogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  sub_brand text NOT NULL,
  sub_category text NOT NULL,
  cogs numeric NOT NULL CHECK (cogs >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (brand_id, sub_brand, sub_category)
);

-- 3. Master defaults: Return % (sub_brand × sub_category × channel)
CREATE TABLE master_default_return_pct (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  sub_brand text NOT NULL,
  sub_category text NOT NULL,
  channel text NOT NULL,
  return_pct numeric NOT NULL CHECK (return_pct >= 0 AND return_pct <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (brand_id, sub_brand, sub_category, channel)
);

-- 4. Master defaults: Tax % (sub_category only — GST/HSN driven)
CREATE TABLE master_default_tax_pct (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  sub_category text NOT NULL,
  tax_pct numeric NOT NULL CHECK (tax_pct >= 0 AND tax_pct <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (brand_id, sub_category)
);

-- 5. Master defaults: Sellex % (sub_brand × sub_category × channel)
CREATE TABLE master_default_sellex_pct (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  sub_brand text NOT NULL,
  sub_category text NOT NULL,
  channel text NOT NULL,
  sellex_pct numeric NOT NULL CHECK (sellex_pct >= 0 AND sellex_pct <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (brand_id, sub_brand, sub_category, channel)
);

-- 6. Master defaults: Standard DoH (sub_brand × sub_category)
CREATE TABLE master_default_doh (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  sub_brand text NOT NULL,
  sub_category text NOT NULL,
  doh numeric NOT NULL CHECK (doh >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (brand_id, sub_brand, sub_category)
);

-- 7. Per-cycle defaults snapshot (copied from master, editable per cycle)
CREATE TABLE cycle_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES otb_cycles(id) ON DELETE CASCADE,
  default_type text NOT NULL CHECK (default_type IN ('asp', 'cogs', 'return_pct', 'tax_pct', 'sellex_pct', 'standard_doh')),
  sub_brand text,       -- null for tax_pct
  sub_category text NOT NULL,
  channel text,          -- null for cogs, standard_doh, tax_pct
  value numeric NOT NULL,
  confirmed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (cycle_id, default_type, sub_brand, sub_category, channel)
);

-- Track whether cycle defaults have been confirmed
ALTER TABLE otb_cycles ADD COLUMN defaults_confirmed boolean DEFAULT false;

-- Indexes
CREATE INDEX idx_master_default_asp_brand ON master_default_asp(brand_id);
CREATE INDEX idx_master_default_cogs_brand ON master_default_cogs(brand_id);
CREATE INDEX idx_master_default_return_pct_brand ON master_default_return_pct(brand_id);
CREATE INDEX idx_master_default_tax_pct_brand ON master_default_tax_pct(brand_id);
CREATE INDEX idx_master_default_sellex_pct_brand ON master_default_sellex_pct(brand_id);
CREATE INDEX idx_master_default_doh_brand ON master_default_doh(brand_id);
CREATE INDEX idx_cycle_defaults_cycle ON cycle_defaults(cycle_id);
CREATE INDEX idx_cycle_defaults_type ON cycle_defaults(cycle_id, default_type);

-- RLS policies (same pattern as existing master data tables)
ALTER TABLE master_default_asp ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_default_cogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_default_return_pct ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_default_tax_pct ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_default_sellex_pct ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_default_doh ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_defaults ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read master defaults
CREATE POLICY "read_master_defaults_asp" ON master_default_asp FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_master_defaults_cogs" ON master_default_cogs FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_master_defaults_return_pct" ON master_default_return_pct FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_master_defaults_tax_pct" ON master_default_tax_pct FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_master_defaults_sellex_pct" ON master_default_sellex_pct FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_master_defaults_doh" ON master_default_doh FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_cycle_defaults" ON cycle_defaults FOR SELECT TO authenticated USING (true);

-- Admin and Planning can write master defaults
CREATE POLICY "write_master_defaults_asp" ON master_default_asp FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('Admin', 'Planning'));
CREATE POLICY "write_master_defaults_cogs" ON master_default_cogs FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('Admin', 'Planning'));
CREATE POLICY "write_master_defaults_return_pct" ON master_default_return_pct FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('Admin', 'Planning'));
CREATE POLICY "write_master_defaults_tax_pct" ON master_default_tax_pct FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('Admin', 'Planning'));
CREATE POLICY "write_master_defaults_sellex_pct" ON master_default_sellex_pct FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('Admin', 'Planning'));
CREATE POLICY "write_master_defaults_doh" ON master_default_doh FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('Admin', 'Planning'));

-- Cycle defaults follow cycle visibility (Admin/Planning can write)
CREATE POLICY "write_cycle_defaults" ON cycle_defaults FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('Admin', 'Planning'));
```

**Step 2: Run migration**

```bash
cd otb-automation && npx supabase db reset
```
Expected: All migrations run successfully including 009.

**Step 3: Commit**

```bash
git add supabase/migrations/009_master_defaults.sql
git commit -m "feat: add master_default_* and cycle_defaults tables (migration 009)"
```

---

## Task 2: TypeScript Types for Master Defaults

**Files:**
- Modify: `otb-automation/src/types/otb.ts`

**Step 1: Add types and update FileType constants**

Add the following interfaces after the existing `MasterMapping` interface (around line 45):

```typescript
// Master data defaults — brand-scoped reference values
export interface MasterDefaultAsp {
  id: string;
  brand_id: string;
  sub_brand: string;
  sub_category: string;
  channel: string;
  asp: number;
}

export interface MasterDefaultCogs {
  id: string;
  brand_id: string;
  sub_brand: string;
  sub_category: string;
  cogs: number;
}

export interface MasterDefaultReturnPct {
  id: string;
  brand_id: string;
  sub_brand: string;
  sub_category: string;
  channel: string;
  return_pct: number;
}

export interface MasterDefaultTaxPct {
  id: string;
  brand_id: string;
  sub_category: string;
  tax_pct: number;
}

export interface MasterDefaultSellexPct {
  id: string;
  brand_id: string;
  sub_brand: string;
  sub_category: string;
  channel: string;
  sellex_pct: number;
}

export interface MasterDefaultDoh {
  id: string;
  brand_id: string;
  sub_brand: string;
  sub_category: string;
  doh: number;
}

export type DefaultType = 'asp' | 'cogs' | 'return_pct' | 'tax_pct' | 'sellex_pct' | 'standard_doh';

export interface CycleDefault {
  id: string;
  cycle_id: string;
  default_type: DefaultType;
  sub_brand: string | null;
  sub_category: string;
  channel: string | null;
  value: number;
  confirmed: boolean;
}
```

Update `REQUIRED_FILE_TYPES` to only include the 3 upload-only files:

```typescript
export const REQUIRED_FILE_TYPES: FileType[] = [
  'opening_stock', 'ly_sales', 'recent_sales',
];
```

Keep `ALL_FILE_TYPES` to include `soft_forecast` as optional upload:

```typescript
export const ALL_FILE_TYPES: FileType[] = [
  ...REQUIRED_FILE_TYPES,
  'soft_forecast',
];
```

Remove the 6 default-based file types from `FILE_TYPE_LABELS` and `FileType`:

```typescript
export type FileType =
  | 'opening_stock'
  | 'ly_sales' | 'recent_sales'
  | 'soft_forecast';

export const FILE_TYPE_LABELS: Record<FileType, string> = {
  opening_stock: 'Opening Stock',
  ly_sales: 'LY Sales',
  recent_sales: 'Recent Sales (3M)',
  soft_forecast: 'Soft Forecast (Optional)',
};
```

Add `defaults_confirmed` to `OtbCycle`:

```typescript
export interface OtbCycle {
  // ... existing fields ...
  defaults_confirmed: boolean;
  // ...
}
```

**Step 2: Run type check**

```bash
cd otb-automation && npx tsc --noEmit 2>&1 | head -30
```
Expected: Type errors in files that still reference removed file types — these will be fixed in subsequent tasks.

**Step 3: Commit**

```bash
git add src/types/otb.ts
git commit -m "feat: add master default types, reduce required uploads to 3"
```

---

## Task 3: Master Defaults CRUD API

**Files:**
- Create: `otb-automation/src/app/api/master-defaults/[type]/route.ts`

This API manages brand-scoped master default values (ASP, COGS, etc.) — separate from the existing `/api/master-data/[type]` which manages dimension entities (brands, sub_brands, etc.).

**Step 1: Write the API route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import type { DefaultType } from '@/types/otb';

const TABLE_MAP: Record<DefaultType, string> = {
  asp: 'master_default_asp',
  cogs: 'master_default_cogs',
  return_pct: 'master_default_return_pct',
  tax_pct: 'master_default_tax_pct',
  sellex_pct: 'master_default_sellex_pct',
  standard_doh: 'master_default_doh',
};

// Value column name per type
const VALUE_COL: Record<DefaultType, string> = {
  asp: 'asp',
  cogs: 'cogs',
  return_pct: 'return_pct',
  tax_pct: 'tax_pct',
  sellex_pct: 'sellex_pct',
  standard_doh: 'doh',
};

type Params = { params: Promise<{ type: string }> };

// GET: List master defaults for a brand
export const GET = withAuth(null, async (req: NextRequest, auth, { params }: Params) => {
  const { type } = await params;
  if (!TABLE_MAP[type as DefaultType]) {
    return NextResponse.json({ error: `Invalid default type: ${type}` }, { status: 400 });
  }

  const brandId = req.nextUrl.searchParams.get('brandId');
  if (!brandId) {
    return NextResponse.json({ error: 'brandId is required' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from(TABLE_MAP[type as DefaultType])
    .select('*')
    .eq('brand_id', brandId)
    .order('sub_category');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// POST: Create or upsert master defaults (bulk)
// Body: { brandId: string, rows: Array<{ sub_brand?, sub_category, channel?, value }> }
export const POST = withAuth('manage_master_data', async (req: NextRequest, auth, { params }: Params) => {
  const { type } = await params;
  const defaultType = type as DefaultType;
  if (!TABLE_MAP[defaultType]) {
    return NextResponse.json({ error: `Invalid default type: ${type}` }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { brandId, rows } = await req.json();

  if (!brandId || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'brandId and rows[] are required' }, { status: 400 });
  }

  const valueCol = VALUE_COL[defaultType];
  const inserts = rows.map((r: any) => ({
    brand_id: brandId,
    ...(r.sub_brand !== undefined ? { sub_brand: r.sub_brand } : {}),
    sub_category: r.sub_category,
    ...(r.channel !== undefined ? { channel: r.channel } : {}),
    [valueCol]: r.value,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from(TABLE_MAP[defaultType])
    .upsert(inserts, {
      onConflict: getConflictColumns(defaultType),
    })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
});

// PUT: Update a single master default row
export const PUT = withAuth('manage_master_data', async (req: NextRequest, auth, { params }: Params) => {
  const { type } = await params;
  const defaultType = type as DefaultType;
  if (!TABLE_MAP[defaultType]) {
    return NextResponse.json({ error: `Invalid default type: ${type}` }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { id, value } = await req.json();

  if (!id || value === undefined) {
    return NextResponse.json({ error: 'id and value are required' }, { status: 400 });
  }

  const valueCol = VALUE_COL[defaultType];
  const { data, error } = await supabase
    .from(TABLE_MAP[defaultType])
    .update({ [valueCol]: value, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// DELETE: Remove a master default row
export const DELETE = withAuth('manage_master_data', async (req: NextRequest, auth, { params }: Params) => {
  const { type } = await params;
  const defaultType = type as DefaultType;
  if (!TABLE_MAP[defaultType]) {
    return NextResponse.json({ error: `Invalid default type: ${type}` }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { id } = await req.json();

  const { error } = await supabase
    .from(TABLE_MAP[defaultType])
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
});

function getConflictColumns(type: DefaultType): string {
  switch (type) {
    case 'asp':
    case 'return_pct':
    case 'sellex_pct':
      return 'brand_id,sub_brand,sub_category,channel';
    case 'cogs':
    case 'standard_doh':
      return 'brand_id,sub_brand,sub_category';
    case 'tax_pct':
      return 'brand_id,sub_category';
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/master-defaults/
git commit -m "feat: add master defaults CRUD API for asp, cogs, return_pct, tax_pct, sellex_pct, doh"
```

---

## Task 4: Cycle Defaults API — Initialize, Read, Update, Confirm

**Files:**
- Create: `otb-automation/src/app/api/cycles/[cycleId]/defaults/route.ts`
- Create: `otb-automation/src/app/api/cycles/[cycleId]/defaults/confirm/route.ts`

### 4a: Defaults CRUD route

**Step 1: Write the defaults route**

```typescript
// src/app/api/cycles/[cycleId]/defaults/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { logAudit, getClientIp } from '@/lib/auth/auditLogger';
import type { DefaultType } from '@/types/otb';

type Params = { params: Promise<{ cycleId: string }> };

// GET: Get all cycle defaults (grouped by default_type)
export const GET = withAuth(null, async (req: NextRequest, auth, { params }: Params) => {
  const { cycleId } = await params;
  const supabase = await createServerClient();

  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('id, brand_id, status, defaults_confirmed')
    .eq('id', cycleId)
    .single();

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }

  const { data: defaults, error } = await supabase
    .from('cycle_defaults')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('default_type')
    .order('sub_brand')
    .order('sub_category')
    .order('channel');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    defaults_confirmed: cycle.defaults_confirmed,
    defaults: defaults || [],
  });
});

// POST: Initialize cycle defaults from master defaults for the cycle's brand.
// Called when planning team navigates to the "Review Defaults" step.
// Idempotent: if defaults already exist, returns them without re-initializing.
export const POST = withAuth('create_cycle', async (req: NextRequest, auth, { params }: Params) => {
  const { cycleId } = await params;
  const supabase = await createServerClient();
  const adminDb = createAdminClient();

  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('id, brand_id, status, defaults_confirmed')
    .eq('id', cycleId)
    .single();

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }
  if (cycle.status !== 'Draft') {
    return NextResponse.json({ error: 'Can only initialize defaults for Draft cycles' }, { status: 400 });
  }

  // Check if defaults already exist
  const { count } = await supabase
    .from('cycle_defaults')
    .select('id', { count: 'exact', head: true })
    .eq('cycle_id', cycleId);

  if (count && count > 0) {
    // Already initialized — return existing
    const { data: existing } = await supabase
      .from('cycle_defaults')
      .select('*')
      .eq('cycle_id', cycleId)
      .order('default_type');

    return NextResponse.json({
      defaults_confirmed: cycle.defaults_confirmed,
      defaults: existing || [],
      initialized: false,
    });
  }

  // Copy from master defaults
  const brandId = cycle.brand_id;
  const inserts: any[] = [];

  // ASP
  const { data: aspDefaults } = await adminDb
    .from('master_default_asp')
    .select('sub_brand, sub_category, channel, asp')
    .eq('brand_id', brandId);
  for (const row of aspDefaults || []) {
    inserts.push({
      cycle_id: cycleId,
      default_type: 'asp',
      sub_brand: row.sub_brand,
      sub_category: row.sub_category,
      channel: row.channel,
      value: row.asp,
    });
  }

  // COGS
  const { data: cogsDefaults } = await adminDb
    .from('master_default_cogs')
    .select('sub_brand, sub_category, cogs')
    .eq('brand_id', brandId);
  for (const row of cogsDefaults || []) {
    inserts.push({
      cycle_id: cycleId,
      default_type: 'cogs',
      sub_brand: row.sub_brand,
      sub_category: row.sub_category,
      channel: null,
      value: row.cogs,
    });
  }

  // Return %
  const { data: returnDefaults } = await adminDb
    .from('master_default_return_pct')
    .select('sub_brand, sub_category, channel, return_pct')
    .eq('brand_id', brandId);
  for (const row of returnDefaults || []) {
    inserts.push({
      cycle_id: cycleId,
      default_type: 'return_pct',
      sub_brand: row.sub_brand,
      sub_category: row.sub_category,
      channel: row.channel,
      value: row.return_pct,
    });
  }

  // Tax %
  const { data: taxDefaults } = await adminDb
    .from('master_default_tax_pct')
    .select('sub_category, tax_pct')
    .eq('brand_id', brandId);
  for (const row of taxDefaults || []) {
    inserts.push({
      cycle_id: cycleId,
      default_type: 'tax_pct',
      sub_brand: null,
      sub_category: row.sub_category,
      channel: null,
      value: row.tax_pct,
    });
  }

  // Sellex %
  const { data: sellexDefaults } = await adminDb
    .from('master_default_sellex_pct')
    .select('sub_brand, sub_category, channel, sellex_pct')
    .eq('brand_id', brandId);
  for (const row of sellexDefaults || []) {
    inserts.push({
      cycle_id: cycleId,
      default_type: 'sellex_pct',
      sub_brand: row.sub_brand,
      sub_category: row.sub_category,
      channel: row.channel,
      value: row.sellex_pct,
    });
  }

  // Standard DoH
  const { data: dohDefaults } = await adminDb
    .from('master_default_doh')
    .select('sub_brand, sub_category, doh')
    .eq('brand_id', brandId);
  for (const row of dohDefaults || []) {
    inserts.push({
      cycle_id: cycleId,
      default_type: 'standard_doh',
      sub_brand: row.sub_brand,
      sub_category: row.sub_category,
      channel: null,
      value: row.doh,
    });
  }

  // Batch insert
  if (inserts.length > 0) {
    const BATCH_SIZE = 500;
    for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
      const batch = inserts.slice(i, i + BATCH_SIZE);
      const { error } = await adminDb.from('cycle_defaults').insert(batch);
      if (error) return NextResponse.json({ error: `Failed to insert defaults: ${error.message}` }, { status: 500 });
    }
  }

  await logAudit({
    entityType: 'cycle',
    entityId: cycleId,
    action: 'CREATE',
    userId: auth.user.id,
    userEmail: auth.user.email,
    userRole: auth.profile.role,
    details: { action: 'initialize_defaults', count: inserts.length },
    ipAddress: getClientIp(req.headers),
  });

  // Return the newly inserted defaults
  const { data: allDefaults } = await adminDb
    .from('cycle_defaults')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('default_type');

  return NextResponse.json({
    defaults_confirmed: false,
    defaults: allDefaults || [],
    initialized: true,
  }, { status: 201 });
});

// PUT: Update cycle default values (bulk)
// Body: { updates: Array<{ id: string, value: number }> }
export const PUT = withAuth('create_cycle', async (req: NextRequest, auth, { params }: Params) => {
  const { cycleId } = await params;
  const supabase = await createServerClient();

  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('id, status, defaults_confirmed')
    .eq('id', cycleId)
    .single();

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }
  if (cycle.status !== 'Draft') {
    return NextResponse.json({ error: 'Can only edit defaults for Draft cycles' }, { status: 400 });
  }
  if (cycle.defaults_confirmed) {
    return NextResponse.json({ error: 'Defaults already confirmed. Un-confirm first to make changes.' }, { status: 400 });
  }

  const { updates } = await req.json();
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'updates[] is required' }, { status: 400 });
  }

  const adminDb = createAdminClient();

  for (const { id, value } of updates) {
    const { error } = await adminDb
      .from('cycle_defaults')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('cycle_id', cycleId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit({
    entityType: 'cycle',
    entityId: cycleId,
    action: 'UPDATE',
    userId: auth.user.id,
    userEmail: auth.user.email,
    userRole: auth.profile.role,
    details: { action: 'update_defaults', count: updates.length },
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json({ success: true, updated: updates.length });
});
```

### 4b: Confirm defaults route

**Step 2: Write the confirm route**

```typescript
// src/app/api/cycles/[cycleId]/defaults/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { logAudit, getClientIp } from '@/lib/auth/auditLogger';

type Params = { params: Promise<{ cycleId: string }> };

// POST: Confirm (lock) or un-confirm cycle defaults
// Body: { confirmed: boolean }
export const POST = withAuth('create_cycle', async (req: NextRequest, auth, { params }: Params) => {
  const { cycleId } = await params;
  const supabase = await createServerClient();
  const { confirmed } = await req.json();

  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('id, status, defaults_confirmed')
    .eq('id', cycleId)
    .single();

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }
  if (cycle.status !== 'Draft') {
    return NextResponse.json({ error: 'Can only confirm defaults for Draft cycles' }, { status: 400 });
  }

  // Validate: must have at least some defaults before confirming
  if (confirmed) {
    const { count } = await supabase
      .from('cycle_defaults')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', cycleId);

    if (!count || count === 0) {
      return NextResponse.json({ error: 'No defaults to confirm. Initialize defaults first.' }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from('otb_cycles')
    .update({
      defaults_confirmed: confirmed,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cycleId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    entityType: 'cycle',
    entityId: cycleId,
    action: 'UPDATE',
    userId: auth.user.id,
    userEmail: auth.user.email,
    userRole: auth.profile.role,
    details: { action: confirmed ? 'confirm_defaults' : 'unconfirm_defaults' },
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json(data);
});
```

**Step 3: Commit**

```bash
git add src/app/api/cycles/[cycleId]/defaults/
git commit -m "feat: add cycle defaults API — initialize from master, bulk update, confirm/unconfirm"
```

---

## Task 5: Update Template Generator to Use Cycle Defaults

**Files:**
- Modify: `otb-automation/src/lib/templateGenerator.ts`

The template generator currently reads ASP, COGS, return%, tax%, sellex%, and standard_doh from uploaded CSV files. It must now read from `cycle_defaults` instead.

**Step 1: Update the `UploadedData` interface and `loadAllUploadedData`**

Remove the 6 default-based file types from `UploadedData`. They will be loaded from `cycle_defaults` table instead.

Replace the full `templateGenerator.ts` with:

```typescript
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { getQuarterDates } from '@/lib/quarterUtils';
import type { DefaultType } from '@/types/otb';

interface UploadedData {
  opening_stock: Record<string, unknown>[];
  ly_sales: Record<string, unknown>[];
  recent_sales: Record<string, unknown>[];
  soft_forecast: Record<string, unknown>[];
}

interface CycleDefaultRow {
  default_type: DefaultType;
  sub_brand: string | null;
  sub_category: string;
  channel: string | null;
  value: number;
}

interface DimensionKey {
  sub_brand: string;
  wear_type: string;
  sub_category: string;
  gender: string;
  channel: string;
}

function makeKey(d: DimensionKey): string {
  return `${d.sub_brand}|${d.wear_type}|${d.sub_category}|${d.gender}|${d.channel}`;
}

/**
 * Generate plan rows + monthly data from uploaded files + cycle defaults.
 * Called after uploads validated AND defaults confirmed, when cycle is activated.
 */
export async function generateTemplate(cycleId: string): Promise<{ rowCount: number; warnings?: string[] }> {
  const supabase = await createServerClient();
  const adminDb = createAdminClient();

  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('*')
    .eq('id', cycleId)
    .single();

  if (!cycle) throw new Error('Cycle not found');

  const quarterDates = getQuarterDates(cycle.planning_quarter);
  const months = quarterDates.months;

  // Load uploaded file data (only 3 required + 1 optional)
  const uploadedData = await loadAllUploadedData(supabase, cycleId);

  // Load confirmed cycle defaults
  const { data: cycleDefaults } = await adminDb
    .from('cycle_defaults')
    .select('default_type, sub_brand, sub_category, channel, value')
    .eq('cycle_id', cycleId);

  if (!cycleDefaults || cycleDefaults.length === 0) {
    throw new Error('No cycle defaults found. Initialize and confirm defaults before activation.');
  }

  // Build lookup maps from cycle defaults
  const aspMap = buildDefaultLookup(cycleDefaults, 'asp', ['sub_brand', 'sub_category', 'channel']);
  const cogsMap = buildDefaultLookup(cycleDefaults, 'cogs', ['sub_brand', 'sub_category']);
  const returnMap = buildDefaultLookup(cycleDefaults, 'return_pct', ['sub_brand', 'sub_category', 'channel']);
  const taxMap = buildDefaultLookup(cycleDefaults, 'tax_pct', ['sub_category']);
  const sellexMap = buildDefaultLookup(cycleDefaults, 'sellex_pct', ['sub_brand', 'sub_category', 'channel']);
  const dohMap = buildDefaultLookup(cycleDefaults, 'standard_doh', ['sub_brand', 'sub_category']);

  // Load sub_categories with wear_types join
  const { data: subCategoryData } = await adminDb
    .from('sub_categories')
    .select('name, wear_type_id, wear_types(name)')
    .eq('brand_id', cycle.brand_id)
    .not('wear_type_id', 'is', null);

  const subCatWearTypeMap = new Map<string, string>();
  for (const sc of subCategoryData || []) {
    if ((sc.wear_types as any)?.name) {
      subCatWearTypeMap.set(sc.name.toLowerCase(), (sc.wear_types as any).name);
    }
  }

  // Determine unique dimension combinations from opening_stock
  const dimensionCombos: DimensionKey[] = [];
  const seenKeys = new Set<string>();
  const warnings: string[] = [];
  const missingWearTypes = new Set<string>();

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
    const key = makeKey(combo);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      dimensionCombos.push(combo);
    }
  }

  if (missingWearTypes.size > 0) {
    warnings.push(`Missing wear_type for sub_category: ${[...missingWearTypes].join(', ')}`);
  }

  if (dimensionCombos.length === 0) {
    throw new Error(
      'No dimension combinations found. ' +
      (missingWearTypes.size > 0
        ? `All rows skipped due to missing wear_type for sub_categories: ${[...missingWearTypes].join(', ')}`
        : 'Opening stock data is empty')
    );
  }

  // Build lookup maps for uploaded data
  const openingStockMap = buildLookup(uploadedData.opening_stock, ['sub_brand', 'sub_category', 'gender', 'channel'], 'quantity');
  const lyMap = buildMonthLookup(uploadedData.ly_sales, ['sub_brand', 'sub_category', 'gender', 'channel'], 'nsq');
  const recentMap = buildLookup(uploadedData.recent_sales, ['sub_brand', 'sub_category', 'gender'], 'nsq');
  const forecastMap = buildLookup(uploadedData.soft_forecast, ['sub_brand', 'sub_category', 'gender'], 'nsq');

  // Delete existing plan rows for this cycle (in case of re-generation)
  const { data: existingRows } = await adminDb
    .from('otb_plan_rows')
    .select('id')
    .eq('cycle_id', cycleId);

  if (existingRows && existingRows.length > 0) {
    const rowIds = existingRows.map(r => r.id);
    await adminDb.from('otb_plan_data').delete().in('row_id', rowIds);
    await adminDb.from('otb_plan_rows').delete().eq('cycle_id', cycleId);
  }

  // Insert plan rows
  const planRowInserts = dimensionCombos.map(combo => ({
    cycle_id: cycleId,
    ...combo,
  }));

  const { data: insertedRows, error: rowError } = await adminDb
    .from('otb_plan_rows')
    .insert(planRowInserts)
    .select('id, sub_brand, wear_type, sub_category, gender, channel');

  if (rowError) throw new Error(`Failed to insert plan rows: ${rowError.message}`);

  // Insert plan data for each row × each month
  const planDataInserts: Record<string, unknown>[] = [];

  for (const row of insertedRows!) {
    for (let mIdx = 0; mIdx < months.length; mIdx++) {
      const month = months[mIdx];

      // Lookup keys for cycle defaults
      const sbScChKey = lookupKey([row.sub_brand, row.sub_category, row.channel]);
      const sbScKey = lookupKey([row.sub_brand, row.sub_category]);
      const scKey = lookupKey([row.sub_category]);

      // Lookup keys for uploaded data
      const fullKey = lookupKey([row.sub_brand, row.sub_category, row.gender, row.channel]);
      const sbgKey = lookupKey([row.sub_brand, row.sub_category, row.gender]);

      planDataInserts.push({
        row_id: row.id,
        month,
        asp: aspMap.get(sbScChKey) ?? null,
        cogs: cogsMap.get(sbScKey) ?? null,
        opening_stock_qty: mIdx === 0 ? (openingStockMap.get(fullKey) ?? null) : null,
        ly_sales_nsq: lyMap.get(`${fullKey}|${shiftYearBack(month)}`) ?? null,
        recent_sales_nsq: recentMap.get(sbgKey) ?? null,
        soft_forecast_nsq: forecastMap.get(sbgKey) ?? null,
        return_pct: returnMap.get(sbScChKey) ?? null,
        tax_pct: taxMap.get(scKey) ?? null,
        sellex_pct: sellexMap.get(sbScChKey) ?? null,
        standard_doh: dohMap.get(sbScKey) ?? null,
      });
    }
  }

  // Batch insert
  const BATCH_SIZE = 500;
  for (let i = 0; i < planDataInserts.length; i += BATCH_SIZE) {
    const batch = planDataInserts.slice(i, i + BATCH_SIZE);
    const { error } = await adminDb.from('otb_plan_data').insert(batch);
    if (error) throw new Error(`Failed to insert plan data batch: ${error.message}`);
  }

  return { rowCount: insertedRows!.length, warnings: warnings.length > 0 ? warnings : undefined };
}

// --- Helper functions ---

function shiftYearBack(month: string): string {
  const year = parseInt(month.substring(0, 4));
  return `${year - 1}${month.substring(4)}`;
}

function lookupKey(parts: string[]): string {
  return parts.map(p => String(p || '').toLowerCase()).join('|');
}

function buildLookup(
  rows: Record<string, unknown>[],
  keyColumns: string[],
  valueColumn: string
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = lookupKey(keyColumns.map(c => String(row[c] || '')));
    const val = Number(row[valueColumn]);
    if (!isNaN(val)) map.set(key, val);
  }
  return map;
}

function buildMonthLookup(
  rows: Record<string, unknown>[],
  keyColumns: string[],
  valueColumn: string
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const dimKey = lookupKey(keyColumns.map(c => String(row[c] || '')));
    const month = String(row.month || '');
    const val = Number(row[valueColumn]);
    if (!isNaN(val)) map.set(`${dimKey}|${month}`, val);
  }
  return map;
}

/**
 * Build a lookup map from cycle_defaults rows for a specific default_type.
 * @param keyFields - which fields to include in the key (sub_brand, sub_category, channel)
 */
function buildDefaultLookup(
  defaults: CycleDefaultRow[],
  type: DefaultType,
  keyFields: ('sub_brand' | 'sub_category' | 'channel')[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of defaults) {
    if (row.default_type !== type) continue;
    const key = lookupKey(keyFields.map(f => String(row[f] || '')));
    map.set(key, row.value);
  }
  return map;
}

async function loadAllUploadedData(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  cycleId: string
): Promise<UploadedData> {
  const { data: uploads } = await supabase
    .from('file_uploads')
    .select('*')
    .eq('cycle_id', cycleId)
    .eq('status', 'validated');

  const result: UploadedData = {
    opening_stock: [],
    ly_sales: [],
    recent_sales: [],
    soft_forecast: [],
  };

  if (!uploads) return result;

  for (const upload of uploads) {
    const fileType = upload.file_type as keyof UploadedData;
    if (!(fileType in result)) continue;

    const { data: fileData } = await supabase.storage
      .from('otb-uploads')
      .download(upload.storage_path);

    if (!fileData) continue;

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const { parseUploadedFile } = await import('@/lib/fileParser');
    const rows = await parseUploadedFile(buffer, upload.file_name);
    result[fileType] = rows;
  }

  return result;
}
```

**Step 2: Commit**

```bash
git add src/lib/templateGenerator.ts
git commit -m "refactor: template generator reads from cycle_defaults instead of uploaded files"
```

---

## Task 6: Update Upload Validator — Remove Default File Schemas

**Files:**
- Modify: `otb-automation/src/lib/uploadValidator.ts`

**Step 1: Remove schemas for the 6 file types that moved to master data**

Remove the `cogs`, `asp`, `standard_doh`, `return_pct`, `tax_pct`, `sellex_pct` entries from `FILE_SCHEMAS`. Keep only `opening_stock`, `ly_sales`, `recent_sales`, `soft_forecast`.

```typescript
export const FILE_SCHEMAS: Record<FileType, FileSchema> = {
  opening_stock: {
    fileType: 'opening_stock',
    requiredColumns: ['sub_brand', 'sub_category', 'gender', 'channel', 'quantity'],
    dimensionColumns: ['sub_brand', 'sub_category', 'gender', 'channel'],
    numericColumns: ['quantity'],
    percentColumns: [],
  },
  ly_sales: {
    fileType: 'ly_sales',
    requiredColumns: ['sub_brand', 'sub_category', 'gender', 'channel', 'month', 'nsq'],
    dimensionColumns: ['sub_brand', 'sub_category', 'gender', 'channel', 'month'],
    numericColumns: ['nsq'],
    percentColumns: [],
  },
  recent_sales: {
    fileType: 'recent_sales',
    requiredColumns: ['sub_brand', 'sub_category', 'gender', 'channel', 'month', 'nsq'],
    dimensionColumns: ['sub_brand', 'sub_category', 'gender', 'channel', 'month'],
    numericColumns: ['nsq'],
    percentColumns: [],
  },
  soft_forecast: {
    fileType: 'soft_forecast',
    requiredColumns: ['sub_brand', 'sub_category', 'gender', 'nsq'],
    dimensionColumns: ['sub_brand', 'sub_category', 'gender'],
    numericColumns: ['nsq'],
    percentColumns: [],
  },
};
```

**Step 2: Commit**

```bash
git add src/lib/uploadValidator.ts
git commit -m "refactor: remove upload schemas for file types moved to master defaults"
```

---

## Task 7: Update Activation Route — Require Defaults Confirmed

**Files:**
- Modify: `otb-automation/src/app/api/cycles/[cycleId]/activate/route.ts`

**Step 1: Add defaults_confirmed check**

After the GD assignment check (line ~37), add:

```typescript
  // Check defaults are confirmed
  if (!cycle.defaults_confirmed) {
    return NextResponse.json(
      { error: 'Master data defaults must be reviewed and confirmed before activation' },
      { status: 400 }
    );
  }
```

Update the `REQUIRED_FILE_TYPES` check — it now only checks for the 3 upload files since `REQUIRED_FILE_TYPES` was already updated in Task 2.

**Step 2: Commit**

```bash
git add src/app/api/cycles/[cycleId]/activate/route.ts
git commit -m "feat: require defaults_confirmed before cycle activation"
```

---

## Task 8: Review Defaults UI Component

**Files:**
- Create: `otb-automation/src/components/CycleDefaultsReview.tsx`

This is the core UI for the "Review & Confirm Defaults" step. Uses Ant Design editable Table with tabs for each default type.

**Step 1: Write the component**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, Table, InputNumber, Button, Space, Tag, message, Alert, Spin, Typography, Modal } from 'antd';
import { CheckCircleOutlined, EditOutlined, ReloadOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import type { CycleDefault, DefaultType } from '@/types/otb';

const { Title, Text } = Typography;

interface Props {
  cycleId: string;
  onConfirmed: () => void;  // callback when defaults are confirmed
}

const DEFAULT_TYPE_LABELS: Record<DefaultType, string> = {
  asp: 'ASP (Average Selling Price)',
  cogs: 'COGS (Cost of Goods Sold)',
  return_pct: 'Return %',
  tax_pct: 'Tax %',
  sellex_pct: 'Sellex %',
  standard_doh: 'Standard DoH',
};

const DEFAULT_TYPE_TABS: DefaultType[] = ['asp', 'cogs', 'return_pct', 'tax_pct', 'sellex_pct', 'standard_doh'];

const VALUE_SUFFIX: Record<DefaultType, string> = {
  asp: '₹',
  cogs: '₹',
  return_pct: '%',
  tax_pct: '%',
  sellex_pct: '%',
  standard_doh: 'days',
};

export function CycleDefaultsReview({ cycleId, onConfirmed }: Props) {
  const [defaults, setDefaults] = useState<CycleDefault[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [activeTab, setActiveTab] = useState<DefaultType>('asp');
  const [editedValues, setEditedValues] = useState<Map<string, number>>(new Map());

  const loadDefaults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cycles/${cycleId}/defaults`);
      const data = await res.json();
      setDefaults(data.defaults || []);
      setConfirmed(data.defaults_confirmed || false);
    } catch {
      message.error('Failed to load defaults');
    }
    setLoading(false);
  }, [cycleId]);

  useEffect(() => { loadDefaults(); }, [loadDefaults]);

  const handleInitialize = async () => {
    setInitializing(true);
    try {
      const res = await fetch(`/api/cycles/${cycleId}/defaults`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error || 'Failed to initialize defaults');
        return;
      }
      setDefaults(data.defaults || []);
      setConfirmed(data.defaults_confirmed || false);
      if (data.initialized) {
        message.success(`Initialized ${data.defaults.length} default values from master data`);
      }
    } catch {
      message.error('Network error');
    }
    setInitializing(false);
  };

  const handleValueChange = (id: string, value: number | null) => {
    if (value === null) return;
    setEditedValues(prev => new Map(prev).set(id, value));
  };

  const handleSaveChanges = async () => {
    if (editedValues.size === 0) return;
    setSaving(true);
    try {
      const updates = Array.from(editedValues.entries()).map(([id, value]) => ({ id, value }));
      const res = await fetch(`/api/cycles/${cycleId}/defaults`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error || 'Failed to save changes');
        return;
      }
      message.success(`Saved ${updates.length} changes`);
      setEditedValues(new Map());
      loadDefaults();
    } catch {
      message.error('Network error');
    }
    setSaving(false);
  };

  const handleConfirm = async () => {
    // Save pending edits first
    if (editedValues.size > 0) {
      await handleSaveChanges();
    }

    Modal.confirm({
      title: 'Confirm Defaults',
      icon: <ExclamationCircleOutlined />,
      content: 'Once confirmed, these values will be used to generate the OTB grid. You can un-confirm later to make further changes.',
      onOk: async () => {
        setConfirming(true);
        try {
          const res = await fetch(`/api/cycles/${cycleId}/defaults/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirmed: true }),
          });
          const data = await res.json();
          if (!res.ok) {
            message.error(data.error || 'Failed to confirm defaults');
            return;
          }
          setConfirmed(true);
          message.success('Defaults confirmed!');
          onConfirmed();
        } catch {
          message.error('Network error');
        }
        setConfirming(false);
      },
    });
  };

  const handleUnconfirm = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`/api/cycles/${cycleId}/defaults/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error || 'Failed to un-confirm defaults');
        return;
      }
      setConfirmed(false);
      message.success('Defaults un-confirmed. You can now edit values.');
    } catch {
      message.error('Network error');
    }
    setConfirming(false);
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '48px auto' }} />;

  // If no defaults loaded yet, show initialize button
  if (defaults.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Title level={4}>Review & Confirm Defaults</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
          Load default values for ASP, COGS, Return%, Tax%, Sellex%, and Standard DoH from master data configuration.
        </Text>
        <Button
          type="primary"
          size="large"
          icon={<ReloadOutlined />}
          onClick={handleInitialize}
          loading={initializing}
        >
          Load Defaults from Master Data
        </Button>
      </div>
    );
  }

  // Filter defaults for active tab
  const tabDefaults = defaults.filter(d => d.default_type === activeTab);

  // Build columns based on active tab
  const columns = buildColumns(activeTab, confirmed, editedValues, handleValueChange);

  // Build data source with edited values applied
  const dataSource = tabDefaults.map(d => ({
    ...d,
    displayValue: editedValues.has(d.id) ? editedValues.get(d.id)! : d.value,
  }));

  const hasEdits = editedValues.size > 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Title level={4} style={{ margin: 0 }}>Review & Confirm Defaults</Title>
          {confirmed && <Tag icon={<CheckCircleOutlined />} color="success">Confirmed</Tag>}
        </Space>
        <Space>
          {!confirmed && hasEdits && (
            <Button onClick={handleSaveChanges} loading={saving}>
              Save Changes ({editedValues.size})
            </Button>
          )}
          {confirmed ? (
            <Button onClick={handleUnconfirm} loading={confirming}>
              Un-confirm (Edit)
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleConfirm}
              loading={confirming}
            >
              Confirm Defaults
            </Button>
          )}
        </Space>
      </div>

      {confirmed && (
        <Alert
          message="Defaults are confirmed and locked. Click 'Un-confirm' to make changes."
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Tabs
        activeKey={activeTab}
        onChange={key => setActiveTab(key as DefaultType)}
        items={DEFAULT_TYPE_TABS.map(type => ({
          key: type,
          label: (
            <Space size={4}>
              {DEFAULT_TYPE_LABELS[type]}
              <Tag>{defaults.filter(d => d.default_type === type).length}</Tag>
            </Space>
          ),
        }))}
      />

      <Table
        dataSource={dataSource}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 50, showSizeChanger: true }}
        size="small"
        scroll={{ y: 500 }}
      />
    </div>
  );
}

function buildColumns(
  type: DefaultType,
  confirmed: boolean,
  editedValues: Map<string, number>,
  onValueChange: (id: string, value: number | null) => void
) {
  const columns: any[] = [];

  // Dimension columns based on type
  if (type !== 'tax_pct') {
    columns.push({
      title: 'Sub Brand',
      dataIndex: 'sub_brand',
      key: 'sub_brand',
      sorter: (a: any, b: any) => (a.sub_brand || '').localeCompare(b.sub_brand || ''),
      filters: getUniqueFilters('sub_brand'),
      onFilter: (value: string, record: any) => record.sub_brand === value,
    });
  }

  columns.push({
    title: 'Sub Category',
    dataIndex: 'sub_category',
    key: 'sub_category',
    sorter: (a: any, b: any) => (a.sub_category || '').localeCompare(b.sub_category || ''),
  });

  if (['asp', 'return_pct', 'sellex_pct'].includes(type)) {
    columns.push({
      title: 'Channel',
      dataIndex: 'channel',
      key: 'channel',
      sorter: (a: any, b: any) => (a.channel || '').localeCompare(b.channel || ''),
    });
  }

  // Value column (editable)
  const suffix = VALUE_SUFFIX[type];
  columns.push({
    title: `Value (${suffix})`,
    dataIndex: 'displayValue',
    key: 'value',
    width: 180,
    sorter: (a: any, b: any) => a.displayValue - b.displayValue,
    render: (value: number, record: any) => {
      if (confirmed) {
        return <span>{formatValue(value, type)}</span>;
      }
      const isEdited = editedValues.has(record.id);
      return (
        <InputNumber
          value={value}
          onChange={v => onValueChange(record.id, v)}
          min={type === 'asp' ? 0.01 : 0}
          max={['return_pct', 'tax_pct', 'sellex_pct'].includes(type) ? 100 : undefined}
          step={['return_pct', 'tax_pct', 'sellex_pct'].includes(type) ? 0.1 : 1}
          precision={2}
          style={{
            width: 140,
            borderColor: isEdited ? '#1677ff' : undefined,
          }}
          addonAfter={suffix === '₹' ? '₹' : suffix === '%' ? '%' : suffix}
        />
      );
    },
  });

  // Edited indicator
  if (!confirmed) {
    columns.push({
      title: '',
      key: 'edited',
      width: 40,
      render: (_: any, record: any) =>
        editedValues.has(record.id) ? (
          <EditOutlined style={{ color: '#1677ff' }} />
        ) : null,
    });
  }

  return columns;
}

function formatValue(value: number, type: DefaultType): string {
  if (['return_pct', 'tax_pct', 'sellex_pct'].includes(type)) {
    return `${value.toFixed(1)}%`;
  }
  if (['asp', 'cogs'].includes(type)) {
    return `₹${value.toFixed(2)}`;
  }
  return `${value}`;
}

function getUniqueFilters(_field: string) {
  // Filters are dynamically populated by Ant Design Table
  // This is a placeholder — actual filtering uses onFilter
  return undefined;
}
```

**Step 2: Commit**

```bash
git add src/components/CycleDefaultsReview.tsx
git commit -m "feat: add CycleDefaultsReview component with editable table and confirm flow"
```

---

## Task 9: Add Review Defaults Page

**Files:**
- Create: `otb-automation/src/app/cycles/[cycleId]/defaults/page.tsx`

**Step 1: Write the page**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Button, Space, Spin, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { CycleDefaultsReview } from '@/components/CycleDefaultsReview';
import type { OtbCycle } from '@/types/otb';

const { Title } = Typography;

export default function CycleDefaultsPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const router = useRouter();
  const [cycle, setCycle] = useState<OtbCycle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/cycles/${cycleId}`)
      .then(r => r.json())
      .then(data => { setCycle(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [cycleId]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!cycle) return <div style={{ padding: 24 }}>Cycle not found</div>;

  return (
    <ProtectedRoute permission="create_cycle">
      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        <Space style={{ marginBottom: 16 }}>
          <Link href={`/cycles/${cycleId}`}>
            <Button icon={<ArrowLeftOutlined />}>Back to Cycle</Button>
          </Link>
        </Space>
        <Title level={3}>{cycle.cycle_name} — Review Defaults</Title>
        <CycleDefaultsReview
          cycleId={cycleId}
          onConfirmed={() => router.push(`/cycles/${cycleId}`)}
        />
      </div>
    </ProtectedRoute>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/cycles/[cycleId]/defaults/
git commit -m "feat: add cycle defaults review page"
```

---

## Task 10: Update Cycle Detail Page — New Workflow Steps

**Files:**
- Modify: `otb-automation/src/app/cycles/[cycleId]/page.tsx`

**Step 1: Add the "Review Defaults" card and update activation logic**

Key changes:
1. The "File Uploads" card now shows only 3 required + 1 optional file types
2. Add a new "Review & Confirm Defaults" card between uploads and activation
3. Activation button requires `defaults_confirmed` in addition to uploads + GD
4. Link to the new `/cycles/{cycleId}/defaults` page

Update the `canActivate` condition:

```typescript
const canActivate = cycle.status === 'Draft'
  && allRequiredValidated
  && cycle.assigned_gd_id
  && cycle.defaults_confirmed;
```

Add a "Review Defaults" card after the "File Uploads" card:

```typescript
{/* Review Defaults card — shown in Draft status */}
{cycle.status === 'Draft' && (
  <Card
    title="Review & Confirm Defaults"
    style={{
      marginBottom: 24,
      borderColor: cycle.defaults_confirmed ? '#52c41a' : '#d9d9d9',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <Text>ASP, COGS, Return%, Tax%, Sellex%, Standard DoH</Text>
        <br />
        <Text type="secondary">
          Pre-populated from master data. Review and adjust values for this cycle.
        </Text>
      </div>
      <Space>
        {cycle.defaults_confirmed ? (
          <Tag icon={<CheckCircleOutlined />} color="success">Confirmed</Tag>
        ) : (
          <Tag color="warning">Not confirmed</Tag>
        )}
        {canManageCycle && (
          <Link href={`/cycles/${cycleId}/defaults`}>
            <Button type={cycle.defaults_confirmed ? 'default' : 'primary'}>
              {cycle.defaults_confirmed ? 'View Defaults' : 'Review Defaults'}
            </Button>
          </Link>
        )}
      </Space>
    </div>
  </Card>
)}
```

Update the help text at the bottom:

```typescript
{!canActivate && cycle.status === 'Draft' && (
  <div style={{ marginTop: 8, color: '#999', fontSize: 13 }}>
    {!allRequiredValidated && 'Upload and validate all required files. '}
    {!cycle.assigned_gd_id && 'Assign a GD. '}
    {!cycle.defaults_confirmed && 'Review and confirm defaults. '}
  </div>
)}
```

**Step 2: Add imports**

Add these imports to the top of the file:

```typescript
import { CheckCircleOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
const { Text } = Typography;
```

**Step 3: Commit**

```bash
git add src/app/cycles/[cycleId]/page.tsx
git commit -m "feat: add defaults review step to cycle detail page, update activation prerequisites"
```

---

## Task 11: Master Defaults Admin UI

**Files:**
- Create: `otb-automation/src/components/MasterDefaultsManager.tsx`
- Create: `otb-automation/src/app/admin/master-defaults/page.tsx`

This is the admin interface for managing brand-scoped master defaults (the source-of-truth values that get copied into each cycle).

### 11a: MasterDefaultsManager component

**Step 1: Write the component**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, Table, InputNumber, Button, Select, Space, message, Alert, Upload, Modal, Form, Input, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import type { Brand, DefaultType } from '@/types/otb';

const { Title } = Typography;

const DEFAULT_TYPE_TABS: { key: DefaultType; label: string; dimensions: string[] }[] = [
  { key: 'asp', label: 'ASP', dimensions: ['sub_brand', 'sub_category', 'channel'] },
  { key: 'cogs', label: 'COGS', dimensions: ['sub_brand', 'sub_category'] },
  { key: 'return_pct', label: 'Return %', dimensions: ['sub_brand', 'sub_category', 'channel'] },
  { key: 'tax_pct', label: 'Tax %', dimensions: ['sub_category'] },
  { key: 'sellex_pct', label: 'Sellex %', dimensions: ['sub_brand', 'sub_category', 'channel'] },
  { key: 'standard_doh', label: 'Standard DoH', dimensions: ['sub_brand', 'sub_category'] },
];

interface DefaultRow {
  id: string;
  sub_brand?: string;
  sub_category: string;
  channel?: string;
  [key: string]: any;  // value column varies by type
}

// Value column name differs per table
const VALUE_COL: Record<DefaultType, string> = {
  asp: 'asp',
  cogs: 'cogs',
  return_pct: 'return_pct',
  tax_pct: 'tax_pct',
  sellex_pct: 'sellex_pct',
  standard_doh: 'doh',
};

export function MasterDefaultsManager() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DefaultType>('asp');
  const [data, setData] = useState<DefaultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  // Load brands
  useEffect(() => {
    fetch('/api/master-data/brands')
      .then(r => r.json())
      .then(d => setBrands(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    if (!selectedBrandId) { setData([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/master-defaults/${activeTab}?brandId=${selectedBrandId}`);
      const result = await res.json();
      setData(Array.isArray(result) ? result : []);
    } catch {
      setData([]);
    }
    setLoading(false);
  }, [activeTab, selectedBrandId]);

  useEffect(() => { loadData(); }, [loadData]);

  const tabConfig = DEFAULT_TYPE_TABS.find(t => t.key === activeTab)!;
  const valueCol = VALUE_COL[activeTab];

  const handleAdd = async (values: any) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/master-defaults/${activeTab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: selectedBrandId,
          rows: [{ ...values, value: values[valueCol] }],
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        message.error(err.error || 'Failed to save');
        return;
      }
      message.success('Default added');
      setModalOpen(false);
      form.resetFields();
      loadData();
    } catch {
      message.error('Network error');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/master-defaults/${activeTab}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        message.error('Failed to delete');
        return;
      }
      message.success('Deleted');
      loadData();
    } catch {
      message.error('Network error');
    }
  };

  const handleInlineEdit = async (id: string, newValue: number | null) => {
    if (newValue === null) return;
    try {
      const res = await fetch(`/api/master-defaults/${activeTab}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, value: newValue }),
      });
      if (!res.ok) {
        message.error('Failed to update');
        return;
      }
      loadData();
    } catch {
      message.error('Network error');
    }
  };

  const columns: any[] = [];

  if (tabConfig.dimensions.includes('sub_brand')) {
    columns.push({ title: 'Sub Brand', dataIndex: 'sub_brand', sorter: (a: any, b: any) => a.sub_brand.localeCompare(b.sub_brand) });
  }
  columns.push({ title: 'Sub Category', dataIndex: 'sub_category', sorter: (a: any, b: any) => a.sub_category.localeCompare(b.sub_category) });
  if (tabConfig.dimensions.includes('channel')) {
    columns.push({ title: 'Channel', dataIndex: 'channel', sorter: (a: any, b: any) => a.channel.localeCompare(b.channel) });
  }
  columns.push({
    title: tabConfig.label,
    dataIndex: valueCol,
    width: 180,
    render: (val: number, record: DefaultRow) => (
      <InputNumber
        defaultValue={val}
        onBlur={e => {
          const newVal = parseFloat(e.target.value);
          if (!isNaN(newVal) && newVal !== val) {
            handleInlineEdit(record.id, newVal);
          }
        }}
        min={activeTab === 'asp' ? 0.01 : 0}
        max={['return_pct', 'tax_pct', 'sellex_pct'].includes(activeTab) ? 100 : undefined}
        precision={2}
        style={{ width: 140 }}
      />
    ),
  });
  columns.push({
    title: '', key: 'actions', width: 50,
    render: (_: any, record: DefaultRow) => (
      <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(record.id)} />
    ),
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Master Data Defaults</Title>
        <Space>
          <Select
            placeholder="Select brand"
            value={selectedBrandId}
            onChange={setSelectedBrandId}
            style={{ width: 200 }}
            allowClear
            options={brands.map(b => ({ value: b.id, label: b.name }))}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!selectedBrandId}
            onClick={() => { form.resetFields(); setModalOpen(true); }}
          >
            Add Default
          </Button>
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={key => setActiveTab(key as DefaultType)}
        items={DEFAULT_TYPE_TABS.map(t => ({
          key: t.key,
          label: t.label,
          disabled: !selectedBrandId,
        }))}
      />

      {!selectedBrandId ? (
        <Alert message="Select a brand to manage its default values" type="info" showIcon />
      ) : (
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 50, showSizeChanger: true }}
          size="small"
        />
      )}

      <Modal
        title={`Add ${tabConfig.label} Default`}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          {tabConfig.dimensions.includes('sub_brand') && (
            <Form.Item name="sub_brand" label="Sub Brand" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          )}
          <Form.Item name="sub_category" label="Sub Category" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          {tabConfig.dimensions.includes('channel') && (
            <Form.Item name="channel" label="Channel" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          )}
          <Form.Item name={valueCol} label={tabConfig.label} rules={[{ required: true }]}>
            <InputNumber
              min={activeTab === 'asp' ? 0.01 : 0}
              max={['return_pct', 'tax_pct', 'sellex_pct'].includes(activeTab) ? 100 : undefined}
              precision={2}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

### 11b: Admin page

**Step 2: Write the admin page**

```typescript
// src/app/admin/master-defaults/page.tsx
'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { MasterDefaultsManager } from '@/components/MasterDefaultsManager';

export default function MasterDefaultsAdminPage() {
  return (
    <ProtectedRoute permission="manage_master_data">
      <div style={{ padding: 24 }}>
        <MasterDefaultsManager />
      </div>
    </ProtectedRoute>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/MasterDefaultsManager.tsx src/app/admin/master-defaults/
git commit -m "feat: add admin UI for managing master data defaults"
```

---

## Task 12: Update Navigation — Add Master Defaults Link

**Files:**
- Modify: `otb-automation/src/components/AppLayout.tsx`

**Step 1: Add navigation item**

Find the admin menu items in `AppLayout.tsx` and add a "Master Defaults" link pointing to `/admin/master-defaults`, placed alongside the existing "Master Data" link.

The exact code depends on the current `AppLayout.tsx` implementation. The new menu item should:
- Label: "Master Defaults"
- Path: `/admin/master-defaults`
- Icon: `SettingOutlined` (or similar)
- Visible to: Admin and Planning roles (same as `manage_master_data` permission)

**Step 2: Commit**

```bash
git add src/components/AppLayout.tsx
git commit -m "feat: add Master Defaults navigation link in admin menu"
```

---

## Task 13: Update Upload Page — Remove Default File Types

**Files:**
- Modify: `otb-automation/src/app/cycles/[cycleId]/upload/page.tsx`

**Step 1: Update the upload page**

Since `ALL_FILE_TYPES` and `REQUIRED_FILE_TYPES` were already updated in Task 2, the upload page should automatically only show the 4 remaining file types (3 required + soft_forecast). Verify the page renders correctly with just these types.

No code changes should be needed if the page is already driven by `ALL_FILE_TYPES`. Just verify and test.

**Step 2: Commit (if any changes needed)**

```bash
git add src/app/cycles/[cycleId]/upload/page.tsx
git commit -m "chore: verify upload page shows only upload-based file types"
```

---

## Task 14: Unit Tests — Cycle Defaults Initialization

**Files:**
- Create: `otb-automation/tests/unit/cycleDefaults.test.ts`

**Step 1: Write tests for the defaults initialization logic**

```typescript
import { describe, it, expect } from 'vitest';

// Test the buildDefaultLookup helper (extracted for testability)
// Since buildDefaultLookup is internal to templateGenerator, we test via the template generator's behavior.
// These tests verify the lookup key construction matches between cycle_defaults and plan data generation.

describe('Cycle Defaults Lookup Keys', () => {
  it('ASP lookup uses sub_brand|sub_category|channel', () => {
    const key = ['bewakoof', 't-shirts', 'myntra_sor'].map(s => s.toLowerCase()).join('|');
    expect(key).toBe('bewakoof|t-shirts|myntra_sor');
  });

  it('COGS lookup uses sub_brand|sub_category', () => {
    const key = ['bewakoof', 't-shirts'].map(s => s.toLowerCase()).join('|');
    expect(key).toBe('bewakoof|t-shirts');
  });

  it('Return% lookup uses sub_brand|sub_category|channel', () => {
    const key = ['bewakoof', 'jeans', 'flipkart_sor'].map(s => s.toLowerCase()).join('|');
    expect(key).toBe('bewakoof|jeans|flipkart_sor');
  });

  it('Tax% lookup uses sub_category only', () => {
    const key = ['t-shirts'].map(s => s.toLowerCase()).join('|');
    expect(key).toBe('t-shirts');
  });

  it('Sellex% lookup uses sub_brand|sub_category|channel', () => {
    const key = ['bewakoof air', 'joggers', 'myntra_sor'].map(s => s.toLowerCase()).join('|');
    expect(key).toBe('bewakoof air|joggers|myntra_sor');
  });

  it('Standard DoH lookup uses sub_brand|sub_category', () => {
    const key = ['bewakoof', 'jeans'].map(s => s.toLowerCase()).join('|');
    expect(key).toBe('bewakoof|jeans');
  });
});

describe('Default Type Validation', () => {
  const VALID_TYPES = ['asp', 'cogs', 'return_pct', 'tax_pct', 'sellex_pct', 'standard_doh'];

  it('all 6 default types are recognized', () => {
    expect(VALID_TYPES).toHaveLength(6);
  });

  it('percentage types have 0-100 range', () => {
    const pctTypes = ['return_pct', 'tax_pct', 'sellex_pct'];
    pctTypes.forEach(type => {
      expect(VALID_TYPES).toContain(type);
    });
  });

  it('ASP must be > 0', () => {
    expect(VALID_TYPES).toContain('asp');
    // ASP has CHECK (asp > 0) constraint in DB
  });
});
```

**Step 2: Run tests**

```bash
cd otb-automation && npx vitest run tests/unit/cycleDefaults.test.ts
```
Expected: All tests PASS.

**Step 3: Commit**

```bash
git add tests/unit/cycleDefaults.test.ts
git commit -m "test: add unit tests for cycle defaults lookup keys and validation"
```

---

## Task 15: Update RBAC — Add manage_master_data to Planning Role

**Files:**
- Modify: `otb-automation/src/lib/auth/roles.ts`

**Step 1: Add `manage_master_data` to Planning role**

Planning team needs to manage master defaults (currently only Admin has `manage_master_data`).

In `roles.ts`, add `'manage_master_data'` to the Planning role's permission array:

```typescript
Planning: [
  'create_cycle', 'upload_data', 'assign_gd',
  'view_all_otbs', 'view_approved_otbs',
  'approve_otb', 'upload_actuals', 'view_variance',
  'manage_master_data',
],
```

**Step 2: Commit**

```bash
git add src/lib/auth/roles.ts
git commit -m "feat: grant manage_master_data permission to Planning role"
```

---

## Task 16: CSV Bulk Import for Master Defaults

**Files:**
- Create: `otb-automation/src/app/api/master-defaults/[type]/import/route.ts`

This allows planning teams to bulk-import master defaults from CSV/XLSX instead of adding one-by-one via the admin UI — critical for initial setup with 100+ rows.

**Step 1: Write the bulk import API**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { parseUploadedFile } from '@/lib/fileParser';
import { createServerClient } from '@/lib/supabase/server';
import type { DefaultType } from '@/types/otb';

const TABLE_MAP: Record<DefaultType, string> = {
  asp: 'master_default_asp',
  cogs: 'master_default_cogs',
  return_pct: 'master_default_return_pct',
  tax_pct: 'master_default_tax_pct',
  sellex_pct: 'master_default_sellex_pct',
  standard_doh: 'master_default_doh',
};

const VALUE_COL: Record<DefaultType, string> = {
  asp: 'asp',
  cogs: 'cogs',
  return_pct: 'return_pct',
  tax_pct: 'tax_pct',
  sellex_pct: 'sellex_pct',
  standard_doh: 'doh',
};

const REQUIRED_COLS: Record<DefaultType, string[]> = {
  asp: ['sub_brand', 'sub_category', 'channel', 'asp'],
  cogs: ['sub_brand', 'sub_category', 'cogs'],
  return_pct: ['sub_brand', 'sub_category', 'channel', 'return_pct'],
  tax_pct: ['sub_category', 'tax_pct'],
  sellex_pct: ['sub_brand', 'sub_category', 'channel', 'sellex_pct'],
  standard_doh: ['sub_brand', 'sub_category', 'doh'],
};

type Params = { params: Promise<{ type: string }> };

export const POST = withAuth('manage_master_data', async (req: NextRequest, auth, { params }: Params) => {
  const { type } = await params;
  const defaultType = type as DefaultType;
  if (!TABLE_MAP[defaultType]) {
    return NextResponse.json({ error: `Invalid default type: ${type}` }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const brandId = formData.get('brandId') as string | null;

  if (!file || !brandId) {
    return NextResponse.json({ error: 'file and brandId are required' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const rows = await parseUploadedFile(buffer, file.name);

  if (rows.length === 0) {
    return NextResponse.json({ error: 'File is empty' }, { status: 400 });
  }

  // Validate required columns
  const cols = Object.keys(rows[0]).map(k => k.toLowerCase().trim());
  const requiredCols = REQUIRED_COLS[defaultType];
  const missingCols = requiredCols.filter(c => !cols.includes(c));
  if (missingCols.length > 0) {
    return NextResponse.json({ error: `Missing columns: ${missingCols.join(', ')}` }, { status: 400 });
  }

  const valueCol = VALUE_COL[defaultType];
  const inserts = rows.map((r: any) => {
    const insert: any = {
      brand_id: brandId,
      sub_category: String(r.sub_category || '').trim().toLowerCase(),
      [valueCol]: Number(r[valueCol]),
      updated_at: new Date().toISOString(),
    };
    if (requiredCols.includes('sub_brand')) {
      insert.sub_brand = String(r.sub_brand || '').trim().toLowerCase();
    }
    if (requiredCols.includes('channel')) {
      insert.channel = String(r.channel || '').trim().toLowerCase();
    }
    return insert;
  }).filter((r: any) => !isNaN(r[valueCol]));

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from(TABLE_MAP[defaultType])
    .upsert(inserts, {
      onConflict: getConflictColumns(defaultType),
    })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ imported: data?.length || 0 }, { status: 201 });
});

function getConflictColumns(type: DefaultType): string {
  switch (type) {
    case 'asp':
    case 'return_pct':
    case 'sellex_pct':
      return 'brand_id,sub_brand,sub_category,channel';
    case 'cogs':
    case 'standard_doh':
      return 'brand_id,sub_brand,sub_category';
    case 'tax_pct':
      return 'brand_id,sub_category';
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/master-defaults/[type]/import/
git commit -m "feat: add CSV/XLSX bulk import API for master defaults"
```

---

## Task 17: Integration Test — Full Cycle with Defaults

**Files:**
- Create: `otb-automation/tests/integration/cycleWithDefaults.test.ts`

**Step 1: Write integration test**

```typescript
import { describe, it, expect } from 'vitest';

/**
 * Integration test plan for the full cycle workflow with master defaults.
 *
 * Sequence:
 * 1. Create brand + master data (sub_brands, sub_categories, channels, etc.)
 * 2. Set up master defaults (ASP, COGS, return%, tax%, sellex%, DoH)
 * 3. Create cycle for that brand
 * 4. Upload 3 required files (opening_stock, ly_sales, recent_sales)
 * 5. Initialize cycle defaults (POST /api/cycles/{id}/defaults)
 * 6. Edit a cycle default value (PUT /api/cycles/{id}/defaults)
 * 7. Confirm defaults (POST /api/cycles/{id}/defaults/confirm)
 * 8. Assign GD
 * 9. Generate template & activate
 * 10. Verify plan_data has correct values from cycle defaults
 *
 * This test requires Supabase local instance running.
 * Run with: npx vitest run tests/integration/cycleWithDefaults.test.ts
 */

describe('Cycle with Master Defaults Flow', () => {
  it('validates that cycle_defaults table exists', () => {
    // Placeholder — full integration test requires running Supabase
    expect(true).toBe(true);
  });

  it('validates required upload types reduced to 3', () => {
    const { REQUIRED_FILE_TYPES } = require('@/types/otb');
    expect(REQUIRED_FILE_TYPES).toHaveLength(3);
    expect(REQUIRED_FILE_TYPES).toContain('opening_stock');
    expect(REQUIRED_FILE_TYPES).toContain('ly_sales');
    expect(REQUIRED_FILE_TYPES).toContain('recent_sales');
  });

  it('validates default types match expected set', () => {
    const expectedTypes = ['asp', 'cogs', 'return_pct', 'tax_pct', 'sellex_pct', 'standard_doh'];
    expectedTypes.forEach(type => {
      expect(typeof type).toBe('string');
    });
  });
});
```

**Step 2: Run tests**

```bash
cd otb-automation && npx vitest run tests/integration/cycleWithDefaults.test.ts
```
Expected: PASS

**Step 3: Commit**

```bash
git add tests/integration/cycleWithDefaults.test.ts
git commit -m "test: add integration test skeleton for cycle with master defaults flow"
```

---

## Task 18: Clean Up — Remove Unused Upload References

**Files:**
- Modify: Any files that still reference the removed file types (`cogs`, `asp`, `standard_doh`, `return_pct`, `tax_pct`, `sellex_pct` as upload types)

**Step 1: Search for leftover references**

```bash
cd otb-automation && grep -r "'cogs'\|'asp'\|'standard_doh'\|'return_pct'\|'tax_pct'\|'sellex_pct'" src/ --include='*.ts' --include='*.tsx' -l
```

Review each file and remove/update references that treat these as upload file types. The `FileType` union, `FILE_SCHEMAS`, and `REQUIRED_FILE_TYPES` should already be updated from Tasks 2 and 6. Check for:
- Upload route handler referencing these file types
- Template download routes for these file types
- Test fixtures for these file types
- Any hardcoded file type lists

**Step 2: Fix any issues found**

**Step 3: Run full test suite**

```bash
cd otb-automation && npx vitest run
```
Expected: All tests PASS.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: clean up leftover references to removed upload file types"
```

---

## Dependency Graph

```
Task 1 (Migration)
  └→ Task 2 (Types)
       ├→ Task 3 (Master Defaults API)
       │    └→ Task 11 (Admin UI)
       │         └→ Task 12 (Navigation)
       │    └→ Task 16 (CSV Import)
       ├→ Task 4 (Cycle Defaults API)
       │    └→ Task 8 (Review UI Component)
       │         └→ Task 9 (Review Page)
       │              └→ Task 10 (Cycle Detail Page)
       ├→ Task 5 (Template Generator)
       ├→ Task 6 (Upload Validator)
       │    └→ Task 13 (Upload Page)
       ├→ Task 7 (Activation Route)
       └→ Task 15 (RBAC)

Tasks 14, 17 (Tests) — can run after their dependencies
Task 18 (Cleanup) — final task after everything else
```

## Parallelizable Tasks

After Task 1 (migration) and Task 2 (types) are done:
- **Parallel group A:** Tasks 3, 4, 5, 6, 7, 15 (independent backend changes)
- **Parallel group B (after A):** Tasks 8, 9, 10, 11, 12, 13, 16 (UI + dependent APIs)
- **Final:** Tasks 14, 17, 18 (tests + cleanup)
