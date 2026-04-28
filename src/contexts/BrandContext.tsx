'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

interface Brand {
  id: string;
  name: string;
}

interface BrandContextType {
  brands: Brand[];
  selectedBrandId: string | null;
  setSelectedBrandId: (id: string | null) => void;
  isAllBrands: boolean;
  loading: boolean;
}

const BrandContext = createContext<BrandContextType>({
  brands: [],
  selectedBrandId: null,
  setSelectedBrandId: () => {},
  isAllBrands: false,
  loading: true,
});

function resolveSelection(
  profile: { id: string; role: string; assigned_brands?: string[] },
  stored: string | null,
): string | null {
  if (profile.role === 'Admin') return stored || null;
  const assignedIds = profile.assigned_brands || [];
  if (assignedIds.length === 1) return assignedIds[0];
  if (stored && assignedIds.includes(stored)) return stored;
  return assignedIds[0] || null;
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandIdState, setSelectedBrandIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    if (!profile) {
      // Defer resets to next microtask so they are not synchronous in the effect body.
      queueMicrotask(() => {
        if (cancelledRef.current) return;
        setBrands([]);
        setSelectedBrandIdState(null);
        setLoading(false);
      });
      return () => { cancelledRef.current = true; };
    }

    const currentProfile = profile;

    (async () => {
      let fetched: Brand[] = [];

      if (currentProfile.role === 'Admin') {
        const { data } = await supabase.from('brands').select('id, name').order('name');
        fetched = data || [];
      } else {
        const assignedIds = currentProfile.assigned_brands || [];
        if (assignedIds.length === 0) {
          if (!cancelledRef.current) {
            setBrands([]);
            setSelectedBrandIdState(null);
            setLoading(false);
          }
          return;
        }
        const { data } = await supabase
          .from('brands')
          .select('id, name')
          .in('id', assignedIds)
          .order('name');
        fetched = data || [];
      }

      if (cancelledRef.current) return;

      const storageKey = `otb_selected_brand_${currentProfile.id}`;
      const stored = localStorage.getItem(storageKey);

      setBrands(fetched);
      setSelectedBrandIdState(resolveSelection(currentProfile, stored));
      setLoading(false);
    })();

    return () => { cancelledRef.current = true; };
  }, [profile, supabase]);

  const setSelectedBrandId = useCallback((id: string | null) => {
    setSelectedBrandIdState(id);
    if (!profile) return;

    const storageKey = `otb_selected_brand_${profile.id}`;
    if (id) {
      localStorage.setItem(storageKey, id);
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [profile]);

  const isAllBrands = profile?.role === 'Admin' && selectedBrandIdState === null;

  return (
    <BrandContext.Provider
      value={{ brands, selectedBrandId: selectedBrandIdState, setSelectedBrandId, isAllBrands, loading }}
    >
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand(): BrandContextType {
  return useContext(BrandContext);
}
