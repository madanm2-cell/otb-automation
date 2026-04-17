'use client';

import { Card, Statistic, Tag } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { COLORS, SHADOWS, CARD_STYLES } from '@/lib/designTokens';
import type { ReactNode } from 'react';

export interface MetricCardProps {
  title: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  precision?: number;
  trend?: { value: number; direction: 'up' | 'down' | 'flat' };
  color?: string;
  icon?: ReactNode;
  loading?: boolean;
  size?: 'default' | 'compact';
  onClick?: () => void;
}

export function MetricCard({
  title,
  value,
  prefix,
  suffix,
  precision,
  trend,
  color,
  icon,
  loading = false,
  size = 'default',
  onClick,
}: MetricCardProps) {
  const isCompact = size === 'compact';
  const valueFontSize = isCompact ? 24 : 32;

  return (
    <Card
      hoverable={!!onClick}
      onClick={onClick}
      loading={loading}
      style={{
        ...CARD_STYLES,
        cursor: onClick ? 'pointer' : 'default',
      }}
      styles={{
        body: { padding: isCompact ? 16 : 24 },
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: COLORS.textMuted,
            marginBottom: isCompact ? 6 : 10,
          }}>
            {title}
          </div>
          <Statistic
            value={typeof value === 'string' ? undefined : value}
            formatter={typeof value === 'string' ? () => value : undefined}
            prefix={prefix}
            suffix={suffix}
            precision={precision}
            valueStyle={{
              fontSize: valueFontSize,
              fontWeight: 700,
              color: color || COLORS.textPrimary,
              lineHeight: 1.2,
            }}
          />
          {trend && (
            <Tag
              color={trend.direction === 'up' ? 'success' : trend.direction === 'down' ? 'error' : 'default'}
              style={{ marginTop: 8, borderRadius: 4, fontSize: 12 }}
            >
              {trend.direction === 'up' && <ArrowUpOutlined />}
              {trend.direction === 'down' && <ArrowDownOutlined />}
              {' '}{Math.abs(trend.value).toFixed(1)}%
            </Tag>
          )}
        </div>
        {icon && (
          <div style={{
            width: isCompact ? 36 : 44,
            height: isCompact ? 36 : 44,
            borderRadius: isCompact ? 8 : 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: color ? `${color}15` : COLORS.accentLight,
            color: color || COLORS.accent,
            fontSize: isCompact ? 18 : 22,
            flexShrink: 0,
          }}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
