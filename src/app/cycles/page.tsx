'use client';

import { useEffect, useState } from 'react';
import { Table, Button, Tag, Space, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import Link from 'next/link';
import type { OtbCycle } from '@/types/otb';

const { Title } = Typography;

const STATUS_COLORS: Record<string, string> = {
  Draft: 'default',
  Active: 'blue',
  Filling: 'orange',
  InReview: 'purple',
  Approved: 'green',
};

export default function CyclesPage() {
  const [cycles, setCycles] = useState<OtbCycle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/cycles')
      .then(r => r.json())
      .then(data => {
        setCycles(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const columns = [
    {
      title: 'Cycle Name',
      dataIndex: 'cycle_name',
      key: 'cycle_name',
      render: (text: string, record: OtbCycle) => (
        <Link href={`/cycles/${record.id}`}>{text}</Link>
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
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status] || 'default'}>{status}</Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (d: string) => new Date(d).toLocaleDateString('en-IN'),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>OTB Cycles</Title>
        <Link href="/cycles/new">
          <Button type="primary" icon={<PlusOutlined />}>New Cycle</Button>
        </Link>
      </div>
      <Table
        dataSource={cycles}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
}
