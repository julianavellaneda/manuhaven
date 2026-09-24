"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import {
  AlertTriangle,
  BookOpen,
  GripVertical,
  MoreHorizontal,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface SortableChapterItemProps {
  id: string;
  index: number;
  title: string;
  wordCount?: number;
  isActive: boolean;
  canSplit: boolean;
  canMergeNext: boolean;
  canDelete: boolean;
  hasInconsistency?: boolean;
  onSelect: () => void;
  onRename: (newTitle: string) => void;
  onSplit: () => void;
  onMergeNext: () => void;
  onDelete: () => void;
}

export function SortableChapterItem({
  id,
  index,
  title,
  wordCount,
  isActive,
  canSplit,
  canMergeNext,
  canDelete,
  hasInconsistency = false,
  onSelect,
  onRename,
  onSplit,
  onMergeNext,
  onDelete,
}: SortableChapterItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const t = useTranslations("editor.chapterItem");
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  const beginEditing = () => {
    setDraftTitle(title);
    setEditing(true);
  };

  useEffect(() => {
    if (editing) {
      const raf = requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [editing]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const commitRename = () => {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== title) onRename(trimmed);
    else setDraftTitle(title);
    setEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/item relative flex items-center gap-1 rounded-lg transition-colors",
        isDragging && "z-50 opacity-90 shadow-lg"
      )}
      data-chapter-index={index}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex h-8 w-5 items-center justify-center text-muted-foreground/50 opacity-0 transition-opacity group-hover/item:opacity-100"
        aria-label={t("reorderAriaLabel")}
        title={t("reorderTitle")}
      >
        <GripVertical className="size-3.5" />
      </button>

      <button
        type="button"
        onClick={onSelect}
        onDoubleClick={() => beginEditing()}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
          isActive
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-card/50 hover:text-foreground"
        )}
      >
        <BookOpen className="size-3.5 shrink-0" />
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              ref={inputRef}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={commitRename}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === "Escape") {
                  setDraftTitle(title);
                  setEditing(false);
                }
              }}
              className="w-full rounded-md bg-background px-1 py-0.5 text-[0.8rem] font-medium outline-none ring-1 ring-ring"
            />
          ) : (
            <p className="flex items-center gap-1.5 truncate text-[0.8rem] font-medium">
              <span className="truncate">{title}</span>
              {hasInconsistency && (
                <AlertTriangle
                  className="size-3 shrink-0 text-amber-500"
                  aria-label={t("inconsistencyAriaLabel")}
                />
              )}
            </p>
          )}
          {wordCount != null && !editing && (
            <p className="text-[0.65rem] text-muted-foreground">
              {wordCount.toLocaleString()} words
            </p>
          )}
        </div>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 transition-opacity group-hover/item:opacity-100"
              aria-label={t("actionsAriaLabel")}
            />
          }
        >
          <MoreHorizontal className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onClick={() => beginEditing()}>
            {t("rename")}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!canSplit} onClick={onSplit}>
            {t("splitAtCursor")}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!canMergeNext} onClick={onMergeNext}>
            {t("mergeWithNext")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!canDelete}
            variant="destructive"
            onClick={onDelete}
          >
            {t("deleteChapter")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
