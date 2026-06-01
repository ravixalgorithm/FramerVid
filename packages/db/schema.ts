import { pgTable, text, timestamp, uuid, varchar, bigint, doublePrecision, jsonb, primaryKey } from 'drizzle-orm/pg-core';
import type { VideoStatus, VideoSettings, WorkspacePlan } from '@framevid/types';

// Users Table (Custom Auth - password-based signups)
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  name: varchar('name', { length: 255 }),
  avatarUrl: text('avatar_url'),
  passwordHash: text('password_hash').notNull(), // Added for custom signup
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Workspaces Table
export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).unique().notNull(),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  plan: varchar('plan', { length: 50 }).default('free').notNull().$type<WorkspacePlan>(),
  storageUsedBytes: bigint('storage_used_bytes', { mode: 'number' }).default(0).notNull(),
  bandwidthUsedBytes: bigint('bandwidth_used_bytes', { mode: 'number' }).default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Workspace Memberships Table
export const workspaceMembers = pgTable('workspace_members', {
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 50 }).notNull().$type<'admin' | 'editor' | 'viewer'>(),
  invitedAt: timestamp('invited_at', { withTimezone: true }).defaultNow().notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.workspaceId, table.userId] }),
  };
});

// Videos Table
export const videos = pgTable('videos', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).default('uploading').notNull().$type<VideoStatus>(),
  durationSeconds: doublePrecision('duration_seconds'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  originalFilename: varchar('original_filename', { length: 255 }).notNull(),
  hlsManifestUrl: text('hls_manifest_url'),
  thumbnailUrls: jsonb('thumbnail_urls').default([]).notNull().$type<string[]>(),
  posterUrl: text('poster_url'),
  captionsUrl: text('captions_url'),
  settings: jsonb('settings').notNull().$type<VideoSettings>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Folders Table
export const folders = pgTable('folders', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  parentFolderId: uuid('parent_folder_id').references((): any => folders.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Video Folders Association Table
export const videoFolders = pgTable('video_folders', {
  videoId: uuid('video_id').references(() => videos.id, { onDelete: 'cascade' }).notNull(),
  folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'cascade' }).notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.videoId, table.folderId] }),
  };
});

// Analytics Events Table (for local/fallback if ClickHouse is missing)
export const videoEvents = pgTable('video_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  videoId: uuid('video_id').references(() => videos.id, { onDelete: 'cascade' }).notNull(),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  progressPct: doublePrecision('progress_pct'),
  trackingLabel: varchar('tracking_label', { length: 255 }),
  sessionId: varchar('session_id', { length: 255 }),
  deviceType: varchar('device_type', { length: 50 }),
  country: varchar('country', { length: 50 }),
  referrerDomain: varchar('referrer_domain', { length: 255 }),
  eventData: jsonb('event_data'),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
});
