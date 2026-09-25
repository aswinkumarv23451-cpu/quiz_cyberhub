-- Migration 003: Add whatsapp_group_joined confirmation to teams table
-- Stores participant confirmation that they have joined the official WhatsApp group

ALTER TABLE teams
ADD COLUMN IF NOT EXISTS whatsapp_group_joined BOOLEAN NOT NULL DEFAULT FALSE;
