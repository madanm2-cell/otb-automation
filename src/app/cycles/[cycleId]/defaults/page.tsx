'use client';

import { useEffect, useState } from 'react';
import { Button, Space, Spin, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { CycleDefaultsReview } from '@/components/CycleDefaultsReview';
import type { OtbCycle } from '@/types/otb';

const { Title } = Typography;

export default function CycleDefaultsPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const router = useRouter();
  const [cycle, setCycle] = useState<OtbCycle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/cycles/${cycleId}`)
      .then(r => r.json())
      .then(data => { setCycle(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [cycleId]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!cycle) return <div style={{ padding: 24 }}>Cycle not found</div>;

  return (
    <ProtectedRoute permission="create_cycle">
      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        <Space style={{ marginBottom: 16 }}>
          <Link href={`/cycles/${cycleId}`}>
            <Button icon={<ArrowLeftOutlined />}>Back to Cycle</Button>
          </Link>
        </Space>
        <Title level={3}>{cycle.cycle_name} — Review Defaults</Title>
        <CycleDefaultsReview
          cycleId={cycleId}
          onConfirmed={() => router.push(`/cycles/${cycleId}`)}
        />
      </div>
    </ProtectedRoute>
  );
}
