import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFinance, addAdjustment, payLine, payrollPreview, runPayroll, addLedger, balance, monthTotals,
  parseFinanceOrders, financeBrief, defaultSalary, periodLabel,
} from '../public/js/finance.js';
import { createInitialState, applyMigrations, titleFor } from '../public/js/data.js';

const NOV = Date.UTC(2026, 10, 15);
function agency() {
  const s = { employees: [
    { id: 'a', name: 'خالد', level: 3, salary: 9000 },
    { id: 'b', name: 'ليلى', level: 2, salary: 7000 },
  ], finance: createFinance(NOV) };
  return s;
}

test('pay for the month adds overtime and bonuses and subtracts deductions', () => {
  const s = agency();
  addAdjustment(s, { empId: 'a', type: 'bonus', amount: 500, reason: 'حملة ناجحة' });
  addAdjustment(s, { empId: 'a', type: 'taskBonus', amount: 100 });
  addAdjustment(s, { empId: 'a', type: 'deduction', amount: 200, reason: 'تأخير' });
  const ot = addAdjustment(s, { empId: 'a', type: 'overtime', hours: 10 });
  assert.equal(ot.amount, 843.75); // 9000 / 160 * 1.5 * 10
  const line = payLine(s, s.employees[0]);
  assert.deepEqual([line.base, line.bonuses, line.deductions, line.overtime, line.net], [9000, 600, 200, 843.75, 10243.75]);
  assert.equal(payLine(s, s.employees[1]).net, 7000);
});

test('a raise changes the salary itself and is not paid out this month', () => {
  const s = agency();
  const r = addAdjustment(s, { empId: 'b', type: 'raise', amount: 1000 });
  assert.equal(s.employees[1].salary, 8000);
  assert.deepEqual([r.from, r.to], [7000, 8000]);
  assert.equal(payLine(s, s.employees[1]).net, 8000);
});

test('bad adjustments are refused', () => {
  const s = agency();
  assert.throws(() => addAdjustment(s, { empId: 'zz', type: 'bonus', amount: 1 }), /غير موجود/);
  assert.throws(() => addAdjustment(s, { empId: 'a', type: 'gift', amount: 1 }), /غير معروف/);
  assert.throws(() => addAdjustment(s, { empId: 'a', type: 'bonus', amount: -5 }), /أكبر من صفر/);
  assert.throws(() => addAdjustment(s, { empId: 'a', type: 'bonus', amount: 'abc' }), /أكبر من صفر/);
  assert.throws(() => addAdjustment(s, { empId: 'a', type: 'deduction', amount: 9001 }), /أكبر من المستحق/);
  assert.throws(() => addAdjustment(s, { empId: 'a', type: 'overtime', hours: 500 }), /أكبر من المسموح/);
});

test('running payroll books the expense, closes the month and opens the next', () => {
  const s = agency();
  addAdjustment(s, { empId: 'a', type: 'bonus', amount: 500 });
  addLedger(s, { type: 'income', category: 'عميل', amount: 40000, at: NOV });
  assert.equal(payrollPreview(s).total, 16500);
  const rec = runPayroll(s, { by: 'cfo', memo: 'تم', at: NOV });
  assert.equal(rec.total, 16500);
  assert.equal(rec.period, '2026-11');
  assert.equal(s.finance.period, '2026-12');
  assert.equal(balance(s), 150000 + 40000 - 16500);
  assert.deepEqual(monthTotals(s, '2026-11'), { income: 40000, expense: 16500 });
  // Next month starts clean.
  assert.equal(payLine(s, s.employees[0]).net, 9000);
  assert.equal(periodLabel('2026-12'), 'ديسمبر 2026');
});

test('December rolls over to January', () => {
  const s = agency();
  s.finance.period = '2026-12';
  runPayroll(s, { at: Date.UTC(2026, 11, 28) });
  assert.equal(s.finance.period, '2027-01');
});

test('finance orders in a reply are parsed, resolved and stripped', () => {
  const emps = [{ id: 'a', name: 'خالد' }, { id: 'b', name: 'ليلى' }];
  const r = parseFinanceOrders('تم.\n[[مالية: خصم | خالد | ٢٠٠ | تأخير]]\n[[مالية: أوفرتايم | ليلى | 6 | حملة]]\n[[مالية: هدية | خالد | 5 | x]]\n[[مالية: مكافأة | الكل | 1,000 | عيد]]', emps);
  assert.equal(r.text, 'تم.');
  assert.deepEqual(r.orders.map((o) => [o.type, o.empIds.join(), o.value]), [
    ['deduction', 'a', 200], ['overtime', 'b', 6], ['bonus', 'a,b', 1000],
  ]);
  assert.deepEqual(parseFinanceOrders('[[مالية: خصم | سامي | 50 | x]]', emps).orders, []);
});

test('the finance brief stays within the prompt field limit', () => {
  const s = agency();
  for (let i = 0; i < 40; i++) s.employees.push({ id: `x${i}`, name: `موظف رقم ${i}`, level: 1, salary: 5000 });
  assert.ok(financeBrief(s).length <= 1200);
});

test('a new agency has Sheika as CFO with salaries for everyone; older ones get both once', () => {
  const s = createInitialState();
  const sheika = s.employees.find((e) => e.name === 'شيكا');
  assert.equal(titleFor(sheika), 'المدير المالي');
  assert.equal(sheika.managerId, s.employees.find((e) => e.name === 'حمو').id);
  assert.ok(sheika.desk >= 26);
  assert.ok(s.employees.every((e) => e.salary === defaultSalary(e.level)));
  const old = createInitialState();
  old.employees = old.employees.filter((e) => e.name !== 'شيكا');
  old.employees.forEach((e) => { delete e.salary; });
  delete old.finance;
  old.migrations = old.migrations.filter((k) => k !== 'finance-setup' && k !== 'add-sheika-cfo');
  assert.equal(applyMigrations(old), true);
  assert.ok(old.finance && old.employees.every((e) => e.salary > 0));
  assert.equal(old.employees.filter((e) => e.name === 'شيكا').length, 1);
  assert.equal(applyMigrations(old), false);
});

test('only the owner can cut a salary, and never to zero or below', () => {
  const s = agency();
  for (const by of ['cfo', 'e1', 'manager', undefined]) {
    if (by === undefined) continue;
    assert.throws(() => addAdjustment(s, { empId: 'a', type: 'cut', amount: 500, by }), /صلاحية المالك وحده/);
  }
  assert.equal(s.employees[0].salary, 9000);
  const c = addAdjustment(s, { empId: 'a', type: 'cut', amount: 1500, reason: 'إعادة هيكلة', by: 'owner' });
  assert.deepEqual([c.from, c.to, s.employees[0].salary], [9000, 7500, 7500]);
  assert.equal(payLine(s, s.employees[0]).net, 7500);
  assert.throws(() => addAdjustment(s, { empId: 'a', type: 'cut', amount: 7500, by: 'owner' }), /أقل من راتب/);
});

test('the finance manager cannot cut salaries through chat orders', () => {
  const emps = [{ id: 'a', name: 'خالد' }];
  assert.deepEqual(parseFinanceOrders('[[مالية: تخفيض | خالد | 500 | x]]', emps).orders, []);
  assert.deepEqual(parseFinanceOrders('[[مالية: cut | خالد | 500 | x]]', emps).orders, []);
});
