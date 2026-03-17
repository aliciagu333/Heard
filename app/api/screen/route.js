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

    if (isCrisis(content)) {
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

    const { allowed } = await checkLimit(supabase, user.id);
    if (!allowed) {
      return NextResponse.json({ limitReached: true }, { status: 200 });
    }

    const tagDescriptions = intent_tags
      .map((t) => TAG_LABELS[t] ?? t)
      .join(', ');

    const aiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: `You are responding to someone who needs to feel genuinely heard before anything else. They tagged their message as: ${tagDescriptions}. Their message will address three things: what happened, what they felt and how it made them think about themselves, and what they have tried or what is in the way.

Respond in exactly four parts using these exact labels on their own line:

VALIDATE:
Write 3-4 sentences in a slow, warm, unhurried tone — like someone who cleared their whole evening just to sit with them. Mirror their emotional register using their own language. Do not reframe, fix, or redirect yet. End with one sentence that names the real grief or loss underneath the surface complaint — the thing beneath the thing they described. This section should feel homey and caring, like time has slowed down and you are fully present with them.

ANALYZE:
Shift into precise, scientific mode. Identify 2-3 specific psychological frameworks or concepts that explain WHY they think or behave this way — not just what they are feeling, but the underlying cognitive or emotional architecture driving it. Name each framework explicitly in plain text — for example: Social Identity Theory (Tajfel), identity foreclosure (Erikson), approval schema (Young), cognitive dissonance, negativity bias, locus of control, IFS, CBT, attachment theory. Write 4-5 sentences. Be specific to their exact situation, not generic. The reader should feel like a brilliant friend who has a psychology PhD is dissecting their pattern with precision and care.

EVIDENCE:
In 3 sentences, quote or closely paraphrase specific words or phrases from their message as evidence for your analysis above. Connect their exact language to the framework you named. Show your work — this proves you were actually listening, not generating a generic response.

NEXT STEPS:
Suggest three distinct paths forward labeled exactly like this:
1. Direct — [short label]: One paragraph. The most concrete action to address the root problem head-on. Specific, not generic.
2. Therapeutic — [short label]: One paragraph. A named technique from psychology or therapy they can do alone. Name the specific technique (IFS parts work, CBT thought record, somatic grounding, etc.) and give enough detail that they can actually do it.
3. Alternative — [short label]: One paragraph. A non-obvious, indirect way to shift their state or perspective that does not require confronting the problem directly.

Close with one final sentence — warm, quiet, unhurried — that returns to the tone of the validate section. Something that makes them feel like you are still sitting with them even after all the analysis.

Rules you must follow:
- Do not use markdown asterisks, bold, or any special formatting symbols anywhere in the response
- Write in clean plain prose throughout
- Do not mention AI
- Write as if a brilliant, deeply caring person who happens to have a psychology PhD wrote this — someone who makes the reader feel like their problem is the most important thing in the room right now`
      messages: [{ role: 'user', content: `The person wrote:\n\n"${content}"` }],
    });

    const aiDraft = aiResponse.content[0].text;

    const serviceClient = createServiceClient();

    const todayMidnight = new Date();
    todayMidnight.setUTCHours(0, 0, 0, 0);

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

    await serviceClient.from('responses').insert({
      message_id: message.id,
      responder_id: receiverId ?? user.id,
      ai_draft: aiDraft,
    });

    await incrementCount(supabase, user.id);

    return NextResponse.json({ success: true, messageId: message.id });
  } catch (err) {
    console.error('[/api/screen]', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}