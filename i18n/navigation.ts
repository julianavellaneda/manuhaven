import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware wrappers around Next.js navigation. ALL internal navigation
// must import from here (not `next/link` / `next/navigation`) so the active
// locale prefix is preserved across links and redirects.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
