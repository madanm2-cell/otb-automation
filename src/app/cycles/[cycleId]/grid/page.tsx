'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Spin, Typography, Button, Space, Tag, Modal, message } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, EditOutlined, SendOutlined, ImportOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import OtbGrid from '@/components/OtbGrid';
import BulkEditModal from '@/components/BulkEditModal';
import ImportGdModal from '@/components/ImportGdModal';
import { useFormulaEngine } from '@/hooks/useFormulaEngine';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useUndoRedo } from '@/hooks/useUndoRedo';
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
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  // Undo/redo: apply a value change (from undo/redo stack)
  const handleUndoRedoApply = useCallback((rowId: string, month: string, field: string, value: number | null) => {
    setRows(prev => applyChange(prev, months, { rowId, month, field, value: value ?? 0 }));
    setDirtyRows(prev => new Set(prev).add(rowId));
    setSaveStatus('idle');
  }, [applyChange, months]);

  const { pushUndo, undo, redo, canUndo, canRedo } = useUndoRedo(handleUndoRedoApply);

  const handleCellValueChanged = useCallback((params: { rowId: string; month: string; field: string; value: number }) => {
    // Get old value before applying change
    const row = rows.find(r => r.id === params.rowId);
    const oldValue = row?.months[params.month]?.[params.field as keyof typeof row.months[string]] as number | null ?? null;

    setRows(prev => applyChange(prev, months, params));
    setDirtyRows(prev => new Set(prev).add(params.rowId));
    setSaveStatus('idle');

    // Push to undo stack
    pushUndo({ rowId: params.rowId, month: params.month, field: params.field, oldValue, newValue: params.value });
  }, [applyChange, months, rows, pushUndo]);

  const handleBulkApply = useCallback((changes: { rowId: string; month: string; field: string; value: number }[]) => {
    let updated = rows;
    const dirty = new Set(dirtyRows);
    for (const change of changes) {
      updated = applyChange(updated, months, change);
      dirty.add(change.rowId);
    }
    setRows(updated);
    setDirtyRows(dirty);
    setSaveStatus('idle');
  }, [rows, dirtyRows, applyChange, months]);

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

  const handleSubmit = useCallback(async () => {
    // Save first if there are unsaved changes
    if (dirtyRows.size > 0) {
      await handleSave();
    }

    Modal.confirm({
      title: 'Submit for Review',
      content: 'Are you sure you want to submit this OTB plan for review? The plan will become read-only after submission.',
      okText: 'Submit',
      okType: 'primary',
      onOk: async () => {
        setSubmitting(true);
        try {
          const res = await fetch(`/api/cycles/${cycleId}/submit`, { method: 'POST' });
          const data = await res.json();
          if (!res.ok) {
            message.error(data.error || 'Submission failed');
            return;
          }
          setCycle(data);
          message.success('Plan submitted for review successfully!');
        } catch {
          message.error('Network error');
        } finally {
          setSubmitting(false);
        }
      },
    });
  }, [cycleId, dirtyRows.size, handleSave]);

  // Auto-save every 30s when dirty (with 2s debounce)
  useAutoSave({
    dirtyCount: dirtyRows.size,
    onSave: handleSave,
  });

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
              <Button size="small" icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>Import Excel</Button>
              <Button size="small" icon={<EditOutlined />} onClick={() => setBulkEditOpen(true)}>Bulk Edit</Button>
              <Button size="small" disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)">Undo</Button>
              <Button size="small" disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Y)">Redo</Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saveStatus === 'saving'}
                disabled={dirtyRows.size === 0}
              >
                Save Draft
              </Button>
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSubmit}
                loading={submitting}
                danger
              >
                Submit for Review
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
      {isEditable && (
        <>
          <BulkEditModal
            open={bulkEditOpen}
            onClose={() => setBulkEditOpen(false)}
            rows={rows}
            months={months}
            lockedMonths={lockedMonths}
            onApply={handleBulkApply}
          />
          <ImportGdModal
            open={importOpen}
            onClose={() => setImportOpen(false)}
            cycleId={cycleId}
            onApply={handleBulkApply}
          />
        </>
      )}
    </div>
  );
}
