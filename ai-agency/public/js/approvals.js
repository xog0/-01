// Bonus requests and their approval chain. A manager recommends a bonus for
// someone in their team; the request then passes the HR manager, the CFO
// and the CEO (each may approve, lower the amount, or reject) and finally
// reaches the owner, whose approval is the only thing that records it in
// payroll. Pure functions over state, so they can be tested without a
// browser.
import { addAdjustment } from './finance.js';

export const ROLE_NAMES = {
  manager: 'المدير المباشر',
  hr: 'مدير الموارد البشرية',
  cfo: 'المدير المالي',
  ceo: 'المدير التنفيذي',
  owner: 'المالك',
};
export const REQUEST_STATUS = {
  in_review: 'قيد المراجعة',
  awaiting_owner: 'بانتظار موافقتك',
  approved: 'معتمدة',
  rejected: 'مرفوضة',
};
const KEEP_CLOSED = 100;
const HEAD_LEVEL = 5;

const senior = (a, b) => b.level - a.level || (b.xp || 0) - (a.xp || 0);
const headOf = (state, dept) => state.employees.filter((e) => e.dept === dept && e.level >= HEAD_LEVEL).sort(senior)[0] || null;
export const roleHolder = {
  hr: (state) => headOf(state, 'hr'),
  cfo: (state) => headOf(state, 'finance'),
  ceo: (state) => state.employees.filter((e) => e.level >= 8).sort(senior)[0] || null,
};

/**
 * Who a bonus for `empId` passes through: the recommending manager, then the
 * HR manager, CFO and CEO, then the owner. A role nobody holds, a person
 * already earlier in the chain, or the employee themselves is marked skipped
 * with the reason, so the trail stays complete and nobody approves their own bonus.
 */
export function buildChain(state, empId, recommenderId) {
  const chain = [];
  const seen = new Set();
  const push = (role, person, why) => {
    if (!person) return chain.push({ role, empId: null, decision: 'skipped', note: why || `لا يوجد ${ROLE_NAMES[role]} حالياً` });
    if (person.id === empId) return chain.push({ role, empId: person.id, decision: 'skipped', note: 'لا يراجع أحد مكافأته بنفسه' });
    if (seen.has(person.id)) return chain.push({ role, empId: person.id, decision: 'skipped', note: 'راجع الطلب في مرحلة سابقة' });
    seen.add(person.id);
    return chain.push({ role, empId: person.id, decision: null });
  };
  const recommender = state.employees.find((e) => e.id === recommenderId);
  if (!recommender) throw new Error('المدير المرشِّح غير موجود');
  if (recommender.id === empId) throw new Error('لا يمكن ترشيح النفس لمكافأة');
  seen.add(recommender.id);
  chain.push({ role: 'manager', empId: recommender.id, decision: null });
  for (const role of ['hr', 'cfo', 'ceo']) push(role, roleHolder[role](state));
  chain.push({ role: 'owner', empId: null, decision: null });
  return chain;
}

/** A manager's recommendation opens a request; their own stage is signed at once. */
export function createBonusRequest(state, { empId, recommenderId, amount, reason = '', taskId = null, newId, at = Date.now() }) {
  const e = state.employees.find((x) => x.id === empId);
  if (!e) throw new Error('الموظف غير موجود');
  const v = Number(amount);
  if (!Number.isFinite(v) || v <= 0) throw new Error('مبلغ المكافأة يجب أن يكون أكبر من صفر');
  state.bonusRequests ||= [];
  if (taskId && state.bonusRequests.some((r) => r.taskId === taskId)) throw new Error('رُشّح هذا العمل لمكافأة من قبل');
  const chain = buildChain(state, empId, recommenderId);
  const note = String(reason).trim().slice(0, 300) || 'عمل متميز';
  Object.assign(chain[0], { decision: 'approve', amount: v, note, at });
  const req = { id: newId(state, 'b'), empId, amount: v, requested: v, reason: note, taskId, createdAt: at, status: 'in_review', chain };
  state.bonusRequests.push(req);
  settleRequest(req);
  return req;
}

/** The stage waiting for a decision, or null when the request has left review. */
export function currentStage(req) {
  if (req.status !== 'in_review' && req.status !== 'awaiting_owner') return null;
  return req.chain.find((s) => s.decision === null) || null;
}

/**
 * Records one reviewer's decision. Approvals may keep or lower the amount,
 * never raise it; a rejection closes the request.
 */
export function decideStage(state, req, { decision, amount, note = '', at = Date.now() }) {
  const stage = currentStage(req);
  if (!stage) throw new Error('لا توجد مرحلة بانتظار القرار');
  if (stage.role === 'owner') throw new Error('قرار المالك يُسجَّل من صندوق الموافقات');
  const d = decision === 'reject' ? 'reject' : 'approve';
  let v = Number(amount);
  if (!Number.isFinite(v) || v <= 0 || v > req.amount) v = req.amount;
  Object.assign(stage, { decision: d, amount: d === 'approve' ? v : 0, note: String(note).trim().slice(0, 300), at });
  if (d === 'reject') {
    req.status = 'rejected';
    req.closedAt = at;
  } else {
    req.amount = v;
  }
  settleRequest(req);
  trimRequests(state);
  return stage;
}

/** Skips a stage whose reviewer has left the agency since the request was opened. */
export function skipStage(state, req, note, at = Date.now()) {
  const stage = currentStage(req);
  if (!stage || stage.role === 'owner') return;
  Object.assign(stage, { decision: 'skipped', note, at });
  settleRequest(req);
}

/** The owner's final word: approval records the bonus in this month's payroll. */
export function ownerDecision(state, req, { approve, amount, note = '', at = Date.now() }) {
  if (req.status !== 'awaiting_owner') throw new Error('الطلب ليس بانتظار موافقتك');
  const stage = req.chain.at(-1);
  if (!approve) {
    Object.assign(stage, { decision: 'reject', amount: 0, note: String(note).trim().slice(0, 300), at });
    req.status = 'rejected';
    req.closedAt = at;
    trimRequests(state);
    return null;
  }
  const v = amount === undefined || amount === '' ? req.amount : Number(amount);
  const adj = addAdjustment(state, {
    empId: req.empId, type: 'bonus', amount: v, by: 'owner', at,
    reason: `مكافأة معتمدة: ${req.reason}`.slice(0, 200),
  });
  Object.assign(stage, { decision: 'approve', amount: adj.amount, note: String(note).trim().slice(0, 300), at });
  req.amount = adj.amount;
  req.status = 'approved';
  req.closedAt = at;
  req.adjustmentId = adj.id;
  trimRequests(state);
  return adj;
}

function settleRequest(req) {
  if (req.status !== 'in_review') return;
  const next = req.chain.find((s) => s.decision === null);
  if (next?.role === 'owner') req.status = 'awaiting_owner';
}

function trimRequests(state) {
  const open = state.bonusRequests.filter((r) => r.status === 'in_review' || r.status === 'awaiting_owner');
  const closed = state.bonusRequests.filter((r) => r.status === 'approved' || r.status === 'rejected').slice(-KEEP_CLOSED);
  state.bonusRequests = [...closed, ...open].sort((a, b) => a.createdAt - b.createdAt);
}

export const pendingForOwner = (state) => (state.bonusRequests || []).filter((r) => r.status === 'awaiting_owner');
export const inReview = (state) => (state.bonusRequests || []).filter((r) => r.status === 'in_review');
