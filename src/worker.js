import { cleanLang, cleanText, ValidationError } from './model.js';

export { HighHandSession } from './session.js';

const KEY_RE = /^[A-Za-z0-9]{12}$/;
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

async function handleApi(request, env, parts) {
  const method = request.method;

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
      const state = await stubFor(env, key).init(lang, club);
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
    if (parts[2] === 'ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return json({ error: 'expected_websocket' }, 426);
      }
      return stub.fetch(request);
    }
  }
  return json({ error: 'not_found' }, 404);
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
