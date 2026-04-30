# GD Assignment at Cycle Creation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move GD assignment from the cycle detail page into the "Create Cycle" form so it is required at creation time.

**Architecture:** Three-file change: the cycles POST API accepts `assigned_gd_id` at insert time; the new-cycle form adds a brand-filtered, required GD dropdown that auto-selects when only one GD is available; the cycle detail page drops the now-redundant assign UI.

**Tech Stack:** Next.js App Router, Supabase JS client, Ant Design 6, TypeScript.

---

### Task 1: Accept `assigned_gd_id` in POST `/api/cycles`

**Files:**
- Modify: `src/app/api/cycles/route.ts`

**Step 1: Add `assigned_gd_id` to destructuring and validation**

In `src/app/api/cycles/route.ts`, find the POST handler. Change:

```typescript
const { cycle_name, brand_id, planning_quarter, fill_deadline, approval_deadline } = body;

if (!cycle_name || !brand_id || !planning_quarter) {
  return NextResponse.json(
    { error: 'cycle_name, brand_id, and planning_quarter are required' },
    { status: 400 }
  );
}
```

To:

```typescript
const { cycle_name, brand_id, planning_quarter, fill_deadline, approval_deadline, assigned_gd_id } = body;

if (!cycle_name || !brand_id || !planning_quarter || !assigned_gd_id) {
  return NextResponse.json(
    { error: 'cycle_name, brand_id, planning_quarter, and assigned_gd_id are required' },
    { status: 400 }
  );
}
```

**Step 2: Add `assigned_gd_id` to the INSERT**

Find the `.insert({...})` call and add `assigned_gd_id`:

```typescript
const { data, error } = await supabase
  .from('otb_cycles')
  .insert({
    cycle_name,
    brand_id,
    planning_quarter,
    planning_period_start: quarterDates.start,
    planning_period_end: quarterDates.end,
    fill_deadline: fill_deadline || null,
    approval_deadline: approval_deadline || null,
    assigned_gd_id: assigned_gd_id.trim(),
    created_by: auth.user.id,
  })
  .select()
  .single();
```

**Step 3: Verify build passes**

```bash
cd otb-automation && npm run build
```
Expected: no TypeScript errors.

**Step 4: Commit**

```bash
git add src/app/api/cycles/route.ts
git commit -m "feat: accept assigned_gd_id at cycle creation"
```

---

### Task 2: Add GD dropdown to the New Cycle form

**Files:**
- Modify: `src/app/cycles/new/page.tsx`

**Step 1: Add state and fetch GD users on mount**

Add to the imports at the top:
```typescript
import type { UserProfile } from '@/types/otb';
```

Add state inside `NewCyclePage`:
```typescript
const [gdUsers, setGdUsers] = useState<UserProfile[]>([]);
const [filteredGds, setFilteredGds] = useState<UserProfile[]>([]);
```

Add a fetch on mount to load all active GD users:
```typescript
useEffect(() => {
  fetch('/api/admin/users')
    .then(r => r.ok ? r.json() : [])
    .then(users => {
      if (Array.isArray(users)) {
        setGdUsers(users.filter((u: UserProfile) => u.role === 'GD' && u.is_active));
      }
    })
    .catch(() => {});
}, []);
```

**Step 2: Filter GDs when brand changes and auto-select if single**

Add a `useEffect` that re-filters whenever `gdUsers` or the selected brand changes. Watch the brand field value using `Form.useWatch`:

```typescript
const watchedBrandId = Form.useWatch('brand_id', form);

useEffect(() => {
  if (!watchedBrandId) {
    setFilteredGds([]);
    form.setFieldValue('assigned_gd_id', undefined);
    return;
  }
  const gds = gdUsers.filter(u =>
    Array.isArray(u.assigned_brands) && u.assigned_brands.includes(watchedBrandId)
  );
  setFilteredGds(gds);
  if (gds.length === 1) {
    form.setFieldValue('assigned_gd_id', gds[0].id);
  } else {
    form.setFieldValue('assigned_gd_id', undefined);
  }
}, [watchedBrandId, gdUsers, form]);
```

**Step 3: Add the GD field to the form JSX**

Insert after the Brand `<Form.Item>` and before the Planning Quarter `<Form.Item>`:

```tsx
<Form.Item
  name="assigned_gd_id"
  label="Assign GD"
  rules={[{ required: true, message: 'Please assign a GD' }]}
>
  <Select
    placeholder={watchedBrandId ? 'Select GD' : 'Select a brand first'}
    disabled={!watchedBrandId || filteredGds.length === 0}
    options={filteredGds.map(u => ({ value: u.id, label: `${u.full_name} (${u.email})` }))}
  />
</Form.Item>
```

**Step 4: Pass `assigned_gd_id` in the POST body**

In `onFinish`, update the `body` sent to `/api/cycles`:

```typescript
body: JSON.stringify({
  cycle_name: values.cycle_name,
  brand_id: values.brand_id,
  planning_quarter: values.planning_quarter,
  assigned_gd_id: values.assigned_gd_id,
}),
```

**Step 5: Verify build passes**

```bash
npm run build
```
Expected: no TypeScript errors.

**Step 6: Commit**

```bash
git add src/app/cycles/new/page.tsx
git commit -m "feat: add required GD dropdown to new cycle form"
```

---

### Task 3: Remove the Assign GD section from the cycle detail page

**Files:**
- Modify: `src/app/cycles/[cycleId]/page.tsx`

**Step 1: Remove GD-fetching state and logic**

Remove these state declarations:
```typescript
const [gdUsers, setGdUsers] = useState<UserProfile[]>([]);
const [selectedGdId, setSelectedGdId] = useState<string | null>(null);
const [assigningGd, setAssigningGd] = useState(false);
```

Remove the `canAssignGd` variable and its permission check:
```typescript
const canAssignGd = profile ? hasPermission(profile.role, 'assign_gd') : false;
```

**Step 2: Remove the GD fetch from `useEffect`**

In the `useEffect`, remove the entire block that conditionally fetches GD users:
```typescript
if (canAssignGd) {
  fetches.push(
    fetch('/api/admin/users')...
  );
}
```
Also remove `gdData` from the `Promise.all` destructure, remove the `setGdUsers` / `setSelectedGdId` calls, and remove the `canAssignGd` dependency from the `useEffect` deps array.

**Step 3: Remove the `handleAssignGd` function**

Delete the entire `handleAssignGd` async function (lines ~69–91 in the current file).

**Step 4: Remove the Assign GD UI in the `<Descriptions>` block**

Find the `<Descriptions.Item label="GD Assigned">` block. Replace the entire contents with a simple display:

```tsx
<Descriptions.Item label={<Text type="secondary">GD Assigned</Text>}>
  {(cycle as OtbCycle & { assigned_gd_name?: string }).assigned_gd_name || cycle.assigned_gd_id || '-'}
</Descriptions.Item>
```

**Step 5: Clean up unused imports**

Remove `Select` from the antd import if it's no longer used elsewhere on the page. Remove `UserAddOutlined` if unused.

**Step 6: Verify build passes**

```bash
npm run build
```
Expected: no TypeScript or lint errors.

**Step 7: Commit**

```bash
git add src/app/cycles/[cycleId]/page.tsx
git commit -m "refactor: remove assign-GD step from cycle detail (now at creation)"
```

---

### Task 4: Smoke test the full flow

**Step 1: Start dev server**
```bash
npm run dev
```

**Step 2: Navigate to `/cycles/new`**
- Verify GD dropdown is absent before a brand is selected
- Select a brand — confirm only GDs assigned to that brand appear
- If one GD, confirm they are auto-selected
- Submit the form and confirm the cycle is created with the GD already shown on the detail page

**Step 3: Confirm cycle detail page**
- No "Select GD / Assign" UI visible
- GD name displays correctly in the info card
- `canActivate` still works (GD is satisfied at creation)
