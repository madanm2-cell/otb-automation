'use client';

import { useState } from 'react';
import { Tag, Button, Descriptions, Typography, message } from 'antd';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/lib/auth/roles';
import { StatusPipeline } from '@/components/ui/StatusPipeline';
import type { PipelineStage } from '@/components/ui/StatusPipeline';
import { COLORS, SPACING, STATUS_TAG_COLORS } from '@/lib/designTokens';
import type { OtbCycle, CycleStatus } from '@/types/otb';

const { Title, Text } = Typography;

const LIFECYCLE_STAGES: CycleStatus[] = ['Draft', 'Filling', 'InReview', 'Approved'];

function getCycleStages(status: CycleStatus): PipelineStage[] {
  const currentIdx = LIFECYCLE_STAGES.indexOf(status);
  return LIFECYCLE_STAGES.map((stage, i) => ({
    key: stage,
    label: stage === 'InReview' ? 'In Review' : stage,
    status:
      i < currentIdx
        ? ('completed' as const)
        : i === currentIdx
          ? ('active' as const)
          : ('pending' as const),
  }));
}

export interface CycleHeaderProps {
  cycle: OtbCycle;
  onCycleUpdated: (cycle: OtbCycle) => void;
  /**
   * Whether the cycle meets all activation prerequisites
   * (required files validated, GD assigned, defaults confirmed).
   * Computed by the workspace shell from upload-status. Defaults to false.
   */
  canActivate?: boolean;
}

export function CycleHeader({
  cycle,
  onCycleUpdated,
  canActivate = false,
}: CycleHeaderProps) {
  const { profile } = useAuth();
  const canManageCycle = profile ? hasPermission(profile.role, 'create_cycle') : false;
  const [activating, setActivating] = useState(false);

  const handleActivate = async () => {
    setActivating(true);
    try {
      const genRes = await fetch(`/api/cycles/${cycle.id}/generate-template`, {
        method: 'POST',
      });
      const genData = await genRes.json();
      if (!genRes.ok) {
        message.error(genData.error || 'Template generation failed');
        return;
      }
      message.success(`Template generated: ${genData.rowCount} rows`);
      if (genData.warnings?.length) {
        genData.warnings.forEach((w: string) => message.warning(w, 8));
      }

      const actRes = await fetch(`/api/cycles/${cycle.id}/activate`, {
        method: 'POST',
      });
      const actData = await actRes.json();
      if (!actRes.ok) {
        message.error(actData.error || 'Activation failed');
        return;
      }
      onCycleUpdated(actData);
      message.success('Cycle activated! GD can now fill data.');
    } catch {
      message.error('Network error');
    } finally {
      setActivating(false);
    }
  };

  const brandName = cycle.brands?.name;
  const showActivate = cycle.status === 'Draft' && canManageCycle;
  // assigned_gd_name comes from the API joining profiles.full_name (falling back to email).
  // If still missing, show "Unassigned" rather than the raw UUID — the UUID is never useful to a user.
  const assignedGdName =
    (cycle as OtbCycle & { assigned_gd_name?: string }).assigned_gd_name ||
    (cycle.assigned_gd_id ? 'Unassigned name' : 'Unassigned');

  return (
    <div>
      {/* Top row: name + status tag + brand pill, action button on the right */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: SPACING.md,
          marginBottom: SPACING.lg,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' }}>
          <Title level={3} style={{ margin: 0, color: COLORS.textPrimary }}>
            {cycle.cycle_name}
          </Title>
          <Tag color={STATUS_TAG_COLORS[cycle.status]}>{cycle.status}</Tag>
          {brandName && (
            <Tag color="blue" style={{ fontSize: 12 }}>
              {brandName}
            </Tag>
          )}
        </div>

        {showActivate && (
          <Button
            type="primary"
            size="large"
            onClick={handleActivate}
            loading={activating}
            disabled={!canActivate}
          >
            Generate Template &amp; Activate
          </Button>
        )}
      </div>

      {/* Status pipeline, full width */}
      <div style={{ marginBottom: SPACING.lg }}>
        <StatusPipeline stages={getCycleStages(cycle.status)} size="small" />
      </div>

      {/* Metadata row */}
      <div style={{ marginBottom: SPACING.md }}>
        <Descriptions column={4} size="small">
          <Descriptions.Item label={<Text type="secondary">Brand</Text>}>
            {brandName || '-'}
          </Descriptions.Item>
          <Descriptions.Item label={<Text type="secondary">Quarter</Text>}>
            {cycle.planning_quarter}
          </Descriptions.Item>
          <Descriptions.Item label={<Text type="secondary">Period</Text>}>
            {cycle.planning_period_start} to {cycle.planning_period_end}
          </Descriptions.Item>
          <Descriptions.Item label={<Text type="secondary">GD Assigned</Text>}>
            {assignedGdName}
          </Descriptions.Item>
        </Descriptions>
      </div>
    </div>
  );
}
