'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, Table, InputNumber, Button, Space, Tag, message, Alert, Spin, Typography, Modal } from 'antd';
import { CheckCircleOutlined, EditOutlined, ReloadOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import type { CycleDefault, DefaultType } from '@/types/otb';

const { Title, Text } = Typography;

interface Props {
  cycleId: string;
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

const DEFAULT_TYPE_TABS: DefaultType[] = ['asp', 'cogs', 'return_pct', 'tax_pct', 'sellex_pct', 'standard_doh'];

const VALUE_SUFFIX: Record<DefaultType, string> = {
  asp: '₹',
  cogs: '₹',
  return_pct: '%',
  tax_pct: '%',
  sellex_pct: '%',
  standard_doh: 'days',
};

export function CycleDefaultsReview({ cycleId, onConfirmed }: Props) {
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
      const data = await res.json();
      setDefaults(data.defaults || []);
      setConfirmed(data.defaults_confirmed || false);
    } catch {
      message.error('Failed to load defaults');
    }
    setLoading(false);
  }, [cycleId]);

  useEffect(() => { loadDefaults(); }, [loadDefaults]);

  const handleInitialize = async () => {
    setInitializing(true);
    try {
      const res = await fetch(`/api/cycles/${cycleId}/defaults`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error || 'Failed to initialize defaults');
        return;
      }
      setDefaults(data.defaults || []);
      setConfirmed(data.defaults_confirmed || false);
      if (data.initialized) {
        message.success(`Initialized ${data.defaults.length} default values from master data`);
      }
    } catch {
      message.error('Network error');
    }
    setInitializing(false);
  };

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
      content: 'Once confirmed, these values will be used to generate the OTB grid. You can un-confirm later to make further changes.',
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
        message.error(data.error || 'Failed to un-confirm defaults');
        return;
      }
      setConfirmed(false);
      message.success('Defaults un-confirmed. You can now edit values.');
    } catch {
      message.error('Network error');
    }
    setConfirming(false);
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '48px auto' }} />;

  // If no defaults loaded yet, show initialize button
  if (defaults.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Title level={4}>Review & Confirm Defaults</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
          Load default values for ASP, COGS, Return%, Tax%, Sellex%, and Standard DoH from master data configuration.
        </Text>
        <Button
          type="primary"
          size="large"
          icon={<ReloadOutlined />}
          onClick={handleInitialize}
          loading={initializing}
        >
          Load Defaults from Master Data
        </Button>
      </div>
    );
  }

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
            <Button onClick={handleUnconfirm} loading={confirming}>
              Un-confirm (Edit)
            </Button>
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
          message="Defaults are confirmed and locked. Click 'Un-confirm' to make changes."
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
