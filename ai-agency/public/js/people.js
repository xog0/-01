// The people side of the agency: morale (and the resignations it can lead
// to), workload balance between teammates, and training. Pure functions
// over the state, so they can be unit-tested.
import { LEVEL_SALARY, addLedger } from './finance.js';
import { LADDER, nextLevel } from './data.js';
import { lastEvaluation, metricsOf } from './performance.js';
import { dayKey, addDays, leaveOn } from './hr.js';

const ONE_DAY = 86400000;
const clampNum = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const salaryFor = (level) => LEVEL_SALARY[clampNum(level, 0, LEVEL_SALARY.length - 1)];

// ---- workload -------------------------------------------------------------------
const PRIORITY_ORDER = { low: 0, medium: 1, high: 2 };
export const OVERLOAD_HOURS = 24; // three working days of open work
export const taskHoursOf = (state, t) => (state.finance?.taskHours || { low: 2, medium: 4, high: 8 })[t.priority] ?? 4;
export function workloadOf(state, empId) {
  const open = state.tasks.filter((t) => t.empId === empId && t.status !== 'done');
  return { tasks: open.length, hours: open.reduce((s, t) => s + taskHoursOf(state, t), 0) };
}

/**
 * For each team (people under one manager) where someone has three days of
 * work or more while a teammate has none: the waiting tasks to move, lowest
 * priority first, to the lightest teammate (same department first), until
 * the busy one is under the limit or a move would not help.
 */
export function rebalancePlans(state, { available = () => true } = {}) {
  const teams = new Map();
  for (const e of state.employees) if (e.managerId && available(e)) (teams.get(e.managerId) || teams.set(e.managerId, []).get(e.managerId)).push(e);
  const plans = [];
  for (const [managerId, team] of teams) {
    if (team.length < 2) continue;
    const load = new Map(team.map((e) => [e.id, workloadOf(state, e.id).hours]));
    if (!team.some((e) => load.get(e.id) === 0)) continue;
    const heavy = team.filter((e) => load.get(e.id) >= OVERLOAD_HOURS).sort((a, b) => load.get(b.id) - load.get(a.id));
    const moves = [];
    for (const from of heavy) {
      const waiting = state.tasks.filter((t) => t.empId === from.id && t.status === 'todo')
        .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || (a.createdAt || 0) - (b.createdAt || 0));
      for (const t of waiting) {
        if (load.get(from.id) < OVERLOAD_HOURS) break;
        const h = taskHoursOf(state, t);
        const to = team.filter((e) => e.id !== from.id)
          .sort((a, b) => load.get(a.id) - load.get(b.id) || (b.dept === from.dept) - (a.dept === from.dept))[0];
        if (!to || load.get(to.id) + h > load.get(from.id) - h) break;
        moves.push({ taskId: t.id, from: from.id, to: to.id });
        load.set(from.id, load.get(from.id) - h);
        load.set(to.id, load.get(to.id) + h);
      }
    }
    if (moves.length) plans.push({ managerId, moves });
  }
  return plans;
}

/** Carries out a plan; tasks that started or changed hands meanwhile are skipped. */
export function applyRebalance(state, plan) {
  const moved = [];
  for (const m of plan.moves) {
    const t = state.tasks.find((x) => x.id === m.taskId);
    if (!t || t.status !== 'todo' || t.empId !== m.from) continue;
    t.empId = m.to;
    t.movedFrom = m.from;
    moved.push({ ...m, title: t.title });
  }
  return moved;
}

// ---- morale ---------------------------------------------------------------------
export const MOODS = [
  { min: 75, name: 'متحمس', icon: '😄', cls: 'happy' },
  { min: 55, name: 'راضٍ', icon: '🙂', cls: 'ok' },
  { min: 35, name: 'متضايق', icon: '😕', cls: 'low' },
  { min: 0, name: 'محبط', icon: '😞', cls: 'critical' },
];
export const moodOf = (score) => MOODS.find((m) => score >= m.min);
const capSum = (list, each, cap) => (cap > 0 ? Math.min(cap, list.length * each) : Math.max(cap, list.length * each));

/** 0-100 from what the employee lives through at work, with the reasons. */
export function moraleOf(state, e, { now = Date.now() } = {}) {
  const factors = [];
  const add = (delta, label) => { if (delta) factors.push({ delta: Math.round(delta), label }); };
  const { hours } = workloadOf(state, e.id);
  const recentDone = state.tasks.filter((t) => t.empId === e.id && t.status === 'done' && (t.doneAt || 0) >= now - 14 * ONE_DAY).length;
  if (hours >= 40) add(-20, `ضغط عمل كبير (${hours} ساعة مهام مفتوحة)`);
  else if (hours >= OVERLOAD_HOURS) add(-10, `ضغط عمل (${hours} ساعة مهام مفتوحة)`);
  else if (hours === 0 && recentDone === 0) add(-5, 'بلا عمل منذ مدة');
  const ratio = (e.salary || 0) / salaryFor(e.level);
  if (ratio < 0.85) add(-15, 'راتبه أقل بوضوح من مستواه');
  else if (ratio < 0.95) add(-7, 'راتبه أقل قليلاً من مستواه');
  else if (ratio > 1.15) add(8, 'راتب مجزٍ لمستواه');
  const recent = (state.finance?.adjustments || []).filter((a) => a.empId === e.id && a.at >= now - 60 * ONE_DAY);
  add(capSum(recent.filter((a) => a.type === 'bonus' || a.type === 'taskBonus'), 6, 15), 'مكافآت حديثة');
  add(capSum(recent.filter((a) => a.type === 'raise'), 10, 15), 'زيادة أو ترقية حديثة');
  add(capSum(recent.filter((a) => a.type === 'deduction'), -8, -20), 'خصومات حديثة');
  add(capSum(recent.filter((a) => a.type === 'cut'), -20, -30), 'تخفيض راتبه');
  const m = metricsOf(state, e.id, { now });
  if (m.rated && m.ratingAvg >= 4.2) add(8, 'تقديرك لعمله');
  else if (m.rated && m.ratingAvg <= 2.5) add(-8, 'تقييمك المنخفض لعمله');
  const ev = lastEvaluation(state, e.id);
  if (ev && ev.at >= now - 90 * ONE_DAY) {
    if (ev.grade === 'ممتاز' || ev.grade === 'جيد جداً') add(6, `تقييم أداء ${ev.grade}`);
    else if (ev.grade === 'ضعيف' || ev.grade === 'يحتاج تحسين') add(-6, `تقييم أداء ${ev.grade}`);
  }
  const next = nextLevel(e.level);
  if (next !== null && e.xp >= LADDER[next].xp) add(e.promoAck === e.level ? -10 : -4, 'ترقية مستحقة لم تتم');
  if ((state.promises || []).some((p) => p.empId === e.id && p.status === 'open')) add(6, 'وعد بالترقية');
  add(capSum((state.trainings || []).filter((t) => t.empId === e.id && t.status === 'done' && (t.doneAt || 0) >= now - 90 * ONE_DAY), 5, 10), 'تدريب وتطوير');
  const since = dayKey(now - 30 * ONE_DAY);
  if ((state.leaves || []).some((l) => l.empId === e.id && l.to >= since && l.from <= dayKey(now))) add(3, 'أخذ إجازة مؤخراً');
  if (e.moraleBoost && e.moraleBoost.until > now) add(e.moraleBoost.amount, e.moraleBoost.reason || 'اهتمام الإدارة');
  const score = clampNum(70 + factors.reduce((s, f) => s + f.delta, 0), 0, 100);
  return { score, mood: moodOf(score), factors: factors.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)) };
}

// ---- resignation ------------------------------------------------------------------
export const RESIGN_BELOW = 35;
/** The daily chance someone this unhappy hands in their resignation. */
export const resignationRisk = (score) => (score < RESIGN_BELOW ? (RESIGN_BELOW - score) / 70 : 0);
export const pendingResignation = (state, empId) => (state.resignations || []).find((r) => r.empId === empId && r.status === 'pending') || null;

export const OFFERS = {
  raise: { name: 'زيادة دائمة على الراتب', amount: true },
  bonus: { name: 'مكافأة لمرة واحدة', amount: true },
  promise: { name: 'وعد بالترقية', amount: false },
  lighten: { name: 'تخفيف ضغط العمل', amount: false },
  talk: { name: 'حديث ودي دون عرض', amount: false },
};
/**
 * Does the offer keep them? Its weight depends on what is wrong: money helps
 * most when pay is the problem, lighter work when workload is.
 */
export function retentionOutcome(state, e, offer, { now = Date.now() } = {}) {
  const { score, factors } = moraleOf(state, e, { now });
  const hurts = (word) => factors.some((f) => f.delta < 0 && f.label.includes(word));
  const amount = Math.max(0, Number(offer.amount) || 0);
  const pct = e.salary ? amount / e.salary : 0;
  let boost = 3;
  if (offer.type === 'raise') boost = Math.min(30, pct * 150) + (hurts('راتب') || hurts('تخفيض') ? 8 : 0);
  if (offer.type === 'bonus') boost = Math.min(18, pct * 60) + (hurts('خصومات') ? 4 : 0);
  if (offer.type === 'promise') boost = 10 + (hurts('ترقية') ? 10 : 0);
  if (offer.type === 'lighten') boost = hurts('ضغط عمل') ? 22 : 4;
  boost = Math.round(boost);
  return { stays: score + boost >= 45, boost, score };
}

// ---- training ---------------------------------------------------------------------
export const DEFAULT_TRAINING_BUDGET = 20000;
export const COURSES = [
  { id: 'time', title: 'إدارة الوقت والأولويات', dept: null, days: 1, cost: 800, xp: 15 },
  { id: 'present', title: 'العرض والإقناع أمام العملاء', dept: null, days: 2, cost: 1500, xp: 20 },
  { id: 'lead', title: 'القيادة وإدارة الفرق', dept: null, minLevel: 4, days: 3, cost: 3500, xp: 35 },
  { id: 'copy', title: 'الكتابة الإعلانية المتقدمة', dept: 'content', days: 3, cost: 2500, xp: 30 },
  { id: 'story', title: 'سرد القصص للعلامات التجارية', dept: 'content', days: 2, cost: 1800, xp: 25 },
  { id: 'growth', title: 'نمو الحسابات وإدارة المجتمعات', dept: 'social', days: 2, cost: 2000, xp: 25 },
  { id: 'reels', title: 'صناعة الفيديو القصير', dept: 'social', days: 3, cost: 2600, xp: 30 },
  { id: 'meta', title: 'إعلانات ميتا المتقدمة', dept: 'ads', days: 3, cost: 3000, xp: 30 },
  { id: 'gads', title: 'إعلانات جوجل وقياس التحويل', dept: 'ads', days: 3, cost: 3000, xp: 30 },
  { id: 'brand', title: 'تصميم الهوية البصرية', dept: 'design', days: 4, cost: 3200, xp: 35 },
  { id: 'ux', title: 'أساسيات تجربة المستخدم', dept: 'design', days: 2, cost: 2200, xp: 25 },
  { id: 'seo', title: 'السيو التقني وتحليل الكلمات', dept: 'seo', days: 3, cost: 2500, xp: 30 },
  { id: 'crisis', title: 'إدارة الأزمات والعلاقات الإعلامية', dept: 'pr', days: 2, cost: 2400, xp: 25 },
  { id: 'auto', title: 'أتمتة التسويق بالبريد', dept: 'email', days: 2, cost: 2000, xp: 25 },
  { id: 'plan', title: 'التخطيط الاستراتيجي للحملات', dept: 'strategy', days: 3, cost: 3500, xp: 35 },
  { id: 'analytics', title: 'تحليلات التسويق ولوحات القياس', dept: 'marketing', days: 3, cost: 3000, xp: 30 },
  { id: 'consult', title: 'البيع الاستشاري والتفاوض', dept: 'sales', days: 2, cost: 2500, xp: 25 },
  { id: 'talent', title: 'التوظيف المبني على الكفاءات', dept: 'hr', days: 2, cost: 2200, xp: 25 },
  { id: 'budget', title: 'التحليل المالي وإعداد الميزانيات', dept: 'finance', days: 3, cost: 3000, xp: 30 },
  { id: 'gov', title: 'القيادة التنفيذية والحوكمة', dept: 'executive', days: 3, cost: 5000, xp: 40 },
];
export const courseById = (id) => COURSES.find((c) => c.id === id) || null;
const trainingYear = (state, year) => (state.trainings || []).filter((t) => (t.from || '').startsWith(String(year)));
export function trainingBudget(state, year = dayKey().slice(0, 4)) {
  const total = state.finance?.trainingBudget ?? DEFAULT_TRAINING_BUDGET;
  const spent = trainingYear(state, year).reduce((s, t) => s + t.cost, 0);
  return { total, spent, left: Math.max(0, total - spent) };
}
/** Courses someone can take: general ones for their level and their department's, minus what they took. */
export function coursesFor(state, e) {
  const taken = new Set((state.trainings || []).filter((t) => t.empId === e.id).map((t) => t.courseId));
  return COURSES.filter((c) => (!c.dept || c.dept === e.dept) && (!c.minLevel || e.level >= c.minLevel) && !taken.has(c.id));
}
export const activeTraining = (state, empId) => (state.trainings || []).find((t) => t.empId === empId && t.status === 'enrolled') || null;

/** Books a course: paid from the training budget and recorded as an expense. */
export function enroll(state, { empId, courseId, by = 'owner' }, { newId, now = Date.now() }) {
  const e = state.employees.find((x) => x.id === empId);
  if (!e) throw new Error('الموظف غير موجود');
  const c = courseById(courseId);
  if (!c) throw new Error('الدورة غير موجودة');
  if (!coursesFor(state, e).some((x) => x.id === c.id)) throw new Error(`دورة «${c.title}» لا تناسب ${e.name} أو حضرها من قبل`);
  if (activeTraining(state, empId)) throw new Error(`${e.name} في دورة الآن، ينهيها أولاً`);
  const from = dayKey(now);
  const budget = trainingBudget(state, from.slice(0, 4));
  if (c.cost > budget.left) throw new Error(`ميزانية التدريب لا تكفي: المتبقي ${budget.left} والدورة ${c.cost}`);
  const t = { id: newId(state, 'tr'), empId, courseId: c.id, title: c.title, cost: c.cost, days: c.days, xp: c.xp, from, to: addDays(from, c.days - 1), status: 'enrolled', by, at: now };
  state.trainings ||= [];
  state.trainings.push(t);
  state.trainings = state.trainings.slice(-300);
  if (state.finance) addLedger(state, { type: 'expense', category: 'تدريب', amount: c.cost, note: `دورة «${c.title}» لـ${e.name}`, at: now });
  return t;
}
/** Courses whose last day has passed are completed: the experience counts. */
export function completeTrainings(state, { now = Date.now() } = {}) {
  const today = dayKey(now);
  const done = [];
  for (const t of state.trainings || []) {
    if (t.status !== 'enrolled' || t.to >= today) continue;
    const e = state.employees.find((x) => x.id === t.empId);
    t.status = 'done';
    t.doneAt = now;
    if (e) e.xp = (e.xp || 0) + (t.xp || 0);
    done.push(t);
  }
  return done;
}

// ---- interns who earned a real job -----------------------------------------------------
export const GRADUATE_SCORE = 70;
export const GRADUATE_TASKS = 3;
/** Interns with a strong score and enough finished work, not yet put forward or turned down lately. */
export function graduationCandidates(state, rows, { now = Date.now() } = {}) {
  return rows.filter((r) => r.emp.level === 0 && r.score !== null && r.score >= GRADUATE_SCORE && r.m.done >= GRADUATE_TASKS
    && !(r.emp.gradAck && now - r.emp.gradAck < 30 * ONE_DAY) && !leaveOn(state, r.emp.id, dayKey(now)));
}
