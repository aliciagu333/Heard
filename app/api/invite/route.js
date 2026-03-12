import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createServiceClient } from '@/lib/supabase-server';
import { addBonus } from '@/lib/dailyLimit';

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { email } = await request.json();
    if (!email?.trim()) return NextResponse.json({ error: 'Email is required.' }, { status: 400 });

    const normalizedEmail = email.trim().toLowerCase();

    // Prevent duplicate invites
    const { data: existing } = await supabase
      .from('invites')
      .select('id, accepted')
      .eq('inviter_id', user.id)
      .eq('invitee_email', normalizedEmail)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'You already invited this person.' }, { status: 409 });
    }

    const { data: invite } = await supabase
      .from('invites')
      .insert({ inviter_id: user.id, invitee_email: normalizedEmail })
      .select()
      .single();

    return NextResponse.json({ success: true, inviteId: invite.id });
  } catch (err) {
    console.error('[/api/invite]', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

// Called when an invited user signs up — accepts the invite and grants bonuses
export async function PATCH(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const serviceClient = createServiceClient();

    const { data: invite } = await serviceClient
      .from('invites')
      .select('id, inviter_id, accepted')
      .eq('invitee_email', user.email.toLowerCase())
      .eq('accepted', false)
      .maybeSingle();

    if (!invite) return NextResponse.json({ alreadyAccepted: true });

    // Mark accepted
    await serviceClient
      .from('invites')
      .update({ accepted: true })
      .eq('id', invite.id);

    // +1 bonus for both inviter and invitee
    await Promise.all([
      addBonus(serviceClient, invite.inviter_id),
      addBonus(serviceClient, user.id),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[/api/invite PATCH]', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
