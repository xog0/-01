import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, applyMigrations, titleFor } from '../public/js/data.js';

const oldAgency = () => {
  const s = createInitialState();
  s.employees = s.employees.filter((e) => e.name !== 'حمو' && e.level > 0); // before Hamo and the interns
  const ids = new Set(s.employees.map((e) => e.id));
  s.tasks = s.tasks.filter((t) => ids.has(t.empId));
  s.employees.find((e) => e.name === 'سارة').managerId = null;
  delete s.migrations;
  return s;
};

test('a new agency starts with Hamo as CEO under the owner', () => {
  const s = createInitialState();
  const hamo = s.employees.find((e) => e.name === 'حمو');
  assert.equal(titleFor(hamo), 'المدير التنفيذي');
  assert.equal(hamo.managerId, null);
  assert.equal(s.employees.find((e) => e.name === 'سارة').managerId, hamo.id);
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

test('an older agency moves Sara under Hamo once, keeping her team under her', () => {
  const s = oldAgency();
  applyMigrations(s);
  const hamo = s.employees.find((e) => e.name === 'حمو');
  const sara = s.employees.find((e) => e.name === 'سارة');
  assert.equal(sara.managerId, hamo.id);
  assert.equal(hamo.managerId, null);
  assert.ok(s.employees.filter((e) => ['خالد', 'ليلى', 'عمر'].includes(e.name)).every((e) => e.managerId === sara.id));
  sara.managerId = null; // the owner moves her back: it sticks
  assert.equal(applyMigrations(s), false);
  assert.equal(sara.managerId, null);
});

test('an agency that already received Hamo only gets the reporting change', () => {
  const s = oldAgency();
  s.migrations = ['add-hamo-ceo', 'add-interns'];
  s.employees.push({ id: 'e130', name: 'حمو', dept: 'executive', level: 8, desk: 9, managerId: null });
  assert.equal(applyMigrations(s), true);
  assert.equal(s.employees.filter((e) => e.name === 'حمو').length, 1);
  assert.equal(s.employees.find((e) => e.name === 'سارة').managerId, 'e130');
});

test('whoever heads Marketing moves under Hamo once; their team stays with them', () => {
  const s = oldAgency();
  s.migrations = ['add-hamo-ceo', 'sara-under-hamo', 'sales-under-hamo', 'hr-under-hamo', 'add-interns'];
  s.employees.push(
    { id: 'e130', name: 'حمو', dept: 'executive', level: 8, desk: 9, managerId: null },
    { id: 'e131', name: 'ريم', dept: 'marketing', level: 5, desk: 10, managerId: 'e1' },
    { id: 'e132', name: 'جود', dept: 'marketing', level: 2, desk: 11, managerId: 'e131' },
  );
  assert.equal(applyMigrations(s), true);
  const byName = (n) => s.employees.find((e) => e.name === n);
  assert.equal(byName('ريم').managerId, 'e130');
  assert.equal(byName('جود').managerId, 'e131');
  assert.equal(byName('خالد').managerId, 'e1');
  byName('ريم').managerId = 'e1'; // moved back by the owner: it sticks
  assert.equal(applyMigrations(s), false);
  assert.equal(byName('ريم').managerId, 'e1');
});

test('whoever heads Sales moves under Hamo once, even from under a GM', () => {
  const s = oldAgency();
  s.migrations = ['add-hamo-ceo', 'sara-under-hamo', 'marketing-under-hamo', 'hr-under-hamo', 'add-interns'];
  s.employees.push(
    { id: 'e130', name: 'حمو', dept: 'executive', level: 8, desk: 9, managerId: null },
    { id: 'e133', name: 'منى', dept: 'executive', level: 7, desk: 12, managerId: 'e130' },
    { id: 'e134', name: 'سعد', dept: 'sales', level: 5, desk: 13, managerId: 'e133' },
    { id: 'e135', name: 'باسل', dept: 'sales', level: 1, desk: 14, managerId: 'e134' },
  );
  assert.equal(applyMigrations(s), true);
  const byName = (n) => s.employees.find((e) => e.name === n);
  assert.equal(byName('سعد').managerId, 'e130');
  assert.equal(byName('باسل').managerId, 'e134');
  assert.equal(byName('منى').managerId, 'e130');
  assert.equal(applyMigrations(s), false);
});

test('whoever heads HR moves under Hamo once', () => {
  const s = oldAgency();
  s.migrations = ['add-hamo-ceo', 'sara-under-hamo', 'marketing-under-hamo', 'sales-under-hamo', 'add-interns'];
  s.employees.push(
    { id: 'e130', name: 'حمو', dept: 'executive', level: 8, desk: 9, managerId: null },
    { id: 'e133', name: 'منى', dept: 'executive', level: 7, desk: 12, managerId: 'e130' },
    { id: 'e136', name: 'هند', dept: 'hr', level: 5, desk: 13, managerId: 'e133' },
  );
  assert.equal(applyMigrations(s), true);
  assert.equal(s.employees.find((e) => e.name === 'هند').managerId, 'e130');
  assert.equal(applyMigrations(s), false);
});

test('a new agency has one intern per department under its head, all on separate desks', () => {
  const s = createInitialState();
  const interns = s.employees.filter((e) => e.level === 0);
  assert.equal(interns.length, 12);
  assert.equal(new Set(interns.map((e) => e.dept)).size, 12);
  assert.equal(new Set(s.employees.map((e) => e.desk)).size, s.employees.length);
  assert.ok(s.employees.every((e) => e.desk < 25));
  const byName = (n) => s.employees.find((e) => e.name === n);
  assert.equal(byName('سلمى').managerId, byName('خالد').id);   // content -> Khalid
  assert.equal(byName('رنا').managerId, byName('سارة').id);    // strategy -> Sara
  assert.equal(byName('مازن').managerId, byName('حمو').id);    // sales has no head -> Hamo
  assert.ok(interns.every((e) => s.tasks.some((t) => t.empId === e.id && t.status === 'todo')));
  assert.equal(titleFor(byName('سلمى')), 'متدرب كتابة المحتوى');
});

test('an older agency gets interns once, reporting to the heads it hired', () => {
  const s = oldAgency();
  applyMigrations(s); // Hamo, reporting changes, then interns
  const reem = { id: 'e300', name: 'ريم', dept: 'marketing', level: 5, desk: 24, managerId: null };
  // Re-run on a copy that already had a marketing manager before the interns arrived.
  const t = oldAgency();
  t.employees.push(reem);
  applyMigrations(t);
  assert.equal(t.employees.find((e) => e.name === 'زياد').managerId, 'e300');
  assert.equal(s.employees.filter((e) => e.level === 0).length, 12);
  const n = s.employees.length;
  s.employees = s.employees.filter((e) => e.name !== 'زياد'); // let one go: not re-added
  assert.equal(applyMigrations(s), false);
  assert.equal(s.employees.length, n - 1);
});

test('interns stop at the desk limit instead of overflowing', () => {
  const s = oldAgency();
  for (let i = 0; s.employees.length < 22; i++) s.employees.push({ id: `x${i}`, name: `x${i}`, dept: 'seo', level: 2, desk: 100 });
  s.employees.forEach((e, i) => { e.desk = i; });
  applyMigrations(s);
  assert.ok(s.employees.length <= 25);
  assert.equal(new Set(s.employees.map((e) => e.desk)).size, s.employees.length);
});
