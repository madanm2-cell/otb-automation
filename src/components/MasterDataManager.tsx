'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, Table, Button, Modal, Form, Input, Select, Space, message } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import type { Brand } from '@/types/otb';

interface MasterRecord {
  id: string;
  name: string;
  brand_id?: string;
  [key: string]: any;
}

const TABS = [
  { key: 'brands', label: 'Brands', fields: ['name'] },
  { key: 'sub_brands', label: 'Sub Brands', fields: ['name', 'brand_id'] },
  { key: 'sub_categories', label: 'Sub Categories', fields: ['name'] },
  { key: 'channels', label: 'Channels', fields: ['name'] },
  { key: 'genders', label: 'Genders', fields: ['name'] },
];

export function MasterDataManager() {
  const [activeTab, setActiveTab] = useState('brands');
  const [data, setData] = useState<MasterRecord[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MasterRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const loadData = useCallback(async (type: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/master-data/${type}`);
      const result = await res.json();
      setData(Array.isArray(result) ? result : []);
    } catch {
      setData([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData(activeTab);
  }, [activeTab, loadData]);

  useEffect(() => {
    fetch('/api/master-data/brands')
      .then(r => r.json())
      .then(d => setBrands(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const tabConfig = TABS.find(t => t.key === activeTab)!;

  const handleSave = async (values: any) => {
    setSaving(true);
    const method = editing ? 'PUT' : 'POST';
    const body = editing ? { id: editing.id, ...values } : values;

    try {
      const res = await fetch(`/api/master-data/${activeTab}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        message.error(err.error || 'Operation failed');
        return;
      }

      message.success(editing ? 'Updated' : 'Created');
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      loadData(activeTab);
    } catch {
      message.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    ...(tabConfig.fields.includes('brand_id')
      ? [{
          title: 'Brand', dataIndex: 'brand_id', key: 'brand_id',
          render: (id: string) => brands.find(b => b.id === id)?.name || id,
        }]
      : []),
    {
      title: 'Actions', key: 'actions', width: 80,
      render: (_: any, record: MasterRecord) => (
        <Button
          icon={<EditOutlined />}
          size="small"
          onClick={() => { setEditing(record); form.setFieldsValue(record); setModalOpen(true); }}
        />
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Master Data Management</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
          Add {tabConfig.label.replace(/s$/, '')}
        </Button>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={TABS.map(t => ({ key: t.key, label: t.label }))}
      />

      <Table dataSource={data} columns={columns} rowKey="id" loading={loading} />

      <Modal
        title={editing ? `Edit ${tabConfig.label.replace(/s$/, '')}` : `Add ${tabConfig.label.replace(/s$/, '')}`}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        onOk={() => form.submit()}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          {tabConfig.fields.includes('brand_id') && (
            <Form.Item name="brand_id" label="Brand" rules={[{ required: true }]}>
              <Select options={brands.map(b => ({ value: b.id, label: b.name }))} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}
