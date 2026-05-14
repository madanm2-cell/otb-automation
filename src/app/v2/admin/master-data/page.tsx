import { ProtectedRoute } from '@/components/ProtectedRoute';
import { MasterDataManager } from '@/components/MasterDataManager';

export const dynamic = 'force-dynamic';

export default function V2MasterDataPage() {
  return (
    <ProtectedRoute permission="manage_master_data">
      <MasterDataManager />
    </ProtectedRoute>
  );
}
