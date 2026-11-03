import { DurableObject } from 'cloudflare:workers';
import { cleanPatch, defaultState, isRealHand, BACKGROUNDS, CUSTOM_BG, DEFAULT_TTL_MS } from './model.js';

const CLOSE_EXPIRED = 4000;

/**
 * One Durable Object per High Hand key. Holds the current state, pushes
 * changes to connected display screens over WebSocket (hibernation API, so
 * idle screens cost nothing) and deletes itself via an alarm when it expires.
 */
export class HighHandSession extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // Answer keep-alive pings without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  ttlMs() {
    const t = Number(this.env.TTL_MS);
    return Number.isFinite(t) && t > 0 ? t : DEFAULT_TTL_MS;
  }

  async getState() {
    const state = await this.ctx.storage.get('state');
    if (!state) return null;
    if (Date.now() >= state.expiresAt) {
      await this.expire();
      return null;
    }
    return state;
  }

  registry() {
    return this.env.REGISTRY.get(this.env.REGISTRY.idFromName('global'));
  }

  /** Logging must never break the session itself. */
  async log(fn) {
    try {
      await fn(this.registry());
    } catch (e) {
      console.error('registry log failed', e);
    }
  }

  /** Create the session. Returns null if the key is already taken. */
  async init(key, lang, club) {
    if (await this.ctx.storage.get('state')) return null;
    const now = Date.now();
    const state = { key, ...defaultState({ lang, club, now, ttlMs: this.ttlMs() }) };
    await this.ctx.storage.put('state', state);
    await this.ctx.storage.setAlarm(state.expiresAt);
    await this.log((r) => r.recordCreate(key, state));
    return state;
  }

  /** Apply a validated patch. Returns { state } or { error, field }. */
  async update(patch) {
    const state = await this.getState();
    if (!state) return { error: 'not_found' };
    let clean;
    try {
      clean = cleanPatch(patch);
    } catch (e) {
      return { error: 'invalid', field: e.field ?? 'body' };
    }
    if (clean.background === CUSTOM_BG && !state.customBg) {
      return { error: 'invalid', field: 'background' };
    }
    const next = { ...state, ...clean };
    await this.ctx.storage.put('state', next);
    this.broadcast({ type: 'state', state: next });
    if (next.key) await this.log((r) => r.recordUpdate(next.key, next, isRealHand(next)));
    return { state: next };
  }

  // ---- Custom background image ----
  // Stored under one key ('bg') in this object's storage: a new upload
  // replaces the old one, and expire() -> deleteAll() removes it with the session.

  /** `bytes` is an already validated JPEG (ArrayBuffer). */
  async setBackground(bytes) {
    const state = await this.getState();
    if (!state) return { error: 'not_found' };
    const updatedAt = Date.now();
    await this.ctx.storage.put('bg', { bytes, size: bytes.byteLength, updatedAt });
    const next = { ...state, background: CUSTOM_BG, customBg: updatedAt };
    await this.ctx.storage.put('state', next);
    this.broadcast({ type: 'state', state: next });
    if (next.key) await this.log((r) => r.recordBackground(next.key, updatedAt));
    return { state: next };
  }

  async getBackground() {
    if (!(await this.getState())) return null;
    const bg = await this.ctx.storage.get('bg');
    return bg ? { bytes: bg.bytes, updatedAt: bg.updatedAt } : null;
  }

  async deleteBackground() {
    const state = await this.getState();
    if (!state) return { error: 'not_found' };
    await this.ctx.storage.delete('bg');
    const next = {
      ...state,
      customBg: null,
      background: state.background === CUSTOM_BG ? BACKGROUNDS[0] : state.background,
    };
    await this.ctx.storage.put('state', next);
    this.broadcast({ type: 'state', state: next });
    if (next.key) await this.log((r) => r.recordBackground(next.key, null));
    return { state: next };
  }

  broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        // socket already gone
      }
    }
  }

  /** WebSocket upgrade for display screens. */
  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }
    const state = await this.getState();
    if (!state) return new Response('Not found', { status: 404 });
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify({ type: 'state', state }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    // Screens only listen; a "get" lets a client ask for a fresh copy.
    if (message === 'get') {
      const state = await this.getState();
      if (state) ws.send(JSON.stringify({ type: 'state', state }));
      else ws.close(CLOSE_EXPIRED, 'expired');
    }
  }

  async webSocketClose(ws) {
    try {
      ws.close(1000, 'bye');
    } catch {
      // already closed
    }
  }

  async alarm() {
    await this.expire();
  }

  async expire() {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(CLOSE_EXPIRED, 'expired');
      } catch {
        // ignore
      }
    }
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }
}
