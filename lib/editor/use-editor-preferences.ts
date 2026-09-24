"use client";

import { useEffect, useState } from "react";

export type RightPanel = "assistant" | null;

/**
 * Per-user editor layout preferences (distraction-free mode, docked
 * right-rail panel), restored from and persisted to localStorage.
 */
export function useEditorPreferences(userId: string) {
  const [distractionFree, setDistractionFree] = useState(false);
  const [rightPanel, setRightPanel] = useState<RightPanel>("assistant");

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

  return { distractionFree, setDistractionFree, rightPanel, setRightPanel };
}
