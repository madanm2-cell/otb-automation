# WMS Design System — Default Variant

A warm-neutral, Inter-based design system for operational/logistics dashboards and mobile scan UIs.
Drop `globals.css` into a Next.js (or any React) project, import Inter, and use the classes and tokens below.

---

## 1. Setup

### Font
```html
<!-- In <head> or Next.js layout -->
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
  rel="stylesheet"
/>
```

### Global reset (already in globals.css)
```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
```

---

## 2. Color Tokens (CSS Custom Properties)

All tokens live on `:root`. Use them anywhere via `var(--token-name)`.

### Brand (Terra-cotta / Burnt Sienna)
```css
--primary:        #CC785C;   /* primary actions, active states */
--primary-dark:   #B5633E;   /* hover on primary */
--primary-light:  #FDF0EB;   /* tinted backgrounds, active nav bg */
--primary-ring:   rgba(204, 120, 92, 0.22);  /* focus ring on inputs */
```

### Semantic
```css
/* Success — green */
--success:        #2E7D52;
--success-bg:     #EDFAF4;
--success-border: #A7E8C8;

/* Warning — amber */
--warning:        #92400E;
--warning-bg:     #FFFBEB;
--warning-border: #FDE68A;

/* Danger — red */
--danger:         #B91C1C;
--danger-bg:      #FEF2F2;
--danger-border:  #FECACA;

/* Info — blue */
--info:           #1D4ED8;
--info-bg:        #EFF6FF;
--info-border:    #BFDBFE;
```

### Neutrals (Warm Stone)
```css
--text:           #1C1917;   /* primary text */
--text-secondary: #78716C;   /* labels, subtitles */
--text-tertiary:  #A8A29E;   /* placeholders, hints, disabled */
--border:         #E7E5E0;   /* default borders */
--border-strong:  #D6D3CD;   /* emphasized borders */
--bg:             #FAF9F6;   /* page background */
--bg-subtle:      #F5F4EF;   /* table headers, input backgrounds, hover rows */
--surface:        #FFFFFF;   /* cards, modals, inputs */
--surface-raised: #FFFFFF;   /* elevated surfaces (same, for future layering) */
```

### Sidebar
```css
--sidebar-width:     260px;
--sidebar-bg:        #FFFFFF;
--sidebar-border:    #EEEDE8;
--sidebar-active-bg: #FDF0EB;   /* active nav item background */
--sidebar-active:    #CC785C;   /* active nav item text/icon color */
```

### Radius Scale
```css
--radius-sm:   6px;
--radius:      10px;
--radius-lg:   14px;
--radius-xl:   18px;
--radius-full: 999px;  /* pills */
```

### Shadow Scale
```css
--shadow-xs: 0 1px 2px rgba(0,0,0,0.05);
--shadow-sm: 0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04);
--shadow-md: 0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04);
--shadow-lg: 0 12px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04);
```

### Transitions
```css
--t-fast: 0.12s ease;
--t-base: 0.18s ease;
```

---

## 3. Typography

| Use case | Size | Weight | Color |
|---|---|---|---|
| Page title (h1) | 22px | 700 | `--text` |
| Section heading | 17px | 700 | `--text` |
| Card title | 15px | 600 | `--text` |
| Body / table cell | 13.5–14px | 400 | `--text` |
| Label / subtitle | 13px | 500 | `--text` |
| Caption / hint | 11.5–12px | 400–500 | `--text-secondary` |
| Overline (uppercase) | 10–12px | 600–700 | `--text-tertiary`, `letter-spacing: 0.06em` |
| Monospace (IDs, AWB) | 12px | — | `font-family: 'SF Mono', 'Fira Code', monospace` |

**Key conventions:**
- Negative letter-spacing on large headings: `letter-spacing: -0.02em` to `-0.03em`
- Stat values: `font-size: 30px; font-weight: 700; letter-spacing: -0.03em; line-height: 1`
- Table headers: `font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em`

---

## 4. Buttons

### Classes (apply to `<button>`)
```html
<!-- Primary — filled terra-cotta -->
<button class="btn-primary">Save</button>

<!-- Secondary — outlined, white bg -->
<button class="btn-secondary">Cancel</button>

<!-- Ghost — transparent, no border -->
<button class="btn-ghost">More</button>

<!-- Danger — red -->
<button class="btn-danger">Delete</button>
```

### Size modifiers
```html
<button class="btn-primary btn-sm">Small</button>   <!-- 4px 10px, 12.5px -->
<button class="btn-primary">Default</button>         <!-- 7px 15px, 13.5px -->
<button class="btn-primary btn-lg">Large</button>    <!-- 10px 20px, 15px, radius-md -->
<button class="btn-icon btn-secondary">           <!-- square icon button, 7px all sides -->
  <svg .../>
</button>
```

All buttons:
- `border-radius: var(--radius-sm)` (6px) by default
- `transition: all var(--t-fast)`
- `:disabled` → `opacity: 0.55; cursor: not-allowed`

---

## 5. Inputs, Selects, Textareas

Global styles apply automatically:
```css
input, select, textarea {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  background: var(--surface);
  color: var(--text);
}
/* Focus ring */
input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-ring); }
```

Select gets a custom chevron arrow (no OS default `appearance`).

### Form group pattern
```html
<div class="form-group">
  <label>SKU Code</label>
  <input type="text" placeholder="e.g. SKU-001" />
  <div class="form-hint">Must be unique per warehouse.</div>
</div>
```

---

## 6. Cards

```html
<!-- Standard card — shadow + border -->
<div class="card">
  Content
</div>

<!-- Flat card — border only, no shadow -->
<div class="card-flat">
  Content
</div>
```

Both: `background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px`

---

## 7. Badges

```html
<span class="badge badge-green">Completed</span>
<span class="badge badge-yellow">Pending</span>
<span class="badge badge-red">Cancelled</span>
<span class="badge badge-blue">In Transit</span>
<span class="badge badge-orange">In Progress</span>
<span class="badge badge-gray">Draft</span>
```

All badges: `border-radius: var(--radius-full); padding: 2px 9px; font-size: 11.5px; font-weight: 500`

**Status → badge color mapping:**
| Status | Badge class |
|---|---|
| COMPLETED, SHIPPED, ACTIVE | `badge-green` |
| PENDING, IN_PROGRESS, PICKING | `badge-yellow` |
| CANCELLED, FAILED | `badge-red` |
| IN_TRANSIT, READY | `badge-blue` |
| PACKING, PROCESSING | `badge-orange` |
| DRAFT, UNKNOWN | `badge-gray` |

---

## 8. Alerts

```html
<div class="alert alert-error">Something went wrong.</div>
<div class="alert alert-success">Order shipped successfully.</div>
<div class="alert alert-warning">Stock below threshold.</div>
<div class="alert alert-info">3 items need review.</div>
```

All alerts: `padding: 11px 16px; border-radius: var(--radius); margin-bottom: 16px; font-size: 13.5px; display: flex; align-items: flex-start; gap: 10px`

---

## 9. Tables

Global styles apply automatically to `<table>`:
```html
<div class="card-flat" style="overflow: hidden; padding: 0;">
  <table>
    <thead>
      <tr>
        <th>Order</th>
        <th>Status</th>
        <th>Created</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>ORD-00123</td>
        <td><span class="badge badge-green">Shipped</span></td>
        <td>May 6, 2026</td>
      </tr>
    </tbody>
  </table>
</div>
```

- `th` background: `var(--bg-subtle)` with rounded first/last corners
- `tbody tr:hover td` → background: `var(--bg)`
- No bottom border on last row

---

## 10. Tabs

```html
<div class="tabs">
  <button class="tab-btn active">Overview</button>
  <button class="tab-btn">Inventory</button>
  <button class="tab-btn">Movements</button>
</div>
```

Container: `background: var(--bg-subtle); border: 1px solid var(--border); border-radius: var(--radius); padding: 4px`
Active tab: `background: var(--surface); color: var(--primary); box-shadow: var(--shadow-xs); font-weight: 600`

---

## 11. Filter Pills

```html
<div style="display: flex; gap: 8px; flex-wrap: wrap;">
  <button class="filter-pill active">All</button>
  <button class="filter-pill">Pending</button>
  <button class="filter-pill">Shipped</button>
</div>
```

Active: `background: var(--primary-light); border-color: var(--primary); color: var(--primary-dark); font-weight: 600`

---

## 12. Stat Cards

```html
<div class="stat-card">
  <div class="stat-label">Total Orders</div>
  <div class="stat-value">1,284</div>
  <div class="stat-sub">↑ 12% from last week</div>
</div>
```

Typically arranged in a CSS grid: `display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px`

---

## 13. Page Header

```html
<div class="page-header">
  <div>
    <h1>Orders</h1>
    <p>Manage and track all outbound orders.</p>
  </div>
  <button class="btn-primary">+ New Order</button>
</div>
```

`display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 26px`

---

## 14. Empty States

```html
<div class="empty-state">
  <div class="empty-icon">📦</div>
  <h3>No orders yet</h3>
  <p>Orders will appear here once created.</p>
</div>
```

`text-align: center; padding: 64px 24px`

---

## 15. Modals

```html
{isOpen && (
  <div class="modal-overlay" onClick={onClose}>
    <div class="modal" onClick={e => e.stopPropagation()}>
      <div class="modal-header">
        <h2>Confirm Action</h2>
        <button class="modal-close" onClick={onClose}>✕</button>
      </div>
      <!-- body content -->
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
        <button class="btn-secondary" onClick={onClose}>Cancel</button>
        <button class="btn-primary" onClick={onConfirm}>Confirm</button>
      </div>
    </div>
  </div>
)}
```

Overlay: `position: fixed; inset: 0; background: rgba(28,25,23,0.45); backdrop-filter: blur(2px); z-index: 500`
Modal box: `max-width: 560px; border-radius: var(--radius-xl); padding: 28px; box-shadow: var(--shadow-lg)`

---

## 16. Spinner / Loading

```html
<!-- White spinner (inside colored buttons) -->
<span class="spinner"></span>

<!-- Dark spinner (on white backgrounds) -->
<span class="spinner spinner-dark"></span>

<!-- Page-level loading -->
<div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
  <span class="spinner spinner-dark" style={{ width: 36, height: 36, borderWidth: 4 }}></span>
</div>
```

---

## 17. Animations

```html
<!-- Fade in on mount -->
<div class="fade-in">...</div>
```

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-in { animation: fadeIn 0.2s ease forwards; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

---

## 18. Sidebar Layout

### Layout structure (Next.js / React)
```tsx
// layout.tsx
export default function Layout({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{
        marginLeft: 'var(--sidebar-width)',   /* 260px */
        flex: 1,
        padding: '28px 36px',
        background: 'var(--bg)',
        minHeight: '100vh',
      }}>
        {children}
      </main>
    </div>
  );
}
```

### Sidebar component pattern
```tsx
const NAV_ITEMS = [
  { href: '/dashboard',   label: 'Dashboard',   icon: '◈' },
  { href: '/orders',      label: 'Orders',       icon: '📋' },
  { href: '/inventory',   label: 'Inventory',    icon: '📦' },
  { href: '/fulfillment', label: 'Fulfillment',  icon: '🚚' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      position: 'fixed', top: 0, left: 0, bottom: 0,
      width: 'var(--sidebar-width)',        /* 260px */
      background: 'var(--sidebar-bg)',      /* #FFFFFF */
      borderRight: '1px solid var(--sidebar-border)',  /* #EEEDE8 */
      display: 'flex', flexDirection: 'column',
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid var(--sidebar-border)' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.01em' }}>
          YourApp
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
          Subtitle or tagline
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
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
      </nav>

      {/* Footer — user + logout */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid var(--sidebar-border)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 'var(--radius)',
          background: 'var(--bg-subtle)',
        }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
            👤
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{user?.role}</div>
          </div>
          <button onClick={logout} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, fontSize: 16 }}>
            ⇥
          </button>
        </div>
      </div>
    </aside>
  );
}
```

---

## 19. Mobile Scan UI — Inline Token Pattern

Mobile scan pages (full-screen, no sidebar) use a **local `const C` object** instead of CSS variables. This is intentional — these pages are self-contained and often served in a WebView.

### Standard `C` token object (copy this into every mobile PageClient)
```tsx
const C = {
  bg:      '#F8F7F4',   /* slightly warmer than --bg */
  surface: '#FFFFFF',
  text:    '#1C1917',
  sec:     '#78716C',
  ter:     '#A8A29E',
  border:  '#E7E5E0',
  primary: '#CC785C',
  success: '#2E7D52',
  danger:  '#B91C1C',
  warning: '#92400E',
  info:    '#1D4ED8',
};
```

### Mobile page shell
```tsx
// Mobile page — no sidebar, full screen, scrollable
<div style={{
  maxWidth: 520,
  margin: '0 auto',
  padding: '14px 14px 80px',   /* bottom padding for fixed action button */
  background: C.bg,
  minHeight: '100vh',
  fontFamily: 'Inter, system-ui, sans-serif',
}}>
  {/* Header row */}
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
    <button onClick={() => router.back()} style={{
      width: 38, height: 38, borderRadius: 10,
      background: C.surface, border: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2.5">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.ter }}>
        Section Label
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>Page Title</div>
    </div>
    <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#FFFBEB', color: C.warning }}>
      STATUS
    </span>
  </div>

  {/* Content cards */}
  <div style={{ background: C.surface, borderRadius: 12, padding: 16, marginBottom: 16, border: `1px solid ${C.border}` }}>
    ...
  </div>

  {/* Fixed-width full-width action button */}
  <button onClick={handleAction} style={{
    width: '100%', padding: '16px 0', borderRadius: 14, border: 'none',
    background: C.success, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer',
  }}>
    ✓ Confirm Action
  </button>
</div>
```

### Mobile loading spinner
```tsx
if (loading) return (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background: C.bg, fontFamily: 'Inter, system-ui, sans-serif' }}>
    <div style={{ width: 36, height: 36, border: `4px solid ${C.border}`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);
```

### Mobile phase/step bar
```tsx
// Two-phase progress bar (e.g. Pack → Ship)
<div style={{ display:'flex', background: C.surface, borderRadius: 12, overflow:'hidden', marginBottom: 16, border: `1px solid ${C.border}` }}>
  {[{ key:'step1', label:'Step One' }, { key:'step2', label:'Step Two' }].map(({ key, label }) => {
    const active = phase === key;
    const done   = phase === 'step2' && key === 'step1';
    return (
      <div key={key} style={{
        flex: 1, padding: '10px 8px', textAlign: 'center',
        background: active ? C.primary : done ? '#EDFAF4' : 'transparent',
        borderRight: key === 'step1' ? `1px solid ${C.border}` : 'none',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: active ? '#fff' : done ? C.success : C.ter }}>
          {done ? '✓ ' : ''}{label}
        </div>
      </div>
    );
  })}
</div>
```

### Mobile scan input (barcode/scanner-friendly)
```tsx
// AWB / barcode scan input
<input
  value={scanValue}
  onChange={e => setScanValue(e.target.value)}
  onKeyDown={e => e.key === 'Enter' && handleScan(scanValue)}
  placeholder="Scan barcode or type…"
  autoFocus
  autoComplete="off"
  inputMode="none"    /* suppresses soft keyboard; hardware scanner sends keystrokes */
  style={{
    width: '100%', height: 48, padding: '0 14px',
    fontSize: 16, fontFamily: 'monospace', fontWeight: 700,
    border: `2px solid ${scanValue ? C.success : C.border}`,
    borderRadius: 10, outline: 'none',
    background: C.surface, color: C.text,
    transition: 'border-color 0.2s', boxSizing: 'border-box',
  }}
/>
```

### Mobile stepper (box count, quantity)
```tsx
<div style={{ display:'flex', gap: 6, alignItems:'center' }}>
  <button onClick={() => setCount(c => Math.max(1, c - 1))} style={{
    width: 34, height: 34, borderRadius: 7,
    background: '#F5F4EF', border: `1px solid ${C.border}`,
    fontSize: 18, fontWeight: 700, cursor: 'pointer',
  }}>−</button>
  <span style={{ fontSize: 22, fontWeight: 800, minWidth: 28, textAlign:'center' }}>{count}</span>
  <button onClick={() => setCount(c => c + 1)} style={{
    width: 34, height: 34, borderRadius: 7,
    background: '#F5F4EF', border: `1px solid ${C.border}`,
    fontSize: 18, fontWeight: 700, cursor: 'pointer',
  }}>+</button>
</div>
```

### Haptic feedback (WMS native bridge)
```tsx
// Trigger vibration on scan/confirm — safe to call even without native bridge
window.WMSNative?.vibrate?.(120);   // light tap
window.WMSNative?.vibrate?.(150);   // confirm success

// TypeScript declaration (add once to a global .d.ts file)
declare global {
  interface Window {
    WMSNative?: { vibrate?: (ms: number) => void };
  }
}
```

---

## 20. Common Layout Patterns

### Dashboard grid (stat cards + content)
```tsx
{/* Stats row */}
<div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
  <div className="stat-card">
    <div className="stat-label">Total Orders</div>
    <div className="stat-value">1,284</div>
    <div className="stat-sub">↑ 12% from yesterday</div>
  </div>
  ...
</div>

{/* Tab bar + filter pills */}
<div style={{ display:'flex', alignItems:'center', gap: 12, marginBottom: 20, flexWrap:'wrap' }}>
  <div className="tabs">
    <button className={`tab-btn ${tab==='all' ? 'active' : ''}`} onClick={()=>setTab('all')}>All</button>
    <button className={`tab-btn ${tab==='pending' ? 'active' : ''}`} onClick={()=>setTab('pending')}>Pending</button>
  </div>
  <div style={{ display:'flex', gap: 8 }}>
    <button className={`filter-pill ${filter==='today' ? 'active' : ''}`}>Today</button>
    <button className={`filter-pill ${filter==='week' ? 'active' : ''}`}>This week</button>
  </div>
</div>

{/* Table card */}
<div className="card-flat" style={{ padding: 0, overflow:'hidden' }}>
  <table>...</table>
</div>
```

### Detail page — two-column info grid
```tsx
<div className="card" style={{ marginBottom: 16 }}>
  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14 }}>Order Details</div>
  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 24px' }}>
    {[
      { label:'Order ID',  value:'ORD-00123' },
      { label:'Customer',  value:'Acme Corp' },
      { label:'Status',    value:<span className="badge badge-green">Shipped</span> },
      { label:'Created',   value:'May 6, 2026' },
    ].map(({ label, value }) => (
      <div key={label}>
        <div style={{ fontSize: 11, color:'var(--text-tertiary)', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 500, color:'var(--text)' }}>{value}</div>
      </div>
    ))}
  </div>
</div>
```

---

## 21. globals.css — Full Source

Paste this file verbatim as `src/app/globals.css` (or `src/styles/globals.css`):

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

/* ── Tables ── */
table { width: 100%; border-collapse: collapse; }
thead tr { border-bottom: 1px solid var(--border); }
th { text-align: left; padding: 10px 14px; font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-tertiary); background: var(--bg-subtle); white-space: nowrap; }
th:first-child { border-radius: var(--radius-sm) 0 0 var(--radius-sm); }
th:last-child  { border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
td { padding: 12px 14px; border-bottom: 1px solid var(--border); color: var(--text); font-size: 13.5px; }
tbody tr:last-child td { border-bottom: none; }
tbody tr { transition: background var(--t-fast); }
tbody tr:hover td { background: var(--bg); }

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

---

## 22. Claude Code Instructions

When Claude Code uses this design system, follow these rules:

1. **Always import `globals.css`** in the root layout (`layout.tsx` or `_app.tsx`). Do not add additional CSS files for component styles — use class names and inline styles.

2. **Desktop pages** (with sidebar): use CSS class names from globals.css (`.btn-primary`, `.card`, `.badge-green`, etc.) with occasional inline `style={{}}` for layout specifics.

3. **Mobile scan pages** (no sidebar, full-screen): use the inline `const C` token object. Do NOT use CSS classes on these pages — they are self-contained and may run in a WebView.

4. **Never use Tailwind, CSS Modules, or styled-components** — this system uses global CSS classes + CSS custom properties + inline styles only.

5. **Color values** must always come from tokens, never hard-coded hex values except inside the `const C` object on mobile pages.

6. **Spacing** is freeform inline — no spacing scale. Use multiples of 4px or 8px as a guide (4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32).

7. **Border radius**: always use `--radius-*` variables on desktop; use `6`, `8`, `10`, `12`, `14` px inline on mobile.

8. **Fonts**: Inter for all UI; `'SF Mono', 'Fira Code', monospace` for IDs, codes, tracking numbers.

9. **Sidebar layout**: `position: fixed; width: var(--sidebar-width)` with `marginLeft: 'var(--sidebar-width)'` on `<main>`.

10. **Active nav item**: background `var(--sidebar-active-bg)`, text/icon `var(--sidebar-active)`, dot indicator on right.
