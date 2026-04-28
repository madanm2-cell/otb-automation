'use client';

import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Switch, Tag, Space, message } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import type { UserProfile, Role, Brand } from '@/types/otb';

const ROLES: Role[] = ['Admin', 'Planning', 'GD', 'Finance', 'CXO', 'ReadOnly'];

const ROLE_COLORS: Record<Role, string> = {
  Admin: 'red', Planning: 'blue', GD: 'green',
  Finance: 'orange', CXO: 'purple', ReadOnly: 'default',
};

export function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/users').then(r => r.json()),
      fetch('/api/master-data/brands').then(r => r.json()),
    ]).then(([usersData, brandsData]) => {
      setUsers(Array.isArray(usersData) ? usersData : []);
      setBrands(Array.isArray(brandsData) ? brandsData : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleSave(values: any) {
    setSaving(true);
    const url = editingUser
      ? `/api/admin/users/${editingUser.id}`
      : '/api/admin/users';
    const method = editingUser ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const err = await res.json();
        message.error(err.error || 'Operation failed');
        return;
      }

      message.success(editingUser ? 'User updated' : 'User created');
      setModalOpen(false);
      setEditingUser(null);
      form.resetFields();
      // Refresh
      const data = await fetch('/api/admin/users').then(r => r.json());
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      message.error('Network error');
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { title: 'Name', dataIndex: 'full_name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Role', dataIndex: 'role', key: 'role',
      render: (role: Role) => <Tag color={ROLE_COLORS[role]}>{role}</Tag>,
    },
    {
      title: 'Assigned Brands', dataIndex: 'assigned_brands', key: 'brands',
      render: (brandIds: string[]) => brandIds?.map(id => {
        const brand = brands.find(b => b.id === id);
        return brand ? <Tag key={id}>{brand.name}</Tag> : null;
      }),
    },
    {
      title: 'Active', dataIndex: 'is_active', key: 'active',
      render: (active: boolean) => <Tag color={active ? 'green' : 'red'}>{active ? 'Yes' : 'No'}</Tag>,
    },
    {
      title: 'Actions', key: 'actions',
      render: (_: any, record: UserProfile) => (
        <Button
          icon={<EditOutlined />}
          size="small"
          onClick={() => { setEditingUser(record); form.setFieldsValue(record); setModalOpen(true); }}
        />
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>User Management</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingUser(null); form.resetFields(); setModalOpen(true); }}>
          Add User
        </Button>
      </div>

      <Table dataSource={users} columns={columns} rowKey="id" loading={loading} />

      <Modal
        title={editingUser ? 'Edit User' : 'Create User'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingUser(null); }}
        onOk={() => form.submit()}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          {!editingUser && (
            <>
              <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="password" label="Password" rules={[{ required: true, min: 12 }]}>
                <Input.Password />
              </Form.Item>
            </>
          )}
          <Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select options={ROLES.map(r => ({ value: r, label: r }))} />
          </Form.Item>
          <Form.Item
            name="assigned_brands"
            label="Assigned Brands"
            tooltip="Required for all non-Admin roles"
            rules={[{
              validator: async (_, value) => {
                const role = form.getFieldValue('role');
                if (role && role !== 'Admin' && (!value || value.length === 0)) {
                  throw new Error('At least one brand must be assigned for non-Admin roles');
                }
              },
            }]}
          >
            <Select
              mode="multiple"
              options={brands.map(b => ({ value: b.id, label: b.name }))}
              placeholder="Select brands"
            />
          </Form.Item>
          {editingUser && (
            <Form.Item name="is_active" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}
