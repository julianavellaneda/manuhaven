"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { mergeChapters, type Chapter } from "@/lib/manuscript/chapter-utils";
import {
  renameChapter as renameOp,
  reorderChapters as reorderOp,
  deleteChapter as deleteOp,
  mergeWithNext as mergeOp,
  splitChapterAt as splitOp,
  nextChapterTitle,
} from "@/lib/manuscript/chapter-ops";
import type { useAutosave } from "@/lib/editor/use-autosave";
import type { ChapterState } from "@/lib/editor/use-chapter-state";

interface UseChapterOpsOptions {
  state: ChapterState;
  autosave: ReturnType<typeof useAutosave>;
  schedulePersist: (chs: Chapter[]) => void;
  handleToggleViewMode: () => void;
}

/**
 * Chapter ops (reorder, rename, split, merge, delete) wired to the editor.
 * Also owns the pending delete confirmation.
 */
export function useChapterOps({
  state,
  autosave,
  schedulePersist,
  handleToggleViewMode,
}: UseChapterOpsOptions) {
  const t = useTranslations("editor.manuscriptEditor");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const {
    setChapters,
    setActiveChapterIndex,
    editorInstance,
    activeChapterIndexRef,
    viewModeRef,
    syncCurrentChapter,
  } = state;

  const handleReorder = useCallback(
    async (from: number, to: number) => {
      await autosave.flush();
      const synced = syncCurrentChapter();
      const next = reorderOp(synced, from, to);
      // Keep active chapter following the moved item, or track a swap.
      const active = activeChapterIndexRef.current;
      let newActive = active;
      if (active === from) newActive = to;
      else if (from < active && to >= active) newActive = active - 1;
      else if (from > active && to <= active) newActive = active + 1;
      activeChapterIndexRef.current = newActive;
      setChapters(next);
      setActiveChapterIndex(newActive);
      if (editorInstance && viewModeRef.current === "fullBook") {
        editorInstance.commands.setContent(mergeChapters(next), {
          emitUpdate: false,
        });
      } else if (editorInstance) {
        editorInstance.commands.setContent(next[newActive].content, {
          emitUpdate: false,
        });
      }
      schedulePersist(next);
    },
    [
      autosave,
      syncCurrentChapter,
      editorInstance,
      schedulePersist,
      setChapters,
      setActiveChapterIndex,
      activeChapterIndexRef,
      viewModeRef,
    ]
  );

  const handleRename = useCallback(
    async (index: number, title: string) => {
      await autosave.flush();
      const synced = syncCurrentChapter();
      const next = renameOp(synced, index, title);
      setChapters(next);
      if (editorInstance && index === activeChapterIndexRef.current) {
        editorInstance.commands.setContent(next[index].content, {
          emitUpdate: false,
        });
      }
      schedulePersist(next);
    },
    [
      autosave,
      syncCurrentChapter,
      editorInstance,
      schedulePersist,
      setChapters,
      activeChapterIndexRef,
    ]
  );

  const handleSplit = useCallback(
    async (index: number) => {
      if (!editorInstance) return;
      if (viewModeRef.current === "fullBook") {
        // Splitting needs the active chapter's doc — switch view first.
        handleToggleViewMode();
        return;
      }
      await autosave.flush();
      editorInstance.commands.focus();

      // Compute the split boundary WITHOUT running splitBlock first so we
      // don't leave a trailing empty paragraph (empty-chapter bug) or an
      // empty leading node (whole-chapter-copy bug).
      const $from = editorInstance.state.selection.$from;
      const topIndex = $from.depth === 0 ? 0 : $from.index(0);
      const parentOffset = $from.parentOffset;
      const parentSize = $from.parent.content.size;

      let nodeIndex: number;
      if (parentOffset === 0) {
        // Cursor at start of a top-level node — that node starts the new chapter.
        nodeIndex = topIndex;
      } else if (parentOffset === parentSize) {
        // Cursor at end of a top-level node — new chapter starts at the next one.
        nodeIndex = topIndex + 1;
      } else {
        // Cursor mid-paragraph — split the paragraph in place, then use the
        // post-split cursor position.
        editorInstance.chain().focus().splitBlock().run();
        const $newFrom = editorInstance.state.selection.$from;
        nodeIndex = $newFrom.depth === 0 ? 0 : $newFrom.index(0);
      }

      const postDoc = editorInstance.state.doc;
      if (nodeIndex <= 0 || nodeIndex >= postDoc.childCount) {
        toast.error(t("splitCursorHint"));
        return;
      }

      const synced = syncCurrentChapter();
      const result = splitOp(
        synced,
        index,
        nodeIndex,
        nextChapterTitle(synced, index)
      );
      if (!result) return;

      setChapters(result.chapters);
      const newIdx = result.newActiveIndex;
      activeChapterIndexRef.current = newIdx;
      setActiveChapterIndex(newIdx);
      editorInstance.commands.setContent(result.newChapter.content, {
        emitUpdate: false,
      });
      editorInstance.commands.focus("start");
      schedulePersist(result.chapters);
    },
    [
      autosave,
      syncCurrentChapter,
      editorInstance,
      schedulePersist,
      handleToggleViewMode,
      t,
      setChapters,
      setActiveChapterIndex,
      activeChapterIndexRef,
      viewModeRef,
    ]
  );

  const handleMergeNext = useCallback(
    async (index: number) => {
      await autosave.flush();
      const synced = syncCurrentChapter();
      const next = mergeOp(synced, index);
      if (next === synced) return;
      const active = activeChapterIndexRef.current;
      const newActive =
        active > index ? Math.max(0, active - 1) : Math.min(active, index);
      setChapters(next);
      activeChapterIndexRef.current = newActive;
      setActiveChapterIndex(newActive);
      if (editorInstance) {
        const target =
          viewModeRef.current === "fullBook"
            ? mergeChapters(next)
            : next[newActive].content;
        editorInstance.commands.setContent(target, { emitUpdate: false });
      }
      schedulePersist(next);
    },
    [
      autosave,
      syncCurrentChapter,
      editorInstance,
      schedulePersist,
      setChapters,
      setActiveChapterIndex,
      activeChapterIndexRef,
      viewModeRef,
    ]
  );

  const handleDelete = useCallback(
    async (index: number) => {
      await autosave.flush();
      const synced = syncCurrentChapter();
      const next = deleteOp(synced, index);
      const active = activeChapterIndexRef.current;
      const newActive =
        index <= active ? Math.max(0, active - 1) : active;
      setChapters(next);
      activeChapterIndexRef.current = newActive;
      setActiveChapterIndex(newActive);
      if (editorInstance) {
        const target =
          viewModeRef.current === "fullBook"
            ? mergeChapters(next)
            : next[newActive].content;
        editorInstance.commands.setContent(target, { emitUpdate: false });
      }
      schedulePersist(next);
      setDeleteConfirm(null);
    },
    [
      autosave,
      syncCurrentChapter,
      editorInstance,
      schedulePersist,
      setChapters,
      setActiveChapterIndex,
      activeChapterIndexRef,
      viewModeRef,
    ]
  );

  return {
    handleReorder,
    handleRename,
    handleSplit,
    handleMergeNext,
    handleDelete,
    deleteConfirm,
    setDeleteConfirm,
  };
}
