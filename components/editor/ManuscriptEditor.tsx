"use client";

import { useTranslations } from "next-intl";
import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { TiptapEditor } from "@/components/editor/TiptapEditor";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { ChapterNav } from "@/components/editor/ChapterNav";
import { EditorTopBar } from "@/components/editor/EditorTopBar";
import { FindReplacePanel } from "@/components/editor/FindReplacePanel";
import { LinkPopover } from "@/components/editor/LinkPopover";
import { DistractionFreeShell } from "@/components/editor/DistractionFreeShell";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { Sparkles } from "lucide-react";
import type { StoryBible } from "@/lib/ai/continuity";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  splitIntoChapters,
  mergeChapters,
  countWordsInNodes,
  type Chapter,
  type TiptapDoc,
} from "@/lib/manuscript/chapter-utils";
import {
  renameChapter as renameOp,
  reorderChapters as reorderOp,
  deleteChapter as deleteOp,
  mergeWithNext as mergeOp,
  splitChapterAt as splitOp,
  blankChapter,
  nextChapterTitle,
} from "@/lib/manuscript/chapter-ops";
import { toast } from "sonner";
import { useAutosave, type WritingStatsPayload } from "@/lib/editor/use-autosave";
import { useWritingStats } from "@/lib/editor/use-writing-stats";
import type { Editor } from "@tiptap/react";

type ViewMode = "chapter" | "fullBook";
type RightPanel = "assistant" | null;

interface ManuscriptEditorProps {
  tiptapJson: TiptapDoc | null;
  projectId: string;
  projectTitle: string;
  userId: string;
  initialWritingStats: WritingStatsPayload | null;
  initialStoryBible: StoryBible | null;
}

function countCharactersInNodes(
  nodes: TiptapDoc["content"] | undefined
): number {
  if (!nodes) return 0;
  let count = 0;
  for (const node of nodes) {
    if (node.type === "text" && node.text) count += node.text.length;
    if (node.content) count += countCharactersInNodes(node.content);
  }
  return count;
}

/**
 * Re-split a merged doc into chapters while preserving stable IDs from the
 * previous array by position. Prevents DnD identity loss and sidebar flicker
 * when chapters are recomputed from the editor after every keystroke in
 * full-book view or after a view-mode toggle.
 */
function resplitPreservingIds(
  doc: TiptapDoc,
  prev: Chapter[]
): Chapter[] {
  const fresh = splitIntoChapters(doc);
  return fresh.map((ch, i) => ({
    ...ch,
    id: prev[i]?.id ?? ch.id,
  }));
}

export function ManuscriptEditor({
  tiptapJson,
  projectId,
  projectTitle,
  userId,
  initialWritingStats,
  initialStoryBible,
}: ManuscriptEditorProps) {
  const t = useTranslations("editor.manuscriptEditor");
  const tRail = useTranslations("assistant.rail");
  const [chapters, setChapters] = useState<Chapter[]>(() =>
    splitIntoChapters(tiptapJson)
  );
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("chapter");
  const [distractionFree, setDistractionFree] = useState(false);
  const [findPanel, setFindPanel] = useState<{
    open: boolean;
    mode: "find" | "replace";
    priorViewMode: ViewMode | null;
  }>({ open: false, mode: "find", priorViewMode: null });
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [storyBible, setStoryBible] = useState<StoryBible | null>(
    initialStoryBible
  );
  const [rightPanel, setRightPanel] = useState<RightPanel>("assistant");

  const inconsistencyChapters = useMemo(() => {
    const set = new Set<number>();
    storyBible?.inconsistencies.forEach((inc) => {
      inc.chapters.forEach((c) => set.add(c));
    });
    return set;
  }, [storyBible]);

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

  const totalWordCount = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);

  const mergedDocCharacters = useMemo(
    () => countCharactersInNodes(mergeChapters(chapters).content),
    [chapters]
  );
  const readingMinutes = Math.max(1, Math.round(totalWordCount / 250));

  const stats = useWritingStats({
    initialStats: initialWritingStats,
    currentWordCount: totalWordCount,
  });

  // Restore distraction-free preference from localStorage.
  useEffect(() => {
    try {
      const key = `manuhaven:distraction-free:${userId}`;
      const saved = localStorage.getItem(key);
      // localStorage only exists after hydration, so this can't be initial state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === "true") setDistractionFree(true);
    } catch {
      // ignore
    }
  }, [userId]);

  useEffect(() => {
    try {
      const key = `manuhaven:distraction-free:${userId}`;
      localStorage.setItem(key, distractionFree ? "true" : "false");
    } catch {
      // ignore
    }
  }, [distractionFree, userId]);

  // Restore + persist which right-rail panel is docked.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`manuhaven:right-panel:${userId}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === "assistant") setRightPanel(saved);
      else if (saved === "none") setRightPanel(null);
    } catch {
      // ignore
    }
  }, [userId]);

  useEffect(() => {
    try {
      localStorage.setItem(
        `manuhaven:right-panel:${userId}`,
        rightPanel ?? "none"
      );
    } catch {
      // ignore
    }
  }, [rightPanel, userId]);

  const autosave = useAutosave({ projectId });

  const buildPayload = useCallback(
    (chs: Chapter[]) => {
      const fullDoc = mergeChapters(chs);
      const totalWords = chs.reduce((sum, ch) => sum + ch.wordCount, 0);
      const nextStats = stats.updateTodaySnapshot(totalWords);
      return { tiptapJson: fullDoc, writingStats: nextStats };
    },
    [stats]
  );

  const schedulePersist = useCallback(
    (chs: Chapter[]) => {
      autosave.schedule(buildPayload(chs));
    },
    [autosave, buildPayload]
  );

  const handleGoalChange = useCallback(
    (goal: number) => {
      const chs = chaptersRef.current;
      const totalWords = chs.reduce((sum, ch) => sum + ch.wordCount, 0);
      // Snapshot first: it replaces the whole stats object, so setting the
      // goal before it would be overwritten with the old one.
      const snapshot = stats.updateTodaySnapshot(totalWords);
      stats.setDailyGoal(goal);
      autosave.schedule({
        tiptapJson: mergeChapters(chs),
        writingStats: { ...snapshot, dailyGoal: goal },
      });
    },
    [stats, autosave]
  );

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

  const handleEditorUpdate = useCallback(() => {
    const updated = syncCurrentChapter();
    setChapters(updated);
    schedulePersist(updated);
  }, [syncCurrentChapter, schedulePersist]);

  const handleEditorReady = useCallback((editor: Editor) => {
    setEditorInstance(editor);
  }, []);

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
    [syncCurrentChapter, editorInstance]
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
  }, [autosave, syncCurrentChapter, editorInstance, schedulePersist]);

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
  }, [viewMode, syncCurrentChapter, editorInstance]);

  // --- Chapter ops (reorder, rename, split, merge, delete) ---

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
    [autosave, syncCurrentChapter, editorInstance, schedulePersist]
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
    [autosave, syncCurrentChapter, editorInstance, schedulePersist]
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
    [autosave, syncCurrentChapter, editorInstance, schedulePersist]
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
    [autosave, syncCurrentChapter, editorInstance, schedulePersist]
  );

  // --- Find/Replace orchestration ---

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
    [editorInstance, syncCurrentChapter]
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
  }, [findPanel.priorViewMode, editorInstance]);

  const handleToggleDistractionFree = useCallback(() => {
    setDistractionFree((v) => !v);
  }, []);

  const shortcuts = useMemo(
    () => ({
      onToggleFind: () => openFindPanel("find"),
      onToggleReplace: () => openFindPanel("replace"),
      onForceSave: () => void autosave.flush(),
      onToggleDistractionFree: handleToggleDistractionFree,
      onOpenLink: () => setLinkPopoverOpen(true),
      onSplitChapter: () => handleSplit(activeChapterIndexRef.current),
    }),
    [openFindPanel, autosave, handleToggleDistractionFree, handleSplit]
  );

  const activeChapter = chapters[activeChapterIndex] ?? chapters[0];

  const editorSurface = (
    <div className="flex flex-1 flex-col overflow-hidden">
      {!distractionFree && (
        <EditorTopBar projectId={projectId} projectTitle={projectTitle} />
      )}
      <div className="relative">
        <EditorToolbar
          editor={editorInstance}
          totalWordCount={totalWordCount}
          totalCharacters={mergedDocCharacters}
          readingMinutes={readingMinutes}
          sessionWords={stats.sessionWords}
          todayWords={stats.todayWords}
          dailyGoal={stats.dailyGoal}
          onGoalChange={handleGoalChange}
          saveStatus={autosave.status}
          lastSavedAt={autosave.lastSavedAt}
          viewMode={viewMode}
          onToggleViewMode={handleToggleViewMode}
          onOpenFind={() => openFindPanel("find")}
          onOpenLink={() => setLinkPopoverOpen(true)}
          onToggleDistractionFree={handleToggleDistractionFree}
          distractionFree={distractionFree}
        />
        <LinkPopover
          editor={editorInstance}
          open={linkPopoverOpen}
          onClose={() => setLinkPopoverOpen(false)}
        />
        <FindReplacePanel
          editor={editorInstance}
          open={findPanel.open}
          mode={findPanel.mode}
          onClose={closeFindPanel}
        />
      </div>
      <div className="flex-1 overflow-y-auto bg-card">
        {activeChapter && (
          <TiptapEditor
            initialContent={activeChapter.content}
            onUpdate={handleEditorUpdate}
            onEditorReady={handleEditorReady}
            shortcuts={shortcuts}
            distractionFree={distractionFree}
          />
        )}
      </div>
    </div>
  );

  return (
    <>
      {distractionFree ? (
        <DistractionFreeShell onExit={() => setDistractionFree(false)}>
          {editorSurface}
        </DistractionFreeShell>
      ) : (
        <div className="-m-6 flex h-[calc(100vh-3.5rem)] overflow-hidden">
          <ChapterNav
            chapters={chapters.map((c) => ({
              id: c.id,
              title: c.title,
              wordCount: c.wordCount,
            }))}
            activeChapterIndex={activeChapterIndex}
            onChapterSelect={handleChapterSelect}
            onAddChapter={handleAddChapter}
            onReorder={handleReorder}
            onRename={handleRename}
            onSplit={handleSplit}
            onMergeNext={handleMergeNext}
            onDelete={(index) => {
              if (chapters.length <= 1) return;
              setDeleteConfirm(index);
            }}
            viewMode={viewMode}
            projectTitle={projectTitle}
            inconsistencyChapters={inconsistencyChapters}
          />
          {editorSurface}
          <div className="flex w-10 shrink-0 flex-col items-center gap-1 border-l bg-muted/30 py-3">
            <button
              type="button"
              onClick={() =>
                setRightPanel((p) => (p === "assistant" ? null : "assistant"))
              }
              aria-pressed={rightPanel === "assistant"}
              aria-label={tRail("assistant")}
              title={tRail("assistant")}
              className={`flex size-8 items-center justify-center rounded-md transition-colors ${
                rightPanel === "assistant"
                  ? "bg-accent text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <Sparkles className="size-4" />
            </button>
          </div>
          {rightPanel === "assistant" && (
            <AssistantPanel
              projectId={projectId}
              currentChapterIndex={
                viewMode === "chapter" ? activeChapterIndex + 1 : undefined
              }
              storyBible={storyBible}
              onStoryBibleChange={setStoryBible}
              onJumpToChapter={(chapterNumber) =>
                handleChapterSelect(chapterNumber - 1)
              }
            />
          )}
        </div>
      )}

      <AlertDialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm !== null &&
                t("deleteDialogDescription", { title: chapters[deleteConfirm]?.title ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel />
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm !== null) void handleDelete(deleteConfirm);
              }}
            >
              {t("deleteDialogConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
