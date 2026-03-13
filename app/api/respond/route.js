import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createServiceClient } from '@/lib/supabase-server';
import { incrementCount, addBonus } from '@/lib/dailyLimit';

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { responseId, editedContent } = await request.json();

    if (!responseId) {
      return NextResponse.json({ error: 'responseId is required.' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Fetch the response + associated message
    const { data: response } = await serviceClient
      .from('responses')
      .select('*, messages(id, sender_id, status)')
      .eq('id', responseId)
      .single();

    if (!response) {
      return NextResponse.json({ error: 'Response not found.' }, { status: 404 });
    }

    if (response.responder_id !== user.id) {
      return NextResponse.json({ error: 'Not your response to send.' }, { status: 403 });
    }

    if (response.messages?.status === 'responded') {
      return NextResponse.json({ error: 'Already responded.' }, { status: 409 });
    }

    const finalContent = editedContent?.trim() || response.ai_draft;
    const wasEdited = !!(editedContent?.trim() && editedContent.trim() !== response.ai_draft);

    // ── Update the response row ───────────────────────────────────────────────
    await serviceClient
      .from('responses')
      .update({
        edited_content: wasEdited ? finalContent : null,
        was_edited: wasEdited,
        sent_at: new Date().toISOString(),
      })
      .eq('id', responseId);

    // ── Mark message as responded ─────────────────────────────────────────────
    await serviceClient
      .from('messages')
      .update({ status: 'responded' })
      .eq('id', response.message_id);

    // ── Increment responder's daily count ─────────────────────────────────────
    await incrementCount(supabase, user.id);

    // ── Award +1 bonus to both sender and responder ───────────────────────────
    const senderId = response.messages?.sender_id;
    if (senderId) {
      await Promise.all([
        addBonus(serviceClient, user.id),
        addBonus(serviceClient, senderId),
      ]);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[/api/respond]', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
