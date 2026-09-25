"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  MAX_MANUSCRIPT_SIZE_BYTES,
  MAX_COVER_SIZE_BYTES,
  SUPPORTED_MANUSCRIPT_TYPES,
  SUPPORTED_COVER_TYPES,
} from "@/lib/constants";
import { htmlToTiptap } from "@/lib/manuscript/html-to-tiptap";
import { txtToTiptap } from "@/lib/manuscript/txt-to-tiptap";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface ManuscriptUploadProps {
  projectId: string;
  projectTitle: string;
  existingCoverUrl: string | null;
}

type UploadStep =
  | "idle"
  | "parsing"
  | "uploading-manuscript"
  | "uploading-cover"
  | "done"
  | "error";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

/** POST a multipart form; throws with the server's error message on failure. */
async function postForm(url: string, form: FormData): Promise<void> {
  const res = await fetch(url, { method: "POST", body: form });
  if (res.ok) return;
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new Error(body?.error ?? res.statusText);
}

export function ManuscriptUpload({
  projectId,
  projectTitle,
  existingCoverUrl,
}: ManuscriptUploadProps) {
  const t = useTranslations("upload");
  const router = useRouter();
  const manuscriptInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [manuscriptFile, setManuscriptFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(
    existingCoverUrl
  );

  const [step, setStep] = useState<UploadStep>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [manuscriptDragOver, setManuscriptDragOver] = useState(false);
  const [coverDragOver, setCoverDragOver] = useState(false);

  const validateManuscript = useCallback((file: File): string | null => {
    const ext = getFileExtension(file.name);
    if (!SUPPORTED_MANUSCRIPT_TYPES.includes(ext as "docx" | "txt")) {
      return t("error.unsupportedManuscriptType", { ext });
    }
    if (file.size > MAX_MANUSCRIPT_SIZE_BYTES) {
      return t("error.manuscriptTooLarge", {
        size: formatFileSize(file.size),
        max: formatFileSize(MAX_MANUSCRIPT_SIZE_BYTES),
      });
    }
    return null;
  }, [t]);

  const validateCover = useCallback((file: File): string | null => {
    const ext = getFileExtension(file.name);
    if (
      !SUPPORTED_COVER_TYPES.includes(ext as "jpg" | "jpeg" | "png" | "webp")
    ) {
      return t("error.unsupportedCoverType", { ext });
    }
    if (file.size > MAX_COVER_SIZE_BYTES) {
      return t("error.coverTooLarge", {
        size: formatFileSize(file.size),
        max: formatFileSize(MAX_COVER_SIZE_BYTES),
      });
    }
    return null;
  }, [t]);

  const handleManuscriptSelect = useCallback(
    (file: File) => {
      const error = validateManuscript(file);
      if (error) {
        setErrorMessage(error);
        return;
      }
      setErrorMessage(null);
      setManuscriptFile(file);
    },
    [validateManuscript]
  );

  const handleCoverSelect = useCallback(
    (file: File) => {
      const error = validateCover(file);
      if (error) {
        setErrorMessage(error);
        return;
      }
      setErrorMessage(null);
      setCoverFile(file);
      const url = URL.createObjectURL(file);
      setCoverPreview(url);
    },
    [validateCover]
  );

  const handleDrop = useCallback(
    (
      e: React.DragEvent,
      type: "manuscript" | "cover"
    ) => {
      e.preventDefault();
      if (type === "manuscript") setManuscriptDragOver(false);
      else setCoverDragOver(false);

      const file = e.dataTransfer.files[0];
      if (!file) return;

      if (type === "manuscript") handleManuscriptSelect(file);
      else handleCoverSelect(file);
    },
    [handleManuscriptSelect, handleCoverSelect]
  );

  const handleSubmit = useCallback(async () => {
    if (!manuscriptFile) return;

    setErrorMessage(null);
    setProgress(0);

    try {
      // Step 1: Parse the manuscript to Tiptap JSON in the browser (mammoth
      // needs the DOM). The server recomputes word count and chapters.
      setStep("parsing");
      setProgress(10);

      const ext = getFileExtension(manuscriptFile.name);
      let tiptapJson;

      if (ext === "docx") {
        // Dynamic import to avoid SSR issues
        const mammoth = (await import("mammoth")).default;
        const arrayBuffer = await manuscriptFile.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        tiptapJson = htmlToTiptap(result.value);
      } else {
        // txt file
        const text = await manuscriptFile.text();
        tiptapJson = txtToTiptap(text);
      }

      // Step 2: Upload the original and its parsed body
      setStep("uploading-manuscript");
      setProgress(40);

      const manuscriptForm = new FormData();
      manuscriptForm.append("file", manuscriptFile);
      manuscriptForm.append("fileType", ext);
      manuscriptForm.append("tiptapJson", JSON.stringify(tiptapJson));
      try {
        await postForm(`/api/projects/${projectId}/manuscript`, manuscriptForm);
      } catch (err) {
        throw new Error(
          t("error.uploadFailed", { detail: (err as Error).message })
        );
      }

      // Step 3: Upload the cover, if one was chosen
      if (coverFile) {
        setStep("uploading-cover");
        setProgress(80);

        const coverForm = new FormData();
        coverForm.append("file", coverFile);
        try {
          await postForm(`/api/projects/${projectId}/cover`, coverForm);
        } catch (err) {
          throw new Error(
            t("error.coverUploadFailed", { detail: (err as Error).message })
          );
        }
      }

      setProgress(100);
      setStep("done");

      // Redirect after a brief moment so the user sees completion
      setTimeout(() => {
        router.push(`/dashboard/projects/${projectId}/edit`);
      }, 800);
    } catch (err) {
      setStep("error");
      setErrorMessage(
        err instanceof Error ? err.message : t("error.unexpected")
      );
    }
  }, [manuscriptFile, coverFile, projectId, router, t]);

  const isProcessing =
    step !== "idle" && step !== "done" && step !== "error";

  const stepLabel: Record<UploadStep, string> = {
    idle: "",
    parsing: t("step.parsing"),
    "uploading-manuscript": t("step.uploadingManuscript"),
    "uploading-cover": t("step.uploadingCover"),
    done: t("step.done"),
    error: t("step.error"),
  };

  return (
    <div className="space-y-6">
      {/* Manuscript Upload Zone */}
      <Card>
        <CardContent className="space-y-3">
          <label className="text-sm font-medium text-foreground">
            {t("manuscriptLabel")}
          </label>

          <input
            ref={manuscriptInputRef}
            type="file"
            accept=".docx,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleManuscriptSelect(file);
            }}
          />

          {manuscriptFile ? (
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent">
                <FileText className="size-5 text-accent-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {manuscriptFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(manuscriptFile.size)} &middot;{" "}
                  .{getFileExtension(manuscriptFile.name)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setManuscriptFile(null);
                  if (manuscriptInputRef.current)
                    manuscriptInputRef.current.value = "";
                }}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                disabled={isProcessing}
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => manuscriptInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setManuscriptDragOver(true);
              }}
              onDragLeave={() => setManuscriptDragOver(false)}
              onDrop={(e) => handleDrop(e, "manuscript")}
              className={cn(
                "flex w-full flex-col items-center gap-3 rounded-lg p-8 transition-colors",
                "bg-muted/30 hover:bg-muted/50",
                "border border-dashed border-foreground/15",
                manuscriptDragOver && "bg-accent/30 border-primary/30"
              )}
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Upload className="size-5 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {t("manuscriptDropPrompt")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("manuscriptHint", { max: formatFileSize(MAX_MANUSCRIPT_SIZE_BYTES) })}
                </p>
              </div>
            </button>
          )}
        </CardContent>
      </Card>

      {/* Cover Image Upload Zone */}
      <Card>
        <CardContent className="space-y-3">
          <label className="text-sm font-medium text-foreground">
            {t("coverLabel")}{" "}
            <span className="font-normal text-muted-foreground">
              {t("coverOptional")}
            </span>
          </label>

          <input
            ref={coverInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCoverSelect(file);
            }}
          />

          <div className="flex gap-4">
            {coverPreview && (
              <div className="relative shrink-0">
                {/* Not next/image: the preview is a blob: URL or an
                    authz-checked /api/files URL, neither of which the
                    server-side optimizer can fetch. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverPreview}
                  alt={t("coverAlt", { projectTitle })}
                  className="h-40 w-28 rounded-lg object-cover shadow-sm"
                />
                {coverFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setCoverFile(null);
                      setCoverPreview(existingCoverUrl);
                      if (coverInputRef.current)
                        coverInputRef.current.value = "";
                    }}
                    className="absolute -right-2 -top-2 rounded-full bg-card p-1 shadow-sm hover:bg-muted"
                    disabled={isProcessing}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setCoverDragOver(true);
              }}
              onDragLeave={() => setCoverDragOver(false)}
              onDrop={(e) => handleDrop(e, "cover")}
              className={cn(
                "flex flex-1 flex-col items-center gap-2 rounded-lg p-6 transition-colors",
                "bg-muted/30 hover:bg-muted/50",
                "border border-dashed border-foreground/15",
                coverDragOver && "bg-accent/30 border-primary/30"
              )}
            >
              <ImageIcon className="size-5 text-muted-foreground" />
              <div className="text-center">
                <p className="text-xs font-medium text-foreground">
                  {coverPreview ? t("coverReplace") : t("coverDropPrompt")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("coverHint", { max: formatFileSize(MAX_COVER_SIZE_BYTES) })}
                </p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Progress / Status */}
      {step !== "idle" && (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              {step === "done" && (
                <CheckCircle className="size-4 text-green-600" />
              )}
              {step === "error" && (
                <AlertCircle className="size-4 text-destructive" />
              )}
              {isProcessing && (
                <Loader2 className="size-4 animate-spin text-primary" />
              )}
              <span className="text-sm font-medium text-foreground">
                {stepLabel[step]}
              </span>
            </div>
            {(isProcessing || step === "done") && (
              <Progress value={progress} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="rounded-lg bg-destructive/5 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <Button
        onClick={handleSubmit}
        disabled={!manuscriptFile || isProcessing || step === "done"}
        className="w-full gap-2 bg-gradient-to-r from-[oklch(0.28_0.04_200)] to-[oklch(0.37_0.04_200)] text-white"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {t("submitProcessing")}
          </>
        ) : step === "done" ? (
          <>
            <CheckCircle className="size-4" />
            {t("submitRedirecting")}
          </>
        ) : (
          <>
            <Upload className="size-4" />
            {t("submitButton")}
          </>
        )}
      </Button>
    </div>
  );
}
