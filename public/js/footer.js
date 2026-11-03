// Shared site footer: logo, credit, source link and deployed version.
import { strings } from '/js/i18n.js';

export async function renderFooter(el, lang = 'sv') {
  if (!el) return;
  const s = strings(lang);
  const logo = document.createElement('img');
  logo.src = '/images/misc/mcfrojd-softwares.png';
  logo.alt = 'McFrojd Softwares';
  logo.className = 'footer-logo';
  logo.width = 160;
  logo.height = 60;

  const line = document.createElement('div');
  line.className = 'footer-line';
  const by = document.createElement('span');
  by.textContent = `${s.builtBy} `;
  const name = document.createElement('strong');
  name.textContent = 'McFrojd Softwares';
  const src = document.createElement('a');
  src.href = 'https://github.com/mcfrojd/high_hand';
  src.rel = 'noopener';
  src.textContent = s.sourceCode;
  const version = document.createElement('span');
  version.className = 'footer-version';
  line.append(by, name, ' · ', src, version);
  el.replaceChildren(logo, line);

  try {
    const res = await fetch('/api/version', { cache: 'no-store' });
    const v = await res.json();
    const id = v.id ? v.id.slice(0, 8) : '';
    version.textContent = ` · v${v.version}${id ? ` (${id})` : ''}`;
    if (v.deployedAt) {
      const when = new Date(v.deployedAt).toLocaleString(lang === 'en' ? 'en-GB' : 'sv-SE');
      version.title = `${s.deployedAt}: ${when}${v.id ? `\nVersion ID: ${v.id}` : ''}`;
    }
  } catch {
    // version is a nice-to-have
  }
}
