"use client";

import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { SearchAndReplace } from "@/lib/editor/extensions/search-and-replace";
import {
  ManuHavenShortcuts,
  type ManuHavenShortcutCallbacks,
} from "@/lib/editor/extensions/manuhaven-shortcuts";
import { cn } from "@/lib/utils";
import type { TiptapDoc } from "@/lib/manuscript/chapter-utils";
import type { Editor } from "@tiptap/react";

interface TiptapEditorProps {
  initialContent: TiptapDoc;
  onUpdate: () => void;
  onEditorReady: (editor: Editor) => void;
  shortcuts?: ManuHavenShortcutCallbacks;
  distractionFree?: boolean;
}

export function TiptapEditor({
  initialContent,
  onUpdate,
  onEditorReady,
  shortcuts,
  distractionFree = false,
}: TiptapEditorProps) {
  const t = useTranslations("editor.tiptap");
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      SearchAndReplace,
      ManuHavenShortcuts.configure(shortcuts ?? {}),
      Placeholder.configure({
        placeholder: t("placeholder"),
      }),
    ],
    // Shortcuts callbacks are stable-by-ref from the parent; deps omitted intentionally
    // because re-creating extensions would destroy editor state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const editor = useEditor({
    extensions,
    content: initialContent,
    onUpdate: () => {
      onUpdate();
    },
    editorProps: {
      attributes: {
        class: cn(
          "ph-no-capture prose-manuscript mx-auto px-4 py-8 font-serif text-lg leading-[1.8] text-foreground/90 outline-none min-h-[60vh]",
          distractionFree ? "max-w-3xl" : "max-w-2xl"
        ),
      },
    },
    immediatelyRender: false,
  });

  // Keep shortcut callbacks fresh without recreating extensions.
  useEffect(() => {
    if (!editor || !shortcuts) return;
    const ext = editor.extensionManager.extensions.find(
      (e) => e.name === "manuhavenShortcuts"
    );
    if (ext) {
      Object.assign(ext.options, shortcuts);
    }
  }, [editor, shortcuts]);

  // Update prose width when distraction-free toggles.
  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        attributes: {
          class: cn(
            "ph-no-capture prose-manuscript mx-auto px-4 py-8 font-serif text-lg leading-[1.8] text-foreground/90 outline-none min-h-[60vh]",
            distractionFree ? "max-w-3xl" : "max-w-2xl"
          ),
        },
      },
    });
  }, [editor, distractionFree]);

  useEffect(() => {
    if (editor) onEditorReady(editor);
  }, [editor, onEditorReady]);

  if (!editor) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/3 rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-5/6 rounded bg-muted" />
          <div className="h-4 w-4/5 rounded bg-muted" />
        </div>
      </div>
    );
  }

  return <EditorContent editor={editor} />;
}
