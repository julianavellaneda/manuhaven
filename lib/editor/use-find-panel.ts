"use client";

import { useCallback, useState } from "react";
import { mergeChapters, type TiptapDoc } from "@/lib/manuscript/chapter-utils";
import {
  resplitPreservingIds,
  type ChapterState,
  type ViewMode,
} from "@/lib/editor/use-chapter-state";

/**
 * Find/Replace orchestration. Opening from chapter view switches to full
 * book so search covers every chapter; closing restores chapter view.
 */
export function useFindPanel(state: ChapterState) {
  const [findPanel, setFindPanel] = useState<{
    open: boolean;
    mode: "find" | "replace";
    priorViewMode: ViewMode | null;
  }>({ open: false, mode: "find", priorViewMode: null });
  const {
    setChapters,
    setActiveChapterIndex,
    setViewMode,
    editorInstance,
    chaptersRef,
    activeChapterIndexRef,
    viewModeRef,
    syncCurrentChapter,
  } = state;

  const openFindPanel = useCallback(
    (mode: "find" | "replace") => {
      if (viewModeRef.current === "chapter") {
        // Flush current state, switch to full book so search covers all chapters.
        const synced = syncCurrentChapter();
        setChapters(synced);
        const fullDoc = mergeChapters(synced);
        if (editorInstance) {
          editorInstance.commands.setContent(fullDoc, { emitUpdate: false });
        }
        setViewMode("fullBook");
        setFindPanel({ open: true, mode, priorViewMode: "chapter" });
      } else {
        setFindPanel({ open: true, mode, priorViewMode: null });
      }
    },
    [editorInstance, syncCurrentChapter, setChapters, setViewMode, viewModeRef]
  );

  const closeFindPanel = useCallback(() => {
    const prior = findPanel.priorViewMode;
    setFindPanel({ open: false, mode: "find", priorViewMode: null });
    if (prior === "chapter") {
      // Restore chapter view.
      if (editorInstance) {
        const fullDoc = editorInstance.getJSON() as TiptapDoc;
        const reSplit = resplitPreservingIds(fullDoc, chaptersRef.current);
        const idx = Math.min(
          activeChapterIndexRef.current,
          reSplit.length - 1
        );
        setChapters(reSplit);
        activeChapterIndexRef.current = idx;
        setActiveChapterIndex(idx);
        editorInstance.commands.setContent(reSplit[idx].content, {
          emitUpdate: false,
        });
      }
      setViewMode("chapter");
    }
  }, [
    findPanel.priorViewMode,
    editorInstance,
    setChapters,
    setActiveChapterIndex,
    setViewMode,
    chaptersRef,
    activeChapterIndexRef,
  ]);

  return { findPanel, openFindPanel, closeFindPanel };
}
