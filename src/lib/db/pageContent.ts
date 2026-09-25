import { db } from "./client";

export type SectionKey = { pageSlug: string; key: string };

function mapKey(pageSlug: string, sectionKey: string): string {
  return `${pageSlug}:${sectionKey}`;
}

/** Batch fetch a set of (pageSlug, sectionKey) rows, keyed by "pageSlug:sectionKey".
 *
 * Public pages call this plainly: if the DB is down the map comes back empty
 * (or from cache), and every section falls back to its code default. Admin
 * editors pass `{ strict: true }` so an outage errors out instead of showing
 * defaults that could then be saved over real content. */
export async function getSections(
  keys: SectionKey[],
  options?: { strict?: boolean }
): Promise<Map<string, unknown>> {
  const result = new Map<string, unknown>();
  if (keys.length === 0) return result;

  const pageSlugs = [...new Set(keys.map((k) => k.pageSlug))];
  const sql = `select page_slug, section_key, content from page_sections where page_slug = any($1)`;
  const res = options?.strict
    ? await db.query<{ page_slug: string; section_key: string; content: unknown }>(sql, [pageSlugs])
    : await db.read<{ page_slug: string; section_key: string; content: unknown }>(sql, [pageSlugs]);
  for (const row of res.rows) {
    result.set(mapKey(row.page_slug, row.section_key), row.content);
  }
  return result;
}

export async function getSection(pageSlug: string, sectionKey: string): Promise<unknown | null> {
  const res = await db.read<{ content: unknown }>(
    `select content from page_sections where page_slug = $1 and section_key = $2`,
    [pageSlug, sectionKey]
  );
  return res.rows[0]?.content ?? null;
}

export async function saveSection(
  pageSlug: string,
  sectionKey: string,
  content: unknown
): Promise<void> {
  await db.query(
    `insert into page_sections (page_slug, section_key, content)
     values ($1, $2, $3)
     on conflict (page_slug, section_key)
     do update set content = excluded.content, updated_at = now()`,
    [pageSlug, sectionKey, JSON.stringify(content)]
  );
}
