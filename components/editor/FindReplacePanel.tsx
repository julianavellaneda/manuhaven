"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X, ChevronDown, ChevronUp, CaseSensitive } from "lucide-react";
import type { Editor } from "@tiptap/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface FindReplacePanelProps {
  editor: Editor | null;
  open: boolean;
  mode: "find" | "replace";
  onClose: () => void;
}

interface SearchStorage {
  searchTerm: string;
  replaceTerm: string;
  caseSensitive: boolean;
  results: { from: number; to: number }[];
  activeIndex: number;
}

function getStorage(editor: Editor | null): SearchStorage | null {
  if (!editor) return null;
  const storage = (editor.storage as unknown as Record<string, unknown>)
    .manuhavenSearch as SearchStorage | undefined;
  return storage ?? null;
}

export function FindReplacePanel({
  editor,
  open,
  mode,
  onClose,
}: FindReplacePanelProps) {
  const t = useTranslations("editor.findReplace");
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [tick, setTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Bump re-render when storage mutates (find next/prev/replace).
  useEffect(() => {
    if (!editor || !open) return;
    const handler = () => setTick((t) => t + 1);
    editor.on("transaction", handler);
    return () => {
      editor.off("transaction", handler);
    };
  }, [editor, open]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!editor) return;
    if (open) {
      editor.commands.setSearchTerm(find);
    } else {
      editor.commands.clearSearch();
    }
  }, [editor, open, find, caseSensitive]);

  useEffect(() => {
    if (!editor) return;
    editor.commands.setReplaceTerm(replace);
  }, [editor, replace]);

  useEffect(() => {
    if (!editor) return;
    editor.commands.setCaseSensitive(caseSensitive);
  }, [editor, caseSensitive]);

  if (!open) return null;

  const storage = getStorage(editor);
  const resultCount = storage?.results.length ?? 0;
  const activeIndex = resultCount > 0 ? (storage?.activeIndex ?? 0) + 1 : 0;

  const gotoNext = () => editor?.commands.gotoNext();
  const gotoPrev = () => editor?.commands.gotoPrevious();
  const doReplace = () => editor?.commands.replace();
  const doReplaceAll = () => editor?.commands.replaceAll();

  return (
    <div
      className="absolute right-4 top-14 z-20 flex w-80 flex-col gap-2 rounded-lg bg-popover p-3 text-sm shadow-lg ring-1 ring-foreground/10"
      role="dialog"
      aria-label={t("ariaLabel")}
    >
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          placeholder={t("findPlaceholder")}
          value={find}
          onChange={(e) => setFind(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (e.shiftKey) gotoPrev();
              else gotoNext();
            }
            if (e.key === "Escape") onClose();
          }}
          className="min-w-0 flex-1 rounded-md bg-muted px-2 py-1 text-sm outline-none ring-1 ring-transparent focus:ring-ring"
          /* Tick ensures re-renders pick up storage updates without warnings. */
          data-tick={tick}
        />
        <span className="shrink-0 tabular-nums text-[0.65rem] text-muted-foreground">
          {activeIndex}/{resultCount}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCaseSensitive((v) => !v)}
          className={cn(caseSensitive && "bg-muted text-foreground")}
          aria-pressed={caseSensitive}
          title={t("matchCaseTitle")}
        >
          <CaseSensitive className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={gotoPrev}
          disabled={resultCount === 0}
          title={t("prevTitle")}
        >
          <ChevronUp className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={gotoNext}
          disabled={resultCount === 0}
          title={t("nextTitle")}
        >
          <ChevronDown className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          title={t("closeTitle")}
        >
          <X className="size-4" />
        </Button>
      </div>

      {mode === "replace" && (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder={t("replacePlaceholder")}
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
            className="min-w-0 flex-1 rounded-md bg-muted px-2 py-1 text-sm outline-none ring-1 ring-transparent focus:ring-ring"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={doReplace}
            disabled={resultCount === 0}
          >
            {t("replaceButton")}
          </Button>
          <Button
            size="sm"
            onClick={doReplaceAll}
            disabled={resultCount === 0}
          >
            {t("replaceAllButton")}
          </Button>
        </div>
      )}

      <p className="text-[0.65rem] leading-snug text-muted-foreground">
        {t("searchScope")}
      </p>
    </div>
  );
}
