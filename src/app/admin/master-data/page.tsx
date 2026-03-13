import { ProtectedRoute } from '@/components/ProtectedRoute';
import { MasterDataManager } from '@/components/MasterDataManager';

export default function MasterDataPage() {
  return (
    <ProtectedRoute permission="manage_master_data">
      <MasterDataManager />
    </ProtectedRoute>
  );
}
