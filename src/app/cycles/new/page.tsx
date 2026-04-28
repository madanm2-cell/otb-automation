'use client';

import { useState } from 'react';
import { Form, Input, Select, Button, message, Typography, Card } from 'antd';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useBrand } from '@/contexts/BrandContext';

const { Title } = Typography;

const QUARTERS = [
  'Q1-FY26', 'Q2-FY26', 'Q3-FY26', 'Q4-FY26',
  'Q1-FY27', 'Q2-FY27', 'Q3-FY27', 'Q4-FY27',
];

export default function NewCyclePage() {
  const { brands } = useBrand();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [form] = Form.useForm();

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
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="cycle_name" label="Cycle Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Bewakoof Q4 FY26" />
          </Form.Item>
          <Form.Item name="brand_id" label="Brand" rules={[{ required: true }]}>
            <Select placeholder="Select brand">
              {brands.map(b => (
                <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>
              ))}
            </Select>
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
