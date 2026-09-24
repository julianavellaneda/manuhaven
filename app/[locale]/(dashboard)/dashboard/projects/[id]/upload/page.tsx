import { notFound } from "next/navigation";
import { ManuscriptUpload } from "@/components/upload/ManuscriptUpload";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { getOwnedProject } from "@/lib/db/queries/projects";
import { fileUrl } from "@/lib/storage/url";

export default async function UploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("pages.projectUpload");
  const { id } = await params;
  const user = await requireUser();

  const project = await getOwnedProject(user.id, id);
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">
          {t("heading")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.rich("description", {
            title: project.title,
            strong: (chunks) => (
              <span className="font-medium text-foreground">{chunks}</span>
            ),
          })}
        </p>
      </div>

      <ManuscriptUpload
        projectId={project.id}
        projectTitle={project.title}
        existingCoverUrl={project.coverKey ? fileUrl(project.coverKey) : null}
      />
    </div>
  );
}
