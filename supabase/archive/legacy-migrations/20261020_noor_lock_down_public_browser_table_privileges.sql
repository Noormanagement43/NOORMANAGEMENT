-- Applied to NOOR-AI Supabase on 2026-10-20.
-- Browser roles must never be able to TRUNCATE school records; RLS does not protect TRUNCATE.
-- Preserve authenticated role's normal RLS-controlled CRUD and anonymous read-only school discovery.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;
