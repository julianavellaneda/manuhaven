"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import type { Editor } from "@tiptap/react";

import { Button } from "@/components/ui/button";

interface LinkPopoverProps {
  editor: Editor | null;
  open: boolean;
  onClose: () => void;
}

export function LinkPopover({ editor, open, onClose }: LinkPopoverProps) {
  const t = useTranslations("editor.linkPopover");
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editor || !open) return;
    const existing = editor.getAttributes("link").href as string | undefined;
    const raf = requestAnimationFrame(() => {
      setUrl(existing ?? "");
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [editor, open]);

  if (!open || !editor) return null;

  const apply = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: trimmed })
        .run();
    }
    onClose();
  };

  const clear = () => {
    editor.chain().focus().unsetLink().run();
    setUrl("");
    onClose();
  };

  return (
    <div
      className="absolute left-4 top-14 z-20 flex w-80 items-center gap-1.5 rounded-lg bg-popover p-2 text-sm shadow-lg ring-1 ring-foreground/10"
      role="dialog"
      aria-label={t("ariaLabel")}
    >
      <input
        ref={inputRef}
        type="url"
        placeholder="https://example.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            apply();
          }
          if (e.key === "Escape") onClose();
        }}
        className="min-w-0 flex-1 rounded-md bg-muted px-2 py-1 text-sm outline-none ring-1 ring-transparent focus:ring-ring"
      />
      <Button size="sm" onClick={apply}>
        {t("applyButton")}
      </Button>
      <Button variant="ghost" size="sm" onClick={clear}>
        {t("clearButton")}
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onClose} title={t("closeTitle")}>
        <X className="size-4" />
      </Button>
    </div>
  );
}
