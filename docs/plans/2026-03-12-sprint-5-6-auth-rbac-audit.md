# OTB Automation — Sprint 5-6 Execution Plan: Authentication, RBAC & Audit

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Supabase Auth, role-based access control (6 roles), brand-level GD scoping, admin UIs for user/master data management, and structured audit logging to the existing OTB platform built in Sprints 1-4.

**Architecture:** Supabase Auth provides email/password login with JWT tokens. A `profiles` table extends `auth.users` with role and brand assignments. Next.js middleware enforces auth on all routes. API routes check role permissions via a shared `withAuth()` wrapper. Supabase Row Level Security (RLS) provides defense-in-depth at the database layer. Audit logs capture all state-changing actions.

**Tech Stack:**
- **Auth:** Supabase Auth (`@supabase/ssr` for cookie-based sessions in Next.js)
- **Framework:** Next.js 14+ (App Router), TypeScript (from Sprint 1-4)
- **Database:** Supabase PostgreSQL (from Sprint 1-4)
- **UI:** Ant Design 5 (from Sprint 1-4)
- **Testing:** Vitest (unit/integration), Playwright (E2E)

**PRD Reference:** `OTB_Automation_PRD_Phase1_V2.md` — Sections 11.1 (RBAC), 11.2 (Audit), 14.1 (Security), 15.2 (Sprint 5-6)

**Prerequisites:** Sprint 1-4 complete — file upload, OTB grid, GD input, submission, version control all working without auth.

---

## Project Structure (New/Modified Files)

```
otb-automation/
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql          # Existing
│       ├── 002_auth_profiles_rbac.sql      # NEW — profiles, RLS policies
│       └── 003_audit_logs.sql              # NEW — audit log table + trigger
├── src/
│   ├── app/
│   │   ├── login/
│   │   │   └── page.tsx                    # NEW — login page
│   │   ├── admin/
│   │   │   ├── users/
│   │   │   │   └── page.tsx                # NEW — user management
│   │   │   ├── master-data/
│   │   │   │   └── page.tsx                # NEW — master data CRUD
│   │   │   ├── mappings/
│   │   │   │   └── page.tsx                # NEW — standardization mappings
│   │   │   └── audit-logs/
│   │   │       └── page.tsx                # NEW — audit log viewer
│   │   ├── cycles/                         # MODIFY — add auth checks
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── callback/route.ts       # NEW — Supabase auth callback
│   │   │   ├── admin/
│   │   │   │   ├── users/
│   │   │   │   │   ├── route.ts            # NEW — GET list, POST create
│   │   │   │   │   └── [userId]/route.ts   # NEW — PUT update, DELETE deactivate
│   │   │   │   └── audit-logs/
│   │   │   │       ├── route.ts            # NEW — GET with filters
│   │   │   │       └── export/route.ts     # NEW — CSV export
│   │   │   ├── master-data/
│   │   │   │   └── [type]/route.ts         # MODIFY — add POST/PUT, auth
│   │   │   ├── cycles/                     # MODIFY — add auth wrapper
│   │   │   └── ...                         # MODIFY — all existing APIs
│   │   └── layout.tsx                      # MODIFY — add AuthProvider
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                   # MODIFY — cookie-based auth
│   │   │   ├── server.ts                   # MODIFY — cookie-based auth
│   │   │   └── middleware.ts               # NEW — session refresh
│   │   ├── auth/
│   │   │   ├── withAuth.ts                 # NEW — API route auth wrapper
│   │   │   ├── roles.ts                    # NEW — role definitions + permission matrix
│   │   │   └── auditLogger.ts             # NEW — audit log helper
│   │   └── ...
│   ├── components/
│   │   ├── AuthProvider.tsx                # NEW — client-side auth context
│   │   ├── ProtectedRoute.tsx              # NEW — role-gated component wrapper
│   │   ├── AppLayout.tsx                   # NEW — nav with role-based menu
│   │   ├── UserManagement.tsx              # NEW — user CRUD table
│   │   ├── MasterDataManager.tsx           # NEW — master data CRUD
│   │   └── AuditLogViewer.tsx              # NEW — filterable audit log table
│   ├── hooks/
│   │   └── useAuth.ts                      # NEW — auth context hook
│   └── types/
│       └── otb.ts                          # MODIFY — add User, Role types
├── middleware.ts                            # NEW — Next.js middleware for auth
└── tests/
    ├── unit/
    │   ├── roles.test.ts                   # NEW
    │   └── auditLogger.test.ts             # NEW
    ├── integration/
    │   ├── auth.test.ts                    # NEW
    │   ├── rbac.test.ts                    # NEW
    │   └── auditLogs.test.ts              # NEW
    └── e2e/
        └── authFlow.test.ts               # NEW
```

---

## SPRINT 5: Authentication & RBAC Foundation (Weeks 9-10)

---

### Task 1: Auth Types & Role Definitions

**Files:**
- Modify: `src/types/otb.ts`
- Create: `src/lib/auth/roles.ts`
- Test: `tests/unit/roles.test.ts`

**Step 1: Write failing tests for role permissions**

```typescript
// tests/unit/roles.test.ts
import { describe, it, expect } from 'vitest';
import { hasPermission, Role, Permission } from '../../src/lib/auth/roles';

describe('Role permissions (PRD 11.1)', () => {
  it('Admin has all permissions', () => {
    expect(hasPermission('Admin', 'create_cycle')).toBe(true);
    expect(hasPermission('Admin', 'upload_data')).toBe(true);
    expect(hasPermission('Admin', 'edit_otb')).toBe(true);
    expect(hasPermission('Admin', 'approve_otb')).toBe(true);
    expect(hasPermission('Admin', 'view_audit_logs')).toBe(true);
    expect(hasPermission('Admin', 'manage_users')).toBe(true);
    expect(hasPermission('Admin', 'manage_master_data')).toBe(true);
    expect(hasPermission('Admin', 'admin_override')).toBe(true);
  });

  it('Planning can create cycles, upload, assign GDs, view all, approve, upload actuals', () => {
    expect(hasPermission('Planning', 'create_cycle')).toBe(true);
    expect(hasPermission('Planning', 'upload_data')).toBe(true);
    expect(hasPermission('Planning', 'assign_gd')).toBe(true);
    expect(hasPermission('Planning', 'view_all_otbs')).toBe(true);
    expect(hasPermission('Planning', 'approve_otb')).toBe(true);
    expect(hasPermission('Planning', 'upload_actuals')).toBe(true);
    // Cannot
    expect(hasPermission('Planning', 'edit_otb')).toBe(false);
    expect(hasPermission('Planning', 'manage_users')).toBe(false);
    expect(hasPermission('Planning', 'view_audit_logs')).toBe(false);
  });

  it('GD can only edit and submit assigned brand OTB, approve own brand', () => {
    expect(hasPermission('GD', 'edit_otb')).toBe(true);
    expect(hasPermission('GD', 'submit_otb')).toBe(true);
    expect(hasPermission('GD', 'approve_otb')).toBe(true);
    expect(hasPermission('GD', 'view_variance')).toBe(true);
    // Cannot
    expect(hasPermission('GD', 'create_cycle')).toBe(false);
    expect(hasPermission('GD', 'upload_data')).toBe(false);
    expect(hasPermission('GD', 'view_all_otbs')).toBe(false);
  });

  it('Finance can view all OTBs, approve, view variance', () => {
    expect(hasPermission('Finance', 'view_all_otbs')).toBe(true);
    expect(hasPermission('Finance', 'approve_otb')).toBe(true);
    expect(hasPermission('Finance', 'view_variance')).toBe(true);
    // Cannot
    expect(hasPermission('Finance', 'create_cycle')).toBe(false);
    expect(hasPermission('Finance', 'edit_otb')).toBe(false);
  });

  it('CXO can view all, approve, view variance', () => {
    expect(hasPermission('CXO', 'view_all_otbs')).toBe(true);
    expect(hasPermission('CXO', 'approve_otb')).toBe(true);
    expect(hasPermission('CXO', 'view_variance')).toBe(true);
    // Cannot
    expect(hasPermission('CXO', 'create_cycle')).toBe(false);
  });

  it('ReadOnly can view approved OTBs and variance only', () => {
    expect(hasPermission('ReadOnly', 'view_approved_otbs')).toBe(true);
    expect(hasPermission('ReadOnly', 'view_variance')).toBe(true);
    // Cannot
    expect(hasPermission('ReadOnly', 'create_cycle')).toBe(false);
    expect(hasPermission('ReadOnly', 'approve_otb')).toBe(false);
  });
});
```

**Step 2: Run test → FAIL**

```bash
npx vitest run tests/unit/roles.test.ts
```

Expected: FAIL — module not found.

**Step 3: Add types and implement role permissions**

```typescript
// src/types/otb.ts — ADD these types (keep all existing types)

export type Role = 'Admin' | 'Planning' | 'GD' | 'Finance' | 'CXO' | 'ReadOnly';

export interface UserProfile {
  id: string;            // auth.users.id
  email: string;
  full_name: string;
  role: Role;
  assigned_brands: string[];  // brand IDs (for GDs)
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

```typescript
// src/lib/auth/roles.ts
import type { Role } from '@/types/otb';

export type Permission =
  | 'create_cycle' | 'upload_data' | 'assign_gd'
  | 'edit_otb' | 'submit_otb'
  | 'view_all_otbs' | 'view_approved_otbs'
  | 'approve_otb' | 'upload_actuals' | 'view_variance'
  | 'view_audit_logs' | 'manage_users' | 'manage_master_data'
  | 'admin_override';

// PRD Section 11.1 — permission matrix
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  Admin: [
    'create_cycle', 'upload_data', 'assign_gd',
    'edit_otb', 'submit_otb',
    'view_all_otbs', 'view_approved_otbs',
    'approve_otb', 'upload_actuals', 'view_variance',
    'view_audit_logs', 'manage_users', 'manage_master_data',
    'admin_override',
  ],
  Planning: [
    'create_cycle', 'upload_data', 'assign_gd',
    'view_all_otbs', 'view_approved_otbs',
    'approve_otb', 'upload_actuals', 'view_variance',
  ],
  GD: [
    'edit_otb', 'submit_otb',
    'approve_otb', 'view_variance',
  ],
  Finance: [
    'view_all_otbs', 'view_approved_otbs',
    'approve_otb', 'view_variance',
  ],
  CXO: [
    'view_all_otbs', 'view_approved_otbs',
    'approve_otb', 'view_variance',
  ],
  ReadOnly: [
    'view_approved_otbs', 'view_variance',
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export { type Role };
```

**Step 4: Run test → PASS**

```bash
npx vitest run tests/unit/roles.test.ts
```

**Step 5: Commit**

```bash
git add src/types/otb.ts src/lib/auth/roles.ts tests/unit/roles.test.ts
git commit -m "feat: role definitions and permission matrix (PRD 11.1)"
```

---

### Task 2: Database Migration — Profiles & RLS

**Files:**
- Create: `supabase/migrations/002_auth_profiles_rbac.sql`

**Step 1: Write migration**

```sql
-- supabase/migrations/002_auth_profiles_rbac.sql

-- ============================================================
-- USER PROFILES (extends auth.users)
-- ============================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  role text not null default 'ReadOnly'
    check (role in ('Admin', 'Planning', 'GD', 'Finance', 'CXO', 'ReadOnly')),
  assigned_brands jsonb not null default '[]',  -- array of brand UUIDs (for GDs)
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for role-based queries
create index idx_profiles_role on profiles(role);
create index idx_profiles_active on profiles(is_active) where is_active = true;

-- Auto-create profile on signup (trigger)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'ReadOnly')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Update assigned_gd_id in otb_cycles to reference profiles
-- (Sprint 1-4 used text; now it's a proper UUID)
alter table otb_cycles
  alter column assigned_gd_id type uuid using assigned_gd_id::uuid;

alter table otb_cycles
  add constraint fk_assigned_gd foreign key (assigned_gd_id) references profiles(id);

-- Add created_by to otb_cycles
alter table otb_cycles add column if not exists created_by uuid references profiles(id);

-- Add user references to version_history
alter table version_history
  alter column created_by type uuid using created_by::uuid;

alter table version_history
  add constraint fk_version_created_by foreign key (created_by) references profiles(id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table otb_cycles enable row level security;
alter table otb_plan_rows enable row level security;
alter table otb_plan_data enable row level security;
alter table file_uploads enable row level security;
alter table version_history enable row level security;
alter table brands enable row level security;
alter table sub_brands enable row level security;
alter table sub_categories enable row level security;
alter table channels enable row level security;
alter table genders enable row level security;
alter table master_mappings enable row level security;

-- Helper function: get current user's role
create or replace function public.get_user_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- Helper function: get current user's assigned brand IDs
create or replace function public.get_assigned_brands()
returns jsonb as $$
  select assigned_brands from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- ---- PROFILES policies ----
-- Users can read their own profile
create policy "Users can read own profile"
  on profiles for select using (id = auth.uid());

-- Admin can read all profiles
create policy "Admin can read all profiles"
  on profiles for select using (get_user_role() = 'Admin');

-- Admin can insert/update profiles
create policy "Admin can manage profiles"
  on profiles for all using (get_user_role() = 'Admin');

-- ---- OTB_CYCLES policies ----
-- Admin, Planning, Finance, CXO can see all cycles
create policy "Privileged roles see all cycles"
  on otb_cycles for select using (
    get_user_role() in ('Admin', 'Planning', 'Finance', 'CXO')
  );

-- GD sees only assigned brand cycles
create policy "GD sees assigned brand cycles"
  on otb_cycles for select using (
    get_user_role() = 'GD'
    and brand_id::text in (select jsonb_array_elements_text(get_assigned_brands()))
  );

-- ReadOnly sees only approved cycles
create policy "ReadOnly sees approved cycles"
  on otb_cycles for select using (
    get_user_role() = 'ReadOnly' and status = 'Approved'
  );

-- Admin/Planning can insert/update cycles
create policy "Admin/Planning manage cycles"
  on otb_cycles for all using (
    get_user_role() in ('Admin', 'Planning')
  );

-- ---- PLAN ROWS / DATA policies ----
-- Follow cycle visibility (join via cycle_id)
create policy "Plan rows follow cycle access"
  on otb_plan_rows for select using (
    exists (
      select 1 from otb_cycles c
      where c.id = otb_plan_rows.cycle_id
    )
  );

create policy "Plan data follows row access"
  on otb_plan_data for select using (
    exists (
      select 1 from otb_plan_rows r
      join otb_cycles c on c.id = r.cycle_id
      where r.id = otb_plan_data.row_id
    )
  );

-- GD can update plan data for their assigned brand's filling cycles
create policy "GD can update plan data"
  on otb_plan_data for update using (
    get_user_role() in ('Admin', 'GD')
    and exists (
      select 1 from otb_plan_rows r
      join otb_cycles c on c.id = r.cycle_id
      where r.id = otb_plan_data.row_id
        and c.status = 'Filling'
        and (
          get_user_role() = 'Admin'
          or c.brand_id::text in (select jsonb_array_elements_text(get_assigned_brands()))
        )
    )
  );

-- ---- MASTER DATA policies ----
-- Everyone can read master data
create policy "All authenticated read master data"
  on brands for select using (auth.uid() is not null);
create policy "All authenticated read sub_brands"
  on sub_brands for select using (auth.uid() is not null);
create policy "All authenticated read sub_categories"
  on sub_categories for select using (auth.uid() is not null);
create policy "All authenticated read channels"
  on channels for select using (auth.uid() is not null);
create policy "All authenticated read genders"
  on genders for select using (auth.uid() is not null);
create policy "All authenticated read mappings"
  on master_mappings for select using (auth.uid() is not null);

-- Admin can manage master data
create policy "Admin manages brands"
  on brands for all using (get_user_role() = 'Admin');
create policy "Admin manages sub_brands"
  on sub_brands for all using (get_user_role() = 'Admin');
create policy "Admin manages sub_categories"
  on sub_categories for all using (get_user_role() = 'Admin');
create policy "Admin manages channels"
  on channels for all using (get_user_role() = 'Admin');
create policy "Admin manages genders"
  on genders for all using (get_user_role() = 'Admin');
create policy "Admin manages mappings"
  on master_mappings for all using (get_user_role() = 'Admin');

-- ---- FILE UPLOADS / VERSION HISTORY ----
create policy "File uploads follow cycle access"
  on file_uploads for select using (
    exists (select 1 from otb_cycles c where c.id = file_uploads.cycle_id)
  );

create policy "Admin/Planning manage uploads"
  on file_uploads for all using (get_user_role() in ('Admin', 'Planning'));

create policy "Version history follows cycle access"
  on version_history for select using (
    exists (select 1 from otb_cycles c where c.id = version_history.cycle_id)
  );
```

**Step 2: Apply migration**

```bash
npx supabase db push
```

Or apply via Supabase Dashboard → SQL Editor.

**Step 3: Seed an admin user**

After migration, create the first admin user via Supabase Dashboard → Authentication → Add User, then update their profile:

```sql
update profiles
set role = 'Admin', full_name = 'System Admin'
where email = 'admin@bewakoof.com';
```

**Step 4: Commit**

```bash
git add supabase/migrations/002_auth_profiles_rbac.sql
git commit -m "feat: profiles table, RLS policies, role-based DB access"
```

---

### Task 3: Supabase Client Upgrade for Auth

**Files:**
- Modify: `src/lib/supabase/client.ts`
- Modify: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`
- Create: `middleware.ts` (project root)

**Step 1: Update browser client for cookie-based auth**

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

(This stays the same — `@supabase/ssr` browser client handles cookies automatically.)

**Step 2: Update server client for cookie-based auth**

```typescript
// src/lib/supabase/server.ts
import { createServerClient as createSSRClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Authenticated server client (uses request cookies → gets user's session)
export async function createServerClient() {
  const cookieStore = await cookies();
  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

// Service-role client (bypasses RLS — for admin operations, audit logging)
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

**Step 3: Create middleware helper**

```typescript
// src/lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login (except login page and auth callback)
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login')
    || request.nextUrl.pathname.startsWith('/api/auth');

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login
  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return supabaseResponse;
}
```

**Step 4: Create Next.js middleware**

```typescript
// middleware.ts (project root)
import { updateSession } from '@/lib/supabase/middleware';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Match all routes except static files and images
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

**Step 5: Commit**

```bash
git add src/lib/supabase/client.ts src/lib/supabase/server.ts src/lib/supabase/middleware.ts middleware.ts
git commit -m "feat: cookie-based Supabase auth with session refresh middleware"
```

---

### Task 4: Auth Callback & Login Page

**Files:**
- Create: `src/app/api/auth/callback/route.ts`
- Create: `src/app/login/page.tsx`

**Step 1: Auth callback route**

```typescript
// src/app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const redirectTo = searchParams.get('redirectTo') ?? '/';

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
            });
          },
        },
      }
    );
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
```

**Step 2: Login page**

```typescript
// src/app/login/page.tsx
'use client';

import { useState } from 'react';
import { Card, Form, Input, Button, Typography, Alert, Space } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams, useRouter } from 'next/navigation';

const { Title } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectTo = searchParams.get('redirectTo') ?? '/';

  async function handleLogin(values: { email: string; password: string }) {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 400 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Title level={3} style={{ textAlign: 'center', margin: 0 }}>
            OTB Automation
          </Title>
          {error && <Alert type="error" message={error} closable onClose={() => setError(null)} />}
          <Form onFinish={handleLogin} layout="vertical">
            <Form.Item name="email" rules={[{ required: true, type: 'email', message: 'Enter your email' }]}>
              <Input prefix={<MailOutlined />} placeholder="Email" size="large" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: 'Enter your password' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block size="large">
                Sign In
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/api/auth/callback/route.ts src/app/login/page.tsx
git commit -m "feat: login page and auth callback route"
```

---

### Task 5: Auth Context & Protected Layout

**Files:**
- Create: `src/components/AuthProvider.tsx`
- Create: `src/hooks/useAuth.ts`
- Create: `src/components/AppLayout.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Auth provider**

```typescript
// src/components/AuthProvider.tsx
'use client';

import { createContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '@/types/otb';

export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function getSession() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setProfile(data);
      }
      setLoading(false);
    }
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          setProfile(data);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    window.location.href = '/login';
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
```

```typescript
// src/hooks/useAuth.ts
'use client';

import { useContext } from 'react';
import { AuthContext, type AuthContextType } from '@/components/AuthProvider';

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}
```

**Step 2: App layout with role-based navigation**

```typescript
// src/components/AppLayout.tsx
'use client';

import { Layout, Menu, Dropdown, Button, Spin, Typography } from 'antd';
import {
  DashboardOutlined, UploadOutlined, TableOutlined,
  UserOutlined, SettingOutlined, AuditOutlined, LogoutOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/lib/auth/roles';
import { useRouter, usePathname } from 'next/navigation';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = Layout;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
  }

  if (!profile) return <>{children}</>;

  const role = profile.role;
  const menuItems: MenuProps['items'] = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/cycles', icon: <TableOutlined />, label: 'OTB Cycles' },
  ];

  if (hasPermission(role, 'manage_users')) {
    menuItems.push({ key: '/admin/users', icon: <UserOutlined />, label: 'User Management' });
  }
  if (hasPermission(role, 'manage_master_data')) {
    menuItems.push({ key: '/admin/master-data', icon: <SettingOutlined />, label: 'Master Data' });
    menuItems.push({ key: '/admin/mappings', icon: <SettingOutlined />, label: 'Mappings' });
  }
  if (hasPermission(role, 'view_audit_logs')) {
    menuItems.push({ key: '/admin/audit-logs', icon: <AuditOutlined />, label: 'Audit Logs' });
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible>
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <Typography.Text strong style={{ color: '#fff' }}>OTB Platform</Typography.Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname]}
          items={menuItems}
          onClick={({ key }) => router.push(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Dropdown menu={{ items: [
            { key: 'role', label: `Role: ${profile.role}`, disabled: true },
            { key: 'logout', icon: <LogoutOutlined />, label: 'Sign Out', onClick: signOut },
          ]}}>
            <Button type="text">
              <UserOutlined /> {profile.full_name}
            </Button>
          </Dropdown>
        </Header>
        <Content style={{ margin: '24px', padding: '24px', background: '#fff', borderRadius: 8 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
```

**Step 3: Update root layout**

```typescript
// src/app/layout.tsx
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { AuthProvider } from '@/components/AuthProvider';
import { AppLayout } from '@/components/AppLayout';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AntdRegistry>
          <AuthProvider>
            <AppLayout>{children}</AppLayout>
          </AuthProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
```

**Step 4: Commit**

```bash
git add src/components/AuthProvider.tsx src/hooks/useAuth.ts src/components/AppLayout.tsx src/app/layout.tsx
git commit -m "feat: auth context, role-based nav layout, protected routes"
```

---

### Task 6: API Auth Wrapper (`withAuth`)

**Files:**
- Create: `src/lib/auth/withAuth.ts`
- Create: `src/components/ProtectedRoute.tsx`

**Step 1: Server-side auth wrapper for API routes**

```typescript
// src/lib/auth/withAuth.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { hasPermission, type Permission } from '@/lib/auth/roles';
import type { Role, UserProfile } from '@/types/otb';

export interface AuthenticatedRequest {
  user: { id: string; email: string };
  profile: UserProfile;
}

type HandlerFn = (
  req: NextRequest,
  auth: AuthenticatedRequest,
  context?: any
) => Promise<NextResponse>;

/**
 * Wraps an API route handler with authentication and permission checks.
 * Usage: export const GET = withAuth('view_all_otbs', async (req, auth) => { ... });
 */
export function withAuth(permission: Permission | null, handler: HandlerFn) {
  return async (req: NextRequest, context?: any) => {
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 403 });
    }

    if (!profile.is_active) {
      return NextResponse.json({ error: 'Account deactivated' }, { status: 403 });
    }

    // Check permission (null = any authenticated user)
    if (permission && !hasPermission(profile.role as Role, permission)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const auth: AuthenticatedRequest = {
      user: { id: user.id, email: user.email! },
      profile: profile as UserProfile,
    };

    return handler(req, auth, context);
  };
}
```

**Step 2: Client-side protected route component**

```typescript
// src/components/ProtectedRoute.tsx
'use client';

import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/lib/auth/roles';
import type { Permission } from '@/lib/auth/roles';
import { Result, Button } from 'antd';
import { useRouter } from 'next/navigation';

interface Props {
  permission: Permission;
  children: React.ReactNode;
}

export function ProtectedRoute({ permission, children }: Props) {
  const { profile, loading } = useAuth();
  const router = useRouter();

  if (loading) return null;

  if (!profile || !hasPermission(profile.role, permission)) {
    return (
      <Result
        status="403"
        title="Access Denied"
        subTitle="You don't have permission to view this page."
        extra={<Button type="primary" onClick={() => router.push('/')}>Go Home</Button>}
      />
    );
  }

  return <>{children}</>;
}
```

**Step 3: Commit**

```bash
git add src/lib/auth/withAuth.ts src/components/ProtectedRoute.tsx
git commit -m "feat: withAuth API wrapper and ProtectedRoute component"
```

---

### Task 7: Retrofit Auth to Existing API Routes

**Files:**
- Modify: `src/app/api/cycles/route.ts`
- Modify: `src/app/api/cycles/[cycleId]/route.ts`
- Modify: `src/app/api/cycles/[cycleId]/activate/route.ts`
- Modify: `src/app/api/cycles/[cycleId]/upload/[fileType]/route.ts`
- Modify: `src/app/api/cycles/[cycleId]/upload-status/route.ts`
- Modify: `src/app/api/cycles/[cycleId]/generate-template/route.ts`
- Modify: `src/app/api/cycles/[cycleId]/plan-data/route.ts`
- Modify: `src/app/api/cycles/[cycleId]/plan-data/bulk-update/route.ts`
- Modify: `src/app/api/cycles/[cycleId]/submit/route.ts`
- Modify: `src/app/api/cycles/[cycleId]/assign-gd/route.ts`
- Modify: `src/app/api/cycles/[cycleId]/versions/route.ts`
- Modify: `src/app/api/cycles/[cycleId]/import-excel/route.ts`
- Modify: `src/app/api/cycles/[cycleId]/import-excel/apply/route.ts`
- Modify: `src/app/api/templates/[fileType]/route.ts`
- Modify: `src/app/api/master-data/[type]/route.ts`

**Pattern:** Wrap each existing handler with `withAuth`. The key mapping:

| API Route | Method | Permission Required |
|-----------|--------|-------------------|
| `/api/cycles` | GET | `view_all_otbs` (or `view_approved_otbs` for ReadOnly — check in handler) |
| `/api/cycles` | POST | `create_cycle` |
| `/api/cycles/[id]` | GET | `view_all_otbs` (or brand-scoped for GD) |
| `/api/cycles/[id]` | PUT | `create_cycle` |
| `/api/cycles/[id]/activate` | POST | `create_cycle` |
| `/api/cycles/[id]/upload/[type]` | POST | `upload_data` |
| `/api/cycles/[id]/upload-status` | GET | `upload_data` |
| `/api/cycles/[id]/generate-template` | POST | `create_cycle` |
| `/api/cycles/[id]/plan-data` | GET | `null` (any authenticated — RLS handles scoping) |
| `/api/cycles/[id]/plan-data/bulk-update` | POST | `edit_otb` |
| `/api/cycles/[id]/submit` | POST | `submit_otb` |
| `/api/cycles/[id]/assign-gd` | PUT | `assign_gd` |
| `/api/cycles/[id]/versions` | GET | `null` (any authenticated) |
| `/api/cycles/[id]/import-excel` | POST | `edit_otb` |
| `/api/cycles/[id]/import-excel/apply` | POST | `edit_otb` |
| `/api/templates/[type]` | GET | `null` (any authenticated) |
| `/api/master-data/[type]` | GET | `null` (any authenticated) |

**Step 1: Retrofit cycles list + create (example)**

```typescript
// src/app/api/cycles/route.ts — REPLACE existing handlers
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { createServerClient } from '@/lib/supabase/server';

export const GET = withAuth(null, async (req, auth) => {
  const supabase = await createServerClient();

  // RLS handles visibility — GD sees only assigned brands, ReadOnly sees only Approved
  const { data, error } = await supabase
    .from('otb_cycles')
    .select('*, brands(name)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

export const POST = withAuth('create_cycle', async (req, auth) => {
  const supabase = await createServerClient();
  const body = await req.json();

  const { data, error } = await supabase
    .from('otb_cycles')
    .insert({ ...body, created_by: auth.user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
});
```

**Step 2: Apply same pattern to all remaining API routes**

For each route:
1. Import `withAuth` and the required permission
2. Wrap handler: `export const GET = withAuth('permission', async (req, auth) => { ... })`
3. Replace `createServerClient()` usage to use the authenticated client (RLS-aware)
4. For GD-specific routes (bulk-update, submit), add brand-scoping check:
   ```typescript
   if (auth.profile.role === 'GD') {
     // Verify cycle belongs to GD's assigned brand
     const { data: cycle } = await supabase
       .from('otb_cycles')
       .select('brand_id')
       .eq('id', cycleId)
       .single();
     if (!auth.profile.assigned_brands.includes(cycle.brand_id)) {
       return NextResponse.json({ error: 'Not assigned to this brand' }, { status: 403 });
     }
   }
   ```

**Step 3: Commit**

```bash
git add src/app/api/
git commit -m "feat: retrofit auth to all existing API routes with permission checks"
```

---

### Task 8: Retrofit Auth to Frontend Pages

**Files:**
- Modify: `src/app/cycles/page.tsx`
- Modify: `src/app/cycles/new/page.tsx`
- Modify: `src/app/cycles/[cycleId]/page.tsx`
- Modify: `src/app/cycles/[cycleId]/upload/page.tsx`
- Modify: `src/app/cycles/[cycleId]/grid/page.tsx`

**Key changes per page:**

1. **Cycles list** (`/cycles`): Show all cycles for Admin/Planning/Finance/CXO. For GD, filter to assigned brands (RLS handles this at API level, so no frontend changes needed other than messaging).

2. **Create cycle** (`/cycles/new`): Wrap with `<ProtectedRoute permission="create_cycle">`.

3. **Cycle detail** (`/cycles/[id]`): Show upload/activate controls only for Admin/Planning. Show assign-GD only for Admin/Planning.

4. **Upload page** (`/cycles/[id]/upload`): Wrap with `<ProtectedRoute permission="upload_data">`.

5. **Grid page** (`/cycles/[id]/grid`):
   - GD + cycle in Filling status → editable
   - All other roles or cycle not in Filling → read-only
   - Submit button visible only to GD
   - Use `useAuth()` to check role

```typescript
// Example: grid page auth-aware editable check
const { profile } = useAuth();
const isEditable = profile?.role === 'GD'
  && cycle.status === 'Filling'
  && profile.assigned_brands.includes(cycle.brand_id);
```

**Step 1: Apply changes to each page**

**Step 2: Commit**

```bash
git add src/app/cycles/
git commit -m "feat: role-based UI controls on all existing pages"
```

---

### Task 9: Auth Integration Tests

**Files:**
- Create: `tests/integration/auth.test.ts`
- Create: `tests/integration/rbac.test.ts`

**Step 1: Write auth tests**

```typescript
// tests/integration/auth.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createAdminClient } from '../../src/lib/supabase/server';

describe('Authentication', () => {
  const admin = createAdminClient();

  it('creates user via admin API and profile auto-created', async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: 'test-gd@bewakoof.com',
      password: 'TestPassword123!',
      email_confirm: true,
      user_metadata: { full_name: 'Test GD', role: 'GD' },
    });
    expect(error).toBeNull();
    expect(data.user).toBeDefined();

    // Profile should be auto-created by trigger
    const { data: profile } = await admin
      .from('profiles')
      .select('*')
      .eq('id', data.user!.id)
      .single();
    expect(profile?.role).toBe('GD');
    expect(profile?.full_name).toBe('Test GD');
  });

  it('deactivated user cannot access API', async () => {
    // Deactivate user
    await admin
      .from('profiles')
      .update({ is_active: false })
      .eq('email', 'test-gd@bewakoof.com');

    // Attempt API call with this user's token should return 403
    // (test via fetch with the user's JWT)
  });
});
```

```typescript
// tests/integration/rbac.test.ts
import { describe, it, expect } from 'vitest';
import { createAdminClient } from '../../src/lib/supabase/server';

describe('RBAC enforcement', () => {
  it('GD cannot see cycles for unassigned brands', async () => {
    // Create GD user assigned to Bewakoof only
    // Create cycle for TIGC
    // Attempt to read TIGC cycle as GD → should return empty
  });

  it('ReadOnly cannot see non-approved cycles', async () => {
    // Create ReadOnly user
    // Create cycle with status 'Filling'
    // Attempt to read → should return empty
  });

  it('Planning cannot edit OTB data', async () => {
    // Create Planning user
    // Attempt bulk-update → should return 403
  });

  it('GD cannot create cycles', async () => {
    // POST /api/cycles as GD → 403
  });
});
```

**Step 2: Run tests**

```bash
npx vitest run tests/integration/auth.test.ts tests/integration/rbac.test.ts
```

**Step 3: Commit**

```bash
git add tests/integration/auth.test.ts tests/integration/rbac.test.ts
git commit -m "test: auth and RBAC integration tests"
```

---

## SPRINT 6: Admin UIs, Master Data Management & Audit (Weeks 11-12)

---

### Task 10: Admin User Management API

**Files:**
- Create: `src/app/api/admin/users/route.ts`
- Create: `src/app/api/admin/users/[userId]/route.ts`

**Step 1: Users CRUD API**

```typescript
// src/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { createAdminClient } from '@/lib/supabase/server';

// GET: List all users with profiles
export const GET = withAuth('manage_users', async (req, auth) => {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// POST: Create new user (via Supabase Auth admin API)
export const POST = withAuth('manage_users', async (req, auth) => {
  const admin = createAdminClient();
  const { email, password, full_name, role, assigned_brands } = await req.json();

  // Create auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

  // Update profile with assigned brands (trigger creates basic profile)
  if (assigned_brands?.length) {
    await admin
      .from('profiles')
      .update({ assigned_brands })
      .eq('id', authData.user.id);
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  return NextResponse.json(profile, { status: 201 });
});
```

```typescript
// src/app/api/admin/users/[userId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { createAdminClient } from '@/lib/supabase/server';

// PUT: Update user profile (role, assigned brands, active status)
export const PUT = withAuth('manage_users', async (req, auth, { params }: { params: { userId: string } }) => {
  const admin = createAdminClient();
  const { userId } = params;
  const body = await req.json();

  const allowedFields = ['full_name', 'role', 'assigned_brands', 'is_active'];
  const updates: Record<string, any> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }
  updates.updated_at = new Date().toISOString();

  const { data, error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// DELETE: Soft-deactivate user (set is_active = false)
export const DELETE = withAuth('manage_users', async (req, auth, { params }: { params: { userId: string } }) => {
  const admin = createAdminClient();
  const { userId } = params;

  // Prevent self-deactivation
  if (userId === auth.user.id) {
    return NextResponse.json({ error: 'Cannot deactivate yourself' }, { status: 400 });
  }

  const { error } = await admin
    .from('profiles')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
});
```

**Step 2: Commit**

```bash
git add src/app/api/admin/users/
git commit -m "feat: admin user management API (create, update, deactivate)"
```

---

### Task 11: Admin User Management UI

**Files:**
- Create: `src/app/admin/users/page.tsx`
- Create: `src/components/UserManagement.tsx`

**Step 1: User management page**

```typescript
// src/app/admin/users/page.tsx
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { UserManagement } from '@/components/UserManagement';

export default function UsersPage() {
  return (
    <ProtectedRoute permission="manage_users">
      <UserManagement />
    </ProtectedRoute>
  );
}
```

**Step 2: UserManagement component**

```typescript
// src/components/UserManagement.tsx
'use client';

import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Switch, Tag, Space, message } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import type { UserProfile, Role, Brand } from '@/types/otb';

const ROLES: Role[] = ['Admin', 'Planning', 'GD', 'Finance', 'CXO', 'ReadOnly'];

const ROLE_COLORS: Record<Role, string> = {
  Admin: 'red', Planning: 'blue', GD: 'green',
  Finance: 'orange', CXO: 'purple', ReadOnly: 'default',
};

export function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/users').then(r => r.json()),
      fetch('/api/master-data/brands').then(r => r.json()),
    ]).then(([usersData, brandsData]) => {
      setUsers(usersData);
      setBrands(brandsData);
      setLoading(false);
    });
  }, []);

  async function handleSave(values: any) {
    const url = editingUser
      ? `/api/admin/users/${editingUser.id}`
      : '/api/admin/users';
    const method = editingUser ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const err = await res.json();
      message.error(err.error);
      return;
    }

    message.success(editingUser ? 'User updated' : 'User created');
    setModalOpen(false);
    setEditingUser(null);
    form.resetFields();
    // Refresh
    const data = await fetch('/api/admin/users').then(r => r.json());
    setUsers(data);
  }

  const columns = [
    { title: 'Name', dataIndex: 'full_name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Role', dataIndex: 'role', key: 'role',
      render: (role: Role) => <Tag color={ROLE_COLORS[role]}>{role}</Tag>,
    },
    {
      title: 'Assigned Brands', dataIndex: 'assigned_brands', key: 'brands',
      render: (brandIds: string[]) => brandIds?.map(id => {
        const brand = brands.find(b => b.id === id);
        return brand ? <Tag key={id}>{brand.name}</Tag> : null;
      }),
    },
    {
      title: 'Active', dataIndex: 'is_active', key: 'active',
      render: (active: boolean) => <Tag color={active ? 'green' : 'red'}>{active ? 'Yes' : 'No'}</Tag>,
    },
    {
      title: 'Actions', key: 'actions',
      render: (_: any, record: UserProfile) => (
        <Button
          icon={<EditOutlined />}
          size="small"
          onClick={() => { setEditingUser(record); form.setFieldsValue(record); setModalOpen(true); }}
        />
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>User Management</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingUser(null); form.resetFields(); setModalOpen(true); }}>
          Add User
        </Button>
      </div>

      <Table dataSource={users} columns={columns} rowKey="id" loading={loading} />

      <Modal
        title={editingUser ? 'Edit User' : 'Create User'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingUser(null); }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          {!editingUser && (
            <>
              <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="password" label="Password" rules={[{ required: true, min: 12 }]}>
                <Input.Password />
              </Form.Item>
            </>
          )}
          <Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select options={ROLES.map(r => ({ value: r, label: r }))} />
          </Form.Item>
          <Form.Item name="assigned_brands" label="Assigned Brands" tooltip="Required for GD role">
            <Select
              mode="multiple"
              options={brands.map(b => ({ value: b.id, label: b.name }))}
              placeholder="Select brands (for GD)"
            />
          </Form.Item>
          {editingUser && (
            <Form.Item name="is_active" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/admin/users/page.tsx src/components/UserManagement.tsx
git commit -m "feat: admin user management UI with create, edit, deactivate"
```

---

### Task 12: Master Data Management UI

**Files:**
- Modify: `src/app/api/master-data/[type]/route.ts` — add POST, PUT
- Create: `src/app/admin/master-data/page.tsx`
- Create: `src/components/MasterDataManager.tsx`
- Create: `src/app/admin/mappings/page.tsx`

**Step 1: Add write endpoints to master data API**

```typescript
// src/app/api/master-data/[type]/route.ts — ADD POST and PUT handlers

export const POST = withAuth('manage_master_data', async (req, auth, { params }: { params: { type: string } }) => {
  const { type } = params;
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }
  const supabase = await createServerClient();
  const body = await req.json();

  const { data, error } = await supabase.from(type).insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
});

export const PUT = withAuth('manage_master_data', async (req, auth, { params }: { params: { type: string } }) => {
  const { type } = params;
  const supabase = await createServerClient();
  const body = await req.json();
  const { id, ...updates } = body;

  const { data, error } = await supabase.from(type).update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});
```

**Step 2: Master data management page**

Build an AntD Tabs UI with tabs for: Brands, Sub Brands, Sub Categories, Channels, Genders. Each tab has a Table with inline add/edit. Admin-only, wrapped with `<ProtectedRoute permission="manage_master_data">`.

**Step 3: Mappings page**

Separate page for master_mappings CRUD — table with columns: mapping_type, raw_value, standard_value, brand. Inline edit + add new row.

**Step 4: Commit**

```bash
git add src/app/api/master-data/ src/app/admin/master-data/ src/components/MasterDataManager.tsx src/app/admin/mappings/
git commit -m "feat: master data and mappings CRUD UI (admin only)"
```

---

### Task 13: Audit Logging — Schema & Service

**Files:**
- Create: `supabase/migrations/003_audit_logs.sql`
- Create: `src/lib/auth/auditLogger.ts`
- Test: `tests/unit/auditLogger.test.ts`

**Step 1: Write audit log migration**

```sql
-- supabase/migrations/003_audit_logs.sql

create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  entity_type text not null,           -- 'cycle', 'plan_data', 'file_upload', 'user', 'master_data'
  entity_id uuid,
  action text not null,                -- 'CREATE', 'UPDATE', 'SUBMIT', 'APPROVE', 'REJECT', 'REVERT', 'LOGIN', 'LOGOUT'
  user_id uuid references profiles(id),
  user_email text,
  user_role text,
  details jsonb,                       -- action-specific metadata
  ip_address text,
  created_at timestamptz default now()
);

-- Index for common queries
create index idx_audit_entity on audit_logs(entity_type, entity_id);
create index idx_audit_user on audit_logs(user_id);
create index idx_audit_action on audit_logs(action);
create index idx_audit_created on audit_logs(created_at);

-- 7-year retention: no auto-delete — handled at infrastructure level
-- Partitioning by month for query performance on large datasets
-- (optional — add if table exceeds 10M rows)
```

**Step 2: Write failing test**

```typescript
// tests/unit/auditLogger.test.ts
import { describe, it, expect, vi } from 'vitest';
import { buildAuditEntry, type AuditAction } from '../../src/lib/auth/auditLogger';

describe('Audit Logger', () => {
  it('builds correct audit entry for cycle creation', () => {
    const entry = buildAuditEntry({
      entityType: 'cycle',
      entityId: 'cycle-123',
      action: 'CREATE',
      userId: 'user-456',
      userEmail: 'planner@bewakoof.com',
      userRole: 'Planning',
      details: { cycle_name: 'Bewakoof Q4 FY26' },
    });

    expect(entry.entity_type).toBe('cycle');
    expect(entry.entity_id).toBe('cycle-123');
    expect(entry.action).toBe('CREATE');
    expect(entry.user_id).toBe('user-456');
    expect(entry.details).toEqual({ cycle_name: 'Bewakoof Q4 FY26' });
  });

  it('builds correct audit entry for bulk update', () => {
    const entry = buildAuditEntry({
      entityType: 'plan_data',
      entityId: 'cycle-123',
      action: 'UPDATE',
      userId: 'user-789',
      userEmail: 'gd@bewakoof.com',
      userRole: 'GD',
      details: { rows_updated: 15, months_affected: ['2026-01-01', '2026-02-01'] },
    });

    expect(entry.action).toBe('UPDATE');
    expect(entry.details.rows_updated).toBe(15);
  });
});
```

**Step 3: Implement**

```typescript
// src/lib/auth/auditLogger.ts
import { createAdminClient } from '@/lib/supabase/server';

export type AuditAction =
  | 'CREATE' | 'UPDATE' | 'DELETE'
  | 'SUBMIT' | 'APPROVE' | 'REJECT' | 'REVERT'
  | 'LOGIN' | 'LOGOUT'
  | 'UPLOAD' | 'ACTIVATE' | 'ASSIGN';

interface AuditEntryInput {
  entityType: string;
  entityId: string;
  action: AuditAction;
  userId: string;
  userEmail: string;
  userRole: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

interface AuditEntry {
  entity_type: string;
  entity_id: string;
  action: string;
  user_id: string;
  user_email: string;
  user_role: string;
  details: Record<string, any>;
  ip_address: string | null;
}

export function buildAuditEntry(input: AuditEntryInput): AuditEntry {
  return {
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    user_id: input.userId,
    user_email: input.userEmail,
    user_role: input.userRole,
    details: input.details ?? {},
    ip_address: input.ipAddress ?? null,
  };
}

export async function logAudit(input: AuditEntryInput): Promise<void> {
  const admin = createAdminClient();
  const entry = buildAuditEntry(input);

  await admin.from('audit_logs').insert(entry);
  // Fire-and-forget — audit logging should never block the main operation
}

// Helper to extract IP from Next.js request
export function getClientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? headers.get('x-real-ip')
    ?? 'unknown';
}
```

**Step 4: Run tests → PASS**

**Step 5: Commit**

```bash
git add supabase/migrations/003_audit_logs.sql src/lib/auth/auditLogger.ts tests/unit/auditLogger.test.ts
git commit -m "feat: audit log schema and logging service"
```

---

### Task 14: Add Audit Logging to All State-Changing Operations

**Files:**
- Modify: `src/app/api/cycles/route.ts` (POST — create)
- Modify: `src/app/api/cycles/[cycleId]/activate/route.ts`
- Modify: `src/app/api/cycles/[cycleId]/upload/[fileType]/route.ts`
- Modify: `src/app/api/cycles/[cycleId]/plan-data/bulk-update/route.ts`
- Modify: `src/app/api/cycles/[cycleId]/submit/route.ts`
- Modify: `src/app/api/cycles/[cycleId]/assign-gd/route.ts`
- Modify: `src/app/api/cycles/[cycleId]/import-excel/apply/route.ts`
- Modify: `src/app/api/admin/users/route.ts` (POST)
- Modify: `src/app/api/admin/users/[userId]/route.ts` (PUT, DELETE)

**Pattern:** After each successful operation, add:

```typescript
import { logAudit, getClientIp } from '@/lib/auth/auditLogger';

// After successful operation:
await logAudit({
  entityType: 'cycle',
  entityId: data.id,
  action: 'CREATE',
  userId: auth.user.id,
  userEmail: auth.user.email,
  userRole: auth.profile.role,
  details: { cycle_name: body.cycle_name, brand_id: body.brand_id },
  ipAddress: getClientIp(req.headers),
});
```

**Actions to log per endpoint:**

| Endpoint | Action | Details |
|----------|--------|---------|
| POST `/api/cycles` | CREATE | cycle_name, brand_id |
| POST `.../activate` | ACTIVATE | cycle_id |
| POST `.../upload/[type]` | UPLOAD | file_type, file_name, row_count, valid |
| POST `.../bulk-update` | UPDATE | rows_updated, months_affected |
| POST `.../submit` | SUBMIT | cycle_id |
| PUT `.../assign-gd` | ASSIGN | gd_id, gd_name |
| POST `.../import-excel/apply` | UPDATE | rows_imported |
| POST `/api/admin/users` | CREATE | email, role |
| PUT `/api/admin/users/[id]` | UPDATE | changed_fields |
| DELETE `/api/admin/users/[id]` | DELETE | user_email |

**Commit:**

```bash
git add src/app/api/
git commit -m "feat: audit logging on all state-changing API operations"
```

---

### Task 15: Audit Log Viewer API & UI

**Files:**
- Create: `src/app/api/admin/audit-logs/route.ts`
- Create: `src/app/api/admin/audit-logs/export/route.ts`
- Create: `src/app/admin/audit-logs/page.tsx`
- Create: `src/components/AuditLogViewer.tsx`

**Step 1: Audit log API with filters**

```typescript
// src/app/api/admin/audit-logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { createAdminClient } from '@/lib/supabase/server';

export const GET = withAuth('view_audit_logs', async (req, auth) => {
  const admin = createAdminClient();
  const url = req.nextUrl;

  let query = admin
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  // Filters
  const entityType = url.searchParams.get('entityType');
  const action = url.searchParams.get('action');
  const userId = url.searchParams.get('userId');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const page = parseInt(url.searchParams.get('page') ?? '1');
  const pageSize = parseInt(url.searchParams.get('pageSize') ?? '50');

  if (entityType) query = query.eq('entity_type', entityType);
  if (action) query = query.eq('action', action);
  if (userId) query = query.eq('user_id', userId);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  // Pagination
  const start = (page - 1) * pageSize;
  query = query.range(start, start + pageSize - 1);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, total: count, page, pageSize });
});
```

**Step 2: CSV export endpoint**

```typescript
// src/app/api/admin/audit-logs/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { createAdminClient } from '@/lib/supabase/server';

export const GET = withAuth('view_audit_logs', async (req, auth) => {
  const admin = createAdminClient();

  const url = req.nextUrl;
  let query = admin
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10000); // Max export rows

  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Build CSV
  const headers = ['timestamp', 'action', 'entity_type', 'entity_id', 'user_email', 'user_role', 'details', 'ip_address'];
  const csvRows = [headers.join(',')];
  for (const row of data ?? []) {
    csvRows.push([
      row.created_at,
      row.action,
      row.entity_type,
      row.entity_id ?? '',
      row.user_email ?? '',
      row.user_role ?? '',
      JSON.stringify(row.details ?? {}),
      row.ip_address ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  }

  return new NextResponse(csvRows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().slice(0,10)}.csv"`,
    },
  });
});
```

**Step 3: Audit log viewer UI**

AntD Table with:
- Columns: Timestamp (IST), Action, Entity Type, User, Role, Details, IP
- Filters: entity_type dropdown, action dropdown, date range picker, user search
- Pagination: 50 per page
- "Export CSV" button

Wrapped with `<ProtectedRoute permission="view_audit_logs">`.

**Step 4: Commit**

```bash
git add src/app/api/admin/audit-logs/ src/app/admin/audit-logs/ src/components/AuditLogViewer.tsx
git commit -m "feat: audit log viewer with filters, pagination, CSV export"
```

---

### Task 16: Sprint 5-6 Integration Tests

**Files:**
- Create: `tests/integration/auditLogs.test.ts`
- Modify: `tests/integration/rbac.test.ts` — expand

**Step 1: Audit log tests**

```typescript
// tests/integration/auditLogs.test.ts
import { describe, it, expect } from 'vitest';

describe('Audit Logging', () => {
  it('cycle creation generates audit log entry', async () => {
    // Create cycle via API
    // Query audit_logs for entity_type='cycle', action='CREATE'
    // Verify user_id, details, timestamp present
  });

  it('bulk update generates audit log with row count', async () => {
    // Perform bulk update
    // Query audit_logs for action='UPDATE'
    // Verify details.rows_updated
  });

  it('submission generates audit log', async () => {
    // Submit cycle
    // Query audit_logs for action='SUBMIT'
  });

  it('user creation generates audit log', async () => {
    // Create user via admin API
    // Verify audit entry
  });

  it('CSV export returns valid CSV', async () => {
    // GET /api/admin/audit-logs/export
    // Verify Content-Type is text/csv
    // Verify rows match expected count
  });
});
```

**Step 2: Expand RBAC tests with full flow**

```typescript
// Add to tests/integration/rbac.test.ts

it('full GD flow: login → see assigned brand only → edit → submit', async () => {
  // 1. Create GD user assigned to Bewakoof
  // 2. Create cycle for Bewakoof (as admin)
  // 3. Login as GD
  // 4. GET /api/cycles → see only Bewakoof cycle
  // 5. Bulk update plan data → success
  // 6. Submit → success
});

it('full Planning flow: create cycle, upload, assign GD', async () => {
  // Login as Planning
  // Create cycle, upload files, assign GD → all succeed
  // Edit OTB → 403
});

it('admin can manage users and see audit logs', async () => {
  // Login as Admin
  // Create user → success
  // View audit logs → success
});

it('Finance/CXO can view and approve but not edit', async () => {
  // Login as Finance
  // View cycles → success
  // Edit OTB → 403
  // (Approval tested in Sprint 7-8)
});
```

**Step 3: Run all tests**

```bash
npx vitest run tests/
```

**Step 4: Commit**

```bash
git add tests/
git commit -m "test: Sprint 5-6 integration tests — auth, RBAC, audit logging"
```

---

### Task 17: E2E Test — Full Auth Flow

**Files:**
- Create: `tests/e2e/authFlow.test.ts`

**Step 1: Playwright E2E test**

```typescript
// tests/e2e/authFlow.test.ts
import { test, expect } from '@playwright/test';

test.describe('Auth Flow E2E', () => {
  test('unauthenticated user redirected to login', async ({ page }) => {
    await page.goto('/cycles');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login with valid credentials → dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder="Email"]', 'admin@bewakoof.com');
    await page.fill('input[placeholder="Password"]', 'AdminPassword123!');
    await page.click('button:has-text("Sign In")');
    await expect(page).toHaveURL('/');
  });

  test('GD sees only assigned brand in cycles list', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder="Email"]', 'gd-bewakoof@bewakoof.com');
    await page.fill('input[placeholder="Password"]', 'GDPassword123!');
    await page.click('button:has-text("Sign In")');

    await page.goto('/cycles');
    // Should see only Bewakoof cycles
    await expect(page.locator('text=Bewakoof')).toBeVisible();
    // Should NOT see TIGC if exists
  });

  test('GD cannot navigate to admin pages', async ({ page }) => {
    // Login as GD
    await page.goto('/admin/users');
    await expect(page.locator('text=Access Denied')).toBeVisible();
  });

  test('admin can access user management', async ({ page }) => {
    // Login as Admin
    await page.goto('/admin/users');
    await expect(page.locator('text=User Management')).toBeVisible();
  });

  test('sign out → redirected to login', async ({ page }) => {
    // Login first, then click sign out
    await page.click('text=Sign Out');
    await expect(page).toHaveURL(/\/login/);
  });
});
```

**Step 2: Run E2E tests**

```bash
npx playwright test tests/e2e/authFlow.test.ts
```

**Step 3: Commit**

```bash
git add tests/e2e/authFlow.test.ts
git commit -m "test: E2E auth flow — login, role-scoping, sign out"
```

---

### Task 18: Sprint 5-6 Polish & Production Deploy

**Checklist:**
- [ ] Login page styled and responsive
- [ ] Session refresh works (1hr token expiry → auto-refresh)
- [ ] Role-based nav sidebar shows correct items per role
- [ ] GD only sees assigned brand cycles
- [ ] ReadOnly only sees approved cycles
- [ ] All existing features (upload, grid, submit) work with auth
- [ ] Admin can create/edit/deactivate users
- [ ] Admin can manage master data (Brands, Sub Brands, Sub Categories, Channels, Genders)
- [ ] Admin can manage standardization mappings
- [ ] All state-changing actions logged in audit_logs
- [ ] Admin can view audit logs with filters
- [ ] Admin can export audit logs to CSV
- [ ] All unit + integration + E2E tests passing
- [ ] No RLS leaks — GD cannot see other brands' data via direct API calls
- [ ] Deactivated users cannot login or access APIs

**Commit:**

```bash
git add -A
git commit -m "feat: Sprint 5-6 complete — auth, RBAC, admin UIs, audit logging"
```

**Production deploy:** All existing features now behind authentication with role-based access. GDs see only their assigned brand. All actions audited.

---

## Task Dependency Graph

```
Sprint 5 (Weeks 9-10):

  Task 1: Types + Roles ──────┐
  Task 2: DB Migration ────────┤── Foundation (parallelize 1, 2, 3)
  Task 3: Supabase Client ─────┘
  Task 4: Login Page ──────────── depends on 3
  Task 5: Auth Context + Layout ── depends on 1, 3
  Task 6: withAuth Wrapper ──────── depends on 1, 3
  Task 7: Retrofit API Auth ─────── depends on 6
  Task 8: Retrofit Frontend Auth ── depends on 5, 7
  Task 9: Auth Integration Tests ── depends on 7, 8

Sprint 6 (Weeks 11-12):

  Task 10: User Mgmt API ──────── depends on 6
  Task 11: User Mgmt UI ──────── depends on 10, 5
  Task 12: Master Data UI ─────── depends on 6, 5
  Task 13: Audit Log Schema ───── independent (parallelize with 10-12)
  Task 14: Add Audit to APIs ──── depends on 13, 7
  Task 15: Audit Log Viewer ───── depends on 13, 14
  Task 16: Integration Tests ───── depends on all above
  Task 17: E2E Tests ──────────── depends on all above
  Task 18: Polish + Deploy ────── depends on all above
```

---

## Key Decisions & Rationale

| Decision | Rationale |
|----------|-----------|
| **Supabase Auth (cookie-based)** | Built-in to our stack. `@supabase/ssr` handles cookie management for Next.js. No separate auth server needed. |
| **`profiles` table extending auth.users** | Supabase auth.users is immutable. profiles stores our app-specific data (role, brand assignments). Trigger auto-creates profile on signup. |
| **RLS as defense-in-depth** | Even if API-level checks have a bug, RLS prevents data leakage at the DB layer. GDs physically cannot query other brands' data. |
| **`withAuth()` wrapper pattern** | Single point of enforcement. Every API route gets auth + permission check by changing one line. Consistent 401/403 responses. |
| **Service-role client for audit** | Audit logs should never be blocked by RLS. Using `createAdminClient()` bypasses RLS for logging. |
| **Soft-delete for users** | `is_active = false` instead of deletion. Preserves audit trail integrity (historical entries still reference the user). |
| **Fire-and-forget audit logging** | `logAudit()` is async but not awaited in critical path. Audit failures should never block business operations. |
| **7-year audit retention** | PRD requirement (11.2). No auto-delete. Infrastructure-level archival for old data. |
