"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

function renderMarks(
  text: string,
  marks?: { type: string; attrs?: Record<string, unknown> }[]
) {
  if (!marks || marks.length === 0) return text;

  return marks.reduce<React.ReactNode>((acc, mark) => {
    switch (mark.type) {
      case "bold":
        return <strong className="font-bold">{acc}</strong>;
      case "italic":
        return <em className="italic">{acc}</em>;
      case "underline":
        return <u>{acc}</u>;
      case "strike":
        return <s>{acc}</s>;
      default:
        return acc;
    }
  }, text);
}

function renderNode(node: TiptapNode, index: number): React.ReactNode {
  const key = `${node.type}-${index}`;

  switch (node.type) {
    case "doc":
      return (
        <div key={key}>
          {node.content?.map((child, i) => renderNode(child, i))}
        </div>
      );

    case "heading": {
      const level = (node.attrs?.level as number) ?? 1;
      const Tag = `h${Math.min(level, 6)}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      const sizeClasses: Record<number, string> = {
        1: "text-3xl mt-10 mb-4",
        2: "text-2xl mt-8 mb-3",
        3: "text-xl mt-6 mb-2",
      };
      return (
        <Tag
          key={key}
          className={cn(
            "font-serif font-semibold text-foreground",
            sizeClasses[level] ?? "text-lg mt-4 mb-2"
          )}
        >
          {node.content?.map((child, i) => renderNode(child, i))}
        </Tag>
      );
    }

    case "paragraph":
      return (
        <p
          key={key}
          className="mb-4 font-serif text-lg leading-[1.8] text-foreground/90"
        >
          {node.content?.map((child, i) => renderNode(child, i)) ?? (
            <br />
          )}
        </p>
      );

    case "blockquote":
      return (
        <blockquote
          key={key}
          className="my-6 border-l-2 border-primary/30 pl-6 italic text-muted-foreground"
        >
          {node.content?.map((child, i) => renderNode(child, i))}
        </blockquote>
      );

    case "bulletList":
      return (
        <ul key={key} className="mb-4 list-disc pl-6 space-y-1 font-serif text-lg">
          {node.content?.map((child, i) => renderNode(child, i))}
        </ul>
      );

    case "orderedList":
      return (
        <ol key={key} className="mb-4 list-decimal pl-6 space-y-1 font-serif text-lg">
          {node.content?.map((child, i) => renderNode(child, i))}
        </ol>
      );

    case "listItem":
      return (
        <li key={key} className="leading-[1.8]">
          {node.content?.map((child, i) => renderNode(child, i))}
        </li>
      );

    case "text":
      return (
        <span key={key}>{renderMarks(node.text ?? "", node.marks)}</span>
      );

    case "hardBreak":
      return <br key={key} />;

    default:
      return node.content?.map((child, i) => renderNode(child, i)) ?? null;
  }
}

interface ManuscriptViewerProps {
  content: TiptapNode | null;
}

export function ManuscriptViewer({ content }: ManuscriptViewerProps) {
  const t = useTranslations("editor.viewer");
  if (!content) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <p className="text-sm">{t("emptyState")}</p>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-2xl px-4 py-8">
      {renderNode(content, 0)}
    </article>
  );
}
