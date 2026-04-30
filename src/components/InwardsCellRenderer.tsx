'use client';

import { CheckOutlined } from '@ant-design/icons';
import { Button } from 'antd';

interface Props {
  value: number | null;
  suggestedValue: number | null;
  onAccept: () => void;
}

export function InwardsCellRenderer({ value, suggestedValue, onAccept }: Props) {
  if (suggestedValue != null && (value == null || value === 0)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: '100%' }}>
        <span style={{ color: '#aaa', fontStyle: 'italic', fontSize: 13 }}>
          {suggestedValue.toLocaleString('en-IN')}
        </span>
        <Button
          type="text"
          size="small"
          icon={<CheckOutlined />}
          onClick={e => { e.stopPropagation(); onAccept(); }}
          style={{ color: '#1677ff', padding: '0 2px', minWidth: 'unset' }}
        />
      </div>
    );
  }

  return (
    <span>{value != null ? value.toLocaleString('en-IN') : '−'}</span>
  );
}
