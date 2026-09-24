"use client";

import { useState } from "react";
import { ManuscriptViewer } from "@/components/editor/ManuscriptViewer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Eye, BookOpen, FileText } from "lucide-react";
import { PreviewModal } from "./PreviewModal";
import type { ExportedFiles } from "./ExportActions";

interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

interface BookPreviewProps {
  content: TiptapNode | null;
  templateName: string | null;
  exportedFiles?: ExportedFiles;
  projectTitle?: string;
}

const templateStyles: Record<string, string> = {
  "Classic Noir":
    "bg-[#1a1a2e] text-[#e8e8e8] [&_h1]:text-[#f0f0f0] [&_h2]:text-[#d4d4d4]",
  "Modern Romance":
    "bg-[#faf5f0] text-[#4a3728] [&_h1]:text-[#6b4226] [&_h2]:text-[#8b6948]",
  "Sci-Fi Echoes":
    "bg-[#0d1117] text-[#c9d1d9] [&_h1]:font-mono [&_h1]:text-[#58a6ff] [&_h2]:font-mono",
};

export function BookPreview({
  content,
  templateName,
  exportedFiles,
  projectTitle,
}: BookPreviewProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFormat, setPreviewFormat] = useState<"epub" | "pdf">("epub");
  const styleClass = templateName ? templateStyles[templateName] : "";

  const hasEpub = !!exportedFiles?.epub;
  const hasPdf = !!exportedFiles?.pdf;
  const hasExports = hasEpub || hasPdf;

  const openPreview = (format: "epub" | "pdf") => {
    setPreviewFormat(format);
    setPreviewOpen(true);
  };

  const previewFile =
    previewFormat === "epub" ? exportedFiles?.epub : exportedFiles?.pdf;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Export preview buttons */}
      {hasExports && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">
            Preview exported:
          </span>
          {hasEpub && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => openPreview("epub")}
            >
              <BookOpen className="size-3.5" />
              EPUB
              <Eye className="size-3" />
            </Button>
          )}
          {hasPdf && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => openPreview("pdf")}
            >
              <FileText className="size-3.5" />
              PDF
              <Eye className="size-3" />
            </Button>
          )}
        </div>
      )}

      {/* Book-shaped manuscript preview */}
      <div
        className={cn(
          "aspect-[5/7] w-full max-w-lg overflow-y-auto rounded-xl bg-card p-8 shadow-lg",
          styleClass
        )}
        style={{
          boxShadow:
            "0 12px 40px rgba(25, 28, 29, 0.06), 4px 0 12px rgba(0,0,0,0.03)",
        }}
      >
        <ManuscriptViewer content={content} />
      </div>

      {/* Preview modal */}
      {previewFile && (
        <PreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          fileUrl={previewFile.url}
          format={previewFormat}
          title={projectTitle}
        />
      )}
    </div>
  );
}
