"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Minus,
  List,
  ListOrdered,
  Quote,
  Link2,
  Search,
  BarChart3,
  Focus,
  Undo2,
  Redo2,
  BookOpen,
  FileText,
} from "lucide-react";
import type { Editor } from "@tiptap/react";
import { useRelativeTime } from "@/lib/editor/use-relative-time";
import type { SaveStatus } from "@/lib/editor/use-autosave";
import { WritingStatsPanel } from "@/components/editor/WritingStatsPanel";

type ViewMode = "chapter" | "fullBook";

interface EditorToolbarProps {
  editor: Editor | null;
  totalWordCount: number;
  totalCharacters: number;
  readingMinutes: number;
  sessionWords: number;
  todayWords: number;
  dailyGoal: number;
  onGoalChange: (goal: number) => void;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  viewMode: ViewMode;
  onToggleViewMode: () => void;
  onOpenFind: () => void;
  onOpenLink: () => void;
  onToggleDistractionFree: () => void;
  distractionFree: boolean;
}

interface ToolbarAction {
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  shortcut?: string;
  action: (editor: Editor) => void;
  isActive?: (editor: Editor) => boolean;
}

const marks: ToolbarAction[] = [
  {
    icon: Bold,
    labelKey: "toolbar.bold",
    shortcut: "⌘B",
    action: (ed) => ed.chain().focus().toggleBold().run(),
    isActive: (ed) => ed.isActive("bold"),
  },
  {
    icon: Italic,
    labelKey: "toolbar.italic",
    shortcut: "⌘I",
    action: (ed) => ed.chain().focus().toggleItalic().run(),
    isActive: (ed) => ed.isActive("italic"),
  },
  {
    icon: Underline,
    labelKey: "toolbar.underline",
    shortcut: "⌘U",
    action: (ed) => ed.chain().focus().toggleUnderline().run(),
    isActive: (ed) => ed.isActive("underline"),
  },
  {
    icon: Strikethrough,
    labelKey: "toolbar.strikethrough",
    shortcut: "⌘⇧X",
    action: (ed) => ed.chain().focus().toggleStrike().run(),
    isActive: (ed) => ed.isActive("strike"),
  },
  {
    icon: Code,
    labelKey: "toolbar.inlineCode",
    shortcut: "⌘E",
    action: (ed) => ed.chain().focus().toggleCode().run(),
    isActive: (ed) => ed.isActive("code"),
  },
];

const headings: ToolbarAction[] = [
  {
    icon: Heading1,
    labelKey: "toolbar.heading1",
    shortcut: "⌘⌥1",
    action: (ed) => ed.chain().focus().toggleHeading({ level: 1 }).run(),
    isActive: (ed) => ed.isActive("heading", { level: 1 }),
  },
  {
    icon: Heading2,
    labelKey: "toolbar.heading2",
    shortcut: "⌘⌥2",
    action: (ed) => ed.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (ed) => ed.isActive("heading", { level: 2 }),
  },
  {
    icon: Heading3,
    labelKey: "toolbar.heading3",
    shortcut: "⌘⌥3",
    action: (ed) => ed.chain().focus().toggleHeading({ level: 3 }).run(),
    isActive: (ed) => ed.isActive("heading", { level: 3 }),
  },
];

const blocks: ToolbarAction[] = [
  {
    icon: List,
    labelKey: "toolbar.bulletList",
    shortcut: "⌘⇧8",
    action: (ed) => ed.chain().focus().toggleBulletList().run(),
    isActive: (ed) => ed.isActive("bulletList"),
  },
  {
    icon: ListOrdered,
    labelKey: "toolbar.numberedList",
    shortcut: "⌘⇧7",
    action: (ed) => ed.chain().focus().toggleOrderedList().run(),
    isActive: (ed) => ed.isActive("orderedList"),
  },
  {
    icon: Quote,
    labelKey: "toolbar.blockquote",
    shortcut: "⌘⇧B",
    action: (ed) => ed.chain().focus().toggleBlockquote().run(),
    isActive: (ed) => ed.isActive("blockquote"),
  },
  {
    icon: Minus,
    labelKey: "toolbar.sceneBreak",
    action: (ed) => ed.chain().focus().setHorizontalRule().run(),
  },
];

const historyActions: ToolbarAction[] = [
  {
    icon: Undo2,
    labelKey: "toolbar.undo",
    shortcut: "⌘Z",
    action: (ed) => ed.chain().focus().undo().run(),
  },
  {
    icon: Redo2,
    labelKey: "toolbar.redo",
    shortcut: "⌘⇧Z",
    action: (ed) => ed.chain().focus().redo().run(),
  },
];

const statusColors: Record<SaveStatus, string> = {
  saved: "text-green-600",
  saving: "text-amber-600",
  unsaved: "text-muted-foreground",
  error: "text-destructive",
};

function ToolbarButton({
  action,
  editor,
  label,
}: {
  action: ToolbarAction;
  editor: Editor | null;
  label: string;
}) {
  const Icon = action.icon;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!editor}
            onClick={() => editor && action.action(editor)}
            className={cn(
              editor && action.isActive?.(editor) && "bg-muted text-foreground"
            )}
          />
        }
      >
        <Icon className="size-4" />
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {action.shortcut && (
          <span className="ml-1.5 text-[0.65rem] opacity-60">
            {action.shortcut}
          </span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export function EditorToolbar({
  editor,
  totalWordCount,
  totalCharacters,
  readingMinutes,
  sessionWords,
  todayWords,
  dailyGoal,
  onGoalChange,
  saveStatus,
  lastSavedAt,
  viewMode,
  onToggleViewMode,
  onOpenFind,
  onOpenLink,
  onToggleDistractionFree,
  distractionFree,
}: EditorToolbarProps) {
  const t = useTranslations("editor");
  const savedAgo = useRelativeTime(lastSavedAt);

  const statusLabels: Record<SaveStatus, string> = {
    saved: t("toolbar.statusSaved"),
    saving: t("toolbar.statusSaving"),
    unsaved: t("toolbar.statusUnsaved"),
    error: t("toolbar.statusError"),
  };

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 bg-white/70 px-4 py-1.5 backdrop-blur-[16px]">
      <TooltipProvider>
        <div className="flex items-center gap-0.5">
          {marks.map((action) => (
            <ToolbarButton
              key={action.labelKey}
              action={action}
              editor={editor}
              label={t(action.labelKey as Parameters<typeof t>[0])}
            />
          ))}
        </div>

        <div className="mx-1 h-5 w-px bg-muted" />

        <div className="flex items-center gap-0.5">
          {headings.map((action) => (
            <ToolbarButton
              key={action.labelKey}
              action={action}
              editor={editor}
              label={t(action.labelKey as Parameters<typeof t>[0])}
            />
          ))}
        </div>

        <div className="mx-1 h-5 w-px bg-muted" />

        <div className="flex items-center gap-0.5">
          {blocks.map((action) => (
            <ToolbarButton
              key={action.labelKey}
              action={action}
              editor={editor}
              label={t(action.labelKey as Parameters<typeof t>[0])}
            />
          ))}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={!editor}
                  onClick={onOpenLink}
                  className={cn(
                    editor?.isActive("link") && "bg-muted text-foreground"
                  )}
                />
              }
            >
              <Link2 className="size-4" />
            </TooltipTrigger>
            <TooltipContent>
              {t("toolbar.link")}
              <span className="ml-1.5 text-[0.65rem] opacity-60">⌘K</span>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="mx-1 h-5 w-px bg-muted" />

        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={!editor}
                  onClick={onOpenFind}
                />
              }
            >
              <Search className="size-4" />
            </TooltipTrigger>
            <TooltipContent>
              {t("toolbar.findReplace")}
              <span className="ml-1.5 text-[0.65rem] opacity-60">⌘F</span>
            </TooltipContent>
          </Tooltip>

          <WritingStatsPanel
            totalWords={totalWordCount}
            totalCharacters={totalCharacters}
            readingMinutes={readingMinutes}
            sessionWords={sessionWords}
            todayWords={todayWords}
            dailyGoal={dailyGoal}
            onGoalChange={onGoalChange}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={t("toolbar.writingStats")}>
                <BarChart3 className="size-4" />
              </Button>
            }
          />

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onToggleDistractionFree}
                  className={cn(
                    distractionFree && "bg-muted text-foreground"
                  )}
                />
              }
            >
              <Focus className="size-4" />
            </TooltipTrigger>
            <TooltipContent>
              {t("toolbar.distractionFree")}
              <span className="ml-1.5 text-[0.65rem] opacity-60">⌘⇧D</span>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="mx-1 h-5 w-px bg-muted" />

        <div className="flex items-center gap-0.5">
          {historyActions.map((action) => (
            <ToolbarButton
              key={action.labelKey}
              action={action}
              editor={editor}
              label={t(action.labelKey as Parameters<typeof t>[0])}
            />
          ))}
        </div>
      </TooltipProvider>

      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={onToggleViewMode}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            viewMode === "fullBook"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {viewMode === "fullBook" ? (
            <>
              <BookOpen className="size-3.5" />
              {t("toolbar.fullBook")}
            </>
          ) : (
            <>
              <FileText className="size-3.5" />
              {t("toolbar.chapters")}
            </>
          )}
        </button>

        <div className="h-4 w-px bg-muted" />

        <span
          className={cn("text-xs font-medium", statusColors[saveStatus])}
          title={
            lastSavedAt
              ? t("toolbar.lastSavedTitle", { time: lastSavedAt.toLocaleTimeString() })
              : ""
          }
        >
          {saveStatus === "saved" && savedAgo
            ? t("toolbar.savedAgo", { ago: savedAgo })
            : statusLabels[saveStatus]}
        </span>
        <span className="text-xs text-muted-foreground">
          {t("toolbar.wordCount", { count: totalWordCount.toLocaleString() })}
        </span>
      </div>
    </div>
  );
}
