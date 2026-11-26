// People matters beyond pay: leave, daily attendance, and hiring rounds
// where the HR manager proposes candidates the owner interviews.
// Pure functions over the agency state, so they can be unit-tested.
import { addAdjustment } from './finance.js';

export const LEAVE_TYPES = {
  annual: { name: 'سنوية', quota: 21, paid: true },
  sick: { name: 'مرضية', quota: 30, paid: true },
  emergency: { name: 'اضطرارية', quota: 5, paid: true },
  unpaid: { name: 'بدون راتب', quota: null, paid: false },
};
export const MAX_LEAVE_DAYS = 30;
const KEEP_LEAVES = 200;
const KEEP_ATTENDANCE_DAYS = 90;

const pad = (n) => String(n).padStart(2, '0');
/** The owner's calendar day (local time) as YYYY-MM-DD. */
export const dayKey = (ms = Date.now()) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export function validDay(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const d = new Date(`${key}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === key;
}
export function addDays(key, n) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const daysBetween = (from, to) => Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000);
export const daysWord = (n) => (n === 1 ? 'يوم واحد' : n === 2 ? 'يومان' : n <= 10 ? `${n} أيام` : `${n} يوماً`);

// ---- leave ------------------------------------------------------------------
/** The leave someone is on that day, or null. */
export function leaveOn(state, empId, day = dayKey()) {
  return (state.leaves || []).find((l) => l.empId === empId && l.from <= day && day <= l.to) || null;
}
/** Leave that has not ended yet (current or upcoming), soonest first. */
export function upcomingLeaves(state, day = dayKey()) {
  return (state.leaves || []).filter((l) => l.to >= day).sort((a, b) => a.from.localeCompare(b.from));
}

function daysInYear(l, year) {
  let n = 0;
  for (let d = l.from; d <= l.to; d = addDays(d, 1)) if (d.startsWith(year)) n++;
  return n;
}
export function leaveBalance(state, empId, type, year = dayKey().slice(0, 4)) {
  const used = (state.leaves || []).filter((l) => l.empId === empId && l.type === type).reduce((s, l) => s + daysInYear(l, String(year)), 0);
  const quota = LEAVE_TYPES[type]?.quota ?? null;
  return { used, quota, left: quota === null ? null : Math.max(0, quota - used) };
}

const unpaidAmount = (e, days) => Math.round((e.salary / 30) * days * 100) / 100;

/**
 * The owner grants leave. Unpaid leave books a deduction of a day's pay
 * (salary / 30) per day in the open payroll month.
 */
export function grantLeave(state, { empId, type, from, days, reason = '' }, { newId, by = 'owner', now = Date.now() } = {}) {
  const e = state.employees.find((x) => x.id === empId);
  if (!e) throw new Error('الموظف غير موجود');
  const kind = LEAVE_TYPES[type];
  if (!kind) throw new Error('نوع الإجازة غير معروف');
  const n = Number(days);
  if (!Number.isInteger(n) || n < 1 || n > MAX_LEAVE_DAYS) throw new Error(`عدد الأيام يجب أن يكون من 1 إلى ${MAX_LEAVE_DAYS}`);
  if (!validDay(from)) throw new Error('تاريخ البداية غير صالح');
  const today = dayKey(now);
  if (from < today) throw new Error('لا يمكن أن تبدأ الإجازة في يوم مضى');
  if (daysBetween(today, from) > 365) throw new Error('الإجازة أبعد من سنة');
  const to = addDays(from, n - 1);
  const clash = (state.leaves || []).find((l) => l.empId === empId && l.from <= to && from <= l.to);
  if (clash) throw new Error(`لدى ${e.name} إجازة ${LEAVE_TYPES[clash.type].name} من ${clash.from} إلى ${clash.to}`);
  if (kind.quota !== null) {
    const candidate = { from, to };
    for (const year of new Set([from.slice(0, 4), to.slice(0, 4)])) {
      const { used } = leaveBalance(state, empId, type, year);
      const need = daysInYear(candidate, year);
      if (used + need > kind.quota) throw new Error(`رصيد الإجازة ال${kind.name} لـ${e.name} في ${year} لا يكفي: المتبقي ${daysWord(Math.max(0, kind.quota - used))}`);
    }
  }
  const leave = {
    id: newId(state, 'lv'), empId, type, from, to, days: n,
    reason: String(reason).trim().slice(0, 200), by, at: now,
  };
  if (!kind.paid) {
    const adj = addAdjustment(state, { empId, type: 'deduction', amount: unpaidAmount(e, n), reason: `إجازة بدون راتب (${daysWord(n)})`, by, at: now });
    leave.adjustmentId = adj.id;
  }
  state.leaves ||= [];
  state.leaves.push(leave);
  if (state.leaves.length > KEEP_LEAVES) state.leaves = state.leaves.slice(-KEEP_LEAVES);
  return leave;
}

/**
 * Bring someone back early: leave that has not started is cancelled, leave
 * under way ends yesterday. An unpaid leave's open deduction shrinks to match.
 */
export function endLeave(state, leaveId, { now = Date.now() } = {}) {
  const leave = (state.leaves || []).find((l) => l.id === leaveId);
  if (!leave) throw new Error('الإجازة غير موجودة');
  const today = dayKey(now);
  if (leave.to < today) throw new Error('انتهت هذه الإجازة بالفعل');
  const adj = leave.adjustmentId && state.finance?.adjustments.find((a) => a.id === leave.adjustmentId && !a.paid);
  if (leave.from >= today) {
    state.leaves = state.leaves.filter((l) => l !== leave);
    if (adj) state.finance.adjustments = state.finance.adjustments.filter((a) => a !== adj);
    return { cancelled: true, leave };
  }
  leave.to = addDays(today, -1);
  leave.days = daysBetween(leave.from, leave.to) + 1;
  if (adj) {
    const e = state.employees.find((x) => x.id === leave.empId);
    adj.amount = unpaidAmount(e, leave.days);
    adj.reason = `إجازة بدون راتب (${daysWord(leave.days)})`;
  }
  return { cancelled: false, leave };
}

// ---- attendance -------------------------------------------------------------
/** Records who worked on a day (merged with earlier workdays that day). */
export function markAttendance(state, day, presentIds) {
  state.attendance ||= {};
  const prev = state.attendance[day] || { present: [], leave: [] };
  const present = [...new Set([...prev.present, ...presentIds])];
  const leave = state.employees.filter((e) => leaveOn(state, e.id, day)).map((e) => e.id);
  state.attendance[day] = { present: present.filter((id) => !leave.includes(id)), leave };
  const keys = Object.keys(state.attendance).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_ATTENDANCE_DAYS))) delete state.attendance[k];
  return state.attendance[day];
}

/** Workdays since hire within the last `days` days: present, on leave, absent. */
export function attendanceOf(state, empId, { days = 30, now = Date.now() } = {}) {
  const e = state.employees.find((x) => x.id === empId);
  const since = addDays(dayKey(now), -(days - 1));
  const hired = e?.hiredAt ? dayKey(e.hiredAt) : '';
  const keys = Object.keys(state.attendance || {}).filter((k) => k >= since && k >= hired && k <= dayKey(now));
  const present = keys.filter((k) => state.attendance[k].present.includes(empId)).length;
  const leave = keys.filter((k) => state.attendance[k].leave.includes(empId)).length;
  return { workdays: keys.length, present, leave, absent: keys.length - present - leave };
}

// ---- hiring rounds ----------------------------------------------------------
const clip = (x, n) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, n) : '');
const int = (x, lo, hi, fallback) => (Number.isFinite(Number(x)) ? Math.min(hi, Math.max(lo, Math.round(Number(x)))) : fallback);
export const salaryRange = (base) => [Math.round(base * 0.8), Math.round(base * 1.4)];

function cleanCandidate(c, { base, years }) {
  const name = clip(typeof c?.name === 'string' ? c.name.replace(/<[^>]*>/g, '') : '', 40).replace(/[<>[\]{}|]/g, '').trim();
  if (name.length < 2) return null;
  const gender = ['f', 'أنثى', 'female', 'انثى'].includes(String(c.gender).trim().toLowerCase()) ? 'f' : 'm';
  const age = int(c.age, 20, 64, 22 + years);
  const [lo, hi] = salaryRange(base);
  return {
    name, gender, age,
    years: Math.min(int(c.years, 0, 40, years), age - 18),
    background: clip(c.background, 300),
    style: clip(c.style, 200),
    strengths: clip(c.strengths, 200),
    weakness: clip(c.weakness, 200),
    personality: clip(c.personality, 300),
    salary: int(c.salary, lo, hi, base),
  };
}

/** The HR manager's shortlist: up to 3 distinct, sanitised candidates, none named like current staff. */
export function parseCandidates(reply, { base, years = 3, taken = [] }) {
  try {
    const v = JSON.parse(reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1));
    const seen = new Set(taken);
    const list = (Array.isArray(v.candidates) ? v.candidates : []).map((c) => cleanCandidate(c, { base, years }))
      .filter((c) => c && !seen.has(c.name) && seen.add(c.name)).slice(0, 3);
    return list.length ? { candidates: list, note: clip(v.note, 400) } : null;
  } catch {
    return null;
  }
}

const MEN = ['يوسف', 'عبدالله', 'فيصل', 'ماجد', 'طارق', 'سلمان', 'بندر', 'هشام', 'زياد', 'نواف'];
const WOMEN = ['ريم', 'هيا', 'دانة', 'لمى', 'جود', 'رهف', 'شهد', 'أمل', 'غدير', 'منيرة'];
const FAMILIES = ['الشمري', 'القحطاني', 'العتيبي', 'الحربي', 'الزهراني', 'الغامدي', 'المطيري', 'الدوسري', 'السبيعي', 'العنزي'];
const STYLES = [
  ['هادئ ومنظم، يحب التخطيط قبل التنفيذ.', 'دقيق في التفاصيل ويلتزم بالمواعيد', 'يتردد أحياناً في اتخاذ القرار السريع'],
  ['متحمس وسريع، يطرح أفكاراً كثيرة.', 'إبداعي ومبادر', 'يحتاج إلى متابعة في إنهاء التفاصيل'],
  ['عملي ومباشر، يركز على النتائج والأرقام.', 'يقيس أثر عمله ويحسّنه', 'قليل الصبر على الاجتماعات الطويلة'],
];

/** A fallback shortlist when the AI is unavailable: plausible, varied, deterministic per seed. */
export function sampleCandidates({ deptName, years, base, taken = [], seed = 0 }) {
  const used = new Set(taken);
  const out = [];
  for (let i = 0; out.length < 3 && i < 40; i++) {
    const k = seed + i * 7;
    const gender = (k + out.length) % 2 ? 'f' : 'm';
    const first = (gender === 'f' ? WOMEN : MEN)[k % 10];
    const name = `${first} ${FAMILIES[(k * 3 + 1) % 10]}`;
    if (used.has(name) || used.has(first)) continue;
    used.add(name);
    const y = Math.max(0, years + (out.length - 1));
    const [style, strengths, weakness] = STYLES[out.length];
    out.push({
      name, gender, age: 22 + y + (k % 3), years: y,
      background: y ? `عمل ${y} ${y > 10 ? 'سنة' : 'سنوات'} في ${deptName} لدى ${['وكالة محلية', 'شركة ناشئة', 'علامة تجارية كبيرة'][out.length]}.` : `خريج حديث مهتم بـ${deptName}، أنهى تدريباً صيفياً في وكالة.`,
      style, strengths, weakness, personality: style,
      salary: Math.round(base * [0.95, 1.05, 1.15][out.length]),
    });
  }
  return { candidates: out, note: '' };
}

// ---- the HR manager's orders --------------------------------------------------
// In chat the owner can ask the HR manager to grant or end leave, evaluate
// people, or open a hiring round. She confirms and writes one line per order:
//   [[إجازة: الاسم | النوع | الأيام | من (YYYY-MM-DD أو اليوم أو غداً) | السبب]]
//   [[إنهاء إجازة: الاسم]]
//   [[تقييم: الأسماء أو الكل]]
//   [[توظيف: القسم | المستوى]]
const LEAVE_WORDS = { 'سنوية': 'annual', 'مرضية': 'sick', 'اضطرارية': 'emergency', 'طارئة': 'emergency', 'بدون راتب': 'unpaid' };
const arabicDigits = (s) => String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const matchPeople = (text, employees) => {
  const names = String(text).split(/[،,]| و/).map((x) => x.trim()).filter(Boolean);
  if (names.some((n) => /^(ال)?كل|الجميع|جميع الموظفين|الفريق/.test(n))) return employees.map((e) => e.id);
  return employees.filter((e) => names.some((n) => n === e.name || n.includes(e.name))).map((e) => e.id);
};

export function parseHrOrders(reply, employees, { today = dayKey(), departments = {}, ladder = [] } = {}) {
  const orders = [];
  const text = reply.replace(/\[\[\s*(إنهاء إجازة|إجازة|تقييم|توظيف)\s*:([^\]]*)\]\]/g, (_, kind, body) => {
    const parts = body.split('|').map((x) => x.trim());
    if (kind === 'إجازة') {
      const [who = '', typeWord = '', days = '', from = '', reason = ''] = parts;
      const empIds = matchPeople(who, employees).slice(0, 1);
      const type = Object.entries(LEAVE_WORDS).find(([w]) => typeWord.includes(w))?.[1] || 'annual';
      const n = Number.parseInt(arabicDigits(days), 10);
      const f = arabicDigits(from);
      const start = /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : /غد/.test(from) ? addDays(today, 1) : today;
      if (empIds.length && n > 0) orders.push({ kind: 'leave', empId: empIds[0], type, days: n, from: start, reason: reason.slice(0, 200) });
    } else if (kind === 'إنهاء إجازة') {
      const empIds = matchPeople(parts[0] || '', employees).slice(0, 1);
      if (empIds.length) orders.push({ kind: 'endLeave', empId: empIds[0] });
    } else if (kind === 'تقييم') {
      const empIds = matchPeople(parts[0] || '', employees);
      if (empIds.length) orders.push({ kind: 'evaluate', empIds });
    } else {
      const [deptWord = '', levelWord = ''] = parts;
      const dept = Object.entries(departments).find(([k, d]) => deptWord && (deptWord.includes(d.name) || d.name.includes(deptWord) || deptWord === k))?.[0];
      const byName = ladder.map((l, i) => [l.name, i]).sort((a, b) => b[0].length - a[0].length).find(([name]) => levelWord.includes(name));
      if (dept) orders.push({ kind: 'hire', dept, level: byName ? byName[1] : 2 });
    }
    return '';
  }).trim();
  return { text, orders };
}
