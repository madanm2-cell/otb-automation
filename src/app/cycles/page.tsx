'use client';

import { useEffect, useState, useMemo } from 'react';
import { Table, Button, Tag, Typography, Card, Row, Col } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import { hasPermission } from '@/lib/auth/roles';
import { COLORS, SPACING, STATUS_TAG_COLORS, STATUS_COLORS, CARD_STYLES } from '@/lib/designTokens';
import type { OtbCycle, CycleStatus } from '@/types/otb';

const { Title } = Typography;

export default function CyclesPage() {
  const { profile } = useAuth();
  const { selectedBrandId } = useBrand();
  const [cycles, setCycles] = useState<OtbCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const canCreate = profile ? hasPermission(profile.role, 'create_cycle') : false;

  useEffect(() => {
    const controller = new AbortController();
    const url = selectedBrandId
      ? `/api/cycles?brandId=${selectedBrandId}`
      : '/api/cycles';
    setLoading(true);
    fetch(url, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        setCycles(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') setLoading(false);
      });
    return () => controller.abort();
  }, [selectedBrandId]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { Draft: 0, Filling: 0, InReview: 0, Approved: 0 };
    cycles.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return counts;
  }, [cycles]);

  const isGd = profile?.role === 'GD';

  const columns = [
    {
      title: 'Cycle Name',
      dataIndex: 'cycle_name',
      key: 'cycle_name',
      render: (text: string, record: OtbCycle) => {
        const href = isGd && ['Filling', 'InReview', 'Approved'].includes(record.status)
          ? `/cycles/${record.id}?tab=plan`
          : `/cycles/${record.id}`;
        return <Link href={href} style={{ fontWeight: 500 }}>{text}</Link>;
      },
    },
    {
      title: 'Brand',
      key: 'brand',
      render: (_: unknown, record: OtbCycle) => record.brands?.name || '-',
    },
    {
      title: 'Quarter',
      dataIndex: 'planning_quarter',
      key: 'planning_quarter',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={STATUS_TAG_COLORS[status] || 'default'}>{status}</Tag>,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (d: string) => new Date(d).toLocaleDateString('en-IN'),
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xl }}>
        <Title level={3} style={{ margin: 0, color: COLORS.textPrimary }}>OTB Cycles</Title>
        {canCreate && (
          <Link href="/cycles/new">
            <Button type="primary" icon={<PlusOutlined />}>New Cycle</Button>
          </Link>
        )}
      </div>

      {/* Status summary cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: SPACING.xl }}>
        {(['Draft', 'Filling', 'InReview', 'Approved'] as const).map(status => {
          const label = status === 'InReview' ? 'In Review' : status;
          const color = STATUS_COLORS[status] || COLORS.textSecondary;
          return (
            <Col key={status} xs={12} sm={6}>
              <Card
                style={{ ...CARD_STYLES, borderTop: `3px solid ${color}` }}
                styles={{ body: { padding: '16px 20px' } }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: COLORS.textMuted, marginBottom: 8 }}>
                  {label}
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>
                  {statusCounts[status] || 0}
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      <Table
        dataSource={cycles}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 800 }}
      />
    </div>
  );
}
