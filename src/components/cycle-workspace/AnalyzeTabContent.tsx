'use client';

import { useEffect, useState } from 'react';
import { Spin, Alert, Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { VarianceReport } from '@/components/VarianceReport';
import type { VarianceReportData } from '@/types/otb';

export function AnalyzeTabContent({ cycleId }: { cycleId: string }) {
  const [data, setData] = useState<VarianceReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/cycles/${cycleId}/variance`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Failed to load variance data (${res.status})`);
        }
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [cycleId]);

  return (
    <div style={{ padding: '16px 24px' }}>
      {/* Export */}
      {data && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 16 }}>
          <Button
            icon={<DownloadOutlined />}
            href={`/api/cycles/${cycleId}/variance/export`}
          >
            Export Excel
          </Button>
        </div>
      )}

      {/* Content */}
      {loading && (
        <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
      )}

      {error && (
        <Alert
          type="error"
          message="Error Loading Variance Report"
          description={error}
          showIcon
          style={{ maxWidth: 600, margin: '40px auto' }}
        />
      )}

      {data && <VarianceReport data={data} />}
    </div>
  );
}
