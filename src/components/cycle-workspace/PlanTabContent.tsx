'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Spin, Button, Space, Modal, message, Popconfirm, Collapse, List, Dropdown } from 'antd';
import { SaveOutlined, EditOutlined, SendOutlined, ImportOutlined, DownloadOutlined, CommentOutlined, HistoryOutlined, RollbackOutlined } from '@ant-design/icons';
import OtbGrid, { type OtbGridHandle } from '@/components/OtbGrid';
import BulkEditModal from '@/components/BulkEditModal';
import ImportGdModal from '@/components/ImportGdModal';
import { CommentsPanel } from '@/components/CommentsPanel';
import { useFormulaEngine } from '@/hooks/useFormulaEngine';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/lib/auth/roles';
import { getLockedMonths } from '@/lib/monthLockout';
import { calcSuggestedInwards, calculateAll } from '@/lib/formulaEngine';
import { buildCommentMap } from '@/lib/cellComments';
import type { PlanRow, OtbCycle, OtbComment } from '@/types/otb';

interface VersionEntry {
  id: string;
  version_number: number;
  change_summary: string | null;
  created_by: string | null;
  created_at: string;
}

interface PlanTabContentProps {
  cycleId: string;
}

export function PlanTabContent({ cycleId }: PlanTabContentProps) {
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
  const [comments, setComments] = useState<OtbComment[]>([]);
  const suggestionsInitialized = useRef(false);

  const { applyChange } = useFormulaEngine();

  const fetchGridData = useCallback(async () => {
    suggestionsInitialized.current = false;
    try {
      const [cycleData, planData, commentsData] = await Promise.all([
        fetch(`/api/cycles/${cycleId}`).then(r => r.json()),
        fetch(`/api/cycles/${cycleId}/plan-data`).then(r => r.json()),
        fetch(`/api/cycles/${cycleId}/comments`).then(r => r.json()).catch(() => []),
      ]);
      setCycle(cycleData);
      setComments(Array.isArray(commentsData) ? commentsData : []);
      const loadedMonths: string[] = planData.months || [];
      const sortedM = [...loadedMonths].sort();

      // Recalculate all computed fields client-side so DB NULLs (e.g. closing stock when
      // inwards not yet entered) are filled in correctly using the formula engine.
      const recalculated: PlanRow[] = (planData.rows || []).map((row: PlanRow) => {
        const newMonths = { ...row.months };
        for (const m of sortedM) {
          if (newMonths[m]) newMonths[m] = { ...newMonths[m] };
        }
        for (let i = 0; i < sortedM.length; i++) {
          const m = sortedM[i];
          const d = newMonths[m];
          if (!d) continue;
          // Month chaining: M+1 opening = M closing
          if (i > 0) {
            const prev = newMonths[sortedM[i - 1]];
            if (prev?.closing_stock_qty != null) d.opening_stock_qty = prev.closing_stock_qty;
          }
          const nextNsq = i < sortedM.length - 1 ? (newMonths[sortedM[i + 1]]?.nsq ?? null) : null;
          const r = calculateAll({
            nsq: d.nsq, inwardsQty: d.inwards_qty, asp: d.asp, cogs: d.cogs,
            openingStockQty: d.opening_stock_qty, lySalesNsq: d.ly_sales_nsq,
            returnPct: d.return_pct, taxPct: d.tax_pct, nextMonthNsq: nextNsq,
          });
          d.sales_plan_gmv = r.salesPlanGmv;
          d.goly_pct = r.golyPct;
          d.nsv = r.nsv;
          d.inwards_val_cogs = r.inwardsValCogs;
          d.opening_stock_val = r.openingStockVal;
          d.closing_stock_qty = r.closingStockQty;
          d.fwd_30day_doh = r.fwd30dayDoh;
          d.gm_pct = r.gmPct;
          d.gross_margin = r.grossMargin;
        }
        return { ...row, months: newMonths };
      });

      setRows(recalculated);
      setMonths(loadedMonths);
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
  const commentMap = useMemo(() => buildCommentMap(comments), [comments]);

  const refreshComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/cycles/${cycleId}/comments`);
      if (res.ok) setComments(await res.json());
    } catch {
      // non-critical
    }
  }, [cycleId]);

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
  const canExport = profile != null && hasPermission(profile.role, 'export_otb');

  // Compute initial suggestions on page load — only when the GD can still act on them
  useEffect(() => {
    if (!isEditable) return;
    if (rows.length === 0 || months.length === 0) return;
    if (suggestionsInitialized.current) return;
    suggestionsInitialized.current = true;

    const sortedMonths = [...months].sort();
    const initial = new Map<string, number>();

    for (const row of rows) {
      for (let i = 0; i < sortedMonths.length; i++) {
        const month = sortedMonths[i];
        const d = row.months[month];
        if (!d || !d.nsq || d.nsq === 0) continue;

        const nextMonthNsq = i < sortedMonths.length - 1
          ? (row.months[sortedMonths[i + 1]]?.nsq ?? null)
          : null;

        const suggested = calcSuggestedInwards(d.nsq, nextMonthNsq, d.standard_doh, d.opening_stock_qty);
        if (suggested !== null && suggested > 0 && suggested !== d.inwards_qty) {
          initial.set(`${row.id}|${month}`, suggested);
        }
      }
    }

    if (initial.size > 0) setPendingSuggestions(initial);
  }, [rows, months, isEditable]);

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
      const currentInwards = updatedRows.find(r => r.id === params.rowId)?.months[params.month]?.inwards_qty ?? null;
      setPendingSuggestions(prev => {
        const next = new Map(prev);
        const key = `${params.rowId}|${params.month}`;
        if (suggestion && suggestion.value > 0 && suggestion.value !== currentInwards) {
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
    const suggestionUpdates: { key: string; suggestedValue: number | null; currentInwards: number | null }[] = [];
    const inwardsClears: string[] = [];

    for (const change of changes) {
      const { rows: next, suggestion } = applyChange(updated, months, change);
      updated = next;
      dirty.add(change.rowId);

      if (change.field === 'nsq') {
        const currentInwards = updated.find(r => r.id === change.rowId)?.months[change.month]?.inwards_qty ?? null;
        suggestionUpdates.push({ key: `${change.rowId}|${change.month}`, suggestedValue: suggestion?.value ?? null, currentInwards });
      } else if (change.field === 'inwards_qty') {
        inwardsClears.push(`${change.rowId}|${change.month}`);
      }
    }

    setRows(updated);
    setDirtyRows(dirty);
    setSaveStatus('idle');

    if (suggestionUpdates.length > 0 || inwardsClears.length > 0) {
      setPendingSuggestions(prev => {
        const next = new Map(prev);
        for (const { key, suggestedValue, currentInwards } of suggestionUpdates) {
          if (suggestedValue !== null && suggestedValue > 0 && suggestedValue !== currentInwards) {
            next.set(key, suggestedValue);
          } else {
            next.delete(key);
          }
        }
        for (const key of inwardsClears) {
          next.delete(key);
        }
        return next;
      });
    }
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
    <div>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: '#fff',
          padding: '12px 24px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space>
          <span style={{ color: '#999', fontSize: 13 }}>
            {rows.length} rows × {months.length} months
          </span>
        </Space>
        <Space>
          {canExport && (
            <Dropdown
              menu={{
                items: [
                  { key: 'xlsx', label: 'Export as Excel', onClick: async () => { await handleSave(); window.open(`/api/cycles/${cycleId}/export?format=xlsx`, '_blank'); } },
                  { key: 'csv', label: 'Export as CSV', onClick: async () => { await handleSave(); window.open(`/api/cycles/${cycleId}/export?format=csv`, '_blank'); } },
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
      {versions.length > 0 && (
        <Collapse
          size="small"
          style={{ margin: '16px 24px' }}
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
        commentMap={commentMap}
        cycleId={cycleId}
        userRole={profile?.role}
        onCommentAdded={refreshComments}
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
        months={months}
      />
    </div>
  );
}
