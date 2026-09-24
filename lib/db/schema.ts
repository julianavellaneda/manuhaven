// ManuHaven database schema (Drizzle). The SQL in drizzle/ is generated from
// this file with `bun run db:generate`; never edit a generated migration.
//
// No "server-only" import here: drizzle-kit loads this file outside Next.js.
// It holds table definitions only, no connection, so it is safe to import
// for types anywhere.
//
// Ownership is enforced in the app layer (lib/db/queries/), not with RLS:
// every user-owned row cascades from "user", so deleting the user deletes
// everything they own.

import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import type { ProjectStatus } from "../constants";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ------------------------------------------------------------
// Better Auth core tables. Better Auth's Drizzle adapter maps its fields
// through the property names below, so the columns can stay snake_case. IDs
// are UUIDs (Better Auth's `advanced.database.generateId: "uuid"`), which
// lets every domain FK stay a uuid column.
// ------------------------------------------------------------
export const user = pgTable("user", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: id(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: id(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// Better Auth's rate limiter with `rateLimit.storage: "database"`, so limits
// survive a restart. lastRequest is epoch milliseconds.
export const rateLimit = pgTable("rate_limit", {
  id: id(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// ------------------------------------------------------------
// profiles: app-side user data, 1:1 with "user". Created by a Better Auth
// databaseHooks.user.create.after hook (replaces the old auth.users trigger).
// ------------------------------------------------------------
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    email: text("email"),
    penName: text("pen_name"),
    genreInterest: text("genre_interest"),
    bookStatus: text("book_status"),
    themePreference: text("theme_preference").default("system"),
    onboardingCompletedAt: timestamp("onboarding_completed_at", {
      withTimezone: true,
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "profiles_book_status_check",
      sql`${t.bookStatus} is null or ${t.bookStatus} in ('not_started','drafting','revising','complete')`,
    ),
    check(
      "profiles_theme_preference_check",
      sql`${t.themePreference} is null or ${t.themePreference} in ('light','dark','system')`,
    ),
  ],
);

// ------------------------------------------------------------
// projects
// ------------------------------------------------------------
export const projects = pgTable(
  "projects",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    authorName: text("author_name"),
    genre: text("genre"),
    status: text("status").$type<ProjectStatus>().default("draft"),
    // A lib/storage key, never a URL. Clients load it via /api/files/.
    coverKey: text("cover_key"),
    description: text("description"),
    isbn: text("isbn"),
    language: text("language").default("en"),
    aiMetadata: jsonb("ai_metadata"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("projects_user_id_status_idx").on(t.userId, t.status),
    check(
      "projects_status_check",
      sql`${t.status} in ('draft','formatting','review','publishing','live','archived')`,
    ),
  ],
);

// ------------------------------------------------------------
// manuscripts: one per project. tiptap_json is the manuscript body; the AI
// columns cache generated analysis, and the last_ai_* stamps drive
// per-manuscript cooldowns when the server supplies the API key.
// ------------------------------------------------------------
export const manuscripts = pgTable(
  "manuscripts",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .unique()
      .references(() => projects.id, { onDelete: "cascade" }),
    // The original upload, as a lib/storage key.
    fileKey: text("file_key"),
    fileType: text("file_type"),
    tiptapJson: jsonb("tiptap_json"),
    wordCount: integer("word_count").default(0),
    chapters: jsonb("chapters"),
    writingStats: jsonb("writing_stats")
      .notNull()
      .default(sql`'{"sessions":{},"dailyGoal":500}'::jsonb`),
    storyBible: jsonb("story_bible"),
    editorialReport: jsonb("editorial_report"),
    styleAnalysis: jsonb("style_analysis"),
    lastAiMetadataAt: timestamp("last_ai_metadata_at", { withTimezone: true }),
    lastAiEditorialAt: timestamp("last_ai_editorial_at", { withTimezone: true }),
    lastAiContinuityAt: timestamp("last_ai_continuity_at", {
      withTimezone: true,
    }),
    lastSavedAt: timestamp("last_saved_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("manuscripts_last_saved_at_idx").on(t.lastSavedAt.desc()),
    index("manuscripts_last_ai_metadata_at_idx").on(t.lastAiMetadataAt.desc()),
    index("manuscripts_last_ai_editorial_at_idx").on(
      t.lastAiEditorialAt.desc(),
    ),
    index("manuscripts_last_ai_continuity_at_idx").on(
      t.lastAiContinuityAt.desc(),
    ),
    check(
      "manuscripts_file_type_check",
      sql`${t.fileType} in ('docx','txt','paste')`,
    ),
  ],
);

// ------------------------------------------------------------
// templates: genre CSS templates for EPUB/PDF rendering. Global and seeded
// by the custom migration in drizzle/. `genre` is load-bearing: the convert
// routes lowercase it to name a CSS file in services/converter/templates/,
// and the converter rejects anything outside its VALID_TEMPLATES list.
// ------------------------------------------------------------
export const templates = pgTable("templates", {
  id: id(),
  name: text("name").notNull(),
  genre: text("genre").notNull().unique(),
  // Where the stylesheet lives in this repo. Informational: the converter
  // reads the file from its own disk.
  cssUrl: text("css_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  description: text("description"),
  supportsEpub: boolean("supports_epub").default(true),
  supportsPdf: boolean("supports_pdf").default(true),
  isActive: boolean("is_active").default(true),
  createdAt: createdAt(),
});

// ------------------------------------------------------------
// exports: one row per EPUB/PDF render. Named bookExports in TS because
// `exports` is reserved in the CommonJS that drizzle-kit transpiles this to.
// ------------------------------------------------------------
export const bookExports = pgTable(
  "exports",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    format: text("format").notNull(),
    templateId: uuid("template_id").references(() => templates.id),
    // The rendered file, as a lib/storage key.
    fileKey: text("file_key"),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
    status: text("status").default("pending"),
    errorMessage: text("error_message"),
    createdAt: createdAt(),
  },
  (t) => [
    index("exports_project_id_format_idx").on(t.projectId, t.format),
    check("exports_format_check", sql`${t.format} in ('epub','pdf','mobi')`),
    check(
      "exports_status_check",
      sql`${t.status} in ('pending','processing','complete','failed')`,
    ),
  ],
);

// ------------------------------------------------------------
// royalties: imported from retailer CSV exports. The upsert key includes
// user_id so one user's import can never collide with another's, and treats
// NULL territories as equal so a re-import updates instead of duplicating.
// ------------------------------------------------------------
export const royalties = pgTable(
  "royalties",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    retailer: text("retailer").notNull(),
    territory: text("territory"),
    unitsSold: integer("units_sold").default(0),
    unitsReturned: integer("units_returned").default(0),
    revenue: numeric("revenue", { precision: 12, scale: 2, mode: "number" })
      .notNull(),
    currency: text("currency").default("USD"),
    revenueUsd: numeric("revenue_usd", {
      precision: 12,
      scale: 2,
      mode: "number",
    }),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    settlementStatus: text("settlement_status"),
    expectedPayoutDate: date("expected_payout_date"),
    sourceType: text("source_type").notNull(),
    sourceFileId: uuid("source_file_id"),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("royalties_user_period_key")
      .on(
        t.userId,
        t.projectId,
        t.retailer,
        t.territory,
        t.periodStart,
        t.periodEnd,
      )
      .nullsNotDistinct(),
    index("royalties_user_id_period_idx").on(
      t.userId,
      t.periodStart,
      t.periodEnd,
    ),
    index("royalties_project_id_retailer_idx").on(t.projectId, t.retailer),
    check(
      "royalties_settlement_status_check",
      sql`${t.settlementStatus} is null or ${t.settlementStatus} in ('pending','invoiced','paid')`,
    ),
    check(
      "royalties_source_type_check",
      sql`${t.sourceType} in ('api','csv_upload')`,
    ),
  ],
);

// ------------------------------------------------------------
// user_ai_settings: bring-your-own-key AI configuration. api_key_cipher is
// an AES-256-GCM ciphertext from lib/ai/key-crypto.ts; the plaintext key
// never reaches the database, and the ciphertext never leaves the server-side
// query layer. api_key_hint is the redacted value the settings UI shows.
// ------------------------------------------------------------
export const userAiSettings = pgTable(
  "user_ai_settings",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider"),
    chatModel: text("chat_model"),
    utilityModel: text("utility_model"),
    apiKeyCipher: text("api_key_cipher"),
    apiKeyHint: text("api_key_hint"),
    autonomy: text("autonomy").notNull().default("lite"),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "user_ai_settings_provider_check",
      sql`${t.provider} is null or ${t.provider} in ('anthropic','openai','google')`,
    ),
    check(
      "user_ai_settings_autonomy_check",
      sql`${t.autonomy} in ('off','lite','editorial','collaborator')`,
    ),
  ],
);

// ------------------------------------------------------------
// assistant_conversations: one chat thread per project
// ------------------------------------------------------------
export const assistantConversations = pgTable(
  "assistant_conversations",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    index("assistant_conversations_project_idx").on(
      t.projectId,
      t.updatedAt.desc(),
    ),
    index("assistant_conversations_user_idx").on(t.userId, t.updatedAt.desc()),
  ],
);

// ------------------------------------------------------------
// assistant_messages: persisted chat turns. content holds message parts
// ({"text": "..."}); manuscript text quoted in a message stays in the
// author's own rows, the same trust boundary as tiptap_json.
// ------------------------------------------------------------
export const assistantMessages = pgTable(
  "assistant_messages",
  {
    id: id(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => assistantConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: jsonb("content").notNull(),
    toolCalls: jsonb("tool_calls"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    model: text("model"),
    createdAt: createdAt(),
  },
  (t) => [
    index("assistant_messages_conversation_idx").on(
      t.conversationId,
      t.createdAt,
    ),
    check(
      "assistant_messages_role_check",
      sql`${t.role} in ('user','assistant','tool')`,
    ),
  ],
);

// ------------------------------------------------------------
// ai_usage_events: token counts only, NEVER text. Powers the per-minute
// throttle. `model` is nullable because the row is claimed before the model
// runs (so concurrent bursts cannot race the throttle) and filled in on
// completion. project_id is set null on project deletion so per-user
// accounting survives; account deletion still cascades via user_id.
// ------------------------------------------------------------
export const aiUsageEvents = pgTable(
  "ai_usage_events",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    kind: text("kind").notNull(),
    model: text("model"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    latencyMs: integer("latency_ms"),
    createdAt: createdAt(),
  },
  (t) => [
    index("ai_usage_events_user_created_idx").on(t.userId, t.createdAt.desc()),
  ],
);
