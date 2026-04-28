'use client';

import { useState } from 'react';
import { Card, Form, Input, Button, Typography, Alert, Space } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { COLORS, SHADOWS } from '@/lib/designTokens';

const { Title, Text } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') ?? '/';

  async function handleLogin(values: { email: string; password: string }) {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Full navigation (not client-side) so AuthProvider remounts and
    // picks up the new session from /api/auth/me.
    window.location.href = `/brand-select?returnTo=${encodeURIComponent(redirectTo)}`;
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
    }}>
      <Card style={{
        width: 420,
        borderRadius: 16,
        boxShadow: SHADOWS.lg,
        border: 'none',
      }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <img src="/tmrw-logo.png" alt="TMRW" style={{ height: 36, marginBottom: 12 }} />
            <Title level={3} style={{ margin: 0, color: COLORS.primary }}>
              OTB Platform
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Open-To-Buy inventory planning
            </Text>
          </div>
          {error && <Alert type="error" message={error} closable onClose={() => setError(null)} />}
          <Form onFinish={handleLogin} layout="vertical">
            <Form.Item name="email" rules={[{ required: true, type: 'email', message: 'Enter your email' }]}>
              <Input prefix={<MailOutlined />} placeholder="Email" size="large" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: 'Enter your password' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block size="large">
                Sign In
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
