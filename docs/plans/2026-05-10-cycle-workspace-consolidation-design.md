# Cycle Workspace Consolidation — Design

**Date:** 2026-05-10
**Status:** Approved (design phase)
**Branch:** Implementation to be done on a feature branch (e.g. `feat/cycle-workspace`); no merge to `master` until full approval.

## Problem

OTB workflow is spread across multiple top-level pages. From inside a cycle, a user has to bounce out to navigate between grid, actuals upload, and variance report. The standalone `/approvals` queue made sense when one user might approve across many brands, but everything is now brand-scoped (every user picks a brand at login; RLS enforces isolation), and a single user is rarely working on more than one OTB cycle at a time.

## Goals

1. A single workspace view per OTB cycle that houses uploads, defaults, grid, actuals, variance, and approvals.
2. Eliminate cross-page navigation for the common in-cycle flow.
3. Reframe approvals around brand-bounded discovery (the existing `/` zones-dashboard) rather than a global queue.
4. No data-model or RLS changes — UI consolidation only.

## Non-goals

- ReadOnly role behavior (deferred — not a priority role).
- Cross-brand notifications outside the dashboard.
- Mobile/responsive workspace layout.
- Re-enabling month-lockout (currently disabled for testing).

## Decisions

### D1 — Entry point

`/` zones-dashboard stays as-is. Only `/cycles/[cycleId]/*` consolidates. Cross-brand visibility for CXO/Admin already lives on the dashboard; rebuilding it inside the workspace was rejected.

### D2 — Information architecture

Lifecycle-aligned top tabs inside the workspace. Sticky-style cycle header sits above the tab bar with brand pill, status pipeline, and the lifecycle action button (Activate / Submit / Reopen).

### D3 — Tabs

**Setup · Plan · Review · Analyze** (4 tabs).

| Tab | Always visible | Contents |
|---|---|---|
| Setup | Yes | Reference Data · Defaults · Actuals (post-Approval, Admin/Planning only) |
| Plan | Yes | OTB Grid full-bleed |
| Review | Yes | ApprovalPanel + comments thread |
| Analyze | **Only when ≥1 actuals month is validated** | VarianceReport with its existing internal metric sub-tabs |

`Analyze` is named so the top-level label reads as the consumption surface; "variance" stays where it semantically belongs (inside the report's own sub-tabs).

### D4 — Default tab on entry

State first, role tiebreaker:

| Cycle status | Default tab |
|---|---|
| Draft | Setup |
| Filling | Plan |
| InReview | Review if `needs_my_approval`, else Plan (applies to all roles incl. GD; GD approval is required for every cycle) |
| Approved (no actuals) | Plan |
| Approved (with actuals) | Analyze |

`/cycles/<id>` (no `?tab=`) computes the default and `router.replace`s to add the param so the address bar is always explicit.

### D5 — Role behavior

| Tab | Admin | Planning | GD | Finance | CXO |
|---|---|---|---|---|---|
| Setup | Edit | Edit | Read-only | Read-only | Read-only |
| Plan | Edit | Read-only | Edit (Filling/InReview) | Read-only | Read-only |
| Review | Approve | Approve | Approve (own brand) | Approve | Approve |
| Analyze | View | View | View | View | View |

Tabs are uniform across roles (no per-role hiding). Edit/read-only is enforced inside each tab via existing permission helpers. The Setup tab's *Actuals* section is the one exception: rendered only for `upload_actuals` (Admin/Planning); fully absent otherwise.

### D6 — Approvals discovery

`/approvals` is deleted. Discovery happens via the `/` dashboard's existing "Pending Review" zone (with `needs_my_approval` pill on each `BrandPanel`). Action happens in the workspace `Review` tab. Single canonical path: see-on-dashboard → act-in-workspace.

### D7 — URL strategy

Single route + query param. Canonical URL is `/cycles/<id>?tab={setup|plan|review|analyze}`. The current sub-route directories (`/upload`, `/defaults`, `/grid`, `/actuals`, `/variance`) are deleted outright — no external URL consumers exist. Tab switches use `router.replace` (view-state, not navigation); browser back leaves the cycle rather than unwinding through tabs.

### D8 — Setup tab structure

Three stacked collapsible cards:

1. **Reference Data** — 10 file types, status pills, upload action (Admin/Planning, Draft/Filling). Default-open in Draft.
2. **Defaults** — `CycleDefaultsReview` inline. Default-open in Draft if not yet confirmed.
3. **Actuals** — only renders for Admin/Planning when `cycle.status === 'Approved'`. Default-open if no actuals yet.

### D9 — Lazy mount, persistent state

Each tab's content mounts on first activation. Once mounted, inactive tabs stay in the DOM via `display: none` rather than unmounting — this preserves AG Grid scroll/filter state and Variance metric selection across tab switches.

## Routes after the change

| Route | Behavior |
|---|---|
| `/` | Unchanged (zones dashboard) |
| `/cycles` | Unchanged (cycles list) |
| `/cycles/[cycleId]` | New unified workspace; auto-resolves default `?tab=` |
| `/cycles/[cycleId]?tab=setup\|plan\|review\|analyze` | Tab selection |
| `/approvals` | **Deleted** |
| `/cycles/[cycleId]/upload\|defaults\|grid\|actuals\|variance` | **Deleted** |

Sidebar nav loses the Approvals item: Dashboard · OTB Cycles · (Admin section).

## Components

**Reused unchanged inside tabs:**
`OtbGrid`, `VarianceReport`, `ApprovalPanel`, `CycleDefaultsReview`, `BulkEditModal`, `ImportGdModal`, `ValidationReport`, `StatusPipeline`.

**New / extracted:**
- `CycleWorkspace` — top-level page component; owns tab routing and shell.
- `CycleHeader` — brand pill, status pipeline, metadata, lifecycle action button.
- `FileUploadsCard` — extracted from current `cycles/[cycleId]/page.tsx`.
- `ActualsUploadCard` — extracted from current `cycles/[cycleId]/actuals/page.tsx`.

**Deleted:**
`ApprovalDashboard.tsx`, the five sub-route `page.tsx` files, `/approvals/page.tsx`, the outbound action buttons in the current `CycleDetailPage`.

## Dashboard linkage

`BrandPanel` link targets update:
- "Pending Review" zone → `/cycles/<id>?tab=review`
- "Approved Plans" zone → `/cycles/<id>?tab=plan`
- "Actuals vs Plan" zone → `/cycles/<id>?tab=analyze`

The `needs_my_approval` pill on a panel is the surface that replaces `/approvals` as the discovery hint.

## Risks & mitigations

| Risk | Status |
|---|---|
| External URL consumers (emails/bookmarks) | None exist (user-confirmed). Safe to delete old routes. |
| `withAuth` API contracts | Untouched — UI relocation only. |
| RLS policies | Untouched. |
| Audit log URL emissions | Audit logs record action + entity, not URLs. No change. |
| Brand-scoping | Inherited from existing `BrandContext` + RLS. |
| AG Grid heaviness | Lazy-mount on first Plan-tab activation; persists thereafter. |
| Reload / share-links | `?tab=` param ensures exact view reproduces. |
| Browser back behavior | Tab switches use `router.replace`; back leaves the cycle. |

## Migration plan (high-level — detailed plan in writing-plans phase)

1. Branch off `master` (e.g. `feat/cycle-workspace`).
2. Build `CycleWorkspace` shell with tab routing.
3. Extract `FileUploadsCard` and `ActualsUploadCard` from existing pages.
4. Compose Setup / Plan / Review / Analyze tabs from existing components.
5. Update dashboard `BrandPanel` link targets to `?tab=` URLs.
6. Delete dead routes and `ApprovalDashboard`.
7. Remove Approvals from sidebar.
8. Smoke-test all 5 roles × all cycle statuses.
9. Open PR; merge only after full approval.
