"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface WritingStatsPanelProps {
  trigger: React.ReactNode;
  totalWords: number;
  totalCharacters: number;
  readingMinutes: number;
  sessionWords: number;
  todayWords: number;
  dailyGoal: number;
  onGoalChange: (goal: number) => void;
}

function GoalRing({
  todayWords,
  dailyGoal,
}: {
  todayWords: number;
  dailyGoal: number;
}) {
  const size = 88;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(1, dailyGoal > 0 ? todayWords / dailyGoal : 0);
  const offset = circumference * (1 - pct);
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={stroke}
        className="fill-none stroke-muted"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="fill-none stroke-primary transition-[stroke-dashoffset] duration-500"
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground font-medium"
        fontSize="14"
      >
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}

export function WritingStatsPanel({
  trigger,
  totalWords,
  totalCharacters,
  readingMinutes,
  sessionWords,
  todayWords,
  dailyGoal,
  onGoalChange,
}: WritingStatsPanelProps) {
  const t = useTranslations("editor.writingStats");
  const [goalDraft, setGoalDraft] = useState(String(dailyGoal));
  // Reset the draft when the saved goal changes (adjusting state during
  // render, which React prefers over a syncing effect).
  const [syncedGoal, setSyncedGoal] = useState(dailyGoal);
  if (syncedGoal !== dailyGoal) {
    setSyncedGoal(dailyGoal);
    setGoalDraft(String(dailyGoal));
  }

  const commitGoal = () => {
    const n = Number.parseInt(goalDraft, 10);
    if (Number.isFinite(n) && n > 0) onGoalChange(n);
    else setGoalDraft(String(dailyGoal));
  };

  return (
    <Popover>
      <PopoverTrigger render={trigger as React.ReactElement} />
      <PopoverContent align="end" className="w-80">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <GoalRing todayWords={todayWords} dailyGoal={dailyGoal} />
            <div className="flex-1 space-y-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {t("today")}
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                {todayWords.toLocaleString()}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  / {dailyGoal.toLocaleString()}
                </span>
              </p>
              <p className="text-[0.7rem] text-muted-foreground">
                {t("sessionWords", { count: sessionWords.toLocaleString() })}
              </p>
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                {t("words")}
              </p>
              <p className="tabular-nums">{totalWords.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                {t("characters")}
              </p>
              <p className="tabular-nums">
                {totalCharacters.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                {t("readingTime")}
              </p>
              <p className="tabular-nums">{t("readingMinutes", { count: readingMinutes })}</p>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                {t("dailyGoal")}
              </p>
              <input
                type="number"
                min={1}
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                onBlur={commitGoal}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitGoal();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-full rounded-md bg-muted px-2 py-0.5 tabular-nums outline-none ring-1 ring-transparent focus:ring-ring"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
