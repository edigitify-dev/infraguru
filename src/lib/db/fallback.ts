// Content served when the database can't be reached and nothing has been
// cached yet (e.g. a cold serverless instance during an outage). It's the
// original static content the CMS was seeded from, reshaped to match the
// database row types so pages don't need to know the difference.
//
// It only covers what shipped in code — projects/posts/jobs added later
// through the CMS appear once the database is back (or from the in-memory
// cache on instances that already served them).
import { PROJECTS } from "@/lib/projects";
import { OPENINGS } from "@/lib/careers";
import { BLOG_POSTS } from "@/lib/blog";
import { LOCATIONS, projectMatchesLocation } from "@/lib/locations";
import type { BlogPost, JobOpening, Project } from "./types";

const EPOCH = new Date(0).toISOString();

export function fallbackProjects(): Project[] {
  return PROJECTS.map((p, i) => ({
    ...p,
    id: String(p.id),
    locationSlug: LOCATIONS.find((l) => projectMatchesLocation(p.location, l))?.slug ?? "",
    status: "published",
    sortOrder: i,
    hiddenSections: [],
    seoTitle: "",
    seoDescription: "",
    seoKeywords: [],
    ogImage: "",
    seoNoindex: false,
    createdAt: EPOCH,
    updatedAt: EPOCH,
  }));
}

export function fallbackJobs(): JobOpening[] {
  return OPENINGS.map((j, i) => ({
    ...j,
    id: j.slug,
    address: j.address ?? null,
    status: "open",
    sortOrder: i,
    createdAt: EPOCH,
    updatedAt: EPOCH,
  }));
}

export function fallbackPosts(): BlogPost[] {
  return BLOG_POSTS.map((p) => ({
    ...p,
    id: String(p.id),
    status: "published",
    createdAt: EPOCH,
    updatedAt: EPOCH,
  }));
}
