// Clients and projects: who the agency works for, what it has sold them,
// who leads each project, how far the work has come, and how much has been
// collected. Pure functions over state.clients, state.projects, state.tasks
// and state.finance, so they can be tested without a browser.
import { addLedger } from './finance.js';

export const CLIENT_STATUS = { active: 'نشط', prospect: 'محتمل', past: 'سابق' };
export const PROJECT_STATUS = { proposal: 'عرض سعر', active: 'قيد التنفيذ', done: 'مكتمل', cancelled: 'ملغى' };
export const PROJECT_TYPES = [
  'حملة إعلانية', 'إدارة التواصل الاجتماعي', 'صناعة محتوى', 'تحسين محركات البحث', 'هوية بصرية',
  'إطلاق منتج', 'علاقات عامة', 'تسويق بالبريد', 'استراتيجية تسويق',
];
const CRM_CAP = { name: 80, field: 80, notes: 600, brief: 1500, fee: 10_000_000, clients: 100, projects: 150 };

function cleanText(value, max, what, { required = false } = {}) {
  const v = String(value ?? '').trim();
  if (required && !v) throw new Error(`${what} مطلوب`);
  if (v.length > max) throw new Error(`${what} أطول من المسموح`);
  return v;
}
function cleanAmount(value, what) {
  const v = Number(value);
  if (!Number.isFinite(v) || v < 0) throw new Error(`${what} يجب أن يكون رقماً صفراً أو أكثر`);
  if (v > CRM_CAP.fee) throw new Error(`${what} أكبر من المسموح`);
  return Math.round(v * 100) / 100;
}
function oneOf(map, value, what) {
  if (!Object.hasOwn(map, value)) throw new Error(`${what} غير معروف`);
  return value;
}

/** Creates a client, or updates it when `id` is given. */
export function saveClient(state, input, { newId, now = Date.now() } = {}) {
  const fields = {
    name: cleanText(input.name, CRM_CAP.name, 'اسم العميل', { required: true }),
    industry: cleanText(input.industry, CRM_CAP.field, 'القطاع'),
    contact: cleanText(input.contact, CRM_CAP.field, 'جهة التواصل'),
    city: cleanText(input.city, CRM_CAP.field, 'المدينة'),
    status: oneOf(CLIENT_STATUS, input.status || 'active', 'حالة العميل'),
    notes: cleanText(input.notes, CRM_CAP.notes, 'الملاحظات'),
  };
  state.clients ||= [];
  if (input.id) {
    const c = state.clients.find((x) => x.id === input.id);
    if (!c) throw new Error('العميل غير موجود');
    return Object.assign(c, fields);
  }
  if (state.clients.length >= CRM_CAP.clients) throw new Error('وصلت إلى الحد الأقصى لعدد العملاء');
  const c = { id: newId(state, 'c'), ...fields, since: now };
  state.clients.push(c);
  return c;
}

/** Creates a project, or updates it when `id` is given. */
export function saveProject(state, input, { newId, now = Date.now() } = {}) {
  const ids = new Set(state.employees.map((e) => e.id));
  if (!state.clients?.some((c) => c.id === input.clientId)) throw new Error('اختر عميلاً للمشروع');
  if (input.leadId && !ids.has(input.leadId)) throw new Error('قائد المشروع غير موجود');
  const fields = {
    clientId: input.clientId,
    name: cleanText(input.name, CRM_CAP.name, 'اسم المشروع', { required: true }),
    type: PROJECT_TYPES.includes(input.type) ? input.type : PROJECT_TYPES[0],
    brief: cleanText(input.brief, CRM_CAP.brief, 'موجز المشروع'),
    fee: cleanAmount(input.fee ?? 0, 'قيمة المشروع'),
    status: oneOf(PROJECT_STATUS, input.status || 'proposal', 'حالة المشروع'),
    leadId: input.leadId || null,
    team: [...new Set((input.team || []).filter((id) => ids.has(id) && id !== input.leadId))],
    due: /^\d{4}-\d{2}-\d{2}$/.test(input.due || '') ? input.due : '',
  };
  state.projects ||= [];
  if (input.id) {
    const p = state.projects.find((x) => x.id === input.id);
    if (!p) throw new Error('المشروع غير موجود');
    if (fields.fee < (p.paid || 0)) throw new Error('قيمة المشروع أقل من المبلغ المحصّل منه');
    if (fields.status === 'done' && p.status !== 'done') p.doneAt = now;
    return Object.assign(p, fields);
  }
  if (state.projects.length >= CRM_CAP.projects) throw new Error('وصلت إلى الحد الأقصى لعدد المشاريع');
  const p = { id: newId(state, 'p'), ...fields, paid: 0, createdAt: now };
  state.projects.push(p);
  const client = state.clients.find((c) => c.id === p.clientId);
  if (client && client.status === 'prospect' && p.status === 'active') client.status = 'active';
  return p;
}

export const outstanding = (p) => Math.max(0, Math.round(((p.fee || 0) - (p.paid || 0)) * 100) / 100);

/** A client payment against a project: income in the ledger, less owed on the project. */
export function recordPayment(state, projectId, amount, { at = Date.now(), note = '' } = {}) {
  const p = state.projects.find((x) => x.id === projectId);
  if (!p) throw new Error('المشروع غير موجود');
  const v = Number(amount);
  if (!Number.isFinite(v) || v <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
  if (v > outstanding(p)) throw new Error(`المبلغ أكبر من المتبقي على المشروع (${outstanding(p)})`);
  const client = state.clients.find((c) => c.id === p.clientId);
  const entry = addLedger(state, {
    type: 'income', category: 'دفعة عميل', amount: v, at,
    note: `${client?.name || 'عميل'} — ${p.name}${note ? ` — ${note}` : ''}`,
  });
  p.paid = Math.round(((p.paid || 0) + v) * 100) / 100;
  return entry;
}

export function projectProgress(state, p) {
  const tasks = state.tasks.filter((t) => t.projectId === p.id);
  const done = tasks.filter((t) => t.status === 'done').length;
  return { total: tasks.length, done, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
}

export function isLate(p, today = new Date().toISOString().slice(0, 10)) {
  return Boolean(p.due) && p.status === 'active' && p.due < today;
}

export function clientTotals(state, clientId) {
  const ps = (state.projects || []).filter((p) => p.clientId === clientId && p.status !== 'cancelled');
  const sum = (f) => Math.round(ps.reduce((s, p) => s + f(p), 0) * 100) / 100;
  return { projects: ps.length, fee: sum((p) => p.fee || 0), paid: sum((p) => p.paid || 0), owed: sum(outstanding) };
}

export function receivables(state) {
  return Math.round((state.projects || []).filter((p) => p.status !== 'cancelled').reduce((s, p) => s + outstanding(p), 0) * 100) / 100;
}

/** Context for the AI: the client and project a task belongs to. */
export function projectContext(state, projectId) {
  const p = state.projects?.find((x) => x.id === projectId);
  if (!p) return '';
  const c = state.clients.find((x) => x.id === p.clientId);
  return [
    `العميل: ${c?.name || '—'}${c?.industry ? ` (${c.industry}${c.city ? `، ${c.city}` : ''})` : ''}.`,
    `المشروع: ${p.name} — ${p.type}.`,
    p.brief ? `موجز المشروع: ${p.brief}` : '',
    c?.notes ? `ملاحظات عن العميل: ${c.notes}` : '',
  ].filter(Boolean).join('\n');
}

/** One line per live project, for everyone's picture of the agency. */
export function portfolioBrief(state, nameOf = (id) => id) {
  const live = (state.projects || []).filter((p) => p.status === 'active' || p.status === 'proposal');
  if (!live.length) return '';
  return live.map((p) => {
    const c = state.clients.find((x) => x.id === p.clientId);
    return `${c?.name || '—'}: ${p.name} (${PROJECT_STATUS[p.status]}${p.leadId ? `، بقيادة ${nameOf(p.leadId)}` : ''})`;
  }).join('؛ ').slice(0, 1150);
}

/** Removes a project; its tasks stay but lose the link. Payments stay in the ledger. */
export function deleteProject(state, projectId) {
  state.projects = state.projects.filter((p) => p.id !== projectId);
  for (const t of state.tasks) if (t.projectId === projectId) delete t.projectId;
}

/** Removes a client that has no projects left. */
export function deleteClient(state, clientId) {
  if (state.projects?.some((p) => p.clientId === clientId)) throw new Error('احذف مشاريع العميل أولاً أو غيّر حالته إلى سابق');
  state.clients = state.clients.filter((c) => c.id !== clientId);
}
