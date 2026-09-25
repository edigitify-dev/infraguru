import { requireAdmin } from "@/lib/auth";
import { getSections } from "@/lib/db/pageContent";
import { LOCATIONS, type LocationRegion } from "@/lib/locations";
import {
  destinationsPageSlug,
  sectionMapKey,
  DESTINATIONS_REGION_DEFAULT_CONTENT,
  type DestinationsRegionContent,
} from "@/lib/pageSections";
import PageHeader from "@/components/admin/PageHeader";
import DestinationRegionCard from "./DestinationRegionCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Destination Images — InfraGuru CMS" };

const REGIONS: { slug: string; label: string; heading: LocationRegion }[] = [
  { slug: "india", label: "India", heading: "India" },
  { slug: "international", label: "International", heading: "International" },
];

export default async function DestinationsAdminPage() {
  await requireAdmin();

  const sectionKeys = REGIONS.map((r) => ({ pageSlug: destinationsPageSlug(r.slug), key: "content" }));
  const sections = await getSections(sectionKeys, { strict: true });

  const regions = REGIONS.map((r) => {
    const pageSlug = destinationsPageSlug(r.slug);
    const saved = sections.get(sectionMapKey({ pageSlug, key: "content" })) as
      | DestinationsRegionContent
      | undefined;
    const content = saved ?? DESTINATIONS_REGION_DEFAULT_CONTENT;
    const cardImageBySlug = new Map(content.cardImages.map((c) => [c.slug, c.image]));

    const cities = LOCATIONS.filter((loc) => loc.region === r.heading).map((loc) => ({
      slug: loc.slug,
      label: loc.label,
      image: cardImageBySlug.get(loc.slug) || loc.image,
    }));

    return {
      slug: r.slug,
      label: r.label,
      pageSlug,
      urlPath: `/destinations/${r.slug}`,
      heroImage: content.heroImage,
      cities,
    };
  });

  return (
    <div>
      <PageHeader
        title="Destination Images"
        description="Set the hero banner and destination card images shown on the India and International /destinations pages. Use 1920×1080px (16:9) landscape photos. Leave the hero blank to fall back to the first destination card's image."
      />
      <div className="flex flex-col gap-6">
        {regions.map((region) => (
          <DestinationRegionCard key={region.slug} region={region} />
        ))}
      </div>
    </div>
  );
}
