"use client";

import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteChapterDialogProps {
  /** Title of the chapter pending deletion; `null` keeps the dialog closed. */
  chapterTitle: string | null;
  onDismiss: () => void;
  onConfirm: () => void;
}

export function DeleteChapterDialog({
  chapterTitle,
  onDismiss,
  onConfirm,
}: DeleteChapterDialogProps) {
  const t = useTranslations("editor.manuscriptEditor");

  return (
    <AlertDialog
      open={chapterTitle !== null}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteDialogTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {chapterTitle !== null &&
              t("deleteDialogDescription", { title: chapterTitle })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel />
          <AlertDialogAction onClick={onConfirm}>
            {t("deleteDialogConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
