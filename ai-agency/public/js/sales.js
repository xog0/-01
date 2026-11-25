// The sales pipeline: deals with prospective or existing clients move from
// first contact to a decision. A won deal starts a project (or activates the
// proposal project it was linked to); a lost one cancels that proposal.
// Pure functions over state.deals, state.clients and state.projects.
import { PROJECT_TYPES, saveProject } from './crm.js';

export const DEAL_STAGES = {
  contact: { name: 'تواصل أول', p: 10 },
  meeting: { name: 'اجتماع وفهم الاحتياج', p: 30 },
  proposal: { name: 'عرض مقدّم', p: 60 },
  negotiation: { name: 'تفاوض', p: 80 },
  won: { name: 'فزنا بها', p: 100 },
  lost: { name: 'خسرناها', p: 0 },
};
export const OPEN_STAGES = ['contact', 'meeting', 'proposal', 'negotiation'];
const DEAL_CAP = { title: 120, note: 600, value: 10_000_000, deals: 200 };
const toCents = (n) => Math.round(n * 100) / 100;
const trimText = (x, n) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, n) : '');
export const isOpen = (d) => OPEN_STAGES.includes(d.stage);

function dealAmount(v) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n < 0 || n > DEAL_CAP.value) throw new Error('قيمة الفرصة يجب أن تكون صفراً أو أكثر');
  return toCents(n);
}

function logDeal(d, stage, note, now) {
  d.history = [...(d.history || []), { at: now, stage, note: trimText(note, 300) }].slice(-20);
  d.updatedAt = now;
}

/** Create or edit a deal. */
export function saveDeal(state, input, { newId, now = Date.now() } = {}) {
  state.deals ||= [];
  if (!state.clients?.some((c) => c.id === input.clientId)) throw new Error('اختر عميلاً للفرصة');
  const title = trimText(input.title, DEAL_CAP.title);
  if (!title) throw new Error('عنوان الفرصة مطلوب');
  const ownerId = input.ownerId || null;
  if (ownerId && !state.employees.some((e) => e.id === ownerId)) throw new Error('المسؤول عن الفرصة غير موجود');
  const fields = {
    clientId: input.clientId, title, ownerId, value: dealAmount(input.value),
    type: PROJECT_TYPES.includes(input.type) ? input.type : PROJECT_TYPES[0],
    note: trimText(input.note, DEAL_CAP.note),
  };
  if (input.id) {
    const d = state.deals.find((x) => x.id === input.id);
    if (!d) throw new Error('الفرصة غير موجودة');
    Object.assign(d, fields, { updatedAt: now });
    return d;
  }
  if (state.deals.filter(isOpen).length >= DEAL_CAP.deals) throw new Error('وصلت إلى الحد الأقصى للفرص المفتوحة');
  const stage = OPEN_STAGES.includes(input.stage) ? input.stage : 'contact';
  const d = { id: newId(state, 'd'), ...fields, stage, source: input.source === 'sales' ? 'sales' : 'owner', projectId: null, createdAt: now };
  logDeal(d, stage, input.source === 'sales' ? 'اقترحها فريق المبيعات' : 'أُضيفت الفرصة', now);
  state.deals.push(d);
  return d;
}

/**
 * Move a deal to another stage. Winning starts the project (with `leadId`
 * as its lead when it is new); losing cancels a linked proposal.
 */
export function moveDeal(state, dealId, stage, { note = '', value, leadId = null, newId, now = Date.now() } = {}) {
  const d = (state.deals || []).find((x) => x.id === dealId);
  if (!d) throw new Error('الفرصة غير موجودة');
  if (!DEAL_STAGES[stage]) throw new Error('مرحلة غير معروفة');
  if (!isOpen(d)) throw new Error('هذه الفرصة مغلقة');
  if (value !== undefined) d.value = dealAmount(value);
  let project = d.projectId ? state.projects?.find((p) => p.id === d.projectId) || null : null;
  if (stage === 'won') {
    if (!(d.value > 0)) throw new Error('حدد قيمة الفرصة قبل الفوز بها');
    project = project && project.status !== 'cancelled'
      ? saveProject(state, { ...project, fee: Math.max(d.value, project.paid || 0), status: 'active', leadId: project.leadId || leadId }, { newId, now })
      : saveProject(state, { clientId: d.clientId, name: d.title, type: d.type, fee: d.value, status: 'active', brief: d.note, leadId }, { newId, now });
    d.projectId = project.id;
  }
  if (stage === 'lost') {
    if (project?.status === 'proposal') saveProject(state, { ...project, status: 'cancelled' }, { newId, now });
    d.lostReason = trimText(note, 300);
  }
  d.stage = stage;
  if (stage === 'won' || stage === 'lost') d.closedAt = now;
  logDeal(d, stage, note, now);
  // Keep every open deal and the most recent closed ones.
  const closed = state.deals.filter((x) => !isOpen(x));
  if (closed.length > DEAL_CAP.deals) {
    const drop = new Set(closed.sort((a, b) => (a.closedAt || 0) - (b.closedAt || 0)).slice(0, closed.length - DEAL_CAP.deals));
    state.deals = state.deals.filter((x) => !drop.has(x));
  }
  return { deal: d, project };
}

/** Link the proposal project written for a deal; the deal moves to the proposal stage. */
export function linkProposal(state, dealId, projectId, { now = Date.now() } = {}) {
  const d = (state.deals || []).find((x) => x.id === dealId);
  if (!d || !isOpen(d)) throw new Error('الفرصة غير موجودة أو مغلقة');
  d.projectId = projectId;
  if (OPEN_STAGES.indexOf(d.stage) < OPEN_STAGES.indexOf('proposal')) {
    d.stage = 'proposal';
    logDeal(d, 'proposal', 'كُتب العرض', now);
  }
  return d;
}

/** When the owner records the client's answer on a proposal project, close its deal to match. */
export function syncDealWithProject(state, project, { now = Date.now() } = {}) {
  const d = (state.deals || []).find((x) => x.projectId === project.id && isOpen(x));
  if (!d) return null;
  if (project.status === 'active') {
    d.stage = 'won';
    d.value = project.fee;
    d.closedAt = now;
    logDeal(d, 'won', 'قبِل العميل العرض', now);
  } else if (project.status === 'cancelled') {
    d.stage = 'lost';
    d.lostReason = 'رفض العميل العرض';
    d.closedAt = now;
    logDeal(d, 'lost', d.lostReason, now);
  }
  return d;
}

export function pipelineStats(state) {
  const deals = state.deals || [];
  const open = deals.filter(isOpen);
  const won = deals.filter((d) => d.stage === 'won');
  const lost = deals.filter((d) => d.stage === 'lost');
  const sum = (list) => toCents(list.reduce((s, d) => s + (d.value || 0), 0));
  return {
    open: open.length,
    value: sum(open),
    weighted: toCents(open.reduce((s, d) => s + (d.value || 0) * DEAL_STAGES[d.stage].p / 100, 0)),
    won: won.length,
    wonValue: sum(won),
    lost: lost.length,
    winRate: won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : null,
  };
}

// ---- what the AI sends back -------------------------------------------------
/** The sales head's suggested prospects: up to 3, sanitised, none already a client. */
export function parseLeads(reply, { taken = [] } = {}) {
  try {
    const v = JSON.parse(reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1));
    const seen = new Set(taken);
    const leads = (Array.isArray(v.leads) ? v.leads : []).map((l) => ({
      name: trimText(typeof l?.name === 'string' ? l.name.replace(/<[^>]*>/g, '') : '', 80),
      industry: trimText(l?.industry, 80),
      city: trimText(l?.city, 80),
      contact: trimText(l?.contact, 80),
      notes: trimText(l?.notes, 400),
      need: trimText(l?.need, 300),
      type: PROJECT_TYPES.includes(l?.type) ? l.type : PROJECT_TYPES[0],
      value: Number.isFinite(Number(l?.value)) ? Math.min(DEAL_CAP.value, Math.max(0, Math.round(Number(l.value)))) : 0,
    })).filter((l) => l.name.length >= 2 && !seen.has(l.name) && seen.add(l.name)).slice(0, 3);
    return leads.length ? { leads, note: trimText(v.note, 400) } : null;
  } catch {
    return null;
  }
}

const SAMPLE_LEADS = [
  { name: 'نادي قوة للياقة', industry: 'أندية رياضية', city: 'الرياض', contact: 'م. فهد (المدير العام)', type: 'حملة إعلانية', value: 30000,
    notes: 'ثلاثة أندية رياضية للرجال والنساء، يريد زيادة الاشتراكات السنوية قبل الصيف.', need: 'حملة اشتراكات بإعلانات ممولة ومحتوى تحفيزي.' },
  { name: 'مخبز السنبلة', industry: 'مخابز وحلويات', city: 'الخبر', contact: 'أم سعود (المالكة)', type: 'إدارة التواصل الاجتماعي', value: 15000,
    notes: 'مخبز منزلي تحوّل إلى محلين، طلباته عبر واتساب وإنستغرام.', need: 'إدارة حساباته وتصوير منتجاته وتنظيم الطلبات.' },
  { name: 'منصة درّب للتعليم', industry: 'تعليم إلكتروني', city: 'جدة', contact: 'ريان (مؤسس المنصة)', type: 'إطلاق منتج', value: 55000,
    notes: 'منصة دورات مهنية قصيرة تطلق تطبيقها على الجوال الشهر القادم.', need: 'خطة إطلاق التطبيق وحملة تنزيلات.' },
  { name: 'عيادات نبض للعلاج الطبيعي', industry: 'رعاية صحية', city: 'المدينة المنورة', contact: 'د. سامر (المدير الطبي)', type: 'تحسين محركات البحث', value: 22000,
    notes: 'عيادتان للعلاج الطبيعي، أغلب مرضاهم من الإحالات ويريدون حجوزات مباشرة.', need: 'ظهور محلي في جوجل وخرائطه وحملة بحث.' },
  { name: 'دار الياسمين للأزياء', industry: 'أزياء نسائية', city: 'الرياض', contact: 'لين (مديرة العلامة)', type: 'هوية بصرية', value: 40000,
    notes: 'علامة عبايات فاخرة تريد التوسع لمتجر إلكتروني.', need: 'تحديث الهوية البصرية وحملة إطلاق المتجر.' },
];
/** A fallback shortlist of prospects when the AI is unavailable. */
export function sampleLeads({ taken = [], seed = 0 } = {}) {
  const used = new Set(taken);
  const out = [];
  for (let i = 0; i < SAMPLE_LEADS.length && out.length < 3; i++) {
    const l = SAMPLE_LEADS[(seed + i) % SAMPLE_LEADS.length];
    if (!used.has(l.name)) out.push({ ...l });
  }
  return { leads: out, note: '' };
}

/** A prospect's answer to the agency's proposal. */
export function parseDealReview(reply) {
  try {
    const v = JSON.parse(reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1));
    const decision = ['accept', 'negotiate', 'reject'].includes(v.decision) ? v.decision : null;
    if (!decision) return null;
    const value = Number(v.value);
    return {
      decision,
      value: decision === 'negotiate' && Number.isFinite(value) && value > 0 ? Math.min(DEAL_CAP.value, Math.round(value)) : null,
      feedback: trimText(v.feedback, 600),
    };
  } catch {
    return null;
  }
}
