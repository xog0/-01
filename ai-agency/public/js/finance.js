// The agency's books: salaries, payroll adjustments (bonuses, deductions,
// overtime, raises, per-task bonuses), monthly payroll runs and a simple
// income/expense ledger. Pure functions over state.finance and
// state.employees, so they can be tested without a browser.

// Starting monthly salary for each rung of the career ladder (index = level).
export const LEVEL_SALARY = [3000, 5000, 7000, 9000, 11000, 14000, 18000, 24000, 35000];

export const ADJ_TYPES = {
  bonus: { name: 'مكافأة', sign: 1 },
  taskBonus: { name: 'مكافأة إنجاز', sign: 1 },
  overtime: { name: 'عمل إضافي', sign: 1 },
  deduction: { name: 'خصم', sign: -1 },
  raise: { name: 'زيادة راتب', sign: 0 }, // changes the salary itself, not this month's pay
  cut: { name: 'تخفيض راتب', sign: 0 }, // the owner's decision only (enforced below)
};

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const FIN_LIMITS = { amount: 1_000_000, hours: 200, reason: 200, keepAdjustments: 300, keepLedger: 400, keepPayrolls: 12 };

export const periodOf = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const periodLabel = (p) => {
  const [y, m] = p.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
const nextPeriod = (p) => {
  const [y, m] = p.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};
const round = (n) => Math.round(n * 100) / 100;

export function createFinance(now = Date.now()) {
  return {
    currency: 'ر.س',
    openingBalance: 150000,
    taskBonus: { low: 50, medium: 100, high: 200 },
    overtimeRate: 1.5,
    monthlyHours: 160,
    period: periodOf(now),
    nextId: 1,
    adjustments: [],
    ledger: [],
    payrolls: [],
  };
}

export const defaultSalary = (level) => LEVEL_SALARY[Math.max(0, Math.min(LEVEL_SALARY.length - 1, level))];
export const hourlyRate = (salary, fin) => salary / (fin.monthlyHours || 160);

function positive(n, max, what) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) throw new Error(`${what} يجب أن يكون رقماً أكبر من صفر`);
  if (v > max) throw new Error(`${what} أكبر من المسموح`);
  return round(v);
}

/**
 * Records one payroll adjustment for an employee in the open month.
 * overtime takes hours (paid at the hourly rate x overtimeRate); raise adds
 * to the monthly salary from now on; the rest take an amount.
 */
export function addAdjustment(state, { empId, type, amount, hours, reason = '', by = 'owner', at = Date.now() }) {
  const fin = state.finance;
  const e = state.employees.find((x) => x.id === empId);
  if (!e) throw new Error('الموظف غير موجود');
  if (!ADJ_TYPES[type]) throw new Error('نوع الحركة غير معروف');
  if (type === 'cut' && by !== 'owner') throw new Error('تخفيض الراتب صلاحية المالك وحده');
  const entry = { id: `a${fin.nextId++}`, empId, type, reason: String(reason).trim().slice(0, FIN_LIMITS.reason), by, at, period: fin.period, paid: false };
  if (type === 'overtime') {
    entry.hours = positive(hours, FIN_LIMITS.hours, 'عدد الساعات');
    entry.amount = round(entry.hours * hourlyRate(e.salary, fin) * fin.overtimeRate);
  } else {
    entry.amount = positive(amount, FIN_LIMITS.amount, 'المبلغ');
  }
  if (type === 'deduction') {
    const line = payLine(state, e);
    if (entry.amount > line.base + line.overtime + line.bonuses - line.deductions) {
      throw new Error(`الخصم أكبر من المستحق لـ${e.name} هذا الشهر`);
    }
  }
  if (type === 'raise') {
    entry.from = e.salary;
    e.salary = round(e.salary + entry.amount);
    entry.to = e.salary;
    entry.paid = true; // nothing to pay out; it is part of the salary now
  }
  if (type === 'cut') {
    if (entry.amount >= e.salary) throw new Error(`التخفيض يجب أن يكون أقل من راتب ${e.name} الحالي (${e.salary})`);
    entry.from = e.salary;
    e.salary = round(e.salary - entry.amount);
    entry.to = e.salary;
    entry.paid = true;
  }
  fin.adjustments.push(entry);
  trim(fin);
  return entry;
}

/** What one employee is owed for the open month so far. */
export function payLine(state, e) {
  const open = state.finance.adjustments.filter((a) => a.empId === e.id && !a.paid && a.period === state.finance.period);
  const sum = (types) => round(open.filter((a) => types.includes(a.type)).reduce((s, a) => s + a.amount, 0));
  const base = round(e.salary || 0);
  const overtime = sum(['overtime']);
  const bonuses = sum(['bonus', 'taskBonus']);
  const deductions = sum(['deduction']);
  return { empId: e.id, name: e.name, base, overtime, bonuses, deductions, net: Math.max(0, round(base + overtime + bonuses - deductions)) };
}

export function payrollPreview(state) {
  const lines = state.employees.map((e) => payLine(state, e));
  return { period: state.finance.period, lines, total: round(lines.reduce((s, l) => s + l.net, 0)) };
}

/** Pays the open month: books the expense, closes its adjustments, opens the next month. */
export function runPayroll(state, { by = 'owner', memo = '', at = Date.now() } = {}) {
  const fin = state.finance;
  const preview = payrollPreview(state);
  if (!preview.lines.length) throw new Error('لا يوجد موظفون');
  const record = { period: preview.period, at, by, lines: preview.lines, total: preview.total, memo: String(memo).slice(0, 3000) };
  fin.payrolls.push(record);
  addLedger(state, { type: 'expense', category: 'رواتب', amount: preview.total, note: `رواتب ${periodLabel(preview.period)}`, at, auto: true });
  for (const a of fin.adjustments) if (a.period === preview.period) a.paid = true;
  fin.period = nextPeriod(fin.period);
  trim(fin);
  return record;
}

export function addLedger(state, { type, category, amount, note = '', at = Date.now(), auto = false }) {
  const fin = state.finance;
  if (type !== 'income' && type !== 'expense') throw new Error('نوع القيد غير معروف');
  const entry = {
    id: `l${fin.nextId++}`, type, at, auto,
    category: String(category || (type === 'income' ? 'إيرادات' : 'مصروفات')).trim().slice(0, 60),
    amount: positive(amount, FIN_LIMITS.amount * 10, 'المبلغ'),
    note: String(note).trim().slice(0, FIN_LIMITS.reason),
  };
  fin.ledger.push(entry);
  trim(fin);
  return entry;
}

export function balance(state) {
  const fin = state.finance;
  return round(fin.ledger.reduce((s, l) => s + (l.type === 'income' ? l.amount : -l.amount), fin.openingBalance || 0));
}

export function monthTotals(state, period = state.finance.period) {
  const inMonth = state.finance.ledger.filter((l) => periodOf(l.at) === period);
  const total = (type) => round(inMonth.filter((l) => l.type === type).reduce((s, l) => s + l.amount, 0));
  return { income: total('income'), expense: total('expense') };
}

function trim(fin) {
  const open = fin.adjustments.filter((a) => !a.paid);
  const closed = fin.adjustments.filter((a) => a.paid).slice(-FIN_LIMITS.keepAdjustments);
  fin.adjustments = [...closed, ...open].sort((a, b) => a.at - b.at);
  fin.ledger = fin.ledger.slice(-FIN_LIMITS.keepLedger);
  fin.payrolls = fin.payrolls.slice(-FIN_LIMITS.keepPayrolls);
}

// ---- orders from the finance manager's chat replies -------------------------
const ORDER_TYPES = { 'خصم': 'deduction', 'مكافأة': 'bonus', 'مكافاة': 'bonus', 'أوفرتايم': 'overtime', 'اوفرتايم': 'overtime', 'عمل إضافي': 'overtime', 'زيادة': 'raise' };
const toNumber = (s) => Number(String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٬,\s]/g, '').replace('٫', '.'));

/**
 * Finds [[مالية: النوع | الموظف أو الكل | المبلغ أو الساعات | السبب]] lines in a
 * reply, strips them, and resolves names to employee ids. Unknown types or
 * names are dropped.
 */
export function parseFinanceOrders(reply, employees) {
  const orders = [];
  const text = reply.replace(/\[\[\s*مالية\s*:([^\]]*)\]\]/g, (_, body) => {
    const [kind = '', who = '', value = '', reason = ''] = body.split('|').map((x) => x.trim());
    const type = ORDER_TYPES[kind];
    const names = who.split(/[،,]| و/).map((x) => x.trim()).filter(Boolean);
    const all = names.some((n) => /^(ال)?كل|الجميع|الفريق/.test(n));
    const empIds = all ? employees.map((e) => e.id)
      : employees.filter((e) => names.some((n) => n === e.name || n.includes(e.name))).map((e) => e.id);
    const v = toNumber(value);
    if (type && empIds.length && Number.isFinite(v) && v > 0) orders.push({ type, empIds, value: v, reason: reason.slice(0, FIN_LIMITS.reason) });
    return '';
  }).trim();
  return { text, orders };
}

/** A compact picture of the books for the finance manager's memory. */
export function financeBrief(state, fmt = (n) => String(n)) {
  const fin = state.finance;
  const p = payrollPreview(state);
  const salaries = state.employees.map((e) => `${e.name} ${fmt(e.salary)}`).join('، ');
  const pending = fin.adjustments.filter((a) => !a.paid && a.type !== 'raise').length;
  return (`الشهر المفتوح: ${periodLabel(fin.period)}. الرصيد: ${fmt(balance(state))} ${fin.currency}. ` +
    `مسير هذا الشهر حتى الآن: ${fmt(p.total)} ${fin.currency}، وفيه ${pending} حركة (مكافآت وخصومات وساعات إضافية). ` +
    `الرواتب الأساسية: ${salaries}.`).slice(0, 1150);
}
