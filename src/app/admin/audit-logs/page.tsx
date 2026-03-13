import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AuditLogViewer } from '@/components/AuditLogViewer';

export default function AuditLogsPage() {
  return (
    <ProtectedRoute permission="view_audit_logs">
      <AuditLogViewer />
    </ProtectedRoute>
  );
}
