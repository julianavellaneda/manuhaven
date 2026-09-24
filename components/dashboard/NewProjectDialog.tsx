"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createProjectAction } from "@/app/[locale]/(dashboard)/dashboard/projects/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const GENRE_OPTIONS = [
  { value: "romance", label: "Romance" },
  { value: "thriller", label: "Thriller" },
  { value: "fantasy", label: "Fantasy" },
  { value: "scifi", label: "Sci-Fi" },
  { value: "literary", label: "Literary" },
  { value: "other", label: "Other" },
];

interface NewProjectDialogProps {
  children: React.ReactElement;
}

export function NewProjectDialog({ children }: NewProjectDialogProps) {
  const router = useRouter();
  const t = useTranslations("dashboard.newProject");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError(t("errorTitleRequired"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await createProjectAction({
        title: title.trim(),
        genre: genre || null,
      });

      if (!result.ok) {
        setError(
          result.error === "unauthorized"
            ? t("errorNotLoggedIn")
            : t("errorGeneric")
        );
        setLoading(false);
        return;
      }

      setOpen(false);
      resetForm();
      router.push(`/dashboard/projects/${result.id}/upload`);
    } catch {
      setError(t("errorGeneric"));
      setLoading(false);
    }
  }

  function resetForm() {
    setTitle("");
    setGenre("");
    setError(null);
    setLoading(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={children} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-title">{t("labelTitle")}</Label>
            <Input
              id="project-title"
              placeholder={t("placeholderTitle")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>{t("labelGenre")}</Label>
            <Select value={genre} onValueChange={(value) => setGenre(value ?? "")} disabled={loading}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("placeholderGenre")} />
              </SelectTrigger>
              <SelectContent>
                {GENRE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={loading || !title.trim()}
              className="gap-2 bg-gradient-to-r from-[oklch(0.28_0.04_200)] to-[oklch(0.37_0.04_200)] text-white hover:opacity-90"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? t("creating") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
