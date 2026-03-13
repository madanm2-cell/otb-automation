'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Form, Input, Select, Space, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface WearTypeMapping {
  id: string;
  sub_brand: string;
  sub_category: string;
  wear_type: string;
}

interface MasterItem {
  id: string;
  name: string;
}

export default function WearTypeMappingsPage() {
  const [mappings, setMappings] = useState<WearTypeMapping[]>([]);
  const [subBrands, setSubBrands] = useState<MasterItem[]>([]);
  const [subCategories, setSubCategories] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const loadMappings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/master-data/wear_type_mappings');
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
      fetch('/api/master-data/sub_brands').then(r => r.json()).then(d => setSubBrands(Array.isArray(d) ? d : [])),
      fetch('/api/master-data/sub_categories').then(r => r.json()).then(d => setSubCategories(Array.isArray(d) ? d : [])),
    ]);
  }, [loadMappings]);

  const handleAdd = async (values: { sub_brand: string; sub_category: string; wear_type: string }) => {
    setSaving(true);
    try {
      const res = await fetch('/api/master-data/wear_type_mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sub_brand: values.sub_brand.toLowerCase(),
          sub_category: values.sub_category.toLowerCase(),
          wear_type: values.wear_type.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        message.error(err.error || 'Failed to add mapping');
        return;
      }
      message.success('Mapping added');
      form.resetFields();
      loadMappings();
    } catch {
      message.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch('/api/master-data/wear_type_mappings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const err = await res.json();
        message.error(err.error || 'Failed to delete');
        return;
      }
      message.success('Mapping deleted');
      loadMappings();
    } catch {
      message.error('Network error');
    }
  };

  const columns = [
    { title: 'Sub Brand', dataIndex: 'sub_brand', key: 'sub_brand' },
    { title: 'Sub Category', dataIndex: 'sub_category', key: 'sub_category' },
    { title: 'Wear Type', dataIndex: 'wear_type', key: 'wear_type' },
    {
      title: 'Actions', key: 'actions', width: 80,
      render: (_: unknown, record: WearTypeMapping) => (
        <Popconfirm title="Delete this mapping?" onConfirm={() => handleDelete(record.id)}>
          <Button icon={<DeleteOutlined />} size="small" danger />
        </Popconfirm>
      ),
    },
  ];

  return (
    <ProtectedRoute permission="manage_master_data">
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Wear Type Mappings</h2>
        <p style={{ color: '#666', margin: '4px 0 16px' }}>
          Map each sub brand × sub category combination to a wear type (e.g. NWW, WW).
          Used during template generation to assign wear types to plan rows.
        </p>

        <Form form={form} layout="inline" onFinish={handleAdd}>
          <Form.Item name="sub_brand" rules={[{ required: true, message: 'Required' }]}>
            <Select
              placeholder="Sub Brand"
              style={{ width: 160 }}
              showSearch
              options={subBrands.map(s => ({ value: s.name.toLowerCase(), label: s.name }))}
            />
          </Form.Item>
          <Form.Item name="sub_category" rules={[{ required: true, message: 'Required' }]}>
            <Select
              placeholder="Sub Category"
              style={{ width: 160 }}
              showSearch
              options={subCategories.map(s => ({ value: s.name.toLowerCase(), label: s.name }))}
            />
          </Form.Item>
          <Form.Item name="wear_type" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="Wear Type (e.g. NWW)" style={{ width: 140 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={saving}>
              Add
            </Button>
          </Form.Item>
        </Form>
      </div>

      <Table
        dataSource={mappings}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
      />
    </ProtectedRoute>
  );
}
