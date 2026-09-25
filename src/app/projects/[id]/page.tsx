import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicProjectById, listPublishedProjects } from "@/lib/db/projects";
import ProjectExperience from "@/components/ProjectExperience";
import Footer from "@/components/Footer";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const project = await getPublicProjectById(id);

  if (!project) {
    return { title: "Deed Not Found | Infraguru" };
  }

  const title = project.seoTitle || `${project.title} | Infraguru`;
  const description = project.seoDescription || project.tagline || undefined;
  const image = project.ogImage || project.image || DEFAULT_OG_IMAGE;
  const url = `/projects/${project.id}`;

  return {
    title,
    description,
    keywords: project.seoKeywords.length ? project.seoKeywords : undefined,
    alternates: { canonical: url },
    robots:
      project.seoNoindex || project.status !== "published"
        ? { index: false, follow: false }
        : { index: true, follow: true },
    openGraph: {
      type: "website",
      title,
      description,
      url,
      siteName: SITE_NAME,
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getPublicProjectById(id);

  if (!project || project.status !== "published") {
    notFound();
  }

  const related = (await listPublishedProjects()).filter((p) => p.id !== project.id).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: project.title,
    description: project.seoDescription || project.tagline || undefined,
    url: absoluteUrl(`/projects/${project.id}`),
    image: absoluteUrl(project.ogImage || project.image || DEFAULT_OG_IMAGE),
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProjectExperience project={project} related={related} />
      <Footer />
    </main>
  );
}
