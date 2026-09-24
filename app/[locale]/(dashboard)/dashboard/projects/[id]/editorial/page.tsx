import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { EditorialReport } from "@/components/ai/EditorialReport";
import type {
  EditorialReport as EditorialReportType,
  StyleAnalysis,
} from "@/lib/ai/editorial";
import { requireUser } from "@/lib/auth/session";
import { getOwnedProject } from "@/lib/db/queries/projects";
import { getManuscript } from "@/lib/db/queries/manuscripts";

export default async function EditorialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("pages.projectEditorial");
  const { id } = await params;
  const user = await requireUser();

  const project = await getOwnedProject(user.id, id);
  if (!project) notFound();

  const manuscript = await getManuscript(user.id, id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <Link
            href={`/dashboard/projects/${id}/edit`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
            {t("backToEditor")}
          </Link>
          <h1 className="mt-1 font-serif text-2xl font-semibold">
            {t("heading")}
          </h1>
          <p className="text-sm text-muted-foreground">{project.title}</p>
        </div>
      </div>

      <EditorialReport
        projectId={id}
        savedReport={
          (manuscript?.editorialReport as EditorialReportType | null) ?? null
        }
        savedStyle={
          (manuscript?.styleAnalysis as StyleAnalysis | null) ?? null
        }
      />
    </div>
  );
}
