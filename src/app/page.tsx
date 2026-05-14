'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { MetricCard } from '@/components/ui/MetricCard';
import { BrandPanel } from '@/components/ui/BrandPanel';
import type { EnhancedBrandSummary } from '@/types/otb';
import { formatCrore, formatQty } from '@/lib/formatting';
import {
  DollarOutlined, ShoppingCartOutlined, BarChartOutlined,
  InboxOutlined, ClockCircleOutlined, DatabaseOutlined,
} from '@ant-design/icons';
import { COLORS } from '@/lib/designTokens';

function getCurrentQuarter(): string {
  const now = new Date();
  const month = now.getMonth();
  const fyYear = month >= 3 ? now.getFullYear() + 1 : now.getFullYear();
  const q = month >= 3 ? Math.ceil((month - 2) / 3) : 4;
  return `Q${q} FY${String(fyYear).slice(-2)}`;
}

function NoActualsRow({ brand }: { brand: EnhancedBrandSummary }) {
  return (
    <div className="card" style={{ marginBottom: 12, padding: '12px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ minWidth: 160, fontWeight: 600, fontSize: 15 }}>{brand.cycle_name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{brand.planning_quarter}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Actuals not yet uploaded</div>
      </div>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{title}</h2>
      {count != null && count > 0 && (
        <span className="badge badge-orange">{count}</span>
      )}
    </div>
  );
}

export default function CxoDashboard() {
  const { profile } = useAuth();
  const { selectedBrandId, loading: brandLoading } = useBrand();
  const dashboard = useDashboardData(selectedBrandId, !brandLoading);

  if (dashboard.loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div className="spinner-dark" style={{ width: 28, height: 28, borderWidth: 3, display: 'inline-block', borderRadius: '50%' }} />
      </div>
    );
  }

  if (dashboard.error) {
    return (
      <div className="alert alert-error" style={{ maxWidth: 600 }}>
        <span>Failed to load dashboard: {dashboard.error}</span>
        <button className="btn-secondary btn-sm" onClick={dashboard.refresh} style={{ marginLeft: 'auto' }}>Retry</button>
      </div>
    );
  }

  const { approvals, kpiTotals, reviewBrands, approvedBrands, cycles } = dashboard;
  const isGD = profile?.role === 'GD';
  const fillingCycles = isGD ? (cycles || []).filter(c => c.status === 'Filling') : [];

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
      <div className="page-header">
        <div>
          <h1>{getCurrentQuarter()} Overview</h1>
          <p>Open-to-Buy planning summary</p>
        </div>
        <button className="btn-secondary" onClick={dashboard.refresh}>↻ Refresh</button>
      </div>

      {hasApprovedData && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 12 }}>
            Approved Plan
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
            {[
              { title: 'GMV',           value: formatCrore(kpiTotals!.gmv),                      icon: <DollarOutlined />,       color: COLORS.info },
              { title: 'NSV',           value: formatCrore(kpiTotals!.nsv),                      icon: <ShoppingCartOutlined />, color: COLORS.accent },
              { title: 'Total NSQ',     value: formatQty(kpiTotals!.nsq),                        icon: <BarChartOutlined />,     color: COLORS.success },
              { title: 'Total Inwards', value: formatQty(kpiTotals!.inwards_qty),                icon: <InboxOutlined />,        color: COLORS.warning },
              { title: 'Avg DoH',       value: kpiTotals!.avg_doh ? Math.round(kpiTotals!.avg_doh) : '-', icon: <ClockCircleOutlined />, color: dohColor },
              { title: 'Closing Stock', value: formatQty(kpiTotals!.closing_stock_qty),          icon: <DatabaseOutlined />,    color: COLORS.neutral600 },
            ].map(m => (
              <MetricCard key={m.title} title={m.title} value={m.value} icon={m.icon} color={m.color} size="compact" />
            ))}
          </div>
        </div>
      )}

      {/* Pending Inputs (GD only) */}
      {isGD && (
        <div style={{ marginBottom: 32 }}>
          <SectionHeader title="Pending Inputs" count={fillingCycles.length} />
          {fillingCycles.length > 0 ? (
            fillingCycles.map(cycle => (
              <Link key={cycle.id} href={`/cycles/${cycle.id}?tab=plan`} style={{ textDecoration: 'none', display: 'block', marginBottom: 10 }}>
                <div className="card" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{cycle.cycle_name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{cycle.planning_quarter}</div>
                  </div>
                  <span className="badge badge-yellow">Filling</span>
                </div>
              </Link>
            ))
          ) : (
            <div className="empty-state" style={{ padding: '32px 24px' }}>
              <div className="empty-icon">📋</div>
              <p>No cycles pending input</p>
            </div>
          )}
        </div>
      )}

      {/* Pending Review */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader title="Pending Review" count={reviewBrands.length} />
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
          <div className="empty-state" style={{ padding: '32px 24px' }}>
            <div className="empty-icon">✓</div>
            <p>No cycles pending review</p>
          </div>
        )}
      </div>

      {/* Approved Plans */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader title="Approved Plans" />
        {approvedBrands.filter(b => b.is_current_quarter).length > 0 ? (
          approvedBrands.filter(b => b.is_current_quarter).map(brand => (
            <BrandPanel key={brand.cycle_id} brand={brand} zone="approved" />
          ))
        ) : (
          <div className="empty-state" style={{ padding: '32px 24px' }}>
            <div className="empty-icon">📊</div>
            <p>No approved plans</p>
          </div>
        )}
      </div>

      {/* Actuals vs Plan */}
      {approvedBrands.some(b => b.has_actuals) && (
        <div style={{ marginBottom: 32 }}>
          <SectionHeader title="Actuals vs Plan" />
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
