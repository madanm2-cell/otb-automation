'use client';

import { useEffect, useState } from 'react';
import { Card, Descriptions, Tag, Button, Space, Typography, message, Spin } from 'antd';
import { UploadOutlined, TableOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { OtbCycle, FileUpload } from '@/types/otb';
import { REQUIRED_FILE_TYPES, ALL_FILE_TYPES, FILE_TYPE_LABELS } from '@/types/otb';

const { Title } = Typography;

const STATUS_COLORS: Record<string, string> = {
  Draft: 'default',
  Filling: 'orange',
  InReview: 'purple',
  Approved: 'green',
};

export default function CycleDetailPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const [cycle, setCycle] = useState<OtbCycle | null>(null);
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/cycles/${cycleId}`).then(r => r.json()),
      fetch(`/api/cycles/${cycleId}/upload-status`).then(r => r.json()),
    ]).then(([cycleData, uploadsData]) => {
      setCycle(cycleData);
      setUploads(Array.isArray(uploadsData) ? uploadsData : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [cycleId]);

  const handleActivate = async () => {
    setActivating(true);
    try {
      // First generate template
      const genRes = await fetch(`/api/cycles/${cycleId}/generate-template`, { method: 'POST' });
      const genData = await genRes.json();
      if (!genRes.ok) {
        message.error(genData.error || 'Template generation failed');
        return;
      }
      message.success(`Template generated: ${genData.rowCount} rows`);

      // Then activate
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
  if (!cycle) return <div style={{ padding: 24 }}>Cycle not found</div>;

  const uploadsByType = new Map(uploads.map(u => [u.file_type, u]));
  const allRequiredValidated = REQUIRED_FILE_TYPES.every(
    ft => uploadsByType.get(ft)?.status === 'validated'
  );
  const canActivate = cycle.status === 'Draft' && allRequiredValidated && cycle.assigned_gd_id;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>{cycle.cycle_name}</Title>
        <Tag color={STATUS_COLORS[cycle.status]}>{cycle.status}</Tag>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <Descriptions column={2}>
          <Descriptions.Item label="Brand">{cycle.brands?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="Quarter">{cycle.planning_quarter}</Descriptions.Item>
          <Descriptions.Item label="Period">{cycle.planning_period_start} to {cycle.planning_period_end}</Descriptions.Item>
          <Descriptions.Item label="GD Assigned">{cycle.assigned_gd_id || 'Not assigned'}</Descriptions.Item>
          <Descriptions.Item label="Wear Types">
            <Space size={4}>{cycle.wear_types.map(t => <Tag key={t}>{t}</Tag>)}</Space>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="File Uploads" style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
          {ALL_FILE_TYPES.map(ft => {
            const upload = uploadsByType.get(ft);
            const isRequired = REQUIRED_FILE_TYPES.includes(ft);
            return (
              <Card
                key={ft}
                size="small"
                style={{ borderColor: upload?.status === 'validated' ? '#52c41a' : upload?.status === 'failed' ? '#ff4d4f' : '#d9d9d9' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{FILE_TYPE_LABELS[ft]}</strong>
                    {isRequired && <Tag color="red" style={{ marginLeft: 4 }}>Required</Tag>}
                  </div>
                  {upload ? (
                    <Tag color={upload.status === 'validated' ? 'green' : 'red'}>
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
        {cycle.status === 'Draft' && (
          <div style={{ marginTop: 16 }}>
            <Link href={`/cycles/${cycleId}/upload`}>
              <Button type="primary" icon={<UploadOutlined />}>Upload Files</Button>
            </Link>
          </div>
        )}
      </Card>

      <Space>
        {cycle.status === 'Draft' && (
          <Button
            type="primary"
            size="large"
            onClick={handleActivate}
            loading={activating}
            disabled={!canActivate}
          >
            Generate Template & Activate
          </Button>
        )}
        {['Filling', 'InReview', 'Approved'].includes(cycle.status) && (
          <Link href={`/cycles/${cycleId}/grid`}>
            <Button type="primary" size="large" icon={<TableOutlined />}>
              Open OTB Grid
            </Button>
          </Link>
        )}
      </Space>

      {!canActivate && cycle.status === 'Draft' && (
        <div style={{ marginTop: 8, color: '#999', fontSize: 13 }}>
          {!allRequiredValidated && 'Upload and validate all 9 required files. '}
          {!cycle.assigned_gd_id && 'Assign a GD. '}
        </div>
      )}
    </div>
  );
}
