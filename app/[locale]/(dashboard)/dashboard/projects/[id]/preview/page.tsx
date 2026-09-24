import { notFound } from "next/navigation";
import { EditorTopBar } from "@/components/editor/EditorTopBar";
import { TemplateSelector } from "@/components/preview/TemplateSelector";
import { MetadataPanel } from "@/components/ai/MetadataPanel";
import type { AIMetadataResult } from "@/lib/ai/metadata";
import { requireUser } from "@/lib/auth/session";
import { getOwnedProject } from "@/lib/db/queries/projects";
import { getManuscript } from "@/lib/db/queries/manuscripts";
import { listActiveTemplates } from "@/lib/db/queries/templates";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const project = await getOwnedProject(user.id, id);
  if (!project) notFound();

  const [manuscript, templates] = await Promise.all([
    getManuscript(user.id, id),
    listActiveTemplates(),
  ]);

  return (
    <div className="-m-6 flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      <EditorTopBar projectId={project.id} projectTitle={project.title} />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <TemplateSelector
          templates={templates}
          content={manuscript?.tiptapJson as Parameters<typeof TemplateSelector>[0]["content"]}
          projectId={project.id}
          projectTitle={project.title}
        />
        <MetadataPanel
          projectId={project.id}
          savedMetadata={(project.aiMetadata as AIMetadataResult | null) ?? undefined}
        />
      </div>
    </div>
  );
}
