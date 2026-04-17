'use client';

import { Tag } from 'antd';
import { CaretUpOutlined, CaretDownOutlined } from '@ant-design/icons';
import { VARIANCE_COLORS } from '@/lib/designTokens';
import type { VarianceLevel } from '@/types/otb';

export interface VarianceBadgeProps {
  value: number | null;
  level: VarianceLevel;
  showArrow?: boolean;
}

const TAG_COLORS: Record<VarianceLevel, string> = {
  green: 'success',
  yellow: 'warning',
  red: 'error',
};

export function VarianceBadge({ value, level, showArrow = true }: VarianceBadgeProps) {
  if (value === null || value === undefined) {
    return <Tag color="default">N/A</Tag>;
  }

  const isPositive = value > 0;

  return (
    <Tag
      color={TAG_COLORS[level]}
      style={{
        fontWeight: 600,
        fontSize: 12,
        borderRadius: 4,
        margin: 0,
      }}
    >
      {showArrow && (
        isPositive
          ? <CaretUpOutlined style={{ fontSize: 10, marginRight: 2 }} />
          : <CaretDownOutlined style={{ fontSize: 10, marginRight: 2 }} />
      )}
      {isPositive ? '+' : ''}{value.toFixed(1)}%
    </Tag>
  );
}
