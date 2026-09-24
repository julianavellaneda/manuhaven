"use client";

import { Button } from "@/components/ui/button";

export default function UploadError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-4 py-12 text-center">
      <h2 className="font-serif text-lg font-semibold text-foreground">
        Something went wrong
      </h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <Button variant="outline" size="sm" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
