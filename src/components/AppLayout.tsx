'use client';

import { useRef, useState, useEffect } from 'react';
import { Layout, Menu, Dropdown, Button, Spin, Typography, Avatar } from 'antd';
import {
  DashboardOutlined, TableOutlined,
  UserOutlined, SettingOutlined, AuditOutlined, LogoutOutlined,
  DatabaseOutlined, SwapOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import { hasPermission } from '@/lib/auth/roles';
import { useRouter, usePathname } from 'next/navigation';
import { COLORS, SHADOWS, SPACING } from '@/lib/designTokens';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading, signOut } = useAuth();
  const { brands, selectedBrandId } = useBrand();
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = profile?.role === 'Admin';

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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: COLORS.background }}>
        <Spin size="large" />
      </div>
    );
  }

  if (pathname === '/brand-select') return <>{children}</>;

  if (!profile) return <>{children}</>;

  const role = profile.role;

  // Main navigation items
  const navItems: MenuProps['items'] = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/cycles', icon: <TableOutlined />, label: 'OTB Cycles' },
  ];

  // Admin section
  const adminItems: MenuProps['items'] = [];
  if (hasPermission(role, 'manage_users')) {
    adminItems.push({ key: '/admin/users', icon: <UserOutlined />, label: 'User Management' });
  }
  if (hasPermission(role, 'manage_master_data')) {
    adminItems.push({ key: '/admin/master-data', icon: <DatabaseOutlined />, label: 'Master Data' });
    adminItems.push({ key: '/admin/master-defaults', icon: <SettingOutlined />, label: 'Master Defaults' });
  }
  if (hasPermission(role, 'view_audit_logs')) {
    adminItems.push({ key: '/admin/audit-logs', icon: <AuditOutlined />, label: 'Audit Logs' });
  }

  const menuItems: MenuProps['items'] = [
    ...navItems,
    ...(adminItems.length > 0
      ? [
          { type: 'divider' as const },
          {
            type: 'group' as const,
            label: (
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.5px',
                color: 'rgba(255, 255, 255, 0.45)',
                padding: '0 8px',
              }}>
                Administration
              </span>
            ),
            children: adminItems,
          },
        ]
      : []),
  ];

  const initials = getInitials(profile.full_name || profile.email);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        width={240}
        collapsedWidth={80}
        style={{ background: COLORS.primary }}
      >
        <div style={{
          padding: `${SPACING.xl}px ${SPACING.lg}px`,
          textAlign: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: SPACING.sm,
        }}>
          <img src="/tmrw-logo.png" alt="TMRW" style={{ height: 28, marginBottom: 6 }} />
          <Text strong style={{ color: '#fff', fontSize: 13, display: 'block', letterSpacing: '0.3px' }}>
            OTB Platform
          </Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname]}
          items={menuItems}
          onClick={({ key }) => router.push(key)}
          style={{ background: 'transparent', borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: COLORS.surface,
          padding: `0 ${SPACING.xxl}px`,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          height: 56,
          lineHeight: '56px',
          borderBottom: `1px solid ${COLORS.borderLight}`,
          boxShadow: SHADOWS.sm,
        }}>
          {profile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 16 }}>
              <span style={{ fontWeight: 500, color: COLORS.textSecondary, fontSize: 13 }}>
                {selectedBrandId
                  ? brands.find(b => b.id === selectedBrandId)?.name ?? 'Unknown'
                  : 'All Brands'}
              </span>
              {brands.length > 1 && (
                <Button
                  type="link"
                  size="small"
                  icon={<SwapOutlined />}
                  onClick={() => router.push(
                    `/brand-select?returnTo=${encodeURIComponent(pathname)}&switch=true`
                  )}
                  style={{ padding: 0, height: 'auto', fontSize: 12, color: COLORS.accent }}
                >
                  Switch
                </Button>
              )}
            </div>
          )}
          <Dropdown menu={{ items: [
            { key: 'role', label: `Role: ${profile.role}`, disabled: true },
            { type: 'divider' },
            { key: 'logout', icon: <LogoutOutlined />, label: 'Sign Out', onClick: signOut },
          ]}}>
            <Button type="text" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40 }}>
              <Avatar
                size={32}
                style={{ backgroundColor: COLORS.accent, fontSize: 13, fontWeight: 600 }}
              >
                {initials}
              </Avatar>
              <span style={{ color: COLORS.textPrimary, fontWeight: 500 }}>{profile.full_name}</span>
            </Button>
          </Dropdown>
        </Header>
        <Content style={{
          padding: `${SPACING.xl}px ${SPACING.xxl}px`,
          background: COLORS.background,
          minHeight: 280,
        }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
