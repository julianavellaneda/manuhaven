"use client";

export default function GlobalError({
  reset,
}: {
  // Next.js passes `error` too; this boundary shows a generic message rather
  // than leaking a stack trace, so it does not read it.
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            className="text-sm underline underline-offset-4"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
