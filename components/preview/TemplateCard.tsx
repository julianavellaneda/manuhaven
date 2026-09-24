"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface TemplateCardProps {
  name: string;
  description: string | null;
  genre: string;
  isSelected: boolean;
  onSelect: () => void;
}

export function TemplateCard({
  name,
  description,
  genre,
  isSelected,
  onSelect,
}: TemplateCardProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "relative w-full rounded-xl p-4 text-left transition-all",
        isSelected
          ? "bg-card shadow-md"
          : "bg-muted/50 hover:bg-card hover:shadow-sm"
      )}
    >
      {isSelected && (
        <div className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3" />
        </div>
      )}
      {/* Thumbnail placeholder */}
      <div className="mb-3 aspect-[5/7] w-full overflow-hidden rounded-lg bg-gradient-to-br from-muted to-muted/30">
        <div className="flex h-full flex-col items-center justify-center p-3">
          <div className="h-0.5 w-8 bg-foreground/10" />
          <p className="mt-2 font-serif text-xs font-medium text-foreground/40">
            {name}
          </p>
          <div className="mt-2 space-y-1 w-full px-2">
            <div className="h-0.5 w-full bg-foreground/5" />
            <div className="h-0.5 w-4/5 bg-foreground/5" />
            <div className="h-0.5 w-full bg-foreground/5" />
          </div>
        </div>
      </div>
      <h3 className="font-serif text-sm font-semibold text-foreground">
        {name}
      </h3>
      <p className="mt-0.5 text-xs capitalize text-muted-foreground">{genre}</p>
      {description && (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
          {description}
        </p>
      )}
    </button>
  );
}
