import { ProtectedRoute } from '@/components/ProtectedRoute';
import { UserManagement } from '@/components/UserManagement';

export const dynamic = 'force-dynamic';

export default function UsersPage() {
  return (
    <ProtectedRoute permission="manage_users">
      <UserManagement />
    </ProtectedRoute>
  );
}
