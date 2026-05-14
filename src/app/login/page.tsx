'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') ?? '/';

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    window.location.href = `/brand-select?returnTo=${encodeURIComponent(redirectTo)}`;
  }

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #CC785C 0%, #FDF0EB 100%)',
    }}>
      <div className="card" style={{ width: 420, borderRadius: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/tmrw-logo.png" alt="TMRW" style={{ height: 36, marginBottom: 12 }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>OTB Platform</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Open-To-Buy inventory planning</p>
        </div>
        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            {error}
            <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        )}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary btn-lg" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
