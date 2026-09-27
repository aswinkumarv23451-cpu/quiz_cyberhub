const BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';
const API_BASE = `${BASE_URL}/api`;

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
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.notStarted) {
    const err = new Error(data.message || 'Failed to start quiz.');
    err.status = res.status;
    err.data = data;
    throw err;
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.notStarted) {
    const err = new Error(data.message || 'Failed to fetch current quiz state.');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/**
 * Submits an answer for the active question.
 * @param {string} selectedOption - 'A' | 'B' | 'C' | 'D'
 * @param {string} [questionId] - Question UUID
 * @returns {Promise<Object>}
 */
export async function submitAnswer(selectedOption, questionId) {
  const res = await fetch(`${API_BASE}/quiz/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ selectedOption, ...(questionId ? { questionId } : {}) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Failed to submit answer.');
    err.status = res.status;
    err.data = data;
    throw err;
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Failed to skip question.');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
