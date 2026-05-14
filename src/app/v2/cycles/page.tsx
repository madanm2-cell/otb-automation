'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import { hasPermission } from '@/lib/auth/roles';
import type { OtbCycle } from '@/types/otb';

const STATUS_BADGE: Record<string, string> = {
  Draft: 'badge-gray',
  Filling: 'badge-yellow',
  InReview: 'badge-blue',
  Approved: 'badge-green',
};

const STATUS_LABEL: Record<string, string> = {
  InReview: 'In Review',
};

export default function V2CyclesPage() {
  const { profile } = useAuth();
  const { selectedBrandId } = useBrand();
  const [cycles, setCycles] = useState<OtbCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const canCreate = profile ? hasPermission(profile.role, 'create_cycle') : false;
  const isGd = profile?.role === 'GD';

  useEffect(() => {
    const controller = new AbortController();
    const url = selectedBrandId
      ? `/api/cycles?brandId=${selectedBrandId}`
      : '/api/cycles';
    setLoading(true);
    fetch(url, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        setCycles(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => { if (err.name !== 'AbortError') setLoading(false); });
    return () => controller.abort();
  }, [selectedBrandId]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { Draft: 0, Filling: 0, InReview: 0, Approved: 0 };
    cycles.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return counts;
  }, [cycles]);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>OTB Cycles</h1>
          <p>Manage and track planning cycles by brand.</p>
        </div>
        {canCreate && (
          <Link href="/cycles/new">
            <button className="btn-primary">+ New Cycle</button>
          </Link>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {(['Draft', 'Filling', 'InReview', 'Approved'] as const).map(status => (
          <div key={status} className="stat-card">
            <div className="stat-label">{STATUS_LABEL[status] ?? status}</div>
            <div className="stat-value">{statusCounts[status] || 0}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 64 }}>
          <div
            className="spinner spinner-dark"
            style={{ width: 28, height: 28, borderWidth: 3 } as React.CSSProperties}
          />
        </div>
      ) : cycles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>No cycles yet</h3>
          <p>Cycles will appear here once created.</p>
        </div>
      ) : (
        <div className="card-flat" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="v2-table">
            <thead>
              <tr>
                <th>Cycle Name</th>
                <th>Brand</th>
                <th>Quarter</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map(cycle => {
                const href = isGd && ['Filling', 'InReview', 'Approved'].includes(cycle.status)
                  ? `/v2/cycles/${cycle.id}?tab=plan`
                  : `/v2/cycles/${cycle.id}`;
                const cycleWithBrand = cycle as OtbCycle & { brands?: { name: string } };
                return (
                  <tr key={cycle.id}>
                    <td>
                      <Link
                        href={href}
                        style={{ fontWeight: 500, color: 'var(--primary)', textDecoration: 'none' }}
                      >
                        {cycle.cycle_name}
                      </Link>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {cycleWithBrand.brands?.name ?? '-'}
                    </td>
                    <td>{cycle.planning_quarter}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[cycle.status] ?? 'badge-gray'}`}>
                        {STATUS_LABEL[cycle.status] ?? cycle.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {new Date(cycle.created_at).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
