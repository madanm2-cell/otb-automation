'use client';

import { useContext } from 'react';
import { AuthContext, type AuthContextType } from '@/components/AuthProvider';

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}
