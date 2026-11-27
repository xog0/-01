import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addReport, dayEvents, isWorkDay, lastWorkDayOfWeek, monthGrid, reportOf, setHoliday, weekStart, weeklyStats,
} from '../public/js/calendar.js';
import { newId } from '../public/js/data.js';

const at = (d, h = 10) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00`).getTime(); // local time

function agency() {
  return {
    nextId: 1,
    employees: [{ id: 'e1', name: 'خالد', dept: 'content' }, { id: 'e2', name: 'ليلى', dept: 'social' }],
    tasks: [
      { id: 't1', empId: 'e1', status: 'done', doneAt: at('2026-11-23'), reviews: [{ decision: 'approve' }] },
      { id: 't2', empId: 'e1', status: 'done', doneAt: at('2026-11-24'), reviews: [{ decision: 'revise' }, { decision: 'approve' }] },
      { id: 't3', empId: 'e2', status: 'done', doneAt: at('2026-11-24') },
      { id: 't4', empId: 'e2', status: 'done', doneAt: at('2026-11-30') },
    ],
    projects: [{ id: 'p1', name: 'حملة', due: '2026-11-26', status: 'active' }, { id: 'p2', name: 'هوية', due: '2026-12-01', status: 'active' }],
    meetings: [{ topic: 'إطلاق', at: at('2026-11-24') }],
    leaves: [{ id: 'lv1', empId: 'e2', type: 'annual', from: '2026-11-25', to: '2026-11-26', days: 2 }],
    attendance: { '2026-11-23': { present: ['e1', 'e2'], leave: [] }, '2026-11-24': { present: ['e1', 'e2'], leave: [] }, '2026-11-25': { present: ['e1'], leave: ['e2'] } },
    finance: { ledger: [
      { type: 'income', amount: 5000, at: at('2026-11-24') }, { type: 'expense', amount: 800, at: at('2026-11-25') },
      { type: 'income', amount: 999, at: at('2026-11-30') },
    ] },
    deals: [{ id: 'd1', stage: 'won', value: 40000, closedAt: at('2026-11-25') }, { id: 'd2', stage: 'lost', closedAt: at('2026-11-10') }],
    reports: [],
  };
}

test('work days: Sunday to Thursday by default, plus the owner\'s holidays', () => {
  const s = agency();
  assert.ok(isWorkDay(s, '2026-11-22')); // Sunday
  assert.ok(isWorkDay(s, '2026-11-26')); // Thursday
  assert.ok(!isWorkDay(s, '2026-11-27')); // Friday
  assert.ok(!isWorkDay(s, '2026-11-28')); // Saturday
  assert.equal(weekStart('2026-11-25'), '2026-11-22');
  assert.ok(lastWorkDayOfWeek(s, '2026-11-26'));
  assert.ok(!lastWorkDayOfWeek(s, '2026-11-25'));
  setHoliday(s, '2026-11-26', 'إجازة الوكالة');
  assert.ok(!isWorkDay(s, '2026-11-26'));
  assert.ok(lastWorkDayOfWeek(s, '2026-11-25')); // Thursday is off now
  setHoliday(s, '2026-11-26', '');
  assert.ok(isWorkDay(s, '2026-11-26'));
  s.calendar.workDays = [1, 2, 3, 4, 5]; // Monday to Friday
  assert.ok(isWorkDay(s, '2026-11-27'));
  assert.ok(!isWorkDay(s, '2026-11-22'));
  assert.throws(() => setHoliday(s, 'غداً', 'x'), /غير صالح/);
});

test('a month grid has whole weeks starting on Sunday', () => {
  const g = monthGrid(2026, 10); // November 2026 starts on a Sunday
  assert.equal(g[0][0], '2026-11-01');
  assert.equal(g.length, 5);
  assert.equal(g.at(-1).filter(Boolean).at(-1), '2026-11-30');
  assert.ok(g.every((w) => w.length === 7));
  const feb = monthGrid(2026, 1);
  assert.equal(feb[0].indexOf('2026-02-01'), 0);
  assert.equal(monthGrid(2026, 4)[0].filter(Boolean)[0], '2026-05-01');
  assert.equal(monthGrid(2026, 4)[0].indexOf('2026-05-01'), 5); // a Friday
});

test('a day shows leave, deadlines, meetings, finished work and attendance', () => {
  const s = agency();
  const d = dayEvents(s, '2026-11-24');
  assert.equal(d.done.length, 2);
  assert.equal(d.meetings.length, 1);
  assert.equal(d.attendance.present.length, 2);
  const w = dayEvents(s, '2026-11-26');
  assert.deepEqual(w.leave.map((x) => x.emp.name), ['ليلى']);
  assert.deepEqual(w.due.map((p) => p.name), ['حملة']);
});

test('weekly numbers cover only the week', () => {
  const st = weeklyStats(agency(), '2026-11-22', '2026-11-28');
  assert.equal(st.tasksDone, 3);
  assert.equal(st.firstPass, 1);
  assert.deepEqual(st.top, [{ empId: 'e1', n: 2 }, { empId: 'e2', n: 1 }]);
  assert.equal(st.income, 5000);
  assert.equal(st.expense, 800);
  assert.equal(st.won.length, 1);
  assert.equal(st.lost.length, 0);
  assert.equal(st.meetings, 1);
  assert.equal(st.workdays, 3);
  assert.equal(st.presence, 2); // (2 + 2 + 1) / 3 rounded
  assert.equal(st.leaveDays, 2);
  assert.deepEqual(st.projectsDue.map((p) => p.name), ['هوية']);
});

test('reports are kept, found by type and day, and capped', () => {
  const s = agency();
  assert.throws(() => addReport(s, { type: 'gossip', day: '2026-11-25', text: 'x' }, { newId }), /غير معروف/);
  const r = addReport(s, { type: 'eod', day: '2026-11-25', by: 'e1', text: 'أنجزنا' }, { newId });
  assert.equal(reportOf(s, 'eod', '2026-11-25', 'e1'), r);
  assert.equal(reportOf(s, 'eod', '2026-11-25', 'e2'), null);
  for (let i = 0; i < 70; i++) addReport(s, { type: 'standup', day: '2026-11-26', text: String(i) }, { newId });
  assert.equal(s.reports.length, 60);
});
