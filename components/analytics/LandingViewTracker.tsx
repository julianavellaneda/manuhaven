"use client";

import { useEffect } from "react";
import { capture } from "@/lib/analytics/posthog";

export function LandingViewTracker() {
  useEffect(() => {
    capture("landing_view");
  }, []);

  return null;
}
