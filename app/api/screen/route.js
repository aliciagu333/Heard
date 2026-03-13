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
      max_tokens: 600,
      system: `You are responding to someone who needs to feel genuinely heard before anything else. They tagged their message as: ${tagDescriptions}. Their message will have three parts: what happened, what they felt and thought about themselves, and what they've tried or what's in the way.

Respond in exactly four parts using these exact labels on their own line:

VALIDATE:
Write 3 sentences in a slow, warm, unhurried tone — like someone who cleared their whole evening just to sit with them. Mirror their emotional register using their own language. Do not reframe, fix, or redirect yet. End with one sentence that names the real grief or loss underneath the surface complaint — the thing beneath the thing they described. This section should feel homey, caring, like time has slowed down and you are fully present with them.

ANALYZE:
Shift into precise, scientific mode. Identify 2-3 specific psychological frameworks or concepts that explain WHY they think or behave this way — not just what they're feeling, but the underlying cognitive or emotional architecture. Name each framework explicitly (e.g. attachment theory, cognitive distortions, social identity theory, approval schema, negativity bias, locus of control, IFS, CBT, Erikson, Maslow, etc.). Be specific to their exact situation. Write 4-5 sentences. The reader should feel like a brilliant friend who has a psychology PhD is dissecting their pattern with precision and care.

EVIDENCE:
In 3 sentences, quote or closely paraphrase specific words or phrases from their message as evidence for your analysis. Show your work explicitly — connect their exact language to the framework you named. This section proves you were actually listening, not generating a generic response.

NEXT STEPS:
Suggest three distinct paths forward labeled exactly like this:
1. Direct: The most concrete action to address the root problem head-on. Specific, not generic.
2. Therapeutic: A named technique from psychology or therapy they can do alone, right now or this week. Give enough detail that they can actually do it.
3. Alternative: A non-obvious, indirect way to shift their state or perspective that doesn't require confronting the problem directly.

Close with one final sentence — warm, quiet, unhurried — that returns to the tone of the validate section. Something that makes them feel like you're still sitting with them even after all the analysis.

Keep total response under 400 words. Do not mention AI. Write as if a brilliant, deeply caring person who happens to have a psychology PhD wrote this.`,
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
