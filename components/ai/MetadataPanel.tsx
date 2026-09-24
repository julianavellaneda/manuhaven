"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AIMetadataResult } from "@/lib/ai/metadata";

interface Props {
  projectId: string;
  savedMetadata?: AIMetadataResult;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="whitespace-pre-wrap rounded border bg-muted/30 p-3 text-sm">
        {value}
      </p>
    </div>
  );
}

export function MetadataPanel({ projectId, savedMetadata }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AIMetadataResult | null>(savedMetadata ?? null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to generate metadata");
      }
      setResult(body.metadata);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }


  return (
    <Card className="p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">AI Metadata Package</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate 7 Amazon keywords, BISAC codes, a tagline, and two back-cover
            blurbs from your manuscript.
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={loading}>
          {loading ? "Generating…" : result ? "Regenerate" : "Generate Metadata"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Your manuscript is processed in real-time and never stored by our AI
        provider.
      </p>

      {error && (
        <p className="mt-4 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          <CopyField label="Tagline" value={result.tagline} />
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Keywords
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {result.keywords.map((k) => (
                <span
                  key={k}
                  className="rounded-full border bg-muted/30 px-3 py-1 text-xs"
                >
                  {k}
                </span>
              ))}
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard.writeText(result.keywords.join(", "))
                }
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Copy all
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <CopyField label="BISAC Primary" value={result.bisacPrimary} />
            <CopyField label="BISAC Secondary" value={result.bisacSecondary} />
          </div>
          <CopyField label="Short Blurb (100 words)" value={result.blurbShort} />
          <CopyField label="Long Blurb (250 words)" value={result.blurbLong} />
        </div>
      )}
    </Card>
  );
}
