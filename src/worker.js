import { cleanLang, cleanText, ValidationError, MAX_BG_BYTES } from './model.js';

export { HighHandSession } from './session.js';
export { Registry } from './registry.js';
export { Pairing } from './pairing.js';

const KEY_RE = /^[A-Za-z0-9]{12}$/;
const CODE_RE = /^\d{6}$/;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const MAX_BODY = 2048;

/** 12 chars base62 from crypto.getRandomValues (~71 bits). */
function newKey() {
  let key = '';
  while (key.length < 12) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (const b of bytes) {
      // 248 = 62 * 4 -> unbiased
      if (b < 248 && key.length < 12) key += ALPHABET[b % 62];
    }
  }
  return key;
}

function withSecurityHeaders(response) {
  const res = new Response(response.body, response);
  const h = res.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'no-referrer');
  h.set('X-Frame-Options', 'SAMEORIGIN');
  const type = h.get('Content-Type');
  if (type && /^(text\/|application\/(json|javascript|manifest\+json))/.test(type) && !/charset=/i.test(type)) {
    h.set('Content-Type', `${type}; charset=utf-8`);
  }
  return res;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}

async function readJson(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new ValidationError('body');
  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError('body');
  }
}

function stubFor(env, key) {
  return env.SESSIONS.get(env.SESSIONS.idFromName(key));
}

/** GET / PUT / DELETE /api/<key>/background */
async function handleBackground(request, stub) {
  const method = request.method;
  if (method === 'GET') {
    const bg = await stub.getBackground();
    if (!bg) return json({ error: 'not_found' }, 404);
    return new Response(bg.bytes, {
      headers: {
        'Content-Type': 'image/jpeg',
        // The screen requests ?v=<updatedAt>, so a new upload gets a new URL.
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex',
      },
    });
  }
  if (method === 'PUT') {
    const declared = Number(request.headers.get('Content-Length') || 0);
    if (declared > MAX_BG_BYTES) return json({ error: 'too_large' }, 413);
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > MAX_BG_BYTES) return json({ error: 'too_large' }, 413);
    const head = new Uint8Array(bytes, 0, Math.min(3, bytes.byteLength));
    if (head.length < 3 || head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) {
      return json({ error: 'not_jpeg' }, 415);
    }
    const result = await stub.setBackground(bytes);
    if (result.error) return json(result, 404);
    return json(result);
  }
  if (method === 'DELETE') {
    const result = await stub.deleteBackground();
    if (result.error) return json(result, 404);
    return json(result);
  }
  return json({ error: 'method_not_allowed' }, 405);
}

/** Uniform 6-digit code, e.g. "048213". */
function newCode() {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / 1e6) * 1e6;
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return String(buf[0] % 1e6).padStart(6, '0');
}

function pairingStub(env, code) {
  return env.PAIRING.get(env.PAIRING.idFromName(code));
}

/** /api/pair, /api/pair/<code>, /api/pair/<code>/ws */
async function handlePair(request, env, parts) {
  const method = request.method;
  if (parts.length === 2) {
    if (method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode();
      const p = await pairingStub(env, code).create();
      if (p) return json({ code, expiresAt: p.expiresAt }, 201);
    }
    return json({ error: 'try_again' }, 503);
  }
  const code = parts[2];
  if (!CODE_RE.test(code)) return json({ error: 'not_found' }, 404);
  const stub = pairingStub(env, code);

  if (parts.length === 4 && parts[3] === 'ws') {
    if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'expected_websocket' }, 426);
    return stub.fetch(request);
  }
  if (parts.length !== 3) return json({ error: 'not_found' }, 404);
  if (method === 'GET') return json(await stub.poll());
  if (method === 'POST') {
    let key;
    try {
      key = (await readJson(request))?.key;
    } catch (e) {
      return json({ error: 'invalid', field: e.field }, 400);
    }
    if (typeof key !== 'string' || !KEY_RE.test(key)) return json({ error: 'invalid', field: 'key' }, 400);
    // Only live sessions can be sent to a TV.
    if (!(await stubFor(env, key).getState())) return json({ error: 'session_not_found' }, 404);
    if (!(await stub.claim(key))) return json({ error: 'code_not_found' }, 404);
    return json({ ok: true });
  }
  return json({ error: 'method_not_allowed' }, 405);
}

async function handleApi(request, env, parts) {
  const method = request.method;

  if (parts[1] === 'pair') return handlePair(request, env, parts);

  // POST /api/session
  if (parts.length === 2 && parts[1] === 'session') {
    if (method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    let lang;
    let club;
    try {
      const body = await readJson(request);
      lang = cleanLang(body?.lang);
      club = cleanText(body?.club, 'club');
    } catch (e) {
      return json({ error: 'invalid', field: e.field ?? 'body' }, 400);
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const key = newKey();
      const state = await stubFor(env, key).init(key, lang, club);
      if (state) return json({ key, expiresAt: state.expiresAt }, 201);
    }
    return json({ error: 'try_again' }, 503);
  }

  // /api/<key>/state, /api/<key>/ws
  if (parts.length === 3 && KEY_RE.test(parts[1])) {
    const stub = stubFor(env, parts[1]);
    if (parts[2] === 'state') {
      if (method === 'GET') {
        const state = await stub.getState();
        return state ? json({ state }) : json({ error: 'not_found' }, 404);
      }
      if (method === 'PUT') {
        let patch;
        try {
          patch = await readJson(request);
        } catch (e) {
          return json({ error: 'invalid', field: e.field }, 400);
        }
        const result = await stub.update(patch);
        if (result.error === 'not_found') return json(result, 404);
        if (result.error) return json(result, 400);
        return json(result);
      }
      return json({ error: 'method_not_allowed' }, 405);
    }
    if (parts[2] === 'background') return handleBackground(request, stub);
    if (parts[2] === 'ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return json({ error: 'expected_websocket' }, 426);
      }
      return stub.fetch(request);
    }
  }
  return json({ error: 'not_found' }, 404);
}

// ---- Private dashboard (Basic Auth, password from the DASHBOARD_PASSWORD secret) ----

async function sha256(text) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
}

/** Returns null when authorised, otherwise the Response to send. */
async function requireAuth(request, env) {
  if (!env.DASHBOARD_PASSWORD) return new Response('Not found', { status: 404 });
  const header = request.headers.get('Authorization') || '';
  let user = '';
  let pass = '';
  if (header.startsWith('Basic ')) {
    try {
      const bytes = Uint8Array.from(atob(header.slice(6)), (c) => c.charCodeAt(0));
      const decoded = new TextDecoder().decode(bytes);
      const i = decoded.indexOf(':');
      if (i >= 0) {
        user = decoded.slice(0, i);
        pass = decoded.slice(i + 1);
      }
    } catch {
      // malformed header -> unauthorised
    }
  }
  const [a, b] = await Promise.all([sha256(`admin:${env.DASHBOARD_PASSWORD}`), sha256(`${user}:${pass}`)]);
  if (crypto.subtle.timingSafeEqual(a, b)) return null;
  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="highhand-dashboard", charset="UTF-8"',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}

async function handleDashboard(request, env, url) {
  const denied = await requireAuth(request, env);
  if (denied) return denied;
  if (url.pathname === '/api/dashboard/sessions') {
    if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
    const registry = env.REGISTRY.get(env.REGISTRY.idFromName('global'));
    return json(await registry.list(Date.now()));
  }
  if (url.pathname === '/dashboard') return Response.redirect(`${url.origin}/dashboard/`, 301);
  const res = await servePage(request, env, '/dashboard');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

async function servePage(request, env, assetPath) {
  const url = new URL(assetPath, request.url);
  const res = await env.ASSETS.fetch(new Request(url, { method: 'GET' }));
  const out = withSecurityHeaders(res);
  out.headers.set('X-Robots-Tag', 'noindex');
  out.headers.set('Cache-Control', 'no-cache');
  return out;
}

async function notFound(request, env) {
  const res = await env.ASSETS.fetch(new Request(new URL('/404', request.url), { method: 'GET' }));
  return withSecurityHeaders(new Response(res.body, { status: 404, headers: res.headers }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);

    if (url.pathname === '/dashboard' || url.pathname === '/dashboard/' || url.pathname === '/api/dashboard/sessions') {
      return handleDashboard(request, env, url);
    }
    // The raw asset must never be reachable without the auth check above.
    if (url.pathname.startsWith('/dashboard')) return notFound(request, env);

    if (parts[0] === 'api') return handleApi(request, env, parts);

    if (parts.length >= 1 && parts.length <= 2 && KEY_RE.test(parts[0])) {
      const isAdmin = parts.length === 2;
      if (isAdmin && parts[1] !== 'admin') return notFound(request, env);
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', { status: 405 });
      }
      if (!url.pathname.endsWith('/')) {
        return Response.redirect(`${url.origin}${url.pathname}/`, 301);
      }
      return servePage(request, env, isAdmin ? '/admin' : '/display');
    }

    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
};
