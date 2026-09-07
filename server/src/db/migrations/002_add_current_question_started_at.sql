-- Migration 002: Add current_question_started_at to attempts table
-- Enables persistent server-authoritative timer tracking across restarts and reconnections

ALTER TABLE attempts
ADD COLUMN current_question_started_at TIMESTAMPTZ;
