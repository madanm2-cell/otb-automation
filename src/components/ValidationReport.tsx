'use client';

import { Alert, Table, Tag } from 'antd';
import type { ValidationError } from '@/types/otb';

interface Props {
  valid: boolean;
  errors: ValidationError[];
  rowCount: number;
}

export default function ValidationReport({ valid, errors, rowCount }: Props) {
  if (valid) {
    return (
      <Alert
        type="success"
        message={`Validation passed — ${rowCount} rows uploaded successfully`}
        showIcon
        style={{ marginTop: 12 }}
      />
    );
  }

  const columns = [
    { title: 'Row', dataIndex: 'row', key: 'row', width: 60 },
    { title: 'Field', dataIndex: 'field', key: 'field', width: 120 },
    {
      title: 'Rule',
      dataIndex: 'rule',
      key: 'rule',
      width: 80,
      render: (rule: string) => <Tag color="red">{rule}</Tag>,
    },
    { title: 'Message', dataIndex: 'message', key: 'message' },
  ];

  return (
    <div style={{ marginTop: 12 }}>
      <Alert
        type="error"
        message={`Validation failed — ${errors.length} error(s) found`}
        showIcon
        style={{ marginBottom: 8 }}
      />
      <Table
        dataSource={errors.map((e, i) => ({ ...e, key: i }))}
        columns={columns}
        size="small"
        pagination={{ pageSize: 10 }}
        scroll={{ y: 200 }}
      />
    </div>
  );
}
