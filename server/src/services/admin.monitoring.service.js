import { getClient } from '../config/database.js';

/**
 * UUID v4 validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Module 9: Admin Live Operational Monitoring Service
 *
 * Guarantees:
 * 1. Strictly READ ONLY transactions (BEGIN READ ONLY ... COMMIT).
 * 2. Database-authoritative clock: uses PostgreSQL NOW() with ZERO fallback to Node.js time.
 * 3. Strictly LIVE monitoring: exactly 1 LIVE event is monitored. READY and ENDED events
 *    return clean non-live statuses. Ambiguous states fail safely with configuration errors.
 * 4. Strictly read-only: never triggers Module 7 timeouts, never writes SKIPPED answers,
 *    never mutates scores or attempts.
 * 5. Operational ordering without ranks: official ranking belongs exclusively to Module 8.
 * 6. Zero data leakage: no question text, options, correct_option, passwords, OTPs, or payment info.
 */

/**
 * Retrieves real-time operational monitoring overview.
 *
 * @returns {Promise<Object>} Monitoring overview snapshot or non-live event status.
 */
export const getMonitoringOverview = async () => {
  const client = await getClient();
  try {
    await client.query('BEGIN READ ONLY');

    // 1. Authoritative Clock: Capture PostgreSQL NOW() directly from this transaction
    const clockRes = await client.query('SELECT NOW() AS db_now;');
    const dbNow = new Date(clockRes.rows[0].db_now);

    // 2. Deterministic Event Resolution within the same transaction snapshot
    const liveRes = await client.query(
      "SELECT id, name, status FROM event WHERE status = 'LIVE';"
    );

    if (liveRes.rows.length > 1) {
      const err = new Error('Configuration error: multiple live events detected');
      err.statusCode = 500;
      throw err;
    }

    if (liveRes.rows.length === 0) {
      const readyRes = await client.query(
        "SELECT id, name, status FROM event WHERE status = 'READY';"
      );

      if (readyRes.rows.length > 1) {
        const err = new Error('Configuration error: multiple ready events detected');
        err.statusCode = 500;
        throw err;
      }

      if (readyRes.rows.length === 1) {
        await client.query('COMMIT');
        return {
          success: true,
          notLive: true,
          status: 'READY',
          message: 'Event has not started yet',
        };
      }

      const endedRes = await client.query(
        "SELECT id, name, status FROM event WHERE status = 'ENDED';"
      );

      if (endedRes.rows.length >= 1) {
        await client.query('COMMIT');
        return {
          success: true,
          notLive: true,
          status: 'ENDED',
          message: 'Event has ended',
        };
      }

      const err = new Error('No event found');
      err.statusCode = 404;
      throw err;
    }

    const liveEvent = liveRes.rows[0];

    // 3. Query Questions for Time Limits & Total Question Count
    const qRes = await client.query(
      `SELECT id, question_order, time_limit_seconds
       FROM questions
       WHERE event_id = $1
       ORDER BY question_order ASC;`,
      [liveEvent.id]
    );

    const totalQuestions = qRes.rows.length;
    const questionTimeMap = {};
    for (const row of qRes.rows) {
      questionTimeMap[row.question_order] = row.time_limit_seconds;
    }

    // 4. Query Approved Teams, Attempts & Answers Aggregate
    const teamsRes = await client.query(
      `SELECT
         t.id AS team_id,
         t.name AS team_name,
         t.college,
         t.department,
         t.created_at AS team_created_at,
         att.id AS attempt_id,
         att.started_at,
         att.completed_at,
         att.total_score,
         att.current_question_started_at,
         COUNT(ans.id)::int AS answered_count,
         COUNT(CASE WHEN ans.status = 'correct' THEN 1 END)::int AS correct_count,
         COUNT(CASE WHEN ans.status = 'wrong' THEN 1 END)::int AS wrong_count,
         COUNT(CASE WHEN ans.status = 'skipped' THEN 1 END)::int AS skipped_count,
         MAX(ans.answered_at) AS last_answer_at
       FROM teams t
       LEFT JOIN attempts att ON att.team_id = t.id AND att.event_id = t.event_id
       LEFT JOIN answers ans ON ans.attempt_id = att.id
       WHERE t.event_id = $1 AND t.registration_status = 'APPROVED'
       GROUP BY t.id, t.name, t.college, t.department, t.created_at,
                att.id, att.started_at, att.completed_at, att.total_score,
                att.current_question_started_at;`,
      [liveEvent.id]
    );

    await client.query('COMMIT');

    // 5. In-Memory Processing: Operational Categorization & Ordering (NO RANKS)
    const inProgressList = [];
    const notStartedList = [];
    const completedList = [];

    let latestActivity = null;

    for (const row of teamsRes.rows) {
      // Track latest activity timestamp across all teams
      if (row.last_answer_at) {
        const ansTime = new Date(row.last_answer_at);
        if (!latestActivity || ansTime > latestActivity) {
          latestActivity = ansTime;
        }
      }
      if (row.started_at) {
        const startTime = new Date(row.started_at);
        if (!latestActivity || startTime > latestActivity) {
          latestActivity = startTime;
        }
      }

      if (!row.attempt_id) {
        // Team has not started the quiz
        notStartedList.push({
          teamId: row.team_id,
          teamName: row.team_name,
          college: row.college,
          department: row.department,
          status: 'NOT_STARTED',
          currentQuestionNumber: null,
          progress: `0/${totalQuestions}`,
          score: 0,
          correctCount: 0,
          wrongCount: 0,
          skippedCount: 0,
          remainingSeconds: null,
          questionDeadline: null,
          startedAt: null,
          completedAt: null,
          // Internal fields for sorting
          _teamCreatedAt: row.team_created_at,
        });
      } else if (row.completed_at) {
        // Team has completed the quiz
        completedList.push({
          teamId: row.team_id,
          teamName: row.team_name,
          college: row.college,
          department: row.department,
          status: 'COMPLETED',
          currentQuestionNumber: totalQuestions,
          progress: `${totalQuestions}/${totalQuestions}`,
          score: row.total_score != null ? row.total_score : 0,
          correctCount: row.correct_count,
          wrongCount: row.wrong_count,
          skippedCount: row.skipped_count,
          remainingSeconds: 0,
          questionDeadline: null,
          startedAt: row.started_at,
          completedAt: row.completed_at,
          // Internal fields for sorting
          _teamCreatedAt: row.team_created_at,
        });
      } else {
        // Team is actively taking the quiz
        const currentQNum = row.answered_count + 1;
        const timeLimit = questionTimeMap[currentQNum] || 30;

        let questionDeadline = null;
        let remainingSeconds = 0;

        if (row.current_question_started_at) {
          const qStart = new Date(row.current_question_started_at);
          const deadline = new Date(qStart.getTime() + timeLimit * 1000);
          questionDeadline = deadline.toISOString();
          remainingSeconds = Math.max(
            0,
            Math.floor((deadline.getTime() - dbNow.getTime()) / 1000)
          );
        }

        inProgressList.push({
          teamId: row.team_id,
          teamName: row.team_name,
          college: row.college,
          department: row.department,
          status: 'IN_PROGRESS',
          currentQuestionNumber: currentQNum,
          progress: `${row.answered_count}/${totalQuestions}`,
          score: row.total_score != null ? row.total_score : 0,
          correctCount: row.correct_count,
          wrongCount: row.wrong_count,
          skippedCount: row.skipped_count,
          remainingSeconds: remainingSeconds,
          questionDeadline: questionDeadline,
          startedAt: row.started_at,
          completedAt: null,
          // Internal fields for sorting
          _answeredCount: row.answered_count,
          _teamCreatedAt: row.team_created_at,
        });
      }
    }

    // Operational Ordering (Display ordering only - NO RANKS):
    // IN_PROGRESS:
    // 1. answered_count DESC
    // 2. total_score DESC
    // 3. team_name ASC
    // 4. teams.id ASC
    inProgressList.sort((a, b) => {
      if (b._answeredCount !== a._answeredCount) {
        return b._answeredCount - a._answeredCount;
      }
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const nameCmp = a.teamName.localeCompare(b.teamName);
      if (nameCmp !== 0) return nameCmp;
      return a.teamId.localeCompare(b.teamId);
    });

    // NOT_STARTED:
    // 1. team_name ASC
    // 2. teams.id ASC
    notStartedList.sort((a, b) => {
      const nameCmp = a.teamName.localeCompare(b.teamName);
      if (nameCmp !== 0) return nameCmp;
      return a.teamId.localeCompare(b.teamId);
    });

    // COMPLETED:
    // 1. total_score DESC
    // 2. completed_at ASC
    // 3. started_at ASC
    // 4. teams.created_at ASC
    // 5. teams.id ASC
    completedList.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const aComp = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bComp = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      if (aComp !== bComp) return aComp - bComp;

      const aStart = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const bStart = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      if (aStart !== bStart) return aStart - bStart;

      const aCreated = a._teamCreatedAt ? new Date(a._teamCreatedAt).getTime() : 0;
      const bCreated = b._teamCreatedAt ? new Date(b._teamCreatedAt).getTime() : 0;
      if (aCreated !== bCreated) return aCreated - bCreated;

      return a.teamId.localeCompare(b.teamId);
    });

    // Clean internal sorting keys from output
    const cleanTeam = (team) => {
      const { _answeredCount, _teamCreatedAt, ...rest } = team;
      return rest;
    };

    const orderedTeams = [
      ...inProgressList.map(cleanTeam),
      ...notStartedList.map(cleanTeam),
      ...completedList.map(cleanTeam),
    ];

    // High-Level Statistics (Zero-safe: no NaN or null)
    const totalApprovedTeams = teamsRes.rows.length;
    const notStartedCount = notStartedList.length;
    const inProgressCount = inProgressList.length;
    const completedCount = completedList.length;

    const completionPercentage =
      totalApprovedTeams > 0
        ? Number(((completedCount / totalApprovedTeams) * 100).toFixed(1))
        : 0;

    const activeTeamsWithScore = [...inProgressList, ...completedList];
    const highestScore =
      activeTeamsWithScore.length > 0
        ? Math.max(...activeTeamsWithScore.map((t) => t.score))
        : 0;

    const averageCompletedScore =
      completedList.length > 0
        ? Math.round(
            completedList.reduce((sum, t) => sum + t.score, 0) / completedList.length
          )
        : 0;

    return {
      success: true,
      event: {
        id: liveEvent.id,
        name: liveEvent.name,
        status: liveEvent.status,
      },
      totalQuestions: totalQuestions,
      stats: {
        totalApprovedTeams,
        notStartedCount,
        inProgressCount,
        completedCount,
        completionPercentage,
        highestScore,
        averageCompletedScore,
        lastActivityAt: latestActivity ? latestActivity.toISOString() : null,
      },
      teams: orderedTeams,
      serverTime: dbNow.toISOString(),
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Retrieves detailed live operational monitoring for a specific team.
 *
 * @param {string} teamId
 * @returns {Promise<Object>} Team monitoring detail or error.
 */
export const getTeamMonitoringDetail = async (teamId) => {
  if (!teamId || !UUID_REGEX.test(String(teamId).trim())) {
    const err = new Error('Invalid team ID format. Must be a valid UUID.');
    err.statusCode = 400;
    throw err;
  }

  const cleanTeamId = String(teamId).trim();
  const client = await getClient();

  try {
    await client.query('BEGIN READ ONLY');

    // 1. Authoritative Clock: Capture PostgreSQL NOW() directly from this transaction
    const clockRes = await client.query('SELECT NOW() AS db_now;');
    const dbNow = new Date(clockRes.rows[0].db_now);

    // 2. Resolve exactly one LIVE event
    const liveRes = await client.query(
      "SELECT id, name, status FROM event WHERE status = 'LIVE';"
    );

    if (liveRes.rows.length > 1) {
      const err = new Error('Configuration error: multiple live events detected');
      err.statusCode = 500;
      throw err;
    }

    if (liveRes.rows.length === 0) {
      const err = new Error('No live event currently active for team monitoring.');
      err.statusCode = 404;
      throw err;
    }

    const liveEvent = liveRes.rows[0];

    // 3. Query Team Verification and Attempt Metadata
    const teamRes = await client.query(
      `SELECT
         t.id AS team_id,
         t.name AS team_name,
         t.college,
         t.department,
         t.registration_status,
         att.id AS attempt_id,
         att.started_at,
         att.completed_at,
         att.total_score,
         att.current_question_started_at
       FROM teams t
       LEFT JOIN attempts att ON att.team_id = t.id AND att.event_id = t.event_id
       WHERE t.id = $1 AND t.event_id = $2;`,
      [cleanTeamId, liveEvent.id]
    );

    if (teamRes.rows.length === 0) {
      const err = new Error('Team not found in the active live event.');
      err.statusCode = 404;
      throw err;
    }

    const teamRow = teamRes.rows[0];

    if (teamRow.registration_status !== 'APPROVED') {
      const err = new Error('Team registration is not approved.');
      err.statusCode = 403;
      throw err;
    }

    // 4. Query Questions and Answers for this Team's Attempt
    // Note: NEVER select question_text, option_a/b/c/d, or correct_option
    const qAnsRes = await client.query(
      `SELECT
         q.id AS question_id,
         q.question_order,
         q.time_limit_seconds,
         ans.status AS answer_status,
         ans.marks_awarded,
         ans.answered_at
       FROM questions q
       LEFT JOIN answers ans ON ans.question_id = q.id AND ans.attempt_id = $1
       WHERE q.event_id = $2
       ORDER BY q.question_order ASC;`,
      [teamRow.attempt_id, liveEvent.id]
    );

    await client.query('COMMIT');

    const totalQuestions = qAnsRes.rows.length;
    const answeredRows = qAnsRes.rows.filter((r) => r.answer_status);
    const answeredCount = answeredRows.length;

    // 5. Determine per-question status and team status
    let teamStatus = 'NOT_STARTED';
    let currentQuestionNumber = null;
    let remainingSeconds = null;
    let questionDeadline = null;
    let score = 0;
    let progress = `0/${totalQuestions}`;

    if (teamRow.completed_at) {
      teamStatus = 'COMPLETED';
      currentQuestionNumber = totalQuestions;
      remainingSeconds = 0;
      questionDeadline = null;
      score = teamRow.total_score != null ? teamRow.total_score : 0;
      progress = `${totalQuestions}/${totalQuestions}`;
    } else if (teamRow.attempt_id) {
      teamStatus = 'IN_PROGRESS';
      currentQuestionNumber = answeredCount + 1;
      score = teamRow.total_score != null ? teamRow.total_score : 0;
      progress = `${answeredCount}/${totalQuestions}`;

      const activeQ = qAnsRes.rows.find(
        (r) => r.question_order === currentQuestionNumber
      );
      const timeLimit = activeQ ? activeQ.time_limit_seconds : 30;

      if (teamRow.current_question_started_at) {
        const qStart = new Date(teamRow.current_question_started_at);
        const deadline = new Date(qStart.getTime() + timeLimit * 1000);
        questionDeadline = deadline.toISOString();
        remainingSeconds = Math.max(
          0,
          Math.floor((deadline.getTime() - dbNow.getTime()) / 1000)
        );
      } else {
        remainingSeconds = 0;
      }
    }

    const questionBreakdown = qAnsRes.rows.map((row) => {
      let qStatus = 'UNANSWERED';
      let marksAwarded = null;
      let answeredAt = null;

      if (row.answer_status) {
        qStatus = row.answer_status.toUpperCase();
        marksAwarded = row.marks_awarded;
        answeredAt = row.answered_at;
      } else if (
        teamStatus === 'IN_PROGRESS' &&
        row.question_order === currentQuestionNumber
      ) {
        qStatus = 'CURRENT';
      }

      return {
        questionOrder: row.question_order,
        questionId: row.question_id,
        status: qStatus,
        marksAwarded: marksAwarded,
        answeredAt: answeredAt,
      };
    });

    return {
      success: true,
      team: {
        teamId: teamRow.team_id,
        teamName: teamRow.team_name,
        college: teamRow.college,
        department: teamRow.department,
        status: teamStatus,
        score: score,
        startedAt: teamRow.started_at,
        completedAt: teamRow.completed_at,
        currentQuestionNumber: currentQuestionNumber,
        progress: progress,
        remainingSeconds: remainingSeconds,
        questionDeadline: questionDeadline,
      },
      questions: questionBreakdown,
      serverTime: dbNow.toISOString(),
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};
