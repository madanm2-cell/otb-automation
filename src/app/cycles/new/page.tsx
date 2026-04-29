'use client';

import { useState, useEffect } from 'react';
import { Form, Input, Select, Button, message, Typography, Card } from 'antd';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useBrand } from '@/contexts/BrandContext';
import type { UserProfile } from '@/types/otb';

const { Title } = Typography;

const QUARTERS = [
  'Q1-FY26', 'Q2-FY26', 'Q3-FY26', 'Q4-FY26',
  'Q1-FY27', 'Q2-FY27', 'Q3-FY27', 'Q4-FY27',
];

export default function NewCyclePage() {
  const { brands, selectedBrandId } = useBrand();
  const [loading, setLoading] = useState(false);
  const [gdUsers, setGdUsers] = useState<UserProfile[]>([]);
  const [filteredGds, setFilteredGds] = useState<UserProfile[]>([]);
  const router = useRouter();
  const [form] = Form.useForm();

  // Brands available for selection: if a specific brand is active, restrict to it.
  // If "All Brands" (selectedBrandId === null for admin), show all brands.
  const brandOptions = selectedBrandId
    ? brands.filter(b => b.id === selectedBrandId)
    : brands;

  // Fetch all active GD users on mount
  useEffect(() => {
    fetch('/api/users/gd-options')
      .then(r => r.ok ? r.json() : [])
      .then(users => {
        if (Array.isArray(users)) setGdUsers(users);
      })
      .catch(() => {});
  }, []);

  // Watch brand field and filter GDs, auto-select if single match
  const watchedBrandId = Form.useWatch('brand_id', form);

  useEffect(() => {
    if (!watchedBrandId) {
      setFilteredGds([]);
      form.setFieldValue('assigned_gd_id', undefined);
      return;
    }
    const gds = gdUsers.filter(u =>
      Array.isArray(u.assigned_brands) && u.assigned_brands.includes(watchedBrandId)
    );
    setFilteredGds(gds);
    if (gds.length === 1) {
      form.setFieldValue('assigned_gd_id', gds[0].id);
    } else {
      form.setFieldValue('assigned_gd_id', undefined);
    }
  }, [watchedBrandId, gdUsers, form]);

  const onFinish = async (values: Record<string, unknown>) => {
    setLoading(true);
    try {
      const res = await fetch('/api/cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycle_name: values.cycle_name,
          brand_id: values.brand_id,
          planning_quarter: values.planning_quarter,
          assigned_gd_id: values.assigned_gd_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error || 'Failed to create cycle');
        return;
      }
      message.success('Cycle created');
      router.push(`/cycles/${data.id}`);
    } catch {
      message.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute permission="create_cycle">
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <Title level={2}>Create New OTB Cycle</Title>
      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ brand_id: selectedBrandId ?? undefined }}
        >
          <Form.Item name="cycle_name" label="Cycle Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Bewakoof Q4 FY26" />
          </Form.Item>
          <Form.Item name="brand_id" label="Brand" rules={[{ required: true }]}>
            <Select placeholder="Select brand" disabled={!!selectedBrandId}>
              {brandOptions.map(b => (
                <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="assigned_gd_id"
            label="Assign GD"
            rules={[{ required: true, message: 'Please assign a GD' }]}
          >
            <Select
              placeholder={watchedBrandId ? 'Select GD' : 'Select a brand first'}
              disabled={!watchedBrandId || filteredGds.length === 0}
              options={filteredGds.map(u => ({ value: u.id, label: `${u.full_name} (${u.email})` }))}
            />
          </Form.Item>
          <Form.Item name="planning_quarter" label="Planning Quarter" rules={[{ required: true }]}>
            <Select placeholder="Select quarter">
              {QUARTERS.map(q => (
                <Select.Option key={q} value={q}>{q}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Create Cycle
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
    </ProtectedRoute>
  );
}
