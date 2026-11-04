// Cookie consent (LEK/GDPR) for Matomo, shown on the start page only.
// matomo.js always pushes 'requireCookieConsent', so Matomo tracks without
// cookies until the visitor accepts here. Matomo remembers an accept in its own
// cookie (mtm_cookie_consent), which then applies to every page on the site.
// The choice itself is kept in localStorage so the banner is not shown again.
import { strings } from '/js/i18n.js';

const CONSENT_KEY = 'highhand:cookieConsent';

function paq(...cmd) {
  (window._paq = window._paq || []).push(cmd);
}

function getChoice() {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

function setChoice(choice) {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    // storage unavailable: the banner shows again next visit
  }
  if (choice === 'granted') paq('rememberCookieConsentGiven');
  else paq('forgetCookieConsentGiven');
}

let banner = null;

/** Build the banner (hidden) and show it if the visitor has not chosen yet. */
export function initConsent() {
  banner = document.createElement('aside');
  banner.className = 'consent';
  banner.setAttribute('aria-labelledby', 'consentTitle');
  banner.hidden = true;
  banner.innerHTML = `
    <h2 id="consentTitle" data-i18n="consentTitle"></h2>
    <p data-i18n="consentText"></p>
    <div class="consent-buttons">
      <button type="button" class="btn" data-consent="denied" data-i18n="consentDeny"></button>
      <button type="button" class="btn primary" data-consent="granted" data-i18n="consentAccept"></button>
    </div>`;
  for (const btn of banner.querySelectorAll('[data-consent]')) {
    btn.addEventListener('click', () => {
      setChoice(btn.dataset.consent);
      banner.hidden = true;
    });
  }
  document.body.append(banner);
  if (getChoice() !== 'granted' && getChoice() !== 'denied') banner.hidden = false;
}

/** Show the banner again so the visitor can change their choice. */
export function openConsent() {
  if (banner) banner.hidden = false;
}

/** Footer link that reopens the banner. */
export function consentLink(lang) {
  const a = document.createElement('a');
  a.href = '#';
  a.textContent = strings(lang).cookieSettings;
  a.addEventListener('click', (e) => {
    e.preventDefault();
    openConsent();
  });
  return a;
}
