"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Upload, PenLine } from "lucide-react";
import { startBlankManuscriptAction } from "@/app/[locale]/(dashboard)/dashboard/projects/actions";

interface NoManuscriptProps {
  projectId: string;
  projectTitle: string;
}

export function NoManuscript({ projectId, projectTitle }: NoManuscriptProps) {
  const t = useTranslations("editor.noManuscript");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  async function handleStartWriting() {
    setCreating(true);
    try {
      const result = await startBlankManuscriptAction(projectId);

      if (!result.ok) {
        console.error("Failed to create manuscript:", result.error);
        setCreating(false);
        return;
      }

      // Reload the page to pick up the new manuscript
      router.refresh();
    } catch (err) {
      console.error("Failed to create manuscript:", err);
      setCreating(false);
    }
  }

  return (
    <div className="-m-6 flex h-[calc(100vh-3.5rem)] items-center justify-center bg-card">
      <div className="mx-auto max-w-sm text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-muted">
          <Upload className="size-7 text-muted-foreground" />
        </div>
        <h2 className="font-serif text-xl font-semibold text-foreground">
          {t("heading")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("body", { projectTitle })}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href={`/dashboard/projects/${projectId}/upload`}>
            <Button variant="outline" size="lg">
              <Upload className="size-4" />
              {t("uploadButton")}
            </Button>
          </Link>
          <Button
            size="lg"
            onClick={handleStartWriting}
            disabled={creating}
          >
            <PenLine className="size-4" />
            {creating ? t("creatingButton") : t("startWritingButton")}
          </Button>
        </div>
      </div>
    </div>
  );
}
