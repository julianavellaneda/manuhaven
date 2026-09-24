"use client";

import { useState, useCallback, useMemo } from "react";
import { TiptapEditor } from "@/components/editor/TiptapEditor";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { ChapterNav } from "@/components/editor/ChapterNav";
import { EditorTopBar } from "@/components/editor/EditorTopBar";
import { FindReplacePanel } from "@/components/editor/FindReplacePanel";
import { LinkPopover } from "@/components/editor/LinkPopover";
import { DistractionFreeShell } from "@/components/editor/DistractionFreeShell";
import { AssistantRailToggle } from "@/components/editor/AssistantRailToggle";
import { DeleteChapterDialog } from "@/components/editor/DeleteChapterDialog";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import type { StoryBible } from "@/lib/ai/continuity";
import {
  mergeChapters,
  type Chapter,
  type TiptapDoc,
} from "@/lib/manuscript/chapter-utils";
import { useAutosave, type WritingStatsPayload } from "@/lib/editor/use-autosave";
import { useWritingStats } from "@/lib/editor/use-writing-stats";
import { useChapterState } from "@/lib/editor/use-chapter-state";
import { useChapterNavigation } from "@/lib/editor/use-chapter-navigation";
import { useChapterOps } from "@/lib/editor/use-chapter-ops";
import { useFindPanel } from "@/lib/editor/use-find-panel";
import { useEditorPreferences } from "@/lib/editor/use-editor-preferences";

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

export function ManuscriptEditor({
  tiptapJson,
  projectId,
  projectTitle,
  userId,
  initialWritingStats,
  initialStoryBible,
}: ManuscriptEditorProps) {
  const chapterState = useChapterState(tiptapJson);
  const {
    chapters,
    setChapters,
    activeChapterIndex,
    viewMode,
    editorInstance,
    handleEditorReady,
    chaptersRef,
    activeChapterIndexRef,
    syncCurrentChapter,
  } = chapterState;
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [storyBible, setStoryBible] = useState<StoryBible | null>(
    initialStoryBible
  );

  const inconsistencyChapters = useMemo(() => {
    const set = new Set<number>();
    storyBible?.inconsistencies.forEach((inc) => {
      inc.chapters.forEach((c) => set.add(c));
    });
    return set;
  }, [storyBible]);

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

  const { distractionFree, setDistractionFree, rightPanel, setRightPanel } =
    useEditorPreferences(userId);

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
    [stats, autosave, chaptersRef]
  );

  const handleEditorUpdate = useCallback(() => {
    const updated = syncCurrentChapter();
    setChapters(updated);
    schedulePersist(updated);
  }, [syncCurrentChapter, schedulePersist, setChapters]);

  const { handleChapterSelect, handleAddChapter, handleToggleViewMode } =
    useChapterNavigation({ state: chapterState, autosave, schedulePersist });

  const {
    handleReorder,
    handleRename,
    handleSplit,
    handleMergeNext,
    handleDelete,
    deleteConfirm,
    setDeleteConfirm,
  } = useChapterOps({
    state: chapterState,
    autosave,
    schedulePersist,
    handleToggleViewMode,
  });

  const { findPanel, openFindPanel, closeFindPanel } =
    useFindPanel(chapterState);

  const handleToggleDistractionFree = useCallback(() => {
    setDistractionFree((v) => !v);
  }, [setDistractionFree]);

  const shortcuts = useMemo(
    () => ({
      onToggleFind: () => openFindPanel("find"),
      onToggleReplace: () => openFindPanel("replace"),
      onForceSave: () => void autosave.flush(),
      onToggleDistractionFree: handleToggleDistractionFree,
      onOpenLink: () => setLinkPopoverOpen(true),
      onSplitChapter: () => handleSplit(activeChapterIndexRef.current),
    }),
    [
      openFindPanel,
      autosave,
      handleToggleDistractionFree,
      handleSplit,
      activeChapterIndexRef,
    ]
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
          <AssistantRailToggle
            active={rightPanel === "assistant"}
            onToggle={() =>
              setRightPanel((p) => (p === "assistant" ? null : "assistant"))
            }
          />
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

      <DeleteChapterDialog
        chapterTitle={
          deleteConfirm !== null
            ? (chapters[deleteConfirm]?.title ?? "")
            : null
        }
        onDismiss={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm !== null) void handleDelete(deleteConfirm);
        }}
      />
    </>
  );
}
