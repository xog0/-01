import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEAL_STAGES, linkProposal, moveDeal, parseDealReview, parseLeads, pipelineStats, sampleLeads, saveDeal, syncDealWithProject,
} from '../public/js/sales.js';
import { saveClient, saveProject } from '../public/js/crm.js';
import { createInitialState, applyMigrations, newId } from '../public/js/data.js';

function agency() {
  const s = { nextId: 1, employees: [{ id: 'e1', name: 'مازن', dept: 'sales' }, { id: 'e2', name: 'سارة', dept: 'strategy' }], tasks: [], clients: [], projects: [], deals: [] };
  const c = saveClient(s, { name: 'نادي قوة', status: 'prospect' }, { newId });
  return { s, c };
}

test('deals are validated and saved', () => {
  const { s, c } = agency();
  assert.throws(() => saveDeal(s, { clientId: 'x', title: 'حملة' }, { newId }), /اختر عميلاً/);
  assert.throws(() => saveDeal(s, { clientId: c.id, title: ' ' }, { newId }), /مطلوب/);
  assert.throws(() => saveDeal(s, { clientId: c.id, title: 'حملة', value: -5 }, { newId }), /صفراً أو أكثر/);
  assert.throws(() => saveDeal(s, { clientId: c.id, title: 'حملة', ownerId: 'ghost' }, { newId }), /غير موجود/);
  const d = saveDeal(s, { clientId: c.id, title: 'حملة الاشتراكات', value: 30000, ownerId: 'e1', type: 'نوع غريب', stage: 'won' }, { newId });
  assert.equal(d.stage, 'contact'); // a new deal can only start open
  assert.equal(d.type, 'حملة إعلانية');
  saveDeal(s, { ...d, value: 32000 }, { newId });
  assert.equal(s.deals[0].value, 32000);
  assert.equal(s.deals.length, 1);
});

test('winning starts a project; losing cancels the linked proposal', () => {
  const { s, c } = agency();
  const d = saveDeal(s, { clientId: c.id, title: 'حملة الاشتراكات', value: 0, ownerId: 'e1' }, { newId });
  moveDeal(s, d.id, 'meeting', { newId, note: 'اجتمعنا' });
  assert.throws(() => moveDeal(s, d.id, 'won', { newId }), /حدد قيمة/);
  const { project } = moveDeal(s, d.id, 'won', { newId, value: 30000, leadId: 'e2' });
  assert.equal(project.status, 'active');
  assert.equal(project.fee, 30000);
  assert.equal(project.leadId, 'e2');
  assert.equal(c.status, 'active'); // the prospect became a client
  assert.deepEqual(d.history.map((x) => x.stage), ['contact', 'meeting', 'won']);
  assert.throws(() => moveDeal(s, d.id, 'lost', { newId }), /مغلقة/);
  // A deal with a written proposal: losing it cancels the proposal project.
  const d2 = saveDeal(s, { clientId: c.id, title: 'تطبيق النادي', value: 50000 }, { newId });
  const p2 = saveProject(s, { clientId: c.id, name: 'عرض تطبيق النادي', fee: 50000, status: 'proposal' }, { newId });
  linkProposal(s, d2.id, p2.id);
  assert.equal(d2.stage, 'proposal');
  moveDeal(s, d2.id, 'lost', { newId, note: 'السعر مرتفع' });
  assert.equal(p2.status, 'cancelled');
  assert.equal(d2.lostReason, 'السعر مرتفع');
  // Winning a deal with a live proposal activates that project instead of adding one.
  const d3 = saveDeal(s, { clientId: c.id, title: 'هوية', value: 20000 }, { newId });
  const p3 = saveProject(s, { clientId: c.id, name: 'عرض الهوية', fee: 18000, status: 'proposal' }, { newId });
  linkProposal(s, d3.id, p3.id);
  const before = s.projects.length;
  moveDeal(s, d3.id, 'won', { newId });
  assert.equal(s.projects.length, before);
  assert.equal(p3.status, 'active');
  assert.equal(p3.fee, 20000);
  const c2 = saveClient(s, { name: 'مخبز', status: 'prospect' }, { newId });
  const d4 = saveDeal(s, { clientId: c2.id, title: 'إدارة الحسابات', value: 9000 }, { newId });
  const p4 = saveProject(s, { clientId: c2.id, name: 'عرض الحسابات', fee: 9000, status: 'proposal' }, { newId });
  linkProposal(s, d4.id, p4.id);
  assert.equal(c2.status, 'prospect');
  moveDeal(s, d4.id, 'won', { newId });
  assert.equal(c2.status, 'active'); // activating an existing proposal also makes the client active
  assert.deepEqual(pipelineStats(s), { open: 0, value: 0, weighted: 0, won: 3, wonValue: 59000, lost: 1, winRate: 75 });
});

test('recording the client answer on a proposal closes its deal', () => {
  const { s, c } = agency();
  const d = saveDeal(s, { clientId: c.id, title: 'حملة', value: 10000 }, { newId });
  const p = saveProject(s, { clientId: c.id, name: 'عرض حملة', fee: 12000, status: 'proposal' }, { newId });
  linkProposal(s, d.id, p.id);
  saveProject(s, { ...p, status: 'active' }, { newId });
  syncDealWithProject(s, p);
  assert.equal(d.stage, 'won');
  assert.equal(d.value, 12000);
  const open = saveDeal(s, { clientId: c.id, title: 'ثانية', value: 8000 }, { newId });
  moveDeal(s, open.id, 'negotiation', { newId });
  const st = pipelineStats(s);
  assert.equal(st.open, 1);
  assert.equal(st.weighted, 8000 * DEAL_STAGES.negotiation.p / 100);
});

test('AI answers are sanitised; a fallback list of prospects exists', () => {
  const leads = parseLeads(`اقتراحاتي: ${JSON.stringify({ note: 'أبدأ بالنادي', leads: [
    { name: 'نادي <i>قوة</i>', industry: 'رياضة', value: 99999999999, type: 'حملة إعلانية' },
    { name: 'مخبز السنبلة', value: 'كثير' },
    { name: 'مطعم بيت الزعتر', value: 1000 },
  ] })}`, { taken: ['مطعم بيت الزعتر'] });
  assert.deepEqual(leads.leads.map((l) => l.name), ['نادي قوة', 'مخبز السنبلة']);
  assert.equal(leads.leads[0].value, 10_000_000);
  assert.equal(leads.leads[1].value, 0);
  assert.equal(parseLeads('لا شيء'), null);
  const f = sampleLeads({ taken: ['نادي قوة للياقة'] });
  assert.equal(f.leads.length, 3);
  assert.ok(!f.leads.some((l) => l.name === 'نادي قوة للياقة'));
  assert.deepEqual(parseDealReview('{"decision":"negotiate","value":"25000","feedback":"خفّضوا قليلاً"}'), { decision: 'negotiate', value: 25000, feedback: 'خفّضوا قليلاً' });
  assert.deepEqual(parseDealReview('{"decision":"accept","value":1}'), { decision: 'accept', value: null, feedback: '' });
  assert.equal(parseDealReview('{"decision":"maybe"}'), null);
});

test('new and older agencies get deals for their prospects once', () => {
  const s = createInitialState();
  const durub = s.clients.find((c) => c.name.startsWith('دروب'));
  const ibt = s.clients.find((c) => c.name.startsWith('عيادات'));
  const dd = s.deals.find((d) => d.clientId === durub.id);
  const di = s.deals.find((d) => d.clientId === ibt.id);
  assert.equal(dd.stage, 'meeting');
  assert.equal(di.stage, 'proposal');
  assert.equal(s.projects.find((p) => p.id === di.projectId).status, 'proposal');
  const old = createInitialState();
  delete old.deals;
  old.migrations = old.migrations.filter((k) => k !== 'add-deals');
  assert.equal(applyMigrations(old), true);
  assert.equal(old.deals.length, 2);
  assert.equal(applyMigrations(old), false);
});
