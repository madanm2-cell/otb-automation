'use client';

import { Layout, Menu, Dropdown, Button, Spin, Typography, Avatar, Select } from 'antd';
import {
  DashboardOutlined, TableOutlined,
  UserOutlined, SettingOutlined, AuditOutlined, LogoutOutlined,
  CheckSquareOutlined, DatabaseOutlined,
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
  const { brands, selectedBrandId, setSelectedBrandId, loading: brandLoading } = useBrand();
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = profile?.role === 'Admin';

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: COLORS.background }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!profile) return <>{children}</>;

  const role = profile.role;

  // Main navigation items
  const navItems: MenuProps['items'] = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/cycles', icon: <TableOutlined />, label: 'OTB Cycles' },
  ];

  if (hasPermission(role, 'approve_otb')) {
    navItems.push({ key: '/approvals', icon: <CheckSquareOutlined />, label: 'Approvals' });
  }
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
          {profile && brands.length > 1 && (
            <Select
              value={selectedBrandId ?? '__all__'}
              onChange={(value) => setSelectedBrandId(value === '__all__' ? null : value)}
              style={{ width: 180, marginRight: 16 }}
              loading={brandLoading}
              placeholder="Select brand"
              options={[
                ...(isAdmin ? [{ value: '__all__', label: 'All Brands' }] : []),
                ...brands.map((brand) => ({ value: brand.id, label: brand.name })),
              ]}
            />
          )}
          {profile && brands.length === 1 && (
            <span style={{ marginRight: 16, fontWeight: 500, color: COLORS.textSecondary }}>
              {brands[0].name}
            </span>
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
