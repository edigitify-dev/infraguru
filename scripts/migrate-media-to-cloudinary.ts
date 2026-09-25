// One-off: moves CMS images (awards, project photos, hero images… anything the
// admin uploaded) out of the Neon `media` table and onto Cloudinary, then
// rewrites every `/api/media/<id>` reference in the database to the Cloudinary
// URL. IMAGES ONLY — rows whose mime_type isn't image/* are never touched.
//
// Run it in stages. The site's <Image> components only accept Cloudinary URLs
// once next.config.ts (images.remotePatterns) with res.cloudinary.com is
// DEPLOYED, so rewriting references before that deploy would break every
// migrated image on the live site:
//   1. --upload            copy images to Cloudinary; the database is not touched
//   2. deploy the app      (next.config.ts + lib/db/media.ts changes)
//   3. --apply             upload anything missing + rewrite the references
//   4. --apply --prune     ...and free the Neon rows
//
// Safe by design:
//  • Dry run by default — reports what it would upload and where each image is
//    referenced. Pass --upload or --apply to actually do something.
//  • Uploads use public_id = `infraguru/media/<media id>` with overwrite=false,
//    so re-running never duplicates or replaces anything.
//  • References are only rewritten for images whose upload was confirmed
//    (Cloudinary reports the same byte size we sent).
//  • Media rows are KEPT unless you also pass --prune, which deletes only rows
//    that were uploaded, are no longer referenced anywhere, and whose Cloudinary
//    copy is downloaded again and matches the stored bytes (md5) — then runs
//    VACUUM FULL so the freed storage is actually released.
//
// Usage:
//   node scripts/migrate-media-to-cloudinary.ts                   # dry run
//   node scripts/migrate-media-to-cloudinary.ts --upload          # upload only, no DB writes
//   node scripts/migrate-media-to-cloudinary.ts --apply           # upload + rewrite refs
//   node scripts/migrate-media-to-cloudinary.ts --apply --prune   # ...and free the Neon rows
//
// Runs against DATABASE_URL (override with MEDIA_DATABASE_URL, or pass --from-old
// to use the "# OLD_DATABASE_URL=" line saved in .env.local) and needs
// CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET, all read
// from .env.local.
import net from "node:net";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, types } from "pg";

// Node's default 250ms per-address connect limit is shorter than a round trip to
// Neon's US regions from here, so ~40% of connections failed with ETIMEDOUT.
net.setDefaultAutoSelectFamilyAttemptTimeout(3000);

// Keep jsonb/json as the raw text Postgres sends so references are replaced
// textually and the JSON is never re-serialised.
for (const oid of [114, 3802]) types.setTypeParser(oid, (v) => v);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes("--apply");
const UPLOAD = APPLY || process.argv.includes("--upload");
const PRUNE = process.argv.includes("--prune");
const FROM_OLD = process.argv.includes("--from-old");
const FOLDER = "infraguru/media";

function loadEnvLocal() {
  const raw = readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnvLocal();

const q = (name: string) => `"${name}"`;

/** The "# OLD_DATABASE_URL=..." line kept in .env.local (the pre-migration Neon project). */
function savedOldDatabaseUrl(): string | undefined {
  const raw = readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  const line = raw.split("\n").find((l) => l.startsWith("# OLD_DATABASE_URL="));
  const value = line?.slice("# OLD_DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
  if (!value) return undefined;
  // Long-running maintenance (big transactions, VACUUM FULL) belongs on Neon's
  // direct endpoint, not the pgbouncer pooler used for the app's connections.
  const url = new URL(value);
  url.hostname = url.hostname.replace("-pooler", "");
  return url.toString();
}

function cloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary isn't configured (CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET).");
  }
  return { cloudName, apiKey, apiSecret };
}

type UploadResult = { url: string; bytes: number; existing: boolean };

async function uploadImage(
  cfg: ReturnType<typeof cloudinaryConfig>,
  id: string,
  filename: string,
  mimeType: string,
  data: Buffer
): Promise<UploadResult> {
  const params: Record<string, string> = {
    folder: FOLDER,
    overwrite: "false",
    public_id: id,
    timestamp: String(Math.round(Date.now() / 1000)),
  };
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const signature = crypto.createHash("sha1").update(toSign + cfg.apiSecret).digest("hex");

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(data)], { type: mimeType }), filename);
  form.append("api_key", cfg.apiKey);
  form.append("signature", signature);
  for (const [k, v] of Object.entries(params)) form.append(k, v);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Cloudinary upload failed (${res.status}): ${await res.text().catch(() => res.statusText)}`);
  const json = (await res.json()) as { secure_url: string; bytes: number; existing?: boolean };
  return { url: json.secure_url, bytes: json.bytes, existing: json.existing === true };
}

// Matches /api/media/<uuid>, with an optional absolute-URL prefix
// (https://www.infraguru.in) which is dropped along with the path.
const REF_RE = /(?:https?:\/\/[^"'\s\\/]+)?\/api\/media\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/g;

type Column = { table: string; column: string; dataType: string };
type Ref = { column: Column; rowId: string; text: string };

async function findTextColumns(pool: Pool): Promise<Column[]> {
  const res = await pool.query<{ table_name: string; column_name: string; data_type: string }>(
    `select c.table_name, c.column_name, c.data_type
       from information_schema.columns c
       join information_schema.tables t
         on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
      where c.table_schema = current_schema()
        and c.table_name <> 'media'
        and c.data_type in ('text', 'character varying', 'jsonb', 'json', 'ARRAY')
        and exists (select 1 from information_schema.columns k
                     where k.table_schema = c.table_schema and k.table_name = c.table_name and k.column_name = 'id')
      order by c.table_name, c.column_name`
  );
  return res.rows.map((r) => ({ table: r.table_name, column: r.column_name, dataType: r.data_type }));
}

async function scanReferences(pool: Pool, columns: Column[]): Promise<Ref[]> {
  const refs: Ref[] = [];
  for (const column of columns) {
    const res = await pool.query<{ id: string; v: string }>(
      `select id::text as id, ${q(column.column)}::text as v from ${q(column.table)} where ${q(column.column)}::text like '%/api/media/%'`
    );
    for (const row of res.rows) refs.push({ column, rowId: row.id, text: row.v });
  }
  return refs;
}

const UPLOAD_CONCURRENCY = 6;

/** Retry a flaky network step (DB read or upload) a few times with backoff. */
async function withRetries<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts) throw e;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

/** Everything already uploaded under infraguru/media/, keyed by media id. */
async function listExisting(cfg: ReturnType<typeof cloudinaryConfig>): Promise<Map<string, { url: string; bytes: number }>> {
  const found = new Map<string, { url: string; bytes: number }>();
  const auth = "Basic " + Buffer.from(`${cfg.apiKey}:${cfg.apiSecret}`).toString("base64");
  let cursor: string | undefined;
  try {
    do {
      const qs = `prefix=${encodeURIComponent(FOLDER + "/")}&type=upload&max_results=500${cursor ? `&next_cursor=${cursor}` : ""}`;
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/resources/image?${qs}`, { headers: { Authorization: auth } });
      if (!res.ok) return found; // not fatal: uploads use overwrite=false, so they're still idempotent
      const json = (await res.json()) as { resources: { public_id: string; secure_url: string; bytes: number }[]; next_cursor?: string };
      for (const r of json.resources) found.set(r.public_id.slice(FOLDER.length + 1).toLowerCase(), { url: r.secure_url, bytes: r.bytes });
      cursor = json.next_cursor;
    } while (cursor);
  } catch {
    // ignore — see above
  }
  return found;
}

async function dbSize(pool: Pool): Promise<string> {
  return (await pool.query<{ s: string }>(`select pg_size_pretty(pg_database_size(current_database())) as s`)).rows[0].s;
}

function idsIn(text: string): string[] {
  return [...text.matchAll(REF_RE)].map((m) => m[1].toLowerCase());
}

async function main() {
  const dbUrl = process.env.MEDIA_DATABASE_URL || (FROM_OLD ? savedOldDatabaseUrl() : process.env.DATABASE_URL);
  if (!dbUrl) throw new Error(FROM_OLD ? "No # OLD_DATABASE_URL= line found in .env.local." : "DATABASE_URL is not set.");
  const cfg = cloudinaryConfig();

  const url = new URL(dbUrl);
  console.log(`database:   ${url.hostname}`);
  console.log(`cloudinary: ${cfg.cloudName} → ${FOLDER}/`);
  console.log(
    APPLY
      ? `mode: APPLY${PRUNE ? " + PRUNE" : ""}\n`
      : UPLOAD
        ? "mode: UPLOAD ONLY (copies to Cloudinary; the database is not modified)\n"
        : "mode: dry run (nothing will be uploaded or changed — pass --upload or --apply)\n"
  );
  if (PRUNE && !APPLY) throw new Error("--prune only works together with --apply.");

  url.searchParams.delete("sslmode");
  url.searchParams.delete("channel_binding");
  const pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 60_000, max: UPLOAD_CONCURRENCY + 1 });

  try {
    try {
      await pool.query("select 1");
    } catch (err) {
      const e = err as { code?: string; message?: string };
      console.error(`Can't read the database yet: ${e.code ?? ""} ${e.message ?? err}`);
      console.error("If this is the Neon quota error, upgrade that project's plan or wait for the quota to reset, then re-run.");
      process.exit(2);
    }

    const images = (
      await pool.query<{ id: string; filename: string; mime_type: string; size_bytes: number }>(
        `select id, filename, mime_type, size_bytes from media where mime_type like 'image/%' order by created_at`
      )
    ).rows;
    const nonImages = Number((await pool.query(`select count(*)::int n from media where mime_type not like 'image/%'`)).rows[0].n);
    const totalMb = images.reduce((n, r) => n + Number(r.size_bytes), 0) / 1e6;
    console.log(`media table: ${images.length} image(s) (${totalMb.toFixed(1)} MB) to move; ${nonImages} non-image row(s) left alone\n`);

    const columns = await findTextColumns(pool);
    const arrayCols = columns.filter((c) => c.dataType === "ARRAY");
    const rewriteCols = columns.filter((c) => c.dataType !== "ARRAY");

    let refs = await scanReferences(pool, rewriteCols);
    const arrayRefs = await scanReferences(pool, arrayCols);
    if (arrayRefs.length) {
      console.log(`⚠ ${arrayRefs.length} reference(s) sit in Postgres array columns this script doesn't rewrite:`);
      for (const r of arrayRefs) console.log(`    ${r.column.table}.${r.column.column} (row ${r.rowId})`);
      console.log();
    }

    const imageIds = new Set(images.map((i) => i.id.toLowerCase()));
    const referenced = new Map<string, string[]>(); // image id → where it's used
    for (const r of refs) {
      for (const id of new Set(idsIn(r.text))) {
        if (!referenced.has(id)) referenced.set(id, []);
        referenced.get(id)!.push(`${r.column.table}.${r.column.column}`);
      }
    }
    console.log("where images are used:");
    const places = new Map<string, number>();
    for (const [id, where] of referenced) if (imageIds.has(id)) for (const w of new Set(where)) places.set(w, (places.get(w) ?? 0) + 1);
    if (places.size === 0) console.log("   (no /api/media references found)");
    for (const [w, n] of [...places].sort()) console.log(`   ${w.padEnd(36)} ${n} image(s)`);
    const orphans = images.filter((i) => !referenced.has(i.id.toLowerCase()));
    console.log(`\n   ${orphans.length} image(s) aren't referenced anywhere (still uploaded, so nothing is lost)`);
    const dangling = [...referenced.keys()].filter((id) => !imageIds.has(id));
    if (dangling.length) console.log(`   ${dangling.length} reference(s) point at media ids that aren't images / don't exist — left as they are`);

    if (!UPLOAD) {
      console.log("\nDry run only — re-run with --upload (copy only) or --apply (copy + rewrite references).");
      return;
    }

    // ── upload ───────────────────────────────────────────────────────────
    // Several images at once (the database is far away, so a single stream is
    // slow), with retries for connection hiccups. Anything already on
    // Cloudinary at the right size is reused without re-reading it from Neon.
    console.log("\nchecking what's already on Cloudinary…");
    const onCloudinary = await listExisting(cfg);
    console.log(`  ${onCloudinary.size} asset(s) already under ${FOLDER}/\n`);

    const urlById = new Map<string, string>();
    const failed: string[] = [];
    let done = 0;
    const logLine = (status: string, filename: string) => console.log(`  [${++done}/${images.length}] ${status} ${filename}`);

    const queue = [...images];
    const worker = async () => {
      for (let img = queue.shift(); img; img = queue.shift()) {
        try {
          const have = onCloudinary.get(img.id.toLowerCase());
          if (have && have.bytes === Number(img.size_bytes)) {
            urlById.set(img.id.toLowerCase(), have.url);
            logLine("already there", img.filename);
            continue;
          }
          const up = await withRetries(async () => {
            const row = (await pool.query<{ data: Buffer }>(`select data from media where id = $1`, [img.id])).rows[0];
            return uploadImage(cfg, img.id, img.filename, img.mime_type, row.data);
          });
          if (up.bytes !== Number(img.size_bytes)) throw new Error(`size mismatch (sent ${img.size_bytes}, Cloudinary has ${up.bytes})`);
          urlById.set(img.id.toLowerCase(), up.url);
          logLine("uploaded     ", img.filename);
        } catch (e) {
          failed.push(img.id);
          logLine("FAILED       ", `${img.filename}: ${(e as Error).message}`);
        }
      }
    };
    await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));

    if (!APPLY) {
      console.log(
        `\nuploaded. ${urlById.size}/${images.length} image(s) are on Cloudinary${failed.length ? `, ${failed.length} FAILED (re-run to retry)` : ""}.` +
          "\nNo database rows were changed. Deploy the app first, then run with --apply to rewrite the references."
      );
      if (failed.length) process.exitCode = 1;
      return;
    }

    // ── rewrite references ───────────────────────────────────────────────
    console.log("\nrewriting references…");
    let rewritten = 0;
    refs = await scanReferences(pool, rewriteCols); // fresh read
    const client = await pool.connect();
    try {
      await client.query("begin");
      for (const r of refs) {
        const next = r.text.replace(REF_RE, (whole, id: string) => urlById.get(id.toLowerCase()) ?? whole);
        if (next === r.text) continue;
        if (r.column.dataType === "jsonb" || r.column.dataType === "json") {
          try {
            JSON.parse(next);
          } catch {
            console.log(`  skipped ${r.column.table}.${r.column.column} row ${r.rowId}: result wasn't valid JSON`);
            continue;
          }
        }
        const cast = r.column.dataType === "jsonb" ? "::jsonb" : r.column.dataType === "json" ? "::json" : "";
        await client.query(`update ${q(r.column.table)} set ${q(r.column.column)} = $1${cast} where id::text = $2`, [next, r.rowId]);
        rewritten++;
      }
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
    console.log(`  ${rewritten} field(s) updated`);

    // ── optional prune ───────────────────────────────────────────────────
    if (PRUNE) {
      const sizeBefore = await dbSize(pool);
      const still = new Set((await scanReferences(pool, columns)).flatMap((r) => idsIn(r.text)));
      const candidates = images.map((i) => i.id).filter((id) => urlById.has(id.toLowerCase()) && !still.has(id.toLowerCase()));
      const keptReferenced = urlById.size - candidates.length;

      // Only delete what Cloudinary serves back byte-for-byte identical (md5 of
      // the stored bytes vs md5 of the downloaded file).
      console.log(`\nverifying ${candidates.length} Cloudinary copies against the database bytes before deleting anything…`);
      const hashes = new Map(
        (await pool.query<{ id: string; h: string }>(`select id::text as id, md5(data) as h from media where id = any($1::uuid[])`, [candidates])).rows.map((r) => [r.id, r.h])
      );
      const verified: string[] = [];
      const unverified: string[] = [];
      for (let i = 0; i < candidates.length; i += 4) {
        await Promise.all(
          candidates.slice(i, i + 4).map(async (id) => {
            try {
              const res = await fetch(urlById.get(id.toLowerCase())!);
              const buf = Buffer.from(await res.arrayBuffer());
              const same = res.ok && crypto.createHash("md5").update(buf).digest("hex") === hashes.get(id);
              (same ? verified : unverified).push(id);
            } catch {
              unverified.push(id);
            }
          })
        );
      }
      console.log(`  ${verified.length} identical, ${unverified.length} NOT verified (those stay in Neon)`);

      if (verified.length) await pool.query(`delete from media where id = any($1::uuid[])`, [verified]);
      const freedMb = images.filter((i) => verified.includes(i.id)).reduce((n, r) => n + Number(r.size_bytes), 0) / 1e6;
      console.log(`prune: deleted ${verified.length} image row(s) (${freedMb.toFixed(1)} MB)${keptReferenced ? `; kept ${keptReferenced} still referenced somewhere` : ""}`);

      // A DELETE alone leaves the disk space allocated; rewrite the table so the
      // storage Neon bills for actually shrinks.
      console.log("reclaiming space (VACUUM FULL media)…");
      await pool.query("vacuum full media");
      console.log(`database size: ${sizeBefore} → ${await dbSize(pool)}`);
    }

    console.log(`\ndone. ${urlById.size}/${images.length} image(s) on Cloudinary${failed.length ? `, ${failed.length} FAILED (left untouched in Neon — re-run to retry)` : ""}.`);
    if (failed.length) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
