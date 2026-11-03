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
