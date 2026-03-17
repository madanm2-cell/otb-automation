'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { MasterDefaultsManager } from '@/components/MasterDefaultsManager';

export default function MasterDefaultsAdminPage() {
  return (
    <ProtectedRoute permission="manage_master_data">
      <div style={{ padding: 24 }}>
        <MasterDefaultsManager />
      </div>
    </ProtectedRoute>
  );
}
