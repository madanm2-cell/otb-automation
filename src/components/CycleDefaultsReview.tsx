'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, Table, InputNumber, Button, Space, Tag, message, Alert, Spin, Typography, Modal, Tooltip } from 'antd';
import { CheckCircleOutlined, EditOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import type { CycleDefault, CycleStatus, DefaultType } from '@/types/otb';

const { Title } = Typography;

interface Props {
  cycleId: string;
  cycleStatus?: CycleStatus;
  onConfirmed: () => void;  // callback when defaults are confirmed
}

const DEFAULT_TYPE_LABELS: Record<DefaultType, string> = {
  asp: 'ASP (Average Selling Price)',
  cogs: 'COGS (Cost of Goods Sold)',
  return_pct: 'Return %',
  tax_pct: 'Tax %',
  sellex_pct: 'Sellex %',
  standard_doh: 'Standard DoH',
};

// sellex_pct hidden from UI per GM-only restriction (2026-04-27 pivot); data/API retained
const DEFAULT_TYPE_TABS: DefaultType[] = ['asp', 'cogs', 'return_pct', 'tax_pct', 'standard_doh'];

const VALUE_SUFFIX: Record<DefaultType, string> = {
  asp: '₹',
  cogs: '₹',
  return_pct: '%',
  tax_pct: '%',
  sellex_pct: '%',
  standard_doh: 'days',
};

export function CycleDefaultsReview({ cycleId, cycleStatus, onConfirmed }: Props) {
  const canEditDefaults = !cycleStatus || cycleStatus === 'Draft';
  const isCycleApproved = cycleStatus === 'Approved';
  const [defaults, setDefaults] = useState<CycleDefault[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [activeTab, setActiveTab] = useState<DefaultType>('asp');
  const [editedValues, setEditedValues] = useState<Map<string, number>>(new Map());

  const loadDefaults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cycles/${cycleId}/defaults`);
      if (!res.ok) {
        message.error('Failed to load defaults');
        setLoading(false);
        return;
      }
      const data = await res.json();
      if ((data.defaults || []).length === 0 && cycleStatus === 'Draft') {
        // Auto-initialize from master data on first visit (Draft only)
        setInitializing(true);
        const postRes = await fetch(`/api/cycles/${cycleId}/defaults`, { method: 'POST' });
        const postData = await postRes.json();
        setInitializing(false);
        if (!postRes.ok) {
          message.error(postData.error || 'Failed to initialize defaults');
        } else {
          setDefaults(postData.defaults || []);
          setConfirmed(postData.defaults_confirmed || false);
        }
      } else {
        setDefaults(data.defaults || []);
        setConfirmed(data.defaults_confirmed || false);
      }
    } catch {
      message.error('Failed to load defaults');
    }
    setLoading(false);
  }, [cycleId]);

  useEffect(() => { loadDefaults(); }, [loadDefaults]);

  const handleValueChange = (id: string, value: number | null) => {
    if (value === null) return;
    setEditedValues(prev => new Map(prev).set(id, value));
  };

  const handleSaveChanges = async () => {
    if (editedValues.size === 0) return;
    setSaving(true);
    try {
      const updates = Array.from(editedValues.entries()).map(([id, value]) => ({ id, value }));
      const res = await fetch(`/api/cycles/${cycleId}/defaults`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error || 'Failed to save changes');
        return;
      }
      message.success(`Saved ${updates.length} changes`);
      setEditedValues(new Map());
      loadDefaults();
    } catch {
      message.error('Network error');
    }
    setSaving(false);
  };

  const handleConfirm = async () => {
    // Save pending edits first
    if (editedValues.size > 0) {
      await handleSaveChanges();
    }

    Modal.confirm({
      title: 'Confirm Defaults',
      icon: <ExclamationCircleOutlined />,
      content: 'Once confirmed, these values will be used to generate the OTB grid. You can unlock to edit later while the cycle is still in Draft.',
      onOk: async () => {
        setConfirming(true);
        try {
          const res = await fetch(`/api/cycles/${cycleId}/defaults/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirmed: true }),
          });
          const data = await res.json();
          if (!res.ok) {
            message.error(data.error || 'Failed to confirm defaults');
            return;
          }
          setConfirmed(true);
          message.success('Defaults confirmed!');
          onConfirmed();
        } catch {
          message.error('Network error');
        }
        setConfirming(false);
      },
    });
  };

  const handleUnconfirm = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`/api/cycles/${cycleId}/defaults/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error || 'Failed to unlock defaults');
        return;
      }
      setConfirmed(false);
      message.success('Defaults unlocked. You can now edit values.');
    } catch {
      message.error('Network error');
    }
    setConfirming(false);
  };

  if (loading || initializing) return <Spin size="large" style={{ display: 'block', margin: '48px auto' }} />;

  // Filter defaults for active tab
  const tabDefaults = defaults.filter(d => d.default_type === activeTab);

  // Build columns based on active tab
  const columns = buildColumns(activeTab, confirmed, editedValues, handleValueChange);

  // Build data source with edited values applied
  const dataSource = tabDefaults.map(d => ({
    ...d,
    displayValue: editedValues.has(d.id) ? editedValues.get(d.id)! : d.value,
  }));

  const hasEdits = editedValues.size > 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Title level={4} style={{ margin: 0 }}>Review & Confirm Defaults</Title>
          {confirmed && <Tag icon={<CheckCircleOutlined />} color="success">Confirmed</Tag>}
        </Space>
        <Space>
          {!confirmed && hasEdits && (
            <Button onClick={handleSaveChanges} loading={saving}>
              Save Changes ({editedValues.size})
            </Button>
          )}
          {confirmed ? (
            <Tooltip
              title={
                canEditDefaults
                  ? ''
                  : isCycleApproved
                  ? 'Cycle is approved — defaults cannot be edited.'
                  : `Cycle is in ${cycleStatus} — defaults can only be edited while the cycle is in Draft.`
              }
            >
              <Button
                onClick={handleUnconfirm}
                loading={confirming}
                disabled={!canEditDefaults}
              >
                Unlock to Edit
              </Button>
            </Tooltip>
          ) : (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleConfirm}
              loading={confirming}
            >
              Confirm Defaults
            </Button>
          )}
        </Space>
      </div>

      {confirmed && (
        <Alert
          message={
            canEditDefaults
              ? "Defaults are confirmed and locked. Click 'Unlock to Edit' to make changes."
              : isCycleApproved
              ? 'Defaults are confirmed and locked. The cycle has been approved, so defaults can no longer be edited.'
              : `Defaults are confirmed and locked. The cycle is now in ${cycleStatus} — defaults can only be edited while the cycle is in Draft.`
          }
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Tabs
        activeKey={activeTab}
        onChange={key => setActiveTab(key as DefaultType)}
        items={DEFAULT_TYPE_TABS.map(type => ({
          key: type,
          label: (
            <Space size={4}>
              {DEFAULT_TYPE_LABELS[type]}
              <Tag>{defaults.filter(d => d.default_type === type).length}</Tag>
            </Space>
          ),
        }))}
      />

      <Table
        dataSource={dataSource}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 50, showSizeChanger: true }}
        size="small"
        scroll={{ y: 500 }}
      />
    </div>
  );
}

function buildColumns(
  type: DefaultType,
  confirmed: boolean,
  editedValues: Map<string, number>,
  onValueChange: (id: string, value: number | null) => void
) {
  const columns: any[] = [];

  // Dimension columns based on type
  if (type !== 'tax_pct') {
    columns.push({
      title: 'Sub Brand',
      dataIndex: 'sub_brand',
      key: 'sub_brand',
      sorter: (a: any, b: any) => (a.sub_brand || '').localeCompare(b.sub_brand || ''),
    });
  }

  columns.push({
    title: 'Sub Category',
    dataIndex: 'sub_category',
    key: 'sub_category',
    sorter: (a: any, b: any) => (a.sub_category || '').localeCompare(b.sub_category || ''),
  });

  if (['asp', 'return_pct', 'sellex_pct'].includes(type)) {
    columns.push({
      title: 'Channel',
      dataIndex: 'channel',
      key: 'channel',
      sorter: (a: any, b: any) => (a.channel || '').localeCompare(b.channel || ''),
    });
  }

  // Value column (editable)
  const suffix = VALUE_SUFFIX[type];
  columns.push({
    title: `Value (${suffix})`,
    dataIndex: 'displayValue',
    key: 'value',
    width: 180,
    sorter: (a: any, b: any) => a.displayValue - b.displayValue,
    render: (value: number, record: any) => {
      if (confirmed) {
        return <span>{formatValue(value, type)}</span>;
      }
      const isEdited = editedValues.has(record.id);
      return (
        <InputNumber
          value={value}
          onChange={v => onValueChange(record.id, v)}
          min={type === 'asp' ? 0.01 : 0}
          max={['return_pct', 'tax_pct', 'sellex_pct'].includes(type) ? 100 : undefined}
          step={['return_pct', 'tax_pct', 'sellex_pct'].includes(type) ? 0.1 : 1}
          precision={2}
          style={{
            width: 140,
            borderColor: isEdited ? '#1677ff' : undefined,
          }}
          addonAfter={suffix === '₹' ? '₹' : suffix === '%' ? '%' : suffix}
        />
      );
    },
  });

  // Edited indicator
  if (!confirmed) {
    columns.push({
      title: '',
      key: 'edited',
      width: 40,
      render: (_: any, record: any) =>
        editedValues.has(record.id) ? (
          <EditOutlined style={{ color: '#1677ff' }} />
        ) : null,
    });
  }

  return columns;
}

function formatValue(value: number, type: DefaultType): string {
  if (['return_pct', 'tax_pct', 'sellex_pct'].includes(type)) {
    return `${value.toFixed(1)}%`;
  }
  if (['asp', 'cogs'].includes(type)) {
    return `₹${value.toFixed(2)}`;
  }
  return `${value}`;
}
