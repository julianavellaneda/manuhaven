import { notFound } from "next/navigation";

// Sends unmatched paths to the localized `[locale]/not-found.tsx`; without it
// Next.js falls back to its unstyled default 404.
export default function CatchAllPage() {
  notFound();
}
