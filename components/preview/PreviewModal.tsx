"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface PreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileUrl: string;
  format: "epub" | "pdf";
  title?: string;
}

export function PreviewModal({
  open,
  onOpenChange,
  fileUrl,
  format,
  title,
}: PreviewModalProps) {
  const displayTitle = title
    ? `${title} — ${format.toUpperCase()} Preview`
    : `${format.toUpperCase()} Preview`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="h-[90vh] w-[90vw] max-w-5xl sm:max-w-5xl flex flex-col gap-0 p-0"
      >
        <DialogHeader className="flex flex-row items-center justify-between gap-4 px-5 py-3 bg-muted/30">
          <DialogTitle className="truncate">{displayTitle}</DialogTitle>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                window.open(fileUrl, "_blank");
              }}
            >
              <Download className="size-3.5" />
              Download
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          {format === "pdf" ? (
            <iframe
              src={fileUrl}
              className="h-full w-full"
              title={displayTitle}
            />
          ) : (
            <EpubPreview fileUrl={fileUrl} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Simple EPUB preview — renders via iframe or a fallback download prompt */
function EpubPreview({ fileUrl }: { fileUrl: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-xl bg-muted/50 p-8 max-w-md">
        <p className="font-serif text-lg font-semibold text-foreground mb-2">
          EPUB Preview
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          EPUB files are best viewed in a dedicated reader app. Download the file
          to preview it in Apple Books, Calibre, or your preferred reader.
        </p>
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={() => window.open(fileUrl, "_blank")}
        >
          <Download className="size-4" />
          Download EPUB
        </Button>
      </div>
    </div>
  );
}
