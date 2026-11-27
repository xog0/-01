import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  workloadOf, rebalancePlans, applyRebalance, moraleOf, moodOf, resignationRisk, retentionOutcome,
  trainingBudget, coursesFor, enroll, completeTrainings, activeTraining, graduationCandidates, OVERLOAD_HOURS,
} from '../public/js/people.js';
import { createFinance } from '../public/js/finance.js';
import { newId } from '../public/js/data.js';

const NOW = new Date(2026, 10, 25, 10).getTime();
const DAY = 86400000;
function agency() {
  return {
    nextId: 1,
    employees: [
      { id: 'm', name: 'سارة', dept: 'strategy', level: 5, xp: 420, salary: 14000 },
      { id: 'k', name: 'خالد', dept: 'content', level: 3, xp: 190, salary: 9000, managerId: 'm' },
      { id: 'l', name: 'ليلى', dept: 'social', level: 2, xp: 120, salary: 7000, managerId: 'm' },
      { id: 'c2', name: 'ريم', dept: 'content', level: 2, xp: 100, salary: 7000, managerId: 'm' },
    ],
    tasks: [], finance: createFinance(NOW), evaluations: [], promises: [], trainings: [], leaves: [],
  };
}
const task = (id, empId, priority, extra = {}) => ({ id, empId, priority, status: 'todo', title: id, createdAt: NOW, ...extra });

test('workload is open work in hours; a plan moves waiting tasks to an idle teammate', () => {
  const s = agency();
  // Khalid: 3 high (24h) + 2 low (4h) = 28h; Leila and Reem have nothing.
  s.tasks.push(task('h1', 'k', 'high'), task('h2', 'k', 'high'), task('h3', 'k', 'high', { status: 'doing' }), task('l1', 'k', 'low'), task('l2', 'k', 'low'));
  assert.deepEqual(workloadOf(s, 'k'), { tasks: 5, hours: 28 });
  const [plan] = rebalancePlans(s);
  assert.equal(plan.managerId, 'm');
  // Lowest priority first, to the lightest teammate, same department (Reem) first.
  assert.deepEqual(plan.moves.map((x) => [x.taskId, x.to]), [['l1', 'c2'], ['l2', 'l'], ['h1', 'c2']]);
  const moved = applyRebalance(s, plan);
  assert.equal(moved.length, 3);
  assert.ok(workloadOf(s, 'k').hours < OVERLOAD_HOURS);
  assert.equal(s.tasks.find((t) => t.id === 'h3').empId, 'k'); // work under way stays
  assert.deepEqual(rebalancePlans(s), []);
  // Nobody idle: no plan.
  const busy = agency();
  busy.tasks.push(task('a', 'k', 'high'), task('b', 'k', 'high'), task('c', 'k', 'high'), task('d', 'l', 'low'), task('e', 'c2', 'low'));
  assert.deepEqual(rebalancePlans(busy), []);
});

test('morale moves with workload, pay events, recognition and promotions', () => {
  const s = agency();
  const k = s.employees[1];
  assert.equal(moraleOf(s, k, { now: NOW }).score, 65); // nothing to do lately
  assert.equal(moraleOf(s, k, { now: NOW }).factors[0].label, 'بلا عمل منذ مدة');
  s.tasks.push(task('l-task', 'l', 'low'));
  for (let i = 0; i < 5; i++) s.tasks.push(task(`t${i}`, 'k', 'high'));
  s.finance.adjustments.push({ empId: 'k', type: 'cut', amount: 500, at: NOW - 5 * DAY }, { empId: 'k', type: 'deduction', amount: 100, at: NOW - 2 * DAY });
  k.salary = 7500; // now under 85% of the level's pay
  const low = moraleOf(s, k, { now: NOW });
  assert.equal(low.score, 70 - 20 - 15 - 20 - 8);
  assert.equal(low.mood.name, 'محبط');
  assert.equal(low.factors[0].label.startsWith('ضغط عمل كبير') || low.factors[0].label === 'تخفيض راتبه', true);
  assert.ok(resignationRisk(low.score) > 0);
  assert.equal(resignationRisk(60), 0);
  const l = s.employees[2];
  s.finance.adjustments.push({ empId: 'l', type: 'bonus', amount: 300, at: NOW - DAY }, { empId: 'l', type: 'raise', amount: 500, at: NOW - DAY });
  s.promises.push({ empId: 'l', status: 'open' });
  assert.equal(moraleOf(s, l, { now: NOW }).score, 70 + 6 + 10 + 6);
  assert.equal(moodOf(90).name, 'متحمس');
});

test('a retention offer works best when it answers what is wrong', () => {
  const s = agency();
  const k = s.employees[1];
  for (let i = 0; i < 6; i++) s.tasks.push(task(`t${i}`, 'k', 'high'));
  k.salary = 7500;
  s.finance.adjustments.push({ empId: 'k', type: 'cut', amount: 500, at: NOW - 5 * DAY });
  const talk = retentionOutcome(s, k, { type: 'talk' }, { now: NOW });
  assert.equal(talk.stays, false);
  const lighten = retentionOutcome(s, k, { type: 'lighten' }, { now: NOW });
  const raise = retentionOutcome(s, k, { type: 'raise', amount: 1500 }, { now: NOW });
  assert.ok(lighten.boost > talk.boost);
  assert.ok(raise.boost > lighten.boost);
  assert.equal(raise.stays, true);
});

test('training: budget, fitting courses, one at a time, completion adds experience', () => {
  const s = agency();
  s.finance.trainingBudget = 5000;
  const k = s.employees[1];
  const offered = coursesFor(s, k).map((c) => c.id);
  assert.ok(offered.includes('copy') && offered.includes('time'));
  assert.ok(!offered.includes('meta')); // another department's course
  assert.ok(!offered.includes('lead')); // leadership starts at team lead
  const t = enroll(s, { empId: 'k', courseId: 'copy' }, { newId, now: NOW });
  assert.equal(t.to, '2026-11-27');
  assert.equal(s.finance.ledger.at(-1).category, 'تدريب');
  assert.deepEqual(trainingBudget(s, '2026'), { total: 5000, spent: 2500, left: 2500 });
  assert.throws(() => enroll(s, { empId: 'k', courseId: 'time' }, { newId, now: NOW }), /في دورة الآن/);
  assert.throws(() => enroll(s, { empId: 'l', courseId: 'reels' }, { newId, now: NOW }), /لا تكفي/);
  assert.throws(() => enroll(s, { empId: 'l', courseId: 'copy' }, { newId, now: NOW }), /لا تناسب/);
  assert.deepEqual(completeTrainings(s, { now: NOW + DAY }), []); // still on the 26th
  const done = completeTrainings(s, { now: NOW + 3 * DAY });
  assert.equal(done.length, 1);
  assert.equal(k.xp, 190 + 30);
  assert.equal(activeTraining(s, 'k'), null);
  assert.ok(!coursesFor(s, k).some((c) => c.id === 'copy'));
  assert.equal(moraleOf(s, k, { now: NOW + 3 * DAY }).factors.some((f) => f.label === 'تدريب وتطوير'), true);
});

test('interns with strong scores and enough work are put forward for a real job', () => {
  const s = agency();
  s.employees.push({ id: 'i1', name: 'دانة', dept: 'hr', level: 0, xp: 30, salary: 3000 }, { id: 'i2', name: 'زياد', dept: 'marketing', level: 0, xp: 10, salary: 3000 });
  const rows = [
    { emp: s.employees[4], score: 82, m: { done: 4 } },
    { emp: s.employees[5], score: 90, m: { done: 2 } },
    { emp: s.employees[1], score: 95, m: { done: 9 } },
  ];
  assert.deepEqual(graduationCandidates(s, rows, { now: NOW }).map((r) => r.emp.id), ['i1']);
  s.employees[4].gradAck = NOW - DAY;
  assert.deepEqual(graduationCandidates(s, rows, { now: NOW }), []);
});
