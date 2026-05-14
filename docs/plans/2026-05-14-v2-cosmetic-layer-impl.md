# V2 Cosmetic Layer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a `/v2/*` route tree with the WMS Design System (warm-neutral, Inter, terra-cotta primary) that a CEO can demo, without touching any existing file.

**Architecture:** New `src/app/v2/` directory. The v2 layout renders a `position: fixed; inset: 0; z-index: 200` shell that covers the existing Ant Design AppLayout. AuthProvider and BrandProvider from the root layout stay active — all hooks just work. No existing file is modified.

**Tech Stack:** Next.js App Router, React, TypeScript, plain CSS custom properties (no Tailwind/Ant Design in v2 files), existing hooks: `useAuth`, `useBrand`, `useDashboardData`.

---

### Task 1: Create globals-v2.css

**Files:**
- Create: `src/app/v2/globals-v2.css`

No test needed — pure CSS file.

**Step 1: Create the file**

Create `src/app/v2/globals-v2.css` with this exact content (verbatim from DESIGN_SYSTEM.md §21):

```css
/* ── Design System v2 ── */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

:root {
  --primary:        #CC785C;
  --primary-dark:   #B5633E;
  --primary-light:  #FDF0EB;
  --primary-ring:   rgba(204, 120, 92, 0.22);

  --success:        #2E7D52;
  --success-bg:     #EDFAF4;
  --success-border: #A7E8C8;
  --warning:        #92400E;
  --warning-bg:     #FFFBEB;
  --warning-border: #FDE68A;
  --danger:         #B91C1C;
  --danger-bg:      #FEF2F2;
  --danger-border:  #FECACA;
  --info:           #1D4ED8;
  --info-bg:        #EFF6FF;
  --info-border:    #BFDBFE;

  --text:           #1C1917;
  --text-secondary: #78716C;
  --text-tertiary:  #A8A29E;
  --border:         #E7E5E0;
  --border-strong:  #D6D3CD;
  --bg:             #FAF9F6;
  --bg-subtle:      #F5F4EF;
  --surface:        #FFFFFF;
  --surface-raised: #FFFFFF;

  --sidebar-width:     260px;
  --sidebar-bg:        #FFFFFF;
  --sidebar-border:    #EEEDE8;
  --sidebar-active-bg: #FDF0EB;
  --sidebar-active:    #CC785C;

  --radius-sm:   6px;
  --radius:      10px;
  --radius-lg:   14px;
  --radius-xl:   18px;
  --radius-full: 999px;

  --shadow-xs: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-sm: 0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04);
  --shadow-lg: 0 12px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04);

  --t-fast: 0.12s ease;
  --t-base: 0.18s ease;
}

/* ── Buttons ── */
.btn-primary { background: var(--primary); color: #fff; border: none; border-radius: var(--radius-sm); font-family: inherit; font-size: 13.5px; font-weight: 500; padding: 7px 15px; cursor: pointer; transition: all var(--t-fast); box-shadow: 0 1px 3px rgba(204,120,92,0.35); }
.btn-primary:hover:not(:disabled) { background: var(--primary-dark); }
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

.btn-secondary { background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: inherit; font-size: 13.5px; font-weight: 500; padding: 7px 15px; cursor: pointer; transition: all var(--t-fast); box-shadow: var(--shadow-xs); }
.btn-secondary:hover:not(:disabled) { background: var(--bg-subtle); border-color: var(--border-strong); }

.btn-ghost { background: transparent; color: var(--text-secondary); border: 1px solid transparent; border-radius: var(--radius-sm); font-family: inherit; font-size: 13.5px; font-weight: 500; padding: 7px 15px; cursor: pointer; transition: all var(--t-fast); }
.btn-ghost:hover:not(:disabled) { background: var(--bg-subtle); color: var(--text); }

.btn-sm { padding: 4px 10px !important; font-size: 12.5px !important; }
.btn-lg { padding: 10px 20px !important; font-size: 15px !important; border-radius: var(--radius) !important; }

/* ── Inputs (scoped to avoid leaking into CycleWorkspace) ── */
.v2-form input, .v2-form select, .v2-form textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 14px;
  outline: none;
  background: var(--surface);
  color: var(--text);
  transition: border-color var(--t-fast), box-shadow var(--t-fast);
  line-height: 1.4;
  box-sizing: border-box;
}
.v2-form input::placeholder, .v2-form textarea::placeholder { color: var(--text-tertiary); }
.v2-form input:focus, .v2-form select:focus, .v2-form textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-ring);
}

/* ── Cards ── */
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; box-shadow: var(--shadow-sm); }
.card-flat { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; }

/* ── Badges ── */
.badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: var(--radius-full); font-size: 11.5px; font-weight: 500; letter-spacing: 0.01em; white-space: nowrap; }
.badge-green  { background: var(--success-bg);    color: var(--success);      border: 1px solid var(--success-border); }
.badge-yellow { background: var(--warning-bg);    color: var(--warning);      border: 1px solid var(--warning-border); }
.badge-red    { background: var(--danger-bg);     color: var(--danger);       border: 1px solid var(--danger-border);  }
.badge-blue   { background: var(--info-bg);       color: var(--info);         border: 1px solid var(--info-border);    }
.badge-orange { background: var(--primary-light); color: var(--primary-dark); border: 1px solid #F3C9B7; }
.badge-gray   { background: var(--bg-subtle);     color: var(--text-secondary); border: 1px solid var(--border); }

/* ── Tables ── */
.v2-table { width: 100%; border-collapse: collapse; }
.v2-table thead tr { border-bottom: 1px solid var(--border); }
.v2-table th { text-align: left; padding: 10px 14px; font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-tertiary); background: var(--bg-subtle); white-space: nowrap; }
.v2-table th:first-child { border-radius: var(--radius-sm) 0 0 var(--radius-sm); }
.v2-table th:last-child  { border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
.v2-table td { padding: 12px 14px; border-bottom: 1px solid var(--border); color: var(--text); font-size: 13.5px; }
.v2-table tbody tr:last-child td { border-bottom: none; }
.v2-table tbody tr { transition: background var(--t-fast); }
.v2-table tbody tr:hover td { background: var(--bg); }

/* ── Form ── */
.form-group { margin-bottom: 16px; }
.form-group label { display: block; margin-bottom: 5px; font-size: 13px; font-weight: 500; color: var(--text); }
.form-hint { font-size: 11.5px; color: var(--text-tertiary); margin-top: 4px; }

/* ── Alerts ── */
.alert { padding: 11px 16px; border-radius: var(--radius); margin-bottom: 16px; font-size: 13.5px; display: flex; align-items: flex-start; gap: 10px; }
.alert-error   { background: var(--danger-bg);  color: var(--danger);  border: 1px solid var(--danger-border);  }
.alert-success { background: var(--success-bg); color: var(--success); border: 1px solid var(--success-border); }
.alert-warning { background: var(--warning-bg); color: var(--warning); border: 1px solid var(--warning-border); }
.alert-info    { background: var(--info-bg);    color: var(--info);    border: 1px solid var(--info-border);    }

/* ── Spinner ── */
.spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: v2spin 0.65s linear infinite; flex-shrink: 0; vertical-align: middle; }
.spinner-dark { border-color: rgba(28,25,23,0.15); border-top-color: var(--primary); }
@keyframes v2spin { to { transform: rotate(360deg); } }

/* ── Page header ── */
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 26px; gap: 16px; }
.page-header h1 { font-size: 22px; font-weight: 700; color: var(--text); letter-spacing: -0.02em; margin: 0; }
.page-header p  { color: var(--text-secondary); margin-top: 3px; font-size: 13.5px; margin-bottom: 0; }

/* ── Stat card ── */
.stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px 22px; box-shadow: var(--shadow-sm); }
.stat-card .stat-label { font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-tertiary); margin-bottom: 10px; }
.stat-card .stat-value { font-size: 28px; font-weight: 700; letter-spacing: -0.03em; color: var(--text); line-height: 1; }
.stat-card .stat-sub   { font-size: 12px; color: var(--text-secondary); margin-top: 6px; }

/* ── Empty state ── */
.empty-state { text-align: center; padding: 48px 24px; color: var(--text-secondary); }
.empty-state .empty-icon { font-size: 36px; margin-bottom: 12px; opacity: 0.6; }
.empty-state h3 { font-size: 16px; font-weight: 600; color: var(--text); margin-bottom: 6px; }
.empty-state p  { font-size: 13.5px; margin: 0; }

/* ── Animations ── */
@keyframes v2fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
.fade-in { animation: v2fadeIn 0.2s ease forwards; }
```

**Step 2: Verify file was created**

```bash
ls src/app/v2/globals-v2.css
```
Expected: file exists

**Step 3: Commit**

```bash
git add src/app/v2/globals-v2.css
git commit -m "feat(v2): add design system CSS for v2 route"
```

---

### Task 2: Create V2AppLayout (layout.tsx)

**Files:**
- Create: `src/app/v2/layout.tsx`

This is the highest-impact task — it provides the white sidebar + warm background that replaces the existing dark Ant Design shell for all `/v2/*` routes.

The layout renders a `position: fixed; inset: 0; z-index: 200` container that visually replaces the Ant Design AppLayout. AuthProvider and BrandProvider from the root `src/app/layout.tsx` remain active.

**Step 1: Create the file**

Create `src/app/v2/layout.tsx`:

```tsx
'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import { hasPermission } from '@/lib/auth/roles';
import './globals-v2.css';

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const NAV_ITEMS = [
  { href: '/v2',        label: 'Dashboard',  icon: '◈',  exact: true },
  { href: '/v2/cycles', label: 'OTB Cycles', icon: '📋', exact: false },
  { href: '/v2/wiki',   label: 'Wiki',       icon: '📖', exact: false },
];

export default function V2Layout({ children }: { children: React.ReactNode }) {
  const { profile, loading, signOut } = useAuth();
  const { brands, selectedBrandId } = useBrand();
  const router = useRouter();
  const pathname = usePathname();

  const brandGateCheckedRef = useRef(false);
  const [brandGateReady, setBrandGateReady] = useState(false);

  useEffect(() => {
    if (loading || !profile || brandGateCheckedRef.current) return;
    brandGateCheckedRef.current = true;
    const key = `otb_brand_selected_${profile.id}`;
    if (sessionStorage.getItem(key)) {
      setBrandGateReady(true);
    } else {
      if (!pathname?.startsWith('/brand-select')) {
        router.replace(`/brand-select?returnTo=${encodeURIComponent(pathname ?? '/v2')}`);
      } else {
        setBrandGateReady(true);
      }
    }
  }, [loading, profile, pathname, router]);

  // Loading spinner
  if (loading || (!brandGateReady && !!profile && !pathname?.startsWith('/brand-select'))) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#FAF9F6', fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{
          width: 36, height: 36,
          border: '4px solid #E7E5E0', borderTopColor: '#CC785C',
          borderRadius: '50%', animation: 'v2spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  // Pass-through for brand-select page
  if (pathname?.startsWith('/brand-select')) return <>{children}</>;

  // No profile → pass-through (login page handles itself)
  if (!profile) return <>{children}</>;

  const role = profile.role;
  const initials = getInitials(profile.full_name || profile.email);
  const selectedBrandName = selectedBrandId
    ? brands.find(b => b.id === selectedBrandId)?.name ?? 'Unknown'
    : 'All Brands';

  const adminItems: { href: string; label: string; icon: string }[] = [];
  if (hasPermission(role, 'manage_users'))
    adminItems.push({ href: '/admin/users', label: 'User Management', icon: '👤' });
  if (hasPermission(role, 'manage_master_data')) {
    adminItems.push({ href: '/admin/master-data', label: 'Master Data', icon: '🗃️' });
    adminItems.push({ href: '/admin/master-defaults', label: 'Defaults', icon: '⚙️' });
  }
  if (hasPermission(role, 'view_audit_logs'))
    adminItems.push({ href: '/admin/audit-logs', label: 'Audit Logs', icon: '📝' });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'var(--bg)',
      display: 'flex',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      fontSize: 14,
      color: 'var(--text)',
      overflow: 'hidden',
    }}>
      {/* ── Sidebar ── */}
      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: 'var(--sidebar-width)',
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
        display: 'flex', flexDirection: 'column',
        zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid var(--sidebar-border)' }}>
          <img src="/tmrw-logo.png" alt="TMRW" style={{ height: 28, marginBottom: 5, display: 'block' }} />
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.02em' }}>
            OTB Platform
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => {
            const active = item.exact
              ? pathname === item.href
              : (pathname?.startsWith(item.href) ?? false);
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 'var(--radius)',
                marginBottom: 2, textDecoration: 'none',
                background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                color: active ? 'var(--sidebar-active)' : 'var(--text-secondary)',
                fontWeight: active ? 600 : 400,
                fontSize: 14,
                transition: 'all var(--t-fast)',
                position: 'relative',
              }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
                {active && (
                  <span style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--sidebar-active)',
                  }} />
                )}
              </Link>
            );
          })}

          {adminItems.length > 0 && (
            <>
              <div style={{
                margin: '12px 0 6px', padding: '0 12px',
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--text-tertiary)',
              }}>
                Administration
              </div>
              {adminItems.map(item => {
                const active = pathname?.startsWith(item.href) ?? false;
                return (
                  <Link key={item.href} href={item.href} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 'var(--radius)',
                    marginBottom: 2, textDecoration: 'none',
                    background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                    color: active ? 'var(--sidebar-active)' : 'var(--text-secondary)',
                    fontWeight: active ? 600 : 400, fontSize: 14,
                    transition: 'all var(--t-fast)',
                  }}>
                    <span style={{ fontSize: 16 }}>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* User footer */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid var(--sidebar-border)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 'var(--radius)',
            background: 'var(--bg-subtle)',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--primary-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: 'var(--primary)',
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: 'var(--text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {profile.full_name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{profile.role}</div>
            </div>
            <button
              onClick={signOut}
              title="Sign out"
              style={{
                background: 'none', border: 'none', color: 'var(--text-tertiary)',
                cursor: 'pointer', padding: 4, fontSize: 16, lineHeight: 1,
              }}
            >
              ⇥
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div style={{
        marginLeft: 'var(--sidebar-width)',
        flex: 1,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <header style={{
          height: 56, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 36px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
              {selectedBrandName}
            </span>
            {brands.length > 1 && (
              <button
                onClick={() => router.push(
                  `/brand-select?returnTo=${encodeURIComponent(pathname ?? '/v2')}&switch=true`
                )}
                style={{
                  background: 'none', border: 'none',
                  fontSize: 12, color: 'var(--primary)',
                  cursor: 'pointer', padding: '2px 6px',
                  fontFamily: 'inherit',
                }}
              >
                Switch
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--primary-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: 'var(--primary)',
            }}>
              {initials}
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
              {profile.full_name}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main style={{
          flex: 1,
          padding: '28px 36px',
          background: 'var(--bg)',
          overflowY: 'auto',
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}
```

**Step 2: Start dev server and visit `/v2`**

```bash
npm run dev
```

Open `http://localhost:3000/v2` — you should see the new white sidebar with terra-cotta active state and warm background. The page content area will be empty (no page yet). Verify sidebar renders and doesn't break `/cycles` (existing route).

**Step 3: Commit**

```bash
git add src/app/v2/layout.tsx
git commit -m "feat(v2): add V2AppLayout with design system sidebar and header"
```

---

### Task 3: Create V2 Login page

**Files:**
- Create: `src/app/v2/login/page.tsx`

**Step 1: Create the file**

Create `src/app/v2/login/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

export default function V2LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') ?? '/v2';

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    window.location.href = `/brand-select?returnTo=${encodeURIComponent(redirectTo)}`;
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      background: 'linear-gradient(135deg, #CC785C 0%, #FDF0EB 100%)',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div className="card" style={{ width: 420, borderRadius: 18, padding: 36 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/tmrw-logo.png" alt="TMRW" style={{ height: 36, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            OTB Platform
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
            Open-To-Buy inventory planning
          </p>
        </div>

        {error && (
          <div className="alert alert-error">{error}</div>
        )}

        <form onSubmit={handleLogin} className="v2-form">
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@tmrw.in"
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '10px 0', fontSize: 15, marginTop: 8, borderRadius: 10 }}
          >
            {loading ? (
              <><span className="spinner" style={{ marginRight: 8 }} />Signing in…</>
            ) : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Verify in browser**

Visit `http://localhost:3000/v2/login` — you should see the terra-cotta gradient background, centered white card, Inter font, and the terra-cotta sign-in button. The V2AppLayout's fixed overlay renders, but since `!profile` is true, it passes through to children, so the login page renders full-screen without sidebar.

**Step 3: Commit**

```bash
git add src/app/v2/login/page.tsx
git commit -m "feat(v2): add V2 login page"
```

---

### Task 4: Create V2 Cycles list page

**Files:**
- Create: `src/app/v2/cycles/page.tsx`

**Step 1: Create the file**

Create `src/app/v2/cycles/page.tsx`:

```tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import { hasPermission } from '@/lib/auth/roles';
import type { OtbCycle } from '@/types/otb';

const STATUS_BADGE: Record<string, string> = {
  Draft: 'badge-gray',
  Filling: 'badge-yellow',
  InReview: 'badge-blue',
  Approved: 'badge-green',
};

const STATUS_LABEL: Record<string, string> = {
  InReview: 'In Review',
};

export default function V2CyclesPage() {
  const { profile } = useAuth();
  const { selectedBrandId } = useBrand();
  const [cycles, setCycles] = useState<OtbCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const canCreate = profile ? hasPermission(profile.role, 'create_cycle') : false;
  const isGd = profile?.role === 'GD';

  useEffect(() => {
    const controller = new AbortController();
    const url = selectedBrandId
      ? `/api/cycles?brandId=${selectedBrandId}`
      : '/api/cycles';
    setLoading(true);
    fetch(url, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        setCycles(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => { if (err.name !== 'AbortError') setLoading(false); });
    return () => controller.abort();
  }, [selectedBrandId]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { Draft: 0, Filling: 0, InReview: 0, Approved: 0 };
    cycles.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return counts;
  }, [cycles]);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>OTB Cycles</h1>
          <p>Manage and track planning cycles by brand.</p>
        </div>
        {canCreate && (
          <Link href="/cycles/new">
            <button className="btn-primary">+ New Cycle</button>
          </Link>
        )}
      </div>

      {/* Status summary cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 28,
      }}>
        {(['Draft', 'Filling', 'InReview', 'Approved'] as const).map(status => (
          <div key={status} className="stat-card">
            <div className="stat-label">{STATUS_LABEL[status] ?? status}</div>
            <div className="stat-value">{statusCounts[status] || 0}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)' }}>
          <div className="spinner spinner-dark" style={{ width: 28, height: 28, borderWidth: 3 }} />
        </div>
      ) : cycles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>No cycles yet</h3>
          <p>Cycles will appear here once created.</p>
        </div>
      ) : (
        <div className="card-flat" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="v2-table">
            <thead>
              <tr>
                <th>Cycle Name</th>
                <th>Brand</th>
                <th>Quarter</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map(cycle => {
                const href = isGd && ['Filling', 'InReview', 'Approved'].includes(cycle.status)
                  ? `/v2/cycles/${cycle.id}?tab=plan`
                  : `/v2/cycles/${cycle.id}`;
                return (
                  <tr key={cycle.id}>
                    <td>
                      <Link href={href} style={{ fontWeight: 500, color: 'var(--primary)', textDecoration: 'none' }}>
                        {cycle.cycle_name}
                      </Link>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {(cycle as OtbCycle & { brands?: { name: string } }).brands?.name ?? '-'}
                    </td>
                    <td>{cycle.planning_quarter}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[cycle.status] ?? 'badge-gray'}`}>
                        {STATUS_LABEL[cycle.status] ?? cycle.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {new Date(cycle.created_at).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify in browser**

Visit `http://localhost:3000/v2/cycles` — you should see four stat-cards for Draft/Filling/InReview/Approved counts, then the table with badge pills for status. Cycle name links to `/v2/cycles/[id]`.

**Step 3: Commit**

```bash
git add src/app/v2/cycles/page.tsx
git commit -m "feat(v2): add V2 cycles list page"
```

---

### Task 5: Create V2 Cycle Detail wrapper

**Files:**
- Create: `src/app/v2/cycles/[cycleId]/page.tsx`

**Step 1: Create the file**

Create `src/app/v2/cycles/[cycleId]/page.tsx`:

```tsx
'use client';

import { useParams } from 'next/navigation';
import { CycleWorkspace } from '@/components/cycle-workspace/CycleWorkspace';

export default function V2CycleWorkspacePage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  return <CycleWorkspace cycleId={cycleId} />;
}
```

**Step 2: Verify in browser**

Click any cycle from `/v2/cycles` — you should land on the cycle workspace (AG Grid, tabs, file uploads) unchanged, but inside the new v2 sidebar + header shell.

**Step 3: Commit**

```bash
git add src/app/v2/cycles/[cycleId]/page.tsx
git commit -m "feat(v2): add V2 cycle detail wrapper"
```

---

### Task 6: Create V2 Dashboard

**Files:**
- Create: `src/app/v2/page.tsx`

**Step 1: Create the file**

Create `src/app/v2/page.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { formatCrore, formatQty } from '@/lib/formatting';
import type { EnhancedBrandSummary, OtbCycle } from '@/types/otb';

function getCurrentQuarter(): string {
  const now = new Date();
  const month = now.getMonth();
  const fyYear = month >= 3 ? now.getFullYear() + 1 : now.getFullYear();
  const q = month >= 3 ? Math.ceil((month - 2) / 3) : 4;
  return `Q${q} FY${String(fyYear).slice(-2)}`;
}

const STATUS_BADGE: Record<string, string> = {
  Draft: 'badge-gray',
  Filling: 'badge-yellow',
  InReview: 'badge-blue',
  Approved: 'badge-green',
};

function BrandCard({
  brand,
  zone,
  onAction,
}: {
  brand: EnhancedBrandSummary;
  zone: 'review' | 'approved';
  onAction?: () => void;
}) {
  const href = `/v2/cycles/${brand.cycle_id}`;
  const badgeClass = STATUS_BADGE[brand.status] ?? 'badge-gray';
  const statusLabel = brand.status === 'InReview' ? 'In Review' : brand.status;

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>
            {brand.cycle_name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
            {brand.planning_quarter} · {brand.brand_name}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={`badge ${badgeClass}`}>{statusLabel}</span>
          <Link href={href}>
            <button className="btn-secondary btn-sm">
              {zone === 'review' ? 'Review →' : 'View →'}
            </button>
          </Link>
        </div>
      </div>

      {(brand.gmv > 0 || brand.nsv > 0) && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px 24px', marginTop: 14, paddingTop: 14,
          borderTop: '1px solid var(--border)',
        }}>
          {[
            { label: 'GMV',   value: formatCrore(brand.gmv) },
            { label: 'NSV',   value: formatCrore(brand.nsv) },
            { label: 'NSQ',   value: formatQty(brand.nsq)   },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function V2Dashboard() {
  const { profile } = useAuth();
  const { selectedBrandId, loading: brandLoading } = useBrand();
  const dashboard = useDashboardData(selectedBrandId, !brandLoading);

  if (dashboard.loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{
          width: 36, height: 36,
          border: '4px solid var(--border)', borderTopColor: 'var(--primary)',
          borderRadius: '50%', animation: 'v2spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  if (dashboard.error) {
    return (
      <div className="alert alert-error" style={{ maxWidth: 600 }}>
        Failed to load dashboard: {dashboard.error}
        <button className="btn-secondary btn-sm" onClick={dashboard.refresh} style={{ marginLeft: 12 }}>
          Retry
        </button>
      </div>
    );
  }

  const { kpiTotals, reviewBrands, approvedBrands, cycles } = dashboard;
  const isGD = profile?.role === 'GD';
  const fillingCycles = isGD ? (cycles ?? []).filter(c => c.status === 'Filling') : [];
  const hasApprovedData = kpiTotals && (kpiTotals.gmv > 0 || kpiTotals.nsv > 0);

  const dohColor = !kpiTotals?.avg_doh
    ? 'var(--text)'
    : kpiTotals.avg_doh <= 45 ? 'var(--success)'
    : kpiTotals.avg_doh <= 60 ? 'var(--warning)'
    : 'var(--danger)';

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>{getCurrentQuarter()} Overview</h1>
          <p>Open-to-Buy planning summary</p>
        </div>
        <button className="btn-secondary" onClick={dashboard.refresh}>↻ Refresh</button>
      </div>

      {/* KPI stat cards */}
      {hasApprovedData && (
        <>
          <div style={{
            fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 12,
          }}>
            Approved Plan
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 16, marginBottom: 32,
          }}>
            {([
              { label: 'GMV',           value: formatCrore(kpiTotals!.gmv) },
              { label: 'NSV',           value: formatCrore(kpiTotals!.nsv) },
              { label: 'Total NSQ',     value: formatQty(kpiTotals!.nsq) },
              { label: 'Total Inwards', value: formatQty(kpiTotals!.inwards_qty) },
              { label: 'Avg DoH',       value: kpiTotals!.avg_doh ? String(Math.round(kpiTotals!.avg_doh)) : '-', color: dohColor },
              { label: 'Closing Stock', value: formatQty(kpiTotals!.closing_stock_qty) },
            ] as { label: string; value: string; color?: string }[]).map(({ label, value, color }) => (
              <div key={label} className="stat-card">
                <div className="stat-label">{label}</div>
                <div className="stat-value" style={color ? { color, fontSize: 26 } : { fontSize: 26 }}>{value}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Pending Inputs (GD only) */}
      {isGD && fillingCycles.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Pending Inputs</h2>
            <span className="badge badge-yellow">{fillingCycles.length}</span>
          </div>
          {fillingCycles.map((cycle: OtbCycle) => (
            <Link key={cycle.id} href={`/v2/cycles/${cycle.id}?tab=plan`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ marginBottom: 10, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{cycle.cycle_name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {cycle.planning_quarter}
                    </div>
                  </div>
                  <span className="badge badge-yellow">Filling</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pending Review */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Pending Review</h2>
          <span className="badge badge-orange">{reviewBrands.length}</span>
        </div>
        {reviewBrands.length > 0 ? (
          reviewBrands.map(brand => (
            <BrandCard key={brand.cycle_id} brand={brand} zone="review" onAction={dashboard.refresh} />
          ))
        ) : (
          <div className="empty-state" style={{ padding: '28px 24px' }}>
            <p>No cycles pending review</p>
          </div>
        )}
      </div>

      {/* Approved Plans */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Approved Plans</h2>
        </div>
        {approvedBrands.filter(b => b.is_current_quarter).length > 0 ? (
          approvedBrands
            .filter(b => b.is_current_quarter)
            .map(brand => (
              <BrandCard key={brand.cycle_id} brand={brand} zone="approved" />
            ))
        ) : (
          <div className="empty-state" style={{ padding: '28px 24px' }}>
            <p>No approved plans</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify in browser**

Visit `http://localhost:3000/v2` — you should see:
- KPI stat cards row (if any approved cycles exist)
- Pending Review section with brand cards
- Approved Plans section
- All in the new warm-stone design

**Step 3: Commit**

```bash
git add src/app/v2/page.tsx
git commit -m "feat(v2): add V2 dashboard page"
```

---

### Task 7: Smoke test all routes

**Step 1: Verify existing routes are untouched**

```bash
# These should still work exactly as before
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/cycles
# Expected: 200 (or 307 redirect to login — either is correct)
```

**Step 2: Verify v2 routes exist**

Visit each URL manually:
- `http://localhost:3000/v2/login` — terra-cotta gradient, centered card
- `http://localhost:3000/v2` — dashboard with KPIs (after login + brand select)
- `http://localhost:3000/v2/cycles` — stat cards + table
- `http://localhost:3000/v2/cycles/<any-cycle-id>` — cycle workspace in new chrome

**Step 3: TypeScript build check**

```bash
npx tsc --noEmit
```
Expected: no errors (or only pre-existing errors unrelated to v2 files)

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(v2): CEO demo cosmetic layer complete at /v2/*"
```
