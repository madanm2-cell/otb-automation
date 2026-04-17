'use client';

import { useEffect, useState, useMemo } from 'react';
import { Table, Button, Tag, Space, Typography, Statistic } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/lib/auth/roles';
import { COLORS, SPACING, STATUS_TAG_COLORS } from '@/lib/designTokens';
import type { OtbCycle, CycleStatus } from '@/types/otb';

const { Title } = Typography;

export default function CyclesPage() {
  const { profile } = useAuth();
  const [cycles, setCycles] = useState<OtbCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const canCreate = profile ? hasPermission(profile.role, 'create_cycle') : false;

  useEffect(() => {
    fetch('/api/cycles')
      .then(r => r.json())
      .then(data => {
        setCycles(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { Draft: 0, Filling: 0, InReview: 0, Approved: 0 };
    cycles.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return counts;
  }, [cycles]);

  const columns = [
    {
      title: 'Cycle Name',
      dataIndex: 'cycle_name',
      key: 'cycle_name',
      render: (text: string, record: OtbCycle) => (
        <Link href={`/cycles/${record.id}`} style={{ fontWeight: 500 }}>{text}</Link>
      ),
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
      title: 'Wear Types',
      dataIndex: 'wear_types',
      key: 'wear_types',
      render: (types: string[]) => (
        <Space size={4} wrap>
          {(types || []).map(t => <Tag key={t}>{t}</Tag>)}
        </Space>
      ),
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

      {/* Status summary row */}
      {cycles.length > 0 && (
        <div style={{ display: 'flex', gap: SPACING.xl, marginBottom: SPACING.xl, flexWrap: 'wrap' }}>
          {(['Draft', 'Filling', 'InReview', 'Approved'] as const).map(status => (
            <Statistic
              key={status}
              title={<span style={{ fontSize: 12, color: COLORS.textMuted }}>{status === 'InReview' ? 'In Review' : status}</span>}
              value={statusCounts[status] || 0}
              valueStyle={{
                fontSize: 20,
                fontWeight: 700,
                color: status === 'Approved' ? COLORS.success
                  : status === 'InReview' ? COLORS.accent
                  : status === 'Filling' ? COLORS.warning
                  : COLORS.textSecondary,
              }}
            />
          ))}
        </div>
      )}

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
