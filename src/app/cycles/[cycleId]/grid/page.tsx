'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Spin, Typography, Button, Space, Tag, Modal, message, Popconfirm, Collapse, List, Dropdown } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, EditOutlined, SendOutlined, ImportOutlined, DownloadOutlined, CommentOutlined, HistoryOutlined, RollbackOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import OtbGrid, { type OtbGridHandle } from '@/components/OtbGrid';
import BulkEditModal from '@/components/BulkEditModal';
import ImportGdModal from '@/components/ImportGdModal';
import { ApprovalPanel } from '@/components/ApprovalPanel';
import { CommentsPanel } from '@/components/CommentsPanel';
import { useFormulaEngine } from '@/hooks/useFormulaEngine';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/lib/auth/roles';
import { getLockedMonths } from '@/lib/monthLockout';
import type { PlanRow, OtbCycle } from '@/types/otb';

const { Title } = Typography;

interface VersionEntry {
  id: string;
  version_number: number;
  change_summary: string | null;
  created_by: string | null;
  created_at: string;
}

export default function GridPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const [cycle, setCycle] = useState<OtbCycle | null>(null);
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirtyRows, setDirtyRows] = useState<Set<string>>(new Set());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const otbGridRef = useRef<OtbGridHandle>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditRows, setBulkEditRows] = useState<typeof rows>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [reverting, setReverting] = useState(false);
  const [pendingSuggestions, setPendingSuggestions] = useState<Map<string, number>>(new Map());

  const { applyChange } = useFormulaEngine();

  const fetchGridData = useCallback(async () => {
    try {
      const [cycleData, planData] = await Promise.all([
        fetch(`/api/cycles/${cycleId}`).then(r => r.json()),
        fetch(`/api/cycles/${cycleId}/plan-data`).then(r => r.json()),
      ]);
      setCycle(cycleData);
      setRows(planData.rows || []);
      setMonths(planData.months || []);
      setDirtyRows(new Set());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [cycleId]);

  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/cycles/${cycleId}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data);
      }
    } catch {
      // ignore
    }
  }, [cycleId]);

  useEffect(() => {
    fetchGridData();
    fetchVersions();
  }, [fetchGridData, fetchVersions]);

  const { profile } = useAuth();
  const lockedMonths = useMemo(() => getLockedMonths(months), [months]);

  // Editable: GD on assigned brand in Filling status, or Admin
  const isEditable = cycle?.status === 'Filling' && profile != null && (
    profile.role === 'Admin'
    || (profile.role === 'GD' && profile.assigned_brands?.includes(cycle.brand_id))
  );
  const hasAccess = profile != null && (
    profile.role === 'Admin'
    || profile.assigned_brands?.includes(cycle?.brand_id ?? '')
  );
  const canSubmit = profile?.role === 'GD' || profile?.role === 'Admin';
  const showApprovalPanel = cycle?.status === 'InReview' || cycle?.status === 'Approved';
  const canExport = profile != null && hasPermission(profile.role, 'export_otb');

  // Undo/redo: apply a value change (from undo/redo stack)
  const handleUndoRedoApply = useCallback((rowId: string, month: string, field: string, value: number | null) => {
    setRows(prev => {
      const { rows: updatedRows } = applyChange(prev, months, { rowId, month, field, value: value ?? 0 });
      return updatedRows;
    });
    setDirtyRows(prev => new Set(prev).add(rowId));
    setSaveStatus('idle');
  }, [applyChange, months]);

  const { pushUndo, undo, redo, canUndo, canRedo } = useUndoRedo(handleUndoRedoApply);

  const handleCellValueChanged = useCallback((params: { rowId: string; month: string; field: string; value: number }) => {
    // Get old value before applying change
    const row = rows.find(r => r.id === params.rowId);
    const oldValue = row?.months[params.month]?.[params.field as keyof typeof row.months[string]] as number | null ?? null;

    const { rows: updatedRows, suggestion } = applyChange(rows, months, params);
    setRows(updatedRows);
    setDirtyRows(prev => new Set(prev).add(params.rowId));
    setSaveStatus('idle');

    // Push to undo stack
    pushUndo({ rowId: params.rowId, month: params.month, field: params.field, oldValue, newValue: params.value });

    // Update pending suggestions
    if (params.field === 'nsq') {
      const currentInwards = row?.months[params.month]?.inwards_qty ?? null;
      setPendingSuggestions(prev => {
        const next = new Map(prev);
        const key = `${params.rowId}|${params.month}`;
        if (suggestion && (currentInwards == null || currentInwards === 0)) {
          next.set(key, suggestion.value);
        } else {
          next.delete(key);
        }
        return next;
      });
    } else if (params.field === 'inwards_qty' && params.value !== 0) {
      // GD manually entered inwards — clear suggestion for this cell
      setPendingSuggestions(prev => {
        const next = new Map(prev);
        next.delete(`${params.rowId}|${params.month}`);
        return next;
      });
    }
  }, [applyChange, months, rows, pushUndo]);

  const handleBulkApply = useCallback((changes: { rowId: string; month: string; field: string; value: number }[]) => {
    let updated = rows;
    const dirty = new Set(dirtyRows);
    for (const change of changes) {
      const { rows: next } = applyChange(updated, months, change);
      updated = next;
      dirty.add(change.rowId);
    }
    setRows(updated);
    setDirtyRows(dirty);
    setSaveStatus('idle');
  }, [rows, dirtyRows, applyChange, months]);

  const handleAcceptAll = useCallback(() => {
    const changes = Array.from(pendingSuggestions.entries()).map(([key, value]) => {
      const [rowId, month] = key.split('|');
      return { rowId, month, field: 'inwards_qty', value };
    });
    if (changes.length > 0) {
      handleBulkApply(changes);
    }
    setPendingSuggestions(new Map());
  }, [pendingSuggestions, handleBulkApply]);

  const handleSave = useCallback(async () => {
    if (dirtyRows.size === 0) return;

    setSaveStatus('saving');
    const updates = [];
    for (const rowId of dirtyRows) {
      const row = rows.find(r => r.id === rowId);
      if (!row) continue;
      for (const month of months) {
        // if (lockedMonths[month]) continue; // TODO: restore month locking
        const d = row.months[month];
        if (!d) continue;
        updates.push({
          rowId,
          month,
          nsq: d.nsq,
          inwards_qty: d.inwards_qty,
          inwards_qty_suggested: d.inwards_qty_suggested ?? null,
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

  const handleRevert = useCallback(async (versionNumber: number) => {
    setReverting(true);
    try {
      const res = await fetch(`/api/cycles/${cycleId}/versions/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_number: versionNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error || 'Revert failed');
        return;
      }
      message.success(`Successfully reverted to version ${versionNumber}`);
      await fetchGridData();
      await fetchVersions();
    } catch {
      message.error('Network error during revert');
    } finally {
      setReverting(false);
    }
  }, [cycleId, fetchGridData, fetchVersions]);

  const isRevertDisabled = cycle?.status === 'Approved' || cycle?.status === 'InReview';

  // Auto-save every 30s when dirty (with 2s debounce)
  useAutoSave({
    dirtyCount: dirtyRows.size,
    onSave: handleSave,
  });

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!loading && cycle && !hasAccess) {
    return <div style={{ padding: 24 }}>You do not have access to this brand.</div>;
  }

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
          {canExport && (
            <Dropdown
              menu={{
                items: [
                  { key: 'xlsx', label: 'Export as Excel', onClick: async () => { await handleSave(); window.open(`/api/cycles/${cycleId}/export?format=xlsx`, '_blank'); } },
                  { key: 'csv', label: 'Export as CSV', onClick: async () => { await handleSave(); window.open(`/api/cycles/${cycleId}/export?format=csv`, '_blank'); } },
                  { key: 'pdf', label: 'Export as PDF', onClick: async () => { await handleSave(); window.open(`/api/cycles/${cycleId}/export?format=pdf`, '_blank'); } },
                ],
              }}
            >
              <Button size="small" icon={<DownloadOutlined />}>
                Export
              </Button>
            </Dropdown>
          )}
          <Button size="small" icon={<CommentOutlined />} onClick={() => setCommentsOpen(true)}>
            Comments
          </Button>
          {isEditable && (
            <>
              <Button size="small" icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>Import Excel</Button>
              <Button size="small" icon={<EditOutlined />} onClick={() => {
                setBulkEditRows(otbGridRef.current?.getFilteredRows() ?? rows);
                setBulkEditOpen(true);
              }}>Bulk Edit</Button>
              {pendingSuggestions.size > 0 && (
                <Button
                  size="small"
                  type="dashed"
                  onClick={handleAcceptAll}
                  style={{ color: '#1677ff', borderColor: '#1677ff' }}
                >
                  Accept Suggestions ({pendingSuggestions.size})
                </Button>
              )}
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
              {canSubmit && (
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSubmit}
                  loading={submitting}
                  danger
                >
                  Submit for Review
                </Button>
              )}
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
      {showApprovalPanel && cycle && (
        <ApprovalPanel
          cycleId={cycleId}
          cycleStatus={cycle.status}
          onStatusChange={(newStatus) => setCycle(prev => prev ? { ...prev, status: newStatus as any } : prev)}
        />
      )}
      {versions.length > 0 && (
        <Collapse
          size="small"
          style={{ marginBottom: 16 }}
          items={[{
            key: 'version-history',
            label: (
              <Space>
                <HistoryOutlined />
                Version History ({versions.length})
              </Space>
            ),
            children: (
              <List
                size="small"
                dataSource={versions}
                renderItem={(v) => (
                  <List.Item
                    actions={[
                      <Popconfirm
                        key="revert"
                        title={`Revert to version ${v.version_number}`}
                        description={`Are you sure you want to revert to version ${v.version_number}? This will replace all current plan data.`}
                        onConfirm={() => handleRevert(v.version_number)}
                        okText="Revert"
                        cancelText="Cancel"
                        okButtonProps={{ danger: true }}
                      >
                        <Button
                          size="small"
                          icon={<RollbackOutlined />}
                          disabled={isRevertDisabled || reverting}
                          loading={reverting}
                        >
                          Revert
                        </Button>
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      title={`Version ${v.version_number}`}
                      description={
                        <Space size="middle">
                          {v.change_summary && <span>{v.change_summary}</span>}
                          <span style={{ color: '#999', fontSize: 12 }}>
                            {new Date(v.created_at).toLocaleString()}
                          </span>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ),
          }]}
        />
      )}
      <OtbGrid
        ref={otbGridRef}
        rows={rows}
        months={months}
        editable={isEditable}
        lockedMonths={lockedMonths}
        onCellValueChanged={isEditable ? handleCellValueChanged : undefined}
        pendingSuggestions={pendingSuggestions}
      />
      {isEditable && (
        <>
          <BulkEditModal
            open={bulkEditOpen}
            onClose={() => setBulkEditOpen(false)}
            rows={bulkEditRows}
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
      <CommentsPanel
        cycleId={cycleId}
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
      />
    </div>
  );
}
