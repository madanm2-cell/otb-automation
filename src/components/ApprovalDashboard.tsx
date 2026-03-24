'use client';

import { useEffect, useState } from 'react';
import { Card, Row, Col, Table, Tag, Typography, Spin, Space, Progress } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, EditOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
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

const STATUS_TAG: Record<string, { color: string; icon: React.ReactNode }> = {
  InReview: { color: 'processing', icon: <ClockCircleOutlined /> },
  Approved: { color: 'success', icon: <CheckCircleOutlined /> },
  Filling: { color: 'default', icon: <EditOutlined /> },
};

export function ApprovalDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/approvals/dashboard')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!data) return <Text type="danger">Failed to load dashboard</Text>;

  const columns: ColumnsType<BrandSummary> = [
    {
      title: 'Brand',
      dataIndex: 'brand_name',
      key: 'brand_name',
      sorter: (a, b) => a.brand_name.localeCompare(b.brand_name),
    },
    {
      title: 'Cycle',
      dataIndex: 'cycle_name',
      key: 'cycle_name',
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
      render: (status: string) => {
        const cfg = STATUS_TAG[status] || STATUS_TAG.Filling;
        return <Tag icon={cfg.icon} color={cfg.color}>{status}</Tag>;
      },
      filters: [
        { text: 'InReview', value: 'InReview' },
        { text: 'Approved', value: 'Approved' },
        { text: 'Filling', value: 'Filling' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Approval Progress',
      key: 'progress',
      render: (_, record) => {
        const { approved, total } = record.approval_progress;
        return (
          <Space>
            <Progress
              percent={(approved / total) * 100}
              steps={4}
              size="small"
              strokeColor="#52c41a"
            />
            <Text type="secondary">{approved}/{total}</Text>
          </Space>
        );
      },
    },
    {
      title: 'Risk',
      key: 'risk',
      render: (_, record) => {
        if (!record.risk_level) return <Tag>OK</Tag>;
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
      render: (d: string) => new Date(d).toLocaleDateString(),
      sorter: (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
    },
  ];

  const { summary } = data;

  return (
    <div>
      <Title level={3}>Approval Dashboard</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6}>
          <Card>
            <Text type="secondary">Total Cycles</Text>
            <Title level={2} style={{ margin: '8px 0 0' }}>{summary.totalCycles}</Title>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Text type="secondary">Pending Approval</Text>
            <Title level={2} style={{ margin: '8px 0 0', color: '#faad14' }}>{summary.pendingApproval}</Title>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Text type="secondary">Approved</Text>
            <Title level={2} style={{ margin: '8px 0 0', color: '#52c41a' }}>{summary.approved}</Title>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Text type="secondary">Filling</Text>
            <Title level={2} style={{ margin: '8px 0 0' }}>{summary.filling}</Title>
          </Card>
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
      />
    </div>
  );
}
