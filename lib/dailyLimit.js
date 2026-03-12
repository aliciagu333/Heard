// Daily limit logic. Base = 1 send + 1 respond per day.
// Extras are tracked separately and add to the ceiling.

const BASE_DAILY_LIMIT = 1;

/**
 * Reset a user's daily count if their last_reset was before today UTC midnight.
 * Returns the updated user row.
 */
export async function resetIfNeeded(supabase, userId) {
  const todayMidnight = new Date();
  todayMidnight.setUTCHours(0, 0, 0, 0);

  const { data: user } = await supabase
    .from('users')
    .select('daily_count, last_reset, settings_json')
    .eq('id', userId)
    .single();

  if (!user) return null;

  const lastReset = new Date(user.last_reset);
  if (lastReset < todayMidnight) {
    const { data: updated } = await supabase
      .from('users')
      .update({ daily_count: 0, last_reset: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();
    return updated;
  }

  return user;
}

/**
 * Returns { allowed, remaining, limit } for a user.
 * extras are stored in settings_json.daily_extras (integer).
 */
export async function checkLimit(supabase, userId) {
  const user = await resetIfNeeded(supabase, userId);
  if (!user) return { allowed: false, remaining: 0, limit: BASE_DAILY_LIMIT };

  const extras = user.settings_json?.daily_extras ?? 0;
  const limit = BASE_DAILY_LIMIT + extras;
  const remaining = Math.max(0, limit - user.daily_count);

  return { allowed: remaining > 0, remaining, limit };
}

/**
 * Increments a user's daily_count by 1.
 */
export async function incrementCount(supabase, userId) {
  const user = await resetIfNeeded(supabase, userId);
  if (!user) return;

  await supabase
    .from('users')
    .update({ daily_count: (user.daily_count ?? 0) + 1 })
    .eq('id', userId);
}

/**
 * Adds +1 to daily_extras in settings_json for a user (earned bonus).
 */
export async function addBonus(supabase, userId) {
  const { data: user } = await supabase
    .from('users')
    .select('settings_json')
    .eq('id', userId)
    .single();

  if (!user) return;

  const settings = user.settings_json ?? {};
  const newExtras = (settings.daily_extras ?? 0) + 1;

  await supabase
    .from('users')
    .update({ settings_json: { ...settings, daily_extras: newExtras } })
    .eq('id', userId);
}
