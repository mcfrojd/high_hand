import { DurableObject } from 'cloudflare:workers';

export const PAIR_TTL_MS = 10 * 60 * 1000;
const CLOSE_EXPIRED = 4000;
const CLOSE_PAIRED = 4001;

/**
 * One short-lived Durable Object per 6-digit TV pairing code.
 * The TV opens /tv, gets a code and waits on a WebSocket. Admin enters the
 * code together with its key; the TV is told the key and navigates there.
 * The code is single-use and deleted after 10 minutes at the latest.
 */
export class Pairing extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async current() {
    const p = await this.ctx.storage.get('pair');
    if (!p) return null;
    if (Date.now() >= p.expiresAt) {
      await this.expire();
      return null;
    }
    return p;
  }

  /** Reserve this code. Returns null if it is already in use. */
  async create() {
    if (await this.current()) return null;
    const p = { createdAt: Date.now(), expiresAt: Date.now() + PAIR_TTL_MS, key: null };
    await this.ctx.storage.put('pair', p);
    await this.ctx.storage.setAlarm(p.expiresAt);
    return p;
  }

  /** Called from admin. Returns true on success. */
  async claim(key) {
    const p = await this.current();
    if (!p || p.key) return false;
    const sockets = this.ctx.getWebSockets();
    const msg = JSON.stringify({ type: 'paired', key });
    for (const ws of sockets) {
      try {
        ws.send(msg);
        ws.close(CLOSE_PAIRED, 'paired');
      } catch {
        // ignore
      }
    }
    if (sockets.length > 0) {
      await this.expire();
    } else {
      // TV is between reconnects: keep the result briefly for its poll fallback.
      await this.ctx.storage.put('pair', { ...p, key, expiresAt: Math.min(p.expiresAt, Date.now() + 2 * 60 * 1000) });
    }
    return true;
  }

  /** Poll fallback for the TV. Hands out the key once, then forgets it. */
  async poll() {
    const p = await this.current();
    if (!p) return { status: 'expired' };
    if (p.key) {
      await this.expire();
      return { status: 'paired', key: p.key };
    }
    return { status: 'waiting', expiresAt: p.expiresAt };
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }
    const p = await this.current();
    if (!p) return new Response('Not found', { status: 404 });
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    if (p.key) {
      server.send(JSON.stringify({ type: 'paired', key: p.key }));
      server.close(CLOSE_PAIRED, 'paired');
      await this.expire();
    } else {
      server.send(JSON.stringify({ type: 'waiting', expiresAt: p.expiresAt }));
    }
    return new Response(null, { status: 101, webSocket: client });
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
