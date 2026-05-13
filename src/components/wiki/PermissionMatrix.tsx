// src/components/wiki/PermissionMatrix.tsx
'use client';

import { Table, Tag, Typography } from 'antd';
import { CheckOutlined, MinusOutlined } from '@ant-design/icons';
import { COLORS, SPACING } from '@/lib/designTokens';
import { ROLE_DESCRIPTIONS, PERMISSION_ROWS } from '@/lib/wiki-content';

const { Text } = Typography;

const COLUMNS = [
  { key: 'admin',    label: 'Admin' },
  { key: 'planning', label: 'Planning' },
  { key: 'gd',       label: 'Growth Director' },
  { key: 'finance',  label: 'Finance' },
  { key: 'cxo',      label: 'CXO' },
  { key: 'readOnly', label: 'Read Only' },
] as const;

function Check({ has }: { has: boolean }) {
  return has ? (
    <CheckOutlined style={{ color: COLORS.success, fontSize: 14 }} />
  ) : (
    <MinusOutlined style={{ color: COLORS.textMuted, fontSize: 12 }} />
  );
}

export function PermissionMatrix() {
  const tableColumns = [
    {
      title: 'Permission',
      dataIndex: 'label',
      key: 'label',
      width: 220,
      render: (label: string) => (
        <Text style={{ fontSize: 13 }}>{label}</Text>
      ),
    },
    ...COLUMNS.map(({ key, label }) => ({
      title: label,
      dataIndex: key,
      key,
      align: 'center' as const,
      width: 120,
      render: (has: boolean) => <Check has={has} />,
    })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xl }}>
      {/* Role description cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: SPACING.md,
        }}
      >
        {ROLE_DESCRIPTIONS.map((r) => (
          <div
            key={r.role}
            style={{
              padding: SPACING.md,
              background: COLORS.surface,
              border: `1px solid ${COLORS.borderLight}`,
              borderRadius: 8,
            }}
          >
            <Tag color="blue" style={{ marginBottom: SPACING.xs, fontWeight: 600 }}>
              {r.role}
            </Tag>
            <Text
              style={{
                fontSize: 12,
                color: COLORS.textSecondary,
                display: 'block',
                lineHeight: 1.5,
              }}
            >
              {r.description}
            </Text>
          </div>
        ))}
      </div>

      {/* Permission matrix table */}
      <Table
        dataSource={PERMISSION_ROWS.map((row, i) => ({ ...row, key: i }))}
        columns={tableColumns}
        pagination={false}
        size="small"
        bordered
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
}
