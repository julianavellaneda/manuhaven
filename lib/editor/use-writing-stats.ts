"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WritingStatsPayload } from "@/lib/editor/use-autosave";

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function prune(stats: WritingStatsPayload, keepDays = 365): WritingStatsPayload {
  const cutoffMs = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  const pruned: WritingStatsPayload["sessions"] = {};
  for (const [day, entry] of Object.entries(stats.sessions)) {
    const t = Date.parse(day);
    if (!Number.isNaN(t) && t >= cutoffMs) pruned[day] = entry;
  }
  return { ...stats, sessions: pruned };
}

export interface UseWritingStatsOptions {
  initialStats: WritingStatsPayload | null;
  currentWordCount: number;
}

export interface WritingStatsView {
  stats: WritingStatsPayload;
  sessionWords: number;
  todayWords: number;
  dailyGoal: number;
  setDailyGoal: (goal: number) => void;
  updateTodaySnapshot: (totalWords: number) => WritingStatsPayload;
}

/**
 * Tracks writing session progress and daily rollups. Session words =
 * current total - starting total (captured on mount). Today's entry is
 * updated in place so autosave picks it up on its next flush.
 */
export function useWritingStats({
  initialStats,
  currentWordCount,
}: UseWritingStatsOptions): WritingStatsView {
  const [stats, setStats] = useState<WritingStatsPayload>(
    () =>
      initialStats ?? {
        sessions: {},
        dailyGoal: 500,
      }
  );

  // The day being tracked, the word count this session started from, and the
  // words already logged for that day before this session began.
  const [day, setDay] = useState(() => {
    const key = isoDay(new Date());
    return {
      key,
      startWords: currentWordCount,
      baseline: initialStats?.sessions[key]?.words ?? 0,
    };
  });
  const sessionStartTsRef = useRef<number | null>(null);

  useEffect(() => {
    sessionStartTsRef.current ??= Date.now();
  }, []);

  const sessionWords = Math.max(0, currentWordCount - day.startWords);
  const todayWords = day.baseline + sessionWords;

  const updateTodaySnapshot = useCallback(
    (totalWords: number): WritingStatsPayload => {
      const session = Math.max(0, totalWords - day.startWords);
      const today = isoDay(new Date());
      const startTs = sessionStartTsRef.current ?? Date.now();
      const nextSessions = {
        ...stats.sessions,
        [today]: {
          words: day.baseline + session,
          seconds:
            (stats.sessions[today]?.seconds ?? 0) +
            Math.round((Date.now() - startTs) / 1000),
        },
      };
      sessionStartTsRef.current = Date.now();
      const next = prune({ ...stats, sessions: nextSessions });
      setStats(next);
      return next;
    },
    [stats, day]
  );

  const setDailyGoal = useCallback((goal: number) => {
    setStats((prev) => ({ ...prev, dailyGoal: Math.max(1, Math.floor(goal)) }));
  }, []);

  // Expose a derived view; callers read sessionWords/todayWords live.
  const view = useMemo(
    () => ({
      stats,
      sessionWords,
      todayWords,
      dailyGoal: stats.dailyGoal,
      setDailyGoal,
      updateTodaySnapshot,
    }),
    [stats, sessionWords, todayWords, setDailyGoal, updateTodaySnapshot]
  );

  // If the day rolls over mid-session, re-baseline so today's words don't
  // include yesterday's writing.
  useEffect(() => {
    const check = setInterval(() => {
      const newToday = isoDay(new Date());
      if (newToday !== day.key) {
        setDay({
          key: newToday,
          startWords: currentWordCount,
          baseline: stats.sessions[newToday]?.words ?? 0,
        });
      }
    }, 60_000);
    return () => clearInterval(check);
  }, [day.key, currentWordCount, stats.sessions]);

  return view;
}
