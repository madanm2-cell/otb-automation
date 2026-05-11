'use client';

import { useEffect } from 'react';
import {
  Typography, Row, Col, Badge, Button, Empty, Alert, Card, Tag,
} from 'antd';
import {
  DollarOutlined, ShoppingCartOutlined, BarChartOutlined,
  InboxOutlined, ClockCircleOutlined, DatabaseOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { MetricCard } from '@/components/ui/MetricCard';
import { BrandPanel } from '@/components/ui/BrandPanel';
import { DashboardSkeleton } from '@/components/ui/PageSkeleton';
import { COLORS, SPACING, CARD_STYLES } from '@/lib/designTokens';
import type { EnhancedBrandSummary } from '@/types/otb';
import { formatCrore, formatQty } from '@/lib/formatting';

const { Title, Text } = Typography;

function getCurrentQuarter(): string {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  // Indian FY: Apr=Q1, Jul=Q2, Oct=Q3, Jan=Q4
  const fyYear = month >= 3 ? now.getFullYear() + 1 : now.getFullYear();
  const q = month >= 3 ? Math.ceil((month - 2) / 3) : 4;
  return `Q${q} FY${String(fyYear).slice(-2)}`;
}

function NoActualsRow({ brand }: { brand: EnhancedBrandSummary }) {
  return (
    <Card
      style={{ ...CARD_STYLES, marginBottom: SPACING.md }}
      styles={{ body: { padding: 0 } }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: `${SPACING.md}px ${SPACING.lg}px`,
          gap: SPACING.md,
        }}
      >
        <div style={{ minWidth: 160, flexShrink: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: COLORS.textPrimary }}>
            {brand.cycle_name}
          </div>
        </div>
        <Text style={{ fontSize: 12, color: COLORS.textMuted, flexShrink: 0 }}>
          {brand.planning_quarter}
        </Text>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Actuals not yet uploaded
        </Text>
      </div>
    </Card>
  );
}

export default function CxoDashboard() {
  const { profile } = useAuth();
  const { selectedBrandId, loading: brandLoading } = useBrand();
  const dashboard = useDashboardData(selectedBrandId, !brandLoading);

  if (dashboard.loading) return <DashboardSkeleton />;

  if (dashboard.error) {
    return (
      <Alert
        type="error"
        message="Failed to load dashboard"
        description={dashboard.error}
        action={<Button onClick={dashboard.refresh}>Retry</Button>}
      />
    );
  }

  const { approvals, kpiTotals, reviewBrands, approvedBrands, cycles } = dashboard;

  const isGD = profile?.role === 'GD';
  const fillingCycles = isGD
    ? (cycles || []).filter(c => c.status === 'Filling')
    : [];

  const hasApprovedData = kpiTotals && (
    kpiTotals.gmv > 0 || kpiTotals.nsv > 0 || kpiTotals.nsq > 0 ||
    kpiTotals.inwards_qty > 0 || kpiTotals.avg_doh > 0 || kpiTotals.closing_stock_qty > 0
  );

  const dohColor = !kpiTotals?.avg_doh ? COLORS.neutral600
    : kpiTotals.avg_doh <= 45 ? COLORS.success
    : kpiTotals.avg_doh <= 60 ? COLORS.warning
    : COLORS.danger;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.xl }}>
        <div>
          <Title level={3} style={{ margin: 0, color: COLORS.textPrimary }}>{getCurrentQuarter()} Overview</Title>
          <Text type="secondary">Open-to-Buy planning summary</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={dashboard.refresh}>Refresh</Button>
      </div>

      {hasApprovedData && (
        <>
        <Text
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: COLORS.textMuted,
            marginBottom: SPACING.sm,
          }}
        >
          Approved Plan
        </Text>
        <Row gutter={[16, 16]} style={{ marginBottom: SPACING.xl }}>
          <Col xs={24} sm={12} lg={4}>
            <MetricCard
              title="GMV"
              value={formatCrore(kpiTotals!.gmv)}
              icon={<DollarOutlined />}
              color={COLORS.info}
              size="compact"
            />
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <MetricCard
              title="NSV"
              value={formatCrore(kpiTotals!.nsv)}
              icon={<ShoppingCartOutlined />}
              color={COLORS.accent}
              size="compact"
            />
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <MetricCard
              title="Total NSQ"
              value={formatQty(kpiTotals!.nsq)}
              icon={<BarChartOutlined />}
              color={COLORS.success}
              size="compact"
            />
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <MetricCard
              title="Total Inwards"
              value={formatQty(kpiTotals!.inwards_qty)}
              icon={<InboxOutlined />}
              color={COLORS.warning}
              size="compact"
            />
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <MetricCard
              title="Avg DoH"
              value={kpiTotals!.avg_doh ? Math.round(kpiTotals!.avg_doh) : '-'}
              icon={<ClockCircleOutlined />}
              color={dohColor}
              size="compact"
            />
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <MetricCard
              title="Closing Stock"
              value={formatQty(kpiTotals!.closing_stock_qty)}
              icon={<DatabaseOutlined />}
              color={COLORS.neutral600}
              size="compact"
            />
          </Col>
        </Row>
        </>
      )}

      {/* Zone 0 — Pending Inputs (GD only) */}
      {isGD && (
        <div style={{ marginBottom: SPACING.xl }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg }}>
            <Title level={4} style={{ margin: 0 }}>Pending Inputs</Title>
            <Badge count={fillingCycles.length} style={{ backgroundColor: COLORS.warning }} />
          </div>
          {fillingCycles.length > 0 ? (
            fillingCycles.map(cycle => (
              <Link key={cycle.id} href={`/cycles/${cycle.id}?tab=plan`} style={{ textDecoration: 'none' }}>
                <Card
                  style={{ ...CARD_STYLES, marginBottom: SPACING.md, cursor: 'pointer' }}
                  styles={{ body: { padding: `${SPACING.md}px ${SPACING.lg}px` } }}
                  hoverable
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: COLORS.textPrimary }}>{cycle.cycle_name}</div>
                      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>{cycle.planning_quarter}</div>
                    </div>
                    <Tag color="warning">Filling</Tag>
                  </div>
                </Card>
              </Link>
            ))
          ) : (
            <Empty description="No cycles pending input" />
          )}
        </div>
      )}

      {/* Zone 1 — Pending Review */}
      <div style={{ marginBottom: SPACING.xl }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg }}>
          <Title level={4} style={{ margin: 0 }}>Pending Review</Title>
          <Badge count={reviewBrands.length} style={{ backgroundColor: COLORS.accent }} />
        </div>
        {reviewBrands.length > 0 ? (
          reviewBrands.map(brand => (
            <BrandPanel
              key={brand.cycle_id}
              brand={brand}
              zone="review"
              onActionComplete={dashboard.refresh}
              needsMyApproval={approvals?.brands.find(b => b.cycle_id === brand.cycle_id)?.needs_my_approval ?? false}
              approvalProgress={
                approvals?.brands.find(b => b.cycle_id === brand.cycle_id)?.approval_progress
                  ? (() => {
                      const p = approvals!.brands.find(b => b.cycle_id === brand.cycle_id)!.approval_progress;
                      return { approved: p.approved, pending: p.pending, total: p.total };
                    })()
                  : undefined
              }
            />
          ))
        ) : (
          <Empty description="No cycles pending review" />
        )}
      </div>

      {/* Zone 2 — Approved Plans (current quarter only) */}
      <div style={{ marginBottom: SPACING.xl }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg }}>
          <Title level={4} style={{ margin: 0 }}>Approved Plans</Title>
        </div>
        {approvedBrands.filter(b => b.is_current_quarter).length > 0 ? (
          approvedBrands.filter(b => b.is_current_quarter).map(brand => (
            <BrandPanel
              key={brand.cycle_id}
              brand={brand}
              zone="approved"
            />
          ))
        ) : (
          <Empty description="No approved plans" />
        )}
      </div>

      {/* Zone 3 — Actuals vs Plan (only shown when at least one cycle has actuals) */}
      {approvedBrands.some(b => b.has_actuals) && (
        <div style={{ marginBottom: SPACING.xl }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg }}>
            <Title level={4} style={{ margin: 0 }}>Actuals vs Plan</Title>
          </div>
          {approvedBrands.map(brand =>
            brand.has_actuals ? (
              <BrandPanel
                key={brand.cycle_id}
                brand={brand}
                zone="variance"
                variance={dashboard.varianceCache[brand.cycle_id] || null}
                onLoadVariance={dashboard.loadVariance}
              />
            ) : (
              <NoActualsRow key={brand.cycle_id} brand={brand} />
            )
          )}
        </div>
      )}
    </div>
  );
}
