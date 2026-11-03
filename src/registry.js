import { DurableObject } from 'cloudflare:workers';

export const LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Single global Durable Object (idFromName('global')) that keeps a log of all
 * sessions for the private dashboard. Rows are kept for 30 days.
 */
export class Registry extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        key TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        club TEXT NOT NULL DEFAULT '',
        lang TEXT NOT NULL DEFAULT 'sv',
        hand TEXT,
        holder TEXT,
        cards TEXT,
        count TEXT,
        saves INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS sessions_created_at ON sessions (created_at);
    `);
    // Added later: when the session uploaded its own background (null = none).
    const cols = this.sql.exec('PRAGMA table_info(sessions)').toArray().map((c) => c.name);
    if (!cols.includes('custom_bg')) this.sql.exec('ALTER TABLE sessions ADD COLUMN custom_bg INTEGER');
  }

  async ensureAlarm() {
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + DAY_MS);
    }
  }

  prune(now = Date.now()) {
    this.sql.exec('DELETE FROM sessions WHERE created_at < ?', now - LOG_RETENTION_MS);
  }

  async recordCreate(key, { createdAt, expiresAt, club, lang }) {
    this.sql.exec(
      `INSERT OR REPLACE INTO sessions (key, created_at, expires_at, updated_at, club, lang)
       VALUES (?, ?, ?, ?, ?, ?)`,
      key, createdAt, expiresAt, createdAt, club, lang,
    );
    await this.ensureAlarm();
  }

  /** Always updates club/lang/activity; the hand only when it is a real one (not a reset). */
  async recordUpdate(key, state, isRealHand) {
    const now = Date.now();
    if (isRealHand) {
      this.sql.exec(
        `UPDATE sessions SET club = ?, lang = ?, updated_at = ?, saves = saves + 1,
           hand = ?, holder = ?, cards = ?, count = ?
         WHERE key = ?`,
        state.club, state.lang, now, state.hand, state.holder, JSON.stringify(state.cards), state.count, key,
      );
    } else {
      this.sql.exec(
        'UPDATE sessions SET club = ?, lang = ?, updated_at = ?, saves = saves + 1 WHERE key = ?',
        state.club, state.lang, now, key,
      );
    }
  }

  /** `customBg` = upload time, or null when the image was removed. */
  async recordBackground(key, customBg) {
    this.sql.exec('UPDATE sessions SET custom_bg = ?, updated_at = ? WHERE key = ?', customBg, Date.now(), key);
  }

  async list(now = Date.now()) {
    this.prune(now);
    const rows = this.sql
      .exec('SELECT * FROM sessions WHERE created_at >= ? ORDER BY created_at DESC LIMIT 2000', now - LOG_RETENTION_MS)
      .toArray()
      .map((r) => ({
        key: r.key,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
        updatedAt: r.updated_at,
        club: r.club,
        lang: r.lang,
        hand: r.hand,
        holder: r.holder,
        cards: r.cards ? JSON.parse(r.cards) : null,
        count: r.count,
        saves: r.saves,
        customBg: r.custom_bg ?? null,
        active: r.expires_at > now,
      }));
    return { now, active: rows.filter((r) => r.active), recent: rows };
  }

  async alarm() {
    this.prune();
    await this.ctx.storage.setAlarm(Date.now() + DAY_MS);
  }
}
