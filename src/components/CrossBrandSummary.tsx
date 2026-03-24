'use client';

import { useEffect, useState } from 'react';
import { Card, Row, Col, Table, Typography, Spin, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

interface BrandMetrics {
  brand_id: string;
  brand_name: string;
  cycle_name: string;
  status: string;
  nsr: number;
  cogs: number;
  gmPct: number;
  inwardsQty: number;
  avgDoh: number;
}

interface SummaryData {
  totals: { nsr: number; cogs: number; gmPct: number; inwardsQty: number; avgDoh: number };
  brands: BrandMetrics[];
  months: string[];
}

function formatCrore(value: number): string {
  if (value === 0) return '0';
  return `${(value / 10000000).toFixed(2)} Cr`;
}

function formatQty(value: number): string {
  if (value === 0) return '0';
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

export function CrossBrandSummary() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/summary')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!data) return <Text type="danger">Failed to load summary</Text>;

  const { totals, brands } = data;

  const columns: ColumnsType<BrandMetrics> = [
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
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={s === 'Approved' ? 'success' : 'processing'}>{s}</Tag>,
    },
    {
      title: 'NSR',
      dataIndex: 'nsr',
      key: 'nsr',
      render: (v: number) => formatCrore(v),
      sorter: (a, b) => a.nsr - b.nsr,
      align: 'right',
    },
    {
      title: 'COGS',
      dataIndex: 'cogs',
      key: 'cogs',
      render: (v: number) => formatCrore(v),
      sorter: (a, b) => a.cogs - b.cogs,
      align: 'right',
    },
    {
      title: 'GM%',
      dataIndex: 'gmPct',
      key: 'gmPct',
      render: (v: number) => `${(v * 100).toFixed(1)}%`,
      sorter: (a, b) => a.gmPct - b.gmPct,
      align: 'right',
    },
    {
      title: 'Inwards Qty',
      dataIndex: 'inwardsQty',
      key: 'inwardsQty',
      render: (v: number) => formatQty(v),
      sorter: (a, b) => a.inwardsQty - b.inwardsQty,
      align: 'right',
    },
    {
      title: 'Avg DoH',
      dataIndex: 'avgDoh',
      key: 'avgDoh',
      render: (v: number) => `${v.toFixed(0)} days`,
      sorter: (a, b) => a.avgDoh - b.avgDoh,
      align: 'right',
    },
  ];

  return (
    <div>
      <Title level={3}>Cross-Brand Summary</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={4}>
          <Card size="small">
            <Text type="secondary">Total NSR</Text>
            <Title level={4} style={{ margin: '4px 0 0' }}>{formatCrore(totals.nsr)}</Title>
          </Card>
        </Col>
        <Col xs={24} sm={4}>
          <Card size="small">
            <Text type="secondary">Total COGS</Text>
            <Title level={4} style={{ margin: '4px 0 0' }}>{formatCrore(totals.cogs)}</Title>
          </Card>
        </Col>
        <Col xs={24} sm={4}>
          <Card size="small">
            <Text type="secondary">Avg GM%</Text>
            <Title level={4} style={{ margin: '4px 0 0' }}>{(totals.gmPct * 100).toFixed(1)}%</Title>
          </Card>
        </Col>
        <Col xs={24} sm={4}>
          <Card size="small">
            <Text type="secondary">Total Inwards</Text>
            <Title level={4} style={{ margin: '4px 0 0' }}>{formatQty(totals.inwardsQty)}</Title>
          </Card>
        </Col>
        <Col xs={24} sm={4}>
          <Card size="small">
            <Text type="secondary">Avg DoH</Text>
            <Title level={4} style={{ margin: '4px 0 0' }}>{totals.avgDoh.toFixed(0)} days</Title>
          </Card>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={brands}
        rowKey="brand_id"
        pagination={false}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0}><Text strong>Total</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={1} />
            <Table.Summary.Cell index={2} />
            <Table.Summary.Cell index={3} align="right"><Text strong>{formatCrore(totals.nsr)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="right"><Text strong>{formatCrore(totals.cogs)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={5} align="right"><Text strong>{(totals.gmPct * 100).toFixed(1)}%</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={6} align="right"><Text strong>{formatQty(totals.inwardsQty)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={7} align="right"><Text strong>{totals.avgDoh.toFixed(0)} days</Text></Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
    </div>
  );
}
