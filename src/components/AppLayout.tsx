'use client';

import { Layout, Menu, Dropdown, Button, Spin, Typography } from 'antd';
import {
  DashboardOutlined, TableOutlined,
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
    menuItems.push({ key: '/admin/master-defaults', icon: <SettingOutlined />, label: 'Master Defaults' });
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
