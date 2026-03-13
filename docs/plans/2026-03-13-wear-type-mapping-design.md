# Wear Type Mapping Design

## Problem

The template generator cross-products cycle `wear_types` with opening stock rows, creating meaningless combinations. There is no mapping between sub_brand × sub_category and wear_type. The uploaded CSVs have no wear_type column.

## Solution

A `wear_type_mappings` master data table at the `sub_brand × sub_category` level, with an admin CRUD UI. The template generator looks up wear_type from this table instead of cross-producting.

## Database

New table:

```sql
CREATE TABLE wear_type_mappings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sub_brand text NOT NULL,
  sub_category text NOT NULL,
  wear_type text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(sub_brand, sub_category)
);
```

RLS: Admin/Planning can read/write, all authenticated can read.

## API

- `GET /api/admin/wear-type-mappings` — list all mappings
- `POST /api/admin/wear-type-mappings` — upsert `{ sub_brand, sub_category, wear_type }`
- `DELETE /api/admin/wear-type-mappings/[id]` — delete a mapping

All gated by `manage_master_data` permission (Admin/Planning only).

## Admin UI

Page at `/admin/wear-type-mappings`:
- Ant Design table: Sub Brand (dropdown), Sub Category (dropdown), Wear Type (text input), Actions (delete)
- Add row form at top with dropdowns from sub_brands/sub_categories master tables
- Linked from existing admin navigation

## Template Generator Changes

1. Load all `wear_type_mappings` at generation time
2. For each opening stock row, look up wear_type by `(sub_brand, sub_category)`
3. If no mapping found, skip the row and collect as warning
4. Return warnings in response: "X rows skipped — missing wear_type mapping"
5. Remove the `cycle.wear_types` cross-product loop

## Cycle Creation Changes

- Make `wear_types` optional in cycle creation (keep column for backward compat)
- Remove "At least one wear type must be defined" check in activate endpoint

## Implementation Tasks

1. DB migration: create `wear_type_mappings` table + RLS policies
2. API routes: GET, POST (upsert), DELETE for mappings
3. Admin UI page: `/admin/wear-type-mappings`
4. Update template generator: replace cross-product with mapping lookup
5. Update cycle creation/activation: make wear_types optional
6. Seed data: add sample mappings
