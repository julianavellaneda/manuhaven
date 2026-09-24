"use client";

import { useTranslations } from "next-intl";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SortableChapterItem } from "@/components/editor/SortableChapterItem";

interface ChapterData {
  id: string;
  title: string;
  wordCount?: number;
}

interface ChapterNavProps {
  chapters: ChapterData[];
  activeChapterIndex: number;
  onChapterSelect: (index: number) => void;
  onAddChapter: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRename: (index: number, title: string) => void;
  onSplit: (index: number) => void;
  onMergeNext: (index: number) => void;
  onDelete: (index: number) => void;
  viewMode: "chapter" | "fullBook";
  projectTitle: string;
  /** Set of 1-indexed chapter numbers flagged by the Story Bible. */
  inconsistencyChapters?: ReadonlySet<number>;
}

export function ChapterNav({
  chapters,
  activeChapterIndex,
  onChapterSelect,
  onAddChapter,
  onReorder,
  onRename,
  onSplit,
  onMergeNext,
  onDelete,
  viewMode,
  projectTitle,
  inconsistencyChapters,
}: ChapterNavProps) {
  const t = useTranslations("editor.chapterNav");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = chapters.findIndex((c) => c.id === active.id);
    const toIndex = chapters.findIndex((c) => c.id === over.id);
    if (fromIndex < 0 || toIndex < 0) return;
    onReorder(fromIndex, toIndex);
    // Provide a visual hint via arrayMove (for the consumer to apply).
    void arrayMove;
  };

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-muted/50">
      <div className="bg-gradient-to-r from-[oklch(0.28_0.04_200)] to-[oklch(0.37_0.04_200)] px-4 py-5">
        <p className="text-[0.65rem] font-medium uppercase tracking-[0.15em] text-white/50">
          {t("chaptersOf")}
        </p>
        <h3 className="mt-1 font-serif text-sm font-semibold text-white">
          {projectTitle}
        </h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {chapters.length > 0 ? (
            <DndContext
              id="manuhaven-chapters-dnd"
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={chapters.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                {chapters.map((chapter, index) => (
                  <SortableChapterItem
                    key={chapter.id}
                    id={chapter.id}
                    index={index}
                    title={chapter.title}
                    wordCount={chapter.wordCount}
                    isActive={index === activeChapterIndex}
                    canSplit={viewMode === "chapter"}
                    canMergeNext={index < chapters.length - 1}
                    canDelete={chapters.length > 1}
                    hasInconsistency={inconsistencyChapters?.has(index + 1) ?? false}
                    onSelect={() => onChapterSelect(index)}
                    onRename={(t) => onRename(index, t)}
                    onSplit={() => onSplit(index)}
                    onMergeNext={() => onMergeNext(index)}
                    onDelete={() => onDelete(index)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {t("noChapters")}
            </p>
          )}

          {viewMode === "chapter" && (
            <Button
              variant="ghost"
              onClick={onAddChapter}
              className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3.5 shrink-0" />
              <span className="text-[0.8rem] font-medium">{t("addChapter")}</span>
            </Button>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
