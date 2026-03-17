'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, Table, Button, Modal, Form, Input, Select, Space, message, Alert } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import type { Brand, WearType } from '@/types/otb';

interface MasterRecord {
  id: string;
  name: string;
  brand_id?: string;
  wear_type_id?: string;
  [key: string]: any;
}

interface TabConfig {
  key: string;
  label: string;
  fields: string[];
  brandScoped: boolean;
}

const TABS: TabConfig[] = [
  { key: 'brands', label: 'Brands', fields: ['name'], brandScoped: false },
  { key: 'sub_brands', label: 'Sub Brands', fields: ['name'], brandScoped: true },
  { key: 'wear_types', label: 'Wear Types', fields: ['name'], brandScoped: true },
  { key: 'sub_categories', label: 'Sub Categories', fields: ['name', 'wear_type_id'], brandScoped: true },
  { key: 'channels', label: 'Channels', fields: ['name'], brandScoped: true },
  { key: 'genders', label: 'Genders', fields: ['name'], brandScoped: true },
];

export function MasterDataManager() {
  const [activeTab, setActiveTab] = useState('brands');
  const [data, setData] = useState<MasterRecord[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [wearTypes, setWearTypes] = useState<WearType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MasterRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const tabConfig = TABS.find(t => t.key === activeTab)!;

  const loadData = useCallback(async (type: string, brandId: string | null) => {
    setLoading(true);
    try {
      const tab = TABS.find(t => t.key === type)!;
      const url = tab.brandScoped && brandId
        ? `/api/master-data/${type}?brandId=${brandId}`
        : `/api/master-data/${type}`;
      const res = await fetch(url);
      const result = await res.json();
      setData(Array.isArray(result) ? result : []);
    } catch {
      setData([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData(activeTab, selectedBrandId);
  }, [activeTab, selectedBrandId, loadData]);

  // Load brands list
  useEffect(() => {
    fetch('/api/master-data/brands')
      .then(r => r.json())
      .then(d => setBrands(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Load wear types for selected brand (needed for sub_categories form)
  useEffect(() => {
    if (selectedBrandId) {
      fetch(`/api/master-data/wear_types?brandId=${selectedBrandId}`)
        .then(r => r.json())
        .then(d => setWearTypes(Array.isArray(d) ? d : []))
        .catch(() => setWearTypes([]));
    } else {
      setWearTypes([]);
    }
  }, [selectedBrandId]);

  const handleSave = async (values: any) => {
    setSaving(true);
    const method = editing ? 'PUT' : 'POST';
    const body = editing
      ? { id: editing.id, ...values }
      : tabConfig.brandScoped
        ? { ...values, brand_id: selectedBrandId }
        : values;

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
      loadData(activeTab, selectedBrandId);
    } catch {
      message.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    ...(activeTab === 'sub_categories'
      ? [{
          title: 'Wear Type', dataIndex: 'wear_type_id', key: 'wear_type_id',
          render: (id: string) => wearTypes.find(wt => wt.id === id)?.name || '-',
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

  const brandScopedDisabled = tabConfig.brandScoped && !selectedBrandId;

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Master Data Management</h2>
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
            disabled={brandScopedDisabled}
            onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}
          >
            Add {tabConfig.label.replace(/s$/, '')}
          </Button>
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={TABS.map(t => ({ key: t.key, label: t.label, disabled: t.brandScoped && !selectedBrandId }))}
      />

      {brandScopedDisabled ? (
        <Alert message="Select a brand to manage its master data" type="info" showIcon />
      ) : (
        <Table dataSource={data} columns={columns} rowKey="id" loading={loading} />
      )}

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
          {activeTab === 'sub_categories' && (
            <Form.Item name="wear_type_id" label="Wear Type">
              <Select
                allowClear
                placeholder="Select wear type"
                options={wearTypes.map(wt => ({ value: wt.id, label: wt.name }))}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}
