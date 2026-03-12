import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

// Called by Vercel cron every 1 minute.
// Re-routes messages that have been sitting with a receiver for > 5 minutes.

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const todayMidnight = new Date();
  todayMidnight.setUTCHours(0, 0, 0, 0);

  // Find stale routed messages
  const { data: staleMessages } = await serviceClient
    .from('messages')
    .select('id, sender_id, receiver_id')
    .eq('status', 'routed')
    .lt('routed_at', fiveMinutesAgo);

  if (!staleMessages?.length) {
    return NextResponse.json({ rerouted: 0 });
  }

  let reroutedCount = 0;

  for (const msg of staleMessages) {
    // Find a new receiver — not the sender, not the previous receiver
    const { data: candidates } = await serviceClient
      .from('users')
      .select('id, daily_count, last_reset, settings_json')
      .neq('id', msg.sender_id)
      .neq('id', msg.receiver_id)
      .order('daily_count', { ascending: true })
      .limit(20);

    let newReceiverId = null;
    for (const candidate of candidates ?? []) {
      const lastReset = new Date(candidate.last_reset);
      const count = lastReset < todayMidnight ? 0 : (candidate.daily_count ?? 0);
      const extras = candidate.settings_json?.daily_extras ?? 0;
      if (count < 1 + extras) {
        newReceiverId = candidate.id;
        break;
      }
    }

    if (newReceiverId) {
      await serviceClient
        .from('messages')
        .update({ receiver_id: newReceiverId, routed_at: new Date().toISOString() })
        .eq('id', msg.id);

      // Update the response row to the new responder
      await serviceClient
        .from('responses')
        .update({ responder_id: newReceiverId })
        .eq('message_id', msg.id);

      reroutedCount++;
    }
  }

  return NextResponse.json({ rerouted: reroutedCount });
}
