'use client';

import { useState } from 'react';
import { message } from 'antd';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/lib/auth/roles';
import type { PipelineStage } from '@/components/ui/StatusPipeline';
import type { OtbCycle, CycleStatus } from '@/types/otb';

const V2_STATUS_BADGE: Record<CycleStatus, string> = {
  Draft:    'badge badge-gray',
  Active:   'badge badge-blue',
  Filling:  'badge badge-blue',
  InReview: 'badge badge-yellow',
  Approved: 'badge badge-green',
};

function V2Pipeline({ stages }: { stages: PipelineStage[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {stages.map((stage, i) => (
        <div key={stage.key} style={{ display: 'flex', alignItems: 'center', flex: i < stages.length - 1 ? 1 : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
              background: stage.status === 'pending' ? 'var(--border-strong)'
                : stage.status === 'completed' ? 'var(--success)' : 'var(--primary)',
              boxShadow: stage.status === 'active' ? '0 0 0 3px var(--primary-light)' : 'none',
            }} />
            <span style={{
              fontSize: 12, whiteSpace: 'nowrap',
              fontWeight: stage.status === 'active' ? 600 : 400,
              color: stage.status === 'pending' ? 'var(--text-tertiary)'
                : stage.status === 'completed' ? 'var(--text-secondary)' : 'var(--text)',
            }}>
              {stage.label}
            </span>
          </div>
          {i < stages.length - 1 && (
            <div style={{
              flex: 1, height: 1, minWidth: 20, margin: '0 10px',
              background: stage.status === 'completed' ? 'var(--success)' : 'var(--border)',
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

const LIFECYCLE_STAGES: CycleStatus[] = ['Draft', 'Filling', 'InReview', 'Approved'];

function getCycleStages(status: CycleStatus): PipelineStage[] {
  const currentIdx = LIFECYCLE_STAGES.indexOf(status);
  return LIFECYCLE_STAGES.map((stage, i) => ({
    key: stage,
    label: stage === 'InReview' ? 'In Review' : stage,
    status: i < currentIdx ? 'completed' : i === currentIdx ? 'active' : 'pending',
  }));
}

export interface CycleHeaderProps {
  cycle: OtbCycle;
  onCycleUpdated: (cycle: OtbCycle) => void;
  canActivate?: boolean;
}

export function CycleHeader({ cycle, onCycleUpdated, canActivate = false }: CycleHeaderProps) {
  const { profile } = useAuth();
  const canManageCycle = profile ? hasPermission(profile.role, 'create_cycle') : false;
  const [activating, setActivating] = useState(false);

  const handleActivate = async () => {
    setActivating(true);
    try {
      const genRes = await fetch(`/api/cycles/${cycle.id}/generate-template`, { method: 'POST' });
      const genData = await genRes.json();
      if (!genRes.ok) { message.error(genData.error || 'Template generation failed'); return; }
      message.success(`Template generated: ${genData.rowCount} rows`);
      if (genData.warnings?.length) genData.warnings.forEach((w: string) => message.warning(w, 8));
      const actRes = await fetch(`/api/cycles/${cycle.id}/activate`, { method: 'POST' });
      const actData = await actRes.json();
      if (!actRes.ok) { message.error(actData.error || 'Activation failed'); return; }
      onCycleUpdated(actData);
      message.success('Cycle activated! GD can now fill data.');
    } catch { message.error('Network error'); }
    finally { setActivating(false); }
  };

  const brandName = cycle.brands?.name;
  const showActivate = cycle.status === 'Draft' && canManageCycle;
  const assignedGdName =
    (cycle as OtbCycle & { assigned_gd_name?: string }).assigned_gd_name ||
    (cycle.assigned_gd_id ? 'Unassigned name' : 'Unassigned');

  const stages = getCycleStages(cycle.status);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            {cycle.cycle_name}
          </span>
          <span className={V2_STATUS_BADGE[cycle.status]}>{cycle.status === 'InReview' ? 'In Review' : cycle.status}</span>
          {brandName && <span className="badge badge-blue">{brandName}</span>}
        </div>
        {showActivate && (
          <button className="btn-primary" onClick={handleActivate} disabled={!canActivate || activating}>
            {activating ? 'Activating…' : 'Generate Template & Activate'}
          </button>
        )}
      </div>

      <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <V2Pipeline stages={stages} />
      </div>

      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        {[
          { label: 'Brand',      value: brandName || '—' },
          { label: 'Quarter',    value: cycle.planning_quarter },
          { label: 'Period',     value: `${cycle.planning_period_start} → ${cycle.planning_period_end}` },
          { label: 'GD Assigned', value: assignedGdName },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
