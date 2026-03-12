import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

// Called by Vercel cron daily at 00:00 UTC.
// Resets all users' daily_count to 0.

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceClient = createServiceClient();

  const { error } = await serviceClient
    .from('users')
    .update({ daily_count: 0, last_reset: new Date().toISOString() })
    .lt('daily_count', 9999); // update all rows (Supabase requires a filter)

  if (error) {
    console.error('[/api/reset-daily]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, resetAt: new Date().toISOString() });
}
