import { query, getClient } from '../config/database.js';

// UUID v4 validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_OPTIONS = ['A', 'B', 'C', 'D'];
const MIN_TIMER_SECONDS = 5;
const MAX_TIMER_SECONDS = 600; // 10 minutes max per question

/**
 * Validates whether a string is a valid UUID v4.
 * @param {string} id
 * @returns {boolean}
 */
export const isValidUUID = (id) => {
  return typeof id === 'string' && UUID_REGEX.test(id);
};

/**
 * Resolves the applicable active competition event for question management.
 *
 * Rules:
 * - If there are multiple LIVE events -> fail safely (500)
 * - If 1 LIVE event -> return it
 * - If multiple READY events -> fail safely (500, do not arbitrarily select)
 * - If 1 READY event -> return it
 * - If 0 active events -> check most recent ENDED event
 * - If none at all -> fail safely (404)
 *
 * @returns {Promise<{ id: string, name: string, status: string }>}
 */
export const getActiveEvent = async () => {
  const activeSql = `
    SELECT id, name, status
    FROM event
    WHERE status IN ('READY', 'LIVE')
    ORDER BY created_at DESC;
  `;
  const { rows } = await query(activeSql);

  const readyEvents = rows.filter((e) => e.status === 'READY');
  const liveEvents = rows.filter((e) => e.status === 'LIVE');

  if (liveEvents.length > 1) {
    const err = new Error(
      'System configuration error: multiple LIVE events detected. Cannot select target event safely.'
    );
    err.statusCode = 500;
    throw err;
  }

  if (liveEvents.length === 1) {
    return liveEvents[0];
  }

  if (readyEvents.length > 1) {
    const err = new Error(
      'System configuration error: multiple READY events detected. Cannot select target event safely.'
    );
    err.statusCode = 500;
    throw err;
  }

  if (readyEvents.length === 1) {
    return readyEvents[0];
  }

  // Fallback to most recent ENDED event if no READY/LIVE event exists
  const endedSql = `
    SELECT id, name, status
    FROM event
    WHERE status = 'ENDED'
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  const endedRes = await query(endedSql);
  if (endedRes.rows.length > 0) {
    return endedRes.rows[0];
  }

  const err = new Error('No competition event found.');
  err.statusCode = 404;
  throw err;
};

/**
 * Asserts that the event is in 'READY' state for mutations.
 * Reject operations if LIVE or ENDED.
 *
 * @param {Object} event
 */
export const assertEventIsReady = (event) => {
  if (event.status === 'LIVE' || event.status === 'ENDED') {
    const err = new Error(
      `Questions are locked because Round 1 is ${event.status}. No question modifications allowed.`
    );
    err.statusCode = 409;
    throw err;
  }

  if (event.status !== 'READY') {
    const err = new Error(
      `Cannot modify questions: event is in '${event.status}' status.`
    );
    err.statusCode = 409;
    throw err;
  }
};

/**
 * Lists all questions for the active event.
 * Sorted by question_order ASC.
 * Includes correct_option (Admin authorized).
 *
 * @returns {Promise<{ event: Object, questions: Array }>}
 */
export const getQuestionsForAdmin = async () => {
  const event = await getActiveEvent();

  const sql = `
    SELECT
      id,
      event_id,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      time_limit_seconds,
      question_order,
      created_at,
      updated_at
    FROM questions
    WHERE event_id = $1
    ORDER BY question_order ASC;
  `;
  const { rows } = await query(sql, [event.id]);

  return {
    event: {
      id: event.id,
      name: event.name,
      status: event.status,
      isLocked: event.status !== 'READY',
    },
    questions: rows.map((q) => ({
      id: q.id,
      questionText: q.question_text,
      optionA: q.option_a,
      optionB: q.option_b,
      optionC: q.option_c,
      optionD: q.option_d,
      correctOption: q.correct_option,
      timeLimitSeconds: q.time_limit_seconds,
      questionOrder: q.question_order,
      createdAt: q.created_at,
      updatedAt: q.updated_at,
    })),
  };
};

/**
 * Architectural helper for participant quiz delivery.
 * STRICTLY OMITS correct_option.
 *
 * @param {string} eventId
 * @returns {Promise<Array>}
 */
export const getParticipantQuestions = async (eventId) => {
  if (!isValidUUID(eventId)) {
    const err = new Error('Invalid event identifier.');
    err.statusCode = 400;
    throw err;
  }

  const sql = `
    SELECT
      id,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      time_limit_seconds,
      question_order
    FROM questions
    WHERE event_id = $1
    ORDER BY question_order ASC;
  `;
  const { rows } = await query(sql, [eventId]);

  return rows.map((q) => ({
    id: q.id,
    questionText: q.question_text,
    optionA: q.option_a,
    optionB: q.option_b,
    optionC: q.option_c,
    optionD: q.option_d,
    timeLimitSeconds: q.time_limit_seconds,
    questionOrder: q.question_order,
  }));
};

/**
 * Creates a new question in the active event.
 * Enforces event.status = READY.
 *
 * @param {Object} data
 * @returns {Promise<Object>} Created question
 */
export const createQuestion = async (data = {}) => {
  const event = await getActiveEvent();
  assertEventIsReady(event);

  const {
    questionText,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption,
    timeLimitSeconds,
    questionOrder,
  } = data;

  // 1. Validate questionText
  if (!questionText || typeof questionText !== 'string' || questionText.trim().length === 0) {
    const err = new Error('Question text is required and cannot be empty.');
    err.statusCode = 400;
    throw err;
  }

  // 2. Validate options A-D
  const options = { optionA, optionB, optionC, optionD };
  for (const [key, val] of Object.entries(options)) {
    if (!val || typeof val !== 'string' || val.trim().length === 0) {
      const err = new Error(`${key.replace('option', 'Option ')} is required and cannot be empty.`);
      err.statusCode = 400;
      throw err;
    }
  }

  // 3. Validate correctOption
  const normalizedCorrect = typeof correctOption === 'string' ? correctOption.trim().toUpperCase() : '';
  if (!VALID_OPTIONS.includes(normalizedCorrect)) {
    const err = new Error(`Correct option must be one of: ${VALID_OPTIONS.join(', ')}.`);
    err.statusCode = 400;
    throw err;
  }

  // 4. Validate timer
  const parsedTimer = timeLimitSeconds !== undefined ? Number(timeLimitSeconds) : 30;
  if (!Number.isInteger(parsedTimer) || parsedTimer < MIN_TIMER_SECONDS || parsedTimer > MAX_TIMER_SECONDS) {
    const err = new Error(
      `Timer must be an integer between ${MIN_TIMER_SECONDS} and ${MAX_TIMER_SECONDS} seconds.`
    );
    err.statusCode = 400;
    throw err;
  }

  // 5. Determine and validate questionOrder
  let targetOrder;
  if (questionOrder !== undefined && questionOrder !== null) {
    const parsedOrder = Number(questionOrder);
    if (!Number.isInteger(parsedOrder) || parsedOrder <= 0) {
      const err = new Error('Question order must be a positive integer.');
      err.statusCode = 400;
      throw err;
    }
    targetOrder = parsedOrder;

    // Check if questionOrder already exists in this event
    const dupSql = `SELECT id FROM questions WHERE event_id = $1 AND question_order = $2 LIMIT 1;`;
    const dupRes = await query(dupSql, [event.id, targetOrder]);
    if (dupRes.rows.length > 0) {
      const err = new Error(`Question order ${targetOrder} is already in use for this event.`);
      err.statusCode = 409;
      throw err;
    }
  } else {
    // Auto-calculate next order
    const maxSql = `SELECT COALESCE(MAX(question_order), 0) + 1 AS next_order FROM questions WHERE event_id = $1;`;
    const maxRes = await query(maxSql, [event.id]);
    targetOrder = parseInt(maxRes.rows[0].next_order, 10);
  }

  // 6. Insert with parameterized SQL
  const insertSql = `
    INSERT INTO questions (
      event_id,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      time_limit_seconds,
      question_order
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING
      id,
      event_id,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      time_limit_seconds,
      question_order,
      created_at,
      updated_at;
  `;
  const insertParams = [
    event.id,
    questionText.trim(),
    optionA.trim(),
    optionB.trim(),
    optionC.trim(),
    optionD.trim(),
    normalizedCorrect,
    parsedTimer,
    targetOrder,
  ];

  try {
    const { rows } = await query(insertSql, insertParams);
    const q = rows[0];
    return {
      success: true,
      message: 'Question created successfully.',
      question: {
        id: q.id,
        questionText: q.question_text,
        optionA: q.option_a,
        optionB: q.option_b,
        optionC: q.option_c,
        optionD: q.option_d,
        correctOption: q.correct_option,
        timeLimitSeconds: q.time_limit_seconds,
        questionOrder: q.question_order,
        createdAt: q.created_at,
        updatedAt: q.updated_at,
      },
    };
  } catch (err) {
    if (err.code === '23505') {
      const error = new Error('Question order must be unique within the event.');
      error.statusCode = 409;
      throw error;
    }
    throw err;
  }
};

/**
 * Updates an existing question.
 * Enforces event.status = READY.
 *
 * @param {string} questionId
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export const updateQuestion = async (questionId, data = {}) => {
  if (!isValidUUID(questionId)) {
    const err = new Error('Invalid question identifier.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Fetch target question and its event status
  const findSql = `
    SELECT
      q.id,
      q.event_id,
      q.question_order,
      e.status AS event_status
    FROM questions q
    JOIN event e ON e.id = q.event_id
    WHERE q.id = $1
    LIMIT 1;
  `;
  const findRes = await query(findSql, [questionId]);

  if (findRes.rows.length === 0) {
    const err = new Error('Question not found.');
    err.statusCode = 404;
    throw err;
  }

  const existing = findRes.rows[0];

  // 2. Verify active event match (cross-event protection)
  const activeEvent = await getActiveEvent();
  if (existing.event_id !== activeEvent.id) {
    const err = new Error('Question does not belong to the active competition event.');
    err.statusCode = 403;
    throw err;
  }

  // 3. Verify event is READY
  assertEventIsReady(activeEvent);

  // 4. Validate fields to update
  const updates = [];
  const params = [];
  let paramIdx = 1;

  if (data.questionText !== undefined) {
    if (typeof data.questionText !== 'string' || data.questionText.trim().length === 0) {
      const err = new Error('Question text cannot be empty.');
      err.statusCode = 400;
      throw err;
    }
    updates.push(`question_text = $${paramIdx++}`);
    params.push(data.questionText.trim());
  }

  ['optionA', 'optionB', 'optionC', 'optionD'].forEach((optKey) => {
    if (data[optKey] !== undefined) {
      const val = data[optKey];
      if (typeof val !== 'string' || val.trim().length === 0) {
        const err = new Error(`${optKey.replace('option', 'Option ')} cannot be empty.`);
        err.statusCode = 400;
        throw err;
      }
      const colName = optKey.replace('option', 'option_').toLowerCase();
      updates.push(`${colName} = $${paramIdx++}`);
      params.push(val.trim());
    }
  });

  if (data.correctOption !== undefined) {
    const normalizedCorrect =
      typeof data.correctOption === 'string' ? data.correctOption.trim().toUpperCase() : '';
    if (!VALID_OPTIONS.includes(normalizedCorrect)) {
      const err = new Error(`Correct option must be one of: ${VALID_OPTIONS.join(', ')}.`);
      err.statusCode = 400;
      throw err;
    }
    updates.push(`correct_option = $${paramIdx++}`);
    params.push(normalizedCorrect);
  }

  if (data.timeLimitSeconds !== undefined) {
    const parsedTimer = Number(data.timeLimitSeconds);
    if (!Number.isInteger(parsedTimer) || parsedTimer < MIN_TIMER_SECONDS || parsedTimer > MAX_TIMER_SECONDS) {
      const err = new Error(
        `Timer must be an integer between ${MIN_TIMER_SECONDS} and ${MAX_TIMER_SECONDS} seconds.`
      );
      err.statusCode = 400;
      throw err;
    }
    updates.push(`time_limit_seconds = $${paramIdx++}`);
    params.push(parsedTimer);
  }

  if (data.questionOrder !== undefined) {
    const parsedOrder = Number(data.questionOrder);
    if (!Number.isInteger(parsedOrder) || parsedOrder <= 0) {
      const err = new Error('Question order must be a positive integer.');
      err.statusCode = 400;
      throw err;
    }

    if (parsedOrder !== existing.question_order) {
      // Check duplicate
      const dupCheck = await query(
        `SELECT id FROM questions WHERE event_id = $1 AND question_order = $2 AND id != $3;`,
        [existing.event_id, parsedOrder, questionId]
      );
      if (dupCheck.rows.length > 0) {
        const err = new Error(`Question order ${parsedOrder} is already assigned to another question.`);
        err.statusCode = 409;
        throw err;
      }
      updates.push(`question_order = $${paramIdx++}`);
      params.push(parsedOrder);
    }
  }

  if (updates.length === 0) {
    const err = new Error('No valid fields provided for update.');
    err.statusCode = 400;
    throw err;
  }

  const updateSql = `
    UPDATE questions
    SET ${updates.join(', ')}
    WHERE id = $${paramIdx}
    RETURNING
      id,
      event_id,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      time_limit_seconds,
      question_order,
      created_at,
      updated_at;
  `;
  params.push(questionId);

  try {
    const { rows } = await query(updateSql, params);
    const q = rows[0];
    return {
      success: true,
      message: 'Question updated successfully.',
      question: {
        id: q.id,
        questionText: q.question_text,
        optionA: q.option_a,
        optionB: q.option_b,
        optionC: q.option_c,
        optionD: q.option_d,
        correctOption: q.correct_option,
        timeLimitSeconds: q.time_limit_seconds,
        questionOrder: q.question_order,
        createdAt: q.created_at,
        updatedAt: q.updated_at,
      },
    };
  } catch (err) {
    if (err.code === '23505') {
      const error = new Error('Question order must be unique within the event.');
      error.statusCode = 409;
      throw error;
    }
    throw err;
  }
};

/**
 * Deletes a question from the active event.
 * Allowed ONLY when event.status = READY.
 * Compacts subsequent question orders in a transaction.
 *
 * @param {string} questionId
 * @returns {Promise<Object>}
 */
export const deleteQuestion = async (questionId) => {
  if (!isValidUUID(questionId)) {
    const err = new Error('Invalid question identifier.');
    err.statusCode = 400;
    throw err;
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 1. Fetch question and lock row
    const findSql = `
      SELECT
        q.id,
        q.event_id,
        q.question_order,
        e.status AS event_status
      FROM questions q
      JOIN event e ON e.id = q.event_id
      WHERE q.id = $1
      FOR UPDATE;
    `;
    const findRes = await client.query(findSql, [questionId]);

    if (findRes.rows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('Question not found.');
      err.statusCode = 404;
      throw err;
    }

    const question = findRes.rows[0];

    // 2. Cross-event protection
    const activeEvent = await getActiveEvent();
    if (question.event_id !== activeEvent.id) {
      await client.query('ROLLBACK');
      const err = new Error('Question does not belong to the active competition event.');
      err.statusCode = 403;
      throw err;
    }

    // 3. Verify event is READY
    if (question.event_status === 'LIVE' || question.event_status === 'ENDED') {
      await client.query('ROLLBACK');
      const err = new Error(
        `Questions are locked because Round 1 is ${question.event_status}. Cannot delete questions.`
      );
      err.statusCode = 409;
      throw err;
    }

    // 4. Delete the question
    await client.query('DELETE FROM questions WHERE id = $1;', [questionId]);

    // 5. Compact question orders for all subsequent questions
    await client.query(
      `UPDATE questions
       SET question_order = question_order - 1
       WHERE event_id = $1 AND question_order > $2;`,
      [question.event_id, question.question_order]
    );

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Question deleted successfully.',
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { }
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Reorders questions atomically within the active event.
 * Allowed ONLY when event.status = READY.
 * Uses an atomic CASE update to avoid unique constraint violations.
 *
 * @param {Array<string>} questionIds - Array of question UUIDs in new sequential order
 * @returns {Promise<Object>}
 */
/*export const reorderQuestions = async (questionIds) => {
  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    const err = new Error('questionIds must be a non-empty array of question identifiers.');
    err.statusCode = 400;
    throw err;
  }

  // Validate UUID formats
  for (const id of questionIds) {
    if (!isValidUUID(id)) {
      const err = new Error(`Invalid question identifier: ${id}`);
      err.statusCode = 400;
      throw err;
    }
  }

  // Check duplicate IDs in payload
  const uniqueIds = new Set(questionIds);
  if (uniqueIds.size !== questionIds.length) {
    const err = new Error('Duplicate question IDs in reorder request.');
    err.statusCode = 400;
    throw err;
  }

  const activeEvent = await getActiveEvent();
  assertEventIsReady(activeEvent);

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Fetch all existing question IDs for this event
    const existingSql = `
      SELECT id FROM questions
      WHERE event_id = $1;
    `;
    const { rows: existingRows } = await client.query(existingSql, [activeEvent.id]);
    const existingIds = new Set(existingRows.map((r) => r.id));

    // Verify all existing questions are accounted for (exact set match)
    if (existingIds.size !== questionIds.length) {
      await client.query('ROLLBACK');
      const err = new Error(
        `Reorder set mismatch: expected ${existingIds.size} questions, received ${questionIds.length}.`
      );
      err.statusCode = 400;
      throw err;
    }

    for (const id of questionIds) {
      if (!existingIds.has(id)) {
        await client.query('ROLLBACK');
        const err = new Error(
          'Reorder failed: all questions must belong to the active competition event.'
        );
        err.statusCode = 400;
        throw err;
      }
    }

    // Step 1: Shift existing orders by a safe positive offset to eliminate
    // unique collisions during row-by-row target updates, while strictly
    // satisfying the `question_order > 0` check constraint.
    await client.query(
      `UPDATE questions SET question_order = question_order + 1000000 WHERE event_id = $1;`,
      [activeEvent.id]
    );

    // Step 2: Assign new 1-based sequential orders atomically using fully parameterized SQL
    const cases = [];
    const queryParams = [activeEvent.id];

    questionIds.forEach((id, index) => {
      queryParams.push(id);
      const idParamIndex = queryParams.length;
      queryParams.push(index + 1);
      const orderParamIndex = queryParams.length;
      cases.push(`WHEN id = $${idParamIndex} THEN $${orderParamIndex}`);
    });

    const reorderSql = `
      UPDATE questions
      SET question_order = CASE
        ${cases.join(' ')}
      END
      WHERE event_id = $1;
    `;

    await client.query(reorderSql, queryParams);
    await client.query('COMMIT');

    return {
      success: true,
      message: 'Questions reordered successfully.',
      totalReordered: questionIds.length,
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Validates the question bank for the active event.
 * Reusable by future event-start logic.
 * Does NOT start the event.
 *
 * @returns {Promise<{ valid: boolean, questionCount: number, errors: Array<string> }>}
 */
export const reorderQuestions = async (questionIds) => {
  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    const err = new Error('questionIds must be a non-empty array of question identifiers.');
    err.statusCode = 400;
    throw err;
  }

  for (const id of questionIds) {
    if (!isValidUUID(id)) {
      const err = new Error(`Invalid question identifier: ${id}`);
      err.statusCode = 400;
      throw err;
    }
  }

  const uniqueIds = new Set(questionIds);
  if (uniqueIds.size !== questionIds.length) {
    const err = new Error('Duplicate question IDs in reorder request.');
    err.statusCode = 400;
    throw err;
  }

  const activeEvent = await getActiveEvent();
  assertEventIsReady(activeEvent);

  const client = await getClient();

  try {
    await client.query('BEGIN');

    const existingSql = `
      SELECT id
      FROM questions
      WHERE event_id = $1
      FOR UPDATE;
    `;

    const { rows: existingRows } = await client.query(existingSql, [
      activeEvent.id,
    ]);

    const existingIds = new Set(existingRows.map((row) => row.id));

    if (existingIds.size !== questionIds.length) {
      const err = new Error(
        `Reorder set mismatch: expected ${existingIds.size} questions, received ${questionIds.length}.`
      );
      err.statusCode = 400;
      throw err;
    }

    for (const id of questionIds) {
      if (!existingIds.has(id)) {
        const err = new Error(
          'Reorder failed: all questions must belong to the active competition event.'
        );
        err.statusCode = 400;
        throw err;
      }
    }

    /*
     * Move all existing orders into a temporary range first.
     * This preserves the UNIQUE(event_id, question_order) constraint.
     */
    await client.query(
      `
        UPDATE questions
        SET question_order = question_order + 1000000
        WHERE event_id = $1;
      `,
      [activeEvent.id]
    );

    /*
     * Assign the requested 1-based order.
     * Each row is updated individually, so the unique constraint
     * never sees two questions with the same final order.
     */
    for (let index = 0; index < questionIds.length; index += 1) {
      await client.query(
        `
          UPDATE questions
          SET question_order = $1
          WHERE id = $2
            AND event_id = $3;
        `,
        [index + 1, questionIds[index], activeEvent.id]
      );
    }

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Questions reordered successfully.',
      totalReordered: questionIds.length,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) { }

    if (err.code === '23505') {
      const error = new Error(
        'Question order must be unique within the event.'
      );
      error.statusCode = 409;
      throw error;
    }

    throw err;
  } finally {
    client.release();
  }
};
export const validateQuestionBank = async () => {
  const event = await getActiveEvent();
  const errors = [];

  // Check event status
  if (event.status !== 'READY') {
    errors.push(`Event is currently in '${event.status}' status (must be 'READY' to validate).`);
  }

  // Fetch all questions
  const sql = `
    SELECT
      id,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      time_limit_seconds,
      question_order
    FROM questions
    WHERE event_id = $1
    ORDER BY question_order ASC;
  `;
  const { rows: questions } = await query(sql, [event.id]);

  if (questions.length === 0) {
    errors.push('Question bank is empty. At least 1 question is required.');
  }

  const seenOrders = new Set();

  questions.forEach((q, idx) => {
    const qNum = idx + 1;

    // Validate text
    if (!q.question_text || q.question_text.trim().length === 0) {
      errors.push(`Question #${qNum} (Order ${q.question_order}) has empty question text.`);
    }

    // Validate options
    ['a', 'b', 'c', 'd'].forEach((opt) => {
      const optVal = q[`option_${opt}`];
      if (!optVal || optVal.trim().length === 0) {
        errors.push(`Question #${qNum} has empty Option ${opt.toUpperCase()}.`);
      }
    });

    // Validate correct_option
    if (!VALID_OPTIONS.includes(q.correct_option)) {
      errors.push(`Question #${qNum} has invalid correct option '${q.correct_option}'.`);
    }

    // Validate timer
    if (!q.time_limit_seconds || q.time_limit_seconds <= 0) {
      errors.push(`Question #${qNum} has invalid time limit (${q.time_limit_seconds}s).`);
    }

    // Check duplicate order
    if (seenOrders.has(q.question_order)) {
      errors.push(`Duplicate question order '${q.question_order}' detected.`);
    }
    seenOrders.add(q.question_order);

    // Contiguous order check
    if (q.question_order !== qNum) {
      errors.push(`Question order gap/mismatch: expected order ${qNum}, found ${q.question_order}.`);
    }
  });

  return {
    valid: errors.length === 0,
    questionCount: questions.length,
    errors,
  };
};
