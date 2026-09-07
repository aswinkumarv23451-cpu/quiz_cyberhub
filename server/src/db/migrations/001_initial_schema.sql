-- ============================================================================
-- Migration: 001_initial_schema.sql
-- Module 2: Database Architecture — Round 1 Technology Competition Platform
-- Schema Version: 3 (approved)
--
-- Tables: event, users, teams, team_members, questions, attempts, answers, otp_codes
-- ============================================================================

-- ============================================================================
-- UTILITY: Automatic updated_at trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABLE 1: event
-- Lifecycle: READY → LIVE → ENDED
-- Scoring configuration: correct_marks, wrong_marks, skip_marks
-- ============================================================================

CREATE TABLE IF NOT EXISTS event (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  status          VARCHAR(20)  NOT NULL DEFAULT 'READY'
                    CONSTRAINT chk_event_status CHECK (status IN ('READY', 'LIVE', 'ENDED')),
  correct_marks   INTEGER      NOT NULL DEFAULT 10,
  wrong_marks     INTEGER      NOT NULL DEFAULT -5,
  skip_marks      INTEGER      NOT NULL DEFAULT -10,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_event_updated_at ON event;
CREATE TRIGGER trg_event_updated_at
  BEFORE UPDATE ON event
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 2: users
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  email           VARCHAR(255) NOT NULL
                    CONSTRAINT uq_users_email UNIQUE,
  phone           VARCHAR(20),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 3: teams
-- No team_lead_id column — lead is identified via team_members.role = 'TEAM_LEAD'
-- ============================================================================

CREATE TABLE IF NOT EXISTS teams (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(255) NOT NULL,
  event_id              UUID         NOT NULL
                          REFERENCES event(id) ON DELETE CASCADE,
  college               VARCHAR(255) NOT NULL,
  department            VARCHAR(255) NOT NULL,
  registration_status   VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                          CONSTRAINT chk_teams_registration_status
                          CHECK (registration_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  payment_id            VARCHAR(255),
  payment_proof_path    VARCHAR(500),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Composite unique: FK target for team_members and attempts
  CONSTRAINT uq_teams_id_event_id   UNIQUE (id, event_id),
  -- Team names unique within an event
  CONSTRAINT uq_teams_name_event_id UNIQUE (name, event_id)
);

CREATE INDEX IF NOT EXISTS idx_teams_event_id ON teams(event_id);

DROP TRIGGER IF EXISTS trg_teams_updated_at ON teams;
CREATE TRIGGER trg_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 4: team_members
-- Role-based lead identification: role = 'TEAM_LEAD' | 'MEMBER'
-- Partial unique index enforces exactly one TEAM_LEAD per team
-- Composite FK ensures event_id always matches the team's event
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_members (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id           UUID         NOT NULL,
  user_id           UUID         NOT NULL
                      REFERENCES users(id) ON DELETE CASCADE,
  event_id          UUID         NOT NULL,
  register_number   VARCHAR(50)  NOT NULL,
  role              VARCHAR(10)  NOT NULL
                      CONSTRAINT chk_team_members_role
                      CHECK (role IN ('TEAM_LEAD', 'MEMBER')),
  joined_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Composite FK: guarantees event_id matches the team's event
  CONSTRAINT fk_team_members_team_event
    FOREIGN KEY (team_id, event_id)
    REFERENCES teams(id, event_id) ON DELETE CASCADE,

  -- A user cannot be added to the same team twice
  CONSTRAINT uq_team_members_team_user UNIQUE (team_id, user_id),

  -- A user can only belong to one team per event
  CONSTRAINT uq_team_members_user_event UNIQUE (user_id, event_id)
);

-- Exactly one TEAM_LEAD per team (partial unique index)
-- Database enforces at-most-one; application enforces at-least-one during registration
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_lead_per_team
  ON team_members(team_id)
  WHERE role = 'TEAM_LEAD';

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

-- ============================================================================
-- TABLE 5: questions
-- correct_option is SERVER-SIDE ONLY — never expose in participant-facing APIs
-- Scoring is event-level (event.correct_marks, event.wrong_marks, event.skip_marks)
-- ============================================================================

CREATE TABLE IF NOT EXISTS questions (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID         NOT NULL
                        REFERENCES event(id) ON DELETE CASCADE,
  question_text       TEXT         NOT NULL,
  option_a            TEXT         NOT NULL,
  option_b            TEXT         NOT NULL,
  option_c            TEXT         NOT NULL,
  option_d            TEXT         NOT NULL,
  correct_option      CHAR(1)      NOT NULL
                        CONSTRAINT chk_questions_correct_option
                        CHECK (correct_option IN ('A', 'B', 'C', 'D')),
  time_limit_seconds  INTEGER      NOT NULL DEFAULT 30
                        CONSTRAINT chk_questions_time_limit
                        CHECK (time_limit_seconds > 0),
  question_order      INTEGER      NOT NULL
                        CONSTRAINT chk_questions_order
                        CHECK (question_order > 0),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Composite unique: FK target for answers
  CONSTRAINT uq_questions_id_event_id UNIQUE (id, event_id),
  -- No duplicate ordering within an event
  CONSTRAINT uq_questions_event_order UNIQUE (event_id, question_order)
);

CREATE INDEX IF NOT EXISTS idx_questions_event_id ON questions(event_id);

DROP TRIGGER IF EXISTS trg_questions_updated_at ON questions;
CREATE TRIGGER trg_questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 6: attempts
-- UNIQUE(team_id) enforces one quiz attempt per team at the database level
-- Composite FK ensures attempt's event matches team's event
-- ============================================================================

CREATE TABLE IF NOT EXISTS attempts (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID         NOT NULL,
  event_id        UUID         NOT NULL,
  started_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  total_score     INTEGER      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Composite FK: attempt's event always matches team's event
  CONSTRAINT fk_attempts_team_event
    FOREIGN KEY (team_id, event_id)
    REFERENCES teams(id, event_id) ON DELETE CASCADE,

  -- One quiz attempt per team (database-level enforcement)
  CONSTRAINT uq_attempts_team_id UNIQUE (team_id),

  -- Composite unique: FK target for answers
  CONSTRAINT uq_attempts_id_event_id UNIQUE (id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_attempts_event_id ON attempts(event_id);

DROP TRIGGER IF EXISTS trg_attempts_updated_at ON attempts;
CREATE TRIGGER trg_attempts_updated_at
  BEFORE UPDATE ON attempts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 7: answers
-- Cross-event prevention: event_id constrained by TWO composite FKs
--   (attempt_id, event_id) → attempts(id, event_id)
--   (question_id, event_id) → questions(id, event_id)
-- Both must agree on the same event_id
-- ============================================================================

CREATE TABLE IF NOT EXISTS answers (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id        UUID         NOT NULL,
  question_id       UUID         NOT NULL,
  event_id          UUID         NOT NULL,
  selected_option   CHAR(1)
                      CONSTRAINT chk_answers_selected_option
                      CHECK (selected_option IN ('A', 'B', 'C', 'D')),
  status            VARCHAR(10)  NOT NULL DEFAULT 'skipped'
                      CONSTRAINT chk_answers_status
                      CHECK (status IN ('correct', 'wrong', 'skipped')),
  marks_awarded     INTEGER      NOT NULL DEFAULT 0,
  answered_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Composite FK: ensures answer belongs to same event as attempt
  CONSTRAINT fk_answers_attempt_event
    FOREIGN KEY (attempt_id, event_id)
    REFERENCES attempts(id, event_id) ON DELETE CASCADE,

  -- Composite FK: ensures question belongs to same event as attempt
  CONSTRAINT fk_answers_question_event
    FOREIGN KEY (question_id, event_id)
    REFERENCES questions(id, event_id) ON DELETE CASCADE,

  -- One answer per question per attempt
  CONSTRAINT uq_answers_attempt_question UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_answers_attempt_id ON answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);

-- ============================================================================
-- TABLE 8: otp_codes
-- otp_hash ONLY — never store plaintext OTPs
-- Application must hash before INSERT, compare hashes on verification
-- ============================================================================

CREATE TABLE IF NOT EXISTS otp_codes (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL
                    REFERENCES users(id) ON DELETE CASCADE,
  otp_hash        VARCHAR(255) NOT NULL,
  purpose         VARCHAR(20)  NOT NULL
                    CONSTRAINT chk_otp_codes_purpose
                    CHECK (purpose IN ('login', 'registration', 'verification')),
  expires_at      TIMESTAMPTZ  NOT NULL,
  is_used         BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_user_id ON otp_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes(expires_at);

-- ============================================================================
-- END OF MIGRATION 001
-- ============================================================================
