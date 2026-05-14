'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

export default function V2LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') ?? '/v2';

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    window.location.href = `/brand-select?returnTo=${encodeURIComponent(redirectTo)}`;
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      background: 'linear-gradient(135deg, #CC785C 0%, #FDF0EB 100%)',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div className="card" style={{ width: 420, borderRadius: 18, padding: 36 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src="/tmrw-logo.png"
            alt="TMRW"
            style={{ height: 36, display: 'block', margin: '0 auto 12px' }}
          />
          <h2 style={{
            fontSize: 22, fontWeight: 700, color: 'var(--text)',
            margin: '0 0 4px', letterSpacing: '-0.02em',
          }}>
            OTB Platform
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
            Open-To-Buy inventory planning
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleLogin} className="v2-form">
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@tmrw.in"
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '10px 0', fontSize: 15, marginTop: 8, borderRadius: 10 }}
          >
            {loading
              ? <><span className="spinner" style={{ marginRight: 8 }} />Signing in…</>
              : 'Sign In'
            }
          </button>
        </form>
      </div>
    </div>
  );
}
