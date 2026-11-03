// Shared data model + validation for a High Hand session.

export const CARD_VALUES = ['a', 'k', 'q', 'j', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
export const SUITS = ['h', 'r', 'k', 's']; // hjärter, ruter, klöver, spader
export const HANDS = [
  'royal_flush', 'straight_flush', 'four_kind', 'full_house', 'flush',
  'straight', 'three_kind', 'two_pair', 'pair', 'side_pot',
];
export const BACKGROUNDS = ['table.jpg', 'room.jpg'];
export const LANGS = ['sv', 'en'];

export const MAX_TEXT = 40;
export const DEFAULT_TTL_MS = 48 * 60 * 60 * 1000;

const VALID_CARDS = new Set(['nn']);
for (const v of CARD_VALUES) for (const s of SUITS) VALID_CARDS.add(v + s);

export class ValidationError extends Error {
  constructor(field) {
    super(`invalid ${field}`);
    this.field = field;
  }
}

/** Trim, strip control characters and enforce max length. */
export function cleanText(value, field, { max = MAX_TEXT } = {}) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new ValidationError(field);
  // eslint-disable-next-line no-control-regex
  const s = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (s.length > max) throw new ValidationError(field);
  return s;
}

export function cleanLang(value) {
  if (!LANGS.includes(value)) throw new ValidationError('lang');
  return value;
}

export function defaultState({ lang, club, now, ttlMs }) {
  return {
    cards: ['nn', 'nn', 'nn', 'nn', 'nn'],
    hand: 'side_pot',
    holder: '',
    count: '',
    background: BACKGROUNDS[0],
    lang,
    club,
    createdAt: now,
    expiresAt: now + ttlMs,
  };
}

/**
 * Validate a partial update coming from the admin page. Only whitelisted
 * fields are accepted; anything else is ignored. Throws ValidationError.
 */
export function cleanPatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new ValidationError('body');
  }
  const out = {};
  if ('cards' in patch) {
    const c = patch.cards;
    if (!Array.isArray(c) || c.length !== 5 || !c.every((x) => VALID_CARDS.has(x))) {
      throw new ValidationError('cards');
    }
    out.cards = [...c];
  }
  if ('hand' in patch) {
    if (!HANDS.includes(patch.hand)) throw new ValidationError('hand');
    out.hand = patch.hand;
  }
  if ('holder' in patch) out.holder = cleanText(patch.holder, 'holder');
  if ('club' in patch) out.club = cleanText(patch.club, 'club');
  if ('count' in patch) {
    const n = patch.count === null || patch.count === undefined ? '' : String(patch.count).trim();
    if (n !== '' && !/^\d{1,4}$/.test(n)) throw new ValidationError('count');
    out.count = n;
  }
  if ('background' in patch) {
    if (!BACKGROUNDS.includes(patch.background)) throw new ValidationError('background');
    out.background = patch.background;
  }
  if ('lang' in patch) out.lang = cleanLang(patch.lang);
  return out;
}

/** A "real" high hand: not the side-pot/reset state and at least one face-up card. */
export function isRealHand(state) {
  return state.hand !== 'side_pot' && Array.isArray(state.cards) && state.cards.some((c) => c !== 'nn');
}
