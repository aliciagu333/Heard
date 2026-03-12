'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Insert into public.users
    if (data.user) {
      const { error: insertError } = await supabase.from('users').insert({
        id: data.user.id,
        display_name: displayName,
      });

      if (insertError && insertError.code !== '23505') {
        // 23505 = unique violation (user already exists), safe to ignore
        setError(insertError.message);
        setLoading(false);
        return;
      }
    }

    router.push('/app/send');
    router.refresh();
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
            type="text"
            className="input"
            placeholder="Your first name (shown to no one else)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            maxLength={40}
            autoComplete="given-name"
          />
        </div>
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
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        {error && (
          <p className="text-rose-400 text-sm text-center">{error}</p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        Already have an account?{' '}
        <Link href="/auth/login" className="text-sky-500 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
