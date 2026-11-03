// Card helpers for the admin page: hand evaluation and duplicate-free suits.
// Card format matches the images in /images/cards/: value + suit, e.g. "ah", "10s"; "nn" = back.

export const CARD_VALUES = ['a', 'k', 'q', 'j', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'nn'];
export const SUITS = ['s', 'h', 'r', 'k']; // spader, hjärter, ruter, klöver

const RANK_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k', 'a'];

export const splitCard = (card) => (card === 'nn' ? { value: 'nn', suit: null } : { value: card.slice(0, -1), suit: card.slice(-1) });

/** Returns a hand code (see HANDS in src/model.js), or null if not all five cards are face up. */
export function evaluateHand(cards) {
  if (cards.length !== 5 || cards.some((c) => c === 'nn')) return null;
  const parsed = cards.map(splitCard);
  const ranks = parsed.map((c) => RANK_ORDER.indexOf(c.value)).sort((a, b) => b - a);
  const isFlush = parsed.every((c) => c.suit === parsed[0].suit);

  const counts = Object.values(ranks.reduce((acc, r) => ({ ...acc, [r]: (acc[r] || 0) + 1 }), {})).sort((a, b) => b - a);
  const unique = [...new Set(ranks)];
  let isStraight = false;
  if (unique.length === 5) {
    isStraight = unique[0] - unique[4] === 4
      || (unique[0] === 12 && unique[1] === 3 && unique[4] === 0); // A-2-3-4-5
  }
  const isRoyal = isStraight && unique[0] === 12 && unique[4] === 8;

  if (isFlush && isRoyal) return 'royal_flush';
  if (isFlush && isStraight) return 'straight_flush';
  if (counts[0] === 4) return 'four_kind';
  if (counts[0] === 3 && counts[1] === 2) return 'full_house';
  if (isFlush) return 'flush';
  if (isStraight) return 'straight';
  if (counts[0] === 3) return 'three_kind';
  if (counts[0] === 2 && counts[1] === 2) return 'two_pair';
  if (counts[0] === 2) return 'pair';
  return 'high_card';
}

/** Is `card` already used by another position than `idx`? */
export function isTaken(cards, idx, card) {
  return card !== 'nn' && cards.some((c, i) => i !== idx && c === card);
}

/** All four suits of `value` are used by other positions. */
export function isValueFullyTaken(cards, idx, value) {
  return value !== 'nn' && SUITS.every((s) => isTaken(cards, idx, value + s));
}

/**
 * Suit for a newly chosen value at `idx`: prefer the suit of the nearest
 * previous face-up card (so flushes are quick to enter), else the first
 * suit that does not collide with another card.
 */
export function pickSuit(cards, idx, value, current) {
  let preferred = current || SUITS[0];
  for (let i = idx - 1; i >= 0; i--) {
    if (cards[i] !== 'nn') {
      preferred = splitCard(cards[i]).suit;
      break;
    }
  }
  const ordered = [preferred, ...SUITS.filter((s) => s !== preferred)];
  return ordered.find((s) => !isTaken(cards, idx, value + s)) ?? preferred;
}

/** Same rule as isRealHand in src/model.js: not the reset/side-pot state and a face-up card. */
export function isRealHand(state) {
  return state.hand !== 'side_pot' && Array.isArray(state.cards) && state.cards.some((c) => c !== 'nn');
}
