'use client';

import { Space } from 'antd';
import type { OtbCycle } from '@/types/otb';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/lib/auth/roles';
import { FileUploadsCard } from '@/components/cycle-workspace/FileUploadsCard';
import { DefaultsCard } from '@/components/cycle-workspace/DefaultsCard';
import { ActualsUploadCard } from '@/components/cycle-workspace/ActualsUploadCard';

interface Props {
  cycle: OtbCycle;
  onCycleUpdated: (cycle: OtbCycle) => void;
  onActualsUploaded: () => void;
}

export function SetupTab({ cycle, onCycleUpdated, onActualsUploaded }: Props) {
  const { profile } = useAuth();
  const canUploadActuals = profile ? hasPermission(profile.role, 'upload_actuals') : false;
  const showActuals = cycle.status === 'Approved' && canUploadActuals;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <FileUploadsCard cycleId={cycle.id} cycleStatus={cycle.status} />

      <DefaultsCard
        cycle={cycle}
        onConfirmed={() => onCycleUpdated({ ...cycle, defaults_confirmed: true })}
      />

      {showActuals && (
        <ActualsUploadCard cycleId={cycle.id} onActualsUploaded={onActualsUploaded} />
      )}
    </Space>
  );
}
