"use client";

import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";

interface AssistantRailToggleProps {
  active: boolean;
  onToggle: () => void;
}

/** Narrow right rail with the button that docks/undocks the assistant. */
export function AssistantRailToggle({
  active,
  onToggle,
}: AssistantRailToggleProps) {
  const tRail = useTranslations("assistant.rail");

  return (
    <div className="flex w-10 shrink-0 flex-col items-center gap-1 border-l bg-muted/30 py-3">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={active}
        aria-label={tRail("assistant")}
        title={tRail("assistant")}
        className={`flex size-8 items-center justify-center rounded-md transition-colors ${
          active
            ? "bg-accent text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        }`}
      >
        <Sparkles className="size-4" />
      </button>
    </div>
  );
}
