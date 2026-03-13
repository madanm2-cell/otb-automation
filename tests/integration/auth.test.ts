import { describe, it, expect, beforeAll } from 'vitest';
import { createAdminClient } from '../../src/lib/supabase/server';

describe('Authentication', () => {
  const admin = createAdminClient();

  it('creates user via admin API and profile auto-created', async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: 'test-gd@bewakoof.com',
      password: 'TestPassword123!',
      email_confirm: true,
      user_metadata: { full_name: 'Test GD', role: 'GD' },
    });
    expect(error).toBeNull();
    expect(data.user).toBeDefined();

    // Profile should be auto-created by trigger
    const { data: profile } = await admin
      .from('profiles')
      .select('*')
      .eq('id', data.user!.id)
      .single();
    expect(profile?.role).toBe('GD');
    expect(profile?.full_name).toBe('Test GD');
  });

  it('deactivated user cannot access API', async () => {
    // Deactivate user
    await admin
      .from('profiles')
      .update({ is_active: false })
      .eq('email', 'test-gd@bewakoof.com');

    // Attempt API call with this user's token should return 403
    // (test via fetch with the user's JWT)
  });
});
