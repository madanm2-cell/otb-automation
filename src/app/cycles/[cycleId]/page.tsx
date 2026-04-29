'use client';

import { useEffect, useState } from 'react';
import { Card, Descriptions, Tag, Button, Space, Typography, message, Spin } from 'antd';
import {
  UploadOutlined, TableOutlined, CheckCircleOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/lib/auth/roles';
import { StatusPipeline } from '@/components/ui/StatusPipeline';
import type { PipelineStage } from '@/components/ui/StatusPipeline';
import { COLORS, CARD_STYLES, SPACING, STATUS_TAG_COLORS } from '@/lib/designTokens';
import type { OtbCycle, FileUpload, CycleStatus } from '@/types/otb';
import { REQUIRED_FILE_TYPES, ALL_FILE_TYPES, FILE_TYPE_LABELS } from '@/types/otb';

const { Title, Text } = Typography;

const LIFECYCLE_STAGES: CycleStatus[] = ['Draft', 'Filling', 'InReview', 'Approved'];

function getCycleStages(status: CycleStatus): PipelineStage[] {
  const currentIdx = LIFECYCLE_STAGES.indexOf(status);
  return LIFECYCLE_STAGES.map((stage, i) => ({
    key: stage,
    label: stage === 'InReview' ? 'In Review' : stage,
    status: i < currentIdx ? 'completed' as const : i === currentIdx ? 'active' as const : 'pending' as const,
  }));
}

export default function CycleDetailPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const [cycle, setCycle] = useState<OtbCycle | null>(null);
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const router = useRouter();
  const { profile } = useAuth();
  const canManageCycle = profile ? hasPermission(profile.role, 'create_cycle') : false;
  const canUpload = profile ? hasPermission(profile.role, 'upload_data') : false;
  const canUploadActuals = profile ? hasPermission(profile.role, 'upload_actuals') : false;
  const canViewVariance = profile ? hasPermission(profile.role, 'view_variance') : false;

  useEffect(() => {
    const fetches: Promise<any>[] = [
      fetch(`/api/cycles/${cycleId}`).then(r => r.json()),
      fetch(`/api/cycles/${cycleId}/upload-status`).then(r => r.ok ? r.json() : []).catch(() => []),
    ];
    Promise.all(fetches).then(([cycleData, uploadsData]) => {
      setCycle(cycleData);
      setUploads(Array.isArray(uploadsData) ? uploadsData : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [cycleId]);

  const handleActivate = async () => {
    setActivating(true);
    try {
      const genRes = await fetch(`/api/cycles/${cycleId}/generate-template`, { method: 'POST' });
      const genData = await genRes.json();
      if (!genRes.ok) {
        message.error(genData.error || 'Template generation failed');
        return;
      }
      message.success(`Template generated: ${genData.rowCount} rows`);
      if (genData.warnings?.length) {
        genData.warnings.forEach((w: string) => message.warning(w, 8));
      }

      const actRes = await fetch(`/api/cycles/${cycleId}/activate`, { method: 'POST' });
      const actData = await actRes.json();
      if (!actRes.ok) {
        message.error(actData.error || 'Activation failed');
        return;
      }
      setCycle(actData);
      message.success('Cycle activated! GD can now fill data.');
    } catch {
      message.error('Network error');
    } finally {
      setActivating(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!cycle) return <div style={{ padding: SPACING.xl }}>Cycle not found</div>;

  const uploadsByType = new Map(uploads.map(u => [u.file_type, u]));
  const allRequiredValidated = REQUIRED_FILE_TYPES.every(
    ft => uploadsByType.get(ft)?.status === 'validated'
  );
  const canActivate = cycle.status === 'Draft'
    && allRequiredValidated
    && cycle.assigned_gd_id
    && cycle.defaults_confirmed;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header with status pipeline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg }}>
        <Title level={3} style={{ margin: 0, color: COLORS.textPrimary }}>{cycle.cycle_name}</Title>
        <Tag color={STATUS_TAG_COLORS[cycle.status]}>{cycle.status}</Tag>
      </div>

      <div style={{ marginBottom: SPACING.xl }}>
        <StatusPipeline stages={getCycleStages(cycle.status)} size="small" />
      </div>

      {/* Cycle Info */}
      <Card style={{ ...CARD_STYLES, marginBottom: SPACING.xl }}>
        <Descriptions column={2}>
          <Descriptions.Item label={<Text type="secondary">Brand</Text>}>{cycle.brands?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label={<Text type="secondary">Quarter</Text>}>{cycle.planning_quarter}</Descriptions.Item>
          <Descriptions.Item label={<Text type="secondary">Period</Text>}>{cycle.planning_period_start} to {cycle.planning_period_end}</Descriptions.Item>
          <Descriptions.Item label={<Text type="secondary">GD Assigned</Text>}>
            {(cycle as OtbCycle & { assigned_gd_name?: string }).assigned_gd_name || cycle.assigned_gd_id || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* File Uploads */}
      <Card title={<Text strong>File Uploads</Text>} style={{ ...CARD_STYLES, marginBottom: SPACING.xl }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
          {ALL_FILE_TYPES.filter(ft => ft !== 'soft_forecast' && (ft !== 'actuals' || cycle.status === 'Approved')).map(ft => {
            const upload = uploadsByType.get(ft);
            const isRequired = REQUIRED_FILE_TYPES.includes(ft);
            const borderColor = upload?.status === 'validated' ? COLORS.success
              : upload?.status === 'failed' ? COLORS.danger
              : COLORS.border;
            return (
              <Card key={ft} size="small" style={{ borderColor, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong style={{ fontSize: 13 }}>{FILE_TYPE_LABELS[ft]}</Text>
                    {isRequired && <Tag color="error" style={{ marginLeft: 6, fontSize: 10 }}>Required</Tag>}
                  </div>
                  {upload ? (
                    <Tag color={upload.status === 'validated' ? 'success' : 'error'}>
                      {upload.status} ({upload.row_count} rows)
                    </Tag>
                  ) : (
                    <Tag>Not uploaded</Tag>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
        {(cycle.status === 'Draft' || cycle.status === 'Filling') && canUpload && (
          <div style={{ marginTop: SPACING.lg }}>
            <Link href={`/cycles/${cycleId}/upload`}>
              <Button type={cycle.status === 'Filling' ? 'default' : 'primary'} icon={<UploadOutlined />}>
                {cycle.status === 'Filling' ? 'Re-upload Reference Data' : 'Upload Files'}
              </Button>
            </Link>
          </div>
        )}
      </Card>

      {/* Review Defaults */}
      {cycle.status === 'Draft' && (
        <Card
          title={<Text strong>Review & Confirm Defaults</Text>}
          style={{
            ...CARD_STYLES,
            marginBottom: SPACING.xl,
            borderColor: cycle.defaults_confirmed ? COLORS.success : COLORS.border,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text>ASP, COGS, Return%, Tax%, Sellex%, Standard DoH</Text>
              <div style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 4 }}>
                Pre-populated from master data. Review and adjust values for this cycle.
              </div>
            </div>
            <Space>
              {cycle.defaults_confirmed ? (
                <Tag icon={<CheckCircleOutlined />} color="success">Confirmed</Tag>
              ) : (
                <Tag color="warning">Not confirmed</Tag>
              )}
              {canManageCycle && (
                <Link href={`/cycles/${cycleId}/defaults`}>
                  <Button type={cycle.defaults_confirmed ? 'default' : 'primary'}>
                    {cycle.defaults_confirmed ? 'View Defaults' : 'Review Defaults'}
                  </Button>
                </Link>
              )}
            </Space>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <Space size="middle">
        {cycle.status === 'Draft' && canManageCycle && (
          <Button type="primary" size="large" onClick={handleActivate} loading={activating} disabled={!canActivate}>
            Generate Template & Activate
          </Button>
        )}
        {['Filling', 'InReview', 'Approved'].includes(cycle.status) && (
          <Link href={`/cycles/${cycleId}/grid`}>
            <Button type="primary" size="large" icon={<TableOutlined />}>Open OTB Grid</Button>
          </Link>
        )}
        {cycle.status === 'Approved' && canUploadActuals && (
          <Button size="large" icon={<UploadOutlined />} onClick={() => router.push(`/cycles/${cycleId}/actuals`)}>
            Upload Actuals
          </Button>
        )}
        {cycle.status === 'Approved' && canViewVariance && (
          <Button size="large" icon={<BarChartOutlined />} onClick={() => router.push(`/cycles/${cycleId}/variance`)}>
            View Variance Report
          </Button>
        )}
      </Space>

      {!canActivate && cycle.status === 'Draft' && (
        <div style={{ marginTop: SPACING.sm, color: COLORS.textMuted, fontSize: 13 }}>
          {!cycle.assigned_gd_id && 'Assign a GD to this cycle. '}
          {!allRequiredValidated && 'Upload and validate all required files. '}
          {!cycle.defaults_confirmed && 'Review and confirm defaults. '}
        </div>
      )}
    </div>
  );
}
