import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, applyMigrations, titleFor } from '../public/js/data.js';

const oldAgency = () => {
  const s = createInitialState();
  s.employees = s.employees.filter((e) => e.name !== 'حمو');
  s.tasks = s.tasks.filter((t) => t.empId !== 'e5');
  delete s.migrations;
  return s;
};

test('a new agency starts with Hamo as CEO under the owner', () => {
  const s = createInitialState();
  const hamo = s.employees.find((e) => e.name === 'حمو');
  assert.equal(titleFor(hamo), 'المدير التنفيذي');
  assert.equal(hamo.managerId, null);
  assert.equal(s.employees.find((e) => e.name === 'سارة').managerId, null);
  assert.equal(new Set(s.employees.map((e) => e.desk)).size, s.employees.length);
  assert.equal(applyMigrations(s), false);
});

test('an older agency gets Hamo once, on a free desk, with his tasks', () => {
  const s = oldAgency();
  s.employees.push({ id: 'e5', name: 'نور', desk: 4, level: 1, dept: 'seo' }); // id and desk already taken
  assert.equal(applyMigrations(s), true);
  const hamo = s.employees.find((e) => e.name === 'حمو');
  assert.notEqual(hamo.id, 'e5');
  assert.equal(s.employees.filter((e) => e.desk === hamo.desk).length, 1);
  assert.equal(s.tasks.filter((t) => t.empId === hamo.id).length, 2);
  // Letting him go sticks: the update does not run again.
  s.employees = s.employees.filter((e) => e !== hamo);
  assert.equal(applyMigrations(s), false);
  assert.ok(!s.employees.some((e) => e.name === 'حمو'));
});
