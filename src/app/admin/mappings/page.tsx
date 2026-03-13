'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, message } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import type { Brand } from '@/types/otb';

interface Mapping {
  id: string;
  mapping_type: string;
  raw_value: string;
  standard_value: string;
  brand_id: string | null;
}

const MAPPING_TYPES = ['sub_category', 'channel', 'gender', 'sub_brand'];

export default function MappingsPage() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Mapping | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const loadMappings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/master-data/master_mappings');
      const data = await res.json();
      setMappings(Array.isArray(data) ? data : []);
    } catch {
      setMappings([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    Promise.all([
      loadMappings(),
      fetch('/api/master-data/brands').then(r => r.json()).then(d => setBrands(Array.isArray(d) ? d : [])),
    ]);
  }, [loadMappings]);

  const handleSave = async (values: any) => {
    setSaving(true);
    const method = editing ? 'PUT' : 'POST';
    const body = editing ? { id: editing.id, ...values } : values;

    try {
      const res = await fetch('/api/master-data/master_mappings', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        message.error(err.error || 'Operation failed');
        return;
      }

      message.success(editing ? 'Mapping updated' : 'Mapping created');
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      loadMappings();
    } catch {
      message.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: 'Type', dataIndex: 'mapping_type', key: 'mapping_type' },
    { title: 'Raw Value', dataIndex: 'raw_value', key: 'raw_value' },
    { title: 'Standard Value', dataIndex: 'standard_value', key: 'standard_value' },
    {
      title: 'Brand', dataIndex: 'brand_id', key: 'brand_id',
      render: (id: string | null) => id ? (brands.find(b => b.id === id)?.name || id) : 'All',
    },
    {
      title: 'Actions', key: 'actions', width: 80,
      render: (_: any, record: Mapping) => (
        <Button
          icon={<EditOutlined />}
          size="small"
          onClick={() => { setEditing(record); form.setFieldsValue(record); setModalOpen(true); }}
        />
      ),
    },
  ];

  return (
    <ProtectedRoute permission="manage_master_data">
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Value Mappings</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
          Add Mapping
        </Button>
      </div>

      <Table dataSource={mappings} columns={columns} rowKey="id" loading={loading} />

      <Modal
        title={editing ? 'Edit Mapping' : 'Add Mapping'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        onOk={() => form.submit()}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="mapping_type" label="Mapping Type" rules={[{ required: true }]}>
            <Select options={MAPPING_TYPES.map(t => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item name="raw_value" label="Raw Value" rules={[{ required: true }]}>
            <Input placeholder="Value as it appears in uploaded files" />
          </Form.Item>
          <Form.Item name="standard_value" label="Standard Value" rules={[{ required: true }]}>
            <Input placeholder="Normalized/standard value" />
          </Form.Item>
          <Form.Item name="brand_id" label="Brand (optional)">
            <Select
              allowClear
              options={brands.map(b => ({ value: b.id, label: b.name }))}
              placeholder="All brands"
            />
          </Form.Item>
        </Form>
      </Modal>
    </ProtectedRoute>
  );
}
