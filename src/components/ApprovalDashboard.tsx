'use client';

import { useEffect, useState } from 'react';
import { useBrand } from '@/contexts/BrandContext';
import { Row, Col, Table, Tag, Typography, Space, Badge } from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, EditOutlined,
  ExclamationCircleOutlined, FileProtectOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusPipeline } from '@/components/ui/StatusPipeline';
import type { PipelineStage } from '@/components/ui/StatusPipeline';
import { TablePageSkeleton } from '@/components/ui/PageSkeleton';
import { COLORS, CARD_STYLES, SPACING, STATUS_TAG_COLORS } from '@/lib/designTokens';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

interface BrandSummary {
  cycle_id: string;
  cycle_name: string;
  brand_name: string;
  brand_id: string;
  status: string;
  planning_quarter: string;
  approval_progress: { approved: number; pending: number; revision: number; total: number };
  risk_level: string | null;
  risk_flags: { level: string; metric: string; message: string }[];
  updated_at: string;
}

interface DashboardData {
  summary: { totalCycles: number; pendingApproval: number; approved: number; filling: number };
  brands: BrandSummary[];
}

const APPROVAL_ROLES = ['Planning', 'GD', 'Finance', 'CXO'] as const;

function getApprovalStages(progress: BrandSummary['approval_progress']): PipelineStage[] {
  return APPROVAL_ROLES.map((role, i) => {
    const isApproved = progress.approved > i;
    const isRevision = progress.revision > 0 && !isApproved;
    return {
      key: role,
      label: role,
      status: isApproved ? 'completed' as const : isRevision ? 'error' as const : 'pending' as const,
    };
  });
}

export function ApprovalDashboard() {
  const { selectedBrandId } = useBrand();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    const url = selectedBrandId
      ? `/api/approvals/dashboard?brandId=${selectedBrandId}`
      : '/api/approvals/dashboard';
    fetch(url)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [selectedBrandId]);

  if (loading) return <TablePageSkeleton />;
  if (!data) return <Text type="danger">Failed to load dashboard</Text>;

  const columns: ColumnsType<BrandSummary> = [
    {
      title: 'Brand',
      dataIndex: 'brand_name',
      key: 'brand_name',
      width: 130,
      sorter: (a, b) => a.brand_name.localeCompare(b.brand_name),
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Cycle',
      dataIndex: 'cycle_name',
      key: 'cycle_name',
      width: 180,
    },
    {
      title: 'Quarter',
      dataIndex: 'planning_quarter',
      key: 'planning_quarter',
      width: 100,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => <Tag color={STATUS_TAG_COLORS[status] || 'default'}>{status}</Tag>,
      filters: [
        { text: 'In Review', value: 'InReview' },
        { text: 'Approved', value: 'Approved' },
        { text: 'Filling', value: 'Filling' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Approval Progress',
      key: 'progress',
      width: 280,
      render: (_, record) => (
        <StatusPipeline stages={getApprovalStages(record.approval_progress)} size="small" />
      ),
    },
    {
      title: 'Risk',
      key: 'risk',
      width: 100,
      render: (_, record) => {
        if (!record.risk_level) return <Tag color="success">OK</Tag>;
        return (
          <Tag
            icon={<ExclamationCircleOutlined />}
            color={record.risk_level === 'red' ? 'error' : 'warning'}
          >
            {record.risk_flags.length} flag{record.risk_flags.length !== 1 ? 's' : ''}
          </Tag>
        );
      },
    },
    {
      title: 'Last Updated',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 120,
      render: (d: string) => new Date(d).toLocaleDateString('en-IN'),
      sorter: (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
    },
  ];

  const { summary } = data;

  return (
    <div>
      <Title level={3} style={{ marginBottom: SPACING.xl, color: COLORS.textPrimary }}>
        Approval Dashboard
      </Title>

      <Row gutter={[16, 16]} style={{ marginBottom: SPACING.xl }}>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="Total Cycles"
            value={summary.totalCycles}
            icon={<FileProtectOutlined />}
            size="compact"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="Pending Approval"
            value={summary.pendingApproval}
            icon={<ClockCircleOutlined />}
            color={COLORS.warning}
            size="compact"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="Approved"
            value={summary.approved}
            icon={<CheckCircleOutlined />}
            color={COLORS.success}
            size="compact"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="Filling"
            value={summary.filling}
            icon={<EditOutlined />}
            size="compact"
          />
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={data.brands}
        rowKey="cycle_id"
        onRow={(record) => ({
          onClick: () => router.push(`/cycles/${record.cycle_id}/grid`),
          style: { cursor: 'pointer' },
        })}
        pagination={false}
        scroll={{ x: 1000 }}
      />
    </div>
  );
}
