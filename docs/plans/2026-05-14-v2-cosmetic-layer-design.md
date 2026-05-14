# V2 Cosmetic Layer — Design Doc

**Date:** 2026-05-14  
**Goal:** CEO demo variant of the OTB platform accessible at `/v2/*`, using the WMS Design System (warm-neutral, Inter, terra-cotta primary). Zero changes to existing routes or functionality.

---

## Architecture

New `src/app/v2/` directory — a parallel Next.js App Router route tree. Existing routes under `src/app/` are untouched.

```
src/app/v2/
├── layout.tsx                  ← V2AppLayout (design system, no Ant Design)
├── globals-v2.css              ← Full design system CSS (DESIGN_SYSTEM.md §21)
├── page.tsx                    ← V2 Dashboard
├── cycles/
│   ├── page.tsx                ← V2 Cycles list
│   └── [cycleId]/
│       └── page.tsx            ← Wraps existing <CycleWorkspace> unchanged
└── login/
    └── page.tsx                ← V2 Login
```

URL switching: navigate to `/v2` instead of `/`. No middleware, no feature flags.

---

## Layout Shell — V2AppLayout

Replaces Ant Design `Layout/Sider/Header` with design system pattern.

**Sidebar (fixed, 260px):**
- Background: `var(--sidebar-bg)` = `#FFFFFF`, border-right: `var(--sidebar-border)`
- Logo section: TMRW logo + "OTB Platform" subtitle
- Nav items: Dashboard (`/v2`), OTB Cycles (`/v2/cycles`), Wiki (`/v2/wiki`)
- Admin items (conditional on role): Users, Master Data, Defaults, Audit Logs — links to `/v2/admin/*`
- Active state: `var(--sidebar-active-bg)` bg, `var(--sidebar-active)` text, dot indicator on right
- User footer: initials avatar in `--primary-light` circle, name + role, sign-out button

**Top header (56px):**
- Background: `var(--surface)`, border-bottom: `var(--border)`
- Left: selected brand name + Switch button (links to `/brand-select?returnTo=/v2/...`)
- Right: user initials avatar + name, dropdown with role + Sign Out

**Page content:**
- `marginLeft: var(--sidebar-width)`, padding `28px 36px`
- Background: `var(--bg)` = `#FAF9F6`

**Brand gate:** Same logic as existing AppLayout — checks `sessionStorage` key, redirects to `/brand-select?returnTo=<v2-path>` if not set. Brand-select page is shared (not duplicated).

**Auth guard:** If no profile, renders children (login page handles itself).

---

## Pages

### V2 Login (`/v2/login`)

- Full-viewport centered layout on terra-cotta gradient bg
- `.card` with logo, title, design system `<input>` fields, `.btn-primary` submit
- Same `supabase.auth.signInWithPassword()` call
- On success: `window.location.href = '/brand-select?returnTo=/v2'`

### V2 Cycles List (`/v2/cycles`)

- `.page-header` with "OTB Cycles" h1 + "New Cycle" `.btn-primary` (links to `/cycles/new`)
- Four `.stat-card` elements in a CSS grid for Draft / Filling / InReview / Approved counts
- HTML `<table>` inside `.card-flat` (overflow hidden, padding 0) with `.badge-*` status pills
- Same `fetch('/api/cycles?brandId=...')` call as existing page

Status → badge mapping:
| Status | Badge |
|---|---|
| Draft | `badge-gray` |
| Filling | `badge-yellow` |
| InReview | `badge-blue` |
| Approved | `badge-green` |

Cycle name links to `/v2/cycles/[id]` (GD role: `?tab=plan`).

### V2 Dashboard (`/v2`)

- `.page-header` with quarter title + Refresh button
- Six `.stat-card`s in `repeat(auto-fit, minmax(160px, 1fr))` grid for GMV, NSV, NSQ, Inwards, Avg DoH, Closing Stock
- Sections: Pending Inputs (GD only), Pending Review, Approved Plans, Actuals vs Plan
- Each section uses `.card` with brand name, status badge, and action buttons
- Same `useDashboardData` hook, same `formatCrore` / `formatQty` formatting

### V2 Cycle Detail (`/v2/cycles/[cycleId]`)

No UI changes. Three-line file: imports and renders `<CycleWorkspace cycleId={cycleId} />`. The new layout chrome (sidebar, header, background) wraps it.

---

## CSS Strategy

`globals-v2.css` is the verbatim DESIGN_SYSTEM.md §21 stylesheet, imported only in `src/app/v2/layout.tsx`. It does not affect the root layout or any existing page.

Ant Design is NOT imported in any v2 file. V2 pages use:
- CSS class names from `globals-v2.css` (`.btn-primary`, `.card`, `.badge-green`, etc.)
- Inline `style={{}}` for layout specifics
- No Tailwind, no CSS Modules

---

## What Is Untouched

- All files under `src/app/` except new `src/app/v2/` directory
- All API routes (`/api/*`)
- All hooks, contexts, lib utilities
- `CycleWorkspace` and its sub-components (AG Grid, tabs, uploads)
- Auth flow, Supabase clients, brand selection gate
- Existing `globals.css`, Ant Design theme, `antdTheme.ts`
