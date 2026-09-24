export const GENRES = [
  "romance",
  "thriller",
  "fantasy",
  "scifi",
  "literary",
  "other",
] as const;

export type Genre = (typeof GENRES)[number];

export type ProjectStatus =
  | "draft"
  | "formatting"
  | "review"
  | "publishing"
  | "live"
  | "archived";

export const MAX_MANUSCRIPT_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_COVER_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const SUPPORTED_MANUSCRIPT_TYPES = ["docx", "txt"] as const;
export const SUPPORTED_COVER_TYPES = ["jpg", "jpeg", "png", "webp"] as const;

// BISAC fiction codes — used by AI metadata generation
export const BISAC_FICTION_CODES = [
  { code: "FIC027000", label: "Romance" },
  { code: "FIC031000", label: "Thrillers" },
  { code: "FIC009000", label: "Fantasy" },
  { code: "FIC028000", label: "Science Fiction" },
  { code: "FIC019000", label: "Literary" },
  { code: "FIC014000", label: "Historical" },
  { code: "FIC022000", label: "Mystery & Detective" },
  { code: "FIC004000", label: "Classics" },
  { code: "FIC015000", label: "Horror" },
  { code: "FIC024000", label: "Occult & Supernatural" },
  { code: "FIC050000", label: "Crime" },
  { code: "FIC030000", label: "Suspense" },
  { code: "FIC042000", label: "Christian" },
  { code: "FIC016000", label: "Humorous" },
  { code: "FIC045000", label: "Family Life" },
  { code: "FIC029000", label: "Short Stories" },
] as const;

export const BISAC_CODE_SET: ReadonlySet<string> = new Set(
  BISAC_FICTION_CODES.map((b) => b.code)
);
