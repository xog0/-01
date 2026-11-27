// Documents the agency can hand out: the works library (everything the
// team produced, searchable), invoices for client payments, client
// statements, and a CSV of the ledger. Pure functions returning strings,
// so they can be tested without a browser. Every value that came from a
// person or the AI is escaped before it enters HTML.
import { PROJECT_STATUS } from './crm.js';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

const num = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n || 0);
const dateOf = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Finished task outputs and meeting minutes, newest first, filtered. */
export function libraryItems(state, { clientId = '', projectId = '', empId = '', q = '', kind = '' } = {}) {
  const needle = q.trim().toLowerCase();
  const projectsOfClient = clientId ? new Set((state.projects || []).filter((p) => p.clientId === clientId).map((p) => p.id)) : null;
  const items = [];
  if (kind !== 'meeting') {
    for (const t of state.tasks) {
      if (t.status !== 'done' || !t.output) continue;
      if (empId && t.empId !== empId) continue;
      if (projectId && t.projectId !== projectId) continue;
      if (projectsOfClient && !projectsOfClient.has(t.projectId)) continue;
      items.push({ kind: 'task', id: t.id, title: t.title, text: t.output, at: t.doneAt || t.createdAt || 0, empId: t.empId, projectId: t.projectId || null, rating: t.rating || null });
    }
  }
  if (kind !== 'task' && !projectId && !clientId) {
    for (const m of state.meetings || []) {
      if (empId && !m.attendees?.includes(empId)) continue;
      const text = `${m.summary || ''}\n\n${(m.log || []).map((l) => `${l.who}: ${l.text}`).join('\n\n')}`;
      items.push({ kind: 'meeting', id: m.id || `m${m.at}`, title: `محضر: ${m.topic}`, text, at: m.at, empId: null, projectId: null, rating: null });
    }
  }
  return items
    .filter((it) => !needle || it.title.toLowerCase().includes(needle) || it.text.toLowerCase().includes(needle))
    .sort((a, b) => b.at - a.at);
}

/** Library items as a Markdown document: one item under its own title, several under the library's. */
export function itemsMarkdown(items, { nameOf = () => '', projectOf = () => null, agency = '' } = {}) {
  const single = items.length === 1;
  const parts = items.map((it) => {
    const p = projectOf(it.projectId);
    const meta = [nameOf(it.empId), p ? `${p.client} · ${p.name}` : '', dateOf(it.at), it.rating ? `تقييم ${it.rating}/5` : ''].filter(Boolean).join(' · ');
    return `${single ? '#' : '##'} ${it.title}\n\n_${meta}_\n\n${it.text}`;
  });
  if (single) return `${parts[0]}\n`;
  return `# ${agency ? `${agency} — ` : ''}مكتبة الأعمال\n\n${parts.join('\n\n---\n\n')}\n`;
}

const PAGE_STYLE = `body{font-family:Tajawal,'Segoe UI',Tahoma,sans-serif;color:#1d1f2b;margin:0;background:#f6f5f2}
.doc{max-width:760px;margin:24px auto;background:#fff;padding:40px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.08)}
h1{margin:0 0 4px;font-size:26px} .muted{color:#6b6f80} table{width:100%;border-collapse:collapse;margin-top:20px}
th,td{padding:10px;border-bottom:1px solid #e6e4df;text-align:start} th{background:#f3f1ec;font-weight:600}
td.n{text-align:end;font-variant-numeric:tabular-nums} .head{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
.total{font-size:20px;font-weight:700} .badge{display:inline-block;padding:2px 10px;border-radius:99px;background:#e8f7ee;color:#1f7a47}
@media print{body{background:#fff}.doc{box-shadow:none;margin:0}}`;

function page(title, inner) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"><style>${PAGE_STYLE}</style></head>` +
    `<body><div class="doc">${inner}</div></body></html>`;
}

export const invoiceNumber = (entry) => `INV-${new Date(entry.at).getFullYear()}-${String(entry.id).replace(/\D/g, '').padStart(4, '0')}`;

/** A paid invoice (receipt) for one client payment in the ledger. */
export function invoiceHtml(state, entry) {
  const p = state.projects?.find((x) => x.id === entry.projectId);
  const c = p && state.clients?.find((x) => x.id === p.clientId);
  const cur = state.finance?.currency || '';
  const no = invoiceNumber(entry);
  return page(`فاتورة ${no}`, `
    <div class="head"><div><h1>فاتورة</h1><div class="muted">${escapeHtml(no)} · ${dateOf(entry.at)}</div></div>
    <div><b>${escapeHtml(state.company?.name)}</b><div class="muted">${escapeHtml(state.company?.about || '')}</div></div></div>
    <p><b>إلى:</b> ${escapeHtml(c?.name || 'عميل')}${c?.contact ? ` — ${escapeHtml(c.contact)}` : ''}${c?.city ? ` · ${escapeHtml(c.city)}` : ''}</p>
    <table><thead><tr><th>البيان</th><th>المشروع</th><th>المبلغ (${escapeHtml(cur)})</th></tr></thead>
    <tbody><tr><td>${escapeHtml(entry.note || entry.category)}</td><td>${escapeHtml(p?.name || '—')}</td><td class="n">${num(entry.amount)}</td></tr></tbody></table>
    <p class="total">الإجمالي: ${num(entry.amount)} ${escapeHtml(cur)} <span class="badge">مدفوعة</span></p>
    ${p ? `<p class="muted">قيمة المشروع ${num(p.fee)} · المحصّل حتى الآن ${num(p.paid)} · المتبقي ${num(Math.max(0, p.fee - (p.paid || 0)))} ${escapeHtml(cur)}</p>` : ''}`);
}

/** Everything billed to and paid by one client. */
export function statementHtml(state, clientId, now = Date.now()) {
  const c = state.clients?.find((x) => x.id === clientId);
  const cur = state.finance?.currency || '';
  const projects = (state.projects || []).filter((p) => p.clientId === clientId && p.status !== 'cancelled');
  const ids = new Set(projects.map((p) => p.id));
  const payments = (state.finance?.ledger || []).filter((l) => l.type === 'income' && ids.has(l.projectId)).sort((a, b) => a.at - b.at);
  const fee = projects.reduce((s, p) => s + (p.fee || 0), 0);
  const paid = payments.reduce((s, l) => s + l.amount, 0);
  return page(`كشف حساب ${c?.name || ''}`, `
    <div class="head"><div><h1>كشف حساب</h1><div class="muted">${escapeHtml(c?.name || '')} · حتى ${dateOf(now)}</div></div>
    <div><b>${escapeHtml(state.company?.name)}</b></div></div>
    <h3>المشاريع</h3><table><thead><tr><th>المشروع</th><th>الحالة</th><th>القيمة</th><th>المحصّل</th><th>المتبقي</th></tr></thead><tbody>
    ${projects.map((p) => `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(PROJECT_STATUS[p.status] || p.status)}</td><td class="n">${num(p.fee)}</td><td class="n">${num(p.paid)}</td><td class="n">${num(Math.max(0, p.fee - (p.paid || 0)))}</td></tr>`).join('')}
    </tbody></table>
    <h3>الدفعات</h3><table><thead><tr><th>التاريخ</th><th>رقم الفاتورة</th><th>البيان</th><th>المبلغ</th></tr></thead><tbody>
    ${payments.map((l) => `<tr><td>${dateOf(l.at)}</td><td>${invoiceNumber(l)}</td><td>${escapeHtml(l.note)}</td><td class="n">${num(l.amount)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">لا توجد دفعات بعد</td></tr>'}
    </tbody></table>
    <p class="total">إجمالي القيمة ${num(fee)} · المدفوع ${num(paid)} · المتبقي ${num(Math.max(0, fee - paid))} ${escapeHtml(cur)}</p>`);
}

/** The ledger as CSV (UTF-8 with BOM so spreadsheet apps read Arabic correctly). */
export function ledgerCsv(state) {
  const cell = (v) => {
    const s = String(v ?? '');
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // keep spreadsheets from treating text as formulas
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const rows = [['التاريخ', 'النوع', 'البند', 'المبلغ', 'ملاحظة']];
  for (const l of state.finance?.ledger || []) rows.push([dateOf(l.at), l.type === 'income' ? 'إيراد' : 'مصروف', l.category, l.amount, l.note]);
  return `﻿${rows.map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`;
}
