'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, Table, InputNumber, Button, Select, Space, message, Alert, Modal, Form, Input, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { Brand, DefaultType } from '@/types/otb';

const { Title } = Typography;

const DEFAULT_TYPE_TABS: { key: DefaultType; label: string; dimensions: string[] }[] = [
  { key: 'asp', label: 'ASP', dimensions: ['sub_brand', 'sub_category', 'channel'] },
  { key: 'cogs', label: 'COGS', dimensions: ['sub_brand', 'sub_category'] },
  { key: 'return_pct', label: 'Return %', dimensions: ['sub_brand', 'sub_category', 'channel'] },
  { key: 'tax_pct', label: 'Tax %', dimensions: ['sub_category'] },
  { key: 'sellex_pct', label: 'Sellex %', dimensions: ['sub_brand', 'sub_category', 'channel'] },
  { key: 'standard_doh', label: 'Standard DoH', dimensions: ['sub_brand', 'sub_category'] },
];

interface DefaultRow {
  id: string;
  sub_brand?: string;
  sub_category: string;
  channel?: string;
  [key: string]: any;
}

// Value column name differs per table
const VALUE_COL: Record<DefaultType, string> = {
  asp: 'asp',
  cogs: 'cogs',
  return_pct: 'return_pct',
  tax_pct: 'tax_pct',
  sellex_pct: 'sellex_pct',
  standard_doh: 'doh',
};

export function MasterDefaultsManager() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DefaultType>('asp');
  const [data, setData] = useState<DefaultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  // Load brands
  useEffect(() => {
    fetch('/api/master-data/brands')
      .then(r => r.json())
      .then(d => setBrands(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    if (!selectedBrandId) { setData([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/master-defaults/${activeTab}?brandId=${selectedBrandId}`);
      const result = await res.json();
      setData(Array.isArray(result) ? result : []);
    } catch {
      setData([]);
    }
    setLoading(false);
  }, [activeTab, selectedBrandId]);

  useEffect(() => { loadData(); }, [loadData]);

  const tabConfig = DEFAULT_TYPE_TABS.find(t => t.key === activeTab)!;
  const valueCol = VALUE_COL[activeTab];

  const handleAdd = async (values: any) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/master-defaults/${activeTab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: selectedBrandId,
          rows: [{ ...values, value: values[valueCol] }],
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        message.error(err.error || 'Failed to save');
        return;
      }
      message.success('Default added');
      setModalOpen(false);
      form.resetFields();
      loadData();
    } catch {
      message.error('Network error');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/master-defaults/${activeTab}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        message.error('Failed to delete');
        return;
      }
      message.success('Deleted');
      loadData();
    } catch {
      message.error('Network error');
    }
  };

  const handleInlineEdit = async (id: string, newValue: number | null) => {
    if (newValue === null) return;
    try {
      const res = await fetch(`/api/master-defaults/${activeTab}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, value: newValue }),
      });
      if (!res.ok) {
        message.error('Failed to update');
        return;
      }
      loadData();
    } catch {
      message.error('Network error');
    }
  };

  const columns: any[] = [];

  if (tabConfig.dimensions.includes('sub_brand')) {
    columns.push({ title: 'Sub Brand', dataIndex: 'sub_brand', sorter: (a: any, b: any) => (a.sub_brand || '').localeCompare(b.sub_brand || '') });
  }
  columns.push({ title: 'Sub Category', dataIndex: 'sub_category', sorter: (a: any, b: any) => (a.sub_category || '').localeCompare(b.sub_category || '') });
  if (tabConfig.dimensions.includes('channel')) {
    columns.push({ title: 'Channel', dataIndex: 'channel', sorter: (a: any, b: any) => (a.channel || '').localeCompare(b.channel || '') });
  }
  columns.push({
    title: tabConfig.label,
    dataIndex: valueCol,
    width: 180,
    render: (val: number, record: DefaultRow) => (
      <InputNumber
        defaultValue={val}
        onBlur={e => {
          const newVal = parseFloat(e.target.value);
          if (!isNaN(newVal) && newVal !== val) {
            handleInlineEdit(record.id, newVal);
          }
        }}
        min={activeTab === 'asp' ? 0.01 : 0}
        max={['return_pct', 'tax_pct', 'sellex_pct'].includes(activeTab) ? 100 : undefined}
        precision={2}
        style={{ width: 140 }}
      />
    ),
  });
  columns.push({
    title: '', key: 'actions', width: 50,
    render: (_: any, record: DefaultRow) => (
      <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(record.id)} />
    ),
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Master Data Defaults</Title>
        <Space>
          <Select
            placeholder="Select brand"
            value={selectedBrandId}
            onChange={setSelectedBrandId}
            style={{ width: 200 }}
            allowClear
            options={brands.map(b => ({ value: b.id, label: b.name }))}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!selectedBrandId}
            onClick={() => { form.resetFields(); setModalOpen(true); }}
          >
            Add Default
          </Button>
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={key => setActiveTab(key as DefaultType)}
        items={DEFAULT_TYPE_TABS.map(t => ({
          key: t.key,
          label: t.label,
          disabled: !selectedBrandId,
        }))}
      />

      {!selectedBrandId ? (
        <Alert message="Select a brand to manage its default values" type="info" showIcon />
      ) : (
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 50, showSizeChanger: true }}
          size="small"
        />
      )}

      <Modal
        title={`Add ${tabConfig.label} Default`}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          {tabConfig.dimensions.includes('sub_brand') && (
            <Form.Item name="sub_brand" label="Sub Brand" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          )}
          <Form.Item name="sub_category" label="Sub Category" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          {tabConfig.dimensions.includes('channel') && (
            <Form.Item name="channel" label="Channel" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          )}
          <Form.Item name={valueCol} label={tabConfig.label} rules={[{ required: true }]}>
            <InputNumber
              min={activeTab === 'asp' ? 0.01 : 0}
              max={['return_pct', 'tax_pct', 'sellex_pct'].includes(activeTab) ? 100 : undefined}
              precision={2}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
