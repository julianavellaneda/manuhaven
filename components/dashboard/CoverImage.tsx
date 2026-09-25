"use client";

import { useState } from "react";

interface CoverImageProps {
  src: string;
  alt: string;
  fallbackLetter: string;
}

export function CoverImage({ src, alt, fallbackLetter }: CoverImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-[oklch(0.28_0.04_200)] to-[oklch(0.37_0.04_200)]">
        <span className="font-serif text-lg font-medium text-white/80">
          {fallbackLetter}
        </span>
      </div>
    );
  }

  return (
    // Not next/image: its optimizer fetches the file server-side without the
    // viewer's session cookie, and /api/files answers that with a 401.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}
