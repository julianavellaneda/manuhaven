import type { MetadataRoute } from "next";
import { localizedUrl } from "@/lib/seo";

// Public, indexable marketing routes (canonical paths without locale prefix).
const PUBLIC_PATHS = ["/", "/about", "/contact", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_PATHS.map((path) => ({
    url: localizedUrl("en", path),
    lastModified,
    // hreflang alternates so Googlebot discovers the Spanish variants from the
    // English root (no IP redirects).
    alternates: {
      languages: {
        "es-MX": localizedUrl("es", path),
      },
    },
  }));
}
