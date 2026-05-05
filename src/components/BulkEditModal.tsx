'use client';

import { useState, useMemo } from 'react';
import { Modal, Select, InputNumber, Table, Space, Typography, Radio } from 'antd';
import type { PlanRow } from '@/types/otb';

const { Text } = Typography;

interface BulkEditModalProps {
  open: boolean;
  onClose: () => void;
  rows: PlanRow[];
  months: string[];
  lockedMonths: Record<string, boolean>;
  onApply: (changes: { rowId: string; month: string; field: string; value: number }[]) => void;
}

const FIELD_OPTIONS = [
  { label: 'NSQ', value: 'nsq' },
  { label: 'Inwards Qty', value: 'inwards_qty' },
];

type EditMode = 'pct_change' | 'pct_over_ly' | 'pct_over_recent' | 'absolute';

const MODE_OPTIONS: { label: string; value: EditMode; nsqOnly?: boolean }[] = [
  { label: '% over current value', value: 'pct_change' },
  { label: '% over LY NSQ', value: 'pct_over_ly', nsqOnly: true },
  { label: '% over Recent 3M NSQ', value: 'pct_over_recent', nsqOnly: true },
  { label: 'Set value', value: 'absolute' },
];

function computeNewVal(
  mode: EditMode,
  row: PlanRow,
  month: string,
  field: string,
  pct: number,
  absolute: number
): number {
  if (mode === 'absolute') return absolute;

  let base = 0;
  if (mode === 'pct_change') {
    base = (row.months[month]?.[field as keyof typeof row.months[string]] as number) ?? 0;
  } else if (mode === 'pct_over_ly') {
    base = (row.months[month]?.ly_sales_nsq as number) ?? 0;
  } else if (mode === 'pct_over_recent') {
    base = (row.months[month]?.recent_sales_nsq as number) ?? 0;
  }

  return Math.round(base * (1 + pct / 100));
}

export default function BulkEditModal({ open, onClose, rows, months, lockedMonths, onApply }: BulkEditModalProps) {
  const [field, setField] = useState<string>('nsq');
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [editMode, setEditMode] = useState<EditMode>('pct_over_ly');
  const [pct, setPct] = useState<number>(0);
  const [absoluteValue, setAbsoluteValue] = useState<number>(0);

  const editableMonths = useMemo(
    () => months.filter(() => true), // TODO: restore months.filter(m => !lockedMonths[m])
    [months]
  );

  const monthOptions = editableMonths.map(m => {
    const d = new Date(m + 'T00:00:00');
    return { label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), value: m };
  });

  const availableModes = field === 'nsq' ? MODE_OPTIONS : MODE_OPTIONS.filter(o => !o.nsqOnly);

  // If current mode is NSQ-only but field switched to inwards, reset mode
  const activeMode: EditMode = (field !== 'nsq' && (editMode === 'pct_over_ly' || editMode === 'pct_over_recent'))
    ? 'pct_change'
    : editMode;

  const preview = useMemo(() => {
    if (selectedMonths.length === 0) return [];
    return rows.slice(0, 10).map(row => {
      const changes: Record<string, { base: number; new: number; baseLabel: string }> = {};
      for (const m of selectedMonths) {
        const newVal = computeNewVal(activeMode, row, m, field, pct, absoluteValue);
        let base = 0;
        let baseLabel = '';
        if (activeMode === 'pct_over_ly') {
          base = (row.months[m]?.ly_sales_nsq as number) ?? 0;
          baseLabel = `LY: ${base}`;
        } else if (activeMode === 'pct_over_recent') {
          base = (row.months[m]?.recent_sales_nsq as number) ?? 0;
          baseLabel = `Recent: ${base}`;
        } else if (activeMode === 'pct_change') {
          base = (row.months[m]?.[field as keyof typeof row.months[string]] as number) ?? 0;
          baseLabel = `Current: ${base}`;
        }
        changes[m] = { base, new: newVal, baseLabel };
      }
      return { id: row.id, sub_category: row.sub_category, channel: row.channel, changes };
    });
  }, [rows, selectedMonths, field, activeMode, pct, absoluteValue]);

  const handleApply = () => {
    const changes: { rowId: string; month: string; field: string; value: number }[] = [];
    for (const row of rows) {
      for (const m of selectedMonths) {
        const newVal = computeNewVal(activeMode, row, m, field, pct, absoluteValue);
        changes.push({ rowId: row.id, month: m, field, value: newVal });
      }
    }
    onApply(changes);
    onClose();
  };

  const previewColumns = [
    { title: 'Sub Category', dataIndex: 'sub_category', key: 'sub_category', width: 110 },
    { title: 'Channel', dataIndex: 'channel', key: 'channel', width: 100 },
    ...selectedMonths.map(m => {
      const d = new Date(m + 'T00:00:00');
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      return {
        title: label,
        key: m,
        render: (_: unknown, record: (typeof preview)[0]) => {
          const c = record.changes[m];
          if (!c) return '-';
          return (
            <span>
              {activeMode !== 'absolute' && (
                <Text type="secondary" style={{ fontSize: 11 }}>{c.baseLabel} → </Text>
              )}
              <Text strong>{c.new}</Text>
            </span>
          );
        },
      };
    }),
  ];

  return (
    <Modal
      title="Bulk Edit GD Inputs"
      open={open}
      onCancel={onClose}
      onOk={handleApply}
      okText={`Apply to ${rows.length} rows`}
      okButtonProps={{ disabled: selectedMonths.length === 0 }}
      width={720}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Space wrap>
          <div>
            <Text type="secondary">Field:</Text>
            <Select
              value={field}
              onChange={v => { setField(v); }}
              options={FIELD_OPTIONS}
              style={{ width: 140, marginLeft: 8 }}
            />
          </div>
          <div>
            <Text type="secondary">Months:</Text>
            <Select
              mode="multiple"
              value={selectedMonths}
              onChange={setSelectedMonths}
              options={monthOptions}
              style={{ width: 240, marginLeft: 8 }}
              placeholder="Select months"
            />
          </div>
        </Space>

        <Space align="center" wrap>
          <Radio.Group
            value={activeMode}
            onChange={e => setEditMode(e.target.value)}
            optionType="button"
            buttonStyle="solid"
            options={availableModes.map(o => ({ label: o.label, value: o.value }))}
          />
          {activeMode !== 'absolute' ? (
            <InputNumber
              value={pct}
              onChange={v => setPct(v ?? 0)}
              addonAfter="%"
              style={{ width: 120 }}
              placeholder="0"
            />
          ) : (
            <InputNumber
              value={absoluteValue}
              onChange={v => setAbsoluteValue(v ?? 0)}
              style={{ width: 120 }}
              min={0}
            />
          )}
        </Space>

        {preview.length > 0 && (
          <>
            <Text type="secondary">Preview (first 10 rows):</Text>
            <Table
              dataSource={preview}
              columns={previewColumns}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ y: 200 }}
            />
            {rows.length > 10 && (
              <Text type="secondary">... and {rows.length - 10} more rows</Text>
            )}
          </>
        )}
      </Space>
    </Modal>
  );
}
