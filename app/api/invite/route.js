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

    // Send invite email via Resend
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'heard <onboarding@resend.dev>',
        reply_to: 'aliciagu333@gmail.com',
        to: normalizedEmail,
        subject: 'someone wants you to hear them.',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; color: #334155;">
            <h1 style="font-size: 28px; font-weight: 300; color: #1e3a5f; margin-bottom: 8px;">heard.</h1>
            <p style="color: #94a3b8; margin-top: 0;">a space to be heard.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 16px; line-height: 1.6;">
              A friend invited you to join <strong>heard</strong> — a messenger where your struggles go to a real person, who sends back a thoughtful response.
            </p>
            <p style="font-size: 16px; line-height: 1.6;">
              When you join, you'll be able to send and receive messages — and your friend is already waiting.
            </p>
            <a href="https://heardvmvp.vercel.app/auth/signup" style="display: inline-block; margin-top: 24px; padding: 14px 28px; background: #38bdf8; color: white; text-decoration: none; border-radius: 999px; font-size: 15px;">
              Join heard
            </a>
            <p style="margin-top: 32px; font-size: 13px; color: #94a3b8;">
              You're receiving this because a friend invited you. No account required to decline — just ignore this email.
            </p>
          </div>
        `,
      }),
    });

    return NextResponse.json({ success: true, inviteId: invite.id });
  } catch (err) {
    console.error('[/api/invite]', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

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

    await serviceClient
      .from('invites')
      .update({ accepted: true })
      .eq('id', invite.id);

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