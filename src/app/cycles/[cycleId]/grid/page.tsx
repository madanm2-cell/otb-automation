'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Spin, Typography, Button, Space, Tag } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import OtbGrid from '@/components/OtbGrid';
import { useFormulaEngine } from '@/hooks/useFormulaEngine';
import { getLockedMonths } from '@/lib/monthLockout';
import type { PlanRow, OtbCycle } from '@/types/otb';

const { Title } = Typography;

export default function GridPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const [cycle, setCycle] = useState<OtbCycle | null>(null);
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirtyRows, setDirtyRows] = useState<Set<string>>(new Set());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const { applyChange } = useFormulaEngine();

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

  const lockedMonths = useMemo(() => getLockedMonths(months), [months]);

  const isEditable = cycle?.status === 'Filling';

  const handleCellValueChanged = useCallback((params: { rowId: string; month: string; field: string; value: number }) => {
    setRows(prev => applyChange(prev, months, params));
    setDirtyRows(prev => new Set(prev).add(params.rowId));
    setSaveStatus('idle');
  }, [applyChange, months]);

  const handleSave = useCallback(async () => {
    if (dirtyRows.size === 0) return;

    setSaveStatus('saving');
    const updates = [];
    for (const rowId of dirtyRows) {
      const row = rows.find(r => r.id === rowId);
      if (!row) continue;
      for (const month of months) {
        if (lockedMonths[month]) continue;
        const d = row.months[month];
        if (!d) continue;
        updates.push({
          rowId,
          month,
          nsq: d.nsq,
          inwards_qty: d.inwards_qty,
          perf_marketing_pct: d.perf_marketing_pct,
        });
      }
    }

    try {
      const res = await fetch(`/api/cycles/${cycleId}/plan-data/bulk-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      if (res.ok) {
        setDirtyRows(new Set());
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    }
  }, [cycleId, dirtyRows, rows, months, lockedMonths]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  const saveLabel = {
    idle: dirtyRows.size > 0 ? `Save Draft (${dirtyRows.size} changed)` : 'All saved',
    saving: 'Saving...',
    saved: 'All changes saved ✓',
    error: 'Save failed ✗',
  }[saveStatus];

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
          {isEditable && (
            <>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saveStatus === 'saving'}
                disabled={dirtyRows.size === 0}
              >
                Save Draft
              </Button>
              <span style={{
                fontSize: 12,
                color: saveStatus === 'saved' ? '#52c41a' : saveStatus === 'error' ? '#ff4d4f' : '#999',
              }}>
                {saveLabel}
              </span>
            </>
          )}
        </Space>
      </div>
      <OtbGrid
        rows={rows}
        months={months}
        editable={isEditable}
        lockedMonths={lockedMonths}
        onCellValueChanged={isEditable ? handleCellValueChanged : undefined}
      />
    </div>
  );
}
