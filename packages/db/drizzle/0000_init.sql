-- FrameVid initial schema (run once against production Postgres)
CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(255) NOT NULL UNIQUE,
  "name" varchar(255),
  "avatar_url" text,
  "password_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "slug" varchar(255) NOT NULL UNIQUE,
  "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "plan" varchar(50) DEFAULT 'free' NOT NULL,
  "storage_used_bytes" bigint DEFAULT 0 NOT NULL,
  "bandwidth_used_bytes" bigint DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "workspace_members" (
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "role" varchar(50) NOT NULL,
  "invited_at" timestamp with time zone DEFAULT now() NOT NULL,
  "accepted_at" timestamp with time zone,
  PRIMARY KEY ("workspace_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "videos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "title" varchar(255) NOT NULL,
  "description" text,
  "status" varchar(50) DEFAULT 'uploading' NOT NULL,
  "duration_seconds" double precision,
  "size_bytes" bigint,
  "original_filename" varchar(255) NOT NULL,
  "hls_manifest_url" text,
  "thumbnail_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "poster_url" text,
  "captions_url" text,
  "settings" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "folders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "name" varchar(255) NOT NULL,
  "parent_folder_id" uuid REFERENCES "folders"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "video_folders" (
  "video_id" uuid NOT NULL REFERENCES "videos"("id") ON DELETE cascade,
  "folder_id" uuid NOT NULL REFERENCES "folders"("id") ON DELETE cascade,
  PRIMARY KEY ("video_id", "folder_id")
);

CREATE TABLE IF NOT EXISTS "video_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "video_id" uuid NOT NULL REFERENCES "videos"("id") ON DELETE cascade,
  "event_type" varchar(50) NOT NULL,
  "progress_pct" double precision,
  "tracking_label" varchar(255),
  "session_id" varchar(255),
  "device_type" varchar(50),
  "country" varchar(50),
  "referrer_domain" varchar(255),
  "event_data" jsonb,
  "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "videos_workspace_id_idx" ON "videos" ("workspace_id");
CREATE INDEX IF NOT EXISTS "video_events_video_id_idx" ON "video_events" ("video_id");
CREATE INDEX IF NOT EXISTS "video_events_timestamp_idx" ON "video_events" ("timestamp");
