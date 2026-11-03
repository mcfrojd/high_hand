// Shared data model + validation for a High Hand session.

export const CARD_VALUES = ['a', 'k', 'q', 'j', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
export const SUITS = ['h', 'r', 'k', 's']; // hjärter, ruter, klöver, spader
export const HANDS = [
  'royal_flush', 'straight_flush', 'four_kind', 'full_house', 'flush',
  'straight', 'three_kind', 'two_pair', 'pair', 'high_card', 'side_pot',
];
export const BACKGROUNDS = ['room.jpg', 'table.jpg']; // first = default
export const CUSTOM_BG = 'custom'; // uploaded image, stored in the session's Durable Object
export const MAX_BG_BYTES = 1.5 * 1024 * 1024;
export const LANGS = ['sv', 'en'];

export const MAX_TEXT = 40;
export const MAX_MESSAGE = 300;
export const MAX_MESSAGE_LINES = 8;
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

/** Multi-line text (pre-game message): keeps line breaks, strips other control chars. */
export function cleanMultiline(value, field) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new ValidationError(field);
  const lines = value
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '')
    .split('\n')
    .map((l) => l.trim());
  while (lines.length && !lines[0]) lines.shift();
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  const out = lines.join('\n');
  if (out.length > MAX_MESSAGE || lines.length > MAX_MESSAGE_LINES) throw new ValidationError(field);
  return out;
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
    message: '',
    messageOn: false,
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
    const faceUp = c.filter((x) => x !== 'nn');
    if (new Set(faceUp).size !== faceUp.length) throw new ValidationError('cards'); // same card twice
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
    // 'custom' is only accepted when an image exists; the session checks that.
    if (!BACKGROUNDS.includes(patch.background) && patch.background !== CUSTOM_BG) {
      throw new ValidationError('background');
    }
    out.background = patch.background;
  }
  if ('lang' in patch) out.lang = cleanLang(patch.lang);
  if ('message' in patch) out.message = cleanMultiline(patch.message, 'message');
  if ('messageOn' in patch) {
    if (typeof patch.messageOn !== 'boolean') throw new ValidationError('messageOn');
    out.messageOn = patch.messageOn;
  }
  return out;
}

/** A "real" high hand: not the side-pot/reset state and at least one face-up card. */
export function isRealHand(state) {
  return state.hand !== 'side_pot' && Array.isArray(state.cards) && state.cards.some((c) => c !== 'nn');
}
