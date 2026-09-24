CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"kind" text NOT NULL,
	"model" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "assistant_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" jsonb NOT NULL,
	"tool_calls" jsonb,
	"input_tokens" integer,
	"output_tokens" integer,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_messages_role_check" CHECK ("assistant_messages"."role" in ('user','assistant','tool'))
);
--> statement-breakpoint
CREATE TABLE "exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"format" text NOT NULL,
	"template_id" uuid,
	"file_key" text,
	"file_size_bytes" bigint,
	"status" text DEFAULT 'pending',
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exports_format_check" CHECK ("exports"."format" in ('epub','pdf','mobi')),
	CONSTRAINT "exports_status_check" CHECK ("exports"."status" in ('pending','processing','complete','failed'))
);
--> statement-breakpoint
CREATE TABLE "manuscripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"file_key" text,
	"file_type" text,
	"tiptap_json" jsonb,
	"word_count" integer DEFAULT 0,
	"chapters" jsonb,
	"writing_stats" jsonb DEFAULT '{"sessions":{},"dailyGoal":500}'::jsonb NOT NULL,
	"story_bible" jsonb,
	"editorial_report" jsonb,
	"style_analysis" jsonb,
	"last_ai_metadata_at" timestamp with time zone,
	"last_ai_editorial_at" timestamp with time zone,
	"last_ai_continuity_at" timestamp with time zone,
	"last_saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manuscripts_project_id_unique" UNIQUE("project_id"),
	CONSTRAINT "manuscripts_file_type_check" CHECK ("manuscripts"."file_type" in ('docx','txt','paste'))
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"email" text,
	"pen_name" text,
	"genre_interest" text,
	"book_status" text,
	"theme_preference" text DEFAULT 'system',
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_book_status_check" CHECK ("profiles"."book_status" is null or "profiles"."book_status" in ('not_started','drafting','revising','complete')),
	CONSTRAINT "profiles_theme_preference_check" CHECK ("profiles"."theme_preference" is null or "profiles"."theme_preference" in ('light','dark','system'))
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"author_name" text,
	"genre" text,
	"status" text DEFAULT 'draft',
	"cover_key" text,
	"description" text,
	"isbn" text,
	"language" text DEFAULT 'en',
	"ai_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_status_check" CHECK ("projects"."status" in ('draft','formatting','review','publishing','live','archived'))
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "royalties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"retailer" text NOT NULL,
	"territory" text,
	"units_sold" integer DEFAULT 0,
	"units_returned" integer DEFAULT 0,
	"revenue" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'USD',
	"revenue_usd" numeric(12, 2),
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"settlement_status" text,
	"expected_payout_date" date,
	"source_type" text NOT NULL,
	"source_file_id" uuid,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "royalties_user_period_key" UNIQUE NULLS NOT DISTINCT("user_id","project_id","retailer","territory","period_start","period_end"),
	CONSTRAINT "royalties_settlement_status_check" CHECK ("royalties"."settlement_status" is null or "royalties"."settlement_status" in ('pending','invoiced','paid')),
	CONSTRAINT "royalties_source_type_check" CHECK ("royalties"."source_type" in ('api','csv_upload'))
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"genre" text NOT NULL,
	"css_url" text NOT NULL,
	"thumbnail_url" text,
	"description" text,
	"supports_epub" boolean DEFAULT true,
	"supports_pdf" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "templates_genre_unique" UNIQUE("genre")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_ai_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"provider" text,
	"chat_model" text,
	"utility_model" text,
	"api_key_cipher" text,
	"api_key_hint" text,
	"autonomy" text DEFAULT 'lite' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_ai_settings_provider_check" CHECK ("user_ai_settings"."provider" is null or "user_ai_settings"."provider" in ('anthropic','openai','google')),
	CONSTRAINT "user_ai_settings_autonomy_check" CHECK ("user_ai_settings"."autonomy" in ('off','lite','editorial','collaborator'))
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_conversation_id_assistant_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."assistant_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuscripts" ADD CONSTRAINT "manuscripts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_user_id_fk" FOREIGN KEY ("id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "royalties" ADD CONSTRAINT "royalties_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "royalties" ADD CONSTRAINT "royalties_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ai_settings" ADD CONSTRAINT "user_ai_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_usage_events_user_created_idx" ON "ai_usage_events" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "assistant_conversations_project_idx" ON "assistant_conversations" USING btree ("project_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "assistant_conversations_user_idx" ON "assistant_conversations" USING btree ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "assistant_messages_conversation_idx" ON "assistant_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "exports_project_id_format_idx" ON "exports" USING btree ("project_id","format");--> statement-breakpoint
CREATE INDEX "manuscripts_last_saved_at_idx" ON "manuscripts" USING btree ("last_saved_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "manuscripts_last_ai_metadata_at_idx" ON "manuscripts" USING btree ("last_ai_metadata_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "manuscripts_last_ai_editorial_at_idx" ON "manuscripts" USING btree ("last_ai_editorial_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "manuscripts_last_ai_continuity_at_idx" ON "manuscripts" USING btree ("last_ai_continuity_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "projects_user_id_status_idx" ON "projects" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "royalties_user_id_period_idx" ON "royalties" USING btree ("user_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "royalties_project_id_retailer_idx" ON "royalties" USING btree ("project_id","retailer");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");