-- Migration: Add project_owner and previous_progress to tasks table
-- These columns are defined in schema.prisma but were never applied to the database

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "project_owner" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "previous_progress" INTEGER NOT NULL DEFAULT 0;
