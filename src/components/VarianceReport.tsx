'use client';

import { useState, useMemo } from 'react';
import { Row, Col, Table, Tabs, Select, Space, Typography, Card, Tag } from 'antd';
import { CheckCircleOutlined, WarningOutlined, CloseCircleOutlined, BarChartOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { MetricCard } from '@/components/ui/MetricCard';
import { VarianceBadge } from '@/components/ui/VarianceBadge';
import { COLORS, CARD_STYLES, SPACING } from '@/lib/designTokens';
import type { ColumnsType } from 'antd/es/table';
import type { VarianceReportData, VarianceRow, VarianceMetric, VarianceLevel } from '@/types/otb';

const { Title, Text } = Typography;

function formatVarianceValue(value: number | null): string {
  if (value == null) return '-';
  return value.toLocaleString('en-IN');
}

function VarianceCell({ metric }: { metric: VarianceMetric }) {
  return (
    <div>
      <VarianceBadge value={metric.variance_pct} level={metric.level} />
      <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.3, marginTop: 3 }}>
        P: {formatVarianceValue(metric.planned)} / A: {formatVarianceValue(metric.actual)}
      </div>
    </div>
  );
}

function shortMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
}

function getImpactLevel(row: VarianceRow): { label: string; color: string } {
  const maxVar = Math.max(
    Math.abs(row.nsq.variance_pct ?? 0),
    Math.abs(row.gmv.variance_pct ?? 0),
    Math.abs(row.inwards.variance_pct ?? 0),
    Math.abs(row.closing_stock.variance_pct ?? 0),
  );
  if (maxVar >= 30) return { label: 'High', color: 'error' };
  if (maxVar >= 15) return { label: 'Medium', color: 'warning' };
  return { label: 'Low', color: 'success' };
}

interface Props {
  data: VarianceReportData;
}

export function VarianceReport({ data }: Props) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);

  const subCategories = useMemo(() => {
    const set = new Set<string>();
    data.rows.forEach(r => set.add(r.sub_category));
    return Array.from(set).sort();
  }, [data.rows]);

  const filteredRows = useMemo(() => {
    let rows = data.rows;
    if (selectedMonth) rows = rows.filter(r => r.month === selectedMonth);
    if (selectedSubCategory) rows = rows.filter(r => r.sub_category === selectedSubCategory);
    return rows;
  }, [data.rows, selectedMonth, selectedSubCategory]);

  const varianceColumns: ColumnsType<VarianceRow> = [
    {
      title: 'Sub Brand',
      dataIndex: 'sub_brand',
      key: 'sub_brand',
      width: 120,
      sorter: (a, b) => a.sub_brand.localeCompare(b.sub_brand),
      render: (v: string) => <Text strong>{v}</Text>,
    },
    { title: 'Sub Category', dataIndex: 'sub_category', key: 'sub_category', width: 130, sorter: (a, b) => a.sub_category.localeCompare(b.sub_category) },
    { title: 'Gender', dataIndex: 'gender', key: 'gender', width: 90 },
    { title: 'Channel', dataIndex: 'channel', key: 'channel', width: 100 },
    { title: 'Month', dataIndex: 'month', key: 'month', width: 90, render: (m: string) => shortMonth(m), sorter: (a, b) => a.month.localeCompare(b.month) },
    {
      title: 'NSQ Var%', key: 'nsq', width: 130,
      render: (_, record) => <VarianceCell metric={record.nsq} />,
      sorter: (a, b) => (a.nsq.variance_pct ?? 0) - (b.nsq.variance_pct ?? 0),
      align: 'right',
    },
    {
      title: 'GMV Var%', key: 'gmv', width: 130,
      render: (_, record) => <VarianceCell metric={record.gmv} />,
      sorter: (a, b) => (a.gmv.variance_pct ?? 0) - (b.gmv.variance_pct ?? 0),
      align: 'right',
    },
    {
      title: 'Inwards Var%', key: 'inwards', width: 130,
      render: (_, record) => <VarianceCell metric={record.inwards} />,
      sorter: (a, b) => (a.inwards.variance_pct ?? 0) - (b.inwards.variance_pct ?? 0),
      align: 'right',
    },
    {
      title: 'Closing Stock Var%', key: 'closing_stock', width: 150,
      render: (_, record) => <VarianceCell metric={record.closing_stock} />,
      sorter: (a, b) => (a.closing_stock.variance_pct ?? 0) - (b.closing_stock.variance_pct ?? 0),
      align: 'right',
    },
    {
      title: 'Impact', key: 'impact', width: 90, align: 'center',
      render: (_, record) => {
        const impact = getImpactLevel(record);
        return <Tag color={impact.color}>{impact.label}</Tag>;
      },
      sorter: (a, b) => {
        const aMax = Math.max(Math.abs(a.nsq.variance_pct ?? 0), Math.abs(a.gmv.variance_pct ?? 0));
        const bMax = Math.max(Math.abs(b.nsq.variance_pct ?? 0), Math.abs(b.gmv.variance_pct ?? 0));
        return aMax - bMax;
      },
    },
  ];

  // Derive summary counts from rows (VarianceReportData no longer carries a summary field)
  const greenCount = data.rows.filter(r => [r.nsq, r.gmv, r.nsv, r.inwards, r.closing_stock, r.doh].every(m => m.level !== 'red' && m.level !== 'yellow')).length;
  const redCount = data.rows.filter(r => [r.nsq, r.gmv, r.nsv, r.inwards, r.closing_stock, r.doh].some(m => m.level === 'red')).length;
  const yellowCount = data.rows.length - redCount - greenCount;
  const total = data.rows.length;
  // Top 10 by worst absolute variance
  const top10 = [...data.rows]
    .sort((a, b) => {
      const aMax = Math.max(...[a.nsq, a.gmv, a.nsv, a.inwards, a.closing_stock, a.doh].map(m => Math.abs(m.variance_pct ?? 0)));
      const bMax = Math.max(...[b.nsq, b.gmv, b.nsv, b.inwards, b.closing_stock, b.doh].map(m => Math.abs(m.variance_pct ?? 0)));
      return bMax - aMax;
    })
    .slice(0, 10);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: SPACING.xl }}>
        <Title level={3} style={{ margin: 0, color: COLORS.textPrimary }}>
          <BarChartOutlined style={{ marginRight: 8 }} />
          Variance Report
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {data.cycle_name} &middot; {data.brand_name} &middot; {data.planning_quarter}
        </Text>
      </div>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: SPACING.lg }}>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard title="Total Rows" value={total} icon={<UnorderedListOutlined />} size="compact" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard title="Within Threshold" value={greenCount} icon={<CheckCircleOutlined />} color={COLORS.success} size="compact" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard title="Near Threshold" value={yellowCount} icon={<WarningOutlined />} color={COLORS.warning} size="compact" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard title="Exceeds Threshold" value={redCount} icon={<CloseCircleOutlined />} color={COLORS.danger} size="compact" />
        </Col>
      </Row>

      {/* Severity Distribution Bar */}
      {total > 0 && (
        <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: SPACING.xl }}>
          <div style={{ width: `${(greenCount / total) * 100}%`, background: COLORS.success }} />
          <div style={{ width: `${(yellowCount / total) * 100}%`, background: COLORS.warning }} />
          <div style={{ width: `${(redCount / total) * 100}%`, background: COLORS.danger }} />
        </div>
      )}

      {/* Filters */}
      <Card size="small" style={{ ...CARD_STYLES, marginBottom: SPACING.xl }}>
        <Space size="large">
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Month</Text>
            <Select
              style={{ width: 180 }}
              placeholder="All Months"
              allowClear
              value={selectedMonth}
              onChange={setSelectedMonth}
              options={data.actuals_months.map(m => ({ label: shortMonth(m), value: m }))}
            />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Sub Category</Text>
            <Select
              style={{ width: 200 }}
              placeholder="All Sub Categories"
              allowClear
              value={selectedSubCategory}
              onChange={setSelectedSubCategory}
              options={subCategories.map(sc => ({ label: sc, value: sc }))}
            />
          </div>
        </Space>
      </Card>

      {/* Tabs */}
      <Tabs
        defaultActiveKey="all"
        items={[
          {
            key: 'all',
            label: `All Variances (${filteredRows.length})`,
            children: (
              <Table
                columns={varianceColumns}
                dataSource={filteredRows}
                rowKey={(r) => `${r.sub_brand}-${r.sub_category}-${r.gender}-${r.channel}-${r.month}`}
                pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: ['25', '50', '100'] }}
                size="middle"
                scroll={{ x: 1300 }}
                rowClassName={(_, index) => index % 2 === 0 ? '' : 'ant-table-row-alt'}
              />
            ),
          },
          {
            key: 'top10',
            label: 'Top 10 Variances',
            children: (
              <Table
                columns={varianceColumns}
                dataSource={top10}
                rowKey={(r) => `top-${r.sub_brand}-${r.sub_category}-${r.gender}-${r.channel}-${r.month}`}
                pagination={false}
                size="middle"
                scroll={{ x: 1300 }}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
