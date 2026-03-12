import { createClient } from '@/lib/supabase-server';
import InviteClient from './InviteClient';

export default async function InvitePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: invites } = await supabase
    .from('invites')
    .select('id, invitee_email, accepted, created_at')
    .eq('inviter_id', user.id)
    .order('created_at', { ascending: false });

  return <InviteClient invites={invites ?? []} />;
}
