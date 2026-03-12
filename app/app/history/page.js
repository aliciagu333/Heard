import { createClient } from '@/lib/supabase-server';
import { formatDistanceToNow } from '@/lib/formatDate';

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Messages I sent + any response received
  const { data: sent } = await supabase
    .from('messages')
    .select(`
      id, content, intent_tags, status, created_at,
      responses(id, ai_draft, edited_content, was_edited, sent_at)
    `)
    .eq('sender_id', user.id)
    .order('created_at', { ascending: false });

  // Messages I responded to
  const { data: responded } = await supabase
    .from('responses')
    .select(`
      id, edited_content, ai_draft, was_edited, sent_at,
      messages!inner(id, content, intent_tags, created_at)
    `)
    .eq('responder_id', user.id)
    .order('sent_at', { ascending: false });

  return (
    <div className="px-5 pt-6 space-y-8 pb-8">
      <h1 className="text-2xl font-light text-slate-700">History</h1>

      {/* Messages I sent */}
      <section className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-slate-400">Messages I sent</p>
        {!sent?.length && (
          <div className="card text-center py-6">
            <p className="text-slate-300 text-sm">Nothing yet.</p>
          </div>
        )}
        {sent?.map((msg) => {
          const response = msg.responses?.[0];
          return (
            <div key={msg.id} className="card space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {msg.intent_tags?.map((t) => (
                  <span key={t} className="tag-pill tag-pill-active text-xs">{t}</span>
                ))}
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                  msg.status === 'responded' ? 'bg-sky-100 text-sky-600' :
                  msg.status === 'routed' ? 'bg-amber-50 text-amber-500' :
                  'bg-slate-100 text-slate-400'
                }`}>{msg.status}</span>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed line-clamp-3">{msg.content}</p>
              {response && (
                <div className="border-t border-sky-50 pt-3 space-y-1">
                  <p className="text-xs text-slate-400">Response received</p>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {response.edited_content || response.ai_draft}
                  </p>
                </div>
              )}
              <p className="text-xs text-slate-300">{formatDistanceToNow(msg.created_at)}</p>
            </div>
          );
        })}
      </section>

      {/* Messages I responded to */}
      <section className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-slate-400">Responses I sent</p>
        {!responded?.length && (
          <div className="card text-center py-6">
            <p className="text-slate-300 text-sm">Nothing yet.</p>
          </div>
        )}
        {responded?.map((r) => (
          <div key={r.id} className="card space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {r.messages?.intent_tags?.map((t) => (
                <span key={t} className="tag-pill tag-pill-active text-xs">{t}</span>
              ))}
              {r.was_edited && (
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-400 font-medium">Edited</span>
              )}
            </div>
            <p className="text-slate-400 text-xs italic line-clamp-2">{r.messages?.content}</p>
            <div className="border-t border-sky-50 pt-3">
              <p className="text-xs text-slate-400 mb-1">My response</p>
              <p className="text-slate-600 text-sm leading-relaxed">
                {r.edited_content || r.ai_draft}
              </p>
            </div>
            <p className="text-xs text-slate-300">{formatDistanceToNow(r.sent_at)}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
