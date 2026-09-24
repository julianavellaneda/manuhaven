"use client";

import { useCallback } from "react";
import {
  mergeChapters,
  type Chapter,
  type TiptapDoc,
} from "@/lib/manuscript/chapter-utils";
import { blankChapter, nextChapterTitle } from "@/lib/manuscript/chapter-ops";
import type { useAutosave } from "@/lib/editor/use-autosave";
import {
  resplitPreservingIds,
  type ChapterState,
} from "@/lib/editor/use-chapter-state";

interface UseChapterNavigationOptions {
  state: ChapterState;
  autosave: ReturnType<typeof useAutosave>;
  schedulePersist: (chs: Chapter[]) => void;
}

/** Selecting and adding chapters, and toggling chapter / full-book view. */
export function useChapterNavigation({
  state,
  autosave,
  schedulePersist,
}: UseChapterNavigationOptions) {
  const {
    viewMode,
    setViewMode,
    setChapters,
    setActiveChapterIndex,
    editorInstance,
    chaptersRef,
    activeChapterIndexRef,
    viewModeRef,
    syncCurrentChapter,
  } = state;

  const handleChapterSelect = useCallback(
    (index: number) => {
      if (viewModeRef.current === "fullBook") {
        if (editorInstance) {
          const doc = editorInstance.state.doc;
          let h1Index = 0;
          let targetPos: number | null = null;
          doc.descendants((node, pos) => {
            if (node.type.name === "heading" && node.attrs.level === 1) {
              if (h1Index === index) {
                targetPos = pos;
                return false;
              }
              h1Index++;
            }
          });
          if (targetPos === null && index === 0) targetPos = 0;
          if (targetPos !== null) {
            editorInstance.commands.focus(targetPos);
            const domAtPos = editorInstance.view.domAtPos(targetPos);
            const element =
              domAtPos.node instanceof HTMLElement
                ? domAtPos.node
                : domAtPos.node.parentElement;
            element?.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
        setActiveChapterIndex(index);
        activeChapterIndexRef.current = index;
        return;
      }

      if (index === activeChapterIndexRef.current) return;
      const updated = syncCurrentChapter();
      activeChapterIndexRef.current = index;
      setChapters(updated);
      setActiveChapterIndex(index);
      const newChapter = updated[index];
      if (editorInstance && newChapter) {
        editorInstance.commands.setContent(newChapter.content, {
          emitUpdate: false,
        });
      }
    },
    [
      syncCurrentChapter,
      editorInstance,
      setChapters,
      setActiveChapterIndex,
      activeChapterIndexRef,
      viewModeRef,
    ]
  );

  const handleAddChapter = useCallback(async () => {
    await autosave.flush();
    const updated = syncCurrentChapter();
    const insertIndex = activeChapterIndexRef.current + 1;
    const title = nextChapterTitle(updated, activeChapterIndexRef.current);
    const newChapter = blankChapter(title);

    const newChapters = [
      ...updated.slice(0, insertIndex),
      newChapter,
      ...updated.slice(insertIndex),
    ];

    activeChapterIndexRef.current = insertIndex;
    setChapters(newChapters);
    setActiveChapterIndex(insertIndex);

    if (editorInstance) {
      editorInstance.commands.setContent(newChapter.content, {
        emitUpdate: false,
      });
    }
    schedulePersist(newChapters);
  }, [
    autosave,
    syncCurrentChapter,
    editorInstance,
    schedulePersist,
    setChapters,
    setActiveChapterIndex,
    activeChapterIndexRef,
  ]);

  const handleToggleViewMode = useCallback(() => {
    if (viewMode === "chapter") {
      const updated = syncCurrentChapter();
      setChapters(updated);
      const fullDoc = mergeChapters(updated);
      if (editorInstance) {
        editorInstance.commands.setContent(fullDoc, { emitUpdate: false });
      }
      setViewMode("fullBook");
    } else {
      if (editorInstance) {
        const fullDoc = editorInstance.getJSON() as TiptapDoc;
        const reSplit = resplitPreservingIds(fullDoc, chaptersRef.current);
        setChapters(reSplit);
        const idx = Math.min(
          activeChapterIndexRef.current,
          reSplit.length - 1
        );
        activeChapterIndexRef.current = idx;
        setActiveChapterIndex(idx);
        editorInstance.commands.setContent(reSplit[idx].content, {
          emitUpdate: false,
        });
      }
      setViewMode("chapter");
    }
  }, [
    viewMode,
    syncCurrentChapter,
    editorInstance,
    setChapters,
    setActiveChapterIndex,
    setViewMode,
    chaptersRef,
    activeChapterIndexRef,
  ]);

  return { handleChapterSelect, handleAddChapter, handleToggleViewMode };
}
