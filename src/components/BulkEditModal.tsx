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
  { label: 'Perf Marketing %', value: 'perf_marketing_pct' },
];

type EditMode = 'pct_change' | 'absolute';

export default function BulkEditModal({ open, onClose, rows, months, lockedMonths, onApply }: BulkEditModalProps) {
  const [field, setField] = useState<string>('nsq');
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [editMode, setEditMode] = useState<EditMode>('pct_change');
  const [pctChange, setPctChange] = useState<number>(0);
  const [absoluteValue, setAbsoluteValue] = useState<number>(0);

  const editableMonths = useMemo(
    () => months.filter(m => !lockedMonths[m]),
    [months, lockedMonths]
  );

  const monthOptions = editableMonths.map(m => {
    const d = new Date(m + 'T00:00:00');
    return { label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), value: m };
  });

  // Preview: compute new values for each affected row × month
  const preview = useMemo(() => {
    if (selectedMonths.length === 0) return [];

    return rows.slice(0, 10).map(row => {
      const changes: Record<string, { old: number; new: number }> = {};
      for (const m of selectedMonths) {
        const old = (row.months[m]?.[field as keyof typeof row.months[string]] as number) ?? 0;
        const newVal = editMode === 'pct_change'
          ? Math.round(old * (1 + pctChange / 100))
          : absoluteValue;
        changes[m] = { old, new: newVal };
      }
      return { id: row.id, sub_category: row.sub_category, channel: row.channel, changes };
    });
  }, [rows, selectedMonths, field, editMode, pctChange, absoluteValue]);

  const handleApply = () => {
    const changes: { rowId: string; month: string; field: string; value: number }[] = [];
    for (const row of rows) {
      for (const m of selectedMonths) {
        const old = (row.months[m]?.[field as keyof typeof row.months[string]] as number) ?? 0;
        const newVal = editMode === 'pct_change'
          ? Math.round(old * (1 + pctChange / 100))
          : absoluteValue;
        changes.push({ rowId: row.id, month: m, field, value: newVal });
      }
    }
    onApply(changes);
    onClose();
  };

  const previewColumns = [
    { title: 'Sub Category', dataIndex: 'sub_category', key: 'sub_category', width: 120 },
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
              <Text delete type="secondary">{c.old}</Text>
              {' → '}
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
      width={700}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Space wrap>
          <div>
            <Text type="secondary">Field:</Text>
            <Select
              value={field}
              onChange={setField}
              options={FIELD_OPTIONS}
              style={{ width: 160, marginLeft: 8 }}
            />
          </div>
          <div>
            <Text type="secondary">Months:</Text>
            <Select
              mode="multiple"
              value={selectedMonths}
              onChange={setSelectedMonths}
              options={monthOptions}
              style={{ width: 250, marginLeft: 8 }}
              placeholder="Select months"
            />
          </div>
        </Space>

        <Space>
          <Radio.Group value={editMode} onChange={e => setEditMode(e.target.value)}>
            <Radio value="pct_change">% Change</Radio>
            <Radio value="absolute">Set Value</Radio>
          </Radio.Group>

          {editMode === 'pct_change' ? (
            <InputNumber
              value={pctChange}
              onChange={v => setPctChange(v ?? 0)}
              addonAfter="%"
              style={{ width: 120 }}
            />
          ) : (
            <InputNumber
              value={absoluteValue}
              onChange={v => setAbsoluteValue(v ?? 0)}
              style={{ width: 120 }}
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
