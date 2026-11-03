// Client helpers shared by the display and admin pages.

export const KEY_RE = /^[A-Za-z0-9]{12}$/;

/** The key is the first path segment: /<key>/ or /<key>/admin/ */
export function getKey() {
  const seg = location.pathname.split('/').filter(Boolean)[0] || '';
  return KEY_RE.test(seg) ? seg : null;
}

/** Accepts a bare key or any highhand URL containing one. */
export function parseKey(input) {
  const s = String(input || '').trim();
  if (KEY_RE.test(s)) return s;
  const m = s.match(/(?:^|\/)([A-Za-z0-9]{12})(?:\/|$)/);
  return m ? m[1] : null;
}

export function links(key) {
  return {
    display: `${location.origin}/${key}/`,
    admin: `${location.origin}/${key}/admin/`,
  };
}

async function request(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    // non-JSON error
  }
  return { ok: res.ok, status: res.status, data };
}

export async function createSession(lang, club) {
  return request('POST', '/api/session', { lang, club });
}

export async function fetchState(key) {
  return request('GET', `/api/${key}/state`);
}

export async function saveState(key, patch) {
  return request('PUT', `/api/${key}/state`, patch);
}

/**
 * Live connection for display screens. Calls onState(state) on every change
 * and onExpired() once if the key is gone. Reconnects with backoff.
 */
export function connect(key, { onState, onExpired, onStatus = () => {} }) {
  let delay = 1000;
  let stopped = false;
  let ws;
  let pingTimer;

  const expire = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(pingTimer);
    onExpired();
  };

  const scheduleReconnect = async () => {
    clearInterval(pingTimer);
    if (stopped) return;
    onStatus('offline');
    // Before reconnecting, check that the key still exists (and refresh state).
    try {
      const r = await fetchState(key);
      if (r.status === 404) return expire();
      if (r.ok) onState(r.data.state);
    } catch {
      // network down, keep retrying
    }
    setTimeout(open, delay);
    delay = Math.min(delay * 2, 30000);
  };

  function open() {
    if (stopped) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/api/${key}/ws`);
    ws.onopen = () => {
      delay = 1000;
      onStatus('online');
      pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping');
      }, 30000);
    };
    ws.onmessage = (ev) => {
      if (ev.data === 'pong') return;
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === 'state') onState(msg.state);
    };
    ws.onclose = (ev) => {
      if (ev.code === 4000) return expire();
      scheduleReconnect();
    };
  }

  // When a sleeping tablet/TV wakes up, make sure we are connected.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ws && ws.readyState === WebSocket.OPEN) ws.send('get');
  });

  open();
  return { close: () => { stopped = true; ws?.close(); } };
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/** Remove the old service worker (sw.js) from earlier versions of the site. */
export function removeOldServiceWorkers() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});
  }
}

// ---- TV pairing ----

export async function createPairCode() {
  return request('POST', '/api/pair');
}

export async function pairScreen(code, key) {
  return request('POST', `/api/pair/${code}`, { key });
}

/** "482 719", "482719", "482-719" -> "482719" (or null) */
export function parseCode(input) {
  const digits = String(input || '').replace(/[\s-]/g, '');
  return /^\d{6}$/.test(digits) ? digits : null;
}

/**
 * TV side: wait until admin enters the code. Calls onPaired(key) or
 * onExpired(). Uses a WebSocket, with polling as fallback.
 */
export function waitForPairing(code, { onPaired, onExpired }) {
  let done = false;
  let ws;
  let pollTimer;
  let pingTimer;
  const finish = (fn, arg) => {
    if (done) return;
    done = true;
    clearInterval(pollTimer);
    clearInterval(pingTimer);
    try { ws?.close(); } catch { /* ignore */ }
    fn(arg);
  };
  const poll = async () => {
    try {
      const r = await request('GET', `/api/pair/${code}`);
      if (r.data.status === 'paired') finish(onPaired, r.data.key);
      else if (r.data.status === 'expired' || r.status === 404) finish(onExpired);
    } catch {
      // offline, try again
    }
  };
  const startPolling = () => {
    if (!pollTimer && !done) pollTimer = setInterval(poll, 4000);
  };
  try {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/api/pair/${code}/ws`);
    ws.onopen = () => {
      pingTimer = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('ping'), 30000);
    };
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === 'paired') finish(onPaired, msg.key);
    };
    ws.onclose = (ev) => {
      if (done) return;
      if (ev.code === 4000) finish(onExpired);
      else { poll(); startPolling(); }
    };
  } catch {
    startPolling();
  }
  return { cancel: () => { done = true; clearInterval(pollTimer); clearInterval(pingTimer); try { ws?.close(); } catch { /* ignore */ } } };
}

// ---- Sharing ----

export const TV_STORAGE_KEY = 'highhand:tv';

/** Native share sheet when available (phones), otherwise copy. Returns 'shared' | 'copied' | 'failed'. */
export async function shareLink(url, title) {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
    }
  }
  return (await copyText(url)) ? 'copied' : 'failed';
}

/** Render a QR code for `text` into `el` (needs /js/vendor/qrcode.js loaded). */
export function renderQr(el, text) {
  if (typeof window.qrcode !== 'function') return;
  const qr = window.qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  // SVG markup is generated locally by the QR library from our own URL.
  el.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  const svg = el.querySelector('svg');
  if (svg) svg.setAttribute('role', 'img');
}
