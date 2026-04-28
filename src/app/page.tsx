'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Typography, Row, Col, Badge, Button, Empty, Alert,
} from 'antd';
import {
  DollarOutlined, ShoppingCartOutlined, BarChartOutlined,
  InboxOutlined, ClockCircleOutlined, DatabaseOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { MetricCard } from '@/components/ui/MetricCard';
import { BrandPanel } from '@/components/ui/BrandPanel';
import { DashboardSkeleton } from '@/components/ui/PageSkeleton';
import { COLORS, SPACING } from '@/lib/designTokens';
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

export default function CxoDashboard() {
  const { profile } = useAuth();
  const { selectedBrandId } = useBrand();
  const router = useRouter();
  const dashboard = useDashboardData(selectedBrandId);

  // GDs redirect to cycles
  useEffect(() => {
    if (profile?.role === 'GD') {
      router.replace('/cycles');
    }
  }, [profile, router]);

  if (profile?.role === 'GD') return null;

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

  const { approvals, kpiTotals, reviewBrands, approvedBrands } = dashboard;

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
          <Title level={3} style={{ margin: 0, color: COLORS.textPrimary }}>Executive Dashboard</Title>
          <Text type="secondary">{getCurrentQuarter()} Overview</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={dashboard.refresh}>Refresh</Button>
      </div>

      {/* KPI Row — Approved cycle totals */}
      <Row gutter={[16, 16]} style={{ marginBottom: SPACING.xl }}>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard
            title="GMV"
            value={hasApprovedData ? formatCrore(kpiTotals!.gmv) : '-'}
            icon={<DollarOutlined />}
            color={COLORS.info}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard
            title="NSV"
            value={hasApprovedData ? formatCrore(kpiTotals!.nsv) : '-'}
            icon={<ShoppingCartOutlined />}
            color={COLORS.accent}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard
            title="Total NSQ"
            value={hasApprovedData ? formatQty(kpiTotals!.nsq) : '-'}
            icon={<BarChartOutlined />}
            color={COLORS.success}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard
            title="Total Inwards"
            value={hasApprovedData ? formatQty(kpiTotals!.inwards_qty) : '-'}
            icon={<InboxOutlined />}
            color={COLORS.warning}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard
            title="Avg DoH"
            value={hasApprovedData && kpiTotals!.avg_doh ? Math.round(kpiTotals!.avg_doh) : '-'}
            icon={<ClockCircleOutlined />}
            color={dohColor}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard
            title="Closing Stock"
            value={hasApprovedData ? formatQty(kpiTotals!.closing_stock_qty) : '-'}
            icon={<DatabaseOutlined />}
            color={COLORS.neutral600}
          />
        </Col>
      </Row>

      {!hasApprovedData && (
        <div style={{ textAlign: 'center', marginBottom: SPACING.xl }}>
          <Text type="secondary">
            No approved plans yet. KPI totals will appear once plans are approved.
          </Text>
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
              onApprove={(cycleId) => router.push(`/cycles/${cycleId}?action=approve`)}
              onRequestRevision={(cycleId) => router.push(`/cycles/${cycleId}?action=revision`)}
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

      {/* Zone 2 — Approved Plans */}
      <div style={{ marginBottom: SPACING.xl }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg }}>
          <Title level={4} style={{ margin: 0 }}>Approved Plans</Title>
          <Badge count={approvedBrands.length} style={{ backgroundColor: COLORS.success }} />
        </div>
        {approvedBrands.length > 0 ? (
          approvedBrands.map(brand => (
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

      {/* Zone 3 — Actuals vs Plan */}
      <div style={{ marginBottom: SPACING.xl }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg }}>
          <Title level={4} style={{ margin: 0 }}>Actuals vs Plan</Title>
        </div>
        {approvedBrands.length > 0 ? (
          approvedBrands.map(brand => (
            <BrandPanel
              key={brand.cycle_id}
              brand={brand}
              zone="variance"
              variance={dashboard.varianceCache[brand.cycle_id] || null}
              onLoadVariance={dashboard.loadVariance}
            />
          ))
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                <Text type="secondary">No actuals uploaded yet.</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Upload actuals in an approved cycle to see variance here.
                </Text>
              </span>
            }
          />
        )}
      </div>
    </div>
  );
}
