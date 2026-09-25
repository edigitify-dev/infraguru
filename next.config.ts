import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "infraguru.in" },
      // CMS images (uploaded from the admin, or moved out of the database by
      // scripts/migrate-media-to-cloudinary.ts). Scoped to this project's cloud
      // so the optimizer can't be used to proxy anyone else's Cloudinary assets.
      ...(process.env.CLOUDINARY_CLOUD_NAME
        ? [{ protocol: "https" as const, hostname: "res.cloudinary.com", pathname: `/${process.env.CLOUDINARY_CLOUD_NAME}/**` }]
        : []),
    ],
  },
  experimental: {
    serverActions: {
      // Default is 1MB — the gallery's video upload action needs headroom
      // for real video files (uploaded straight through to Cloudinary).
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
