'use client';

import { useState } from 'react';
import CrisisOverlay from '@/components/CrisisOverlay';
import DailyLimitBanner from '@/components/DailyLimitBanner';

const TAGS = [
  { id: 'vent', label: 'Vent' },
  { id: 'advice', label: 'Advice' },
  { id: 'validation', label: 'Validation' },
  { id: 'understand', label: 'Help me understand myself' },
];

const MAX_CHARS = 1500;

export default function SendPage() {
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [crisis, setCrisis] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [sent, setSent] = useState(false);

  function toggleTag(id) {
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!content.trim() || !selectedTags.length) return;
    setLoading(true);
    setError('');

    const res = await fetch('/api/screen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.trim(), intent_tags: selectedTags }),
    });

    const data = await res.json();
    setLoading(false);

    if (data.crisis) { setCrisis(true); return; }
    if (data.limitReached) { setLimitReached(true); return; }
    if (!res.ok) { setError(data.error || 'Something went wrong. Please try again.'); return; }
    setSent(true);
  }

  if (limitReached) return <div className="px-5 pt-8"><DailyLimitBanner /></div>;

  if (sent) {
    return (
      <div className="px-5 pt-8 text-center space-y-4">
        <div className="card py-10 space-y-3">
          <p className="text-3xl">💙</p>
          <p className="text-slate-700 font-medium text-lg">Your message is on its way.</p>
          <p className="text-slate-400 text-sm leading-relaxed">Someone will hear you soon. You&apos;ll find their response in your history.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {crisis && <CrisisOverlay onClose={() => setCrisis(false)} />}
      <div className="px-5 pt-6 space-y-6">
        <div>
          <h1 className="text-2xl font-light text-slate-700">What&apos;s on your mind?</h1>
          <p className="text-slate-400 text-sm mt-1">Your message goes to a real person. They&apos;ll hear you.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400 mb-3">I&apos;m looking for</p>
            <div className="flex flex-wrap gap-2">
              {TAGS.map(({ id, label }) => (
                <button key={id} type="button" onClick={() => toggleTag(id)}
                  className={`tag-pill ${selectedTags.includes(id) ? 'tag-pill-active' : 'tag-pill-inactive'}`}>
                  {label}
                </button>
              ))}
            </div>
            {!selectedTags.length && <p className="text-xs text-slate-300 mt-2">Choose at least one</p>}
          </div>
          <div className="rounded-2xl bg-sky-50 p-4 space-y-2">
            <p className="text-sm leading-relaxed"><span className="font-medium text-slate-600">1. What happened?</span> <span className="text-slate-400">(just the facts)</span></p>
            <p className="text-sm leading-relaxed"><span className="font-medium text-slate-600">2. What did you feel</span> <span className="text-slate-400">— and how did that make you think about yourself?</span></p>
            <p className="text-sm leading-relaxed"><span className="font-medium text-slate-600">3. What have you already tried?</span> <span className="text-slate-400">If nothing yet — what&apos;s in the way?</span></p>
          </div>
          <div className="relative">
            <textarea className="input resize-none h-56"
              placeholder="Write freely — address all three questions in whatever order feels natural…"
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
              required />
            <span className="absolute bottom-3 right-4 text-xs text-slate-300">{content.length}/{MAX_CHARS}</span>
          </div>
          {error && <p className="text-rose-400 text-sm">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading || !content.trim() || !selectedTags.length}>
            {loading ? 'Sending…' : 'Send it out'}
          </button>
        </form>
      </div>
    </>
  );
}