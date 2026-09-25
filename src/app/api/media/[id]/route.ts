import { NextResponse } from "next/server";
import { getMedia } from "@/lib/db/media";
import { migratedMediaUrl } from "@/lib/cloudinary";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let media;
  try {
    media = await getMedia(id);
  } catch (err) {
    // DB unreachable/over quota: say "try again", never cache it, and don't
    // let it look like the image was deleted (a 404).
    console.error("[media] database unavailable:", err instanceof Error ? err.message : err);
    return new NextResponse("Temporarily unavailable", {
      status: 503,
      headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    });
  }

  if (!media) {
    // Rows removed from Neon after moving to Cloudinary: keep old
    // /api/media/<id> links (cached pages, search results) working.
    const moved = migratedMediaUrl(id);
    if (moved) {
      const res = NextResponse.redirect(moved, 307);
      res.headers.set("Cache-Control", "public, max-age=86400");
      return res;
    }
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(media.data), {
    headers: {
      "Content-Type": media.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(media.sizeBytes),
    },
  });
}
