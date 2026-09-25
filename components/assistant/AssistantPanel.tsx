"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  BookMarked,
  History,
  Send,
  Sparkles,
  SquarePen,
  X,
} from "lucide-react";
import { CodexTab } from "@/components/assistant/CodexTab";
import { NoAiKeyNotice } from "@/components/ai/NoAiKeyNotice";
import type { StoryBible } from "@/lib/ai/continuity";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useAssistantChat,
  type AssistantChatMessage,
  type AssistantToolChip,
} from "@/components/assistant/use-assistant-chat";

const MESSAGE_MAX_LENGTH = 4_000;

interface Props {
  projectId: string;
  currentChapterIndex?: number;
  storyBible: StoryBible | null;
  onStoryBibleChange?: (sb: StoryBible) => void;
  onJumpToChapter?: (chapterNumber: number) => void;
}

export function AssistantPanel({
  projectId,
  currentChapterIndex,
  storyBible,
  onStoryBibleChange,
  onJumpToChapter,
}: Props) {
  const t = useTranslations("assistant");
  const [tab, setTab] = useState<"chat" | "codex">("chat");
  const chat = useAssistantChat({ projectId, enabled: true });
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  // Streaming appends a token at a time; following the tail is only welcome
  // while the reader is already at the tail.
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    const viewport = scrollRootRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    );
    if (!viewport) return;
    const onScroll = () => {
      const distanceFromBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      stickToBottomRef.current = distanceFromBottom < 48;
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [chat.messages]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || chat.status !== "idle") return;
    setDraft("");
    stickToBottomRef.current = true;
    void chat.send(text, currentChapterIndex);
  };

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l bg-muted/30">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider">
            {t("brandName")}
          </span>
        </div>
        <div className="flex items-center gap-1">
            {tab === "chat" && chat.conversations.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  aria-label={t("panel.conversations")}
                  title={t("panel.conversations")}
                >
                  <History className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    {t("panel.conversations")}
                  </DropdownMenuLabel>
                  {chat.conversations.map((c) => (
                    <DropdownMenuItem
                      key={c.id}
                      onClick={() => void chat.selectConversation(c.id)}
                      className={cn(
                        c.id === chat.conversationId && "bg-accent"
                      )}
                    >
                      <span className="truncate">
                        {c.title ?? t("panel.untitled")}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {tab === "chat" && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={chat.newConversation}
                disabled={chat.status === "streaming"}
                aria-label={t("panel.newConversation")}
                title={t("panel.newConversation")}
              >
                <SquarePen className="size-4" />
              </Button>
            )}
        </div>
      </div>

      <div className="flex shrink-0 border-b px-2 pt-1" role="tablist">
        {(["chat", "codex"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-medium transition-colors",
              tab === id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {id === "chat" ? (
              <Sparkles className="size-3.5" />
            ) : (
              <BookMarked className="size-3.5" />
            )}
            {t(id === "chat" ? "codex.tabChat" : "codex.tabCodex")}
          </button>
        ))}
      </div>

      {tab === "codex" ? (
        <CodexTab
          projectId={projectId}
          storyBible={storyBible}
          onStoryBibleChange={onStoryBibleChange}
          onJumpToChapter={onJumpToChapter}
        />
      ) : (
      <>

          <ScrollArea ref={scrollRootRef} className="flex-1">
            <div className="space-y-3 p-3">
              {chat.messages.length === 0 && chat.status !== "loading" && (
                <div className="rounded border bg-background p-3">
                  <p className="text-xs font-medium">
                    {t("panel.greetingTitle")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("panel.greetingBody")}
                  </p>
                </div>
              )}
              {chat.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              <div ref={endRef} />
            </div>
          </ScrollArea>

          {chat.errorCode === "no_ai_key" && (
            <NoAiKeyNotice
              title={t("noKey.title")}
              body={t("noKey.body")}
              cta={t("noKey.cta")}
            />
          )}

          {chat.errorCode && chat.errorCode !== "no_ai_key" && (
            <div className="mx-3 mb-2 flex items-start gap-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              <span className="flex-1">{t(`errors.${chat.errorCode}`)}</span>
              <button
                type="button"
                onClick={chat.clearError}
                aria-label={t("panel.dismissError")}
                className="shrink-0 rounded p-0.5 hover:bg-destructive/15"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          <div className="border-t p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={2}
                maxLength={MESSAGE_MAX_LENGTH}
                placeholder={t("panel.placeholder")}
                aria-label={t("panel.placeholder")}
                disabled={chat.status !== "idle"}
                className="max-h-32 min-h-14 flex-1 resize-none rounded-md bg-background p-2 text-xs shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              />
              <Button
                size="icon"
                className="size-8 shrink-0"
                onClick={handleSend}
                disabled={chat.status !== "idle" || draft.trim().length === 0}
                aria-label={t("panel.send")}
                title={t("panel.send")}
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
      </>
      )}
    </aside>
  );
}

function MessageBubble({ message }: { message: AssistantChatMessage }) {
  const t = useTranslations("assistant");
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "rounded p-2 text-xs",
        isUser
          ? "ml-6 bg-primary text-primary-foreground"
          : "mr-2 border bg-background"
      )}
    >
      {message.toolCalls.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {message.toolCalls.map((chip) => (
            <ToolChip key={chip.id} chip={chip} />
          ))}
        </div>
      )}
      {message.text ? (
        <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
      ) : message.streaming ? (
        <p
          className="text-muted-foreground motion-safe:animate-pulse"
          aria-live="polite"
        >
          {t("panel.thinking")}
        </p>
      ) : null}
    </div>
  );
}

function ToolChip({ chip }: { chip: AssistantToolChip }) {
  const t = useTranslations("assistant.tools");
  const label =
    chip.name === "read_chapter"
      ? t("read_chapter", {
          index: Number(chip.input?.chapter_index ?? 0) || "?",
        })
      : chip.name === "query_codex"
        ? t("query_codex")
        : chip.name;
  const Icon = chip.name === "query_codex" ? BookMarked : BookOpen;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.65rem] text-muted-foreground",
        chip.pending && "motion-safe:animate-pulse"
      )}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}

