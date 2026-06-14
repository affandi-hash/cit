-- Add post metadata columns to cases table
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS post_owner_name text,
  ADD COLUMN IF NOT EXISTS post_datetime timestamptz,
  ADD COLUMN IF NOT EXISTS emoji_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS post_comments integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS post_shares integer DEFAULT 0;
