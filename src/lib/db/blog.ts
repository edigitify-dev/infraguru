import { db } from "./client";
import { fallbackPosts } from "./fallback";
import type { BlogPost, BlogStatus } from "./types";

type BlogRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string;
  post_date: string;
  read_time: string | null;
  cover_image: string | null;
  author_name: string | null;
  author_role: string | null;
  author_avatar: string | null;
  content: string[] | null;
  status: string;
  created_at: string;
  updated_at: string;
};

function mapRow(row: BlogRow): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? "",
    category: row.category,
    date: typeof row.post_date === "string" ? row.post_date : new Date(row.post_date).toISOString().slice(0, 10),
    readTime: row.read_time ?? "",
    coverImage: row.cover_image ?? "",
    author: {
      name: row.author_name ?? "",
      role: row.author_role ?? "",
      avatar: row.author_avatar ?? "",
    },
    content: row.content ?? [],
    status: row.status as BlogStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type BlogPostInput = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: string;
  coverImage: string;
  author: { name: string; role: string; avatar: string };
  content: string[];
  status: BlogStatus;
};

export async function listAllPosts(): Promise<BlogPost[]> {
  const res = await db.query<BlogRow>(`select * from blog_posts order by post_date desc, created_at desc`);
  return res.rows.map(mapRow);
}

// Public reads (published posts, post by slug) use `db.read` and fall back to
// cached or static content during a DB outage; admin reads stay strict.
export async function listPublishedPosts(): Promise<BlogPost[]> {
  const res = await db.read<BlogRow>(
    `select * from blog_posts where status = 'published' order by post_date desc, created_at desc`
  );
  return res.source === "none" ? fallbackPosts() : res.rows.map(mapRow);
}

export async function getPostById(id: string): Promise<BlogPost | null> {
  const res = await db.query<BlogRow>(`select * from blog_posts where id = $1`, [id]);
  return res.rows[0] ? mapRow(res.rows[0]) : null;
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const res = await db.read<BlogRow>(`select * from blog_posts where slug = $1`, [slug]);
  if (res.source === "none") return (await listPublishedPosts()).find((p) => p.slug === slug) ?? null;
  return res.rows[0] ? mapRow(res.rows[0]) : null;
}

export async function createPost(input: BlogPostInput): Promise<BlogPost> {
  const res = await db.query<BlogRow>(
    `insert into blog_posts
      (slug, title, excerpt, category, post_date, read_time, cover_image,
       author_name, author_role, author_avatar, content, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     returning *`,
    [
      input.slug,
      input.title,
      input.excerpt,
      input.category,
      input.date,
      input.readTime,
      input.coverImage,
      input.author.name,
      input.author.role,
      input.author.avatar,
      JSON.stringify(input.content),
      input.status,
    ]
  );
  return mapRow(res.rows[0]);
}

export async function updatePost(id: string, input: BlogPostInput): Promise<BlogPost> {
  const res = await db.query<BlogRow>(
    `update blog_posts set
      slug = $2, title = $3, excerpt = $4, category = $5, post_date = $6,
      read_time = $7, cover_image = $8, author_name = $9, author_role = $10,
      author_avatar = $11, content = $12, status = $13, updated_at = now()
     where id = $1
     returning *`,
    [
      id,
      input.slug,
      input.title,
      input.excerpt,
      input.category,
      input.date,
      input.readTime,
      input.coverImage,
      input.author.name,
      input.author.role,
      input.author.avatar,
      JSON.stringify(input.content),
      input.status,
    ]
  );
  if (!res.rows[0]) throw new Error("Blog post not found");
  return mapRow(res.rows[0]);
}

export async function deletePost(id: string): Promise<void> {
  await db.query(`delete from blog_posts where id = $1`, [id]);
}
