"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DistractionFreeShellProps {
  children: React.ReactNode;
  onExit: () => void;
}

export function DistractionFreeShell({
  children,
  onExit,
}: DistractionFreeShellProps) {
  const t = useTranslations("editor.distractionFree");
  const [chromeVisible, setChromeVisible] = useState(false);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setChromeVisible(e.clientY < 60);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onExit]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-end p-4 transition-opacity duration-200",
          chromeVisible ? "opacity-100" : "opacity-0"
        )}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onExit}
          className="pointer-events-auto gap-1.5"
          title={t("exitTitle")}
        >
          <X className="size-3.5" />
          {t("exitButton")}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
