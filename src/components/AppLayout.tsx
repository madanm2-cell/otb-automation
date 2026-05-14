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
          {/* User row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 'var(--radius)',
            background: 'var(--bg-subtle)', marginBottom: 6,
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

          {/* Brand row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            padding: '6px 12px',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedBrandName}
            </span>
            {brands.length > 1 && (
              <button
                onClick={() => router.push(`/brand-select?returnTo=${encodeURIComponent(pathname ?? '/')}&switch=true`)}
                style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--primary)', cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit', flexShrink: 0 }}
              >
                Switch
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main area */}
      <main style={{ flex: 1, minWidth: 0, padding: '28px 36px', background: 'var(--bg)', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
