export default function DailyLimitBanner() {
  return (
    <div className="card border-sky-200 text-center space-y-2 py-8">
      <p className="text-2xl">🌙</p>
      <p className="text-slate-600 font-medium">You&apos;ve done your part for today.</p>
      <p className="text-slate-400 text-sm leading-relaxed">
        Come back tomorrow. Each day brings a fresh start — one message, one connection.
      </p>
      <p className="text-sky-400 text-xs mt-2">Resets at midnight UTC</p>
    </div>
  );
}
