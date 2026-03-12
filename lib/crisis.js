// Crisis language detection — runs BEFORE any AI or routing.
// Conservative: false positives are acceptable; false negatives are not.

const CRISIS_PATTERNS = [
  // Suicidal ideation
  /\bsuicid/i,
  /\bkill\s+(my)?self/i,
  /\bend\s+(my\s+)?life/i,
  /\bwant\s+to\s+die/i,
  /\bbetter\s+off\s+dead/i,
  /\bbetter\s+off\s+without\s+me/i,
  /\bno\s+reason\s+to\s+(live|be\s+alive)/i,
  /\bcan'?t\s+(go\s+on|take\s+it\s+anymore)/i,
  /\bdon'?t\s+want\s+to\s+(be\s+here|exist|live)/i,
  /\bgiving\s+up\s+on\s+(life|everything)/i,
  // Self-harm
  /\bself[\s-]?harm/i,
  /\bcutting\s+my?self/i,
  /\bhurt\s+(my)?self/i,
  // Immediate danger
  /\boverdos/i,
  /\btake\s+(all\s+)?(the\s+)?pills/i,
  /\bgoodbye\s+(cruel|everyone|world|forever)/i,
  /\blast\s+(note|letter|message|goodbye)/i,
];

const CRISIS_RESOURCES = [
  { name: '988 Suicide & Crisis Lifeline', contact: 'Call or text 988', url: 'https://988lifeline.org' },
  { name: 'Crisis Text Line', contact: 'Text HOME to 741741', url: 'https://crisistextline.org' },
  { name: 'International Association for Suicide Prevention', contact: 'https://www.iasp.info/resources/Crisis_Centres/', url: null },
];

/**
 * Returns true if the message contains crisis language.
 * @param {string} text
 * @returns {boolean}
 */
export function isCrisis(text) {
  if (!text || typeof text !== 'string') return false;
  return CRISIS_PATTERNS.some((pattern) => pattern.test(text));
}

export { CRISIS_RESOURCES };
