# GD Assignment at Cycle Creation

**Date:** 2026-04-29

## Problem

GD assignment currently happens as a separate step on the cycle detail page after the cycle is created. This is unnecessary friction — the brand is known at creation time, so the GD can (and should) be assigned then.

## Design

### New Cycle Form (`/cycles/new`)

Add a required **Assign GD** dropdown below the Brand field. Behaviour:

- On load, fetch all active GD users from `/api/admin/users`
- When a brand is selected (or pre-filled from context), filter the GD list to users whose `assigned_brands` includes that brand ID
- If the filtered list has exactly one entry, auto-select it
- If brand changes, reset GD selection and reload filtered options
- Field is required — form cannot submit without a GD selected

### API — POST `/api/cycles`

Accept `assigned_gd_id` in the request body alongside the existing fields. Validate it is a non-empty string and persist it in the INSERT statement. No separate assign-gd call is needed.

### Cycle Detail Page

Remove the "Select GD / Assign" UI section entirely. The `assigned_gd_id` field on `canActivate` is unchanged — it will always be satisfied since creation now enforces it.

### assign-gd Endpoint

Keep `POST /api/cycles/:cycleId/assign-gd` for future admin re-assignment (e.g. GD change mid-cycle). No UI is needed for this now.

## Files Changed

| File | Change |
|------|--------|
| `src/app/cycles/new/page.tsx` | Add GD dropdown, brand-filtered, auto-select, required |
| `src/app/api/cycles/route.ts` | Accept + save `assigned_gd_id` in POST |
| `src/app/cycles/[cycleId]/page.tsx` | Remove Select GD + Assign button section |
