"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CSV_RETAILERS } from "@/lib/royalties/display";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  RoyaltyPreviewTable,
  type ParsedRecord,
} from "@/components/royalties/RoyaltyPreviewTable";

interface Project {
  id: string;
  title: string;
}

/** Retailer CSV import: pick retailer + project, drop a file, preview, import. */
export function RoyaltyCsvImport({ projects }: { projects: Project[] }) {
  const t = useTranslations("royalties.dashboard");
  const [selectedRetailer, setSelectedRetailer] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewRecords, setPreviewRecords] = useState<ParsedRecord[]>([]);
  const [uploadResult, setUploadResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.name.toLowerCase().endsWith(".csv")) {
      setFile(droppedFile);
      setUploadResult(null);
      setPreviewRecords([]);
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) {
        setFile(selected);
        setUploadResult(null);
        setPreviewRecords([]);
      }
    },
    []
  );

  const callUploadAPI = useCallback(
    async (preview: boolean) => {
      if (!file || !selectedRetailer || !selectedProject) return;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("retailer", selectedRetailer);
      formData.append("projectId", selectedProject);

      const url = preview
        ? "/api/royalties/upload?preview=true"
        : "/api/royalties/upload";

      const res = await fetch(url, { method: "POST", body: formData });
      const data = await res.json();
      return { ok: res.ok, data };
    },
    [file, selectedRetailer, selectedProject]
  );

  const handlePreview = useCallback(async () => {
    setPreviewing(true);
    setUploadResult(null);
    try {
      const result = await callUploadAPI(true);
      if (result?.ok) {
        setPreviewRecords(result.data.records);
      } else {
        setUploadResult({
          type: "error",
          message: result?.data?.error || "Failed to parse CSV",
        });
      }
    } catch {
      setUploadResult({ type: "error", message: "Network error" });
    } finally {
      setPreviewing(false);
    }
  }, [callUploadAPI]);

  const handleImport = useCallback(async () => {
    setUploading(true);
    setUploadResult(null);
    try {
      const result = await callUploadAPI(false);
      if (result?.ok) {
        setUploadResult({
          type: "success",
          message: `Successfully imported ${result.data.count} royalty records`,
        });
        setPreviewRecords([]);
        setFile(null);
      } else {
        setUploadResult({
          type: "error",
          message: result?.data?.error || "Failed to import records",
        });
      }
    } catch {
      setUploadResult({ type: "error", message: "Network error" });
    } finally {
      setUploading(false);
    }
  }, [callUploadAPI]);

  const canPreview = file && selectedRetailer && selectedProject;

  return (
    <div className="rounded-xl bg-card p-6 shadow-sm">
      <h2 className="mb-4 font-serif text-lg font-semibold text-foreground">
        {t("importSalesReport")}
      </h2>

      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        {/* Left: selectors + drop zone */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[180px]">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {t("labelRetailer")}
              </label>
              <Select
                value={selectedRetailer}
                onValueChange={(v) => setSelectedRetailer(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("placeholderRetailer")} />
                </SelectTrigger>
                <SelectContent>
                  {CSV_RETAILERS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[220px]">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {t("labelProject")}
              </label>
              <Select
                value={selectedProject}
                onValueChange={(v) => setSelectedProject(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("placeholderProject")} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "relative flex min-h-[120px] cursor-pointer items-center justify-center rounded-xl p-6 transition-colors",
              "bg-muted/40",
              dragOver
                ? "bg-accent/30 shadow-inner"
                : "hover:bg-muted/60",
              // Ghost dashed border at 30% opacity — uses border (not ring) per design system
              "border border-dashed border-foreground/[.12]"
            )}
            onClick={() => document.getElementById("csv-input")?.click()}
          >
            <input
              id="csv-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            <div className="text-center">
              {file ? (
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="size-8 text-primary/60" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto mb-2 size-8 text-muted-foreground/60" />
                  <p className="text-sm text-muted-foreground">
                    {t("dropZonePrompt")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/60">
                    {t("dropZoneFormats")}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="flex flex-col justify-end gap-2 lg:w-40">
          <Button
            onClick={handlePreview}
            disabled={!canPreview || previewing}
            variant="outline"
            className="w-full"
          >
            {previewing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            {t("btnParsePreview")}
          </Button>
          <Button
            onClick={handleImport}
            disabled={
              !canPreview || uploading || previewRecords.length === 0
            }
            className="w-full bg-gradient-to-r from-[oklch(0.28_0.04_200)] to-[oklch(0.37_0.04_200)] text-white hover:opacity-90"
          >
            {uploading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            {t("btnImport")}
          </Button>
        </div>
      </div>

      {/* Upload result message */}
      {uploadResult && (
        <div
          className={cn(
            "mt-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm",
            uploadResult.type === "success"
              ? "bg-published/20 text-foreground"
              : "bg-destructive/10 text-destructive"
          )}
        >
          {uploadResult.type === "success" ? (
            <CheckCircle className="size-4 shrink-0" />
          ) : (
            <AlertCircle className="size-4 shrink-0" />
          )}
          {uploadResult.message}
        </div>
      )}

      {previewRecords.length > 0 && (
        <RoyaltyPreviewTable records={previewRecords} />
      )}
    </div>
  );
}
