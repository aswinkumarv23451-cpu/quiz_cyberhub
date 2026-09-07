import { query, getClient } from '../config/database.js';
import { validateQuestionBank } from './admin.question.service.js';

// Test override store for simulated timeout testing (database NOW() is production source of truth)
const testTimeOverrides = new Map();

/**
 * Resets active test timer overrides (useful for test isolation).
 */
export const resetQuizTimers = () => {
  testTimeOverrides.clear();
};

/**
 * Sets an active timer override (useful for testing timeout expiration).
 */
export const setQuizTimerForTest = (attemptId, timer) => {
  if (timer?.startTime) {
    testTimeOverrides.set(attemptId, new Date(timer.startTime));
    query(
      'UPDATE attempts SET current_question_started_at = $1 WHERE id = $2;',
      [timer.startTime, attemptId]
    ).catch(() => {});
  }
};

/**
 * Helper to format safe participant question payload.
 * STRICTLY OMITS correct_option and internal scoring secrets.
 *
 * @param {Object} attempt
 * @param {Object} question
 * @param {number} totalQuestions
 * @param {Date} deadline
 * @returns {Object} Safe participant question data
 */
export const formatParticipantQuestionResponse = (attempt, question, totalQuestions, deadline) => {
  return {
    success: true,
    attemptId: attempt.id,
    question: {
      id: question.id,
      questionText: question.question_text,
      options: {
        A: question.option_a,
        B: question.option_b,
        C: question.option_c,
        D: question.option_d,
      },
      timeLimitSeconds: question.time_limit_seconds,
      questionNumber: question.question_order,
      totalQuestions,
    },
    deadline: deadline instanceof Date ? deadline.toISOString() : new Date(deadline).toISOString(),
  };
};

/**
 * Standard completion payload.
 */
export const getCompletionPayload = () => ({
  success: true,
  completed: true,
  message: 'The round 1 is successfully finished and the results will be announced in the WhatsApp group.',
});

/**
 * Resolves the single authoritative LIVE event for participant quiz access.
 *
 * Rules:
 * - If 0 LIVE events -> check if 1 READY event (returns not started status) or ENDED (returns ended status)
 * - If multiple LIVE events -> fail safely (500)
 * - If 1 LIVE event -> return it
 *
 * @returns {Promise<{ event: Object, notStarted?: boolean, ended?: boolean }>}
 */
export const resolveQuizEvent = async () => {
  const liveSql = `
    SELECT id, name, status, correct_marks, wrong_marks, skip_marks
    FROM event
    WHERE status = 'LIVE';
  `;
  const { rows: liveRows } = await query(liveSql);

  if (liveRows.length > 1) {
    const err = new Error('System configuration error: multiple LIVE events detected. Cannot select target event safely.');
    err.statusCode = 500;
    throw err;
  }

  if (liveRows.length === 1) {
    return { event: liveRows[0] };
  }

  // No LIVE event currently exists. Check for a READY event.
  const readySql = `
    SELECT id, name, status, correct_marks, wrong_marks, skip_marks
    FROM event
    WHERE status = 'READY';
  `;
  const { rows: readyRows } = await query(readySql);
  if (readyRows.length > 0) {
    return { event: readyRows[0], notStarted: true };
  }

  // Check for most recent ENDED event
  const endedSql = `
    SELECT id, name, status, correct_marks, wrong_marks, skip_marks
    FROM event
    WHERE status = 'ENDED'
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  const { rows: endedRows } = await query(endedSql);
  if (endedRows.length > 0) {
    return { event: endedRows[0], ended: true };
  }

  const err = new Error('No competition event found.');
  err.statusCode = 404;
  throw err;
};

/**
 * Resolves the authenticated user's Team Lead team and registration status.
 *
 * @param {string} userId
 * @returns {Promise<{ team: Object, event: Object }>}
 */
export const resolveTeamLeadTeam = async (userId) => {
  const sql = `
    SELECT 
      t.id AS team_id,
      t.name AS team_name,
      t.registration_status,
      e.id AS event_id,
      e.name AS event_name,
      e.status AS event_status,
      e.correct_marks,
      e.wrong_marks,
      e.skip_marks
    FROM team_members tm
    JOIN teams t ON t.id = tm.team_id
    JOIN event e ON e.id = t.event_id
    WHERE tm.user_id = $1
      AND tm.role = 'TEAM_LEAD'
    LIMIT 1;
  `;
  const { rows } = await query(sql, [userId]);
  if (rows.length === 0) {
    const err = new Error('Forbidden. You are not a registered Team Lead.');
    err.statusCode = 403;
    throw err;
  }

  const row = rows[0];
  if (row.registration_status !== 'APPROVED') {
    const err = new Error('Forbidden. Your team registration has not been approved.');
    err.statusCode = 403;
    throw err;
  }

  return {
    team: {
      id: row.team_id,
      name: row.team_name,
      registrationStatus: row.registration_status,
    },
    event: {
      id: row.event_id,
      name: row.event_name,
      status: row.event_status,
      correctMarks: row.correct_marks,
      wrongMarks: row.wrong_marks,
      skipMarks: row.skip_marks,
    },
  };
};

/**
 * Resolves current active question and applies on-demand timeout cascade.
 *
 * Rules:
 * - Inspects ordered questions for the event.
 * - Inspects existing answers for the attempt.
 * - Finds first unanswered question Q_k.
 * - Checks if Q_k deadline has passed against server NOW().
 * - If deadline passed: records Q_k as 'skipped' (-10 marks), advances to Q_k+1,
 *   and establishes Q_k+1's startTime and deadline as:
 *     questionStartTime = server/database NOW()
 *     questionDeadline = questionStartTime + question.time_limit_seconds
 * - Continues until active question with valid deadline is found or all questions complete.
 *
 * @param {Object} dbClient - PostgreSQL client inside transaction
 * @param {Object} attempt - Attempt record (locked with FOR UPDATE)
 * @param {Object} event - Event record
 * @returns {Promise<{ completed: boolean, question?: Object, deadline?: Date, totalQuestions?: number }>}
 */
export const resolveCurrentQuestionAndProcessTimeouts = async (dbClient, attempt, event) => {
  // If attempt already completed, return completion state immediately
  if (attempt.completed_at) {
    return { completed: true };
  }

  // 1. Fetch all questions for this event ordered by question_order ASC
  const qSql = `
    SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option, time_limit_seconds, question_order
    FROM questions
    WHERE event_id = $1
    ORDER BY question_order ASC;
  `;
  const { rows: questions } = await dbClient.query(qSql, [attempt.event_id]);
  const totalQuestions = questions.length;

  if (totalQuestions === 0) {
    const err = new Error('Question bank is empty. Please contact the administrator.');
    err.statusCode = 400;
    throw err;
  }

  // 2. Fetch existing answers for this attempt
  const aSql = `
    SELECT question_id, status, marks_awarded, answered_at, created_at
    FROM answers
    WHERE attempt_id = $1;
  `;
  const { rows: answers } = await dbClient.query(aSql, [attempt.id]);
  const answeredQuestionIds = new Set(answers.map((a) => a.question_id));

  // 3. Find first unanswered question
  let activeIndex = questions.findIndex((q) => !answeredQuestionIds.has(q.id));

  // If all questions are answered, finalize attempt and clear current_question_started_at
  if (activeIndex === -1) {
    await dbClient.query(
      `UPDATE attempts 
       SET completed_at = COALESCE(completed_at, NOW()),
           total_score = (SELECT COALESCE(SUM(marks_awarded), 0) FROM answers WHERE attempt_id = $1),
           current_question_started_at = NULL,
           updated_at = NOW()
       WHERE id = $1;`,
      [attempt.id]
    );
    return { completed: true };
  }

  // Ensure current_question_started_at is initialized in PostgreSQL database
  if (!attempt.current_question_started_at) {
    const initRes = await dbClient.query(
      `UPDATE attempts 
       SET current_question_started_at = NOW(), updated_at = NOW() 
       WHERE id = $1 
       RETURNING current_question_started_at;`,
      [attempt.id]
    );
    attempt.current_question_started_at = initRes.rows[0].current_question_started_at;
  }

  const now = new Date();

  // 4. Cascade timeouts iteratively using persisted current_question_started_at
  while (activeIndex < totalQuestions) {
    const currentQ = questions[activeIndex];
    const testOverride = testTimeOverrides.get(attempt.id);
    const qStartTime = testOverride || new Date(attempt.current_question_started_at);
    const deadline = new Date(qStartTime.getTime() + currentQ.time_limit_seconds * 1000);

    // Check if current question has timed out
    if (now > deadline) {
      testTimeOverrides.delete(attempt.id);

      // Record SKIPPED for timeout
      await dbClient.query(
        `INSERT INTO answers (attempt_id, question_id, event_id, selected_option, status, marks_awarded, answered_at, created_at)
         VALUES ($1, $2, $3, NULL, 'skipped', $4, $5, $5)
         ON CONFLICT (attempt_id, question_id) DO NOTHING;`,
        [attempt.id, currentQ.id, attempt.event_id, event.skipMarks, deadline]
      );

      await dbClient.query(
        `UPDATE attempts 
         SET total_score = total_score + $1, updated_at = NOW() 
         WHERE id = $2;`,
        [event.skipMarks, attempt.id]
      );

      answeredQuestionIds.add(currentQ.id);

      // Advance to next question
      activeIndex++;
      if (activeIndex >= totalQuestions) {
        // All questions exhausted
        await dbClient.query(
          `UPDATE attempts 
           SET completed_at = NOW(),
               total_score = (SELECT COALESCE(SUM(marks_awarded), 0) FROM answers WHERE attempt_id = $1),
               current_question_started_at = NULL,
               updated_at = NOW()
           WHERE id = $1;`,
          [attempt.id]
        );
        return { completed: true };
      }

      // Establish next question's timing in PostgreSQL database NOW()
      const advRes = await dbClient.query(
        `UPDATE attempts 
         SET current_question_started_at = NOW(), updated_at = NOW() 
         WHERE id = $1 
         RETURNING current_question_started_at;`,
        [attempt.id]
      );
      attempt.current_question_started_at = advRes.rows[0].current_question_started_at;
      // Continue loop to verify next question against current time
    } else {
      // Current question is active and within deadline
      return {
        completed: false,
        question: currentQ,
        deadline,
        totalQuestions,
      };
    }
  }

  // All questions handled
  await dbClient.query(
    `UPDATE attempts 
     SET completed_at = NOW(),
         total_score = (SELECT COALESCE(SUM(marks_awarded), 0) FROM answers WHERE attempt_id = $1),
         current_question_started_at = NULL,
         updated_at = NOW()
     WHERE id = $1;`,
    [attempt.id]
  );
  return { completed: true };
};

/**
 * Starts or resumes a quiz attempt for the authenticated Team Lead.
 *
 * @param {string} userId
 * @returns {Promise<Object>} Safe response payload
 */
export const startQuizAttempt = async (userId) => {
  const { team, event } = await resolveTeamLeadTeam(userId);

  // Check event status
  if (event.status === 'READY') {
    return {
      success: false,
      notStarted: true,
      message: 'Round 1 has not started yet. Please wait for the organizer.',
    };
  }

  if (event.status === 'ENDED') {
    // Check if team already completed attempt
    const checkAttempt = await query(
      'SELECT completed_at FROM attempts WHERE team_id = $1;',
      [team.id]
    );
    if (checkAttempt.rows.length > 0 && checkAttempt.rows[0].completed_at) {
      return getCompletionPayload();
    }
    const err = new Error('Round 1 has ended. Quiz participation is closed.');
    err.statusCode = 403;
    throw err;
  }

  if (event.status !== 'LIVE') {
    const err = new Error(`Cannot start quiz: event is in '${event.status}' state.`);
    err.statusCode = 409;
    throw err;
  }

  // Ensure system configuration safety: at most 1 LIVE event allowed
  const { rows: liveCheck } = await query("SELECT COUNT(*)::int AS count FROM event WHERE status = 'LIVE';");
  if (liveCheck[0].count > 1) {
    const err = new Error('System configuration error: multiple LIVE events detected. Cannot select target event safely.');
    err.statusCode = 500;
    throw err;
  }

  // Verify valid question bank before starting attempt
  const qCountRes = await query(
    'SELECT COUNT(*)::int AS count FROM questions WHERE event_id = $1;',
    [event.id]
  );
  if (qCountRes.rows[0].count === 0) {
    const err = new Error('Question bank is empty. Please contact the administrator.');
    err.statusCode = 400;
    throw err;
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Race-safe attempt check or insert with row lock
    let { rows: existingRows } = await client.query(
      `SELECT id, team_id, event_id, started_at, completed_at, total_score, current_question_started_at
       FROM attempts
       WHERE team_id = $1
       FOR UPDATE;`,
      [team.id]
    );

    let attempt;
    if (existingRows.length > 0) {
      attempt = existingRows[0];
    } else {
      // Insert with ON CONFLICT DO NOTHING to guarantee exactly 1 attempt per team
      const insertRes = await client.query(
        `INSERT INTO attempts (team_id, event_id, started_at, total_score, current_question_started_at)
         VALUES ($1, $2, NOW(), 0, NOW())
         ON CONFLICT (team_id) DO NOTHING
         RETURNING id, team_id, event_id, started_at, completed_at, total_score, current_question_started_at;`,
        [team.id, event.id]
      );

      if (insertRes.rows.length > 0) {
        attempt = insertRes.rows[0];
      } else {
        // Handled race condition: fetch the row created by simultaneous request
        const refetch = await client.query(
          `SELECT id, team_id, event_id, started_at, completed_at, total_score, current_question_started_at
           FROM attempts
           WHERE team_id = $1
           FOR UPDATE;`,
          [team.id]
        );
        attempt = refetch.rows[0];
      }
    }

    // 2. Resolve current question and handle any timeouts
    const state = await resolveCurrentQuestionAndProcessTimeouts(client, attempt, event);
    await client.query('COMMIT');

    if (state.completed) {
      return getCompletionPayload();
    }

    return formatParticipantQuestionResponse(
      attempt,
      state.question,
      state.totalQuestions,
      state.deadline
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Gets the current quiz state for the authenticated Team Lead (browser recovery / refresh).
 *
 * @param {string} userId
 * @returns {Promise<Object>} Safe response payload
 */
export const getCurrentQuizState = async (userId) => {
  const { team, event } = await resolveTeamLeadTeam(userId);

  if (event.status === 'READY') {
    return {
      success: false,
      notStarted: true,
      message: 'Round 1 has not started yet. Please wait for the organizer.',
    };
  }

  // Check attempt existence
  const { rows: attemptRows } = await query(
    `SELECT id, team_id, event_id, started_at, completed_at, total_score, current_question_started_at
     FROM attempts
     WHERE team_id = $1;`,
    [team.id]
  );

  if (attemptRows.length === 0) {
    if (event.status === 'ENDED') {
      const err = new Error('Round 1 has ended.');
      err.statusCode = 403;
      throw err;
    }
    return {
      success: true,
      hasAttempt: false,
      event: { id: event.id, name: event.name, status: event.status },
    };
  }

  const attempt = attemptRows[0];
  if (attempt.completed_at) {
    return getCompletionPayload();
  }

  if (event.status === 'ENDED') {
    const err = new Error('Round 1 has ended. Quiz participation is closed.');
    err.statusCode = 403;
    throw err;
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Re-lock attempt to evaluate timeouts safely
    const lockRes = await client.query(
      `SELECT id, team_id, event_id, started_at, completed_at, total_score, current_question_started_at
       FROM attempts
       WHERE id = $1
       FOR UPDATE;`,
      [attempt.id]
    );
    const lockedAttempt = lockRes.rows[0];

    const state = await resolveCurrentQuestionAndProcessTimeouts(client, lockedAttempt, event);
    await client.query('COMMIT');

    if (state.completed) {
      return getCompletionPayload();
    }

    return formatParticipantQuestionResponse(
      lockedAttempt,
      state.question,
      state.totalQuestions,
      state.deadline
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Submits an answer for the current question.
 *
 * @param {string} userId
 * @param {Object} params
 * @param {string} params.selectedOption - 'A' | 'B' | 'C' | 'D'
 * @returns {Promise<Object>} Next question or completion payload
 */
export const submitQuizAnswer = async (userId, { selectedOption, questionId }) => {
  const validOptions = ['A', 'B', 'C', 'D'];
  if (!selectedOption || !validOptions.includes(String(selectedOption).toUpperCase())) {
    const err = new Error('Invalid selected option. Must be one of A, B, C, or D.');
    err.statusCode = 400;
    throw err;
  }
  const cleanOption = String(selectedOption).toUpperCase();

  const { team, event } = await resolveTeamLeadTeam(userId);

  if (event.status === 'READY') {
    const err = new Error('Round 1 has not started yet.');
    err.statusCode = 409;
    throw err;
  }

  if (event.status === 'ENDED') {
    const err = new Error('Round 1 has ended. Cannot submit answers.');
    err.statusCode = 409;
    throw err;
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Lock attempt row
    const { rows: attemptRows } = await client.query(
      `SELECT id, team_id, event_id, started_at, completed_at, total_score, current_question_started_at
       FROM attempts
       WHERE team_id = $1
       FOR UPDATE;`,
      [team.id]
    );

    if (attemptRows.length === 0) {
      const err = new Error('No active quiz attempt found.');
      err.statusCode = 404;
      throw err;
    }

    const attempt = attemptRows[0];
    if (attempt.completed_at) {
      await client.query('COMMIT');
      return getCompletionPayload();
    }

    // 2. Resolve current question (applying timeout check)
    const state = await resolveCurrentQuestionAndProcessTimeouts(client, attempt, event);
    if (state.completed) {
      await client.query('COMMIT');
      return getCompletionPayload();
    }

    const currentQ = state.question;

    // Reject duplicate submission if client targeted a question that has already been answered
    if (questionId) {
      const checkAnswered = await client.query(
        'SELECT id FROM answers WHERE attempt_id = $1 AND question_id = $2;',
        [attempt.id, questionId]
      );
      if (checkAnswered.rows.length > 0) {
        await client.query('COMMIT');
        const err = new Error('Question has already been answered.');
        err.statusCode = 409;
        throw err;
      }
    }

    const testOverride = testTimeOverrides.get(attempt.id);
    const qStartTime = testOverride || new Date(attempt.current_question_started_at);
    const deadline = new Date(qStartTime.getTime() + currentQ.time_limit_seconds * 1000);
    const now = new Date();

    // 3. Verify deadline
    if (now > deadline) {
      testTimeOverrides.delete(attempt.id);

      // Deadline expired right before submission
      await client.query(
        `INSERT INTO answers (attempt_id, question_id, event_id, selected_option, status, marks_awarded, answered_at, created_at)
         VALUES ($1, $2, $3, NULL, 'skipped', $4, NOW(), NOW())
         ON CONFLICT (attempt_id, question_id) DO NOTHING;`,
        [attempt.id, currentQ.id, attempt.event_id, event.skipMarks]
      );

      await client.query(
        `UPDATE attempts 
         SET total_score = total_score + $1, updated_at = NOW() 
         WHERE id = $2;`,
        [event.skipMarks, attempt.id]
      );

      // Advance to next question in database at server NOW()
      const advRes = await client.query(
        `UPDATE attempts 
         SET current_question_started_at = NOW(), updated_at = NOW() 
         WHERE id = $1 
         RETURNING current_question_started_at;`,
        [attempt.id]
      );
      attempt.current_question_started_at = advRes.rows[0].current_question_started_at;

      // Re-resolve state to advance to next question
      const nextState = await resolveCurrentQuestionAndProcessTimeouts(client, attempt, event);
      await client.query('COMMIT');

      if (nextState.completed) {
        return getCompletionPayload();
      }

      return formatParticipantQuestionResponse(
        attempt,
        nextState.question,
        nextState.totalQuestions,
        nextState.deadline
      );
    }

    // 4. On-time submission: evaluate correctness
    const isCorrect = cleanOption === currentQ.correct_option;
    const status = isCorrect ? 'correct' : 'wrong';
    const marks = isCorrect ? event.correctMarks : event.wrongMarks;

    // 5. Insert answer
    const insertRes = await client.query(
      `INSERT INTO answers (attempt_id, question_id, event_id, selected_option, status, marks_awarded, answered_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (attempt_id, question_id) DO NOTHING
       RETURNING id;`,
      [attempt.id, currentQ.id, attempt.event_id, cleanOption, status, marks]
    );

    if (insertRes.rows.length === 0) {
      // Double submission / duplicate request handled safely
      await client.query('COMMIT');
      const err = new Error('Question has already been answered.');
      err.statusCode = 409;
      throw err;
    }

    // 6. Update score
    await client.query(
      `UPDATE attempts 
       SET total_score = total_score + $1, updated_at = NOW() 
       WHERE id = $2;`,
      [marks, attempt.id]
    );

    // 7. Advance to next question in database at server NOW()
    const advRes = await client.query(
      `UPDATE attempts 
       SET current_question_started_at = NOW(), updated_at = NOW() 
       WHERE id = $1 
       RETURNING current_question_started_at;`,
      [attempt.id]
    );
    attempt.current_question_started_at = advRes.rows[0].current_question_started_at;

    const nextState = await resolveCurrentQuestionAndProcessTimeouts(client, attempt, event);
    await client.query('COMMIT');

    if (nextState.completed) {
      return getCompletionPayload();
    }

    return formatParticipantQuestionResponse(
      attempt,
      nextState.question,
      nextState.totalQuestions,
      nextState.deadline
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Skips the current question.
 *
 * @param {string} userId
 * @returns {Promise<Object>} Next question or completion payload
 */
export const skipQuizQuestion = async (userId) => {
  const { team, event } = await resolveTeamLeadTeam(userId);

  if (event.status === 'READY') {
    const err = new Error('Round 1 has not started yet.');
    err.statusCode = 409;
    throw err;
  }

  if (event.status === 'ENDED') {
    const err = new Error('Round 1 has ended. Cannot skip questions.');
    err.statusCode = 409;
    throw err;
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: attemptRows } = await client.query(
      `SELECT id, team_id, event_id, started_at, completed_at, total_score, current_question_started_at
       FROM attempts
       WHERE team_id = $1
       FOR UPDATE;`,
      [team.id]
    );

    if (attemptRows.length === 0) {
      const err = new Error('No active quiz attempt found.');
      err.statusCode = 404;
      throw err;
    }

    const attempt = attemptRows[0];
    if (attempt.completed_at) {
      await client.query('COMMIT');
      return getCompletionPayload();
    }

    // Resolve current question
    const state = await resolveCurrentQuestionAndProcessTimeouts(client, attempt, event);
    if (state.completed) {
      await client.query('COMMIT');
      return getCompletionPayload();
    }

    const currentQ = state.question;

    // Record skipped answer
    const insertRes = await client.query(
      `INSERT INTO answers (attempt_id, question_id, event_id, selected_option, status, marks_awarded, answered_at, created_at)
       VALUES ($1, $2, $3, NULL, 'skipped', $4, NOW(), NOW())
       ON CONFLICT (attempt_id, question_id) DO NOTHING
       RETURNING id;`,
      [attempt.id, currentQ.id, attempt.event_id, event.skipMarks]
    );

    if (insertRes.rows.length === 0) {
      await client.query('COMMIT');
      const err = new Error('Question has already been answered.');
      err.statusCode = 409;
      throw err;
    }

    await client.query(
      `UPDATE attempts 
       SET total_score = total_score + $1, updated_at = NOW() 
       WHERE id = $2;`,
      [event.skipMarks, attempt.id]
    );

    // Advance to next question in database at server NOW()
    const advRes = await client.query(
      `UPDATE attempts 
       SET current_question_started_at = NOW(), updated_at = NOW() 
       WHERE id = $1 
       RETURNING current_question_started_at;`,
      [attempt.id]
    );
    attempt.current_question_started_at = advRes.rows[0].current_question_started_at;

    // Advance to next question
    const nextState = await resolveCurrentQuestionAndProcessTimeouts(client, attempt, event);
    await client.query('COMMIT');

    if (nextState.completed) {
      return getCompletionPayload();
    }

    return formatParticipantQuestionResponse(
      attempt,
      nextState.question,
      nextState.totalQuestions,
      nextState.deadline
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Admin: Starts Round 1 atomically.
 *
 * Rules:
 * - Requires exactly one READY event
 * - Validates question bank
 * - Transitions READY -> LIVE atomically
 * - If question bank is invalid, rollback and event remains READY
 *
 * @returns {Promise<Object>} Updated event
 */
export const startEventAdmin = async () => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Resolve and lock READY event
    const { rows: readyRows } = await client.query(
      `SELECT id, name, status
       FROM event
       WHERE status = 'READY'
       FOR UPDATE;`
    );

    if (readyRows.length > 1) {
      const err = new Error('System configuration error: multiple READY events detected. Cannot select target event safely.');
      err.statusCode = 500;
      throw err;
    }

    if (readyRows.length === 0) {
      // Check if already LIVE or ENDED
      const checkRes = await client.query(
        "SELECT id, status FROM event WHERE status IN ('LIVE', 'ENDED') LIMIT 1;"
      );
      if (checkRes.rows.length > 0) {
        const err = new Error(`Cannot start event: event is already in '${checkRes.rows[0].status}' status.`);
        err.statusCode = 409;
        throw err;
      }
      const err = new Error('No READY competition event found to start.');
      err.statusCode = 404;
      throw err;
    }

    const event = readyRows[0];

    // 2. Validate question bank
    const validation = await validateQuestionBank(event.id);
    if (!validation.valid || validation.errors.length > 0) {
      const err = new Error(
        `Cannot start Round 1: Question bank validation failed (${validation.errors.join('; ')}). Event remains READY.`
      );
      err.statusCode = 400;
      err.validationErrors = validation.errors;
      throw err;
    }

    // 3. Atomically transition READY -> LIVE
    const updateRes = await client.query(
      `UPDATE event 
       SET status = 'LIVE', updated_at = NOW() 
       WHERE id = $1 
       RETURNING id, name, status, updated_at;`,
      [event.id]
    );

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Round 1 is now LIVE.',
      event: updateRes.rows[0],
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Admin: Ends Round 1 atomically.
 *
 * Rules:
 * - Requires exactly one LIVE event
 * - Transitions LIVE -> ENDED
 * - Rejects if event is not LIVE
 *
 * @returns {Promise<Object>} Updated event
 */
export const endEventAdmin = async () => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: liveRows } = await client.query(
      `SELECT id, name, status
       FROM event
       WHERE status = 'LIVE'
       FOR UPDATE;`
    );

    if (liveRows.length > 1) {
      const err = new Error('System configuration error: multiple LIVE events detected. Cannot select target event safely.');
      err.statusCode = 500;
      throw err;
    }

    if (liveRows.length === 0) {
      const checkRes = await client.query(
        "SELECT id, status FROM event WHERE status IN ('READY', 'ENDED') LIMIT 1;"
      );
      if (checkRes.rows.length > 0) {
        const err = new Error(`Cannot end event: event is in '${checkRes.rows[0].status}' status. Only LIVE events can be ended.`);
        err.statusCode = 409;
        throw err;
      }
      const err = new Error('No LIVE competition event found to end.');
      err.statusCode = 404;
      throw err;
    }

    const event = liveRows[0];

    const updateRes = await client.query(
      `UPDATE event 
       SET status = 'ENDED', updated_at = NOW() 
       WHERE id = $1 
       RETURNING id, name, status, updated_at;`,
      [event.id]
    );

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Round 1 has ENDED.',
      event: updateRes.rows[0],
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
