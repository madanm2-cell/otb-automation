'use client';

import { useEffect, useState } from 'react';
import { Row, Col, Table, Typography, Skeleton, Alert } from 'antd';
import {
  DollarOutlined, ShoppingCartOutlined, BarChartOutlined,
  InboxOutlined, ClockCircleOutlined, DatabaseOutlined,
} from '@ant-design/icons';
import { MetricCard } from '@/components/ui/MetricCard';
import { COLORS, SPACING } from '@/lib/designTokens';
import { formatCrore, formatQty } from '@/lib/formatting';
import type { BrandMonthBreakdown, CategoryBreakdown } from '@/types/otb';

const { Text } = Typography;

interface CycleSummary {
  gmv: number;
  nsv: number;
  nsq: number;
  inwards_qty: number;
  avg_doh: number;
  closing_stock_qty: number;
  monthly: BrandMonthBreakdown[];
  top_categories: CategoryBreakdown[];
}

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr);
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
}

const SECTION_LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: COLORS.textMuted,
  marginBottom: SPACING.sm,
};

const monthlyColumns = [
  { title: 'Month', dataIndex: 'month', key: 'month', render: (v: string) => formatMonth(v) },
  { title: 'GMV', dataIndex: 'gmv', key: 'gmv', render: (v: number) => formatCrore(v) },
  { title: 'NSV', dataIndex: 'nsv', key: 'nsv', render: (v: number) => formatCrore(v) },
  { title: 'NSQ', dataIndex: 'nsq', key: 'nsq', render: (v: number) => formatQty(v) },
  { title: 'Inwards', dataIndex: 'inwards_qty', key: 'inwards_qty', render: (v: number) => formatQty(v) },
  { title: 'Closing Stock', dataIndex: 'closing_stock_qty', key: 'closing_stock_qty', render: (v: number) => formatQty(v) },
  { title: 'DoH', dataIndex: 'avg_doh', key: 'avg_doh', render: (v: number) => String(Math.round(v)) },
];

const categoryColumns = [
  { title: 'Sub-Category', dataIndex: 'sub_category', key: 'sub_category' },
  { title: 'GMV', dataIndex: 'gmv', key: 'gmv', render: (v: number) => formatCrore(v) },
  { title: 'NSQ', dataIndex: 'nsq', key: 'nsq', render: (v: number) => formatQty(v) },
  { title: 'Inwards', dataIndex: 'inwards_qty', key: 'inwards_qty', render: (v: number) => formatQty(v) },
  { title: 'GMV Share', dataIndex: 'pct_of_total', key: 'pct_of_total', render: (v: number) => `${v.toFixed(1)}%` },
];

export function ReviewSummary({ cycleId }: { cycleId: string }) {
  const [summary, setSummary] = useState<CycleSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/cycles/${cycleId}/summary`)
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error || `Failed to load summary (${res.status})`);
        }
        return res.json() as Promise<CycleSummary>;
      })
      .then(setSummary)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [cycleId]);

  if (loading) return <Skeleton active paragraph={{ rows: 4 }} style={{ marginBottom: SPACING.xl }} />;
  if (error) return <Alert type="error" message={error} showIcon style={{ marginBottom: SPACING.xl }} />;
  if (!summary) return null;

  const dohColor = !summary.avg_doh ? COLORS.neutral600
    : summary.avg_doh <= 45 ? COLORS.success
    : summary.avg_doh <= 60 ? COLORS.warning
    : COLORS.danger;

  return (
    <div style={{ marginBottom: SPACING.xl }}>
      <Row gutter={[16, 16]} style={{ marginBottom: SPACING.xl }}>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard title="GMV" value={formatCrore(summary.gmv)} icon={<DollarOutlined />} color={COLORS.info} size="compact" />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard title="NSV" value={formatCrore(summary.nsv)} icon={<ShoppingCartOutlined />} color={COLORS.accent} size="compact" />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard title="NSQ" value={formatQty(summary.nsq)} icon={<BarChartOutlined />} color={COLORS.success} size="compact" />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard title="Inwards" value={formatQty(summary.inwards_qty)} icon={<InboxOutlined />} color={COLORS.warning} size="compact" />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard title="Avg DoH" value={summary.avg_doh ? Math.round(summary.avg_doh) : '-'} icon={<ClockCircleOutlined />} color={dohColor} size="compact" />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard title="Closing Stock" value={formatQty(summary.closing_stock_qty)} icon={<DatabaseOutlined />} color={COLORS.neutral600} size="compact" />
        </Col>
      </Row>

      {summary.monthly.length > 0 && (
        <div style={{ marginBottom: SPACING.xl }}>
          <Text style={SECTION_LABEL}>Monthly Breakdown</Text>
          <Table
            dataSource={summary.monthly}
            columns={monthlyColumns}
            rowKey="month"
            size="small"
            pagination={false}
          />
        </div>
      )}

      {summary.top_categories.length > 0 && (
        <div style={{ marginBottom: SPACING.xl }}>
          <Text style={SECTION_LABEL}>Sub-Categories by GMV</Text>
          <Table
            dataSource={summary.top_categories}
            columns={categoryColumns}
            rowKey="sub_category"
            size="small"
            pagination={false}
          />
        </div>
      )}
    </div>
  );
}
