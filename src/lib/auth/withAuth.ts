import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { hasPermission } from '@/lib/auth/roles';
import type { Permission } from '@/lib/auth/roles';
import type { Role, UserProfile } from '@/types/otb';

export interface AuthenticatedRequest {
  user: { id: string; email: string };
  profile: UserProfile;
}

type HandlerFn = (
  req: NextRequest,
  auth: AuthenticatedRequest,
  context?: any
) => Promise<NextResponse>;

/**
 * Wraps an API route handler with authentication and permission checks.
 * Usage: export const GET = withAuth('view_all_otbs', async (req, auth) => { ... });
 */
export function withAuth(permission: Permission | null, handler: HandlerFn) {
  return async (req: NextRequest, context?: any) => {
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 403 });
    }

    if (!profile.is_active) {
      return NextResponse.json({ error: 'Account deactivated' }, { status: 403 });
    }

    // Check permission (null = any authenticated user)
    if (permission && !hasPermission(profile.role as Role, permission)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const auth: AuthenticatedRequest = {
      user: { id: user.id, email: user.email! },
      profile: profile as UserProfile,
    };

    return handler(req, auth, context);
  };
}
