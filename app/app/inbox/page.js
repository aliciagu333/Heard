import { createClient } from '@/lib/supabase-server';
import InboxClient from './InboxClient';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch messages routed to this user that haven't been responded to
  const { data: pendingItems } = await supabase
    .from('messages')
    .select(`
      id, content, intent_tags, created_at,
      responses!inner(id, ai_draft, edited_content, was_edited, sent_at)
    `)
    .eq('receiver_id', user.id)
    .eq('status', 'routed')
    .order('created_at', { ascending: false });

  return <InboxClient items={pendingItems ?? []} />;
}
