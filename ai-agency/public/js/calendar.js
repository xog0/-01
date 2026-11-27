// The agency's calendar: which days are work days, what happened or is
// due on a given day, the week's numbers for the weekly report, and the
// reports the managers write (morning plan, end of day, weekly).
// Pure functions over the state, so they can be unit-tested.
import { addDays, dayKey, leaveOn } from './hr.js';

export const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const DEFAULT_WORK_DAYS = [0, 1, 2, 3, 4]; // Sunday to Thursday
export const REPORT_TYPES = { standup: 'خطة الصباح', eod: 'تقرير نهاية اليوم', weekly: 'التقرير الأسبوعي' };
const KEEP_REPORTS = 60;

const weekdayOf = (key) => new Date(`${key}T00:00:00Z`).getUTCDay();
const keyOf = (ms) => dayKey(ms);
export const workDays = (state) => (Array.isArray(state.calendar?.workDays) && state.calendar.workDays.length ? state.calendar.workDays : DEFAULT_WORK_DAYS);
export const isWorkDay = (state, key) => workDays(state).includes(weekdayOf(key)) && !(state.calendar?.holidays || []).some((h) => h.day === key);

/** Sunday that starts the week of `key`. */
export const weekStart = (key) => addDays(key, -weekdayOf(key));
/** True when no later day this week is a work day. */
export function lastWorkDayOfWeek(state, key) {
  for (let d = addDays(key, 1); weekdayOf(d) !== 0; d = addDays(d, 1)) if (isWorkDay(state, d)) return false;
  return true;
}

/** Weeks (Sunday first) covering a month; days outside it are null. */
export function monthGrid(year, month) {
  const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const weeks = [];
  for (let d = weekStart(first); ; ) {
    const week = [];
    for (let i = 0; i < 7; i++, d = addDays(d, 1)) week.push(Number(d.slice(5, 7)) === month + 1 ? d : null);
    weeks.push(week);
    if (Number(d.slice(5, 7)) !== month + 1) break;
  }
  return weeks;
}

/** Everything on one day: leave, project deadlines, meetings, finished work, reports, attendance. */
export function dayEvents(state, key) {
  return {
    work: isWorkDay(state, key),
    holiday: (state.calendar?.holidays || []).find((h) => h.day === key) || null,
    leave: state.employees.filter((e) => leaveOn(state, e.id, key)).map((e) => ({ emp: e, leave: leaveOn(state, e.id, key) })),
    due: (state.projects || []).filter((p) => p.due === key && p.status !== 'cancelled'),
    meetings: (state.meetings || []).filter((m) => keyOf(m.at) === key),
    done: state.tasks.filter((t) => t.status === 'done' && t.doneAt && keyOf(t.doneAt) === key),
    reports: (state.reports || []).filter((r) => r.day === key),
    attendance: state.attendance?.[key] || null,
  };
}

/** The numbers behind the weekly report, for the days from..to (inclusive). */
export function weeklyStats(state, from, to) {
  const inRange = (ms) => { const k = keyOf(ms); return k >= from && k <= to; };
  const done = state.tasks.filter((t) => t.status === 'done' && t.doneAt && inRange(t.doneAt));
  const byEmp = {};
  for (const t of done) byEmp[t.empId] = (byEmp[t.empId] || 0) + 1;
  const ledger = (state.finance?.ledger || []).filter((l) => inRange(l.at));
  const sum = (type) => Math.round(ledger.filter((l) => l.type === type).reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const deals = (state.deals || []).filter((d) => d.closedAt && inRange(d.closedAt));
  const days = Object.keys(state.attendance || {}).filter((k) => k >= from && k <= to);
  let leaveDays = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) leaveDays += state.employees.filter((e) => leaveOn(state, e.id, d)).length;
  return {
    from, to,
    tasksDone: done.length,
    firstPass: done.filter((t) => (t.reviews || []).length && t.reviews[0].decision === 'approve').length,
    top: Object.entries(byEmp).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([empId, n]) => ({ empId, n })),
    income: sum('income'),
    expense: sum('expense'),
    won: deals.filter((d) => d.stage === 'won'),
    lost: deals.filter((d) => d.stage === 'lost'),
    meetings: (state.meetings || []).filter((m) => inRange(m.at)).length,
    workdays: days.length,
    presence: days.length ? Math.round(days.reduce((s, k) => s + state.attendance[k].present.length, 0) / days.length) : 0,
    leaveDays,
    projectsDue: (state.projects || []).filter((p) => p.due && p.due > to && p.due <= addDays(to, 7) && p.status === 'active'),
  };
}

export function addReport(state, { type, day, by, text }, { newId, now = Date.now() }) {
  if (!REPORT_TYPES[type]) throw new Error('نوع التقرير غير معروف');
  state.reports ||= [];
  const r = { id: newId(state, 'r'), type, day, by: by || null, at: now, text: String(text || '').slice(0, 6000) };
  state.reports.push(r);
  if (state.reports.length > KEEP_REPORTS) state.reports = state.reports.slice(-KEEP_REPORTS);
  return r;
}
export const reportOf = (state, type, day, by) => (state.reports || []).find((r) => r.type === type && r.day === day && (by === undefined || r.by === by)) || null;

/** The owner's days off besides the weekend (national holidays, agency events). */
export function setHoliday(state, day, name) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('التاريخ غير صالح');
  state.calendar ||= { workDays: [...DEFAULT_WORK_DAYS], holidays: [] };
  state.calendar.holidays ||= [];
  state.calendar.holidays = state.calendar.holidays.filter((h) => h.day !== day);
  const label = String(name || '').trim().slice(0, 60);
  if (label) state.calendar.holidays.push({ day, name: label });
  state.calendar.holidays.sort((a, b) => a.day.localeCompare(b.day));
  state.calendar.holidays = state.calendar.holidays.slice(-60);
}
