# Cycle Workspace Consolidation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate the per-cycle workflow into a single workspace at `/cycles/[cycleId]` with 4 tabs (Setup, Plan, Review, Analyze), delete the standalone `/approvals` page and the five `/cycles/[cycleId]/<segment>` sub-routes, and re-point dashboard links.

**Architecture:** Single-page workspace using `?tab=` query param for view-state. Tabs lazy-mount on first activation and persist via `display: none` to preserve heavy AG Grid + Variance state across switches. Default tab is computed from cycle status with a role-driven tiebreaker (Review when `needs_my_approval`). The `/` zones-dashboard remains the cross-brand approvals discovery surface.

**Tech Stack:** Next.js 16 App Router, TypeScript, Ant Design 6, AG Grid Community 35, Vitest (unit), React Testing Library (component).

**Design doc:** [docs/plans/2026-05-10-cycle-workspace-consolidation-design.md](docs/plans/2026-05-10-cycle-workspace-consolidation-design.md)

**Branch:** All work on `feat/cycle-workspace`. No merge to `master` until full approval.

---

## Pre-flight

### Task 0: Create feature branch

**Step 1: Confirm clean working tree (or stash)**

Run: `git status`
Expected: working tree clean OR known WIP changes acknowledged.

**Step 2: Create and switch to feature branch from master**

Run: `git checkout -b feat/cycle-workspace master`
Expected: `Switched to a new branch 'feat/cycle-workspace'`

**Step 3: Verify**

Run: `git rev-parse --abbrev-ref HEAD`
Expected: `feat/cycle-workspace`

No commit on this task.

---

## Phase 1 — Pure logic with tests (TDD)

### Task 1: Default-tab resolver

**Files:**
- Create: `src/lib/cycleWorkspace/defaultTab.ts`
- Test: `tests/unit/cycleWorkspace/defaultTab.test.ts`

**Step 1: Write failing tests**

Create `tests/unit/cycleWorkspace/defaultTab.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveDefaultTab, type WorkspaceTab } from '@/lib/cycleWorkspace/defaultTab';
import type { CycleStatus } from '@/types/otb';

describe('resolveDefaultTab', () => {
  it('Draft → setup', () => {
    expect(resolveDefaultTab({ status: 'Draft', needsMyApproval: false, hasActuals: false })).toBe<WorkspaceTab>('setup');
  });

  it('Filling → plan', () => {
    expect(resolveDefaultTab({ status: 'Filling', needsMyApproval: false, hasActuals: false })).toBe('plan');
  });

  it('InReview without my approval → plan', () => {
    expect(resolveDefaultTab({ status: 'InReview', needsMyApproval: false, hasActuals: false })).toBe('plan');
  });

  it('InReview with my approval → review', () => {
    expect(resolveDefaultTab({ status: 'InReview', needsMyApproval: true, hasActuals: false })).toBe('review');
  });

  it('Approved without actuals → plan', () => {
    expect(resolveDefaultTab({ status: 'Approved', needsMyApproval: false, hasActuals: false })).toBe('plan');
  });

  it('Approved with actuals → analyze', () => {
    expect(resolveDefaultTab({ status: 'Approved', needsMyApproval: false, hasActuals: true })).toBe('analyze');
  });

  it('unknown status → setup as safe fallback', () => {
    expect(resolveDefaultTab({ status: 'Unknown' as CycleStatus, needsMyApproval: false, hasActuals: false })).toBe('setup');
  });
});
```

**Step 2: Run to confirm failure**

Run: `cd otb-automation && npx vitest run tests/unit/cycleWorkspace/defaultTab.test.ts`
Expected: `Cannot find module '@/lib/cycleWorkspace/defaultTab'`

**Step 3: Implement**

Create `src/lib/cycleWorkspace/defaultTab.ts`:

```typescript
import type { CycleStatus } from '@/types/otb';

export type WorkspaceTab = 'setup' | 'plan' | 'review' | 'analyze';

export interface DefaultTabInputs {
  status: CycleStatus;
  needsMyApproval: boolean;
  hasActuals: boolean;
}

export function resolveDefaultTab({ status, needsMyApproval, hasActuals }: DefaultTabInputs): WorkspaceTab {
  switch (status) {
    case 'Draft':    return 'setup';
    case 'Filling':  return 'plan';
    case 'InReview': return needsMyApproval ? 'review' : 'plan';
    case 'Approved': return hasActuals ? 'analyze' : 'plan';
    default:         return 'setup';
  }
}
```

**Step 4: Run tests**

Run: `cd otb-automation && npx vitest run tests/unit/cycleWorkspace/defaultTab.test.ts`
Expected: PASS (7 tests)

**Step 5: Commit**

```bash
git add src/lib/cycleWorkspace/defaultTab.ts tests/unit/cycleWorkspace/defaultTab.test.ts
git commit -m "feat(workspace): default-tab resolver with tests"
```

---

### Task 2: Analyze-visibility helper

**Files:**
- Create: `src/lib/cycleWorkspace/tabVisibility.ts`
- Test: `tests/unit/cycleWorkspace/tabVisibility.test.ts`

**Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { isAnalyzeTabVisible } from '@/lib/cycleWorkspace/tabVisibility';
import type { FileUpload } from '@/types/otb';

const actualsValidated: FileUpload = { file_type: 'actuals', status: 'validated' } as FileUpload;
const actualsFailed:    FileUpload = { file_type: 'actuals', status: 'failed' }    as FileUpload;
const referenceValidated: FileUpload = { file_type: 'ly_sales', status: 'validated' } as FileUpload;

describe('isAnalyzeTabVisible', () => {
  it('hidden when no uploads', () => {
    expect(isAnalyzeTabVisible([])).toBe(false);
  });
  it('hidden when only reference uploads validated', () => {
    expect(isAnalyzeTabVisible([referenceValidated])).toBe(false);
  });
  it('hidden when actuals exist but failed', () => {
    expect(isAnalyzeTabVisible([actualsFailed])).toBe(false);
  });
  it('visible when at least one validated actuals row exists', () => {
    expect(isAnalyzeTabVisible([referenceValidated, actualsValidated])).toBe(true);
  });
});
```

**Step 2: Run to confirm failure**

Run: `cd otb-automation && npx vitest run tests/unit/cycleWorkspace/tabVisibility.test.ts`
Expected: module-not-found error.

**Step 3: Implement**

```typescript
import type { FileUpload } from '@/types/otb';

export function isAnalyzeTabVisible(uploads: FileUpload[]): boolean {
  return uploads.some(u => u.file_type === 'actuals' && u.status === 'validated');
}
```

**Step 4: Run tests**

Run: `cd otb-automation && npx vitest run tests/unit/cycleWorkspace/tabVisibility.test.ts`
Expected: PASS (4 tests).

**Step 5: Commit**

```bash
git add src/lib/cycleWorkspace/tabVisibility.ts tests/unit/cycleWorkspace/tabVisibility.test.ts
git commit -m "feat(workspace): analyze-tab visibility helper"
```

---

## Phase 2 — Component extractions

For each extraction, the strategy is identical: lift the page's component body into a new `*Card`/`*Tab` component that takes `cycleId` (and any needed callbacks) as props. The original page file stays untouched until Phase 5. This lets us build the workspace without breaking anything live.

### Task 3: Extract `FileUploadsCard`

**Files:**
- Source: `src/app/cycles/[cycleId]/upload/page.tsx`
- Create: `src/components/cycle-workspace/FileUploadsCard.tsx`

**Step 1: Read the entire source page**

Run: `wc -l src/app/cycles/[cycleId]/upload/page.tsx`
Note line count.

**Step 2: Create the new component**

Copy the full body of `UploadPage` into `FileUploadsCard`. Changes needed:
- Component signature: `export function FileUploadsCard({ cycleId }: { cycleId: string })`. Drop `useParams`.
- Drop `<ProtectedRoute>` wrapping (the page-level route guard goes away; permission checks happen via `useAuth`/`hasPermission` inline).
- Drop the `← Back to Cycle` link header (workspace owns the back nav).
- Wrap the body in a single `<Card>` titled "Reference Data — N/M validated" with a `Collapse`-style chevron. Use Ant Design `Card` with `extra` slot for the count badge.
- Default-open state: open if `cycleStatus === 'Draft'` else collapsed.
- Keep the upload-modal logic, validation report rendering, and template-generation flow intact.

**Step 3: Verify it imports cleanly**

Run: `cd otb-automation && npx tsc --noEmit`
Expected: no errors related to the new file. (Other errors fine if pre-existing.)

**Step 4: Commit**

```bash
git add src/components/cycle-workspace/FileUploadsCard.tsx
git commit -m "feat(workspace): extract FileUploadsCard from upload page"
```

---

### Task 4: Extract `ActualsUploadCard`

**Files:**
- Source: `src/app/cycles/[cycleId]/actuals/page.tsx`
- Create: `src/components/cycle-workspace/ActualsUploadCard.tsx`

**Step 1: Copy ActualsUploadPage body**

Component signature: `export function ActualsUploadCard({ cycleId }: { cycleId: string })`.

Changes:
- Drop `useParams`, `<ProtectedRoute>`, the `← Back to Cycle` link header, and the "View Variance Report" button (Variance is now a sibling tab — the workspace handles tab switching).
- Wrap content in a `Card` titled "Actuals" with a `Collapse` chevron.
- Default-open if no successful upload yet, collapsed after first success.
- After a successful upload, dispatch a callback `onActualsUploaded?: () => void` so the workspace can refetch upload status (and reveal the Analyze tab).

**Step 2: Verify**

Run: `cd otb-automation && npx tsc --noEmit`
Expected: no new type errors.

**Step 3: Commit**

```bash
git add src/components/cycle-workspace/ActualsUploadCard.tsx
git commit -m "feat(workspace): extract ActualsUploadCard from actuals page"
```

---

### Task 5: Extract `PlanTabContent`

**Files:**
- Source: `src/app/cycles/[cycleId]/grid/page.tsx`
- Create: `src/components/cycle-workspace/PlanTabContent.tsx`

The grid page is the largest extraction. It owns AG Grid setup, formula engine wiring, autosave, undo/redo, comments panel, version history, bulk-edit, import-GD, and submit/approve actions.

**Step 1: Read full source**

Run: `wc -l src/app/cycles/[cycleId]/grid/page.tsx`
Note line count and skim the imports/state.

**Step 2: Copy body into new component**

Signature: `export function PlanTabContent({ cycleId }: { cycleId: string })`.

Changes:
- Drop `useParams`.
- Drop the `← Back to Cycle` link in the header.
- Keep the toolbar (save, edit, submit, import-GD, export, comments, version-history, undo/redo) — that strip will sit directly under the workspace tab bar.
- The `<ApprovalPanel>` import and its rendering on this page are removed: approvals move to their own tab.
- Keep all hooks (`useFormulaEngine`, `useAutoSave`, `useUndoRedo`, `useAuth`) and all modals.
- Component returns: a `<div>` containing the toolbar and the `<OtbGrid>`. No outer card; full-bleed.

**Step 3: Verify**

Run: `cd otb-automation && npx tsc --noEmit`
Expected: no errors related to the new file.

**Step 4: Commit**

```bash
git add src/components/cycle-workspace/PlanTabContent.tsx
git commit -m "feat(workspace): extract PlanTabContent from grid page"
```

---

### Task 6: Build `ReviewTabContent`

**Files:**
- Create: `src/components/cycle-workspace/ReviewTabContent.tsx`

This is a fresh assembly — there's no prior page to extract from (approvals were rendered inside the grid page or on `/approvals`).

**Step 1: Compose**

```typescript
'use client';

import { ApprovalPanel } from '@/components/ApprovalPanel';
import { CommentsPanel } from '@/components/CommentsPanel';
import { Space } from 'antd';

export function ReviewTabContent({ cycleId }: { cycleId: string }) {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <ApprovalPanel cycleId={cycleId} />
      <CommentsPanel cycleId={cycleId} scope="cycle" />
    </Space>
  );
}
```

**Step 2: Confirm `ApprovalPanel` and `CommentsPanel` accept these props**

Run: `grep -n "export.*ApprovalPanel" src/components/ApprovalPanel.tsx`
Run: `grep -n "scope" src/components/CommentsPanel.tsx`

If `CommentsPanel` doesn't accept a `scope` prop or doesn't support cycle-level threads, drop it from this task and note it as a follow-up. (Cycle-level comments are nice-to-have, not blocking.)

**Step 3: Verify**

Run: `cd otb-automation && npx tsc --noEmit`
Expected: no errors.

**Step 4: Commit**

```bash
git add src/components/cycle-workspace/ReviewTabContent.tsx
git commit -m "feat(workspace): add ReviewTabContent"
```

---

### Task 7: Build `AnalyzeTabContent`

**Files:**
- Source: `src/app/cycles/[cycleId]/variance/page.tsx`
- Create: `src/components/cycle-workspace/AnalyzeTabContent.tsx`

**Step 1: Copy the variance page body**

Signature: `export function AnalyzeTabContent({ cycleId }: { cycleId: string })`.

Drop `useParams`, `<ProtectedRoute>`, and the `← Back to Cycle` link. Keep the `fetch /api/cycles/<id>/variance` flow and `<VarianceReport>` mount as-is.

**Step 2: Verify**

Run: `cd otb-automation && npx tsc --noEmit`
Expected: clean.

**Step 3: Commit**

```bash
git add src/components/cycle-workspace/AnalyzeTabContent.tsx
git commit -m "feat(workspace): extract AnalyzeTabContent from variance page"
```

---

### Task 8: Build `DefaultsCard`

**Files:**
- Create: `src/components/cycle-workspace/DefaultsCard.tsx`

A thin wrapper around the existing `CycleDefaultsReview` component, with a collapsible `Card` shell.

**Step 1: Compose**

```typescript
'use client';

import { Card } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { CycleDefaultsReview } from '@/components/CycleDefaultsReview';
import type { OtbCycle } from '@/types/otb';

export function DefaultsCard({ cycle, onConfirmed }: { cycle: OtbCycle; onConfirmed?: () => void }) {
  const confirmed = !!cycle.defaults_confirmed;
  return (
    <Card
      title="Defaults"
      extra={confirmed ? <span><CheckCircleOutlined /> Confirmed</span> : <span>Not confirmed</span>}
      defaultActiveKey={!confirmed && cycle.status === 'Draft' ? ['1'] : []}
    >
      <CycleDefaultsReview cycle={cycle} onConfirmed={onConfirmed} />
    </Card>
  );
}
```

(Adjust prop names to match `CycleDefaultsReview`'s actual signature — verify with `grep "export.*CycleDefaultsReview" src/components/CycleDefaultsReview.tsx`.)

**Step 2: Verify and commit**

```bash
cd otb-automation && npx tsc --noEmit
git add src/components/cycle-workspace/DefaultsCard.tsx
git commit -m "feat(workspace): add DefaultsCard wrapper"
```

---

### Task 9: Build `CycleHeader`

**Files:**
- Create: `src/components/cycle-workspace/CycleHeader.tsx`

Composes the existing `StatusPipeline` with brand pill, cycle metadata, and the lifecycle action button (Activate / Submit / Reopen — depending on state and role).

**Step 1: Lift header logic**

Pull the header section (Title, status pill, `StatusPipeline`, info card, action buttons) from the current `src/app/cycles/[cycleId]/page.tsx`. Activation logic (`handleActivate`) moves into this component.

Signature:
```typescript
export function CycleHeader({ cycle, onCycleUpdated }: { cycle: OtbCycle; onCycleUpdated: (c: OtbCycle) => void })
```

`onCycleUpdated` is called after Activate so the workspace refetches state.

The existing buttons "Open OTB Grid", "Upload Actuals", "View Variance Report" are **removed** — these are now tabs.

**Step 2: Verify and commit**

```bash
cd otb-automation && npx tsc --noEmit
git add src/components/cycle-workspace/CycleHeader.tsx
git commit -m "feat(workspace): add CycleHeader with activate flow"
```

---

## Phase 3 — Workspace shell

### Task 10: Build `SetupTab`

**Files:**
- Create: `src/components/cycle-workspace/SetupTab.tsx`

**Step 1: Compose**

```typescript
'use client';

import { Space } from 'antd';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/lib/auth/roles';
import type { OtbCycle } from '@/types/otb';
import { FileUploadsCard } from './FileUploadsCard';
import { DefaultsCard } from './DefaultsCard';
import { ActualsUploadCard } from './ActualsUploadCard';

export function SetupTab({
  cycle,
  onCycleUpdated,
  onActualsUploaded,
}: {
  cycle: OtbCycle;
  onCycleUpdated: (c: OtbCycle) => void;
  onActualsUploaded: () => void;
}) {
  const { profile } = useAuth();
  const canUploadActuals = profile ? hasPermission(profile.role, 'upload_actuals') : false;
  const showActuals = cycle.status === 'Approved' && canUploadActuals;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <FileUploadsCard cycleId={cycle.id} cycleStatus={cycle.status} />
      <DefaultsCard cycle={cycle} onConfirmed={() => onCycleUpdated({ ...cycle, defaults_confirmed: true })} />
      {showActuals && <ActualsUploadCard cycleId={cycle.id} onActualsUploaded={onActualsUploaded} />}
    </Space>
  );
}
```

**Step 2: Verify and commit**

```bash
cd otb-automation && npx tsc --noEmit
git add src/components/cycle-workspace/SetupTab.tsx
git commit -m "feat(workspace): add SetupTab composition"
```

---

### Task 11: Build `CycleWorkspace` shell

**Files:**
- Create: `src/components/cycle-workspace/CycleWorkspace.tsx`

This is the orchestrator: fetches the cycle + uploads + approval state, computes default tab, renders header + tab bar, and lazy-mounts each tab content (kept mounted via `display: none` once activated).

**Step 1: Implement skeleton**

```typescript
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, Spin } from 'antd';
import type { OtbCycle, FileUpload } from '@/types/otb';
import { CycleHeader } from './CycleHeader';
import { SetupTab } from './SetupTab';
import { PlanTabContent } from './PlanTabContent';
import { ReviewTabContent } from './ReviewTabContent';
import { AnalyzeTabContent } from './AnalyzeTabContent';
import { resolveDefaultTab, type WorkspaceTab } from '@/lib/cycleWorkspace/defaultTab';
import { isAnalyzeTabVisible } from '@/lib/cycleWorkspace/tabVisibility';
import { useAuth } from '@/hooks/useAuth';

const VALID_TABS: WorkspaceTab[] = ['setup', 'plan', 'review', 'analyze'];

export function CycleWorkspace({ cycleId }: { cycleId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const [cycle, setCycle] = useState<OtbCycle | null>(null);
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [needsMyApproval, setNeedsMyApproval] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mountedTabs, setMountedTabs] = useState<Set<WorkspaceTab>>(new Set());

  const refetch = () => {
    return Promise.all([
      fetch(`/api/cycles/${cycleId}`).then(r => r.json()),
      fetch(`/api/cycles/${cycleId}/upload-status`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`/api/cycles/${cycleId}/approvals/me`).then(r => r.ok ? r.json() : { needs_my_approval: false }).catch(() => ({ needs_my_approval: false })),
    ]).then(([c, u, a]) => {
      setCycle(c);
      setUploads(Array.isArray(u) ? u : []);
      setNeedsMyApproval(!!a.needs_my_approval);
    });
  };

  useEffect(() => {
    setLoading(true);
    refetch().finally(() => setLoading(false));
  }, [cycleId]);

  const analyzeVisible = useMemo(() => isAnalyzeTabVisible(uploads), [uploads]);

  // Resolve active tab — query param wins; else compute default and replace URL
  const tabFromUrl = searchParams.get('tab') as WorkspaceTab | null;
  const activeTab: WorkspaceTab | null = useMemo(() => {
    if (loading || !cycle) return null;
    if (tabFromUrl && VALID_TABS.includes(tabFromUrl)) {
      // Hide analyze if not visible — fall through to default
      if (tabFromUrl === 'analyze' && !analyzeVisible) return null;
      return tabFromUrl;
    }
    return null;
  }, [loading, cycle, tabFromUrl, analyzeVisible]);

  useEffect(() => {
    if (loading || !cycle) return;
    const target = activeTab ?? resolveDefaultTab({
      status: cycle.status,
      needsMyApproval,
      hasActuals: analyzeVisible,
    });
    // Track mounted tabs (additive — never unmount)
    setMountedTabs(prev => prev.has(target) ? prev : new Set(prev).add(target));
    // Sync URL if missing or mismatched
    if (tabFromUrl !== target) {
      const params = new URLSearchParams(searchParams);
      params.set('tab', target);
      router.replace(`?${params.toString()}`);
    }
  }, [loading, cycle, activeTab, needsMyApproval, analyzeVisible, tabFromUrl, router, searchParams]);

  if (loading || !cycle) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  const current: WorkspaceTab = activeTab ?? resolveDefaultTab({
    status: cycle.status,
    needsMyApproval,
    hasActuals: analyzeVisible,
  });

  const items = [
    { key: 'setup' as const, label: 'Setup' },
    { key: 'plan' as const, label: 'Plan' },
    { key: 'review' as const, label: 'Review' },
    ...(analyzeVisible ? [{ key: 'analyze' as const, label: 'Analyze' }] : []),
  ];

  return (
    <div>
      <CycleHeader cycle={cycle} onCycleUpdated={(c) => setCycle(c)} />
      <Tabs
        activeKey={current}
        onChange={(key) => {
          const params = new URLSearchParams(searchParams);
          params.set('tab', key);
          router.replace(`?${params.toString()}`);
          setMountedTabs(prev => prev.has(key as WorkspaceTab) ? prev : new Set(prev).add(key as WorkspaceTab));
        }}
        items={items}
      />
      {/* Persistent-mount: render each tab's content with display:none when inactive */}
      {mountedTabs.has('setup') && (
        <div style={{ display: current === 'setup' ? 'block' : 'none' }}>
          <SetupTab cycle={cycle} onCycleUpdated={setCycle} onActualsUploaded={refetch} />
        </div>
      )}
      {mountedTabs.has('plan') && (
        <div style={{ display: current === 'plan' ? 'block' : 'none' }}>
          <PlanTabContent cycleId={cycle.id} />
        </div>
      )}
      {mountedTabs.has('review') && (
        <div style={{ display: current === 'review' ? 'block' : 'none' }}>
          <ReviewTabContent cycleId={cycle.id} />
        </div>
      )}
      {analyzeVisible && mountedTabs.has('analyze') && (
        <div style={{ display: current === 'analyze' ? 'block' : 'none' }}>
          <AnalyzeTabContent cycleId={cycle.id} />
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify**

Run: `cd otb-automation && npx tsc --noEmit`
Expected: clean (or only pre-existing errors).

**Note:** The `/api/cycles/<id>/approvals/me` endpoint may not exist. If it doesn't:
- Either reuse `/api/approvals` and filter client-side for this cycle
- Or hardcode `needsMyApproval = false` for now and add a follow-up task

Verify with: `ls src/app/api/cycles/\[cycleId\]/approvals/ 2>/dev/null && ls src/app/api/approvals/ 2>/dev/null`

**Step 3: Commit**

```bash
git add src/components/cycle-workspace/CycleWorkspace.tsx
git commit -m "feat(workspace): add CycleWorkspace shell with tab routing"
```

---

### Task 12: Replace `cycles/[cycleId]/page.tsx` with workspace

**Files:**
- Modify: `src/app/cycles/[cycleId]/page.tsx`

**Step 1: Replace contents**

```typescript
'use client';

import { useParams } from 'next/navigation';
import { CycleWorkspace } from '@/components/cycle-workspace/CycleWorkspace';

export default function CycleWorkspacePage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  return <CycleWorkspace cycleId={cycleId} />;
}
```

**Step 2: Smoke-test in dev**

Run: `cd otb-automation && npm run dev`

In browser: open `http://localhost:3000/cycles/<a-known-cycleId>`. Confirm:
- Header renders with cycle name + brand pill + status pipeline
- Tab bar shows Setup, Plan, Review (and Analyze if cycle has actuals)
- Default tab matches the resolver rule for the cycle's state
- URL updates to `?tab=...`
- Switching tabs preserves grid/variance state (open Plan, scroll, switch to Review, switch back — scroll position preserved)

Stop the dev server (Ctrl-C) when done.

**Step 3: Commit**

```bash
git add src/app/cycles/[cycleId]/page.tsx
git commit -m "feat(workspace): cycle page renders unified workspace"
```

---

## Phase 4 — Dashboard linkage

### Task 13: Update `BrandPanel` link targets

**Files:**
- Modify: `src/components/ui/BrandPanel.tsx`

**Step 1: Locate link/onClick targets**

Run: `grep -n "/approvals\|/cycles/" src/components/ui/BrandPanel.tsx`

**Step 2: Update each target**

- "Pending Review" zone link → `/cycles/${cycle_id}?tab=review`
- "Approved Plans" zone link → `/cycles/${cycle_id}?tab=plan`
- "Actuals vs Plan" / variance zone link → `/cycles/${cycle_id}?tab=analyze`
- Any direct link to `/approvals` → `/cycles/${cycle_id}?tab=review`

**Step 3: Update tests if any reference the old URLs**

Run: `grep -rn "/approvals\|/cycles/.*/grid\|/cycles/.*/variance\|/cycles/.*/upload\|/cycles/.*/actuals\|/cycles/.*/defaults" tests/`

If any test asserts on these URLs, update them. If a test for `BrandPanel` exists at `tests/unit/brandPanel.test.tsx`, run it:

Run: `cd otb-automation && npx vitest run tests/unit/brandPanel.test.tsx`
Expected: PASS.

**Step 4: Commit**

```bash
git add src/components/ui/BrandPanel.tsx tests/unit/brandPanel.test.tsx
git commit -m "feat(workspace): repoint BrandPanel links to ?tab= URLs"
```

---

### Task 14: Remove Approvals from sidebar

**Files:**
- Modify: `src/components/AppLayout.tsx`

**Step 1: Remove the Approvals nav item**

In `AppLayout.tsx`, delete the block:

```typescript
if (hasPermission(role, 'approve_otb')) {
  navItems.push({ key: '/approvals', icon: <CheckSquareOutlined />, label: 'Approvals' });
}
```

Also drop the now-unused `CheckSquareOutlined` import if no other usage remains in the file (verify with `grep CheckSquareOutlined src/components/AppLayout.tsx`).

**Step 2: Verify**

Run: `cd otb-automation && npx tsc --noEmit`
Expected: clean.

**Step 3: Commit**

```bash
git add src/components/AppLayout.tsx
git commit -m "feat(workspace): remove Approvals from sidebar nav"
```

---

## Phase 5 — Demolition

### Task 15: Delete dead routes and `ApprovalDashboard`

**Files (deleted):**
- `src/app/cycles/[cycleId]/upload/page.tsx`
- `src/app/cycles/[cycleId]/defaults/page.tsx`
- `src/app/cycles/[cycleId]/grid/page.tsx`
- `src/app/cycles/[cycleId]/actuals/page.tsx`
- `src/app/cycles/[cycleId]/variance/page.tsx`
- `src/app/cycles/[cycleId]/upload/` (empty directory)
- `src/app/cycles/[cycleId]/defaults/` (empty directory)
- `src/app/cycles/[cycleId]/grid/` (empty directory)
- `src/app/cycles/[cycleId]/actuals/` (empty directory)
- `src/app/cycles/[cycleId]/variance/` (empty directory)
- `src/app/approvals/page.tsx`
- `src/app/approvals/` (empty directory)
- `src/components/ApprovalDashboard.tsx`

**Step 1: Verify no remaining imports**

Run from `otb-automation/`:
```bash
grep -rn "ApprovalDashboard\b" src/
grep -rn "from.*cycles/\[cycleId\]/\(upload\|defaults\|grid\|actuals\|variance\)" src/
```
Expected: no matches.

**Step 2: Delete files**

```bash
rm src/app/cycles/[cycleId]/upload/page.tsx
rm src/app/cycles/[cycleId]/defaults/page.tsx
rm src/app/cycles/[cycleId]/grid/page.tsx
rm src/app/cycles/[cycleId]/actuals/page.tsx
rm src/app/cycles/[cycleId]/variance/page.tsx
rmdir src/app/cycles/[cycleId]/upload src/app/cycles/[cycleId]/defaults src/app/cycles/[cycleId]/grid src/app/cycles/[cycleId]/actuals src/app/cycles/[cycleId]/variance
rm src/app/approvals/page.tsx
rmdir src/app/approvals
rm src/components/ApprovalDashboard.tsx
```

**Step 3: Verify build**

Run: `cd otb-automation && npm run build`
Expected: build succeeds. Address any orphaned imports surfaced.

**Step 4: Run all unit tests**

Run: `cd otb-automation && npx vitest run`
Expected: all tests pass.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(workspace): delete superseded routes and ApprovalDashboard"
```

---

## Phase 6 — Verification

### Task 16: Smoke test by role × cycle status

**Step 1: Start dev server**

Run: `cd otb-automation && npm run dev`

**Step 2: Manual smoke matrix**

For each combination, log in as the role and open a cycle in that status. Confirm expected default tab and tab availability:

| Role | Status | Expected default tab | Expected tab visibility |
|---|---|---|---|
| Admin | Draft | Setup | Setup, Plan, Review |
| Planning | Draft | Setup | Setup, Plan, Review |
| GD | Draft | Setup | Setup (read-only), Plan, Review |
| Planning | Filling | Plan | Setup (read-only sections), Plan (editable for GD only), Review |
| GD | InReview (no my-approval pending) | Plan | Setup, Plan, Review |
| GD | InReview (my-approval pending) | Review | Setup, Plan, Review |
| CXO | InReview (my-approval pending) | Review | Setup, Plan, Review |
| Planning | Approved (no actuals) | Plan | Setup (incl. Actuals upload), Plan, Review |
| CXO | Approved (no actuals) | Plan | Setup (no Actuals section), Plan, Review |
| Any role | Approved (with actuals) | Analyze | Setup, Plan, Review, **Analyze** |

For each, also confirm:
- Switching tabs updates the URL `?tab=`
- Refresh on a deep-link URL lands on the right tab
- Browser back from a tab switch leaves the cycle (not unwinding tabs)
- Plan tab grid scroll/filter state persists across tab switches

Document any failures in `docs/plans/2026-05-10-cycle-workspace-consolidation-impl-notes.md` and fix before proceeding.

**Step 3: Run lint + typecheck + tests**

```bash
cd otb-automation && npm run lint
cd otb-automation && npx tsc --noEmit
cd otb-automation && npx vitest run
cd otb-automation && npm run build
```
Expected: all green.

**Step 4: Commit any fixes**

If smoke test required fixes, commit them with descriptive messages.

---

### Task 17: Open PR (do NOT merge)

**Step 1: Push branch**

Run: `git push -u origin feat/cycle-workspace`

**Step 2: Open PR via gh**

Run:
```bash
gh pr create --title "Consolidate cycle workflow into single workspace" --body "$(cat <<'EOF'
## Summary
- New unified workspace at `/cycles/[cycleId]` with 4 tabs: Setup, Plan, Review, Analyze
- Deletes `/approvals` and the five `/cycles/[cycleId]/*` sub-routes
- Updates dashboard `BrandPanel` link targets to `?tab=` URLs
- Removes Approvals from sidebar nav

## Design
[docs/plans/2026-05-10-cycle-workspace-consolidation-design.md](../blob/feat/cycle-workspace/docs/plans/2026-05-10-cycle-workspace-consolidation-design.md)

## Test plan
- [ ] Smoke matrix (role × status) per implementation plan Task 16
- [ ] All unit tests pass (`npx vitest run`)
- [ ] Lint clean (`npm run lint`)
- [ ] Build clean (`npm run build`)
- [ ] Deep-link URLs reproduce exact view on reload
- [ ] Tab switches preserve heavy-component state (AG Grid scroll/filters, Variance metric selection)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 3: Stop here and await approval**

Do NOT merge. The user will review the PR and approve manually.

---

## Notes for the implementer

- **Heaviest extraction is Task 5** (the grid page). Read the source page in full before copying — it's 400+ lines with intricate hook interactions.
- **Tab persistence:** the `display: none` strategy keeps inactive tabs mounted. Don't be tempted to use Ant Design's `<Tabs destroyInactiveTabPane>` — that defeats the whole purpose.
- **No DB / RLS changes.** This is UI work only.
- **No new API endpoints.** If `/api/cycles/<id>/approvals/me` doesn't exist, hardcode `needsMyApproval = false` and create a follow-up task (Q4 default-tab logic degrades gracefully — InReview without my-approval defaults to Plan, which is fine).
- **Commit after every task.** Each task is independently revertible.
- **Stay on `feat/cycle-workspace`.** No commits to `master`.
