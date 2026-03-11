'use client';

import { useEffect, useState } from 'react';
import { Spin, Typography, Button, Space, Tag } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import OtbGrid from '@/components/OtbGrid';
import type { PlanRow, OtbCycle } from '@/types/otb';

const { Title } = Typography;

export default function GridPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const [cycle, setCycle] = useState<OtbCycle | null>(null);
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/cycles/${cycleId}`).then(r => r.json()),
      fetch(`/api/cycles/${cycleId}/plan-data`).then(r => r.json()),
    ]).then(([cycleData, planData]) => {
      setCycle(cycleData);
      setRows(planData.rows || []);
      setMonths(planData.months || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [cycleId]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div style={{ padding: '16px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Link href={`/cycles/${cycleId}`}>
            <Button icon={<ArrowLeftOutlined />} size="small" />
          </Link>
          <Title level={3} style={{ margin: 0 }}>
            {cycle?.cycle_name || 'OTB Grid'}
          </Title>
          {cycle && <Tag>{cycle.status}</Tag>}
        </Space>
        <Space>
          <span style={{ color: '#999', fontSize: 13 }}>
            {rows.length} rows × {months.length} months
          </span>
        </Space>
      </div>
      <OtbGrid rows={rows} months={months} />
    </div>
  );
}
