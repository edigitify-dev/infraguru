import { db } from "./client";
import { fallbackJobs } from "./fallback";
import type { JobOpening, JobQualification, JobResponsibilityGroup, JobStatus } from "./types";

type JobRow = {
  id: string;
  slug: string;
  title: string;
  department: string;
  location: string | null;
  address: string | null;
  work_mode: string | null;
  requirements: string[] | null;
  overview: string | null;
  responsibilities: JobResponsibilityGroup[] | null;
  qualifications: JobQualification[] | null;
  why_join: string[] | null;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function mapRow(row: JobRow): JobOpening {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    department: row.department,
    location: row.location ?? "",
    address: row.address,
    workMode: row.work_mode ?? "",
    requirements: row.requirements ?? [],
    overview: row.overview ?? "",
    responsibilities: row.responsibilities ?? [],
    qualifications: row.qualifications ?? [],
    whyJoin: row.why_join ?? [],
    status: row.status as JobStatus,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type JobInput = {
  slug: string;
  title: string;
  department: string;
  location?: string | null;
  address?: string | null;
  workMode?: string | null;
  requirements: string[];
  overview?: string | null;
  responsibilities: JobResponsibilityGroup[];
  qualifications: JobQualification[];
  whyJoin: string[];
  status: JobStatus;
  sortOrder: number;
};

export async function listAllJobs(): Promise<JobOpening[]> {
  const res = await db.query<JobRow>(
    `select * from job_openings order by sort_order asc, created_at desc`
  );
  return res.rows.map(mapRow);
}

// Public reads (open jobs, job by slug) use `db.read` and fall back to cached
// or static content during a DB outage; admin reads stay strict.
export async function listOpenJobs(): Promise<JobOpening[]> {
  const res = await db.read<JobRow>(
    `select * from job_openings where status = 'open' order by sort_order asc, created_at desc`
  );
  return res.source === "none" ? fallbackJobs() : res.rows.map(mapRow);
}

export async function getJobById(id: string): Promise<JobOpening | null> {
  const res = await db.query<JobRow>(`select * from job_openings where id = $1`, [id]);
  return res.rows[0] ? mapRow(res.rows[0]) : null;
}

export async function getJobBySlug(slug: string): Promise<JobOpening | null> {
  const res = await db.read<JobRow>(`select * from job_openings where slug = $1`, [slug]);
  if (res.source === "none") return (await listOpenJobs()).find((j) => j.slug === slug) ?? null;
  return res.rows[0] ? mapRow(res.rows[0]) : null;
}

export async function createJob(input: JobInput): Promise<JobOpening> {
  const res = await db.query<JobRow>(
    `insert into job_openings
      (slug, title, department, location, address, work_mode, requirements,
       overview, responsibilities, qualifications, why_join, status, sort_order)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     returning *`,
    [
      input.slug,
      input.title,
      input.department,
      input.location ?? null,
      input.address ?? null,
      input.workMode ?? null,
      JSON.stringify(input.requirements),
      input.overview ?? null,
      JSON.stringify(input.responsibilities),
      JSON.stringify(input.qualifications),
      JSON.stringify(input.whyJoin),
      input.status,
      input.sortOrder,
    ]
  );
  return mapRow(res.rows[0]);
}

export async function updateJob(id: string, input: JobInput): Promise<JobOpening> {
  const res = await db.query<JobRow>(
    `update job_openings set
      slug = $2, title = $3, department = $4, location = $5, address = $6,
      work_mode = $7, requirements = $8, overview = $9, responsibilities = $10,
      qualifications = $11, why_join = $12, status = $13, sort_order = $14,
      updated_at = now()
     where id = $1
     returning *`,
    [
      id,
      input.slug,
      input.title,
      input.department,
      input.location ?? null,
      input.address ?? null,
      input.workMode ?? null,
      JSON.stringify(input.requirements),
      input.overview ?? null,
      JSON.stringify(input.responsibilities),
      JSON.stringify(input.qualifications),
      JSON.stringify(input.whyJoin),
      input.status,
      input.sortOrder,
    ]
  );
  if (!res.rows[0]) throw new Error("Job not found");
  return mapRow(res.rows[0]);
}

export async function deleteJob(id: string): Promise<void> {
  await db.query(`delete from job_openings where id = $1`, [id]);
}
