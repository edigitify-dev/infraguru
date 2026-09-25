// One-off: moves job-application resumes out of the Neon
// `job_applications.resume_data` column and onto Cloudinary as PRIVATE files
// (raw, type=authenticated — only reachable with a URL signed by our API
// secret; the admin-only /api/admin/applications/[id]/resume route serves them).
//
// Run it in stages so the live site never breaks:
//   1. --apply           add the resume_public_id column, upload each resume, check
//                        the Cloudinary copy is byte-identical, then record its
//                        public_id. resume_data is KEPT, so the code that is
//                        currently deployed keeps working.
//   2. deploy the app    (lib/db/applications.ts reads resumes from Cloudinary)
//   3. --apply --prune   clear resume_data for rows whose Cloudinary copy is
//                        re-verified identical, then VACUUM FULL so Neon's
//                        storage actually shrinks. Only run AFTER step 2 is live —
//                        the old code reads resume_data and would show "no resume".
//
// Usage:
//   node scripts/migrate-resumes-to-cloudinary.ts                   # dry run
//   node scripts/migrate-resumes-to-cloudinary.ts --apply
//   node scripts/migrate-resumes-to-cloudinary.ts --apply --prune
//
// Runs against DATABASE_URL and CLOUDINARY_* from .env.local. Re-running is safe:
// public_ids are deterministic (infraguru/resumes/<application id>.<ext>).
import net from "node:net";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

// Node's default 250ms per-address connect limit is shorter than a round trip to
// Neon's US regions from here.
net.setDefaultAutoSelectFamilyAttemptTimeout(3000);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes("--apply");
const PRUNE = process.argv.includes("--prune");

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

// Imported after loadEnvLocal(): the Cloudinary helpers read their credentials lazily from process.env.
const { fetchPrivateFile, resumePublicId, uploadPrivateFile } = await import("../src/lib/cloudinary.ts");

type Row = {
  id: string;
  resume_filename: string;
  resume_mime_type: string;
  resume_data: Buffer;
  resume_public_id: string | null;
};

async function dbSize(pool: Pool): Promise<string> {
  return (await pool.query<{ s: string }>(`select pg_size_pretty(pg_database_size(current_database())) as s`)).rows[0].s;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is not set.");
  if (PRUNE && !APPLY) throw new Error("--prune only works together with --apply.");

  const url = new URL(dbUrl);
  console.log(`database: ${url.hostname}`);
  console.log(APPLY ? `mode: APPLY${PRUNE ? " + PRUNE" : ""}\n` : "mode: dry run (nothing will be uploaded or changed — pass --apply)\n");

  url.searchParams.delete("sslmode");
  url.searchParams.delete("channel_binding");
  const pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 60_000 });

  try {
    if (APPLY) await pool.query(`alter table job_applications add column if not exists resume_public_id text`);
    const hasColumn =
      (await pool.query(
        `select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'job_applications' and column_name = 'resume_public_id'`
      )).rowCount === 1;

    const rows = (
      await pool.query<Row>(
        `select id, resume_filename, resume_mime_type, resume_data, ${hasColumn ? "resume_public_id" : "null::text as resume_public_id"}
           from job_applications
          where resume_data is not null and resume_filename is not null and resume_mime_type is not null
          order by created_at`
      )
    ).rows;
    const mb = rows.reduce((n, r) => n + r.resume_data.length, 0) / 1e6;
    console.log(`${rows.length} resume(s) still stored in Neon (${mb.toFixed(2)} MB)`);
    const todo = rows.filter((r) => !r.resume_public_id);
    console.log(`  ${todo.length} not yet on Cloudinary, ${rows.length - todo.length} already recorded`);

    if (!APPLY) {
      console.log("\nDry run only — re-run with --apply.");
      return;
    }

    // ── upload + verify + record ─────────────────────────────────────────
    let failed = 0;
    for (const r of todo) {
      const publicId = resumePublicId(r.id, r.resume_mime_type);
      try {
        await uploadPrivateFile(r.resume_data, publicId, r.resume_filename, r.resume_mime_type);
        const back = await fetchPrivateFile(publicId);
        if (!back || !back.equals(r.resume_data)) throw new Error("Cloudinary copy doesn't match the stored bytes");
        await pool.query(`update job_applications set resume_public_id = $2 where id = $1`, [r.id, publicId]);
        r.resume_public_id = publicId;
        console.log(`  uploaded + verified  ${r.resume_filename}`);
      } catch (e) {
        failed++;
        console.log(`  FAILED               ${r.resume_filename}: ${(e as Error).message}`);
      }
    }

    // ── optional prune ───────────────────────────────────────────────────
    if (PRUNE) {
      const sizeBefore = await dbSize(pool);
      let cleared = 0;
      for (const r of rows.filter((x) => x.resume_public_id)) {
        const back = await fetchPrivateFile(r.resume_public_id!);
        if (back && back.equals(r.resume_data)) {
          await pool.query(`update job_applications set resume_data = null where id = $1 and resume_public_id = $2`, [r.id, r.resume_public_id]);
          cleared++;
        } else {
          console.log(`  NOT verified, kept in Neon: ${r.resume_filename}`);
        }
      }
      console.log(`\nprune: cleared resume_data for ${cleared} application(s)`);
      console.log("reclaiming space (VACUUM FULL job_applications)…");
      await pool.query("vacuum full job_applications");
      console.log(`database size: ${sizeBefore} → ${await dbSize(pool)}`);
    }

    console.log(`\ndone.${failed ? ` ${failed} FAILED (left untouched in Neon — re-run to retry).` : ""}`);
    if (failed) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
