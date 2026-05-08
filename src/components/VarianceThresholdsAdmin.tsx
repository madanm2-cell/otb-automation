'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, InputNumber, Button, message, Typography, Spin, Alert } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { DEFAULT_VARIANCE_THRESHOLDS, type VarianceThresholds } from '@/types/otb';

const { Text } = Typography;

const METRIC_LABELS: Record<string, string> = {
  gmv_pct: 'GMV',
  nsv_pct: 'NSV',
  nsq_pct: 'NSQ',
  inwards_pct: 'Inwards',
  closing_stock_pct: 'Closing Stock',
  doh_pct: 'DOH',
};

const METRIC_KEYS = Object.keys(METRIC_LABELS) as (keyof VarianceThresholds)[];

interface Props {
  brandId: string;
}

export function VarianceThresholdsAdmin({ brandId }: Props) {
  const [thresholds, setThresholds] = useState<VarianceThresholds>({ ...DEFAULT_VARIANCE_THRESHOLDS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/variance-thresholds?brandId=${brandId}`);
    if (res.ok) {
      setThresholds(await res.json());
    } else {
      setError('Failed to load thresholds');
    }
    setLoading(false);
  }, [brandId]);

  useEffect(() => { load(); }, [load]);

  const save = async (metric: string) => {
    setSaving(metric);
    const value = (thresholds as unknown as Record<string, number>)[metric];
    const res = await fetch('/api/admin/variance-thresholds', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, metric, threshold_pct: value }),
    });
    setSaving(null);
    if (res.ok) {
      message.success(`${METRIC_LABELS[metric]} threshold saved`);
    } else {
      const body = await res.json().catch(() => ({}));
      message.error((body as Record<string, string>).error ?? 'Save failed');
    }
  };

  if (loading) return <Spin />;
  if (error) return <Alert type="error" message={error} />;

  const rows = METRIC_KEYS.map(metric => ({
    key: metric,
    metric,
    label: METRIC_LABELS[metric],
    value: (thresholds as unknown as Record<string, number>)[metric],
    defaultVal: (DEFAULT_VARIANCE_THRESHOLDS as unknown as Record<string, number>)[metric],
  }));

  return (
    <Table
      dataSource={rows}
      pagination={false}
      size="small"
      columns={[
        {
          title: 'Metric',
          dataIndex: 'label',
          key: 'label',
          render: (v: string) => <Text strong>{v}</Text>,
        },
        {
          title: 'Threshold %',
          key: 'threshold',
          render: (_: unknown, record: { metric: string; value: number }) => (
            <InputNumber
              min={1}
              max={100}
              value={record.value}
              onChange={(v) => {
                if (v == null) return;
                setThresholds(prev => ({ ...prev, [record.metric]: v }));
              }}
              addonAfter="%"
              style={{ width: 130 }}
            />
          ),
        },
        {
          title: 'Default',
          dataIndex: 'defaultVal',
          key: 'default',
          render: (v: number) => <Text type="secondary">{v}%</Text>,
        },
        {
          title: '',
          key: 'action',
          render: (_: unknown, record: { metric: string }) => (
            <Button
              icon={<SaveOutlined />}
              size="small"
              type="primary"
              loading={saving === record.metric}
              onClick={() => save(record.metric)}
            >
              Save
            </Button>
          ),
        },
      ]}
    />
  );
}
