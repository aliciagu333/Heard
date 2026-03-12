import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';
import { createServiceClient } from '@/lib/supabase-server';
import { isCrisis, CRISIS_RESOURCES } from '@/lib/crisis';
import { checkLimit, incrementCount } from '@/lib/dailyLimit';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TAG_LABELS = {
  vent: 'venting and being heard',
  advice: 'practical advice',
  validation: 'validation and reassurance',
  understand: 'understanding themselves better',
};

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content, intent_tags } = await request.json();

    if (!content?.trim() || !intent_tags?.length) {
      return NextResponse.json({ error: 'Message and at least one tag are required.' }, { status: 400 });
    }

    // ── 1. Crisis screening — FIRST, always ──────────────────────────────────
    if (isCrisis(content)) {
      // Save as crisis-flagged but do NOT route
      const serviceClient = createServiceClient();
      await serviceClient.from('messages').insert({
        sender_id: user.id,
        content,
        intent_tags,
        status: 'expired',
        crisis_flagged: true,
      });

      return NextResponse.json({ crisis: true, resources: CRISIS_RESOURCES });
    }

    // ── 2. Check daily limit ─────────────────────────────────────────────────
    const { allowed } = await checkLimit(supabase, user.id);
    if (!allowed) {
      return NextResponse.json({ limitReached: true }, { status: 200 });
    }

    // ── 3. Generate AI draft via Claude ─────────────────────────────────────
    const tagDescriptions = intent_tags
      .map((t) => TAG_LABELS[t] ?? t)
      .join(', ');

    const aiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: `You are helping a human respond to someone who needs emotional support.
Write a warm, genuine response (3–5 sentences) that:
- Acknowledges their feelings without projecting emotions onto them
- Addresses what they're looking for: ${tagDescriptions}
- Ends with a single open, non-pressuring question
Do not use clinical language. Do not mention AI, therapy, or that this is a draft.
Write as if you are a caring human friend.`,
      messages: [{ role: 'user', content: `The person wrote:\n\n"${content}"` }],
    });

    const aiDraft = aiResponse.content[0].text;

    // ── 4. Find an available responder (not the sender) ─────────────────────
    const serviceClient = createServiceClient();

    const todayMidnight = new Date();
    todayMidnight.setUTCHours(0, 0, 0, 0);

    // Find users who have capacity: daily_count < (1 + daily_extras)
    // We fetch candidates and filter in JS to handle the dynamic limit
    const { data: candidates } = await serviceClient
      .from('users')
      .select('id, daily_count, last_reset, settings_json')
      .neq('id', user.id)
      .order('daily_count', { ascending: true })
      .limit(20);

    let receiverId = null;
    for (const candidate of candidates ?? []) {
      const lastReset = new Date(candidate.last_reset);
      const count = lastReset < todayMidnight ? 0 : (candidate.daily_count ?? 0);
      const extras = candidate.settings_json?.daily_extras ?? 0;
      const limit = 1 + extras;
      if (count < limit) {
        receiverId = candidate.id;
        break;
      }
    }

    // ── 5. Save message ───────────────────────────────────────────────────────
    const { data: message, error: msgError } = await serviceClient
      .from('messages')
      .insert({
        sender_id: user.id,
        receiver_id: receiverId,
        content,
        intent_tags,
        status: receiverId ? 'routed' : 'pending',
        routed_at: receiverId ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (msgError) {
      return NextResponse.json({ error: 'Failed to save message.' }, { status: 500 });
    }

    // ── 6. Save AI draft in responses table (pre-populated for responder) ────
    await serviceClient.from('responses').insert({
      message_id: message.id,
      responder_id: receiverId ?? user.id, // placeholder if no receiver yet
      ai_draft: aiDraft,
    });

    // ── 7. Increment sender's daily count ────────────────────────────────────
    await incrementCount(supabase, user.id);

    return NextResponse.json({ success: true, messageId: message.id });
  } catch (err) {
    console.error('[/api/screen]', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
