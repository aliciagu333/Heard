'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/app/send');
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col flex-1 justify-center px-6 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-light text-slate-700 tracking-wide">heard.</h1>
        <p className="mt-2 text-slate-400 text-sm">a space to be heard.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="email"
            className="input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <input
            type="password"
            className="input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p className="text-rose-400 text-sm text-center">{error}</p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        New here?{' '}
        <Link href="/auth/signup" className="text-sky-500 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
