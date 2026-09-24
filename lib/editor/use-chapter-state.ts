"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  splitIntoChapters,
  countWordsInNodes,
  type Chapter,
  type TiptapDoc,
} from "@/lib/manuscript/chapter-utils";

export type ViewMode = "chapter" | "fullBook";

/**
 * Re-split a merged doc into chapters while preserving stable IDs from the
 * previous array by position. Prevents DnD identity loss and sidebar flicker
 * when chapters are recomputed from the editor after every keystroke in
 * full-book view or after a view-mode toggle.
 */
export function resplitPreservingIds(
  doc: TiptapDoc,
  prev: Chapter[]
): Chapter[] {
  const fresh = splitIntoChapters(doc);
  return fresh.map((ch, i) => ({
    ...ch,
    id: prev[i]?.id ?? ch.id,
  }));
}

/**
 * Chapter array, active chapter, view mode and the Tiptap instance, plus
 * refs mirroring them so async handlers always read the latest values.
 * `syncCurrentChapter` folds the editor's current doc back into the array.
 */
export function useChapterState(tiptapJson: TiptapDoc | null) {
  const [chapters, setChapters] = useState<Chapter[]>(() =>
    splitIntoChapters(tiptapJson)
  );
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("chapter");

  const chaptersRef = useRef(chapters);
  const activeChapterIndexRef = useRef(activeChapterIndex);
  const viewModeRef = useRef(viewMode);

  useEffect(() => {
    chaptersRef.current = chapters;
  }, [chapters]);
  useEffect(() => {
    activeChapterIndexRef.current = activeChapterIndex;
  }, [activeChapterIndex]);
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  const syncCurrentChapter = useCallback((): Chapter[] => {
    const current = chaptersRef.current;
    const idx = activeChapterIndexRef.current;
    if (!editorInstance) return current;

    const json = editorInstance.getJSON() as TiptapDoc;

    if (viewModeRef.current === "fullBook") {
      // In full book mode the editor holds all chapters.
      return resplitPreservingIds(json, current);
    }

    const active = current[idx];
    if (!active) return current;

    let title = active.title;
    const firstNode = json.content?.[0];
    if (
      firstNode?.type === "heading" &&
      (firstNode.attrs?.level === 1 || firstNode.attrs?.level === undefined) &&
      firstNode.content
    ) {
      const text = firstNode.content.map((n) => n.text ?? "").join("");
      if (text.trim()) title = text.trim();
    }

    return current.map((ch, i) =>
      i === idx
        ? {
            ...ch,
            title,
            content: json,
            wordCount: countWordsInNodes(json.content ?? []),
          }
        : ch
    );
  }, [editorInstance]);

  const handleEditorReady = useCallback((editor: Editor) => {
    setEditorInstance(editor);
  }, []);

  return {
    chapters,
    setChapters,
    activeChapterIndex,
    setActiveChapterIndex,
    viewMode,
    setViewMode,
    editorInstance,
    handleEditorReady,
    chaptersRef,
    activeChapterIndexRef,
    viewModeRef,
    syncCurrentChapter,
  };
}

export type ChapterState = ReturnType<typeof useChapterState>;
