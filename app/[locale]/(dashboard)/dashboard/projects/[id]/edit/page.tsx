import { notFound } from "next/navigation";
import { ManuscriptEditor } from "@/components/editor/ManuscriptEditor";
import { NoManuscript } from "@/components/editor/NoManuscript";
import type { TiptapDoc } from "@/lib/manuscript/chapter-utils";
import type { StoryBible } from "@/lib/ai/continuity";
import { requireUser } from "@/lib/auth/session";
import { getOwnedProject } from "@/lib/db/queries/projects";
import { getManuscript } from "@/lib/db/queries/manuscripts";

export default async function ManuscriptEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const project = await getOwnedProject(user.id, id);
  if (!project) notFound();

  const manuscript = await getManuscript(user.id, id);
  const tiptapJson = manuscript?.tiptapJson as TiptapDoc | null;

  // No manuscript at all — show empty state
  if (!manuscript || !tiptapJson) {
    return <NoManuscript projectId={id} projectTitle={project.title} />;
  }

  const writingStats =
    (manuscript.writingStats as {
      sessions: Record<string, { words: number; seconds: number }>;
      dailyGoal: number;
    } | null) ?? null;

  const storyBible =
    (manuscript.storyBible as StoryBible | null) ?? null;

  return (
    <ManuscriptEditor
      tiptapJson={tiptapJson}
      projectId={id}
      projectTitle={project.title}
      userId={user.id}
      initialWritingStats={writingStats}
      initialStoryBible={storyBible}
    />
  );
}
