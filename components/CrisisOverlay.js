'use client';

const RESOURCES = [
  { name: '988 Suicide & Crisis Lifeline', contact: 'Call or text 988', url: 'https://988lifeline.org' },
  { name: 'Crisis Text Line', contact: 'Text HOME to 741741', url: 'https://crisistextline.org' },
  { name: 'International crisis centers', contact: 'Find your local line', url: 'https://www.iasp.info/resources/Crisis_Centres/' },
];

export default function CrisisOverlay({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-xl max-w-sm w-full p-7 space-y-5">
        <div className="space-y-2">
          <h2 className="text-xl font-medium text-slate-700">You matter.</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            It sounds like you might be going through something really hard. Please reach out to someone trained to help right now.
          </p>
        </div>

        <div className="space-y-3">
          {RESOURCES.map((r) => (
            <a
              key={r.name}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block card hover:border-sky-300 transition-colors no-underline"
            >
              <p className="text-sm font-medium text-slate-700">{r.name}</p>
              <p className="text-sky-500 text-sm mt-0.5">{r.contact}</p>
            </a>
          ))}
        </div>

        <button
          onClick={onClose}
          className="btn-secondary w-full text-sm"
        >
          I&apos;m okay, go back
        </button>
      </div>
    </div>
  );
}
