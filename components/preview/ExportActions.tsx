"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  BookOpen,
  Download,
  Eye,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { PreviewModal } from "./PreviewModal";

type TrimSize = "5x8" | "5.5x8.5" | "6x9";
type ExportStatus = "idle" | "converting" | "complete" | "error";

interface ExportedFile {
  url: string;
  size: number;
  exportId: string | null;
}

interface ExportedFiles {
  epub?: ExportedFile;
  pdf?: ExportedFile;
}

interface ExportActionsProps {
  projectId: string;
  templateId: string | null;
  supportsEpub: boolean;
  supportsPdf: boolean;
  onExportComplete?: (files: ExportedFiles) => void;
}

const TRIM_SIZE_LABELS: Record<TrimSize, string> = {
  "6x9": '6\u00d79" Trade',
  "5.5x8.5": '5.5\u00d78.5" Digest',
  "5x8": '5\u00d78" Mass Market',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExportActions({
  projectId,
  templateId,
  supportsEpub,
  supportsPdf,
  onExportComplete,
}: ExportActionsProps) {
  const [epubStatus, setEpubStatus] = useState<ExportStatus>("idle");
  const [pdfStatus, setPdfStatus] = useState<ExportStatus>("idle");
  const [exportedFiles, setExportedFiles] = useState<ExportedFiles>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trimSize, setTrimSize] = useState<TrimSize>("6x9");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFormat, setPreviewFormat] = useState<"epub" | "pdf">("epub");

  const handleExportEpub = useCallback(async () => {
    if (!templateId) return;
    setEpubStatus("converting");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/convert/epub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, templateId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Conversion failed" }));
        throw new Error(err.error || `Conversion failed (${res.status})`);
      }

      const data = await res.json();
      const newFiles: ExportedFiles = {
        ...exportedFiles,
        epub: {
          url: data.fileUrl,
          size: data.fileSizeBytes,
          exportId: data.exportId,
        },
      };
      setExportedFiles(newFiles);
      setEpubStatus("complete");
      onExportComplete?.(newFiles);
    } catch (err) {
      setEpubStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "EPUB export failed"
      );
    }
  }, [projectId, templateId, exportedFiles, onExportComplete]);

  const handleExportPdf = useCallback(async () => {
    if (!templateId) return;
    setPdfStatus("converting");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/convert/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          templateId,
          printSettings: {
            trimSize,
            margins: "normal",
            fontSize: "medium",
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Conversion failed" }));
        throw new Error(err.error || `Conversion failed (${res.status})`);
      }

      const data = await res.json();
      const newFiles: ExportedFiles = {
        ...exportedFiles,
        pdf: {
          url: data.fileUrl,
          size: data.fileSizeBytes,
          exportId: data.exportId,
        },
      };
      setExportedFiles(newFiles);
      setPdfStatus("complete");
      onExportComplete?.(newFiles);
    } catch (err) {
      setPdfStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "PDF export failed"
      );
    }
  }, [projectId, templateId, trimSize, exportedFiles, onExportComplete]);

  const openPreview = (format: "epub" | "pdf") => {
    setPreviewFormat(format);
    setPreviewOpen(true);
  };

  const isConverting = epubStatus === "converting" || pdfStatus === "converting";
  const previewFile =
    previewFormat === "epub" ? exportedFiles.epub : exportedFiles.pdf;

  return (
    <>
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Export
        </h3>

        {/* EPUB Export */}
        {supportsEpub && (
          <div className="space-y-2">
            {epubStatus === "complete" && exportedFiles.epub ? (
              <div className="rounded-xl bg-[oklch(0.95_0.02_160)] p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-[oklch(0.55_0.15_160)]" />
                  <span className="text-sm font-medium text-foreground">
                    EPUB Ready
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatFileSize(exportedFiles.epub.size)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() =>
                      window.open(exportedFiles.epub!.url, "_blank")
                    }
                  >
                    <Download className="size-3.5" />
                    Download
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => openPreview("epub")}
                  >
                    <Eye className="size-3.5" />
                    Preview
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                disabled={!templateId || isConverting}
                onClick={handleExportEpub}
              >
                {epubStatus === "converting" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <BookOpen className="size-3.5" />
                )}
                {epubStatus === "converting" ? "Converting..." : "Export EPUB"}
              </Button>
            )}
          </div>
        )}

        {/* PDF Export */}
        {supportsPdf && (
          <div className="space-y-2">
            {/* Trim size selector — shown when PDF is not yet complete */}
            {pdfStatus !== "complete" && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  Trim Size
                </label>
                <Select
                  value={trimSize}
                  onValueChange={(val) => setTrimSize(val as TrimSize)}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(TRIM_SIZE_LABELS) as [TrimSize, string][]).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {pdfStatus === "complete" && exportedFiles.pdf ? (
              <div className="rounded-xl bg-[oklch(0.95_0.02_160)] p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-[oklch(0.55_0.15_160)]" />
                  <span className="text-sm font-medium text-foreground">
                    PDF Ready
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatFileSize(exportedFiles.pdf.size)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() =>
                      window.open(exportedFiles.pdf!.url, "_blank")
                    }
                  >
                    <Download className="size-3.5" />
                    Download
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => openPreview("pdf")}
                  >
                    <Eye className="size-3.5" />
                    Preview
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                disabled={!templateId || isConverting}
                onClick={handleExportPdf}
              >
                {pdfStatus === "converting" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <FileText className="size-3.5" />
                )}
                {pdfStatus === "converting" ? "Converting..." : "Export PDF"}
              </Button>
            )}
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="flex items-start gap-2 rounded-xl bg-destructive/5 p-3">
            <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0">
              <p className="text-sm text-destructive">{errorMessage}</p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-destructive hover:text-destructive"
                onClick={() => {
                  setErrorMessage(null);
                  if (epubStatus === "error") setEpubStatus("idle");
                  if (pdfStatus === "error") setPdfStatus("idle");
                }}
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Preview modal */}
      {previewFile && (
        <PreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          fileUrl={previewFile.url}
          format={previewFormat}
        />
      )}
    </>
  );
}

export type { ExportedFiles };
