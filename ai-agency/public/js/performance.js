// Employee performance from what actually happened at work: how often the
// manager approved work on the first review, how much was delivered (weighted
// by priority), whether project work landed before the project's due date,
// and the owner's own star ratings. Pure functions, testable without a browser.

export const GRADES = [
  { min: 85, name: 'ممتاز', cls: 'excellent' },
  { min: 70, name: 'جيد جداً', cls: 'verygood' },
  { min: 55, name: 'جيد', cls: 'good' },
  { min: 40, name: 'يحتاج تحسين', cls: 'improve' },
  { min: 0, name: 'ضعيف', cls: 'weak' },
];
export const RECOMMENDATIONS = { promote: 'ترقية', bonus: 'مكافأة', improve: 'خطة تحسين', none: 'استمرار' };

const WEIGHTS = { quality: 35, rating: 25, output: 25, punctuality: 15 };
const POINTS = { low: 1, medium: 2, high: 3 };
const WINDOW_DAYS = 90;
const DAY = 86400000;

export const gradeOf = (score) => GRADES.find((g) => score >= g.min);

/** Raw numbers for one employee over the last `days` days. */
export function metricsOf(state, empId, { now = Date.now(), days = WINDOW_DAYS } = {}) {
  const since = now - days * DAY;
  const mine = state.tasks.filter((t) => t.empId === empId);
  const done = mine.filter((t) => t.status === 'done' && (t.doneAt || t.createdAt || 0) >= since);
  const reviewed = done.filter((t) => t.reviews?.length);
  const firstPass = reviewed.filter((t) => t.reviews[0].decision === 'approve').length;
  const rated = done.filter((t) => t.rating >= 1 && t.rating <= 5);
  const projectDone = done.filter((t) => t.projectId);
  const onTime = projectDone.filter((t) => {
    const p = state.projects?.find((x) => x.id === t.projectId);
    return !p?.due || new Date(t.doneAt || 0).toISOString().slice(0, 10) <= p.due;
  }).length;
  return {
    done: done.length,
    points: done.reduce((s, t) => s + (POINTS[t.priority] || 1), 0),
    reviewed: reviewed.length,
    firstPass,
    revisions: reviewed.reduce((s, t) => s + Math.max(0, t.reviews.length - 1), 0),
    ratingAvg: rated.length ? rated.reduce((s, t) => s + t.rating, 0) / rated.length : null,
    rated: rated.length,
    projectDone: projectDone.length,
    onTime,
    open: mine.filter((t) => t.status === 'todo').length,
  };
}

/**
 * A 0-100 score with a grade. Each part counts only when there is data for
 * it; the remaining weights are scaled up. Output is measured against the
 * busiest person on the team, so it reflects relative contribution.
 */
export function scoreOf(m, teamBestPoints) {
  if (!m.done) return { score: null, grade: null, parts: {} };
  const parts = {};
  if (m.reviewed) parts.quality = (m.firstPass / m.reviewed) * 100;
  if (m.ratingAvg !== null) parts.rating = ((m.ratingAvg - 1) / 4) * 100;
  parts.output = Math.min(100, (m.points / Math.max(1, teamBestPoints)) * 100);
  if (m.projectDone) parts.punctuality = (m.onTime / m.projectDone) * 100;
  const used = Object.keys(parts);
  const total = used.reduce((s, k) => s + WEIGHTS[k], 0);
  const score = Math.round(used.reduce((s, k) => s + parts[k] * WEIGHTS[k], 0) / total);
  return { score, grade: gradeOf(score), parts: Object.fromEntries(used.map((k) => [k, Math.round(parts[k])])) };
}

/** Everyone's metrics and score, best first; people with no finished work last. */
export function teamPerformance(state, opts = {}) {
  const rows = state.employees.map((e) => ({ emp: e, m: metricsOf(state, e.id, opts) }));
  const best = Math.max(1, ...rows.map((r) => r.m.points));
  return rows.map((r) => ({ ...r, ...scoreOf(r.m, best) }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.m.points - a.m.points);
}

/** The top scorer with enough finished work to count (at least two tasks). */
export function employeeOfMonth(state, opts = {}) {
  return teamPerformance(state, opts).find((r) => r.score !== null && r.m.done >= 2) || null;
}

/** Who writes someone's evaluation: their manager, else the HR manager, else nobody (the owner reads the numbers). */
export function evaluatorOf(state, e) {
  const boss = e.managerId && state.employees.find((x) => x.id === e.managerId);
  if (boss) return boss;
  const hr = state.employees.filter((x) => x.dept === 'hr' && x.level >= 5 && x.id !== e.id).sort((a, b) => b.level - a.level)[0];
  return hr || null;
}

/** Reads the evaluator's JSON answer into a stored evaluation. */
export function parseEvaluation(reply) {
  try {
    const v = JSON.parse(reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1));
    const rec = Object.hasOwn(RECOMMENDATIONS, v.recommendation) ? v.recommendation : 'none';
    const clip = (x, n) => (typeof x === 'string' ? x.trim().slice(0, n) : '');
    return { summary: clip(v.summary, 600), strengths: clip(v.strengths, 300), improve: clip(v.improve, 300), recommendation: rec, reason: clip(v.reason, 300) };
  } catch {
    return null;
  }
}

export function recordEvaluation(state, { empId, by, row, parsed, newId, at = Date.now() }) {
  state.evaluations ||= [];
  const ev = { id: newId(state, 'v'), empId, by, at, score: row.score, grade: row.grade?.name || null, metrics: row.m, ...parsed };
  state.evaluations.push(ev);
  // Keep the last 6 per person.
  const mine = state.evaluations.filter((x) => x.empId === empId);
  if (mine.length > 6) state.evaluations = state.evaluations.filter((x) => x.empId !== empId || mine.slice(-6).includes(x));
  return ev;
}

export const lastEvaluation = (state, empId) => (state.evaluations || []).filter((x) => x.empId === empId).at(-1) || null;
