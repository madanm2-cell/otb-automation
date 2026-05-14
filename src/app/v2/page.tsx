'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { formatCrore, formatQty } from '@/lib/formatting';
import type { EnhancedBrandSummary, OtbCycle } from '@/types/otb';

function getCurrentQuarter(): string {
  const now = new Date();
  const month = now.getMonth();
  const fyYear = month >= 3 ? now.getFullYear() + 1 : now.getFullYear();
  const q = month >= 3 ? Math.ceil((month - 2) / 3) : 4;
  return `Q${q} FY${String(fyYear).slice(-2)}`;
}

const STATUS_BADGE: Record<string, string> = {
  Draft: 'badge-gray',
  Filling: 'badge-yellow',
  InReview: 'badge-blue',
  Approved: 'badge-green',
};

function BrandCard({
  brand,
  zone,
  onAction,
}: {
  brand: EnhancedBrandSummary;
  zone: 'review' | 'approved';
  onAction?: () => void;
}) {
  const href = `/v2/cycles/${brand.cycle_id}`;
  const badgeClass = STATUS_BADGE[brand.status] ?? 'badge-gray';
  const statusLabel = brand.status === 'InReview' ? 'In Review' : brand.status;

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>
            {brand.cycle_name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
            {brand.planning_quarter} · {brand.brand_name}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={`badge ${badgeClass}`}>{statusLabel}</span>
          <Link href={href}>
            <button className="btn-secondary btn-sm">
              {zone === 'review' ? 'Review →' : 'View →'}
            </button>
          </Link>
        </div>
      </div>

      {(brand.gmv > 0 || brand.nsv > 0) && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px 24px', marginTop: 14, paddingTop: 14,
          borderTop: '1px solid var(--border)',
        }}>
          {[
            { label: 'GMV', value: formatCrore(brand.gmv) },
            { label: 'NSV', value: formatCrore(brand.nsv) },
            { label: 'NSQ', value: formatQty(brand.nsq)  },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function V2Dashboard() {
  const { profile } = useAuth();
  const { selectedBrandId, loading: brandLoading } = useBrand();
  const dashboard = useDashboardData(selectedBrandId, !brandLoading);

  if (dashboard.loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{
          width: 36, height: 36,
          border: '4px solid var(--border)', borderTopColor: 'var(--primary)',
          borderRadius: '50%', animation: 'v2spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes v2spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (dashboard.error) {
    return (
      <div className="alert alert-error" style={{ maxWidth: 600 }}>
        Failed to load dashboard: {dashboard.error}
        <button className="btn-secondary btn-sm" onClick={dashboard.refresh} style={{ marginLeft: 12 }}>
          Retry
        </button>
      </div>
    );
  }

  const { kpiTotals, reviewBrands, approvedBrands, cycles } = dashboard;
  const isGD = profile?.role === 'GD';
  const fillingCycles = isGD ? (cycles ?? []).filter(c => c.status === 'Filling') : [];
  const hasApprovedData = kpiTotals && (kpiTotals.gmv > 0 || kpiTotals.nsv > 0);

  const dohColor = !kpiTotals?.avg_doh
    ? 'var(--text)'
    : kpiTotals.avg_doh <= 45 ? 'var(--success)'
    : kpiTotals.avg_doh <= 60 ? 'var(--warning)'
    : 'var(--danger)';

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>{getCurrentQuarter()} Overview</h1>
          <p>Open-to-Buy planning summary</p>
        </div>
        <button className="btn-secondary" onClick={dashboard.refresh}>↻ Refresh</button>
      </div>

      {hasApprovedData && (
        <>
          <div style={{
            fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 12,
          }}>
            Approved Plan
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 16, marginBottom: 32,
          }}>
            {([
              { label: 'GMV',           value: formatCrore(kpiTotals!.gmv) },
              { label: 'NSV',           value: formatCrore(kpiTotals!.nsv) },
              { label: 'Total NSQ',     value: formatQty(kpiTotals!.nsq) },
              { label: 'Total Inwards', value: formatQty(kpiTotals!.inwards_qty) },
              { label: 'Avg DoH',       value: kpiTotals!.avg_doh ? String(Math.round(kpiTotals!.avg_doh)) : '-', color: dohColor },
              { label: 'Closing Stock', value: formatQty(kpiTotals!.closing_stock_qty) },
            ] as { label: string; value: string; color?: string }[]).map(({ label, value, color }) => (
              <div key={label} className="stat-card">
                <div className="stat-label">{label}</div>
                <div className="stat-value" style={color ? { color, fontSize: 26 } : { fontSize: 26 }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {isGD && fillingCycles.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Pending Inputs</h2>
            <span className="badge badge-yellow">{fillingCycles.length}</span>
          </div>
          {fillingCycles.map((cycle: OtbCycle) => (
            <Link key={cycle.id} href={`/v2/cycles/${cycle.id}?tab=plan`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ marginBottom: 10, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{cycle.cycle_name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {cycle.planning_quarter}
                    </div>
                  </div>
                  <span className="badge badge-yellow">Filling</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Pending Review</h2>
          <span className="badge badge-orange">{reviewBrands.length}</span>
        </div>
        {reviewBrands.length > 0 ? (
          reviewBrands.map(brand => (
            <BrandCard key={brand.cycle_id} brand={brand} zone="review" onAction={dashboard.refresh} />
          ))
        ) : (
          <div className="empty-state" style={{ padding: '28px 24px' }}>
            <p>No cycles pending review</p>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Approved Plans</h2>
        </div>
        {approvedBrands.filter(b => b.is_current_quarter).length > 0 ? (
          approvedBrands
            .filter(b => b.is_current_quarter)
            .map(brand => (
              <BrandCard key={brand.cycle_id} brand={brand} zone="approved" />
            ))
        ) : (
          <div className="empty-state" style={{ padding: '28px 24px' }}>
            <p>No approved plans</p>
          </div>
        )}
      </div>

      {approvedBrands.some(b => b.has_actuals) && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Actuals vs Plan</h2>
          </div>
          {approvedBrands.map(brand => (
            brand.has_actuals ? (
              <div key={brand.cycle_id} className="card" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{brand.cycle_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                      {brand.planning_quarter} · {brand.brand_name}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="badge badge-green">Actuals Available</span>
                    <Link href={`/v2/cycles/${brand.cycle_id}?tab=analyze`}>
                      <button className="btn-secondary btn-sm">View Analysis →</button>
                    </Link>
                  </div>
                </div>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px 24px', marginTop: 14, paddingTop: 14,
                  borderTop: '1px solid var(--border)',
                }}>
                  {[
                    { label: 'Plan GMV',  value: formatCrore(brand.gmv) },
                    { label: 'Plan NSV',  value: formatCrore(brand.nsv) },
                    { label: 'Plan NSQ',  value: formatQty(brand.nsq)   },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div key={brand.cycle_id} className="card-flat" style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{brand.cycle_name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{brand.planning_quarter}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Actuals not yet uploaded</span>
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
