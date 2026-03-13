'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, Select, DatePicker, Button, Tag, Space, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Text } = Typography;

interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  user_email: string | null;
  user_role: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

const ENTITY_TYPES = ['cycle', 'plan_data', 'file_upload', 'user', 'master_data'];
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'SUBMIT', 'APPROVE', 'REJECT', 'REVERT', 'LOGIN', 'LOGOUT', 'UPLOAD', 'ACTIVATE', 'ASSIGN'];

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'green', UPDATE: 'blue', DELETE: 'red',
  SUBMIT: 'purple', APPROVE: 'cyan', REJECT: 'orange',
  UPLOAD: 'geekblue', ACTIVATE: 'lime', ASSIGN: 'gold',
  LOGIN: 'default', LOGOUT: 'default', REVERT: 'volcano',
};

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [entityType, setEntityType] = useState<string | undefined>();
  const [action, setAction] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (entityType) params.set('entityType', entityType);
    if (action) params.set('action', action);
    if (dateRange?.[0]) params.set('from', dateRange[0].toISOString());
    if (dateRange?.[1]) params.set('to', dateRange[1].toISOString());

    try {
      const res = await fetch(`/api/admin/audit-logs?${params}`);
      const data = await res.json();
      setLogs(data.data || []);
      setTotal(data.total || 0);
    } catch {
      setLogs([]);
    }
    setLoading(false);
  }, [page, pageSize, entityType, action, dateRange]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (dateRange?.[0]) params.set('from', dateRange[0].toISOString());
    if (dateRange?.[1]) params.set('to', dateRange[1].toISOString());
    window.open(`/api/admin/audit-logs/export?${params}`, '_blank');
  };

  const columns: ColumnsType<AuditLog> = [
    {
      title: 'Timestamp', dataIndex: 'created_at', key: 'created_at', width: 180,
      render: (v: string) => dayjs(v).format('DD MMM YYYY HH:mm:ss'),
    },
    {
      title: 'Action', dataIndex: 'action', key: 'action', width: 100,
      render: (v: string) => <Tag color={ACTION_COLORS[v] || 'default'}>{v}</Tag>,
    },
    {
      title: 'Entity', dataIndex: 'entity_type', key: 'entity_type', width: 120,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    { title: 'User', dataIndex: 'user_email', key: 'user_email', width: 200 },
    {
      title: 'Role', dataIndex: 'user_role', key: 'user_role', width: 90,
      render: (v: string) => v ? <Tag>{v}</Tag> : null,
    },
    {
      title: 'Details', dataIndex: 'details', key: 'details',
      render: (v: Record<string, any> | null) => v ? (
        <Text style={{ fontSize: 12 }} code>{JSON.stringify(v)}</Text>
      ) : null,
    },
    { title: 'IP', dataIndex: 'ip_address', key: 'ip_address', width: 130 },
  ];

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Audit Logs</h2>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>Export CSV</Button>
      </div>

      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          placeholder="Entity Type"
          allowClear
          style={{ width: 160 }}
          value={entityType}
          onChange={v => { setEntityType(v); setPage(1); }}
          options={ENTITY_TYPES.map(t => ({ value: t, label: t }))}
        />
        <Select
          placeholder="Action"
          allowClear
          style={{ width: 140 }}
          value={action}
          onChange={v => { setAction(v); setPage(1); }}
          options={ACTIONS.map(a => ({ value: a, label: a }))}
        />
        <RangePicker
          onChange={(dates) => {
            setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null);
            setPage(1);
          }}
        />
      </Space>

      <Table
        dataSource={logs}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: setPage,
          showTotal: (t) => `${t} entries`,
        }}
        size="small"
        scroll={{ x: 1100 }}
      />
    </>
  );
}
