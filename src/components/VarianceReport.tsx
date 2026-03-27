'use client';

import { useState, useMemo } from 'react';
import { Card, Row, Col, Table, Tabs, Select, Space, Statistic, Typography } from 'antd';
import { CheckCircleOutlined, WarningOutlined, CloseCircleOutlined, BarChartOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { VarianceReportData, VarianceRow, VarianceMetric, VarianceLevel } from '@/types/otb';

const { Title, Text } = Typography;

const LEVEL_COLORS: Record<VarianceLevel, string> = {
  green: '#52c41a',
  yellow: '#faad14',
  red: '#ff4d4f',
};

function formatVarianceValue(value: number | null): string {
  if (value == null) return '-';
  return value.toLocaleString('en-IN');
}

function VarianceCell({ metric }: { metric: VarianceMetric }) {
  const color = LEVEL_COLORS[metric.level];
  const variancePct = metric.variance_pct != null ? metric.variance_pct.toFixed(1) : '-';

  return (
    <div>
      <span style={{ color, fontWeight: 600, fontSize: 14 }}>
        {variancePct}%
      </span>
      <div style={{ fontSize: 11, color: '#999', lineHeight: 1.3, marginTop: 2 }}>
        P: {formatVarianceValue(metric.planned)} / A: {formatVarianceValue(metric.actual)}
      </div>
    </div>
  );
}

function shortMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
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
    if (selectedMonth) {
      rows = rows.filter(r => r.month === selectedMonth);
    }
    if (selectedSubCategory) {
      rows = rows.filter(r => r.sub_category === selectedSubCategory);
    }
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
    {
      title: 'Sub Category',
      dataIndex: 'sub_category',
      key: 'sub_category',
      width: 130,
      sorter: (a, b) => a.sub_category.localeCompare(b.sub_category),
    },
    {
      title: 'Gender',
      dataIndex: 'gender',
      key: 'gender',
      width: 90,
    },
    {
      title: 'Channel',
      dataIndex: 'channel',
      key: 'channel',
      width: 100,
    },
    {
      title: 'Month',
      dataIndex: 'month',
      key: 'month',
      width: 90,
      render: (m: string) => shortMonth(m),
      sorter: (a, b) => a.month.localeCompare(b.month),
    },
    {
      title: 'NSQ Var%',
      key: 'nsq',
      width: 130,
      render: (_, record) => <VarianceCell metric={record.nsq} />,
      sorter: (a, b) => (a.nsq.variance_pct ?? 0) - (b.nsq.variance_pct ?? 0),
      align: 'right',
    },
    {
      title: 'GMV Var%',
      key: 'gmv',
      width: 130,
      render: (_, record) => <VarianceCell metric={record.gmv} />,
      sorter: (a, b) => (a.gmv.variance_pct ?? 0) - (b.gmv.variance_pct ?? 0),
      align: 'right',
    },
    {
      title: 'Inwards Var%',
      key: 'inwards',
      width: 130,
      render: (_, record) => <VarianceCell metric={record.inwards} />,
      sorter: (a, b) => (a.inwards.variance_pct ?? 0) - (b.inwards.variance_pct ?? 0),
      align: 'right',
    },
    {
      title: 'Closing Stock Var%',
      key: 'closing_stock',
      width: 150,
      render: (_, record) => <VarianceCell metric={record.closing_stock} />,
      sorter: (a, b) => (a.closing_stock.variance_pct ?? 0) - (b.closing_stock.variance_pct ?? 0),
      align: 'right',
    },
  ];

  const { summary } = data;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>
          <BarChartOutlined style={{ marginRight: 8 }} />
          Variance Report
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {data.cycle_name} &middot; {data.brand_name} &middot; {data.planning_quarter}
        </Text>
      </div>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Total Rows"
              value={summary.total_rows}
              valueStyle={{ fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Within Threshold"
              value={summary.green_count}
              valueStyle={{ color: '#52c41a', fontSize: 28 }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Near Threshold"
              value={summary.yellow_count}
              valueStyle={{ color: '#faad14', fontSize: 28 }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Exceeds Threshold"
              value={summary.red_count}
              valueStyle={{ color: '#ff4d4f', fontSize: 28 }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 20, borderRadius: 8 }}>
        <Space size="large">
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Month</Text>
            <Select
              style={{ width: 180 }}
              placeholder="All Months"
              allowClear
              value={selectedMonth}
              onChange={setSelectedMonth}
              options={[
                ...data.months.map(m => ({ label: shortMonth(m), value: m })),
              ]}
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

      {/* Tabs: All Variances / Top 10 */}
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
                scroll={{ x: 1200 }}
              />
            ),
          },
          {
            key: 'top10',
            label: 'Top 10 Variances',
            children: (
              <Table
                columns={varianceColumns}
                dataSource={summary.top_variances}
                rowKey={(r) => `top-${r.sub_brand}-${r.sub_category}-${r.gender}-${r.channel}-${r.month}`}
                pagination={false}
                size="middle"
                scroll={{ x: 1200 }}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
