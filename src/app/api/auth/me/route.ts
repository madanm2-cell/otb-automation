import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';

export const GET = withAuth(null, async (_req, auth) => {
  return NextResponse.json({ user: auth.user, profile: auth.profile });
});
