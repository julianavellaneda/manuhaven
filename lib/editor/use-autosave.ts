"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { TiptapDoc } from "@/lib/manuscript/chapter-utils";

export type SaveStatus = "saved" | "saving" | "unsaved" | "error";

export interface WritingStatsPayload {
  sessions: Record<string, { words: number; seconds: number }>;
  dailyGoal: number;
}

export interface AutosavePayload {
  tiptapJson: TiptapDoc;
  writingStats?: WritingStatsPayload;
}

interface UseAutosaveOptions {
  projectId: string;
  debounceMs?: number;
  hardFlushMs?: number;
  maxAttempts?: number;
}

const BACKOFF_MS = [1_000, 3_000, 8_000, 20_000];

async function postSave(
  projectId: string,
  payload: AutosavePayload,
  signal?: AbortSignal
) {
  const res = await fetch(`/api/manuscripts/${projectId}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Save failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<{ ok: boolean; savedAt: string }>;
}

export function useAutosave({
  projectId,
  debounceMs = 1_500,
  hardFlushMs = 30_000,
  maxAttempts = 4,
}: UseAutosaveOptions) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const pendingPayloadRef = useRef<AutosavePayload | null>(null);
  const inFlightRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardFlushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptRef = useRef(0);
  const statusRef = useRef<SaveStatus>("saved");
  const runSaveRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const runSave = useCallback(async () => {
    if (inFlightRef.current) return;
    const payload = pendingPayloadRef.current;
    if (!payload) return;

    inFlightRef.current = true;
    pendingPayloadRef.current = null;
    setStatus("saving");

    try {
      const res = await postSave(projectId, payload);
      attemptRef.current = 0;
      setLastSavedAt(new Date(res.savedAt));
      inFlightRef.current = false;
      if (pendingPayloadRef.current) {
        setStatus("unsaved");
        void runSaveRef.current();
      } else {
        setStatus("saved");
      }
    } catch {
      inFlightRef.current = false;
      attemptRef.current += 1;
      if (attemptRef.current >= maxAttempts) {
        setStatus("error");
        toast.error("Unable to save changes", {
          description: "We'll keep trying in the background.",
        });
        pendingPayloadRef.current = payload;
        setTimeout(() => {
          attemptRef.current = 0;
          void runSaveRef.current();
        }, 30_000);
        return;
      }
      setStatus("unsaved");
      pendingPayloadRef.current = payload;
      const delay =
        BACKOFF_MS[Math.min(attemptRef.current - 1, BACKOFF_MS.length - 1)];
      setTimeout(() => void runSaveRef.current(), delay);
    }
  }, [projectId, maxAttempts]);

  useEffect(() => {
    runSaveRef.current = runSave;
  }, [runSave]);

  const schedule = useCallback(
    (payload: AutosavePayload) => {
      pendingPayloadRef.current = payload;
      setStatus("unsaved");
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        void runSave();
      }, debounceMs);
    },
    [debounceMs, runSave]
  );

  const flush = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (!pendingPayloadRef.current && !inFlightRef.current) return;
    // Wait for in-flight to settle, then run any pending.
    while (inFlightRef.current) {
      await new Promise((r) => setTimeout(r, 50));
    }
    if (pendingPayloadRef.current) await runSave();
  }, [runSave]);

  // Hard flush every N seconds to guarantee at-least-this-often saves.
  useEffect(() => {
    hardFlushTimerRef.current = setInterval(() => {
      if (pendingPayloadRef.current) void runSave();
    }, hardFlushMs);
    return () => {
      if (hardFlushTimerRef.current) clearInterval(hardFlushTimerRef.current);
    };
  }, [hardFlushMs, runSave]);

  // visibilitychange + beforeunload: last-ditch flush via sendBeacon.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && pendingPayloadRef.current) {
        const payload = pendingPayloadRef.current;
        if (typeof navigator.sendBeacon === "function") {
          const blob = new Blob([JSON.stringify(payload)], {
            type: "application/json",
          });
          const queued = navigator.sendBeacon(
            `/api/manuscripts/${projectId}/save`,
            blob
          );
          if (queued) {
            pendingPayloadRef.current = null;
          }
        } else {
          void runSave();
        }
      }
    };
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (
        statusRef.current !== "saved" ||
        pendingPayloadRef.current ||
        inFlightRef.current
      ) {
        if (pendingPayloadRef.current && typeof navigator.sendBeacon === "function") {
          const blob = new Blob([JSON.stringify(pendingPayloadRef.current)], {
            type: "application/json",
          });
          const queued = navigator.sendBeacon(
            `/api/manuscripts/${projectId}/save`,
            blob
          );
          if (queued) {
            pendingPayloadRef.current = null;
          }
        }
        e.preventDefault();
        e.returnValue = "";
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [projectId, runSave]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  return { status, lastSavedAt, schedule, flush };
}
