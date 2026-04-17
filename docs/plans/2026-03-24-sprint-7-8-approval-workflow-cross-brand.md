# Sprint 7-8: Approval Workflow & Cross-Brand Summary

**PRD Sections:** 9, FR-4.1 through FR-4.4
**Branch:** `feature/approval-workflow-cross-brand`

## Architecture Overview

### Approval Workflow (4-Party Unanimous)
- **Roles:** Planning, GD, Finance, CXO — all must approve
- **State Machine:** Cycle status transitions:
  - `Filling` → `InReview` (on submit, creates 4 approval_tracking rows)
  - `InReview` → `Approved` (when all 4 roles approve)
  - `InReview` → `Filling` (any revision request resets ALL approvals)
  - `Approved` → `InReview` (GD reopen, resets all approvals)

### Database Schema (Migration 010)
- **approval_tracking:** cycle_id, role, user_id, status ('Pending'|'Approved'|'RevisionRequested'), comment, decided_at; UNIQUE(cycle_id, role)
- **comments:** id, cycle_id, parent_id (threading), comment_type ('brand'|'metric'|'general'), row_id, month, field, text, author_id, author_name, author_role, created_at
- RLS policies for both tables

### Risk Indicators
- DoH > 60 days → yellow warning
- GM% < category average → red alert
- Inwards > LY by 25%+ → yellow warning

---

## Tasks

### Sprint 7: Approval Workflow (Tasks 1-10)

#### Task 1: Approval Types & Engine (Pure Functions)
**Files:**
- `src/types/otb.ts` — Add: `ApproverRole`, `ApprovalStatus`, `ApprovalRecord`, `OtbComment`, `CommentType`
- `src/lib/approvalEngine.ts` — New: `APPROVER_ROLES`, `getApprovalSummary()`, `shouldCycleBeApproved()`, `shouldCycleRevertToFilling()`, `canUserApprove()`
- `tests/unit/approvalEngine.test.ts` — Unit tests for all pure functions

**Details:**
- `ApproverRole = 'Planning' | 'GD' | 'Finance' | 'CXO'`
- `ApprovalStatus = 'Pending' | 'Approved' | 'RevisionRequested'`
- `ApprovalRecord = { cycle_id, role: ApproverRole, user_id?, status: ApprovalStatus, comment?, decided_at? }`
- `OtbComment = { id, cycle_id, parent_id?, comment_type: CommentType, row_id?, month?, field?, text, author_id, author_name, author_role, created_at }`
- `shouldCycleBeApproved()` returns true when all 4 roles have status='Approved'
- `shouldCycleRevertToFilling()` returns true when any role has status='RevisionRequested'
- `canUserApprove(userRole, approvalRecords)` checks if user's role hasn't already decided

**Depends on:** Nothing (can start immediately)

#### Task 2: Database Migration 010 — Approval & Comments Tables
**Files:**
- `supabase/migrations/010_approval_comments.sql`

**Details:**
```sql
-- approval_tracking table
CREATE TABLE approval_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cycle_id UUID NOT NULL REFERENCES otb_cycles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('Planning', 'GD', 'Finance', 'CXO')),
  user_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'RevisionRequested')),
  comment TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cycle_id, role)
);

-- comments table
CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cycle_id UUID NOT NULL REFERENCES otb_cycles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id),
  comment_type TEXT NOT NULL CHECK (comment_type IN ('brand', 'metric', 'general')),
  row_id UUID REFERENCES otb_plan_rows(id),
  month TEXT,
  field TEXT,
  text TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_approval_tracking_cycle ON approval_tracking(cycle_id);
CREATE INDEX idx_comments_cycle ON comments(cycle_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);
CREATE INDEX idx_comments_row ON comments(row_id);

-- RLS policies (using get_user_role() helper)
ALTER TABLE approval_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- approval_tracking: users with approve_otb can read; can update own role's row
-- comments: authenticated users can read; authors can insert
```

**Depends on:** Nothing (can run in parallel with Task 1)

#### Task 3: Update Submit Endpoint — Initialize Approval Rows
**Files:**
- `src/app/api/cycles/[cycleId]/submit/route.ts` — Modify: after status transition to InReview, INSERT 4 approval_tracking rows

**Details:**
- After existing `Filling → InReview` transition, insert 4 rows into approval_tracking with status='Pending' for each APPROVER_ROLE
- Use upsert to handle resubmission (reset existing rows to Pending)
- Add audit log entry for submission

**Depends on:** Task 2

#### Task 4: Approve/Revision API Endpoint
**Files:**
- `src/app/api/cycles/[cycleId]/approve/route.ts` — New POST endpoint

**Details:**
- `withAuth('approve_otb')` wrapper
- Request body: `{ action: 'approve' | 'revision_requested', comment?: string }`
- Validates: cycle is InReview, user's role hasn't already decided
- Updates approval_tracking row for user's role
- After update, check `shouldCycleBeApproved()` → transition to Approved
- Check `shouldCycleRevertToFilling()` → reset ALL rows to Pending, transition to Filling
- Audit log for each action

**Depends on:** Tasks 1, 2

#### Task 5: Approval Status API Endpoint
**Files:**
- `src/app/api/cycles/[cycleId]/approval-status/route.ts` — New GET endpoint

**Details:**
- `withAuth('view_cycle')` wrapper
- Returns all 4 approval_tracking rows for the cycle
- Include user names via join with profiles table

**Depends on:** Task 2

#### Task 6: Approval Panel UI Component
**Files:**
- `src/components/ApprovalPanel.tsx` — New component

**Details:**
- Displays 4 approval cards (one per role): icon, role name, status badge, approver name, timestamp
- Shows approve/revision_requested buttons for current user's role (if not yet decided)
- Revision requires a comment (modal with textarea)
- Color-coded: green=Approved, yellow=Pending, red=RevisionRequested
- Integrated above the OTB grid on the cycle detail page

**Depends on:** Tasks 4, 5

#### Task 7: Integrate Approval Panel into Grid Page
**Files:**
- `src/app/cycles/[cycleId]/grid/page.tsx` — Modify to include ApprovalPanel when cycle is InReview or Approved

**Details:**
- Conditionally render ApprovalPanel above grid when status is InReview or Approved
- Disable grid editing when status is InReview or Approved
- Show status banner

**Depends on:** Task 6

#### Task 8: Reopen Mechanism (GD Only)
**Files:**
- `src/app/api/cycles/[cycleId]/reopen/route.ts` — New POST endpoint
- `src/lib/auth/roles.ts` — Add `request_reopen` permission for GD and Admin

**Details:**
- `withAuth('request_reopen')` wrapper
- Only works when cycle is Approved
- Transitions Approved → InReview, resets all approval_tracking rows to Pending
- Requires comment explaining why reopen is needed
- Audit log entry

**Depends on:** Tasks 2, 4

#### Task 9: Risk Indicators Engine
**Files:**
- `src/lib/riskIndicators.ts` — New pure function module
- `tests/unit/riskIndicators.test.ts` — Unit tests

**Details:**
- `getRiskFlags(cycleData)` → array of `{ level: 'yellow' | 'red', metric, message }`
- Thresholds: DoH > 60 days (yellow), GM% < category avg (red), Inwards > LY by 25% (yellow)
- Pure function, no DB access

**Depends on:** Nothing (can start immediately)

#### Task 10: New Permissions in RBAC
**Files:**
- `src/lib/auth/roles.ts` — Add permissions: `view_cross_brand_summary`, `request_reopen`, `export_otb`

**Details:**
- `view_cross_brand_summary`: Admin, CXO, Finance, Planning
- `request_reopen`: GD, Admin
- `export_otb`: All roles except ReadOnly

**Depends on:** Nothing (can start immediately)

### Sprint 8: Cross-Brand Summary, Comments & Export (Tasks 11-18)

#### Task 11: Approval Dashboard API
**Files:**
- `src/app/api/approvals/dashboard/route.ts` — New GET endpoint

**Details:**
- `withAuth('approve_otb')` wrapper
- Aggregates across all active cycles the user has access to (brand-scoped)
- Returns: total cycles, pending count, approved count, per-brand breakdown with risk flags
- Joins otb_cycles + approval_tracking + profiles

**Depends on:** Tasks 2, 9

#### Task 12: Approval Dashboard Page
**Files:**
- `src/app/approvals/page.tsx` — New page
- `src/components/ApprovalDashboard.tsx` — New component

**Details:**
- Summary cards at top: Total Cycles, Pending Approval, Approved, Revision Requested
- Brand table: brand name, cycle status, approval progress (2/4), risk indicators, last updated
- Click brand row → navigate to cycle grid page
- Filter by status, brand
- Uses Ant Design Table + Card components

**Depends on:** Task 11

#### Task 13: Cross-Brand Summary API
**Files:**
- `src/app/api/summary/route.ts` — New GET endpoint

**Details:**
- `withAuth('view_cross_brand_summary')` wrapper
- Aggregates OTB metrics across all active cycles: total NSR, total COGS, avg GM%, total inwards qty, avg DoH
- Per-brand breakdown with same metrics
- Month-wise aggregation for trend visualization
- Optional: PostgreSQL function `get_cycle_summary()` for performance

**Depends on:** Task 10

#### Task 14: Cross-Brand Summary Page
**Files:**
- `src/app/summary/page.tsx` — New page
- `src/components/CrossBrandSummary.tsx` — New component

**Details:**
- Top-level KPI cards: Total NSR, Total COGS, Avg GM%, Total Inwards, Avg DoH
- Brand comparison table: each brand's metrics side by side
- Optional: simple bar charts using Ant Design or recharts
- Filters: quarter, month range

**Depends on:** Task 13

#### Task 15: Export Engine (ExcelJS)
**Files:**
- `src/lib/exportEngine.ts` — New module
- `src/app/api/cycles/[cycleId]/export/route.ts` — New GET endpoint
- `tests/unit/exportEngine.test.ts` — Unit tests

**Details:**
- `buildOtbWorkbook(cycleData, approvalRecords, comments)` → ExcelJS Workbook
- 3 sheets: "OTB Plan" (grid data), "Approval Status" (4 rows), "Comments" (all comments)
- Formatting: headers, column widths, number formats (crore, %, qty)
- API endpoint: `withAuth('export_otb')`, streams workbook as .xlsx download
- Content-Disposition header for filename: `OTB_{brand}_{quarter}.xlsx`

**Depends on:** Tasks 5, existing grid data APIs

#### Task 16: Comments API & Panel
**Files:**
- `src/app/api/cycles/[cycleId]/comments/route.ts` — New GET/POST endpoint
- `src/components/CommentsPanel.tsx` — New component

**Details:**
- GET: fetch all comments for cycle, ordered by created_at, with threading (parent_id)
- POST: `withAuth('view_cycle')`, create comment with type, optional row_id/month/field
- CommentsPanel: Ant Design Drawer, opens from right side of grid page
- Comment types: general (freeform), metric (linked to cell — row_id + month + field), brand (top-level)
- Threading: reply to comment creates child with parent_id
- Show author name, role badge, timestamp
- Button in grid toolbar to toggle drawer

**Depends on:** Task 2

#### Task 17: Navigation Updates
**Files:**
- `src/components/AppLayout.tsx` — Add menu items for Approvals and Cross-Brand Summary

**Details:**
- Add "Approvals" menu item → `/approvals` (visible to roles with `approve_otb`)
- Add "Summary" menu item → `/summary` (visible to roles with `view_cross_brand_summary`)
- Add ExportButton to grid page toolbar

**Depends on:** Tasks 12, 14

#### Task 18: Integration Tests
**Files:**
- `tests/integration/approvalWorkflow.test.ts` — End-to-end approval flow
- `tests/integration/comments.test.ts` — Comments CRUD + threading

**Details:**
- Approval flow: submit → 4 approvals → cycle approved
- Revision flow: submit → 1 revision → all reset → cycle back to Filling
- Reopen flow: approved → GD reopen → back to InReview
- Comments: create, reply, fetch threaded, delete

**Depends on:** Tasks 1-16

---

## Dependency Graph & Parallelization

```
Parallel Wave 1 (no dependencies):
  Task 1  (approval engine)
  Task 2  (migration 010)
  Task 9  (risk indicators)
  Task 10 (new permissions)

Wave 2 (depends on Wave 1):
  Task 3  (submit init)       → depends on 2
  Task 4  (approve API)       → depends on 1, 2
  Task 5  (approval status)   → depends on 2
  Task 8  (reopen API)        → depends on 2, 4
  Task 16 (comments)          → depends on 2

Wave 3 (depends on Wave 2):
  Task 6  (approval panel)    → depends on 4, 5
  Task 11 (dashboard API)     → depends on 2, 9
  Task 13 (summary API)       → depends on 10
  Task 15 (export engine)     → depends on 5

Wave 4 (depends on Wave 3):
  Task 7  (grid integration)  → depends on 6
  Task 12 (dashboard page)    → depends on 11
  Task 14 (summary page)      → depends on 13
  Task 17 (navigation)        → depends on 12, 14

Wave 5:
  Task 18 (integration tests) → depends on 1-16
```

## Execution Strategy

Use `superpowers:executing-plans` skill. Leverage `superpowers:dispatching-parallel-agents` for Wave 1 (Tasks 1, 2, 9, 10 in parallel) and within subsequent waves where tasks are independent.

Each task follows TDD where applicable — write tests first for pure function modules (Tasks 1, 9, 15).
