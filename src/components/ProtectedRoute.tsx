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
