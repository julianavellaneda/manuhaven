"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Clock, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { StoryBible } from "@/lib/ai/continuity";

/**
 * The Codex: characters, locations, timeline, and continuity flags extracted
 * from the manuscript. Backed by the `manuscripts.story_bible` jsonb blob,
 * which is also what the assistant's `query_codex` tool reads.
 */

type Section = "characters" | "locations" | "timeline" | "inconsistencies";

interface Props {
  projectId: string;
  storyBible: StoryBible | null;
  onStoryBibleChange?: (sb: StoryBible) => void;
  onJumpToChapter?: (chapterNumber: number) => void;
}

export function CodexTab({
  projectId,
  storyBible,
  onStoryBibleChange,
  onJumpToChapter,
}: Props) {
  const t = useTranslations("assistant.codex");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<Section, boolean>>({
    inconsistencies: true,
    characters: true,
    locations: false,
    timeline: false,
  });

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/continuity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t("failed"));
      onStoryBibleChange?.(body.storyBible);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failed"));
    } finally {
      setLoading(false);
    }
  }

  const toggle = (s: Section) => setOpen((o) => ({ ...o, [s]: !o[s] }));

  return (
    <>
      <div className="border-b px-3 py-3">
        <Button
          onClick={handleGenerate}
          disabled={loading}
          size="sm"
          className="w-full"
        >
          {loading ? t("analyzing") : storyBible ? t("refresh") : t("generate")}
        </Button>
        {error && (
          <p className="mt-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </p>
        )}
        {!storyBible && !loading && !error && (
          <p className="mt-2 text-[0.7rem] leading-snug text-muted-foreground">
            {t("intro")}
          </p>
        )}
      </div>

      <ScrollArea className="flex-1">
        {storyBible && (
          <div className="space-y-1 p-2">
            <SectionHeader
              icon={<AlertTriangle className="size-3.5" />}
              label={t("inconsistencies", {
                count: storyBible.inconsistencies.length,
              })}
              open={open.inconsistencies}
              onToggle={() => toggle("inconsistencies")}
              tone={
                storyBible.inconsistencies.length > 0 ? "warning" : "default"
              }
            />
            {open.inconsistencies && (
              <div className="space-y-2 px-2 pb-2">
                {storyBible.inconsistencies.length === 0 ? (
                  <p className="text-[0.7rem] text-muted-foreground">
                    {t("noInconsistencies")}
                  </p>
                ) : (
                  storyBible.inconsistencies.map((inc, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded border bg-background p-2 text-xs",
                        inc.severity === "error"
                          ? "border-destructive/40"
                          : "border-amber-500/40"
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                          {inc.type}
                        </span>
                        <span
                          className={cn(
                            "text-[0.65rem] font-medium uppercase",
                            inc.severity === "error"
                              ? "text-destructive"
                              : "text-amber-600 dark:text-amber-400"
                          )}
                        >
                          {inc.severity}
                        </span>
                      </div>
                      <p className="leading-snug">{inc.description}</p>
                      {inc.chapters.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {inc.chapters.map((ch) => (
                            <ChapterChip
                              key={ch}
                              chapter={ch}
                              onJump={onJumpToChapter}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            <SectionHeader
              icon={<Users className="size-3.5" />}
              label={t("characters", { count: storyBible.characters.length })}
              open={open.characters}
              onToggle={() => toggle("characters")}
            />
            {open.characters && (
              <div className="space-y-2 px-2 pb-2">
                {storyBible.characters.length === 0 ? (
                  <p className="text-[0.7rem] text-muted-foreground">
                    {t("none")}
                  </p>
                ) : (
                  storyBible.characters.map((c) => (
                    <div
                      key={c.name}
                      className="rounded border bg-background p-2 text-[0.7rem]"
                    >
                      <p className="text-xs font-medium">{c.name}</p>
                      {c.aliases.length > 0 && (
                        <p className="mt-0.5 text-muted-foreground">
                          {t("aliases", { list: c.aliases.join(", ") })}
                        </p>
                      )}
                      <p className="mt-1 leading-snug">{c.description}</p>
                      {c.physicalTraits.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {c.physicalTraits.map((tr, i) => (
                            <li key={i}>
                              <span className="text-muted-foreground">
                                {tr.trait}:
                              </span>{" "}
                              {tr.value}{" "}
                              <span className="text-muted-foreground">
                                {t("firstMention", { n: tr.firstMention })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            <SectionHeader
              icon={<MapPin className="size-3.5" />}
              label={t("locations", { count: storyBible.locations.length })}
              open={open.locations}
              onToggle={() => toggle("locations")}
            />
            {open.locations && (
              <div className="space-y-2 px-2 pb-2">
                {storyBible.locations.length === 0 ? (
                  <p className="text-[0.7rem] text-muted-foreground">
                    {t("none")}
                  </p>
                ) : (
                  storyBible.locations.map((loc) => (
                    <div
                      key={loc.name}
                      className="rounded border bg-background p-2 text-[0.7rem]"
                    >
                      <p className="text-xs font-medium">{loc.name}</p>
                      <p className="mt-1 leading-snug">{loc.description}</p>
                      {loc.details.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {loc.details.map((d, i) => (
                            <li key={i}>
                              {d.detail}{" "}
                              <span className="text-muted-foreground">
                                {t("firstMention", { n: d.firstMention })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            <SectionHeader
              icon={<Clock className="size-3.5" />}
              label={t("timeline", { count: storyBible.timeline.length })}
              open={open.timeline}
              onToggle={() => toggle("timeline")}
            />
            {open.timeline && (
              <div className="px-2 pb-2">
                {storyBible.timeline.length === 0 ? (
                  <p className="text-[0.7rem] text-muted-foreground">
                    {t("none")}
                  </p>
                ) : (
                  <ol className="space-y-1.5">
                    {storyBible.timeline.map((evt, i) => (
                      <li
                        key={i}
                        className="rounded border bg-background p-2 text-[0.7rem] leading-snug"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[0.65rem] font-medium uppercase text-muted-foreground">
                            {t("chapter", { n: evt.chapter })}
                          </span>
                          <span className="text-[0.65rem] text-muted-foreground">
                            {evt.relativeTime}
                          </span>
                        </div>
                        <p className="mt-0.5">{evt.event}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </>
  );
}

function SectionHeader({
  icon,
  label,
  open,
  onToggle,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  open: boolean;
  onToggle: () => void;
  tone?: "default" | "warning";
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs font-medium hover:bg-muted",
        tone === "warning" && "text-amber-700 dark:text-amber-400"
      )}
    >
      <span
        aria-hidden
        className={cn("transition-transform", open ? "rotate-90" : "rotate-0")}
      >
        ▸
      </span>
      {icon}
      <span className="flex-1">{label}</span>
    </button>
  );
}

function ChapterChip({
  chapter,
  onJump,
}: {
  chapter: number;
  onJump?: (chapterNumber: number) => void;
}) {
  const t = useTranslations("assistant.codex");
  const label = t("chapter", { n: chapter });
  if (!onJump) {
    return (
      <span className="rounded border bg-muted px-1.5 py-0.5 text-[0.65rem]">
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onJump(chapter)}
      className="rounded border bg-muted px-1.5 py-0.5 text-[0.65rem] hover:bg-muted-foreground/10"
    >
      {label}
    </button>
  );
}
