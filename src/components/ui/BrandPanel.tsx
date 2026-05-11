'use client';

import React, { useState, useRef, useMemo } from 'react';
import { Card, Tag, Table, Button, Space, Typography, Tooltip, Modal, Input, message, Skeleton } from 'antd';
import {
  RightOutlined,
  DownOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  UndoOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { COLORS, CARD_STYLES, SPACING, STATUS_TAG_COLORS, VARIANCE_COLORS } from '@/lib/designTokens';
import { formatCrore, formatQty } from '@/lib/formatting';
import type {
  EnhancedBrandSummary,
  BrandMonthBreakdown,
  VarianceReportData,
  VarianceRow,
  VarianceLevel,
} from '@/types/otb';
import { DEFAULT_VARIANCE_THRESHOLDS } from '@/types/otb';

const { Text, Title } = Typography;

// --- Types ---

export type BrandPanelZone = 'review' | 'approved' | 'variance';

export interface BrandPanelProps {
  brand: EnhancedBrandSummary;
  zone: BrandPanelZone;
  variance?: VarianceReportData | null;
  onLoadVariance?: (cycleId: string) => void;
  onActionComplete?: () => void;
  approvalProgress?: { approved: number; pending: number; total: number };
  needsMyApproval?: boolean;
}

// --- Helpers ---

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const shortYear = String(d.getFullYear()).slice(2);
  return `${monthNames[d.getMonth()]} '${shortYear}`;
}

type VarianceMetricKey = 'gmv' | 'nsv' | 'nsq' | 'inwards' | 'closing_stock' | 'doh';

function aggregateVariancePct(rows: VarianceRow[], metric: VarianceMetricKey): number | null {
  let planned = 0;
  let actual = 0;
  let hasData = false;
  for (const row of rows) {
    const m = row[metric];
    if (m.planned != null && m.actual != null) {
      planned += m.planned;
      actual += m.actual;
      hasData = true;
    }
  }
  if (!hasData || planned === 0) return null;
  return ((actual - planned) / planned) * 100;
}

function aggregateWorstLevel(rows: VarianceRow[], metric: VarianceMetricKey): VarianceLevel {
  let worst: VarianceLevel = 'green';
  for (const row of rows) {
    const level = row[metric].level;
    if (level === 'red') return 'red';
    if (level === 'yellow') worst = 'yellow';
  }
  return worst;
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

// --- Variance Badge ---

function VarianceBadge({ label, pct, level }: { label: string; pct: number | null; level: VarianceLevel }) {
  return (
    <Tooltip title={label}>
      <div style={{ textAlign: 'center', minWidth: 80 }}>
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 2 }}>{label}</div>
        {pct === null ? (
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textMuted }}>—</div>
        ) : (
          <div style={{ fontSize: 13, fontWeight: 600, color: VARIANCE_COLORS[level] }}>
            {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
          </div>
        )}
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

  const columns = [
    {
      title: 'Sub-Category',
      dataIndex: 'sub_category',
      key: 'sub_category',
    },
    {
      title: 'GMV',
      dataIndex: 'gmv',
      key: 'gmv',
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
      title: 'GMV Share',
      dataIndex: 'pct_of_total',
      key: 'pct_of_total',
      render: (v: number) => `${v.toFixed(1)}%`,
    },
  ];

  return (
    <div style={{ marginTop: SPACING.lg }}>
      <Text strong style={{ fontSize: 13, color: COLORS.textSecondary }}>
        Top Sub-Categories by GMV
      </Text>
      <Table
        dataSource={categories}
        columns={columns}
        rowKey="sub_category"
        size="small"
        pagination={false}
        style={{ marginTop: SPACING.sm }}
      />
    </div>
  );
}

// --- Top Variance Columns (module-level, stable reference) ---

const topVarColumns = [
  { title: 'Month', dataIndex: 'month', key: 'month', render: (v: string) => formatMonth(v) },
  { title: 'Sub-Category', dataIndex: 'sub_category', key: 'sub_category' },
  { title: 'Channel', dataIndex: 'channel', key: 'channel' },
  {
    title: 'GMV Var%',
    key: 'gmv',
    render: (_: unknown, row: VarianceRow) =>
      row.gmv.variance_pct != null ? (
        <span style={{ color: VARIANCE_COLORS[row.gmv.level], fontWeight: 600 }}>
          {row.gmv.variance_pct >= 0 ? '+' : ''}{row.gmv.variance_pct.toFixed(1)}%
        </span>
      ) : '—',
  },
  {
    title: 'NSQ Var%',
    key: 'nsq',
    render: (_: unknown, row: VarianceRow) =>
      row.nsq.variance_pct != null ? (
        <span style={{ color: VARIANCE_COLORS[row.nsq.level], fontWeight: 600 }}>
          {row.nsq.variance_pct >= 0 ? '+' : ''}{row.nsq.variance_pct.toFixed(1)}%
        </span>
      ) : '—',
  },
];

// --- Variance Body ---

function VarianceBody({ variance }: { variance: VarianceReportData }) {
  // Derive counts from rows (summary field removed from VarianceReportData)
  const redCount = variance.rows.filter(r => [r.nsq, r.gmv, r.nsv, r.inwards, r.closing_stock, r.doh].some(m => m.level === 'red')).length;
  const greenCount = variance.rows.filter(r => [r.nsq, r.gmv, r.nsv, r.inwards, r.closing_stock, r.doh].every(m => m.level !== 'red' && m.level !== 'yellow')).length;
  const yellowCount = variance.rows.length - redCount - greenCount;
  const top10 = [...variance.rows]
    .sort((a, b) => {
      const aMax = Math.max(...[a.nsq, a.gmv, a.nsv, a.inwards, a.closing_stock, a.doh].map(m => Math.abs(m.variance_pct ?? 0)));
      const bMax = Math.max(...[b.nsq, b.gmv, b.nsv, b.inwards, b.closing_stock, b.doh].map(m => Math.abs(m.variance_pct ?? 0)));
      return bMax - aMax;
    })
    .slice(0, 10);

  return (
    <div style={{ marginTop: SPACING.lg }}>
      {/* RAG Summary — tile-style */}
      <div style={{ display: 'flex', gap: SPACING.md, marginBottom: SPACING.xl }}>
        <RagTile label="BEHIND PLAN" count={redCount} color={COLORS.danger} />
        <RagTile label="AT RISK" count={yellowCount} color={COLORS.warning} />
        <RagTile label="ON TRACK" count={greenCount} color={COLORS.success} />
      </div>
      {/* Top Variances */}
      {top10.length > 0 && (
        <>
          <Title level={5} style={{ margin: 0, marginBottom: SPACING.sm, color: COLORS.textPrimary }}>
            Top Variances
          </Title>
          <Table
            dataSource={top10}
            columns={topVarColumns}
            rowKey={(row) => `${row.sub_brand}-${row.wear_type}-${row.sub_category}-${row.gender}-${row.channel}-${row.month}`}
            size="small"
            pagination={false}
          />
        </>
      )}
    </div>
  );
}

function RagTile({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div
      style={{
        flex: '0 0 auto',
        minWidth: 128,
        padding: `${SPACING.sm}px ${SPACING.md}px`,
        borderLeft: `3px solid ${color}`,
        background: COLORS.background,
        borderRadius: 4,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', color: COLORS.textMuted }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1.2 }}>
        {count}
      </div>
    </div>
  );
}

// --- Zone Actions ---

function ZoneActions({
  zone,
  brand,
  approvalProgress,
  needsMyApproval,
  actionLoading,
  onApprove,
  onRequestRevision,
}: {
  zone: BrandPanelZone;
  brand: EnhancedBrandSummary;
  approvalProgress?: BrandPanelProps['approvalProgress'];
  needsMyApproval?: boolean;
  actionLoading?: boolean;
  onApprove?: () => void;
  onRequestRevision?: () => void;
}) {
  const planLink = (
    <Link href={`/cycles/${brand.cycle_id}?tab=plan`}>
      <Button type="link" icon={<LinkOutlined />}>
        Open OTB Grid
      </Button>
    </Link>
  );

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
        {needsMyApproval && (
          <>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={actionLoading}
              onClick={onApprove}
            >
              Approve
            </Button>
            <Button
              danger
              icon={<UndoOutlined />}
              loading={actionLoading}
              onClick={onRequestRevision}
            >
              Request Revision
            </Button>
          </>
        )}
        {approvalProgress && (
          <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginLeft: SPACING.sm }}>
            {approvalProgress.approved}/{approvalProgress.total} roles approved
          </Text>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <Link href={`/cycles/${brand.cycle_id}?tab=review`}>
            <Button type="link" icon={<LinkOutlined />}>
              Open Review
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (zone === 'approved') {
    return (
      <div style={{ marginTop: SPACING.lg }}>
        {planLink}
      </div>
    );
  }

  if (zone === 'variance') {
    return (
      <div style={{ marginTop: SPACING.lg, display: 'flex', gap: SPACING.sm }}>
        {planLink}
        <Link href={`/cycles/${brand.cycle_id}?tab=analyze`}>
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

export function BrandPanel(props: BrandPanelProps) {
  const {
    brand,
    zone,
    variance,
    onLoadVariance,
    onActionComplete,
    approvalProgress,
    needsMyApproval,
  } = props;
  const [expanded, setExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [revisionComment, setRevisionComment] = useState('');
  const varianceLoadedRef = useRef(false);

  const handleToggle = () => {
    const willExpand = !expanded;
    setExpanded(willExpand);

    // Header badges render instantly from brand.variance_summary (pre-aggregated server-side).
    // The full variance dataset is only needed when the user expands the row
    // (for the Top Variances table and RAG counts), so load lazily here.
    if (willExpand && zone === 'variance' && !varianceLoadedRef.current && variance == null) {
      varianceLoadedRef.current = true;
      onLoadVariance?.(brand.cycle_id);
    }
  };

  // Prefer the server-pre-aggregated variance_summary (rendered instantly on dashboard load);
  // fall back to client-side aggregation only if the summary isn't present (older API responses,
  // or when the expanded view loads the full variance and we want to reflect it immediately).
  const headerVariances = useMemo(() => {
    if (brand.variance_summary) return brand.variance_summary;
    if (!variance) return null;
    return {
      gmv: { pct: aggregateVariancePct(variance.rows, 'gmv'), level: aggregateWorstLevel(variance.rows, 'gmv') },
      nsv: { pct: aggregateVariancePct(variance.rows, 'nsv'), level: aggregateWorstLevel(variance.rows, 'nsv') },
      nsq: { pct: aggregateVariancePct(variance.rows, 'nsq'), level: aggregateWorstLevel(variance.rows, 'nsq') },
      inwards: { pct: aggregateVariancePct(variance.rows, 'inwards'), level: aggregateWorstLevel(variance.rows, 'inwards') },
      closing_stock: { pct: aggregateVariancePct(variance.rows, 'closing_stock'), level: aggregateWorstLevel(variance.rows, 'closing_stock') },
      doh: { pct: aggregateVariancePct(variance.rows, 'doh'), level: aggregateWorstLevel(variance.rows, 'doh') },
    };
  }, [brand.variance_summary, variance]);

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/cycles/${brand.cycle_id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json();
      if (res.ok) {
        message.success('Approved successfully');
        onActionComplete?.();
      } else {
        message.error(data.error || 'Failed to approve');
      }
    } catch {
      message.error('Network error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevisionSubmit = async () => {
    if (!revisionComment.trim()) {
      message.warning('Please provide a comment for the revision request');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/cycles/${brand.cycle_id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revision_requested', comment: revisionComment }),
      });
      const data = await res.json();
      if (res.ok) {
        message.success('Revision requested');
        setRevisionModalOpen(false);
        setRevisionComment('');
        onActionComplete?.();
      } else {
        message.error(data.error || 'Failed to request revision');
      }
    } catch {
      message.error('Network error');
    } finally {
      setActionLoading(false);
    }
  };

  const statusColor =
    zone === 'approved' ? 'success' : (STATUS_TAG_COLORS[brand.status] || 'default');

  const statusLabel = zone === 'approved' ? 'Approved' : brand.status;

  return (
    <>
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

          {/* Inline Metrics — plan view for review/approved; variance view for variance zone */}
          <div style={{ display: 'flex', gap: SPACING.lg, marginLeft: 'auto', flexWrap: 'wrap' }}>
            {zone === 'variance' ? (
              headerVariances ? (
                <>
                  <VarianceBadge
                    label="GMV"
                    pct={headerVariances.gmv.pct}
                    level={headerVariances.gmv.level}
                  />
                  <VarianceBadge
                    label="NSV"
                    pct={headerVariances.nsv.pct}
                    level={headerVariances.nsv.level}
                  />
                  <VarianceBadge
                    label="NSQ"
                    pct={headerVariances.nsq.pct}
                    level={headerVariances.nsq.level}
                  />
                  <VarianceBadge
                    label="Inwards"
                    pct={headerVariances.inwards.pct}
                    level={headerVariances.inwards.level}
                  />
                  <VarianceBadge
                    label="Closing Stock"
                    pct={headerVariances.closing_stock.pct}
                    level={headerVariances.closing_stock.level}
                  />
                  <VarianceBadge
                    label="DoH"
                    pct={headerVariances.doh.pct}
                    level={headerVariances.doh.level}
                  />
                </>
              ) : (
                <Space size={SPACING.lg}>
                  {['GMV', 'NSV', 'NSQ', 'Inwards', 'Closing Stock', 'DoH'].map(label => (
                    <div key={label} style={{ textAlign: 'center', minWidth: 80 }}>
                      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>{label}</div>
                      <Skeleton.Input active style={{ width: 60, height: 18 }} size="small" />
                    </div>
                  ))}
                </Space>
              )
            ) : (
              <>
                <InlineMetric label="GMV" value={formatCrore(brand.gmv)} />
                <InlineMetric label="NSV" value={formatCrore(brand.nsv)} />
                <InlineMetric label="NSQ" value={formatQty(brand.nsq)} />
                <InlineMetric label="Inwards" value={formatQty(brand.inwards_qty)} />
                <InlineMetric label="Closing Stock" value={formatQty(brand.closing_stock_qty)} />
                <InlineMetric label="DoH" value={String(Math.round(brand.avg_doh))} />
              </>
            )}
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
            {zone === 'variance' ? (
              variance ? (
                <VarianceBody variance={variance} />
              ) : (
                <Skeleton active paragraph={{ rows: 3 }} style={{ marginTop: SPACING.md }} />
              )
            ) : (
              <>
                <MonthlyTable data={brand.monthly} />
                <TopCategories categories={brand.top_categories} />
              </>
            )}
            <ZoneActions
              zone={zone}
              brand={brand}
              approvalProgress={approvalProgress}
              needsMyApproval={needsMyApproval}
              actionLoading={actionLoading}
              onApprove={handleApprove}
              onRequestRevision={() => setRevisionModalOpen(true)}
            />
          </div>
        )}
      </Card>

      <Modal
        title="Request Revision"
        open={revisionModalOpen}
        onOk={handleRevisionSubmit}
        onCancel={() => { setRevisionModalOpen(false); setRevisionComment(''); }}
        confirmLoading={actionLoading}
        okText="Submit Revision Request"
        okButtonProps={{ danger: true, icon: <ExclamationCircleOutlined /> }}
      >
        <Text>Please explain what needs to be revised:</Text>
        <Input.TextArea
          rows={4}
          value={revisionComment}
          onChange={e => setRevisionComment(e.target.value)}
          placeholder="Describe the required changes..."
          style={{ marginTop: 8 }}
        />
      </Modal>
    </>
  );
}
