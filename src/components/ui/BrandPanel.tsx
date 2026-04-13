'use client';

import React, { useState, useRef } from 'react';
import { Card, Tag, Table, Button, Space, Typography, Tooltip } from 'antd';
import {
  RightOutlined,
  DownOutlined,
  CheckCircleOutlined,
  UndoOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { COLORS, CARD_STYLES, SPACING, STATUS_TAG_COLORS } from '@/lib/designTokens';
import { formatCrore, formatQty } from '@/lib/formatting';
import type {
  EnhancedBrandSummary,
  BrandMonthBreakdown,
  VarianceReportData,
} from '@/types/otb';

const { Text } = Typography;

// --- Types ---

export type BrandPanelZone = 'review' | 'approved' | 'variance';

export interface BrandPanelProps {
  brand: EnhancedBrandSummary;
  zone: BrandPanelZone;
  variance?: VarianceReportData | null;
  onLoadVariance?: (cycleId: string) => void;
  onApprove?: (cycleId: string) => void;
  onRequestRevision?: (cycleId: string) => void;
  approvalProgress?: { approved: number; pending: number; total: number };
}

// --- Helpers ---

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const shortYear = String(d.getFullYear()).slice(2);
  return `${monthNames[d.getMonth()]} '${shortYear}`;
}

// --- Inline Metric ---

interface InlineMetricProps {
  label: string;
  value: string;
}

function InlineMetric({ label, value }: InlineMetricProps) {
  return (
    <Tooltip title={label}>
      <div style={{ textAlign: 'center', minWidth: 70 }}>
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>{value}</div>
      </div>
    </Tooltip>
  );
}

// --- Monthly Breakdown Table ---

function MonthlyTable({ data }: { data: BrandMonthBreakdown[] }) {
  const columns = [
    {
      title: 'Month',
      dataIndex: 'month',
      key: 'month',
      render: (v: string) => formatMonth(v),
    },
    {
      title: 'GMV',
      dataIndex: 'gmv',
      key: 'gmv',
      render: (v: number) => formatCrore(v),
    },
    {
      title: 'NSV',
      dataIndex: 'nsv',
      key: 'nsv',
      render: (v: number) => formatCrore(v),
    },
    {
      title: 'NSQ',
      dataIndex: 'nsq',
      key: 'nsq',
      render: (v: number) => formatQty(v),
    },
    {
      title: 'Inwards',
      dataIndex: 'inwards_qty',
      key: 'inwards_qty',
      render: (v: number) => formatQty(v),
    },
    {
      title: 'Closing Stock',
      dataIndex: 'closing_stock_qty',
      key: 'closing_stock_qty',
      render: (v: number) => formatQty(v),
    },
    {
      title: 'DoH',
      dataIndex: 'avg_doh',
      key: 'avg_doh',
      render: (v: number) => String(Math.round(v)),
    },
  ];

  return (
    <Table
      dataSource={data}
      columns={columns}
      rowKey="month"
      size="small"
      pagination={false}
      style={{ marginTop: SPACING.md }}
    />
  );
}

// --- Top Categories ---

function TopCategories({ categories }: { categories: EnhancedBrandSummary['top_categories'] }) {
  if (!categories || categories.length === 0) return null;

  const display = categories.slice(0, 5);

  return (
    <div style={{ marginTop: SPACING.lg }}>
      <Text strong style={{ fontSize: 13, color: COLORS.textSecondary }}>
        Top Sub-Categories
      </Text>
      <div style={{ marginTop: SPACING.sm }}>
        {display.map((cat) => (
          <div
            key={cat.sub_category}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: `${SPACING.xs}px 0`,
              borderBottom: `1px solid ${COLORS.borderLight}`,
            }}
          >
            <Text style={{ fontSize: 13 }}>{cat.sub_category}</Text>
            <Space size={SPACING.md}>
              <Text style={{ fontSize: 13, fontWeight: 600 }}>{formatCrore(cat.gmv)}</Text>
              <Text style={{ fontSize: 12, color: COLORS.textMuted }}>
                {cat.pct_of_total.toFixed(1)}%
              </Text>
            </Space>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Zone Actions ---

function ZoneActions({
  zone,
  brand,
  approvalProgress,
  onApprove,
  onRequestRevision,
}: {
  zone: BrandPanelZone;
  brand: EnhancedBrandSummary;
  approvalProgress?: BrandPanelProps['approvalProgress'];
  onApprove?: (cycleId: string) => void;
  onRequestRevision?: (cycleId: string) => void;
}) {
  if (zone === 'review') {
    return (
      <div
        style={{
          marginTop: SPACING.lg,
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
        }}
      >
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={() => onApprove?.(brand.cycle_id)}
        >
          Approve
        </Button>
        <Button icon={<UndoOutlined />} onClick={() => onRequestRevision?.(brand.cycle_id)}>
          Request Revision
        </Button>
        {approvalProgress && (
          <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginLeft: SPACING.sm }}>
            {approvalProgress.approved}/{approvalProgress.total} roles approved
          </Text>
        )}
      </div>
    );
  }

  if (zone === 'approved') {
    return (
      <div style={{ marginTop: SPACING.lg }}>
        <Link href={`/cycles/${brand.cycle_id}`}>
          <Button type="link" icon={<LinkOutlined />}>
            Open OTB Grid
          </Button>
        </Link>
      </div>
    );
  }

  if (zone === 'variance') {
    return (
      <div style={{ marginTop: SPACING.lg }}>
        <Link href={`/cycles/${brand.cycle_id}?tab=variance`}>
          <Button type="link" icon={<LinkOutlined />}>
            Full Variance Report
          </Button>
        </Link>
      </div>
    );
  }

  return null;
}

// --- Main Component ---

export function BrandPanel({
  brand,
  zone,
  variance,
  onLoadVariance,
  onApprove,
  onRequestRevision,
  approvalProgress,
}: BrandPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const varianceLoadedRef = useRef(false);

  const handleToggle = () => {
    const willExpand = !expanded;
    setExpanded(willExpand);

    // Lazy-load variance data on first expand
    if (willExpand && zone === 'variance' && !varianceLoadedRef.current) {
      varianceLoadedRef.current = true;
      onLoadVariance?.(brand.cycle_id);
    }
  };

  const statusColor =
    zone === 'approved' ? 'success' : (STATUS_TAG_COLORS[brand.status] || 'default');

  const statusLabel = zone === 'approved' ? 'Approved' : brand.status;

  return (
    <Card
      style={{
        ...CARD_STYLES,
        marginBottom: SPACING.md,
        cursor: 'pointer',
      }}
      styles={{ body: { padding: 0 } }}
    >
      {/* Collapsed Header (always visible) */}
      <div
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: `${SPACING.md}px ${SPACING.lg}px`,
          gap: SPACING.md,
        }}
      >
        {/* Chevron */}
        <span style={{ fontSize: 12, color: COLORS.textMuted, flexShrink: 0 }}>
          {expanded ? <DownOutlined /> : <RightOutlined />}
        </span>

        {/* Brand + Cycle Info */}
        <div style={{ minWidth: 160, flexShrink: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: COLORS.textPrimary }}>
            {brand.brand_name}
          </div>
          <div style={{ fontSize: 13, color: COLORS.textSecondary }}>{brand.cycle_name}</div>
        </div>

        {/* Planning Quarter */}
        <Text style={{ fontSize: 12, color: COLORS.textMuted, flexShrink: 0 }}>
          {brand.planning_quarter}
        </Text>

        {/* Status Tag */}
        <Tag color={statusColor}>{statusLabel}</Tag>

        {/* Inline Metrics */}
        <div
          style={{
            display: 'flex',
            gap: SPACING.lg,
            marginLeft: 'auto',
            flexWrap: 'wrap',
          }}
        >
          <InlineMetric label="GMV" value={formatCrore(brand.gmv)} />
          <InlineMetric label="NSV" value={formatCrore(brand.nsv)} />
          <InlineMetric label="NSQ" value={formatQty(brand.nsq)} />
          <InlineMetric label="Inwards" value={formatQty(brand.inwards_qty)} />
          <InlineMetric label="DoH" value={String(Math.round(brand.avg_doh))} />
          <InlineMetric label="Closing Stock" value={formatQty(brand.closing_stock_qty)} />
        </div>
      </div>

      {/* Expanded Body */}
      {expanded && (
        <div
          style={{
            padding: `0 ${SPACING.lg}px ${SPACING.lg}px`,
            borderTop: `1px solid ${COLORS.borderLight}`,
          }}
        >
          {/* Monthly Breakdown */}
          <MonthlyTable data={brand.monthly} />

          {/* Top Sub-Categories */}
          <TopCategories categories={brand.top_categories} />

          {/* Zone Actions */}
          <ZoneActions
            zone={zone}
            brand={brand}
            approvalProgress={approvalProgress}
            onApprove={onApprove}
            onRequestRevision={onRequestRevision}
          />
        </div>
      )}
    </Card>
  );
}
