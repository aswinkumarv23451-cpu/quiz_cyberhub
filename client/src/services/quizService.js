const API_BASE = '/api';

/**
 * Starts or resumes the quiz attempt for the authenticated Team Lead.
 * @returns {Promise<Object>}
 */
export async function startQuiz() {
  const res = await fetch(`${API_BASE}/quiz/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok && !data.notStarted) {
    throw new Error(data.message || 'Failed to start quiz.');
  }
  return data;
}

/**
 * Retrieves the current question and server deadline (browser recovery / refresh).
 * @returns {Promise<Object>}
 */
export async function getCurrentQuiz() {
  const res = await fetch(`${API_BASE}/quiz/current`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok && !data.notStarted) {
    throw new Error(data.message || 'Failed to fetch current quiz state.');
  }
  return data;
}

/**
 * Submits an answer for the active question.
 * @param {string} selectedOption - 'A' | 'B' | 'C' | 'D'
 * @returns {Promise<Object>}
 */
export async function submitAnswer(selectedOption, questionId) {
  const res = await fetch(`${API_BASE}/quiz/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ selectedOption, ...(questionId ? { questionId } : {}) }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to submit answer.');
  }
  return data;
}

/**
 * Skips the active question.
 * @returns {Promise<Object>}
 */
export async function skipQuestion() {
  const res = await fetch(`${API_BASE}/quiz/skip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to skip question.');
  }
  return data;
}
