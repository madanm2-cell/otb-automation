'use client';

import { useEffect } from 'react';
import { Card, Spin, Typography, Space } from 'antd';
import { AppstoreOutlined, CheckCircleFilled } from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { COLORS, SHADOWS, SPACING } from '@/lib/designTokens';

const { Title, Text } = Typography;

export default function BrandSelectPage() {
  const { profile, loading: authLoading } = useAuth();
  const { brands, selectedBrandId, setSelectedBrandId, loading: brandLoading } = useBrand();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '/';
  const isSwitching = searchParams.get('switch') === 'true';

  const loading = authLoading || brandLoading;

  // Single-brand non-admin users are auto-redirected — treat as still loading
  // so they never see the picker UI before the redirect fires.
  const isAutoRedirecting =
    !loading && !!profile && profile.role !== 'Admin' && brands.length === 1;

  function confirmBrand(id: string | null) {
    if (!profile) return;
    setSelectedBrandId(id);
    sessionStorage.setItem(`otb_brand_selected_${profile.id}`, 'true');
    router.push(returnTo);
  }

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !profile) {
      router.replace('/login');
    }
  }, [authLoading, profile, router]);

  // If sessionStorage flag already set, skip the picker — unless this is an
  // explicit mid-session switch (?switch=true), in which case always show it.
  useEffect(() => {
    if (authLoading || !profile || isSwitching) return;
    const key = `otb_brand_selected_${profile.id}`;
    if (sessionStorage.getItem(key)) {
      router.replace(returnTo);
    }
  }, [authLoading, profile, returnTo, router, isSwitching]);

  // Auto-confirm for single-brand non-admin users
  useEffect(() => {
    if (loading || !profile) return;
    if (profile.role !== 'Admin' && brands.length === 1) {
      confirmBrand(brands[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profile, brands]);

  if (loading || isAutoRedirecting || !profile) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
      }}>
        <Spin size="large" />
      </div>
    );
  }

  const isAdmin = profile.role === 'Admin';

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
      padding: SPACING.xl,
    }}>
      <div style={{ width: '100%', maxWidth: 640 }}>
        <div style={{ textAlign: 'center', marginBottom: SPACING.xxl }}>
          <img src="/tmrw-logo.png" alt="TMRW" style={{ height: 36, marginBottom: 12 }} />
          <Title level={3} style={{ margin: 0, color: '#fff' }}>
            {isSwitching ? 'Switch Brand' : 'Select a Brand'}
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
            {isSwitching
              ? 'Pick a brand to continue — the page will reload fresh'
              : 'Choose the brand you want to work with this session'}
          </Text>
        </div>

        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {/* All Brands option for Admin */}
          {isAdmin && (
            <BrandCard
              id={null}
              name="All Brands"
              description="View and manage data across all brands"
              icon={<AppstoreOutlined style={{ fontSize: 22 }} />}
              selected={selectedBrandId === null}
              onSelect={() => confirmBrand(null)}
            />
          )}

          {brands.map((brand) => (
            <BrandCard
              key={brand.id}
              id={brand.id}
              name={brand.name}
              selected={selectedBrandId === brand.id}
              onSelect={() => confirmBrand(brand.id)}
            />
          ))}
        </Space>
      </div>
    </div>
  );
}

interface BrandCardProps {
  id: string | null;
  name: string;
  description?: string;
  icon?: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
}

function BrandCard({ name, description, icon, selected, onSelect }: BrandCardProps) {
  return (
    <Card
      hoverable
      onClick={onSelect}
      style={{
        borderRadius: 12,
        border: selected ? `2px solid ${COLORS.accent}` : `1px solid rgba(255,255,255,0.15)`,
        background: selected ? COLORS.accentLight : 'rgba(255,255,255,0.95)',
        boxShadow: selected ? `0 0 0 2px ${COLORS.accent}22, ${SHADOWS.md}` : SHADOWS.sm,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      styles={{ body: { padding: `${SPACING.lg}px ${SPACING.xl}px` } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md }}>
          {icon && (
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: selected ? COLORS.accent : COLORS.neutral100,
              color: selected ? '#fff' : COLORS.neutral600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              {icon}
            </div>
          )}
          <div>
            <Text strong style={{ fontSize: 15, color: COLORS.textPrimary, display: 'block' }}>
              {name}
            </Text>
            {description && (
              <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>
                {description}
              </Text>
            )}
          </div>
        </div>
        {selected && (
          <CheckCircleFilled style={{ fontSize: 20, color: COLORS.accent, flexShrink: 0 }} />
        )}
      </div>
    </Card>
  );
}
