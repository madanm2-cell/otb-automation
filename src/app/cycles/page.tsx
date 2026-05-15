'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import { hasPermission } from '@/lib/auth/roles';
import type { OtbCycle, CycleStatus } from '@/types/otb';

const STATUS_BADGE: Record<CycleStatus, string> = {
  Draft:    'badge badge-gray',
  Active:   'badge badge-blue badge-pulse',
  Filling:  'badge badge-blue badge-pulse',
  InReview: 'badge badge-yellow badge-pulse',
  Approved: 'badge badge-green',
};

const STATUS_COLORS: Record<string, string> = {
  Draft:    'var(--text-tertiary)',
  Filling:  'var(--info)',
  InReview: 'var(--warning)',
  Approved: 'var(--success)',
};

export default function CyclesPage() {
  const { profile } = useAuth();
  const { selectedBrandId } = useBrand();
  const [cycles, setCycles] = useState<OtbCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const canCreate = profile ? hasPermission(profile.role, 'create_cycle') : false;

  useEffect(() => {
    const controller = new AbortController();
    const url = selectedBrandId ? `/api/cycles?brandId=${selectedBrandId}` : '/api/cycles';
    setLoading(true);
    fetch(url, { signal: controller.signal })
      .then(r => r.json())
      .then(data => { setCycles(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(err => { if (err.name !== 'AbortError') setLoading(false); });
    return () => controller.abort();
  }, [selectedBrandId]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { Draft: 0, Filling: 0, InReview: 0, Approved: 0 };
    cycles.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return counts;
  }, [cycles]);

  const isGd = profile?.role === 'GD';

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="page-header">
        <div>
          <h1>OTB Cycles</h1>
          <p>Manage planning cycles across brands</p>
        </div>
        {canCreate && (
          <Link href="/cycles/new">
            <button className="btn-primary">+ New Cycle</button>
          </Link>
        )}
      </div>

      {/* Status summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {(['Draft', 'Filling', 'InReview', 'Approved'] as const).map(status => (
          <div key={status} className="stat-card" style={{ borderTop: `3px solid ${STATUS_COLORS[status] || 'var(--border)'}` }}>
            <div className="stat-label">{status === 'InReview' ? 'In Review' : status}</div>
            <div className="stat-value" style={{ fontSize: 28, color: STATUS_COLORS[status] || 'var(--text)' }}>
              {statusCounts[status] || 0}
            </div>
          </div>
        ))}
      </div>

      {/* Cycles table */}
      <div className="card-flat" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div className="spinner-dark" style={{ width: 24, height: 24, borderWidth: 3, display: 'inline-block', borderRadius: '50%' }} />
          </div>
        ) : cycles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No cycles yet</h3>
            <p>Create a new cycle to get started</p>
          </div>
        ) : (
          <table>
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
                  ? `/cycles/${cycle.id}?tab=plan`
                  : `/cycles/${cycle.id}`;
                return (
                  <tr key={cycle.id}>
                    <td><Link href={href} style={{ fontWeight: 500, color: 'var(--text)' }}>{cycle.cycle_name}</Link></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{cycle.brands?.name || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{cycle.planning_quarter}</td>
                    <td><span className={STATUS_BADGE[cycle.status]}>{cycle.status === 'InReview' ? 'In Review' : cycle.status}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{new Date(cycle.created_at).toLocaleDateString('en-IN')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
