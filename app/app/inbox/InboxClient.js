'use client';

import { useState } from 'react';
import DailyLimitBanner from '@/components/DailyLimitBanner';

const TAG_LABELS = {
  vent: 'Vent',
  advice: 'Advice',
  validation: 'Validation',
  understand: 'Help me understand myself',
};

export default function InboxClient({ items }) {
  const [current, setCurrent] = useState(0);
  const [editedDraft, setEditedDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [error, setError] = useState('');

  const item = items[current];

  if (limitReached) return <div className="px-5 pt-8"><DailyLimitBanner /></div>;

  if (!item || sent) {
    return (
      <div className="px-5 pt-8">
        {sent ? (
          <div className="card py-10 text-center space-y-3">
            <p className="text-3xl">💙</p>
            <p className="text-slate-700 font-medium text-lg">Response sent.</p>
            <p className="text-slate-400 text-sm">Thank you for being here for someone today.</p>
          </div>
        ) : (
          <div className="card py-10 text-center space-y-2">
            <p className="text-3xl">✨</p>
            <p className="text-slate-600 font-medium">Your inbox is clear.</p>
            <p className="text-slate-400 text-sm">Check back later — someone may need you.</p>
          </div>
        )}
      </div>
    );
  }

  const response = item.responses?.[0];

  async function handleSend() {
    setSending(true);
    setError('');

    const res = await fetch('/api/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responseId: response.id,
        editedContent: editing ? editedDraft : '',
      }),
    });

    const data = await res.json();
    setSending(false);

    if (data.limitReached) { setLimitReached(true); return; }
    if (!res.ok) { setError(data.error || 'Something went wrong.'); return; }

    setSent(true);
  }

  function startEditing() {
    setEditedDraft(response.ai_draft);
    setEditing(true);
  }

  return (
    <div className="px-5 pt-6 space-y-5">
      <div>
        <h1 className="text-2xl font-light text-slate-700">Someone needs to be heard.</h1>
        <p className="text-slate-400 text-sm mt-1">Read their message, then send a response.</p>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {item.intent_tags?.map((tag) => (
          <span key={tag} className="tag-pill tag-pill-active text-xs">
            {TAG_LABELS[tag] ?? tag}
          </span>
        ))}
      </div>

      {/* Their message */}
      <div className="card bg-sky-50">
        <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{item.content}</p>
      </div>

      {/* AI draft / editable response */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-slate-400">Suggested response</p>
          {!editing && (
            <button
              onClick={startEditing}
              className="text-xs text-sky-500 hover:underline"
            >
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <textarea
            className="input resize-none h-36 text-sm"
            value={editedDraft}
            onChange={(e) => setEditedDraft(e.target.value)}
          />
        ) : (
          <div className="card border-sky-200">
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
              {response?.ai_draft}
            </p>
          </div>
        )}
      </div>

      {error && <p className="text-rose-400 text-sm">{error}</p>}

      <button
        onClick={handleSend}
        className="btn-primary w-full"
        disabled={sending}
      >
        {sending ? 'Sending…' : 'Send response'}
      </button>

      <p className="text-center text-xs text-slate-300 pb-2">
        You can edit the suggested response before sending, or send it as-is.
      </p>
    </div>
  );
}
