'use client';

import { useState } from 'react';

export default function InviteClient({ invites: initialInvites }) {
  const [invites, setInvites] = useState(initialInvites);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleInvite(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong.');
      return;
    }

    setSuccess(`Invite sent to ${email}.`);
    setInvites((prev) => [{ id: data.inviteId, invitee_email: email, accepted: false, created_at: new Date().toISOString() }, ...prev]);
    setEmail('');
  }

  return (
    <div className="px-5 pt-6 space-y-6">
      <div>
        <h1 className="text-2xl font-light text-slate-700">Invite a friend.</h1>
        <p className="text-slate-400 text-sm mt-1 leading-relaxed">
          When they join, you both get a bonus interaction day.
        </p>
      </div>

      <div className="card bg-sky-50 border-sky-100 space-y-1">
        <p className="text-sm text-slate-500">How it works</p>
        <ul className="text-sm text-slate-400 space-y-1 list-none">
          <li>→ Invite a friend by email</li>
          <li>→ When they sign up, you both get +1 daily interaction</li>
          <li>→ One bonus per friend (one-time)</li>
        </ul>
      </div>

      <form onSubmit={handleInvite} className="space-y-3">
        <input
          type="email"
          className="input"
          placeholder="Friend's email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {error && <p className="text-rose-400 text-sm">{error}</p>}
        {success && <p className="text-sky-500 text-sm">{success}</p>}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Sending invite…' : 'Send invite'}
        </button>
      </form>

      {invites.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-slate-400">Your invites</p>
          {invites.map((inv) => (
            <div key={inv.id} className="card flex items-center justify-between py-3">
              <p className="text-sm text-slate-600 truncate">{inv.invitee_email}</p>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                inv.accepted
                  ? 'bg-sky-100 text-sky-600'
                  : 'bg-slate-100 text-slate-400'
              }`}>
                {inv.accepted ? 'Joined' : 'Pending'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
