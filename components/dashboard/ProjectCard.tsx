import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { StatusBadge } from "./StatusBadge";
import { CoverImage } from "./CoverImage";
import { Progress } from "@/components/ui/progress";
import { formatRelativeTime } from "@/lib/utils";
import type { ProjectStatus } from "@/lib/constants";

interface ProjectCardProps {
  id: string;
  title: string;
  genre: string | null;
  status: ProjectStatus;
  coverUrl: string | null;
  wordCount: number;
  targetWords?: number;
  updatedAt: Date | null;
}

export async function ProjectCard({
  id,
  title,
  genre,
  status,
  coverUrl,
  wordCount,
  targetWords = 80000,
  updatedAt,
}: ProjectCardProps) {
  const t = await getTranslations("dashboard.projectCard");
  const progress = Math.min(Math.round((wordCount / targetWords) * 100), 100);

  return (
    <Link
      href={`/dashboard/projects/${id}/edit`}
      className="group block rounded-xl bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Cover + Badge */}
      <div className="relative mb-3 aspect-[3/4] w-full overflow-hidden rounded-lg bg-muted">
        {coverUrl ? (
          <CoverImage
            src={coverUrl}
            alt={title}
            fallbackLetter={title.charAt(0)}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-[oklch(0.28_0.04_200)] to-[oklch(0.37_0.04_200)]">
            <span className="font-serif text-lg font-medium text-white/80">
              {title.charAt(0)}
            </span>
          </div>
        )}
        <div className="absolute left-2 top-2">
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Title + Meta */}
      <h3 className="font-serif text-sm font-semibold leading-snug text-foreground">
        {title}
      </h3>
      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
        {genre && <span className="capitalize">{genre}</span>}
        {genre && updatedAt && <span>·</span>}
        {updatedAt && <span>{formatRelativeTime(updatedAt)}</span>}
      </div>

      {/* Progress */}
      <div className="mt-3 space-y-1">
        <Progress value={progress} className="h-1.5" />
        <p className="text-[0.65rem] font-medium text-muted-foreground">
          {t("wordCount", { count: wordCount.toLocaleString(), target: targetWords.toLocaleString() })}
        </p>
      </div>
    </Link>
  );
}
