# Design System Full Incorporation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Ant Design chrome of the main OTB app with the WMS design system, making the redesigned look the primary/only app shell — no v2 overlay, no feature flags.

**Architecture:** Drop-in CSS replacement (`globals.css` → design system verbatim) + rewrite the five shell files (AppLayout, login, brand-select, cycles list, dashboard) + simplify the two cycle-workspace chrome files. All API routes, grid logic, AG Grid components, and inner-tab components (SetupTab, PlanTabContent, ReviewTabContent, AnalyzeTabContent, BulkEditModal, ImportGdModal, ValidationReport) are NOT touched. Ant Design stays in the project and is re-themed for inner components; only the app shell switches to plain HTML + CSS classes.

**Tech Stack:** Next.js 16 App Router, design-system global CSS classes (`.btn-primary`, `.card`, `.badge-*`, `.stat-card`, `.tabs`, `.tab-btn`) + CSS custom properties (`var(--primary)`, etc.) + inline `style={{}}` for layout. No Tailwind after Task 1. Ant Design 6 stays, re-themed via `antdTheme.ts`.

---

### Task 1: Replace globals.css with design system CSS

**Files:**
- Modify: `src/app/globals.css`

**Context:** The current file is ~43 lines starting with `@import "tailwindcss"`. After this task it becomes the verbatim design system CSS from DESIGN_SYSTEM.md §21, with one scoping addition: table element styles are restricted to `.card table` and `.card-flat table` ancestors so AG Grid and Ant Design tables are unaffected.

**Step 1: Replace the file with design system CSS**

Write `src/app/globals.css` with this exact content (verbatim from DESIGN_SYSTEM.md §21), but scope the table rules:

```css
/* ── Design System ── */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  /* Brand */
  --primary:        #CC785C;
  --primary-dark:   #B5633E;
  --primary-light:  #FDF0EB;
  --primary-ring:   rgba(204, 120, 92, 0.22);

  /* Semantic */
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

  /* Neutrals */
  --text:           #1C1917;
  --text-secondary: #78716C;
  --text-tertiary:  #A8A29E;
  --border:         #E7E5E0;
  --border-strong:  #D6D3CD;
  --bg:             #FAF9F6;
  --bg-subtle:      #F5F4EF;
  --surface:        #FFFFFF;
  --surface-raised: #FFFFFF;

  /* Sidebar */
  --sidebar-width:     260px;
  --sidebar-bg:        #FFFFFF;
  --sidebar-border:    #EEEDE8;
  --sidebar-active-bg: #FDF0EB;
  --sidebar-active:    #CC785C;

  /* Radius */
  --radius-sm:   6px;
  --radius:      10px;
  --radius-lg:   14px;
  --radius-xl:   18px;
  --radius-full: 999px;

  /* Shadow */
  --shadow-xs: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-sm: 0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04);
  --shadow-lg: 0 12px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04);

  /* Transitions */
  --t-fast: 0.12s ease;
  --t-base: 0.18s ease;
}

html { height: 100%; }

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  height: 100%;
}

a { color: var(--primary); text-decoration: none; }
a:hover { text-decoration: underline; }

/* ── Buttons ── */
button {
  cursor: pointer;
  border: none;
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 500;
  padding: 7px 15px;
  transition: all var(--t-fast);
  line-height: 1.4;
}
button:disabled { opacity: 0.55; cursor: not-allowed; }

.btn-primary { background: var(--primary); color: #fff; box-shadow: 0 1px 3px rgba(204,120,92,0.35); }
.btn-primary:hover:not(:disabled) { background: var(--primary-dark); box-shadow: 0 2px 6px rgba(204,120,92,0.4); }

.btn-secondary { background: var(--surface); color: var(--text); border: 1px solid var(--border); box-shadow: var(--shadow-xs); }
.btn-secondary:hover:not(:disabled) { background: var(--bg-subtle); border-color: var(--border-strong); }

.btn-ghost { background: transparent; color: var(--text-secondary); border: 1px solid transparent; }
.btn-ghost:hover:not(:disabled) { background: var(--bg-subtle); color: var(--text); }

.btn-danger { background: var(--danger); color: #fff; box-shadow: 0 1px 3px rgba(185,28,28,0.28); }
.btn-danger:hover:not(:disabled) { background: #991B1B; }

.btn-sm { padding: 4px 10px; font-size: 12.5px; }
.btn-lg { padding: 10px 20px; font-size: 15px; border-radius: var(--radius); }
.btn-icon { padding: 7px; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); }

/* ── Inputs ── */
input, select, textarea {
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
}
input::placeholder, textarea::placeholder { color: var(--text-tertiary); }
input:focus, select:focus, textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-ring);
}
select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2378716C' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 30px;
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

/* ── Tables (scoped to design system cards only — does not affect AG Grid or Ant Design tables) ── */
.card table, .card-flat table { width: 100%; border-collapse: collapse; }
.card thead tr, .card-flat thead tr { border-bottom: 1px solid var(--border); }
.card th, .card-flat th { text-align: left; padding: 10px 14px; font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-tertiary); background: var(--bg-subtle); white-space: nowrap; }
.card th:first-child, .card-flat th:first-child { border-radius: var(--radius-sm) 0 0 var(--radius-sm); }
.card th:last-child, .card-flat th:last-child { border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
.card td, .card-flat td { padding: 12px 14px; border-bottom: 1px solid var(--border); color: var(--text); font-size: 13.5px; }
.card tbody tr:last-child td, .card-flat tbody tr:last-child td { border-bottom: none; }
.card tbody tr, .card-flat tbody tr { transition: background var(--t-fast); }
.card tbody tr:hover td, .card-flat tbody tr:hover td { background: var(--bg); }

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
.spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.65s linear infinite; flex-shrink: 0; }
.spinner-dark { border-color: rgba(28,25,23,0.15); border-top-color: var(--primary); }
@keyframes spin { to { transform: rotate(360deg); } }

hr { border: none; border-top: 1px solid var(--border); margin: 16px 0; }

/* ── Page header ── */
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 26px; gap: 16px; }
.page-header h1 { font-size: 22px; font-weight: 700; color: var(--text); letter-spacing: -0.02em; }
.page-header p  { color: var(--text-secondary); margin-top: 3px; font-size: 13.5px; }

/* ── Stat card ── */
.stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px 22px; box-shadow: var(--shadow-sm); }
.stat-card .stat-label { font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-tertiary); margin-bottom: 10px; }
.stat-card .stat-value { font-size: 30px; font-weight: 700; letter-spacing: -0.03em; color: var(--text); line-height: 1; }
.stat-card .stat-sub   { font-size: 12px; color: var(--text-secondary); margin-top: 6px; }

/* ── Tabs ── */
.tabs { display: flex; gap: 2px; background: var(--bg-subtle); border: 1px solid var(--border); border-radius: var(--radius); padding: 4px; width: fit-content; }
.tab-btn { background: transparent; color: var(--text-secondary); border: none; border-radius: 7px; padding: 7px 16px; font-size: 13.5px; font-weight: 500; cursor: pointer; transition: all var(--t-fast); }
.tab-btn:hover { color: var(--text); background: var(--surface); }
.tab-btn.active { background: var(--surface); color: var(--primary); box-shadow: var(--shadow-xs); font-weight: 600; }

/* ── Filter pills ── */
.filter-pill { padding: 5px 13px; border-radius: var(--radius-full); font-size: 12.5px; font-weight: 500; border: 1px solid var(--border); background: var(--surface); color: var(--text-secondary); cursor: pointer; transition: all var(--t-fast); }
.filter-pill:hover { border-color: var(--primary); color: var(--primary); }
.filter-pill.active { background: var(--primary-light); border-color: var(--primary); color: var(--primary-dark); font-weight: 600; }

/* ── Empty state ── */
.empty-state { text-align: center; padding: 64px 24px; color: var(--text-secondary); }
.empty-state .empty-icon { font-size: 40px; margin-bottom: 14px; opacity: 0.6; }
.empty-state h3 { font-size: 16px; font-weight: 600; color: var(--text); margin-bottom: 6px; }
.empty-state p  { font-size: 13.5px; }

/* ── Modal ── */
.modal-overlay { position: fixed; inset: 0; background: rgba(28,25,23,0.45); display: flex; align-items: center; justify-content: center; z-index: 500; backdrop-filter: blur(2px); padding: 20px; }
.modal { background: var(--surface); border-radius: var(--radius-xl); padding: 28px; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; box-shadow: var(--shadow-lg); }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; }
.modal-header h2 { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; }
.modal-close { background: var(--bg-subtle); border: 1px solid var(--border); border-radius: var(--radius-sm); width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 16px; color: var(--text-secondary); cursor: pointer; padding: 0; flex-shrink: 0; }
.modal-close:hover { background: var(--danger-bg); color: var(--danger); border-color: var(--danger-border); }

/* ── Kbd / Code ── */
kbd, code { font-family: 'SF Mono', 'Fira Code', 'Cascadia Mono', monospace; font-size: 12px; background: var(--bg-subtle); border: 1px solid var(--border); border-radius: 4px; padding: 1px 6px; color: var(--text); }

/* ── Scrollbar ── */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 999px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-tertiary); }

/* ── Animations ── */
@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.fade-in { animation: fadeIn 0.2s ease forwards; }
```

**Step 2: Verify the build compiles**

```bash
cd otb-automation && npm run build 2>&1 | tail -20
```

Expected: no errors. (Tailwind-specific classes like `text-sm` etc. will show as unknown — that's fine, the Ant Design inner components don't use Tailwind class names.)

**Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design): replace globals.css with design system CSS; table styles scoped to .card/.card-flat"
```

---

### Task 2: Re-theme antdTheme.ts to design system tokens

**Files:**
- Modify: `src/lib/antdTheme.ts`

**Context:** Current file uses `COLORS.*` from `designTokens.ts` for all values including a dark terra-cotta sidebar (`siderBg: COLORS.primary`). After this task the sidebar theme is removed from the Ant Design theme (AppLayout.tsx no longer uses Ant Design Layout/Sider) and all color references use design system hex values directly so Ant Design inner components (tables, modals, form elements inside SetupTab etc.) render in the same warm palette.

**Step 1: Rewrite antdTheme.ts**

```typescript
import type { ThemeConfig } from 'antd';

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary:          '#CC785C',
    colorSuccess:          '#2E7D52',
    colorWarning:          '#92400E',
    colorError:            '#B91C1C',
    colorInfo:             '#1D4ED8',
    colorBgContainer:      '#FFFFFF',
    colorBgLayout:         '#FAF9F6',
    colorBorder:           '#E7E5E0',
    colorBorderSecondary:  '#E7E5E0',
    borderRadius:           8,
    borderRadiusLG:        12,
    borderRadiusSM:         6,
    fontFamily:            "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize:              14,
    colorText:             '#1C1917',
    colorTextSecondary:    '#78716C',
    colorTextTertiary:     '#A8A29E',
    boxShadow:             '0 1px 4px rgba(0,0,0,0.06)',
    boxShadowSecondary:    '0 4px 12px rgba(0,0,0,0.08)',
  },
  components: {
    Card: { borderRadiusLG: 12, paddingLG: 24 },
    Table: {
      headerBg:   '#F5F4EF',
      borderColor:'#E7E5E0',
      fontSize:    13,
      padding:     12,
      paddingXS:   8,
    },
    Button: { borderRadius: 8, controlHeight: 36 },
    Tag:    { borderRadiusSM: 6 },
    Statistic: { titleFontSize: 13, contentFontSize: 28 },
    Steps: { colorPrimary: '#CC785C' },
  },
};
```

Note: The `Menu` and `Layout` component overrides from the old file are intentionally removed — AppLayout.tsx will no longer use Ant Design Sider/Menu after Task 3.

**Step 2: Verify TypeScript compiles**

```bash
cd otb-automation && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors from this file.

**Step 3: Commit**

```bash
git add src/lib/antdTheme.ts
git commit -m "feat(design): re-theme antd to design system tokens; remove dark sidebar overrides"
```

---

### Task 3: Redesign AppLayout.tsx — design system sidebar

**Files:**
- Modify: `src/components/AppLayout.tsx`

**Context:** Current file uses `Layout / Sider / Menu / Header / Content` from Ant Design. After this task it uses pure HTML/CSS with design system variables — white sidebar on the left, a thin top header, and a scrollable content area to the right. Auth + brand-gate logic is preserved exactly (same `useRef`, `useState`, `useEffect` pattern). Nav items and admin items are rendered as `<Link>` elements, not Ant Design Menu items. No `position: fixed` — normal document flow with `marginLeft: var(--sidebar-width)`.

The nav structure mirrors the v2 layout's sidebar exactly (same active dot indicator, same admin group label), but applied to the main app routes (`/`, `/cycles`, `/wiki`, `/admin/*`).

**Step 1: Rewrite AppLayout.tsx**

```tsx
'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import { hasPermission } from '@/lib/auth/roles';

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const NAV_ITEMS = [
  { href: '/',       label: 'Dashboard',  icon: '◈',  exact: true  },
  { href: '/cycles', label: 'OTB Cycles', icon: '📋', exact: false },
  { href: '/wiki',   label: 'Wiki',       icon: '📖', exact: false },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
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
      if (pathname !== '/brand-select') {
        router.replace(`/brand-select?returnTo=${encodeURIComponent(pathname)}`);
      } else {
        setBrandGateReady(true);
      }
    }
  }, [loading, profile, pathname, router]);

  if (loading || (!brandGateReady && !!profile && pathname !== '/brand-select')) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg)',
      }}>
        <div style={{
          width: 36, height: 36, border: '4px solid var(--border)',
          borderTopColor: 'var(--primary)', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  if (pathname === '/brand-select') return <>{children}</>;
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
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', fontSize: 14, color: 'var(--text)' }}>
      {/* Sidebar */}
      <aside style={{
        width: 'var(--sidebar-width)', flexShrink: 0,
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid var(--sidebar-border)' }}>
          <img src="/tmrw-logo.png" alt="TMRW" style={{ height: 28, marginBottom: 5, display: 'block' }} />
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.02em' }}>OTB Platform</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => {
            const active = item.exact ? pathname === item.href : (pathname?.startsWith(item.href) ?? false);
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 'var(--radius)',
                marginBottom: 2, textDecoration: 'none',
                background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                color: active ? 'var(--sidebar-active)' : 'var(--text-secondary)',
                fontWeight: active ? 600 : 400, fontSize: 14,
                transition: 'all var(--t-fast)', position: 'relative',
              }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
                {active && (
                  <span style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    width: 6, height: 6, borderRadius: '50%', background: 'var(--sidebar-active)',
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
              fontSize: 13, fontWeight: 700, color: 'var(--primary)', flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.full_name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{profile.role}</div>
            </div>
            <button onClick={signOut} title="Sign out" style={{
              background: 'none', border: 'none', color: 'var(--text-tertiary)',
              cursor: 'pointer', padding: 4, fontSize: 16, lineHeight: 1,
            }}>
              ⇥
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Header */}
        <header style={{
          height: 56, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 36px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
              {selectedBrandName}
            </span>
            {brands.length > 1 && (
              <button
                onClick={() => router.push(`/brand-select?returnTo=${encodeURIComponent(pathname ?? '/')}&switch=true`)}
                style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--primary)', cursor: 'pointer', padding: '2px 6px', fontFamily: 'inherit' }}
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
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{profile.full_name}</span>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: '28px 36px', background: 'var(--bg)', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
```

**Step 2: Check TypeScript**

```bash
cd otb-automation && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
```

Expected: no errors from AppLayout.tsx.

**Step 3: Commit**

```bash
git add src/components/AppLayout.tsx
git commit -m "feat(design): replace Ant Design Layout/Sider/Menu with design system sidebar in AppLayout"
```

---

### Task 4: Redesign login/page.tsx

**Files:**
- Modify: `src/app/login/page.tsx`

**Context:** Current file uses Ant Design `Card / Form / Input / Button / Alert / Space`. Auth logic is preserved exactly: `supabase.auth.signInWithPassword`, on success `window.location.href = /brand-select?returnTo=...`. After this task it uses a `.card` wrapper, `.form-group` + `<input>` elements, `.btn-primary`, and an `.alert-error` div.

**Step 1: Rewrite login/page.tsx**

```tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') ?? '/';

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    window.location.href = `/brand-select?returnTo=${encodeURIComponent(redirectTo)}`;
  }

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #CC785C 0%, #FDF0EB 100%)',
    }}>
      <div className="card" style={{ width: 420, borderRadius: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/tmrw-logo.png" alt="TMRW" style={{ height: 36, marginBottom: 12 }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>OTB Platform</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Open-To-Buy inventory planning</p>
        </div>
        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            {error}
            <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        )}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary btn-lg" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript**

```bash
cd otb-automation && npx tsc --noEmit 2>&1 | grep "login" | head -10
```

**Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat(design): redesign login page with design system card + form"
```

---

### Task 5: Redesign brand-select/page.tsx

**Files:**
- Modify: `src/app/brand-select/page.tsx`

**Context:** Current file uses Ant Design `Card / Spin / Typography / Space`. All auth + brand logic is preserved exactly (same three `useEffect` hooks, `confirmBrand`, `isAutoRedirecting` guard). After this task the cards are plain HTML divs with `.card` + cursor pointer, with a terra-cotta ring on the selected brand.

**Step 1: Rewrite brand-select/page.tsx**

```tsx
'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import { useRouter, useSearchParams } from 'next/navigation';

export default function BrandSelectPage() {
  const { profile, loading: authLoading } = useAuth();
  const { brands, selectedBrandId, setSelectedBrandId, loading: brandLoading } = useBrand();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '/';
  const isSwitching = searchParams.get('switch') === 'true';

  const loading = authLoading || brandLoading;

  const isAutoRedirecting =
    !loading && !!profile && profile.role !== 'Admin' && brands.length === 1;

  function confirmBrand(id: string | null) {
    if (!profile) return;
    setSelectedBrandId(id);
    sessionStorage.setItem(`otb_brand_selected_${profile.id}`, 'true');
    router.push(returnTo);
  }

  useEffect(() => {
    if (!authLoading && !profile) router.replace('/login');
  }, [authLoading, profile, router]);

  useEffect(() => {
    if (authLoading || !profile || isSwitching) return;
    const key = `otb_brand_selected_${profile.id}`;
    if (sessionStorage.getItem(key)) router.replace(returnTo);
  }, [authLoading, profile, returnTo, router, isSwitching]);

  useEffect(() => {
    if (loading || !profile) return;
    if (profile.role !== 'Admin' && brands.length === 1) confirmBrand(brands[0].id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profile, brands]);

  if (loading || isAutoRedirecting || !profile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #CC785C 0%, #FDF0EB 100%)' }}>
        <div style={{ width: 40, height: 40, border: '4px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  const isAdmin = profile.role === 'Admin';

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #CC785C 0%, #FDF0EB 100%)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 600 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/tmrw-logo.png" alt="TMRW" style={{ height: 36, marginBottom: 12 }} />
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>
            {isSwitching ? 'Switch Brand' : 'Select a Brand'}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, margin: 0 }}>
            {isSwitching
              ? 'Pick a brand to continue — the page will reload fresh'
              : 'Choose the brand you want to work with this session'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isAdmin && (
            <BrandCard
              name="All Brands"
              description="View and manage data across all brands"
              selected={selectedBrandId === null}
              onSelect={() => confirmBrand(null)}
            />
          )}
          {brands.map(brand => (
            <BrandCard
              key={brand.id}
              name={brand.name}
              selected={selectedBrandId === brand.id}
              onSelect={() => confirmBrand(brand.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function BrandCard({ name, description, selected, onSelect }: {
  name: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        background: selected ? 'var(--primary-light)' : 'rgba(255,255,255,0.97)',
        border: `${selected ? 2 : 1}px solid ${selected ? 'var(--primary)' : 'rgba(255,255,255,0.2)'}`,
        borderRadius: 12,
        padding: '16px 20px',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'all var(--t-fast)',
        boxShadow: selected ? '0 0 0 3px var(--primary-ring)' : '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{name}</div>
        {description && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{description}</div>}
      </div>
      {selected && <span style={{ fontSize: 20, color: 'var(--primary)', flexShrink: 0 }}>✓</span>}
    </div>
  );
}
```

**Step 2: Verify TypeScript**

```bash
cd otb-automation && npx tsc --noEmit 2>&1 | grep "brand-select" | head -10
```

**Step 3: Commit**

```bash
git add src/app/brand-select/page.tsx
git commit -m "feat(design): redesign brand-select page with design system cards"
```

---

### Task 6: Redesign cycles/page.tsx

**Files:**
- Modify: `src/app/cycles/page.tsx`

**Context:** Current file uses Ant Design `Table / Button / Tag / Card / Row / Col`. All data fetching, `statusCounts`, and `isGd` logic is preserved. After this task: four stat-cards in a 4-column grid, and an HTML `<table>` inside a `.card-flat` for the cycle list with `.badge-*` status pills and Link-wrapped cycle name cells.

**Step 1: Rewrite cycles/page.tsx**

```tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import { hasPermission } from '@/lib/auth/roles';
import type { OtbCycle, CycleStatus } from '@/types/otb';

const STATUS_BADGE: Record<CycleStatus, string> = {
  Draft:    'badge badge-gray',
  Active:   'badge badge-blue',
  Filling:  'badge badge-blue',
  InReview: 'badge badge-yellow',
  Approved: 'badge badge-green',
};

const STATUS_COLORS: Record<string, string> = {
  Draft:    'var(--text-tertiary)',
  Filling:  'var(--info)',
  InReview: 'var(--warning)',
  Approved: 'var(--success)',
};

export default function CyclesPage() {
  const { profile } = useAuth();
  const { selectedBrandId } = useBrand();
  const [cycles, setCycles] = useState<OtbCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const canCreate = profile ? hasPermission(profile.role, 'create_cycle') : false;

  useEffect(() => {
    const controller = new AbortController();
    const url = selectedBrandId ? `/api/cycles?brandId=${selectedBrandId}` : '/api/cycles';
    setLoading(true);
    fetch(url, { signal: controller.signal })
      .then(r => r.json())
      .then(data => { setCycles(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(err => { if (err.name !== 'AbortError') setLoading(false); });
    return () => controller.abort();
  }, [selectedBrandId]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { Draft: 0, Filling: 0, InReview: 0, Approved: 0 };
    cycles.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return counts;
  }, [cycles]);

  const isGd = profile?.role === 'GD';

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="page-header">
        <div>
          <h1>OTB Cycles</h1>
          <p>Manage planning cycles across brands</p>
        </div>
        {canCreate && (
          <Link href="/cycles/new">
            <button className="btn-primary">+ New Cycle</button>
          </Link>
        )}
      </div>

      {/* Status summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {(['Draft', 'Filling', 'InReview', 'Approved'] as const).map(status => (
          <div key={status} className="stat-card" style={{ borderTop: `3px solid ${STATUS_COLORS[status] || 'var(--border)'}` }}>
            <div className="stat-label">{status === 'InReview' ? 'In Review' : status}</div>
            <div className="stat-value" style={{ fontSize: 28, color: STATUS_COLORS[status] || 'var(--text)' }}>
              {statusCounts[status] || 0}
            </div>
          </div>
        ))}
      </div>

      {/* Cycles table */}
      <div className="card-flat" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div className="spinner-dark" style={{ width: 24, height: 24, borderWidth: 3, display: 'inline-block' }} />
          </div>
        ) : cycles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No cycles yet</h3>
            <p>Create a new cycle to get started</p>
          </div>
        ) : (
          <table>
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
                  ? `/cycles/${cycle.id}?tab=plan`
                  : `/cycles/${cycle.id}`;
                return (
                  <tr key={cycle.id}>
                    <td><Link href={href} style={{ fontWeight: 500, color: 'var(--text)' }}>{cycle.cycle_name}</Link></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{cycle.brands?.name || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{cycle.planning_quarter}</td>
                    <td><span className={STATUS_BADGE[cycle.status]}>{cycle.status === 'InReview' ? 'In Review' : cycle.status}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{new Date(cycle.created_at).toLocaleDateString('en-IN')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Check TypeScript**

```bash
cd otb-automation && npx tsc --noEmit 2>&1 | grep "cycles/page" | head -10
```

**Step 3: Commit**

```bash
git add src/app/cycles/page.tsx
git commit -m "feat(design): redesign cycles list with stat-cards + design system HTML table"
```

---

### Task 7: Redesign app/page.tsx (dashboard)

**Files:**
- Modify: `src/app/page.tsx`

**Context:** Current file uses Ant Design + `MetricCard`, `BrandPanel`, `DashboardSkeleton` from `src/components/ui/`. `BrandPanel` is complex and still used in other places (ReviewTabContent, etc.) so we do NOT delete it. We keep calling `BrandPanel` and `MetricCard` from this page — they will continue to use Ant Design internally for now. The Ant Design-specific outer shell elements (the `<Title>` / `<Badge>` / `<Empty>` / `<Alert>` / `<Button>` at the page level) get replaced with design system equivalents. `DashboardSkeleton` is replaced with a simple spinner.

**Step 1: Rewrite app/page.tsx**

```tsx
'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { MetricCard } from '@/components/ui/MetricCard';
import { BrandPanel } from '@/components/ui/BrandPanel';
import type { EnhancedBrandSummary } from '@/types/otb';
import { formatCrore, formatQty } from '@/lib/formatting';
import {
  DollarOutlined, ShoppingCartOutlined, BarChartOutlined,
  InboxOutlined, ClockCircleOutlined, DatabaseOutlined,
} from '@ant-design/icons';
import { COLORS } from '@/lib/designTokens';

function getCurrentQuarter(): string {
  const now = new Date();
  const month = now.getMonth();
  const fyYear = month >= 3 ? now.getFullYear() + 1 : now.getFullYear();
  const q = month >= 3 ? Math.ceil((month - 2) / 3) : 4;
  return `Q${q} FY${String(fyYear).slice(-2)}`;
}

function NoActualsRow({ brand }: { brand: EnhancedBrandSummary }) {
  return (
    <div className="card" style={{ marginBottom: 12, padding: '12px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ minWidth: 160, fontWeight: 600, fontSize: 15 }}>{brand.cycle_name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{brand.planning_quarter}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Actuals not yet uploaded</div>
      </div>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{title}</h2>
      {count != null && count > 0 && (
        <span className="badge badge-orange">{count}</span>
      )}
    </div>
  );
}

export default function CxoDashboard() {
  const { profile } = useAuth();
  const { selectedBrandId, loading: brandLoading } = useBrand();
  const dashboard = useDashboardData(selectedBrandId, !brandLoading);

  if (dashboard.loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div className="spinner-dark" style={{ width: 28, height: 28, borderWidth: 3, display: 'inline-block', borderRadius: '50%' }} />
      </div>
    );
  }

  if (dashboard.error) {
    return (
      <div className="alert alert-error" style={{ maxWidth: 600 }}>
        <span>Failed to load dashboard: {dashboard.error}</span>
        <button className="btn-secondary btn-sm" onClick={dashboard.refresh} style={{ marginLeft: 'auto' }}>Retry</button>
      </div>
    );
  }

  const { approvals, kpiTotals, reviewBrands, approvedBrands, cycles } = dashboard;
  const isGD = profile?.role === 'GD';
  const fillingCycles = isGD ? (cycles || []).filter(c => c.status === 'Filling') : [];

  const hasApprovedData = kpiTotals && (
    kpiTotals.gmv > 0 || kpiTotals.nsv > 0 || kpiTotals.nsq > 0 ||
    kpiTotals.inwards_qty > 0 || kpiTotals.avg_doh > 0 || kpiTotals.closing_stock_qty > 0
  );

  const dohColor = !kpiTotals?.avg_doh ? COLORS.neutral600
    : kpiTotals.avg_doh <= 45 ? COLORS.success
    : kpiTotals.avg_doh <= 60 ? COLORS.warning
    : COLORS.danger;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{getCurrentQuarter()} Overview</h1>
          <p>Open-to-Buy planning summary</p>
        </div>
        <button className="btn-secondary" onClick={dashboard.refresh}>↻ Refresh</button>
      </div>

      {hasApprovedData && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 12 }}>
            Approved Plan
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
            {[
              { title: 'GMV',           value: formatCrore(kpiTotals!.gmv),                      icon: <DollarOutlined />,       color: COLORS.info },
              { title: 'NSV',           value: formatCrore(kpiTotals!.nsv),                      icon: <ShoppingCartOutlined />, color: COLORS.accent },
              { title: 'Total NSQ',     value: formatQty(kpiTotals!.nsq),                        icon: <BarChartOutlined />,     color: COLORS.success },
              { title: 'Total Inwards', value: formatQty(kpiTotals!.inwards_qty),                icon: <InboxOutlined />,        color: COLORS.warning },
              { title: 'Avg DoH',       value: kpiTotals!.avg_doh ? Math.round(kpiTotals!.avg_doh) : '-', icon: <ClockCircleOutlined />, color: dohColor },
              { title: 'Closing Stock', value: formatQty(kpiTotals!.closing_stock_qty),          icon: <DatabaseOutlined />,    color: COLORS.neutral600 },
            ].map(m => (
              <MetricCard key={m.title} title={m.title} value={m.value} icon={m.icon} color={m.color} size="compact" />
            ))}
          </div>
        </div>
      )}

      {/* Pending Inputs (GD only) */}
      {isGD && (
        <div style={{ marginBottom: 32 }}>
          <SectionHeader title="Pending Inputs" count={fillingCycles.length} />
          {fillingCycles.length > 0 ? (
            fillingCycles.map(cycle => (
              <Link key={cycle.id} href={`/cycles/${cycle.id}?tab=plan`} style={{ textDecoration: 'none', display: 'block', marginBottom: 10 }}>
                <div className="card" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{cycle.cycle_name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{cycle.planning_quarter}</div>
                  </div>
                  <span className="badge badge-yellow">Filling</span>
                </div>
              </Link>
            ))
          ) : (
            <div className="empty-state" style={{ padding: '32px 24px' }}>
              <div className="empty-icon">📋</div>
              <p>No cycles pending input</p>
            </div>
          )}
        </div>
      )}

      {/* Pending Review */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader title="Pending Review" count={reviewBrands.length} />
        {reviewBrands.length > 0 ? (
          reviewBrands.map(brand => (
            <BrandPanel
              key={brand.cycle_id}
              brand={brand}
              zone="review"
              onActionComplete={dashboard.refresh}
              needsMyApproval={approvals?.brands.find(b => b.cycle_id === brand.cycle_id)?.needs_my_approval ?? false}
              approvalProgress={
                approvals?.brands.find(b => b.cycle_id === brand.cycle_id)?.approval_progress
                  ? (() => {
                      const p = approvals!.brands.find(b => b.cycle_id === brand.cycle_id)!.approval_progress;
                      return { approved: p.approved, pending: p.pending, total: p.total };
                    })()
                  : undefined
              }
            />
          ))
        ) : (
          <div className="empty-state" style={{ padding: '32px 24px' }}>
            <div className="empty-icon">✓</div>
            <p>No cycles pending review</p>
          </div>
        )}
      </div>

      {/* Approved Plans */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader title="Approved Plans" />
        {approvedBrands.filter(b => b.is_current_quarter).length > 0 ? (
          approvedBrands.filter(b => b.is_current_quarter).map(brand => (
            <BrandPanel key={brand.cycle_id} brand={brand} zone="approved" />
          ))
        ) : (
          <div className="empty-state" style={{ padding: '32px 24px' }}>
            <div className="empty-icon">📊</div>
            <p>No approved plans</p>
          </div>
        )}
      </div>

      {/* Actuals vs Plan */}
      {approvedBrands.some(b => b.has_actuals) && (
        <div style={{ marginBottom: 32 }}>
          <SectionHeader title="Actuals vs Plan" />
          {approvedBrands.map(brand =>
            brand.has_actuals ? (
              <BrandPanel
                key={brand.cycle_id}
                brand={brand}
                zone="variance"
                variance={dashboard.varianceCache[brand.cycle_id] || null}
                onLoadVariance={dashboard.loadVariance}
              />
            ) : (
              <NoActualsRow key={brand.cycle_id} brand={brand} />
            )
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Check TypeScript**

```bash
cd otb-automation && npx tsc --noEmit 2>&1 | grep "app/page" | head -10
```

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(design): redesign dashboard shell with design system; keep MetricCard/BrandPanel"
```

---

### Task 8: Simplify CycleHeader.tsx — remove the `v2` prop

**Files:**
- Modify: `src/components/cycle-workspace/CycleHeader.tsx`
- Modify: `src/components/cycle-workspace/CycleWorkspace.tsx`
- Modify: `src/app/v2/cycles/[cycleId]/page.tsx`

**Context:** `CycleHeader` currently has a `v2` boolean prop that switches between a design-system render path and an Ant Design fallback. Since the whole app is now design-system, the `v2` branch IS the default and the Ant Design branch can be deleted. Remove the `v2` prop from `CycleHeaderProps`, remove the `if (v2)` branch, promote its JSX to the main return, delete the old Ant Design return block. Then remove the `v2` prop from `CycleWorkspace` and from the v2 page.

**Step 1: Rewrite CycleHeader.tsx**

Remove the `v2?: boolean` prop and `if (v2)` conditional; the design-system JSX becomes the only return. Also remove the unused Ant Design imports (`Tag`, `Button`, `Descriptions`, `Typography`) and the old `StatusPipeline` import if it's no longer used elsewhere in this file.

The new file looks like this (keeping `V2Pipeline`, `V2_STATUS_BADGE`, `getCycleStages`, `LIFECYCLE_STAGES` — just removing the `v2` param and the Ant Design fallback):

```tsx
'use client';

import { useState } from 'react';
import { message } from 'antd';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/lib/auth/roles';
import type { PipelineStage } from '@/components/ui/StatusPipeline';
import type { OtbCycle, CycleStatus } from '@/types/otb';

const V2_STATUS_BADGE: Record<CycleStatus, string> = {
  Draft:    'badge badge-gray',
  Active:   'badge badge-blue',
  Filling:  'badge badge-blue',
  InReview: 'badge badge-yellow',
  Approved: 'badge badge-green',
};

function V2Pipeline({ stages }: { stages: PipelineStage[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {stages.map((stage, i) => (
        <div key={stage.key} style={{ display: 'flex', alignItems: 'center', flex: i < stages.length - 1 ? 1 : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
              background: stage.status === 'pending' ? 'var(--border-strong)'
                : stage.status === 'completed' ? 'var(--success)' : 'var(--primary)',
              boxShadow: stage.status === 'active' ? '0 0 0 3px var(--primary-light)' : 'none',
            }} />
            <span style={{
              fontSize: 12, whiteSpace: 'nowrap',
              fontWeight: stage.status === 'active' ? 600 : 400,
              color: stage.status === 'pending' ? 'var(--text-tertiary)'
                : stage.status === 'completed' ? 'var(--text-secondary)' : 'var(--text)',
            }}>
              {stage.label}
            </span>
          </div>
          {i < stages.length - 1 && (
            <div style={{
              flex: 1, height: 1, minWidth: 20, margin: '0 10px',
              background: stage.status === 'completed' ? 'var(--success)' : 'var(--border)',
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

const LIFECYCLE_STAGES: CycleStatus[] = ['Draft', 'Filling', 'InReview', 'Approved'];

function getCycleStages(status: CycleStatus): PipelineStage[] {
  const currentIdx = LIFECYCLE_STAGES.indexOf(status);
  return LIFECYCLE_STAGES.map((stage, i) => ({
    key: stage,
    label: stage === 'InReview' ? 'In Review' : stage,
    status: i < currentIdx ? 'completed' : i === currentIdx ? 'active' : 'pending',
  }));
}

export interface CycleHeaderProps {
  cycle: OtbCycle;
  onCycleUpdated: (cycle: OtbCycle) => void;
  canActivate?: boolean;
}

export function CycleHeader({ cycle, onCycleUpdated, canActivate = false }: CycleHeaderProps) {
  const { profile } = useAuth();
  const canManageCycle = profile ? hasPermission(profile.role, 'create_cycle') : false;
  const [activating, setActivating] = useState(false);

  const handleActivate = async () => {
    setActivating(true);
    try {
      const genRes = await fetch(`/api/cycles/${cycle.id}/generate-template`, { method: 'POST' });
      const genData = await genRes.json();
      if (!genRes.ok) { message.error(genData.error || 'Template generation failed'); return; }
      message.success(`Template generated: ${genData.rowCount} rows`);
      if (genData.warnings?.length) genData.warnings.forEach((w: string) => message.warning(w, 8));
      const actRes = await fetch(`/api/cycles/${cycle.id}/activate`, { method: 'POST' });
      const actData = await actRes.json();
      if (!actRes.ok) { message.error(actData.error || 'Activation failed'); return; }
      onCycleUpdated(actData);
      message.success('Cycle activated! GD can now fill data.');
    } catch { message.error('Network error'); }
    finally { setActivating(false); }
  };

  const brandName = cycle.brands?.name;
  const showActivate = cycle.status === 'Draft' && canManageCycle;
  const assignedGdName =
    (cycle as OtbCycle & { assigned_gd_name?: string }).assigned_gd_name ||
    (cycle.assigned_gd_id ? 'Unassigned name' : 'Unassigned');

  const stages = getCycleStages(cycle.status);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            {cycle.cycle_name}
          </span>
          <span className={V2_STATUS_BADGE[cycle.status]}>{cycle.status === 'InReview' ? 'In Review' : cycle.status}</span>
          {brandName && <span className="badge badge-blue">{brandName}</span>}
        </div>
        {showActivate && (
          <button className="btn-primary" onClick={handleActivate} disabled={!canActivate || activating}>
            {activating ? 'Activating…' : 'Generate Template & Activate'}
          </button>
        )}
      </div>

      <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <V2Pipeline stages={stages} />
      </div>

      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        {[
          { label: 'Brand',      value: brandName || '—' },
          { label: 'Quarter',    value: cycle.planning_quarter },
          { label: 'Period',     value: `${cycle.planning_period_start} → ${cycle.planning_period_end}` },
          { label: 'GD Assigned', value: assignedGdName },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Remove `v2` prop from CycleWorkspace.tsx**

In `src/components/cycle-workspace/CycleWorkspace.tsx`:
- Change `export function CycleWorkspace({ cycleId, basePath = '/cycles', v2 = false }: { cycleId: string; basePath?: string; v2?: boolean })` → remove `v2 = false` and `v2?: boolean`
- Remove `v2={v2}` from `<CycleHeader ... />` call

**Step 3: Remove `v2={true}` from v2 cycle page**

In `src/app/v2/cycles/[cycleId]/page.tsx`:
- Change `<CycleWorkspace cycleId={cycleId} basePath="/v2/cycles" v2={true} />` → `<CycleWorkspace cycleId={cycleId} basePath="/v2/cycles" />`

**Step 4: Verify TypeScript**

```bash
cd otb-automation && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/components/cycle-workspace/CycleHeader.tsx src/components/cycle-workspace/CycleWorkspace.tsx src/app/v2/cycles/[cycleId]/page.tsx
git commit -m "feat(design): make design system CycleHeader the only render path; remove v2 prop"
```

---

### Task 9: Redesign CycleWorkspace.tsx chrome — replace Ant Design Card + Tabs

**Files:**
- Modify: `src/components/cycle-workspace/CycleWorkspace.tsx`

**Context:** After Task 8 the file already has no `v2` prop. Now replace the two Ant Design `<Card>` wrappers and the Ant Design `<Tabs>` with design system equivalents. The inner tab content components (`SetupTab`, `PlanTabContent`, `ReviewTabContent`, `AnalyzeTabContent`) are NOT changed. All state logic, tab visibility, `handleTabChange`, `mountedTabs`, etc. remains identical — only the JSX shell changes.

Replace:
- `<Card style={{ marginBottom: SPACING.lg ... }}><CycleHeader ...></Card>` → `<div className="card" style={{ marginBottom: 24 }}>`
- `<Card style={{ borderRadius: 8 }} ...><Tabs ...><div>...tab content...</div></Card>` → `<div className="card-flat" style={{ padding: 0 }}>` with a `.tabs` bar and tab content below

The tab bar uses `.tabs` / `.tab-btn` / `.tab-btn active` classes. Active tab renders its content div, others hidden via `display: none`.

**Step 1: Rewrite the return JSX in CycleWorkspace.tsx**

Remove unused imports: `Tabs`, `Card`, `COLORS`, `SPACING` (keep `Spin`, `Typography`, `Text` if used for the loading spinner and hints).

The new return JSX (replace only the `return (...)` block — all state/logic above stays):

```tsx
  if (loading || !cycle) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div className="spinner-dark" style={{ width: 28, height: 28, borderWidth: 3, display: 'inline-block', borderRadius: '50%' }} />
      </div>
    );
  }

  const tabItems: { key: WorkspaceTab; label: string }[] = [{ key: 'setup', label: 'Setup' }];
  if (planVisible)    tabItems.push({ key: 'plan',    label: 'Plan' });
  if (reviewVisible)  tabItems.push({ key: 'review',  label: 'Review' });
  if (analyzeVisible) tabItems.push({ key: 'analyze', label: 'Analyze' });

  return (
    <div>
      {/* Header card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <CycleHeader cycle={cycle} onCycleUpdated={handleCycleUpdated} canActivate={canActivate} />
        {preActivationHints.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
            To activate: {preActivationHints.join(' · ')}
          </div>
        )}
      </div>

      {/* Tab content card */}
      <div className="card-flat" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Tab bar */}
        <div style={{ padding: '16px 20px 0', borderBottom: '1px solid var(--border)' }}>
          <div className="tabs">
            {tabItems.map(t => (
              <button
                key={t.key}
                className={`tab-btn${activeTab === t.key ? ' active' : ''}`}
                onClick={() => handleTabChange(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div style={{ padding: 24 }}>
          {mountedTabs.has('setup') && (
            <div style={{ display: activeTab === 'setup' ? 'block' : 'none' }}>
              <SetupTab cycle={cycle} onCycleUpdated={handleCycleUpdated} onActualsUploaded={handleActualsUploaded} />
            </div>
          )}
          {planVisible && mountedTabs.has('plan') && (
            <div style={{ display: activeTab === 'plan' ? 'block' : 'none' }}>
              <PlanTabContent cycleId={cycleId} />
            </div>
          )}
          {reviewVisible && mountedTabs.has('review') && (
            <div style={{ display: activeTab === 'review' ? 'block' : 'none' }}>
              <ReviewTabContent cycleId={cycleId} cycleStatus={cycle.status} onCycleUpdated={handleCycleUpdated} />
            </div>
          )}
          {analyzeVisible && mountedTabs.has('analyze') && (
            <div style={{ display: activeTab === 'analyze' ? 'block' : 'none' }}>
              <AnalyzeTabContent cycleId={cycleId} refreshKey={actualsVersion} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
```

Also update the loading spinner at line ~197:
```tsx
  if (loading || !cycle) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div className="spinner-dark" style={{ width: 28, height: 28, borderWidth: 3, display: 'inline-block', borderRadius: '50%' }} />
      </div>
    );
  }
```

Remove the outer `<div style={{ padding: SPACING.lg, background: COLORS.background, minHeight: '100vh' }}>` wrapper — the page content area in AppLayout already provides padding.

**Step 2: Check TypeScript**

```bash
cd otb-automation && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
```

Expected: no errors.

**Step 3: Full build check**

```bash
cd otb-automation && npm run build 2>&1 | tail -20
```

Expected: clean build, all workspace routes shown as dynamic (`ƒ`).

**Step 4: Commit**

```bash
git add src/components/cycle-workspace/CycleWorkspace.tsx
git commit -m "feat(design): replace Ant Design Card/Tabs in CycleWorkspace with design system .card/.tabs"
```

---

## Final verification

After all 9 tasks, run a full build to confirm zero TypeScript errors and a clean Next.js build:

```bash
cd otb-automation && npm run build 2>&1 | tail -30
```

The build output should show all app shell routes as `ƒ` (dynamic) and no errors.
