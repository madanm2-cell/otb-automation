# OTB Automation — Sprint 1-4 Execution Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the core OTB grid — from file upload through GD data entry to submission — as a fully working production system (without auth).

**Architecture:** Next.js 14+ full-stack app (App Router). Supabase provides PostgreSQL database and file storage. Formula calculations run client-side for real-time UX, with server-side recalculation on save for data integrity. No auth in Sprint 1-4 — APIs are open; Supabase Auth is added in Sprint 5-6.

**Tech Stack:**
- **Framework:** Next.js 14+ (App Router), TypeScript
- **Database:** Supabase (hosted PostgreSQL)
- **ORM/Client:** `@supabase/supabase-js` + `@supabase/ssr` for server-side access
- **File Storage:** Supabase Storage (for uploaded CSV/XLSX files)
- **UI Framework:** Ant Design 5 (enterprise-grade, responsive, good table/form components)
- **Data Grid:** AG Grid Community (nested row grouping, cell editing, clipboard, virtual scrolling for 50K+ rows)
- **File Parsing:** `exceljs` (xlsx), `csv-parse` (csv)
- **Testing:** Vitest (unit/integration), Playwright (E2E)
- **Hosting:** TBD (Vercel, AWS, or self-hosted)

**Why AG Grid:** The PRD requires nested/expandable rows (6-level hierarchy), inline cell editing, copy-paste from Excel, 50K+ rows with virtual scrolling, and auto-calculated subtotals. AG Grid Community is the only free grid that supports all of these. Ant Design's Table component lacks cell editing and virtual scrolling at this scale.

**PRD Reference:** `OTB_Automation_PRD_Phase1_V2.md` — Sections 4-8, 13.3, 13.4, 19.2

---

## Project Structure

```
otb-automation/
├── package.json
├── next.config.ts
├── tsconfig.json
├── .env.local.example              # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql  # All tables
│   └── seed.sql                    # Master data
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with AntD provider
│   │   ├── page.tsx                # Redirect to /cycles
│   │   ├── cycles/
│   │   │   ├── page.tsx            # Cycle list
│   │   │   ├── new/
│   │   │   │   └── page.tsx        # Create cycle form
│   │   │   └── [cycleId]/
│   │   │       ├── page.tsx        # Cycle detail (status, uploads, activate)
│   │   │       ├── upload/
│   │   │       │   └── page.tsx    # File upload page (10 types)
│   │   │       └── grid/
│   │   │           └── page.tsx    # OTB data entry grid
│   │   └── api/
│   │       ├── cycles/
│   │       │   ├── route.ts                    # GET list, POST create
│   │       │   └── [cycleId]/
│   │       │       ├── route.ts                # GET detail, PUT update
│   │       │       ├── activate/route.ts       # POST activate
│   │       │       ├── upload/[fileType]/route.ts  # POST upload file
│   │       │       ├── upload-status/route.ts  # GET upload status
│   │       │       ├── generate-template/route.ts  # POST generate
│   │       │       ├── plan-data/
│   │       │       │   ├── route.ts            # GET all plan data
│   │       │       │   └── bulk-update/route.ts # POST bulk save
│   │       │       ├── submit/route.ts         # POST submit
│   │       │       ├── assign-gd/route.ts      # PUT assign GD
│   │       │       ├── versions/route.ts       # GET version list
│   │       │       └── import-excel/
│   │       │           ├── route.ts            # POST preview
│   │       │           └── apply/route.ts      # POST apply import
│   │       ├── templates/[fileType]/route.ts   # GET sample template download
│   │       └── master-data/
│   │           └── [type]/route.ts             # GET brands, channels, etc.
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts           # Browser client
│   │   │   └── server.ts           # Server-side client (for API routes)
│   │   ├── formulaEngine.ts        # 11-step calculation (pure functions)
│   │   ├── uploadValidator.ts      # File validation (V-001 to V-007)
│   │   ├── templateGenerator.ts    # Generate plan rows from uploads
│   │   ├── monthLockout.ts         # IST-based month lockout logic
│   │   ├── versionService.ts       # Version snapshot creation
│   │   └── formatting.ts           # Crore display, %, qty formatting
│   ├── components/
│   │   ├── FileDropzone.tsx
│   │   ├── ValidationReport.tsx
│   │   ├── OtbGrid.tsx             # AG Grid wrapper
│   │   ├── BulkEditModal.tsx
│   │   ├── VersionHistory.tsx
│   │   └── ExcelImportPreview.tsx
│   ├── hooks/
│   │   ├── useFormulaEngine.ts
│   │   ├── useAutoSave.ts
│   │   └── useUndoRedo.ts
│   └── types/
│       └── otb.ts                  # TypeScript types for OTB domain
└── tests/
    ├── unit/
    │   ├── formulaEngine.test.ts
    │   ├── uploadValidator.test.ts
    │   └── monthLockout.test.ts
    ├── integration/
    │   ├── upload.test.ts
    │   ├── cycles.test.ts
    │   └── planData.test.ts
    └── e2e/
        └── fullFlow.test.ts
```

---

## Database Schema (Supabase Migration)

File: `supabase/migrations/001_initial_schema.sql`

```sql
-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- MASTER DATA
-- ============================================================

create table brands (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  created_at timestamptz default now()
);

create table sub_brands (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  brand_id uuid references brands(id) not null,
  created_at timestamptz default now(),
  unique(brand_id, name)
);

create table sub_categories (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  created_at timestamptz default now()
);

create table channels (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  created_at timestamptz default now()
);

create table genders (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  created_at timestamptz default now()
);

-- Standardization mappings (PRD 4.3): raw names → standard names
create table master_mappings (
  id uuid primary key default uuid_generate_v4(),
  mapping_type text not null,           -- 'sub_brand', 'sub_category', 'channel'
  raw_value text not null,
  standard_value text not null,
  brand text,                           -- optional: brand-specific mappings
  unique(mapping_type, raw_value, brand)
);

-- ============================================================
-- OTB CYCLES
-- ============================================================

create table otb_cycles (
  id uuid primary key default uuid_generate_v4(),
  cycle_name text not null,
  brand_id uuid references brands(id) not null,
  planning_quarter text not null,       -- e.g. 'Q4-FY26'
  planning_period_start date not null,
  planning_period_end date not null,
  wear_types jsonb not null default '[]', -- ['NWW', 'WW'] free-form
  fill_deadline date,
  approval_deadline date,
  assigned_gd_id text,                  -- user ID (text until auth in Sprint 5-6)
  status text not null default 'Draft', -- Draft, Active, Filling, InReview, Approved
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- FILE UPLOADS
-- ============================================================

create table file_uploads (
  id uuid primary key default uuid_generate_v4(),
  cycle_id uuid references otb_cycles(id) not null,
  file_type text not null,              -- opening_stock, cogs, asp, doh, ly_sales, etc.
  file_name text not null,
  storage_path text not null,           -- Supabase Storage path
  status text default 'pending',        -- pending, validated, failed
  row_count int,
  errors jsonb,                         -- validation error details
  uploaded_at timestamptz default now()
);

-- ============================================================
-- OTB PLAN DATA
-- ============================================================

-- One row per dimension combination per cycle
create table otb_plan_rows (
  id uuid primary key default uuid_generate_v4(),
  cycle_id uuid references otb_cycles(id) not null,
  sub_brand text not null,
  wear_type text not null,
  sub_category text not null,
  gender text not null,
  channel text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(cycle_id, sub_brand, wear_type, sub_category, gender, channel)
);

-- Month-wise metrics per row (3 records per row for a quarter)
create table otb_plan_data (
  id uuid primary key default uuid_generate_v4(),
  row_id uuid references otb_plan_rows(id) not null,
  month date not null,                  -- first day of month

  -- Reference data (pre-filled from uploads)
  asp numeric(12,2),
  cogs numeric(12,2),
  opening_stock_qty int,
  ly_sales_gmv numeric(15,2),
  recent_sales_nsq int,
  soft_forecast_nsq int,
  return_pct numeric(5,2),
  tax_pct numeric(5,2),
  sellex_pct numeric(5,2),
  standard_doh int,

  -- GD inputs (3 editable fields)
  nsq int,
  inwards_qty int,
  perf_marketing_pct numeric(5,2),

  -- Calculated fields (stored on save for query performance)
  sales_plan_gmv numeric(15,2),
  goly_pct numeric(8,2),
  nsv numeric(15,2),
  inwards_val_cogs numeric(15,2),
  opening_stock_val numeric(15,2),
  closing_stock_qty int,
  fwd_30day_doh numeric(8,2),
  gm_pct numeric(5,2),
  gross_margin numeric(15,2),
  cm1 numeric(15,2),
  cm2 numeric(15,2),

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(row_id, month)
);

-- ============================================================
-- VERSION HISTORY
-- ============================================================

create table version_history (
  id uuid primary key default uuid_generate_v4(),
  cycle_id uuid references otb_cycles(id) not null,
  version_number int not null,
  snapshot jsonb not null,              -- full plan data snapshot
  change_summary text,
  created_by text,                      -- user identifier (text until auth)
  created_at timestamptz default now()
);

-- ============================================================
-- INDEXES for performance
-- ============================================================

create index idx_plan_rows_cycle on otb_plan_rows(cycle_id);
create index idx_plan_data_row on otb_plan_data(row_id);
create index idx_file_uploads_cycle on file_uploads(cycle_id);
create index idx_versions_cycle on version_history(cycle_id);
```

---

## SPRINT 1-2: OTB Grid Foundation (Weeks 1-4)

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`
- Create: `.env.local.example`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`

**Step 1: Initialize Next.js project**

```bash
npx create-next-app@latest otb-automation --typescript --tailwind --app --src-dir --use-npm
cd otb-automation
```

**Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr antd @ant-design/icons ag-grid-react ag-grid-community exceljs csv-parse uuid
npm install -D vitest @testing-library/react @testing-library/jest-dom playwright @playwright/test
```

**Step 3: Create .env.local.example**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Step 4: Create Supabase client utilities**

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

```typescript
// src/lib/supabase/server.ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createServerClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

**Step 5: Create root layout with AntD**

```typescript
// src/app/layout.tsx
import { AntdRegistry } from '@ant-design/nextjs-registry';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AntdRegistry>{children}</AntdRegistry>
      </body>
    </html>
  );
}
```

**Step 6: Commit**

```bash
git init && git add -A && git commit -m "chore: Next.js scaffolding with Supabase, AntD, AG Grid"
```

---

### Task 2: Supabase Setup — Schema + Seed Data

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql` (schema shown above)
- Create: `supabase/seed.sql`

**Step 1: Create Supabase project**

Create a project at supabase.com. Copy URL and keys to `.env.local`.

**Step 2: Run migration**

Apply `001_initial_schema.sql` via Supabase Dashboard → SQL Editor, or via Supabase CLI:

```bash
npx supabase db push
```

**Step 3: Write and run seed script**

```sql
-- supabase/seed.sql

-- Brands (PRD 4.1)
INSERT INTO brands (name) VALUES
  ('Bewakoof'), ('TIGC'), ('Wrogn'), ('Urbano'),
  ('Nobero'), ('Veirdo'), ('Nauti Nati')
ON CONFLICT (name) DO NOTHING;

-- Sub Brands for Bewakoof
INSERT INTO sub_brands (name, brand_id)
SELECT sb.name, b.id FROM
  (VALUES ('bewakoof'), ('bewakoof air'), ('bewakoof heavy duty')) AS sb(name),
  brands b WHERE b.name = 'Bewakoof'
ON CONFLICT (brand_id, name) DO NOTHING;

-- Sub Categories
INSERT INTO sub_categories (name) VALUES
  ('T-Shirts'), ('Jeans'), ('Hoodies'), ('Joggers'), ('Shorts'),
  ('Shirts'), ('Trousers'), ('Jackets'), ('Sweatshirts'), ('Pyjamas')
ON CONFLICT (name) DO NOTHING;

-- Channels (PRD 4.1)
INSERT INTO channels (name) VALUES
  ('amazon_cocoblu'), ('flipkart_sor'), ('myntra_sor'), ('Offline'), ('Others')
ON CONFLICT (name) DO NOTHING;

-- Genders
INSERT INTO genders (name) VALUES ('Male'), ('Female'), ('Unisex')
ON CONFLICT (name) DO NOTHING;

-- Master Mappings (PRD 4.3 — standardization examples)
INSERT INTO master_mappings (mapping_type, raw_value, standard_value, brand) VALUES
  ('sub_brand', 'bob', 'bewakoof', 'Bewakoof'),
  ('sub_brand', 'BOB', 'bewakoof', 'Bewakoof'),
  ('channel', 'unicommerce', 'Others', NULL),
  ('channel', 'website', 'Others', NULL)
ON CONFLICT (mapping_type, raw_value, brand) DO NOTHING;
```

Run via Supabase Dashboard SQL Editor.

**Step 4: Create Supabase Storage bucket**

In Supabase Dashboard → Storage → Create bucket `otb-uploads` (public: false).

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: Supabase schema, master data seed, storage bucket"
```

---

### Task 3: TypeScript Types

**Files:**
- Create: `src/types/otb.ts`

**Step 1: Define domain types**

```typescript
// src/types/otb.ts

export interface Brand {
  id: string;
  name: string;
}

export interface SubBrand {
  id: string;
  name: string;
  brand_id: string;
}

export interface OtbCycle {
  id: string;
  cycle_name: string;
  brand_id: string;
  planning_quarter: string;
  planning_period_start: string;
  planning_period_end: string;
  wear_types: string[];
  fill_deadline: string | null;
  approval_deadline: string | null;
  assigned_gd_id: string | null;
  status: 'Draft' | 'Active' | 'Filling' | 'InReview' | 'Approved';
  created_at: string;
  // Joined
  brands?: Brand;
}

export type FileType =
  | 'opening_stock' | 'cogs' | 'asp' | 'standard_doh'
  | 'ly_sales' | 'recent_sales'
  | 'return_pct' | 'tax_pct' | 'sellex_pct'
  | 'soft_forecast';

export const REQUIRED_FILE_TYPES: FileType[] = [
  'opening_stock', 'cogs', 'asp', 'standard_doh',
  'ly_sales', 'recent_sales', 'return_pct', 'tax_pct', 'sellex_pct',
];

export interface FileUpload {
  id: string;
  cycle_id: string;
  file_type: FileType;
  file_name: string;
  status: 'pending' | 'validated' | 'failed';
  row_count: number | null;
  errors: ValidationError[] | null;
  uploaded_at: string;
}

export interface ValidationError {
  row: number;
  field: string;
  rule: string;      // V-001 through V-007
  message: string;
}

export interface PlanRow {
  id: string;
  cycle_id: string;
  sub_brand: string;
  wear_type: string;
  sub_category: string;
  gender: string;
  channel: string;
  months: Record<string, PlanMonthData>;  // keyed by "YYYY-MM-DD"
}

export interface PlanMonthData {
  id: string;
  month: string;
  // Reference data
  asp: number | null;
  cogs: number | null;
  opening_stock_qty: number | null;
  ly_sales_gmv: number | null;
  recent_sales_nsq: number | null;
  soft_forecast_nsq: number | null;
  return_pct: number | null;
  tax_pct: number | null;
  sellex_pct: number | null;
  standard_doh: number | null;
  // GD inputs
  nsq: number | null;
  inwards_qty: number | null;
  perf_marketing_pct: number | null;
  // Calculated
  sales_plan_gmv: number | null;
  goly_pct: number | null;
  nsv: number | null;
  inwards_val_cogs: number | null;
  opening_stock_val: number | null;
  closing_stock_qty: number | null;
  fwd_30day_doh: number | null;
  gm_pct: number | null;
  gross_margin: number | null;
  cm1: number | null;
  cm2: number | null;
}

export interface FormulaInputs {
  nsq: number | null;
  inwardsQty: number | null;
  perfMarketingPct: number | null;
  asp: number | null;
  cogs: number | null;
  openingStockQty: number | null;
  lySalesGmv: number | null;
  returnPct: number | null;
  taxPct: number | null;
  sellexPct: number | null;
  nextMonthNsq: number | null;
}

export interface FormulaOutputs {
  salesPlanGmv: number | null;
  golyPct: number | null;
  nsv: number | null;
  inwardsValCogs: number | null;
  openingStockVal: number | null;
  closingStockQty: number | null;
  fwd30dayDoh: number | null;
  gmPct: number | null;
  grossMargin: number | null;
  cm1: number | null;
  cm2: number | null;
}
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: TypeScript domain types for OTB"
```

---

### Task 4: Formula Engine (Pure Functions)

This is the core of the system — the 11-step calculation chain from PRD Section 5.2.

**Files:**
- Create: `src/lib/formulaEngine.ts`
- Test: `tests/unit/formulaEngine.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/unit/formulaEngine.test.ts
import { describe, it, expect } from 'vitest';
import {
  calcSalesPlanGmv, calcGolyPct, calcNsv, calcInwardsValCogs,
  calcOpeningStockVal, calcClosingStockQty, calcFwd30dayDoh,
  calcGmPct, calcGrossMargin, calcCm1, calcCm2, calculateAll,
} from '../../src/lib/formulaEngine';

describe('Formula Engine — 11-step chain (PRD 5.2)', () => {
  // Step 1: GMV = NSQ × ASP
  it('step 1: salesPlanGmv = 1000 × 849.50 = 849500', () => {
    expect(calcSalesPlanGmv(1000, 849.50)).toBe(849500);
  });
  it('step 1: returns null when NSQ is null', () => {
    expect(calcSalesPlanGmv(null, 849.50)).toBeNull();
  });
  it('step 1: returns 0 when NSQ is 0', () => {
    expect(calcSalesPlanGmv(0, 849.50)).toBe(0);
  });

  // Step 2: GOLY% = ((GMV / LY_GMV) - 1) × 100
  it('step 2: golyPct = ((849500/700000)-1)×100 = 21.36%', () => {
    expect(calcGolyPct(849500, 700000)).toBeCloseTo(21.36, 1);
  });
  it('step 2: returns null when LY is 0', () => {
    expect(calcGolyPct(849500, 0)).toBeNull();
  });
  it('step 2: returns null when LY is null', () => {
    expect(calcGolyPct(849500, null)).toBeNull();
  });

  // Step 3: NSV = GMV × (1 - Return%) × (1 - Tax%)
  it('step 3: nsv = 849500 × 0.745 × 0.88 = ~556941', () => {
    expect(calcNsv(849500, 25.5, 12)).toBeCloseTo(556940.70, 0);
  });

  // Step 4: Inwards Val = Inwards Qty × COGS
  it('step 4: inwardsValCogs = 500 × 350 = 175000', () => {
    expect(calcInwardsValCogs(500, 350)).toBe(175000);
  });

  // Step 5: Opening Stock Val = Opening Stock Qty × COGS
  it('step 5: openingStockVal = 15420 × 350 = 5397000', () => {
    expect(calcOpeningStockVal(15420, 350)).toBe(5397000);
  });

  // Step 6: Closing Stock = Opening + Inwards - NSQ
  it('step 6: closingStockQty = 15420 + 500 - 1000 = 14920', () => {
    expect(calcClosingStockQty(15420, 500, 1000)).toBe(14920);
  });
  it('step 6: can go negative (validation catches this)', () => {
    expect(calcClosingStockQty(100, 50, 200)).toBe(-50);
  });

  // Step 7: Fwd DoH = Closing / (NextMonthNSQ / 30)
  it('step 7: fwd30dayDoh = 14920 / (1200/30) = 373', () => {
    expect(calcFwd30dayDoh(14920, 1200)).toBeCloseTo(373, 0);
  });
  it('step 7: returns null when next month NSQ is 0', () => {
    expect(calcFwd30dayDoh(14920, 0)).toBeNull();
  });
  it('step 7: returns null when next month NSQ is null (last month)', () => {
    expect(calcFwd30dayDoh(14920, null)).toBeNull();
  });

  // Step 8: GM% = (ASP - COGS) / ASP × 100
  it('step 8: gmPct = (849.50-350)/849.50×100 = 58.80%', () => {
    expect(calcGmPct(849.50, 350)).toBeCloseTo(58.80, 1);
  });
  it('step 8: returns null when ASP is 0', () => {
    expect(calcGmPct(0, 350)).toBeNull();
  });

  // Step 9: Gross Margin = NSV × GM%
  it('step 9: grossMargin = 556940.70 × 0.588 = ~327481', () => {
    expect(calcGrossMargin(556940.70, 58.80)).toBeCloseTo(327481.13, 0);
  });

  // Step 10: CM1 = NSV × (1 - Sellex%)
  it('step 10: cm1 = 556940.70 × 0.92 = ~512385', () => {
    expect(calcCm1(556940.70, 8)).toBeCloseTo(512385.44, 0);
  });

  // Step 11: CM2 = CM1 - (NSV × Perf Mktg %)
  it('step 11: cm2 = 512385.44 - (556940.70 × 0.05) = ~484538', () => {
    expect(calcCm2(512385.44, 556940.70, 5)).toBeCloseTo(484538.41, 0);
  });

  // Full chain
  it('calculateAll: computes entire chain from inputs', () => {
    const result = calculateAll({
      nsq: 1000, inwardsQty: 500, perfMarketingPct: 5,
      asp: 849.50, cogs: 350, openingStockQty: 15420,
      lySalesGmv: 700000, returnPct: 25.5, taxPct: 12,
      sellexPct: 8, nextMonthNsq: 1200,
    });
    expect(result.salesPlanGmv).toBe(849500);
    expect(result.golyPct).toBeCloseTo(21.36, 1);
    expect(result.closingStockQty).toBe(14920);
    expect(result.gmPct).toBeCloseTo(58.80, 1);
    expect(result.cm2).toBeCloseTo(484538, 0);
  });
});
```

**Step 2: Run test → FAIL (module not found)**

```bash
npx vitest run tests/unit/formulaEngine.test.ts
```

**Step 3: Write implementation**

```typescript
// src/lib/formulaEngine.ts
import type { FormulaInputs, FormulaOutputs } from '@/types/otb';

export function calcSalesPlanGmv(nsq: number | null, asp: number | null): number | null {
  if (nsq == null || asp == null) return null;
  return nsq * asp;
}

export function calcGolyPct(gmv: number | null, lyGmv: number | null): number | null {
  if (gmv == null || lyGmv == null || lyGmv === 0) return null;
  return ((gmv / lyGmv) - 1) * 100;
}

export function calcNsv(gmv: number | null, returnPct: number | null, taxPct: number | null): number | null {
  if (gmv == null || returnPct == null || taxPct == null) return null;
  return gmv * (1 - returnPct / 100) * (1 - taxPct / 100);
}

export function calcInwardsValCogs(qty: number | null, cogs: number | null): number | null {
  if (qty == null || cogs == null) return null;
  return qty * cogs;
}

export function calcOpeningStockVal(qty: number | null, cogs: number | null): number | null {
  if (qty == null || cogs == null) return null;
  return qty * cogs;
}

export function calcClosingStockQty(opening: number | null, inwards: number | null, nsq: number | null): number | null {
  if (opening == null || inwards == null || nsq == null) return null;
  return opening + inwards - nsq;
}

export function calcFwd30dayDoh(closing: number | null, nextNsq: number | null): number | null {
  if (closing == null || nextNsq == null || nextNsq === 0) return null;
  return closing / (nextNsq / 30);
}

export function calcGmPct(asp: number | null, cogs: number | null): number | null {
  if (asp == null || cogs == null || asp === 0) return null;
  return ((asp - cogs) / asp) * 100;
}

export function calcGrossMargin(nsv: number | null, gmPct: number | null): number | null {
  if (nsv == null || gmPct == null) return null;
  return nsv * (gmPct / 100);
}

export function calcCm1(nsv: number | null, sellexPct: number | null): number | null {
  if (nsv == null || sellexPct == null) return null;
  return nsv * (1 - sellexPct / 100);
}

export function calcCm2(cm1: number | null, nsv: number | null, perfMktgPct: number | null): number | null {
  if (cm1 == null || nsv == null || perfMktgPct == null) return null;
  return cm1 - (nsv * perfMktgPct / 100);
}

export function calculateAll(inputs: FormulaInputs): FormulaOutputs {
  const salesPlanGmv = calcSalesPlanGmv(inputs.nsq, inputs.asp);
  const golyPct = calcGolyPct(salesPlanGmv, inputs.lySalesGmv);
  const nsv = calcNsv(salesPlanGmv, inputs.returnPct, inputs.taxPct);
  const inwardsValCogs = calcInwardsValCogs(inputs.inwardsQty, inputs.cogs);
  const openingStockVal = calcOpeningStockVal(inputs.openingStockQty, inputs.cogs);
  const closingStockQty = calcClosingStockQty(inputs.openingStockQty, inputs.inwardsQty, inputs.nsq);
  const fwd30dayDoh = calcFwd30dayDoh(closingStockQty, inputs.nextMonthNsq);
  const gmPct = calcGmPct(inputs.asp, inputs.cogs);
  const grossMargin = calcGrossMargin(nsv, gmPct);
  const cm1 = calcCm1(nsv, inputs.sellexPct);
  const cm2 = calcCm2(cm1, nsv, inputs.perfMarketingPct);
  return { salesPlanGmv, golyPct, nsv, inwardsValCogs, openingStockVal, closingStockQty, fwd30dayDoh, gmPct, grossMargin, cm1, cm2 };
}
```

**Step 4: Run test → ALL PASS**

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: 11-step formula engine with comprehensive tests"
```

---

### Task 5: Upload Validator

**Files:**
- Create: `src/lib/uploadValidator.ts`
- Test: `tests/unit/uploadValidator.test.ts`

Implements validation rules V-001 through V-007 from PRD FR-1.2. Each of the 10 file types has a schema definition (required columns, data types, validation rules). The validator:
1. Checks required columns exist
2. Iterates rows — applies master data mappings to normalize raw values
3. Validates each field per the rules
4. Checks for duplicate dimension combinations (V-006)
5. Returns `{ valid, errors[], normalizedRows[] }`

**Test cases:** Valid data passes. Negative numbers fail V-001. Percentages > 100 fail V-002. Unknown sub_brand fails V-003 unless mapping exists. ASP = 0 fails V-004. Duplicate rows fail V-006.

**Commit after tests pass:**

```bash
git add -A && git commit -m "feat: upload validator with V-001 to V-007 rules"
```

---

### Task 6: Master Data API

**Files:**
- Create: `src/app/api/master-data/[type]/route.ts`
- Test: `tests/integration/masterData.test.ts`

```typescript
// src/app/api/master-data/[type]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

const VALID_TYPES = ['brands', 'sub_brands', 'sub_categories', 'channels', 'genders', 'master_mappings'];

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  const { type } = params;
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  const supabase = createServerClient();
  const query = supabase.from(type).select('*').order('name' in [] ? 'name' : 'created_at');

  // For sub_brands, support ?brandId= filter
  if (type === 'sub_brands') {
    const brandId = req.nextUrl.searchParams.get('brandId');
    if (brandId) query.eq('brand_id', brandId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

**Commit:**

```bash
git add -A && git commit -m "feat: master data API endpoints"
```

---

### Task 7: OTB Cycle CRUD API

**Files:**
- Create: `src/app/api/cycles/route.ts` — GET list, POST create
- Create: `src/app/api/cycles/[cycleId]/route.ts` — GET detail, PUT update
- Create: `src/app/api/cycles/[cycleId]/activate/route.ts` — POST activate
- Test: `tests/integration/cycles.test.ts`

**Key logic:**
- POST create: validate brand exists, compute planning period dates from quarter, store wear_types as JSON array
- POST activate: check all 9 required files uploaded + validated, GD assigned, wear types defined. Transition status Draft → Filling.
- Enforce: only one non-Approved cycle per brand at a time.

**Commit:**

```bash
git add -A && git commit -m "feat: OTB cycle CRUD + activation API"
```

---

### Task 8: File Upload API

**Files:**
- Create: `src/app/api/cycles/[cycleId]/upload/[fileType]/route.ts`
- Create: `src/app/api/cycles/[cycleId]/upload-status/route.ts`
- Create: `src/app/api/templates/[fileType]/route.ts` (sample downloads)

**Step 1: Upload endpoint**

```
POST /api/cycles/:cycleId/upload/:fileType
- Accepts multipart form data (CSV or XLSX, max 50MB)
- Parses file using exceljs (xlsx) or csv-parse (csv)
- Loads master data from Supabase for validation context
- Runs uploadValidator → { valid, errors, normalizedRows }
- If valid: store file in Supabase Storage, save normalized data to staging,
  create file_uploads record with status='validated'
- If invalid: create file_uploads record with status='failed', errors=JSON
- Returns { valid, rowCount, errors }
```

**Step 2: Upload status endpoint**

```
GET /api/cycles/:cycleId/upload-status
- Returns all file_uploads for this cycle
- Frontend uses this to show which of the 10 types are uploaded/validated/failed
```

**Step 3: Sample template download**

```
GET /api/templates/:fileType
- Returns a CSV file with correct headers + 2-3 sample rows
- Based on PRD Appendix 19.2 formats
```

**Commit:**

```bash
git add -A && git commit -m "feat: file upload API with validation, storage, sample templates"
```

---

### Task 9: Template Generator

**Files:**
- Create: `src/lib/templateGenerator.ts`
- Test: `tests/unit/templateGenerator.test.ts`

**Logic:**
1. Query all validated uploads for the cycle
2. Compute unique dimension combinations from Opening Stock (primary) + other uploads
3. For each wear_type in the cycle × each dimension combo, create an `otb_plan_rows` record
4. For each row × each of 3 months in the quarter, create an `otb_plan_data` record
5. Pre-fill reference data by joining:
   - ASP: match on sub_brand × sub_category × channel
   - COGS: match on sub_brand × sub_category
   - Opening Stock: match on sub_brand × sub_category × gender × channel (Month 1 only)
   - LY Sales: match on sub_brand × sub_category × gender × channel × month
   - Return/Tax/Sellex%: match on sub_category × channel
   - Standard DoH: match on sub_brand × sub_category
   - Recent Sales, Soft Forecast: match on sub_brand × sub_category × gender
6. Leave GD input fields (nsq, inwardsQty, perfMarketingPct) as null

**API:**

```
POST /api/cycles/:cycleId/generate-template
- Runs template generator
- Returns { rowCount, message }
```

**Commit:**

```bash
git add -A && git commit -m "feat: template generator creates plan rows from uploaded reference data"
```

---

### Task 10: Plan Data Read API

**Files:**
- Create: `src/app/api/cycles/[cycleId]/plan-data/route.ts`

**Response shape** (optimized for AG Grid):

```json
{
  "months": ["2026-01-01", "2026-02-01", "2026-03-01"],
  "rows": [
    {
      "id": "row-uuid",
      "subBrand": "bewakoof",
      "wearType": "NWW",
      "subCategory": "T-Shirts",
      "gender": "Male",
      "channel": "myntra_sor",
      "months": {
        "2026-01-01": { "id": "data-uuid", "asp": 849.50, "cogs": 350, "openingStockQty": 15420, ... },
        "2026-02-01": { ... },
        "2026-03-01": { ... }
      }
    }
  ]
}
```

**Commit:**

```bash
git add -A && git commit -m "feat: plan data read API with grid-friendly response"
```

---

### Task 11: Frontend — Cycle List + Create Pages

**Files:**
- Create: `src/app/cycles/page.tsx` — list all cycles with status badges
- Create: `src/app/cycles/new/page.tsx` — create cycle form
- Create: `src/app/cycles/[cycleId]/page.tsx` — cycle detail with upload status + activate

**Cycle Create form fields:**
- Brand (Select dropdown, populated from `/api/master-data/brands`)
- Cycle Name (text input)
- Planning Quarter (Select: Q1/Q2/Q3/Q4 + FY year)
- Wear Types (AntD Tags input — free-form)
- Fill Deadline (DatePicker, optional)
- Approval Deadline (DatePicker, optional)

**Commit:**

```bash
git add -A && git commit -m "feat: cycle list, create, and detail pages"
```

---

### Task 12: Frontend — File Upload Page

**Files:**
- Create: `src/app/cycles/[cycleId]/upload/page.tsx`
- Create: `src/components/FileDropzone.tsx`
- Create: `src/components/ValidationReport.tsx`

**Page layout:**
- 10 upload cards (one per file type), showing: file type name, status icon (pending/validated/failed), row count
- Click card → drag-and-drop zone (AntD Upload with Dragger)
- After upload: show validation report (pass/fail, errors with row numbers)
- "Download Sample" link on each card
- "Generate Template & Activate" button at bottom (enabled when 9 required files validated + GD assigned)

**Commit:**

```bash
git add -A && git commit -m "feat: file upload page with drag-drop, validation report"
```

---

### Task 13: Frontend — OTB Grid (Read-Only)

**Files:**
- Create: `src/app/cycles/[cycleId]/grid/page.tsx`
- Create: `src/components/OtbGrid.tsx`
- Create: `src/lib/formatting.ts`

**AG Grid configuration:**
- Fetch from `GET /api/cycles/:cycleId/plan-data`
- Row grouping: Sub Brand → Wear Type → Sub Category → Gender (expand to show channels)
- For each of 3 months, column groups:
  - Reference: Opening Stock Qty, ASP, COGS, LY Sales, Standard DoH, Recent Sales, Soft Forecast
  - GD Inputs: NSQ, Inwards Qty, Perf Mktg % (read-only for now)
  - Calculated: GMV, GOLY%, NSV, Inwards Val, Opening Stock Val, Closing Stock, Fwd DoH, GM%, Gross Margin, CM1, CM2
- Formatting (PRD 5.3):
  - INR values: `formatCrore(value)` → `(value / 10000000).toFixed(2) + ' Cr'`
  - Percentages: `value.toFixed(1) + '%'`
  - Quantities: `value.toLocaleString('en-IN')` (thousand separators)
- Subtotal rows: use AG Grid `aggFunc` for sum/weighted-average at each group level

**Commit:**

```bash
git add -A && git commit -m "feat: OTB grid with nested hierarchy, Crore formatting, read-only"
```

---

### Task 14: Sprint 1-2 Integration Test

**Files:**
- Create: `tests/integration/fullFlow.test.ts`

**Test the full Sprint 1-2 flow:**
1. Create cycle for Bewakoof Q4 FY26
2. Upload all 10 input files (fixture CSVs in `tests/fixtures/`)
3. Generate template
4. Read plan data → verify rows created with pre-filled reference data
5. Verify formula calculations on a row with mock GD inputs (directly update DB, then re-read)

**Commit:**

```bash
git add -A && git commit -m "test: Sprint 1-2 integration test — upload to grid flow"
```

**Production deploy:** Planning team can upload files → create cycle → see pre-filled OTB grid.

---

## SPRINT 3-4: GD Input, Submission & Draft Management (Weeks 5-8)

---

### Task 15: Plan Data Bulk Update API

**Files:**
- Create: `src/app/api/cycles/[cycleId]/plan-data/bulk-update/route.ts`

```
POST /api/cycles/:cycleId/plan-data/bulk-update
Body: {
  updates: [
    { rowId: "...", month: "2026-01-01", nsq: 1000, inwardsQty: 500, perfMarketingPct: 5 },
    ...
  ]
}
```

**Server-side logic:**
1. Validate cycle status is 'Filling'
2. Check month lockout (reject updates to locked months)
3. For each update: save GD inputs, run `calculateAll()` server-side, store calculated fields
4. Handle month chaining: if Month 1 closing stock changes → update Month 2 opening_stock_qty → recalculate Month 2 → cascade to Month 3
5. Return full updated plan data for affected rows

**Commit:**

```bash
git add -A && git commit -m "feat: bulk update API with formula recalculation and month chaining"
```

---

### Task 16: Month Lockout Service

**Files:**
- Create: `src/lib/monthLockout.ts`
- Test: `tests/unit/monthLockout.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/unit/monthLockout.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getLockedMonths } from '../../src/lib/monthLockout';

describe('monthLockout (PRD FR-3.4)', () => {
  afterEach(() => vi.useRealTimers());

  it('Jan 10: Jan locked, Feb-Mar editable', () => {
    vi.setSystemTime(new Date('2026-01-10T10:00:00+05:30'));
    const result = getLockedMonths(['2026-01-01', '2026-02-01', '2026-03-01']);
    expect(result['2026-01-01']).toBe(true);
    expect(result['2026-02-01']).toBe(false);
    expect(result['2026-03-01']).toBe(false);
  });

  it('Jan 16: Jan locked, Feb locked, Mar editable', () => {
    vi.setSystemTime(new Date('2026-01-16T10:00:00+05:30'));
    const result = getLockedMonths(['2026-01-01', '2026-02-01', '2026-03-01']);
    expect(result['2026-01-01']).toBe(true);
    expect(result['2026-02-01']).toBe(true);
    expect(result['2026-03-01']).toBe(false);
  });

  it('Feb 5: Jan+Feb locked, Mar editable', () => {
    vi.setSystemTime(new Date('2026-02-05T10:00:00+05:30'));
    const result = getLockedMonths(['2026-01-01', '2026-02-01', '2026-03-01']);
    expect(result['2026-01-01']).toBe(true);
    expect(result['2026-02-01']).toBe(true);
    expect(result['2026-03-01']).toBe(false);
  });

  it('uses IST timezone: Jan 15 23:00 UTC = Jan 16 04:30 IST', () => {
    vi.setSystemTime(new Date('2026-01-15T23:00:00Z'));
    const result = getLockedMonths(['2026-02-01']);
    expect(result['2026-02-01']).toBe(true); // IST is past 15th
  });
});
```

**Step 2: Implement**

```typescript
// src/lib/monthLockout.ts
export function getLockedMonths(months: string[]): Record<string, boolean> {
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const curYear = nowIST.getFullYear();
  const curMonth = nowIST.getMonth();
  const curDay = nowIST.getDate();

  const result: Record<string, boolean> = {};
  for (const m of months) {
    const d = new Date(m + 'T00:00:00+05:30');
    const mYear = d.getFullYear();
    const mMonth = d.getMonth();

    if (mYear < curYear || (mYear === curYear && mMonth < curMonth)) {
      result[m] = true;                       // past month
    } else if (mYear === curYear && mMonth === curMonth) {
      result[m] = true;                       // current month — always locked
    } else if (mYear === curYear && mMonth === curMonth + 1 && curDay > 15) {
      result[m] = true;                       // M+1 locked after 15th
    } else {
      result[m] = false;
    }
  }
  return result;
}
```

**Step 3: Run tests → PASS**

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: month lockout with IST timezone handling"
```

---

### Task 17: Frontend — Editable Grid with Real-Time Formulas

**Files:**
- Modify: `src/components/OtbGrid.tsx`
- Create: `src/hooks/useFormulaEngine.ts`

**Key changes:**
- NSQ, Inwards Qty, Perf Mktg % columns → `editable: true` (AG Grid)
- On `onCellValueChanged`: run `calculateAll()` client-side → update all calculated columns
- Month chaining: editing Month 1 recalculates closing stock → updates Month 2 opening stock → cascades
- Locked months from `getLockedMonths()`: cells greyed out with lock icon, `editable: false`
- Critical validations (BV-001 to BV-004): red cell border + tooltip on error
  - NSQ < 0, Inwards < 0, Perf Mktg outside 0-100, Closing Stock < 0
- Subtotal rows auto-recalculate when any child changes

**Commit:**

```bash
git add -A && git commit -m "feat: editable grid with real-time formulas, lockout, validations"
```

---

### Task 18: Auto-Save + Save Draft

**Files:**
- Create: `src/hooks/useAutoSave.ts`

**Logic:**
- Track dirty rows (changed since last save)
- Every 30 seconds: if dirty rows exist → call `POST /api/cycles/:id/plan-data/bulk-update`
- Show status: "Saving...", "All changes saved ✓", "Save failed ✗"
- Manual "Save Draft" button triggers immediate save
- Debounce: don't auto-save if user is actively typing (wait 2s after last edit)

**Commit:**

```bash
git add -A && git commit -m "feat: auto-save every 30s with status indicator"
```

---

### Task 19: Undo/Redo

**Files:**
- Create: `src/hooks/useUndoRedo.ts`

**Logic:**
- Stack of `{ rowId, month, field, oldValue, newValue }` entries
- Ctrl+Z → undo (restore old value, recalculate formulas)
- Ctrl+Y → redo
- Stack limit: 50 actions
- Clear redo stack when new edit is made

**Commit:**

```bash
git add -A && git commit -m "feat: undo/redo for grid edits"
```

---

### Task 20: Copy-Paste from Excel

**Files:**
- Modify: `src/components/OtbGrid.tsx`

**Logic:**
- AG Grid has built-in clipboard via `processDataFromClipboard`
- Parse pasted data, map to NSQ / Inwards / Perf Mktg % based on column position
- Run formula recalculation on all pasted rows
- Toast: "Pasted X rows"

**Commit:**

```bash
git add -A && git commit -m "feat: copy-paste from Excel support"
```

---

### Task 21: Bulk Edit Modal

**Files:**
- Create: `src/components/BulkEditModal.tsx`

**UI:**
- Button "Bulk Edit" on grid toolbar → AntD Modal
- Select: field (NSQ / Inwards / Perf Mktg %), months (checkboxes), % change (number input)
- Preview: list of affected rows with old → new values
- "Apply" → update all, recalculate formulas

**Commit:**

```bash
git add -A && git commit -m "feat: bulk edit modal with % change across months"
```

---

### Task 22: GD Assignment + Cycle Activation

**Files:**
- Create: `src/app/api/cycles/[cycleId]/assign-gd/route.ts`
- Modify: `src/app/cycles/[cycleId]/page.tsx`

**API:** `PUT /api/cycles/:cycleId/assign-gd` — Body: `{ gdId: "user-name-or-id" }`

**Frontend:** On cycle detail page, add GD assignment text input (since no auth yet, just a name/identifier) + "Activate Cycle" button.

**Commit:**

```bash
git add -A && git commit -m "feat: GD assignment and cycle activation UI"
```

---

### Task 23: Submission Workflow

**Files:**
- Create: `src/app/api/cycles/[cycleId]/submit/route.ts`
- Test: `tests/integration/planData.test.ts`

**API:** `POST /api/cycles/:cycleId/submit`

**Server logic:**
1. Validate cycle status is 'Filling'
2. Validate all unlocked months have nsq, inwardsQty, perfMarketingPct filled for every row
3. Validate no BV-001 to BV-004 errors (check all rows)
4. If valid: update cycle status → 'InReview', record submission timestamp
5. If errors: return `{ success: false, errors: [...] }`

**Frontend:** "Submit for Review" button on grid page. Confirmation modal. After submit, grid becomes read-only.

**Commit:**

```bash
git add -A && git commit -m "feat: submission workflow with pre-submit validation"
```

---

### Task 24: Version Control

**Files:**
- Create: `src/lib/versionService.ts`
- Create: `src/app/api/cycles/[cycleId]/versions/route.ts`
- Create: `src/components/VersionHistory.tsx`

**Logic:**
- On every save (auto or manual): create `version_history` record with full snapshot JSON
- Auto-increment version_number per cycle
- Auto-generate change_summary: "Updated NSQ for 3 rows in January"

**API:** `GET /api/cycles/:cycleId/versions` — list with version number, timestamp, summary

**Frontend:** Sidebar panel on grid page showing version list.

**Commit:**

```bash
git add -A && git commit -m "feat: version control with snapshot history"
```

---

### Task 25: Excel Import for GD Bulk Entry

**Files:**
- Create: `src/app/api/cycles/[cycleId]/import-excel/route.ts`
- Create: `src/app/api/cycles/[cycleId]/import-excel/apply/route.ts`
- Create: `src/components/ExcelImportPreview.tsx`

**Flow:**
1. GD uploads .xlsx with columns: sub_brand, sub_category, gender, channel, month, nsq, inwards_qty, perf_marketing_pct
2. Server parses, matches to existing plan rows by dimensions
3. Returns preview: `{ matched: [...], unmatched: [...], errors: [...] }`
4. GD reviews preview → clicks "Apply"
5. Server updates matched rows, runs formula recalculation, creates version

**Commit:**

```bash
git add -A && git commit -m "feat: Excel import with preview and apply"
```

---

### Task 26: Sprint 3-4 Integration Test

**Files:**
- Create: `tests/integration/gdWorkflow.test.ts`

**Full flow test:**
1. Create cycle, upload files, generate template, activate
2. Bulk update plan data (GD inputs)
3. Verify formula recalculation + month chaining
4. Verify month lockout rejects locked month edits
5. Verify BV-004 error on negative closing stock
6. Save → verify version created
7. Submit → verify status changes to InReview
8. Attempt edit after submit → rejected

**Commit:**

```bash
git add -A && git commit -m "test: Sprint 3-4 integration test — full GD workflow"
```

---

### Task 27: Sprint 3-4 Polish + Production Deploy

**Checklist:**
- [ ] Crore formatting correct (÷ 10^7 for all INR values)
- [ ] Percentage formatting (1 decimal)
- [ ] Quantity formatting (Indian thousand separators)
- [ ] Lock icon on locked month columns
- [ ] Red border + tooltip on validation errors
- [ ] Save status indicator in grid toolbar
- [ ] Submission confirmation modal
- [ ] Responsive layout at 1366×768 minimum
- [ ] All unit + integration tests passing
- [ ] Formula outputs match reference Excel file

**Production deploy:** Full flow works: Upload → Generate → Fill → Save → Submit.

**Commit:**

```bash
git add -A && git commit -m "feat: Sprint 3-4 complete — GD input, submission, version control"
```

---

## Task Dependency Graph

```
Sprint 1-2 (Weeks 1-4):

  Task 1: Scaffolding ──┐
  Task 2: Schema+Seed ──┤
  Task 3: Types ─────────┤── Foundation (parallelize all)
  Task 4: Formula Engine ┤
  Task 5: Upload Validator┘
  Task 6: Master Data API ──── depends on 1, 2
  Task 7: Cycle CRUD API ───── depends on 1, 2
  Task 8: File Upload API ──── depends on 1, 2, 5
  Task 9: Template Generator ── depends on 8, 7
  Task 10: Plan Data Read API ── depends on 9
  Task 11: Cycle UI Pages ────── depends on 6, 7
  Task 12: File Upload Page ──── depends on 8, 11
  Task 13: OTB Grid (read-only) ── depends on 10, 4
  Task 14: Integration Test ────── depends on all above

Sprint 3-4 (Weeks 5-8):

  Task 15: Bulk Update API ──── depends on 10, 4
  Task 16: Month Lockout ────── independent (pure function)
  Task 17: Editable Grid ────── depends on 13, 15, 16
  Task 18: Auto-Save ──────── depends on 17
  Task 19: Undo/Redo ─────── depends on 17
  Task 20: Copy-Paste ─────── depends on 17
  Task 21: Bulk Edit ─────── depends on 17
  Task 22: GD Assignment ──── depends on 7
  Task 23: Submission ──────── depends on 15, 16
  Task 24: Version Control ─── depends on 15
  Task 25: Excel Import ────── depends on 15
  Task 26: Integration Test ── depends on all above
  Task 27: Polish + Deploy ─── depends on all above
```

---

## Key Decisions & Rationale

| Decision | Rationale |
|----------|-----------|
| **Supabase** | Hosted PostgreSQL + Storage + built-in Auth (for Sprint 5-6). No Docker or infra management needed. |
| **Next.js App Router** | Full-stack in one project. API routes co-located with pages. SSR for initial load. Deploys easily to Vercel or self-hosted. |
| **`@supabase/supabase-js`** | Direct Supabase client — no ORM overhead. Type generation via `supabase gen types` for type safety. |
| **AG Grid Community** | Only free grid supporting nested row grouping + cell editing + clipboard + virtual scrolling (50K+ rows). |
| **Ant Design 5** | Enterprise-grade forms, modals, tables, upload components. Good for internal tools. |
| **Formula engine as pure functions** | Testable, runs identically on client (real-time) and server (on save). No side effects. |
| **No auth in Sprint 1-4** | Value-first: ship the working grid before adding access control. Supabase Auth retrofitted in Sprint 5-6. |
| **Client-side formulas + server recalculation** | Client-side for < 1s UX requirement. Server recalculates on save for data integrity. |
| **Version snapshots as JSON** | Simple, complete state capture. Enables revert without complex diff logic. |

---

## Supabase-Specific Notes

1. **Type generation:** Run `npx supabase gen types typescript --project-id <id> > src/types/supabase.ts` after schema changes for auto-generated types.

2. **Storage:** Files uploaded via `supabase.storage.from('otb-uploads').upload(path, file)`. Set bucket to private. Files retained for 30 days (set lifecycle policy).

3. **Row Level Security (RLS):** Disabled for Sprint 1-4 (no auth). Enabled in Sprint 5-6 with policies per role.

4. **Realtime:** Not used in Sprint 1-4. Could be used later for auto-save conflict resolution.

5. **Edge Functions:** Not needed — Next.js API routes handle all server logic.
