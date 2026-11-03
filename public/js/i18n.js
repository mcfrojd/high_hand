// Swedish / English texts.

export const STRINGS = {
  sv: {
    title: 'Kvällens high hand',
    registered: 'Antal anmälda:',
    expired: 'Nyckeln har gått ut eller finns inte.',
    createNew: 'Skapa en ny nyckel på',
    connecting: 'Ansluter…',
    card: 'Kort',
    value: 'Värde',
    suit: 'Färg',
    hand: 'Hand',
    count: 'Antal',
    holder: 'Innehavare',
    reset: 'Återställ',
    save: 'Spara',
    saving: 'Sparar…',
    saved: 'Sparat ✓',
    saveFailed: 'Kunde inte spara',
    invalid: 'Ogiltigt värde',
    settings: 'Inställningar',
    background: 'Bakgrund',
    language: 'Språk',
    club: 'Klubbnamn',
    displayLink: 'Skärmlänk (visa på TV:n)',
    adminLink: 'Adminlänk (för att uppdatera)',
    copy: 'Kopiera',
    copied: 'Kopierat!',
    open: 'Öppna',
    expiresAt: 'Nyckeln upphör',
    close: 'Stäng',
    values: { a: 'Ess', k: 'Kung', q: 'Dam', j: 'Knekt', nn: 'Baksida' },
    suits: { h: 'Hjärter', r: 'Ruter', k: 'Klöver', s: 'Spader' },
    hands: {
      royal_flush: 'Royal Straight Flush',
      straight_flush: 'Färgstege',
      four_kind: 'Fyrtal',
      full_house: 'Kåk',
      flush: 'Färg',
      straight: 'Stege',
      three_kind: 'Triss',
      two_pair: 'Två par',
      pair: 'Ett par',
      side_pot: 'Frivillig sidopott',
    },
    backgrounds: { 'table.jpg': 'Pokerbord', 'room.jpg': 'Rum' },
    // Start page
    startLead: 'Visa kvällens high hand på en skärm och uppdatera den från mobilen. Gratis, utan konto.',
    createTitle: 'Skapa en ny high hand-skärm',
    clubPlaceholder: 'T.ex. Pokerklubben Ess',
    clubOptional: 'Klubbnamn (valfritt, visas på skärmen)',
    create: 'Skapa',
    creating: 'Skapar…',
    createFailed: 'Det gick inte att skapa en nyckel. Försök igen om en stund.',
    yourLinks: 'Dina länkar',
    saveLinks: 'Spara länkarna! Nyckeln kan inte återskapas och raderas automatiskt efter 48 timmar.',
    openExisting: 'Öppna en befintlig nyckel',
    keyPlaceholder: 'Nyckel eller länk',
    invalidKey: 'Ogiltig nyckel',
    lastKey: 'Senast skapade nyckel',
    notFoundTitle: 'Sidan finns inte',
    backHome: 'Till startsidan',
  },
  en: {
    title: "Tonight's high hand",
    registered: 'Players registered:',
    expired: 'This key has expired or does not exist.',
    createNew: 'Create a new key at',
    connecting: 'Connecting…',
    card: 'Card',
    value: 'Value',
    suit: 'Suit',
    hand: 'Hand',
    count: 'Count',
    holder: 'Holder',
    reset: 'Reset',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved ✓',
    saveFailed: 'Could not save',
    invalid: 'Invalid value',
    settings: 'Settings',
    background: 'Background',
    language: 'Language',
    club: 'Club name',
    displayLink: 'Screen link (show on the TV)',
    adminLink: 'Admin link (for updating)',
    copy: 'Copy',
    copied: 'Copied!',
    open: 'Open',
    expiresAt: 'Key expires',
    close: 'Close',
    values: { a: 'Ace', k: 'King', q: 'Queen', j: 'Jack', nn: 'Back' },
    suits: { h: 'Hearts', r: 'Diamonds', k: 'Clubs', s: 'Spades' },
    hands: {
      royal_flush: 'Royal Flush',
      straight_flush: 'Straight Flush',
      four_kind: 'Four of a Kind',
      full_house: 'Full House',
      flush: 'Flush',
      straight: 'Straight',
      three_kind: 'Three of a Kind',
      two_pair: 'Two Pair',
      pair: 'One Pair',
      side_pot: 'Optional side pot',
    },
    backgrounds: { 'table.jpg': 'Poker table', 'room.jpg': 'Room' },
    startLead: "Show tonight's high hand on a screen and update it from your phone. Free, no account needed.",
    createTitle: 'Create a new high hand screen',
    clubPlaceholder: 'E.g. Aces Poker Club',
    clubOptional: 'Club name (optional, shown on the screen)',
    create: 'Create',
    creating: 'Creating…',
    createFailed: 'Could not create a key. Please try again shortly.',
    yourLinks: 'Your links',
    saveLinks: 'Save these links! The key cannot be recovered and is deleted automatically after 48 hours.',
    openExisting: 'Open an existing key',
    keyPlaceholder: 'Key or link',
    invalidKey: 'Invalid key',
    lastKey: 'Last created key',
    notFoundTitle: 'Page not found',
    backHome: 'Back to start page',
  },
};

export function strings(lang) {
  return STRINGS[lang] || STRINGS.sv;
}

/** Fill every [data-i18n] element with the text for its key. */
export function applyI18n(lang, root = document) {
  const s = strings(lang);
  document.documentElement.lang = lang;
  for (const el of root.querySelectorAll('[data-i18n]')) {
    const text = s[el.dataset.i18n];
    if (typeof text === 'string') el.textContent = text;
  }
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) {
    const text = s[el.dataset.i18nPlaceholder];
    if (typeof text === 'string') el.placeholder = text;
  }
}

export function formatTime(ts, lang) {
  return new Date(ts).toLocaleString(lang === 'en' ? 'en-GB' : 'sv-SE', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function browserLang() {
  const l = (navigator.language || 'sv').toLowerCase();
  return l.startsWith('sv') || l.startsWith('nb') || l.startsWith('no') || l.startsWith('da') ? 'sv' : 'en';
}
