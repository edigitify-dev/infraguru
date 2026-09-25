-- InfraGuru CMS schema (Neon Postgres)
create extension if not exists pgcrypto;

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  name text not null,
  created_at timestamptz not null default now()
);

-- Legacy binary storage for CMS images. New uploads go to Cloudinary (see
-- lib/db/media.ts); rows here are moved by scripts/migrate-media-to-cloudinary.ts
-- and served back out through /api/media/[id] until then.
create table if not exists media (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  mime_type text not null,
  size_bytes integer not null,
  data bytea not null,
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  code text,
  title text not null,
  tagline text,
  location text,
  location_slug text,
  category text not null default 'Residential',
  price text,
  specs text,
  image text,
  description jsonb not null default '[]',
  highlights jsonb not null default '[]',
  amenities jsonb not null default '[]',
  gallery jsonb not null default '[]',
  architect text,
  developer text,
  possession text,
  rera text,
  landmarks jsonb not null default '[]',
  testimonial jsonb,
  status text not null default 'published',
  sort_order integer not null default 0,
  seo_title text,
  seo_description text,
  seo_keywords jsonb not null default '[]',
  og_image text,
  seo_noindex boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Additive SEO columns for installs where the table already existed
-- before these fields were introduced.
alter table projects add column if not exists seo_title text;
alter table projects add column if not exists seo_description text;
alter table projects add column if not exists seo_keywords jsonb not null default '[]';
alter table projects add column if not exists og_image text;
alter table projects add column if not exists seo_noindex boolean not null default false;

-- Explicit city/region tag (one of src/lib/locations.ts LOCATIONS slugs) so the
-- Properties nav dropdown and /projects/location/[slug] pages don't have to
-- guess a project's city from the free-text `location` field.
alter table projects add column if not exists location_slug text;

-- Section keys (see PROJECT_SECTION_KEYS in src/lib/db/types.ts) the admin has
-- chosen to hide from the public project detail page — e.g. ["gallery"].
alter table projects add column if not exists hidden_sections jsonb not null default '[]';

create index if not exists projects_status_idx on projects (status);
create index if not exists projects_category_idx on projects (category);
create index if not exists projects_location_slug_idx on projects (location_slug);

create table if not exists job_openings (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  department text not null,
  location text,
  address text,
  work_mode text,
  requirements jsonb not null default '[]',
  overview text,
  responsibilities jsonb not null default '[]',
  qualifications jsonb not null default '[]',
  why_join jsonb not null default '[]',
  status text not null default 'open',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_openings_status_idx on job_openings (status);

create table if not exists job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references job_openings(id) on delete set null,
  job_title_snapshot text,
  full_name text not null,
  email text not null,
  phone text,
  portfolio_url text,
  cover_note text,
  resume_filename text,
  resume_mime_type text,
  resume_data bytea,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

-- Resumes are stored on Cloudinary (private, signed access only); this is the
-- asset's public_id. `resume_data` is legacy — only rows not yet moved by
-- scripts/migrate-resumes-to-cloudinary.ts still use it.
alter table job_applications add column if not exists resume_public_id text;

create index if not exists job_applications_status_idx on job_applications (status);
create index if not exists job_applications_job_idx on job_applications (job_id);

create table if not exists blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text,
  category text not null default 'Market Insights',
  post_date date not null default current_date,
  read_time text,
  cover_image text,
  author_name text,
  author_role text,
  author_avatar text,
  content jsonb not null default '[]',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_status_idx on blog_posts (status);
create index if not exists blog_posts_date_idx on blog_posts (post_date desc);

-- Generic per-section content storage for the visual page builder. Shared
-- content (e.g. the Footer, rendered on many pages) lives once under
-- page_slug = 'global' instead of being duplicated per page.
create table if not exists page_sections (
  id uuid primary key default gen_random_uuid(),
  page_slug text not null,
  section_key text not null,
  content jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique (page_slug, section_key)
);
