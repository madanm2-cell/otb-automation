'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Typography, Row, Col, Card, Table, Tag, Badge, Statistic,
  Button, Empty, Alert, Space,
} from 'antd';
import {
  DollarOutlined, PercentageOutlined, ClockCircleOutlined,
  ThunderboltOutlined, CheckCircleOutlined, ReloadOutlined,
  RightOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardData } from '@/hooks/useDashboardData';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusPipeline } from '@/components/ui/StatusPipeline';
import type { PipelineStage } from '@/components/ui/StatusPipeline';
import { VarianceBadge } from '@/components/ui/VarianceBadge';
import { DashboardSkeleton } from '@/components/ui/PageSkeleton';
import { COLORS, CARD_STYLES, SPACING, STATUS_TAG_COLORS } from '@/lib/designTokens';
import { formatCrore, formatPct, formatQty } from '@/lib/formatting';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

function getCurrentQuarter(): string {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  // Indian FY: Apr=Q1, Jul=Q2, Oct=Q3, Jan=Q4
  const fyYear = month >= 3 ? now.getFullYear() + 1 : now.getFullYear();
  const q = month >= 3 ? Math.ceil((month - 2) / 3) : 4;
  return `Q${q} FY${String(fyYear).slice(-2)}`;
}

export default function CxoDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const dashboard = useDashboardData();

  // GDs redirect to cycles
  useEffect(() => {
    if (profile?.role === 'GD') {
      router.replace('/cycles');
    }
  }, [profile, router]);

  if (profile?.role === 'GD') return null;

  if (dashboard.loading) return <DashboardSkeleton />;

  if (dashboard.error) {
    return (
      <Alert
        type="error"
        message="Failed to load dashboard"
        description={dashboard.error}
        action={<Button onClick={dashboard.refresh}>Retry</Button>}
      />
    );
  }

  const { approvals, kpiTotals, reviewBrands, approvedBrands, cycles, statusDistribution } = dashboard;

  // Derive legacy values from new hook shape for existing UI
  const activeCycleCount = (statusDistribution.Filling || 0) + (statusDistribution.InReview || 0);
  const totalCycles = cycles?.length || 0;
  const approvedCount = statusDistribution.Approved || 0;
  const overallApprovalRate = totalCycles > 0 ? (approvedCount / totalCycles) * 100 : 0;

  // Map new brand data into legacy table format
  const allBrands = [...reviewBrands, ...approvedBrands];
  const brandTableData = allBrands.map(b => ({
    brand_id: b.brand_id,
    brand_name: b.brand_name,
    nsr: b.nsv,
    gmPct: b.nsv > 0 ? ((b.gmv - b.nsv) / b.gmv) * 100 : 0,
    inwardsQty: b.inwards_qty,
    avgDoh: b.avg_doh,
    status: b.status,
  }));

  // Approval pipeline stages for aggregate view
  const buildApprovalStages = (): PipelineStage[] => {
    const summary = approvals?.summary;
    if (!summary) return [];
    return [
      { key: 'filling', label: `Filling (${summary.filling})`, status: summary.filling > 0 ? 'active' : 'completed' },
      { key: 'review', label: `In Review (${summary.pendingApproval})`, status: summary.pendingApproval > 0 ? 'active' : summary.approved > 0 ? 'completed' : 'pending' },
      { key: 'approved', label: `Approved (${summary.approved})`, status: summary.approved > 0 ? 'completed' : 'pending' },
    ];
  };

  // Brand performance table columns
  const brandColumns: ColumnsType<any> = [
    { title: 'Brand', dataIndex: 'brand_name', key: 'brand', width: 140, render: (v: string) => <Text strong>{v}</Text> },
    { title: 'NSR', dataIndex: 'nsr', key: 'nsr', width: 110, align: 'right', render: (v: number) => formatCrore(v), sorter: (a: any, b: any) => a.nsr - b.nsr },
    {
      title: 'GM%', dataIndex: 'gmPct', key: 'gm', width: 100, align: 'right',
      render: (v: number) => (
        <Text style={{ color: v >= 40 ? COLORS.success : v >= 30 ? COLORS.warning : COLORS.danger, fontWeight: 600 }}>
          {formatPct(v)}
        </Text>
      ),
      sorter: (a: any, b: any) => a.gmPct - b.gmPct,
    },
    { title: 'Inwards', dataIndex: 'inwardsQty', key: 'inw', width: 110, align: 'right', render: (v: number) => formatQty(v) },
    {
      title: 'DoH', dataIndex: 'avgDoh', key: 'doh', width: 80, align: 'right',
      render: (v: number) => (
        <Text style={{ color: v <= 45 ? COLORS.success : v <= 60 ? COLORS.warning : COLORS.danger, fontWeight: 600 }}>
          {v ? Math.round(v) : '-'}
        </Text>
      ),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: (v: string) => <Tag color={STATUS_TAG_COLORS[v] || 'default'}>{v}</Tag>,
    },
  ];

  // Approval cycles table columns
  const approvalColumns: ColumnsType<any> = [
    { title: 'Brand', dataIndex: 'brand_name', key: 'brand', width: 120 },
    { title: 'Cycle', dataIndex: 'cycle_name', key: 'cycle', width: 160 },
    { title: 'Quarter', dataIndex: 'planning_quarter', key: 'q', width: 90 },
    {
      title: 'Progress', key: 'progress', width: 160,
      render: (_: any, record: any) => {
        const p = record.approval_progress;
        return (
          <Space size={4}>
            {['Planning', 'GD', 'Finance', 'CXO'].map(role => {
              const isApproved = p.approved > (['Planning', 'GD', 'Finance', 'CXO'].indexOf(role));
              return (
                <Badge
                  key={role}
                  status={isApproved ? 'success' : 'default'}
                  text={<Text style={{ fontSize: 11 }}>{role}</Text>}
                />
              );
            })}
          </Space>
        );
      },
    },
    {
      title: 'Risk', key: 'risk', width: 80,
      render: (_: any, record: any) => {
        const level = record.risk_level;
        if (level === 'red') return <Tag color="error"><ExclamationCircleOutlined /> High</Tag>;
        if (level === 'yellow') return <Tag color="warning">Medium</Tag>;
        return <Tag color="success">OK</Tag>;
      },
    },
  ];

  // Recent cycles table
  const recentCycles = (cycles || []).slice(0, 5);
  const cycleColumns: ColumnsType<any> = [
    { title: 'Cycle', dataIndex: 'cycle_name', key: 'name', render: (v: string, r: any) => <a onClick={() => router.push(`/cycles/${r.id}`)}>{v}</a> },
    { title: 'Brand', key: 'brand', render: (_: any, r: any) => r.brands?.name || '-' },
    { title: 'Quarter', dataIndex: 'planning_quarter', key: 'q', width: 100 },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 100, render: (v: string) => <Tag color={STATUS_TAG_COLORS[v] || 'default'}>{v}</Tag> },
  ];

  const inReviewCycles = (approvals?.brands || []).filter(b => b.status === 'InReview');

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.xl }}>
        <div>
          <Title level={3} style={{ margin: 0, color: COLORS.textPrimary }}>Executive Dashboard</Title>
          <Text type="secondary">{getCurrentQuarter()} Overview</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={dashboard.refresh}>Refresh</Button>
      </div>

      {/* KPI Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: SPACING.xl }}>
        <Col xs={24} sm={12} lg={5}>
          <MetricCard
            title="Total NSV"
            value={kpiTotals?.nsv ? formatCrore(kpiTotals.nsv) : '0 Cr'}
            icon={<DollarOutlined />}
            color={COLORS.info}
          />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <MetricCard
            title="Total GMV"
            value={kpiTotals?.gmv ? formatCrore(kpiTotals.gmv) : '-'}
            icon={<PercentageOutlined />}
            color={COLORS.success}
          />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <MetricCard
            title="Avg Days on Hand"
            value={kpiTotals?.avg_doh ? Math.round(kpiTotals.avg_doh) : '-'}
            icon={<ClockCircleOutlined />}
            color={(kpiTotals?.avg_doh ?? 99) <= 45 ? COLORS.success : (kpiTotals?.avg_doh ?? 99) <= 60 ? COLORS.warning : COLORS.danger}
          />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <MetricCard
            title="Active Cycles"
            value={activeCycleCount}
            icon={<ThunderboltOutlined />}
            color={COLORS.accent}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard
            title="Approval Rate"
            value={`${overallApprovalRate.toFixed(0)}%`}
            icon={<CheckCircleOutlined />}
            color={COLORS.success}
          />
        </Col>
      </Row>

      {/* Approval Pipeline */}
      {approvals && (approvals.summary.pendingApproval > 0 || approvals.summary.filling > 0) && (
        <Card
          title={<Text strong style={{ fontSize: 16 }}>Approval Pipeline</Text>}
          style={{ ...CARD_STYLES, marginBottom: SPACING.xl }}
          styles={{ body: { padding: SPACING.xl } }}
        >
          <div style={{ marginBottom: SPACING.xl }}>
            <StatusPipeline stages={buildApprovalStages()} />
          </div>
          {inReviewCycles.length > 0 && (
            <Table
              dataSource={inReviewCycles}
              columns={approvalColumns}
              rowKey="cycle_id"
              pagination={false}
              size="small"
              onRow={(record) => ({
                style: { cursor: 'pointer' },
                onClick: () => router.push(`/cycles/${record.cycle_id}`),
              })}
            />
          )}
        </Card>
      )}

      {/* Two-column: Brand Performance + Variance Alerts */}
      <Row gutter={[24, 24]} style={{ marginBottom: SPACING.xl }}>
        <Col xs={24} lg={14}>
          <Card
            title={<Text strong style={{ fontSize: 16 }}>Brand Performance</Text>}
            extra={<Button type="link" onClick={() => router.push('/summary')}>View Details <RightOutlined /></Button>}
            style={CARD_STYLES}
          >
            {brandTableData.length > 0 ? (
              <Table
                dataSource={brandTableData}
                columns={brandColumns}
                rowKey="brand_id"
                pagination={false}
                size="small"
                summary={() => {
                  if (!kpiTotals) return null;
                  return (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0}><Text strong>Total</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right"><Text strong>{formatCrore(kpiTotals.nsv)}</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right"><Text strong>-</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right"><Text strong>{formatQty(kpiTotals.inwards_qty)}</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={4} align="right"><Text strong>{kpiTotals.avg_doh ? Math.round(kpiTotals.avg_doh) : '-'}</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={5} />
                    </Table.Summary.Row>
                  );
                }}
              />
            ) : (
              <Empty description="No plan data available yet" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title={<Text strong style={{ fontSize: 16 }}>Variance Alerts</Text>}
            style={CARD_STYLES}
          >
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span>
                  <Text type="secondary">No actuals uploaded yet.</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>Upload actuals in a cycle to see variance alerts here.</Text>
                </span>
              }
            />
          </Card>
        </Col>
      </Row>

      {/* Cycles Overview */}
      <Card
        title={<Text strong style={{ fontSize: 16 }}>Cycle Status Overview</Text>}
        extra={<Button type="link" onClick={() => router.push('/cycles')}>View All Cycles <RightOutlined /></Button>}
        style={CARD_STYLES}
      >
        {/* Status distribution */}
        <div style={{ display: 'flex', gap: SPACING.xxl, marginBottom: SPACING.xl, flexWrap: 'wrap' }}>
          {(['Draft', 'Filling', 'InReview', 'Approved'] as const).map(status => (
            <Statistic
              key={status}
              title={<span style={{ fontSize: 12, color: COLORS.textMuted }}>{status === 'InReview' ? 'In Review' : status}</span>}
              value={statusDistribution[status]}
              valueStyle={{ fontSize: 24, fontWeight: 700, color: status === 'Approved' ? COLORS.success : status === 'InReview' ? COLORS.accent : status === 'Filling' ? COLORS.warning : COLORS.textSecondary }}
            />
          ))}
        </div>

        {recentCycles.length > 0 ? (
          <Table
            dataSource={recentCycles}
            columns={cycleColumns}
            rowKey="id"
            pagination={false}
            size="small"
            onRow={(record) => ({
              style: { cursor: 'pointer' },
              onClick: () => router.push(`/cycles/${record.id}`),
            })}
          />
        ) : (
          <Empty description="No cycles created yet" />
        )}
      </Card>
    </div>
  );
}
