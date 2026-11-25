import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  saveClient, saveProject, recordPayment, outstanding, projectProgress, isLate, clientTotals, receivables,
  projectContext, portfolioBrief, deleteProject, deleteClient,
} from '../public/js/crm.js';
import { createFinance, balance } from '../public/js/finance.js';
import { createInitialState, applyMigrations, newId } from '../public/js/data.js';

function agency() {
  return {
    nextId: 1,
    employees: [{ id: 'e1', name: 'سارة' }, { id: 'e2', name: 'خالد' }],
    tasks: [], clients: [], projects: [], finance: createFinance(Date.UTC(2026, 10, 1)),
  };
}

test('clients and projects are validated and saved', () => {
  const s = agency();
  assert.throws(() => saveClient(s, { name: '' }, { newId }), /مطلوب/);
  assert.throws(() => saveClient(s, { name: 'x', status: 'vip' }, { newId }), /غير معروف/);
  const c = saveClient(s, { name: 'مقهى الركن', industry: 'مقاهٍ', status: 'prospect' }, { newId });
  assert.throws(() => saveProject(s, { clientId: 'nope', name: 'x' }, { newId }), /اختر عميلاً/);
  assert.throws(() => saveProject(s, { clientId: c.id, name: 'x', fee: -1 }, { newId }), /صفراً أو أكثر/);
  assert.throws(() => saveProject(s, { clientId: c.id, name: 'x', leadId: 'ghost' }, { newId }), /غير موجود/);
  const p = saveProject(s, { clientId: c.id, name: 'هوية جديدة', type: 'هوية بصرية', fee: 20000, status: 'active',
    leadId: 'e1', team: ['e1', 'e2', 'e2', 'ghost'], due: '2026-12-01' }, { newId });
  assert.deepEqual(p.team, ['e2']); // lead, duplicates and unknown ids dropped
  assert.equal(c.status, 'active'); // a prospect with an active project becomes active
  saveProject(s, { ...p, name: 'هوية بصرية كاملة', type: 'نوع غريب' }, { newId });
  assert.equal(s.projects[0].name, 'هوية بصرية كاملة');
  assert.equal(s.projects[0].type, 'حملة إعلانية'); // unknown type falls back to the first
});

test('payments go to the ledger and cannot exceed what is owed', () => {
  const s = agency();
  const c = saveClient(s, { name: 'مقهى الركن' }, { newId });
  const p = saveProject(s, { clientId: c.id, name: 'حملة', fee: 10000, status: 'active' }, { newId });
  recordPayment(s, p.id, 4000);
  assert.equal(p.paid, 4000);
  assert.equal(outstanding(p), 6000);
  assert.equal(balance(s), 150000 + 4000);
  assert.equal(s.finance.ledger[0].category, 'دفعة عميل');
  assert.match(s.finance.ledger[0].note, /مقهى الركن — حملة/);
  assert.throws(() => recordPayment(s, p.id, 6001), /أكبر من المتبقي/);
  assert.throws(() => recordPayment(s, p.id, 0), /أكبر من صفر/);
  assert.throws(() => saveProject(s, { ...p, fee: 3000 }, { newId }), /أقل من المبلغ المحصّل/);
  assert.deepEqual(clientTotals(s, c.id), { projects: 1, fee: 10000, paid: 4000, owed: 6000 });
  assert.equal(receivables(s), 6000);
});

test('progress, lateness, context and portfolio', () => {
  const s = agency();
  const c = saveClient(s, { name: 'مقهى الركن', industry: 'مقاهٍ', city: 'جدة', notes: 'يحب البساطة' }, { newId });
  const p = saveProject(s, { clientId: c.id, name: 'حملة', brief: 'زيادة الزوار', status: 'active', leadId: 'e1', due: '2026-01-01' }, { newId });
  s.tasks.push({ id: 't1', projectId: p.id, status: 'done' }, { id: 't2', projectId: p.id, status: 'todo' }, { id: 't3', status: 'done' });
  assert.deepEqual(projectProgress(s, p), { total: 2, done: 1, pct: 50 });
  assert.ok(isLate(p, '2026-02-01'));
  assert.ok(!isLate({ ...p, status: 'done' }, '2026-02-01'));
  const ctx = projectContext(s, p.id);
  assert.match(ctx, /مقهى الركن \(مقاهٍ، جدة\)/);
  assert.match(ctx, /زيادة الزوار/);
  assert.match(ctx, /يحب البساطة/);
  assert.match(portfolioBrief(s, (id) => (id === 'e1' ? 'سارة' : id)), /مقهى الركن: حملة \(قيد التنفيذ، بقيادة سارة\)/);
  deleteProject(s, p.id);
  assert.equal(s.tasks.find((t) => t.id === 't1').projectId, undefined);
  deleteClient(s, c.id);
  assert.equal(s.clients.length, 0);
});

test('a client with projects cannot be deleted', () => {
  const s = agency();
  const c = saveClient(s, { name: 'مقهى الركن' }, { newId });
  saveProject(s, { clientId: c.id, name: 'حملة' }, { newId });
  assert.throws(() => deleteClient(s, c.id), /احذف مشاريع العميل أولاً/);
});

test('new agencies start with sample clients and projects; older ones get them once', () => {
  const s = createInitialState();
  assert.equal(s.clients.length, 4);
  assert.equal(s.projects.length, 3);
  const linked = s.tasks.filter((t) => t.projectId);
  assert.equal(linked.length, 4);
  assert.ok(linked.every((t) => s.employees.some((e) => e.id === t.empId)));
  const old = createInitialState();
  old.tasks = old.tasks.filter((t) => !t.projectId);
  delete old.clients;
  delete old.projects;
  old.migrations = old.migrations.filter((k) => k !== 'add-clients');
  assert.equal(applyMigrations(old), true);
  assert.equal(old.projects.length, 3);
  assert.equal(applyMigrations(old), false);
  // An agency that already has its own clients is left alone.
  const mine = createInitialState();
  mine.clients = [{ id: 'c1', name: 'عميلي' }];
  mine.projects = [];
  mine.migrations = mine.migrations.filter((k) => k !== 'add-clients');
  applyMigrations(mine);
  assert.equal(mine.clients.length, 1);
});

test('project profit counts team time at hourly rates, review time and expenses', async () => {
  const { projectProfit, clientProfit, recordProjectExpense } = await import('../public/js/crm.js');
  const s = agency();
  s.employees = [{ id: 'e1', name: 'سارة', salary: 16000 }, { id: 'e2', name: 'خالد', salary: 8000 }];
  const c = saveClient(s, { name: 'مقهى الركن' }, { newId });
  const p = saveProject(s, { clientId: c.id, name: 'حملة', fee: 10000, status: 'active', leadId: 'e1', team: ['e2'] }, { newId });
  // Khalid: one high task (8h at 50/h) reviewed twice by Sara (0.5h each at 100/h); one open task does not count.
  s.tasks.push({ id: 't1', projectId: p.id, empId: 'e2', status: 'done', priority: 'high', reviews: [{ by: 'e1' }, { by: 'e1' }] });
  s.tasks.push({ id: 't2', projectId: p.id, empId: 'e2', status: 'todo', priority: 'high' });
  recordProjectExpense(s, p.id, 1500, { note: 'إعلانات ممولة' });
  const r = projectProfit(s, p);
  assert.deepEqual([r.laborHours, r.labor, r.expenses, r.cost, r.profit, r.margin], [8, 500, 1500, 2000, 8000, 80]);
  assert.equal(s.finance.ledger[0].projectId, p.id);
  assert.deepEqual(clientProfit(s, c.id), { fee: 10000, cost: 2000, profit: 8000, margin: 80 });
  assert.throws(() => recordProjectExpense(s, 'nope', 10), /غير موجود/);
});

test('client reviews: approval pays a milestone, changes do not, satisfaction averages', async () => {
  const { pendingDeliveries, recordClientReview, clientSatisfaction, milestoneAmount } = await import('../public/js/crm.js');
  const s = agency();
  const c = saveClient(s, { name: 'مقهى الركن' }, { newId });
  const p = saveProject(s, { clientId: c.id, name: 'حملة', fee: 10000, status: 'active' }, { newId });
  s.tasks.push({ id: 't1', projectId: p.id, status: 'done' }, { id: 't2', projectId: p.id, status: 'done' }, { id: 't3', projectId: p.id, status: 'todo' });
  assert.deepEqual(pendingDeliveries(s, p).map((t) => t.id), ['t1', 't2']);
  const r1 = recordClientReview(s, p, { decision: 'changes', feedback: 'نبرة أدفأ', satisfaction: 3, taskIds: ['t1'] });
  assert.equal(r1.payment, null);
  assert.equal(p.paid, 0);
  assert.deepEqual(pendingDeliveries(s, p).map((t) => t.id), ['t2']);
  const r2 = recordClientReview(s, p, { decision: 'approve', feedback: 'ممتاز', satisfaction: 5, taskIds: ['t2'] });
  assert.equal(r2.payment.amount, 3000);
  assert.equal(p.paid, 3000);
  assert.equal(clientSatisfaction(s, c.id), 4);
  p.paid = 9000;
  assert.equal(milestoneAmount(p), 1000); // never more than what is still owed
  assert.equal(recordClientReview(s, p, { decision: 'approve', satisfaction: 9, taskIds: [] }).review.satisfaction, 5);
});
