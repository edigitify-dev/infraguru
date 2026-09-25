import { requireAdmin } from "@/lib/auth";
import { listPublishedProjects } from "@/lib/db/projects";
import { getSections } from "@/lib/db/pageContent";
import { LOCATIONS, projectBelongsToLocation } from "@/lib/locations";
import { locationPageSlug, sectionMapKey, type LocationHeroContent } from "@/lib/pageSections";
import PageHeader from "@/components/admin/PageHeader";
import ProjectHeroCityCard from "./ProjectHeroCityCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Project Hero Images — InfraGuru CMS" };

export default async function ProjectHeroPage() {
  await requireAdmin();

  const heroSections = LOCATIONS.map((loc) => ({ pageSlug: locationPageSlug(loc.slug), key: "hero" }));
  const [projects, sections] = await Promise.all([
    listPublishedProjects(),
    getSections(heroSections, { strict: true }),
  ]);

  const cities = LOCATIONS.map((loc) => {
    const pageSlug = locationPageSlug(loc.slug);
    const saved = sections.get(sectionMapKey({ pageSlug, key: "hero" })) as LocationHeroContent | undefined;
    const matches = projects.filter((p) => projectBelongsToLocation(p, loc));
    const autoResidential = matches.find((p) => p.category === "Residential")?.image || "";
    const autoCommercial = matches.find((p) => p.category === "Commercial")?.image || "";
    return {
      slug: loc.slug,
      label: loc.label,
      pageSlug,
      residentialImage: saved?.residentialImage || autoResidential,
      commercialImage: saved?.commercialImage || autoCommercial,
    };
  });

  return (
    <div>
      <PageHeader
        title="Project Hero Images"
        description="Set the Residential and Commercial hero images shown on each city's /projects/location page. Use 1920×1080px (16:9) landscape photos. Leave a slot empty to fall back to a matching project's own photo."
      />
      <div className="flex flex-col gap-6">
        {cities.map((city) => (
          <ProjectHeroCityCard key={city.slug} city={city} />
        ))}
      </div>
    </div>
  );
}
