import { Pool, type QueryResult } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __infraguruPool: Pool | undefined;
  var __infraguruDbState: DbState | undefined;
}

type DbState = {
  /** 0 = closed (DB assumed healthy). Otherwise reads skip the DB until this timestamp. */
  openUntil: number;
  lastLogAt: number;
  /** Last successful rows per query, served when the DB is unreachable. */
  stale: Map<string, unknown[]>;
};

// pg-connection-string emits a process warning whenever it parses
// `sslmode=` out of the URL (it's an alias-deprecation notice, not an
// error) — Next's dev overlay then surfaces that warning as if it were a
// thrown error. Strip the ssl-related query params and configure SSL
// explicitly instead, so the warning path is never hit.
function toPoolConfig(connectionString: string) {
  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("channel_binding");
  return {
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true },
    // Neon's serverless compute suspends after a period of idleness and
    // takes a moment to resume on the next connection — without this the
    // OS-level TCP timeout is used instead, which can hang far longer than
    // is useful before finally failing.
    connectionTimeoutMillis: 10_000,
  };
}

/** True for connection-level failures (DNS/network blips, a Neon compute
 * that's still waking up from idle) — worth a quick retry on a fresh
 * connection. False for anything that reached the database and failed
 * there (bad SQL, constraint violations, etc.), which a retry can't fix. */
function isTransientConnectionError(err: unknown): boolean {
  if (typeof AggregateError !== "undefined" && err instanceof AggregateError) return true;
  const code = (err as { code?: string } | undefined)?.code;
  return code === "ETIMEDOUT" || code === "ECONNREFUSED" || code === "ENETUNREACH" || code === "ECONNRESET";
}

const RETRY_DELAYS_MS = [300, 1500];

let warnedMissingUrl = false;

/** Returns null (instead of throwing) when DATABASE_URL isn't set yet, so
 * the site stays browsable — with empty/default CMS content — before the
 * database is configured. */
export function getPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    if (!warnedMissingUrl) {
      console.warn("[db] DATABASE_URL is not set — pages will render with empty/default content until it's configured.");
      warnedMissingUrl = true;
    }
    return null;
  }
  if (!global.__infraguruPool) {
    global.__infraguruPool = new Pool({ ...toPoolConfig(connectionString), max: 5 });
  }
  return global.__infraguruPool;
}

async function queryWithRetry<T extends Record<string, unknown>>(
  pool: Pool,
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await pool.query<T>(text, params);
    } catch (err) {
      if (attempt >= RETRY_DELAYS_MS.length || !isTransientConnectionError(err)) throw err;
      console.warn(`[db] transient connection error, retrying (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length})…`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
}

/* ── Keeping public pages up when the database is not ─────────────────────
 * `db.read` is for public, read-only queries. It never throws: if the DB is
 * unreachable, over quota, full or just slow, it hands back the last good
 * rows for that exact query (source "stale"), or nothing (source "none") so
 * the caller can fall back to static content. After an outage-type failure a
 * circuit breaker skips the DB for a cooldown, so visitors get an instant
 * fallback instead of each waiting out a connection timeout.
 *
 * Admin reads and every write use `db.query` instead, which still throws —
 * an editor must see the failure, and must never be shown fallback content
 * they could then save over the real thing. */
const BREAKER_COOLDOWN_MS = 30_000;
const READ_DEADLINE_MS = 8_000;
const STALE_MAX_ENTRIES = 300;
const LOG_THROTTLE_MS = 10_000;

const state: DbState = (global.__infraguruDbState ??= {
  openUntil: 0,
  lastLogAt: 0,
  stale: new Map(),
});

export type ReadResult<T> = { rows: T[]; source: "db" | "stale" | "none" };

const UNAVAILABLE_CODES = new Set(["ENOTFOUND", "EAI_AGAIN", "EPIPE"]);

/** True when the database itself can't serve us (as opposed to bad SQL). */
function isDbUnavailableError(err: unknown): boolean {
  if (isTransientConnectionError(err)) return true;
  const { code = "", message = "" } = (err ?? {}) as { code?: string; message?: string };
  if (UNAVAILABLE_CODES.has(code)) return true;
  // 53xxx insufficient resources — Neon's "quota exceeded" is 53000, plus
  // 53100 disk full / 53300 too many connections; 08xxx connection
  // exceptions; 57Pxx server shutting down or starting up.
  if (code.startsWith("53") || code.startsWith("08") || code.startsWith("57P")) return true;
  return /timeout|terminated|quota|ENOTFOUND/i.test(message);
}

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Object.assign(new Error(`db read exceeded ${ms}ms`), { code: "ETIMEDOUT" })),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/** Closed breaker → go. Open → skip the DB. Cooldown elapsed → let exactly
 * one caller through as a probe (re-arming the cooldown for everyone else). */
function breakerAllows(): boolean {
  if (state.openUntil === 0) return true;
  const now = Date.now();
  if (now < state.openUntil) return false;
  state.openUntil = now + BREAKER_COOLDOWN_MS;
  return true;
}

function logReadFailure(err: unknown) {
  const now = Date.now();
  if (now - state.lastLogAt < LOG_THROTTLE_MS) return;
  state.lastLogAt = now;
  const { code = "", message = String(err) } = (err ?? {}) as { code?: string; message?: string };
  console.error(`[db] read failed — serving stale/fallback content. ${code} ${message}`.trim());
}

function rememberStale(key: string, rows: unknown[]) {
  state.stale.delete(key);
  state.stale.set(key, rows);
  if (state.stale.size > STALE_MAX_ENTRIES) {
    const oldest = state.stale.keys().next().value;
    if (oldest !== undefined) state.stale.delete(oldest);
  }
}

export const db = {
  /** Strict query: throws on any failure. Use for writes and admin reads. */
  query: async <T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> => {
    const pool = getPool();
    if (!pool) {
      return { rows: [], rowCount: 0 } as unknown as QueryResult<T>;
    }
    return queryWithRetry<T>(pool, text, params);
  },

  /** Resilient query for public pages — never throws. Pass `stale: false` for
   * large rows (e.g. media blobs) that shouldn't be held in memory. */
  read: async <T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
    options?: { stale?: boolean }
  ): Promise<ReadResult<T>> => {
    const keepStale = options?.stale !== false;
    const cacheKey = `${text}\u0000${params ? JSON.stringify(params) : ""}`;
    const fallback = (): ReadResult<T> => {
      const rows = keepStale ? state.stale.get(cacheKey) : undefined;
      return rows ? { rows: rows as T[], source: "stale" } : { rows: [], source: "none" };
    };

    const pool = getPool();
    if (!pool) return { rows: [], source: "none" };
    if (!breakerAllows()) return fallback();

    try {
      const res = await withDeadline(queryWithRetry<T>(pool, text, params), READ_DEADLINE_MS);
      state.openUntil = 0;
      if (keepStale) rememberStale(cacheKey, res.rows);
      return { rows: res.rows, source: "db" };
    } catch (err) {
      // Reached the DB but the query itself failed (bad SQL, missing table):
      // not an outage, so don't trip the breaker for everyone else.
      state.openUntil = isDbUnavailableError(err) ? Date.now() + BREAKER_COOLDOWN_MS : 0;
      logReadFailure(err);
      return fallback();
    }
  },
};
