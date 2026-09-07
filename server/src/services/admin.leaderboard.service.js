import { query } from '../config/database.js';

/**
 * UUID v4 validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Strictly resolves the target competition event server-side without arbitrary guessing.
 *
 * Resolution Rules:
 * 1. If eventId is supplied:
 *    - Validate UUID format
 *    - Query event by ID
 *    - If not found -> 404
 * 2. If eventId is omitted:
 *    - Check for LIVE event: exactly 1 allowed. If multiple -> 500 configuration error.
 *    - Check for most recent ENDED event if no LIVE event.
 *    - Check for READY event if no LIVE or ENDED event: exactly 1 allowed. If multiple -> 500 error.
 *    - If no events exist -> 404
 *
 * @param {string} [eventId]
 * @returns {Promise<Object>} Authoritative event record
 */
export const resolveLeaderboardEvent = async (eventId) => {
  if (eventId) {
    if (!UUID_REGEX.test(String(eventId).trim())) {
      const err = new Error('Invalid event ID format. Must be a valid UUID.');
      err.statusCode = 400;
      throw err;
    }

    const { rows } = await query(
      `SELECT id, name, status, correct_marks, wrong_marks, skip_marks, created_at, updated_at
       FROM event
       WHERE id = $1;`,
      [eventId.trim()]
    );

    if (rows.length === 0) {
      const err = new Error('Competition event not found.');
      err.statusCode = 404;
      throw err;
    }

    return rows[0];
  }

  // Auto-resolution when eventId is omitted:
  // 1. Check for LIVE event
  const liveSql = `
    SELECT id, name, status, correct_marks, wrong_marks, skip_marks, created_at, updated_at
    FROM event
    WHERE status = 'LIVE';
  `;
  const { rows: liveRows } = await query(liveSql);

  if (liveRows.length > 1) {
    const err = new Error(
      'System configuration error: multiple LIVE events detected. Cannot select target event safely.'
    );
    err.statusCode = 500;
    throw err;
  }

  if (liveRows.length === 1) {
    return liveRows[0];
  }

  // 2. Check for most recently created ENDED event
  const endedSql = `
    SELECT id, name, status, correct_marks, wrong_marks, skip_marks, created_at, updated_at
    FROM event
    WHERE status = 'ENDED'
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  const { rows: endedRows } = await query(endedSql);
  if (endedRows.length > 0) {
    return endedRows[0];
  }

  // 3. Check for READY event
  const readySql = `
    SELECT id, name, status, correct_marks, wrong_marks, skip_marks, created_at, updated_at
    FROM event
    WHERE status = 'READY';
  `;
  const { rows: readyRows } = await query(readySql);

  if (readyRows.length > 1) {
    const err = new Error(
      'System configuration error: multiple READY events detected. Cannot select target event safely.'
    );
    err.statusCode = 500;
    throw err;
  }

  if (readyRows.length === 1) {
    return readyRows[0];
  }

  const err = new Error('No competition event found.');
  err.statusCode = 404;
  throw err;
};

/**
 * Retrieves the read-only, server-authoritative Admin Leaderboard.
 *
 * Guarantees:
 * - Read-only: never modifies attempts, scores, or timestamps
 * - Deterministic ranking:
 *     1. score DESC
 *     2. completed_at ASC
 *     3. started_at ASC
 *     4. teams.created_at ASC
 *     5. teams.id ASC
 * - Completed attempts get 1-based ranks (1, 2, 3...)
 * - IN_PROGRESS & NOT_STARTED get rank: null
 * - Cross-event isolated: scoped strictly to event_id
 * - Score consistency verified against SUM(answers.marks_awarded)
 *
 * @param {Object} params
 * @param {string} [params.eventId]
 * @returns {Promise<Object>} Safe Leaderboard payload
 */
export const getAdminLeaderboard = async ({ eventId } = {}) => {
  const event = await resolveLeaderboardEvent(eventId);

  // Total questions count for this event
  const qCountRes = await query(
    'SELECT COUNT(*)::int AS count FROM questions WHERE event_id = $1;',
    [event.id]
  );
  const totalQuestions = qCountRes.rows[0]?.count || 0;

  // Handle READY status: event has not started
  if (event.status === 'READY') {
    const { rows: teamRows } = await query(
      `SELECT COUNT(*)::int AS count 
       FROM teams 
       WHERE event_id = $1 AND registration_status = 'APPROVED';`,
      [event.id]
    );
    const approvedCount = teamRows[0]?.count || 0;

    return {
      success: true,
      event: {
        id: event.id,
        name: event.name,
        status: event.status,
        correctMarks: event.correct_marks,
        wrongMarks: event.wrong_marks,
        skipMarks: event.skip_marks,
      },
      isFinal: false,
      totalQuestions,
      message: 'Round 1 has not started yet. Leaderboard will become available once the event goes LIVE or ENDS.',
      stats: {
        totalApprovedTeams: approvedCount,
        completedCount: 0,
        inProgressCount: 0,
        notStartedCount: approvedCount,
        topScore: null,
        averageScore: null,
      },
      leaderboard: [],
    };
  }

  // For LIVE and ENDED events: fetch approved teams with attempts and answer aggregates
  const leaderboardSql = `
    SELECT 
      t.id AS team_id,
      t.name AS team_name,
      t.college,
      t.department,
      t.created_at AS team_registered_at,
      att.id AS attempt_id,
      att.started_at,
      att.completed_at,
      att.total_score AS attempt_total_score,
      COALESCE(SUM(ans.marks_awarded), 0)::int AS calculated_score,
      COUNT(CASE WHEN ans.status = 'correct' THEN 1 END)::int AS correct_count,
      COUNT(CASE WHEN ans.status = 'wrong' THEN 1 END)::int AS wrong_count,
      COUNT(CASE WHEN ans.status = 'skipped' THEN 1 END)::int AS skipped_count,
      COUNT(ans.id)::int AS answered_count
    FROM teams t
    LEFT JOIN attempts att ON att.team_id = t.id AND att.event_id = t.event_id
    LEFT JOIN answers ans ON ans.attempt_id = att.id
    WHERE t.event_id = $1 AND t.registration_status = 'APPROVED'
    GROUP BY t.id, t.name, t.college, t.department, t.created_at, att.id, att.started_at, att.completed_at, att.total_score;
  `;

  const { rows } = await query(leaderboardSql, [event.id]);

  // Process and partition into completed vs incomplete
  const completedEntries = [];
  const inProgressEntries = [];
  const notStartedEntries = [];

  for (const row of rows) {
    const isCompleted = Boolean(row.completed_at);
    const isStarted = Boolean(row.started_at);

    let completionStatus;
    if (isCompleted) {
      completionStatus = 'COMPLETED';
    } else if (isStarted) {
      completionStatus = 'IN_PROGRESS';
    } else {
      completionStatus = 'NOT_STARTED';
    }

    // Determine authoritative score: use attempt_total_score if attempt exists, fallback to calculated_score
    const totalScore = row.attempt_total_score !== null ? Number(row.attempt_total_score) : Number(row.calculated_score);

    // Non-mutating score consistency audit verification
    const hasAuditDiscrepancy = isCompleted && row.attempt_total_score !== null && Number(row.attempt_total_score) !== Number(row.calculated_score);

    const durationSeconds = isCompleted && row.started_at && row.completed_at
      ? Math.max(0, Math.round((new Date(row.completed_at).getTime() - new Date(row.started_at).getTime()) / 1000))
      : null;

    const entry = {
      teamId: row.team_id,
      teamName: row.team_name,
      college: row.college,
      department: row.department,
      registeredAt: row.team_registered_at ? new Date(row.team_registered_at).toISOString() : null,
      attemptId: row.attempt_id || null,
      startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
      durationSeconds,
      score: totalScore,
      correctCount: row.correct_count,
      wrongCount: row.wrong_count,
      skippedCount: row.skipped_count,
      answeredCount: row.answered_count,
      totalQuestions,
      completionStatus,
      hasAuditDiscrepancy,
    };

    if (completionStatus === 'COMPLETED') {
      completedEntries.push(entry);
    } else if (completionStatus === 'IN_PROGRESS') {
      inProgressEntries.push(entry);
    } else {
      notStartedEntries.push(entry);
    }
  }

  // 5-Level Deterministic Sorting for Completed Teams:
  // 1. score DESC
  // 2. completed_at ASC (earlier completion timestamp wins)
  // 3. started_at ASC (earlier start wins)
  // 4. registeredAt ASC (earlier registration wins)
  // 5. teamId ASC (deterministic UUID anchor)
  completedEntries.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const compA = new Date(a.completedAt).getTime();
    const compB = new Date(b.completedAt).getTime();
    if (compA !== compB) {
      return compA - compB;
    }
    const startA = new Date(a.startedAt).getTime();
    const startB = new Date(b.startedAt).getTime();
    if (startA !== startB) {
      return startA - startB;
    }
    const regA = new Date(a.registeredAt).getTime();
    const regB = new Date(b.registeredAt).getTime();
    if (regA !== regB) {
      return regA - regB;
    }
    return String(a.teamId).localeCompare(String(b.teamId));
  });

  // Assign integer ranks to completed teams only (1, 2, 3...)
  const rankedCompleted = completedEntries.map((entry, idx) => ({
    rank: idx + 1,
    ...entry,
  }));

  // Incomplete teams receive rank: null
  // Sort in-progress by answeredCount DESC, then teamName ASC
  inProgressEntries.sort((a, b) => {
    if (b.answeredCount !== a.answeredCount) {
      return b.answeredCount - a.answeredCount;
    }
    return a.teamName.localeCompare(b.teamName);
  });
  const unrankedInProgress = inProgressEntries.map((entry) => ({
    rank: null,
    ...entry,
  }));

  // Sort not-started by teamName ASC
  notStartedEntries.sort((a, b) => a.teamName.localeCompare(b.teamName));
  const unrankedNotStarted = notStartedEntries.map((entry) => ({
    rank: null,
    ...entry,
  }));

  // Full composite leaderboard (Ranked first, then In-Progress, then Not-Started)
  const fullLeaderboard = [
    ...rankedCompleted,
    ...unrankedInProgress,
    ...unrankedNotStarted,
  ];

  // Calculate summary statistics
  const totalApprovedTeams = rows.length;
  const completedCount = rankedCompleted.length;
  const inProgressCount = unrankedInProgress.length;
  const notStartedCount = unrankedNotStarted.length;
  const topScore = completedCount > 0 ? rankedCompleted[0].score : null;
  const averageScore = completedCount > 0
    ? Math.round(rankedCompleted.reduce((sum, item) => sum + item.score, 0) / completedCount)
    : null;

  return {
    success: true,
    event: {
      id: event.id,
      name: event.name,
      status: event.status,
      correctMarks: event.correct_marks,
      wrongMarks: event.wrong_marks,
      skipMarks: event.skip_marks,
    },
    isFinal: event.status === 'ENDED',
    totalQuestions,
    stats: {
      totalApprovedTeams,
      completedCount,
      inProgressCount,
      notStartedCount,
      topScore,
      averageScore,
    },
    leaderboard: fullLeaderboard,
  };
};
