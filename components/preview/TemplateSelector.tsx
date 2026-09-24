"use client";

import { useState, useCallback } from "react";
import { TemplateCard } from "./TemplateCard";
import { BookPreview } from "./BookPreview";
import { ExportActions } from "./ExportActions";
import type { ExportedFiles } from "./ExportActions";

interface Template {
  id: string;
  name: string;
  genre: string;
  description: string | null;
  supportsEpub: boolean | null;
  supportsPdf: boolean | null;
}

interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

interface TemplateSelectorProps {
  templates: Template[];
  content: TiptapNode | null;
  projectId: string;
  projectTitle?: string;
}

export function TemplateSelector({
  templates,
  content,
  projectId,
  projectTitle,
}: TemplateSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    templates[0]?.id ?? null
  );
  const [exportedFiles, setExportedFiles] = useState<ExportedFiles>({});
  const selected = templates.find((t) => t.id === selectedId) ?? null;

  const handleExportComplete = useCallback((files: ExportedFiles) => {
    setExportedFiles(files);
  }, []);

  // Reset exported files when template changes
  const handleTemplateSelect = useCallback((id: string) => {
    setSelectedId(id);
    setExportedFiles({});
  }, []);

  return (
    <div className="flex gap-6">
      {/* Template list */}
      <div className="w-72 shrink-0 space-y-4">
        <h2 className="font-serif text-lg font-semibold text-foreground">
          Visual Styles
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              name={template.name}
              description={template.description}
              genre={template.genre}
              isSelected={template.id === selectedId}
              onSelect={() => handleTemplateSelect(template.id)}
            />
          ))}
        </div>
        <ExportActions
          projectId={projectId}
          templateId={selectedId}
          supportsEpub={selected?.supportsEpub ?? true}
          supportsPdf={selected?.supportsPdf ?? true}
          onExportComplete={handleExportComplete}
        />
      </div>

      {/* Preview pane */}
      <div className="flex-1">
        <BookPreview
          content={content}
          templateName={selected?.name ?? null}
          exportedFiles={exportedFiles}
          projectTitle={projectTitle}
        />
      </div>
    </div>
  );
}
