import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  metricsOf, scoreOf, teamPerformance, employeeOfMonth, evaluatorOf, parseEvaluation, recordEvaluation, lastEvaluation, gradeOf,
} from '../public/js/performance.js';
import { newId } from '../public/js/data.js';

const NOW = Date.UTC(2026, 10, 25);
const day = (n) => NOW - n * 86400000;
const ok = { decision: 'approve' };
const rev = { decision: 'revise' };

function agency() {
  return {
    nextId: 1,
    employees: [
      { id: 'sara', name: 'سارة', level: 5, dept: 'strategy', managerId: null },
      { id: 'khalid', name: 'خالد', level: 3, dept: 'content', managerId: 'sara' },
      { id: 'leila', name: 'ليلى', level: 2, dept: 'social', managerId: 'sara' },
      { id: 'omar', name: 'عمر', level: 2, dept: 'ads', managerId: 'sara' },
    ],
    projects: [{ id: 'p1', due: '2026-11-20' }],
    tasks: [
      // Khalid: 3 high-priority tasks, all approved first time, rated 5, project work on time.
      { id: 'k1', empId: 'khalid', status: 'done', priority: 'high', doneAt: day(5), reviews: [ok], rating: 5, projectId: 'p1' },
      { id: 'k2', empId: 'khalid', status: 'done', priority: 'high', doneAt: day(3), reviews: [ok], rating: 5 },
      { id: 'k3', empId: 'khalid', status: 'done', priority: 'high', doneAt: day(1), reviews: [ok] },
      // Leila: 2 medium tasks, one needed a revision, project work late, rated 2.
      { id: 'l1', empId: 'leila', status: 'done', priority: 'medium', doneAt: Date.UTC(2026, 10, 22), reviews: [rev, ok], rating: 2, projectId: 'p1' },
      { id: 'l2', empId: 'leila', status: 'done', priority: 'medium', doneAt: day(2), reviews: [ok] },
      { id: 'l3', empId: 'leila', status: 'todo', priority: 'low' },
      // Omar: finished work only long ago (outside the 90-day window).
      { id: 'o1', empId: 'omar', status: 'done', priority: 'high', doneAt: day(200), reviews: [ok] },
    ],
  };
}

test('metrics come from real outcomes: first-pass approvals, priority points, deadlines and ratings', () => {
  const s = agency();
  const k = metricsOf(s, 'khalid', { now: NOW });
  assert.deepEqual([k.done, k.points, k.reviewed, k.firstPass, k.revisions, k.ratingAvg, k.projectDone, k.onTime], [3, 9, 3, 3, 0, 5, 1, 1]);
  const l = metricsOf(s, 'leila', { now: NOW });
  assert.deepEqual([l.done, l.points, l.firstPass, l.revisions, l.ratingAvg, l.onTime, l.open], [2, 4, 1, 1, 2, 0, 1]);
  assert.equal(metricsOf(s, 'omar', { now: NOW }).done, 0);
});

test('scores weigh quality, owner rating, output and punctuality, and skip parts with no data', () => {
  const s = agency();
  const k = scoreOf(metricsOf(s, 'khalid', { now: NOW }), 9);
  assert.equal(k.score, 100);
  assert.equal(k.grade.name, 'ممتاز');
  const l = scoreOf(metricsOf(s, 'leila', { now: NOW }), 9);
  // quality 50, rating 25, output 44.4, punctuality 0 → (50*35 + 25*25 + 44.4*25 + 0*15) / 100
  assert.equal(l.score, 35);
  assert.equal(l.grade.name, 'ضعيف');
  assert.deepEqual(scoreOf({ done: 0 }, 9), { score: null, grade: null, parts: {} });
  const noRatings = scoreOf({ done: 1, points: 3, reviewed: 1, firstPass: 1, ratingAvg: null, projectDone: 0 }, 3);
  assert.deepEqual(Object.keys(noRatings.parts).sort(), ['output', 'quality']);
  assert.equal(noRatings.score, 100);
  assert.equal(gradeOf(70).name, 'جيد جداً');
});

test('the team ranking and employee of the month', () => {
  const s = agency();
  const rows = teamPerformance(s, { now: NOW });
  assert.deepEqual(rows.map((r) => r.emp.id), ['khalid', 'leila', 'sara', 'omar']);
  assert.equal(employeeOfMonth(s, { now: NOW }).emp.id, 'khalid');
  s.tasks = s.tasks.filter((t) => t.id === 'k1');
  assert.equal(employeeOfMonth(s, { now: NOW }), null); // one task is not enough
});

test('evaluators, parsing and history', () => {
  const s = agency();
  assert.equal(evaluatorOf(s, s.employees[1]).id, 'sara');
  assert.equal(evaluatorOf(s, s.employees[0]), null); // reports to the owner, no HR manager
  s.employees.push({ id: 'hind', name: 'هند', level: 5, dept: 'hr', managerId: null });
  assert.equal(evaluatorOf(s, s.employees[0]).id, 'hind');
  assert.equal(parseEvaluation('ليس JSON'), null);
  const p = parseEvaluation('{"summary":"ممتاز","recommendation":"fire","reason":"x"}');
  assert.equal(p.recommendation, 'none'); // unknown recommendations are ignored
  const row = teamPerformance(s, { now: NOW }).find((r) => r.emp.id === 'khalid');
  for (let i = 0; i < 8; i++) recordEvaluation(s, { empId: 'khalid', by: 'sara', row, parsed: { ...p, summary: `#${i}` }, newId, at: NOW + i });
  assert.equal(s.evaluations.filter((x) => x.empId === 'khalid').length, 6);
  assert.equal(lastEvaluation(s, 'khalid').summary, '#7');
  assert.equal(lastEvaluation(s, 'khalid').grade, 'ممتاز');
});
