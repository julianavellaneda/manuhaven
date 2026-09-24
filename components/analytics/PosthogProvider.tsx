"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { capture, initPosthog } from "@/lib/analytics/posthog";

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    // Routes whose query strings carry capability tokens or PII — strip them.
    const SENSITIVE_PATHS = ["/welcome"];
    const sensitive = SENSITIVE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    const search = sensitive ? "" : searchParams?.toString() ?? "";
    const url = search ? `${pathname}?${search}` : pathname;
    capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

export function PosthogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPosthog();
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </>
  );
}
