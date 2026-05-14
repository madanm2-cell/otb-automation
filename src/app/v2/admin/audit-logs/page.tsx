import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AuditLogViewer } from '@/components/AuditLogViewer';

export const dynamic = 'force-dynamic';

export default function V2AuditLogsPage() {
  return (
    <ProtectedRoute permission="view_audit_logs">
      <AuditLogViewer />
    </ProtectedRoute>
  );
}
