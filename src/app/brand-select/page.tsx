'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import { useRouter, useSearchParams } from 'next/navigation';

export default function BrandSelectPage() {
  const { profile, loading: authLoading } = useAuth();
  const { brands, selectedBrandId, setSelectedBrandId, loading: brandLoading } = useBrand();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '/';
  const isSwitching = searchParams.get('switch') === 'true';

  const loading = authLoading || brandLoading;

  const isAutoRedirecting =
    !loading && !!profile && profile.role !== 'Admin' && brands.length === 1;

  function confirmBrand(id: string | null) {
    if (!profile) return;
    setSelectedBrandId(id);
    sessionStorage.setItem(`otb_brand_selected_${profile.id}`, 'true');
    router.push(returnTo);
  }

  useEffect(() => {
    if (!authLoading && !profile) router.replace('/login');
  }, [authLoading, profile, router]);

  useEffect(() => {
    if (authLoading || !profile || isSwitching) return;
    const key = `otb_brand_selected_${profile.id}`;
    if (sessionStorage.getItem(key)) router.replace(returnTo);
  }, [authLoading, profile, returnTo, router, isSwitching]);

  useEffect(() => {
    if (loading || !profile) return;
    if (profile.role !== 'Admin' && brands.length === 1) confirmBrand(brands[0].id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profile, brands]);

  if (loading || isAutoRedirecting || !profile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #CC785C 0%, #FDF0EB 100%)' }}>
        <div style={{ width: 40, height: 40, border: '4px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  const isAdmin = profile.role === 'Admin';

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #CC785C 0%, #FDF0EB 100%)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 600 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/tmrw-logo.png" alt="TMRW" style={{ height: 36, marginBottom: 12 }} />
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>
            {isSwitching ? 'Switch Brand' : 'Select a Brand'}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, margin: 0 }}>
            {isSwitching
              ? 'Pick a brand to continue — the page will reload fresh'
              : 'Choose the brand you want to work with this session'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isAdmin && (
            <BrandCard
              name="All Brands"
              description="View and manage data across all brands"
              selected={selectedBrandId === null}
              onSelect={() => confirmBrand(null)}
            />
          )}
          {brands.map(brand => (
            <BrandCard
              key={brand.id}
              name={brand.name}
              selected={selectedBrandId === brand.id}
              onSelect={() => confirmBrand(brand.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function BrandCard({ name, description, selected, onSelect }: {
  name: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        background: selected ? 'var(--primary-light)' : 'rgba(255,255,255,0.97)',
        border: `${selected ? 2 : 1}px solid ${selected ? 'var(--primary)' : 'rgba(255,255,255,0.2)'}`,
        borderRadius: 12,
        padding: '16px 20px',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'all var(--t-fast)',
        boxShadow: selected ? '0 0 0 3px var(--primary-ring)' : '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{name}</div>
        {description && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{description}</div>}
      </div>
      {selected && <span style={{ fontSize: 20, color: 'var(--primary)', flexShrink: 0 }}>✓</span>}
    </div>
  );
}
