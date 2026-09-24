"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { capture } from "@/lib/analytics/posthog";
import { readSSEStream } from "@/lib/ai/sse-client";

export interface AssistantToolChip {
  id: string;
  name: string;
  input?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  pending: boolean;
}

export interface AssistantChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  toolCalls: AssistantToolChip[];
  streaming?: boolean;
}

export interface AssistantConversationSummary {
  id: string;
  title: string | null;
  updated_at: string;
}

export type AssistantErrorCode =
  | "generic"
  | "no_ai_key"
  | "rate_limited"
  | "no_manuscript";

const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set([
  "no_ai_key",
  "rate_limited",
  "no_manuscript",
]);

function toErrorCode(code: unknown): AssistantErrorCode {
  return typeof code === "string" && KNOWN_ERROR_CODES.has(code)
    ? (code as AssistantErrorCode)
    : "generic";
}

function bucketTokens(n: number): string {
  if (n < 1_000) return "<1k";
  if (n < 5_000) return "1k-5k";
  if (n < 20_000) return "5k-20k";
  return ">20k";
}

interface PersistedToolCall {
  id?: unknown;
  name?: unknown;
  input?: unknown;
  meta?: unknown;
}

function toToolChips(raw: unknown): AssistantToolChip[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (c): c is PersistedToolCall =>
        !!c && typeof c === "object" && typeof (c as PersistedToolCall).name === "string"
    )
    .map((c, i) => ({
      id: typeof c.id === "string" ? c.id : `tool-${i}`,
      name: c.name as string,
      input: (c.input ?? undefined) as Record<string, unknown> | undefined,
      meta: (c.meta ?? undefined) as Record<string, unknown> | undefined,
      pending: false,
    }));
}

export interface UseAssistantChatOptions {
  projectId: string;
  enabled: boolean;
}

export function useAssistantChat({
  projectId,
  enabled,
}: UseAssistantChatOptions) {
  const locale = useLocale();
  const [conversations, setConversations] = useState<
    AssistantConversationSummary[]
  >([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [status, setStatus] = useState<"loading" | "idle" | "streaming">(
    enabled ? "loading" : "idle"
  );
  const [errorCode, setErrorCode] = useState<AssistantErrorCode | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // Monotonic token: only the most recent conversation load may write state,
  // so switching conversations quickly can't be undone by a slower response.
  const loadSeqRef = useRef(0);

  const loadConversation = useCallback(async (id: string) => {
    const seq = ++loadSeqRef.current;
    const res = await fetch(`/api/ai/assistant/conversations/${id}`);
    if (!res.ok) throw new Error("load failed");
    const body = (await res.json()) as {
      messages: Array<{
        id: string;
        role: "user" | "assistant";
        text: string;
        toolCalls: unknown;
      }>;
    };
    if (seq !== loadSeqRef.current) return;
    setConversationId(id);
    setMessages(
      body.messages.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        toolCalls: toToolChips(m.toolCalls),
      }))
    );
  }, []);

  // Initial load: latest conversation for this project, if any.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/ai/assistant/conversations?projectId=${projectId}`
        );
        if (!res.ok) throw new Error("list failed");
        const body = (await res.json()) as {
          conversations: AssistantConversationSummary[];
        };
        if (cancelled) return;
        setConversations(body.conversations);
        if (body.conversations.length > 0) {
          await loadConversation(body.conversations[0].id);
        }
      } catch {
        // A fresh panel with no history is an acceptable fallback.
      } finally {
        if (!cancelled) setStatus("idle");
      }
    })();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [enabled, projectId, loadConversation]);

  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/ai/assistant/conversations?projectId=${projectId}`
      );
      if (!res.ok) return;
      const body = (await res.json()) as {
        conversations: AssistantConversationSummary[];
      };
      setConversations(body.conversations);
    } catch {
      // ignore
    }
  }, [projectId]);

  const send = useCallback(
    async (text: string, chapterIndex?: number) => {
      const trimmed = text.trim();
      if (!trimmed || status === "streaming") return;
      setErrorCode(null);
      setStatus("streaming");

      const userMessage: AssistantChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text: trimmed,
        toolCalls: [],
      };
      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        userMessage,
        {
          id: assistantId,
          role: "assistant",
          text: "",
          toolCalls: [],
          streaming: true,
        },
      ]);

      const patchAssistant = (
        patch: (msg: AssistantChatMessage) => AssistantChatMessage
      ) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? patch(m) : m))
        );
      };
      const dropEmptyAssistant = () => {
        setMessages((prev) =>
          prev.filter((m) => !(m.id === assistantId && m.text === ""))
        );
      };

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/ai/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            conversationId: conversationIdRef.current ?? undefined,
            message: trimmed,
            locale,
            context: chapterIndex ? { chapterIndex } : undefined,
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => null);
          setErrorCode(toErrorCode(body?.code));
          dropEmptyAssistant();
          return;
        }

        await readSSEStream(res.body, (event, data) => {
          const d = (data ?? {}) as Record<string, unknown>;
          switch (event) {
            case "meta": {
              if (typeof d.conversationId === "string") {
                setConversationId(d.conversationId);
              }
              break;
            }
            case "text_delta": {
              if (typeof d.text === "string") {
                patchAssistant((m) => ({ ...m, text: m.text + d.text }));
              }
              break;
            }
            case "tool_call": {
              patchAssistant((m) => ({
                ...m,
                toolCalls: [
                  ...m.toolCalls,
                  {
                    id: String(d.id ?? crypto.randomUUID()),
                    name: String(d.name ?? ""),
                    input: (d.input ?? undefined) as
                      | Record<string, unknown>
                      | undefined,
                    pending: true,
                  },
                ],
              }));
              break;
            }
            case "tool_result": {
              patchAssistant((m) => ({
                ...m,
                toolCalls: m.toolCalls.map((c) =>
                  c.id === d.id
                    ? {
                        ...c,
                        meta: (d.meta ?? undefined) as
                          | Record<string, unknown>
                          | undefined,
                        pending: false,
                      }
                    : c
                ),
              }));
              break;
            }
            case "done": {
              patchAssistant((m) => ({ ...m, streaming: false }));
              const usage = (d.usage ?? {}) as Record<string, unknown>;
              capture("assistant_chat_message", {
                mode: "editorial",
                input_tokens_bucket: bucketTokens(
                  typeof usage.inputTokens === "number" ? usage.inputTokens : 0
                ),
                output_tokens_bucket: bucketTokens(
                  typeof usage.outputTokens === "number"
                    ? usage.outputTokens
                    : 0
                ),
              });
              break;
            }
            case "error": {
              setErrorCode(toErrorCode(d.code));
              patchAssistant((m) => ({ ...m, streaming: false }));
              dropEmptyAssistant();
              break;
            }
          }
        });
        void refreshConversations();
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setErrorCode("generic");
        }
        dropEmptyAssistant();
      } finally {
        setMessages((prev) =>
          prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
        );
        setStatus("idle");
        abortRef.current = null;
      }
    },
    [projectId, locale, status, refreshConversations]
  );

  const newConversation = useCallback(() => {
    if (status === "streaming") return;
    // Invalidate any in-flight load so it can't repopulate the blank panel.
    loadSeqRef.current += 1;
    setConversationId(null);
    setMessages([]);
    setErrorCode(null);
  }, [status]);

  const clearError = useCallback(() => setErrorCode(null), []);

  const selectConversation = useCallback(
    async (id: string) => {
      if (status === "streaming" || id === conversationIdRef.current) return;
      setErrorCode(null);
      try {
        await loadConversation(id);
      } catch {
        setErrorCode("generic");
      }
    },
    [status, loadConversation]
  );

  return {
    conversations,
    conversationId,
    messages,
    status,
    errorCode,
    send,
    newConversation,
    selectConversation,
    clearError,
  };
}
