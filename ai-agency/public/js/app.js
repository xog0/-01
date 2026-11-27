import { createOffice, ROOMS } from './scene.js';
import {
  LADDER, DEPARTMENTS, POSITIONS, OPEN_DESKS, PRIVATE_OFFICES, MANAGER_LEVEL, freeSeat, isPrivateOffice, ROLE_TASKS, TASK_XP, PRIORITY_NAMES, STATUS_NAMES,
  titleFor, skillsFor, lookFor, bioFor, nextLevel, prevLevel, activeLevels, STAFF_TOP, loadState, saveState, createInitialState, applyMigrations, newId,
} from './data.js';
import { askEmployee, backendStatus } from './api.js';
import { connectCloud } from './cloud.js';
import {
  ADJ_TYPES, MONTHS, addAdjustment, addLedger, balance, defaultSalary, financeBrief, monthTotals, parseFinanceOrders,
  payrollPreview, periodLabel, runPayroll,
} from './finance.js';
import {
  CLIENT_STATUS, PROJECT_STATUS, PROJECT_TYPES, clientTotals, deleteClient, deleteProject, isLate, outstanding,
  portfolioBrief, projectContext, projectProgress, receivables, recordPayment, saveClient, saveProject,
  projectProfit, clientProfit, recordProjectExpense, pendingDeliveries, recordClientReview, clientSatisfaction,
} from './crm.js';
import {
  REQUEST_STATUS, ROLE_NAMES, createBonusRequest, currentStage, decideStage, inReview, ownerDecision, pendingForOwner, skipStage,
} from './approvals.js';
import {
  RECOMMENDATIONS, employeeOfMonth, evaluatorOf, lastEvaluation, metricsOf, parseEvaluation, recordEvaluation, teamPerformance,
} from './performance.js';
import { invoiceHtml, invoiceNumber, itemsMarkdown, ledgerCsv, libraryItems, statementHtml } from './docs.js';
import {
  LEAVE_TYPES, MAX_LEAVE_DAYS, addDays, attendanceOf, dayKey, daysWord, endLeave, grantLeave, leaveBalance, leaveOn, markAttendance,
  parseCandidates, parseHrOrders, salaryRange, sampleCandidates, upcomingLeaves,
  promisePromotion, openPromise, closePromise, parseOfferReply, nextOffer, parsePick, parseRewards, parseMessageOrders,
} from './hr.js';
import {
  DEAL_STAGES, OPEN_STAGES, isOpen, linkProposal, moveDeal, parseDealReview, parseLeads, pipelineStats, sampleLeads, saveDeal, syncDealWithProject,
} from './sales.js';
import {
  COURSES, OFFERS, OVERLOAD_HOURS, RESIGN_BELOW, activeTraining, applyRebalance, completeTrainings, courseById, coursesFor, enroll,
  graduationCandidates, moraleOf, pendingResignation, rebalancePlans, resignationRisk, retentionOutcome, trainingBudget, workloadOf,
} from './people.js';
import {
  REPORT_TYPES, WEEKDAYS, addReport, dayEvents, isWorkDay, lastWorkDayOfWeek, monthGrid, reportOf, setHoliday, weekStart, weeklyStats, workDays,
} from './calendar.js';

// ------------------------------------------------------------ DOM helpers
const $ = (sel) => document.querySelector(sel);
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}
// Renders AI text safely: headings (#), bold (**x**), everything else as text.
function richText(text) {
  const frag = document.createDocumentFragment();
  text.split('\n').forEach((line, i) => {
    if (i) frag.append('\n');
    const m = line.match(/^(#{1,4})\s+(.*)$/);
    const target = m ? h(m[1].length <= 2 ? 'h3' : 'h4') : frag;
    const content = m ? m[2] : line;
    content.split(/(\*\*[^*]+\*\*)/g).forEach((part) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) target.append(h('b', {}, part.slice(2, -2)));
      else if (part) target.append(part);
    });
    if (m) frag.append(target);
  });
  return frag;
}
// In-page confirmation (window.confirm is blocked in some embeds).
function confirmBox(message, okLabel = 'تأكيد') {
  const dlg = $('#dlg-confirm');
  $('#confirm-msg').textContent = message;
  $('#confirm-ok').textContent = okLabel;
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise((resolve) => dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true }));
}
function promptBox(message, placeholder = '') {
  const dlg = $('#dlg-prompt');
  $('#prompt-msg').textContent = message;
  $('#prompt-input').value = '';
  $('#prompt-input').placeholder = placeholder;
  dlg.showModal();
  return new Promise((resolve) => dlg.addEventListener('close',
    () => resolve(dlg.returnValue === 'ok' ? $('#prompt-input').value.trim().slice(0, 300) : null), { once: true }));
}
// Background updates redraw panels and dialogs, which rebuilds their dropdowns
// and fields. While the owner is using one (a list open, a value being typed),
// the redraw waits until they leave it, so a choice is never closed or reset
// under their fingers. The chat box is exempt: replies should keep arriving.
const waitingRedraws = new Map();
const inUse = (container) => {
  const a = document.activeElement;
  return Boolean(a && a.matches?.('select, input, textarea') && !a.closest('#chat-form, #cc-form, #iv-form, #m-form')
    && document.querySelector(container)?.contains(a));
};
function whenIdle(container, redraw) {
  if (inUse(container)) { waitingRedraws.set(container, redraw); return; }
  waitingRedraws.delete(container);
  redraw();
}
document.addEventListener('focusout', () => setTimeout(() => {
  for (const [container, redraw] of [...waitingRedraws]) if (!inUse(container)) { waitingRedraws.delete(container); redraw(); }
}, 0));
// replaceChildren() would print "null" for an empty optional section; fill() skips it.
function fill(el, ...kids) {
  el.replaceChildren(...kids.flat().filter((k) => k !== null && k !== undefined && k !== false));
}
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ------------------------------------------------------------ state
let state = loadState();
applyMigrations(state);
let selectedId = null;
let activeTab = 'chat';
let meeting = null; // { room, topic, attendees, log, busy }
let workdayRunning = false;
const busy = new Set(); // employee ids currently waiting on the AI

let cloud = null; // set once the claude.ai store has loaded
// Send pending cloud writes right away when the page is hidden or closed
// (switching apps on a phone, closing the tab), instead of after the usual pause.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') cloud?.flush(); });
window.addEventListener('pagehide', () => cloud?.flush());
const save = () => {
  saveState(state);
  cloud?.save(state);
};
const emp = (id) => state.employees.find((e) => e.id === id);
const colorOf = (e) => DEPARTMENTS[e.dept].color;
const byRank = (a, b) => b.level - a.level || b.xp - a.xp;

const actorOf = (e) => ({ ...e, color: colorOf(e), look: lookFor(e) });

// Money formatting and who keeps the books (the most senior person in Finance).
const fmt = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
const money = (n) => `${fmt(n)} ${state.finance?.currency || ''}`.trim();
const cfo = () => state.employees.filter((x) => x.dept === 'finance' && x.level >= MANAGER_LEVEL).sort(byRank)[0] || null;
// The rung someone can be promoted to (none above deputy CEO: the CEO's chair is not a promotion).
const nextRung = (e) => (nextLevel(e.level) === null ? undefined : LADDER[nextLevel(e.level)]);
const ceoNow = () => state.employees.filter((x) => x.level >= 8).sort((a, b) => (b.xp || 0) - (a.xp || 0))[0] || null;
// Arabic number agreement: 1 مشروع واحد، 2 مشروعان، 3-10 مشاريع، 11+ مشروعاً.
function countOf(n, [one, two, few, many]) {
  if (n === 0) return `لا ${few}`;
  if (n === 1) return one;
  if (n === 2) return two;
  return `${n} ${n <= 10 ? few : many}`;
}
const PROJECTS_WORD = ['مشروع واحد', 'مشروعان', 'مشاريع', 'مشروعاً'];
const TASKS_WORD = ['مهمة واحدة', 'مهمتان', 'مهام', 'مهمة'];
const project = (id) => state.projects?.find((p) => p.id === id) || null;
const clientOf = (p) => state.clients?.find((c) => c.id === p?.clientId) || null;
// ---- leave: who is away today, and who stands in for a manager on leave
const awayNow = (e) => (e ? leaveOn(state, e.id, dayKey()) : null);
const awayNote = (e) => { const l = awayNow(e); return l ? `${e.name} في إجازة ${LEAVE_TYPES[l.type].name} حتى ${l.to}` : ''; };
const atWork = (list) => list.filter((m) => !awayNow(m));
function actingManager(e) {
  const seen = new Set();
  for (let m = e.managerId ? emp(e.managerId) : null; m && !seen.has(m.id); m = m.managerId ? emp(m.managerId) : null) {
    seen.add(m.id);
    if (!awayNow(m)) return m;
  }
  return null;
}
function syncAway() {
  for (const e of state.employees) office.setAway(e.id, Boolean(awayNow(e)));
}

// What someone remembers at work: their last finished tasks and the last
// note their manager gave them.
function memoryOf(e) {
  const done = state.tasks.filter((t) => t.empId === e.id && t.status === 'done').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const parts = [];
  if (done.length) parts.push(`آخر مهامك المنجزة: ${done.slice(0, 4).map((t) => t.title).join('، ')}.`);
  const note = done.find((t) => t.reviews?.length)?.reviews.at(-1);
  if (note?.feedback) parts.push(`آخر ملاحظة من ${emp(note.by)?.name || 'مديرك'} على عملك: "${note.feedback}"`);
  const ev = lastEvaluation(state, e.id);
  if (ev) parts.push(`آخر تقييم أداء لك من ${emp(ev.by)?.name || 'مديرك'}: ${ev.grade || ''}. ${ev.improve ? `المطلوب تحسينه: ${ev.improve}` : ''}`);
  const live = (state.projects || []).filter((p) => (p.status === 'active' || p.status === 'proposal') && (p.leadId === e.id || p.team.includes(e.id)));
  if (live.length) {
    parts.push(`مشاريعك: ${live.map((p) => `${p.name} لـ${clientOf(p)?.name || 'عميل'} (${p.leadId === e.id ? 'أنت قائده' : 'عضو في الفريق'})`).join('، ')}.`);
  }
  const talk = Object.values(state.dms || {}).flat().filter((m) => m.from === e.id || m.to === e.id).sort((a, b) => a.at - b.at).slice(-4);
  if (talk.length) parts.push(`آخر رسائلك مع الزملاء: ${talk.map((m) => `${m.from === e.id ? `أنت إلى ${emp(m.to)?.name}` : `${emp(m.from)?.name} إليك`}: «${m.text.slice(0, 120)}»`).join('؛ ')}.`);
  const mood = moraleOf(state, e);
  if (mood.score < 55) parts.push(`معنوياتك هذه الأيام ${mood.mood.name} (${mood.score} من 100)، بسبب: ${mood.factors.filter((f) => f.delta < 0).slice(0, 3).map((f) => f.label).join('، ')}. يظهر ذلك في نبرتك بلطف دون مبالغة.`);
  const courses = (state.trainings || []).filter((t) => t.empId === e.id);
  if (courses.some((t) => t.status === 'done')) parts.push(`أنهيت دورات: ${courses.filter((t) => t.status === 'done').map((t) => t.title).join('، ')}، فطبّق ما تعلمته في عملك.`);
  if (activeTraining(state, e.id)) parts.push(`تحضر الآن دورة «${activeTraining(state, e.id).title}» حتى ${activeTraining(state, e.id).to}.`);
  const promise = openPromise(state, e.id);
  if (promise) parts.push(`وعدتك ${emp(promise.by)?.name || 'الإدارة'} بالترقية إلى «${LADDER[promise.toLevel]?.name}»${promise.condition ? ` إذا: ${promise.condition}` : ''}، والقرار النهائي للمالك.`);
  if (!officeOpen && !awayNow(e)) parts.unshift('الوقت الآن خارج الدوام وأنت في منزلك، فترد على رسالة المالك من هاتفك باختصار.');
  const l = awayNow(e);
  if (l) parts.unshift(`أنت الآن في إجازة ${LEAVE_TYPES[l.type].name} حتى ${l.to}، وتعود يوم ${addDays(l.to, 1)}. ترد على المالك من إجازتك باختصار.`);
  return parts.join(' ').slice(0, 1100);
}

// What the HR manager knows about everyone today: leave, attendance, evaluations, hiring.
function hrBrief() {
  const today = dayKey();
  const away = state.employees.filter(awayNow).map((e) => `${e.name} (${LEAVE_TYPES[awayNow(e).type].name} حتى ${awayNow(e).to})`);
  const coming = upcomingLeaves(state, today).filter((l) => l.from > today).slice(0, 5).map((l) => `${emp(l.empId)?.name} من ${l.from} إلى ${l.to}`);
  const absent = state.employees.map((e) => ({ e, a: attendanceOf(state, e.id) })).filter((x) => x.a.absent > 0).map((x) => `${x.e.name} ${x.a.absent}`);
  const evals = state.employees.map((e) => ({ e, ev: lastEvaluation(state, e.id) })).filter((x) => x.ev).slice(-8).map((x) => `${x.e.name}: ${x.ev.grade}`);
  return [
    `اليوم ${today}. عدد الموظفين ${state.employees.length}.`,
    `في إجازة الآن: ${away.join('، ') || 'لا أحد'}.`,
    coming.length ? `إجازات قادمة: ${coming.join('، ')}.` : '',
    absent.length ? `أيام غياب آخر 30 يوماً: ${absent.join('، ')}.` : 'لا غياب مسجل آخر 30 يوماً.',
    evals.length ? `آخر التقييمات: ${evals.join('، ')}.` : 'لم يُقيَّم أحد بعد.',
    state.hiring ? `جولة توظيف مفتوحة لوظيفة ${state.hiring.title} (${state.hiring.candidates.length} مرشحين${state.hiring.cap ? `، الحد الأقصى للراتب ${state.hiring.cap}` : ''}).` : '',
    (() => { const low = state.employees.map((x) => ({ x, m: moraleOf(state, x) })).filter((r) => r.m.score < 55); return low.length ? `معنويات منخفضة: ${low.map((r) => `${r.x.name} ${r.m.score}`).join('، ')}.` : 'لا أحد معنوياته منخفضة.'; })(),
    `ميزانية التدريب المتبقية هذه السنة ${trainingBudget(state).left}.`,
    (state.promises || []).some((p) => p.status === 'open') ? `وعود ترقية مفتوحة: ${(state.promises || []).filter((p) => p.status === 'open').map((p) => emp(p.empId)?.name).filter(Boolean).join('، ')}.` : '',
  ].filter(Boolean).join(' ');
}

function personaOf(e) {
  const mgr = e.managerId ? emp(e.managerId) : null;
  const bio = bioFor(e);
  return {
    name: e.name,
    title: titleFor(e),
    level: LADDER[e.level].name,
    department: DEPARTMENTS[e.dept].name,
    skills: skillsFor(e),
    personality: e.personality || '',
    manager: mgr ? `${mgr.name} (${titleFor(mgr)})` : 'مالك الوكالة مباشرة',
    reports: teamOf(e.id).map((m) => `${m.name} (${titleFor(m)})`).join('، '),
    duties: e.id === cfo()?.id ? 'finance' : e.id === hrHead()?.id ? 'hr' : '',
    bio: `عمرك ${bio.age} سنة، وخبرتك ${bio.years} ${bio.years > 10 ? 'سنة' : 'سنوات'}. ${bio.background} أسلوبك في التواصل: ${bio.style}`.slice(0, 1100),
    memory: e.id === cfo()?.id
      ? `${financeBrief(state, fmt)} مستحقات العملاء غير المحصّلة: ${fmt(receivables(state))} ${state.finance.currency}. ${memoryOf(e)}`.slice(0, 1150)
      : e.id === hrHead()?.id ? `${hrBrief()} ${memoryOf(e)}`.slice(0, 1150) : memoryOf(e),
  };
}
function companyOf(except) {
  return {
    name: state.company.name,
    about: state.company.about || '',
    team: state.employees.filter((x) => x.id !== except).map((x) => `${x.name} (${titleFor(x)})`).join('، ').slice(0, 1150),
    portfolio: portfolioBrief(state, (id) => emp(id)?.name || '—'),
  };
}
function ask(e, mode, messages) {
  return askEmployee({ mode, persona: personaOf(e), company: companyOf(e.id), messages });
}

// ------------------------------------------------------------ 3D office
const office = createOffice($('#stage'), { onSelect: (id) => selectEmployee(id) });

const bubbles = new Map(); // last speech bubble per employee, to restore after an interruption
function setStatus(e, status, bubble = '') {
  e.status = status;
  bubbles.set(e.id, bubble);
  office.setStatus(e.id, status, bubble);
  renderRoster();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------ header + roster
function renderHeader() {
  $('#company-name').textContent = state.company.name;
  document.title = state.company.name;
  office.setCompanyName(state.company.name);
  $('#stat-emp').textContent = state.employees.length;
  $('#stat-open').textContent = state.tasks.filter((t) => t.status !== 'done').length;
  $('#stat-done').textContent = state.tasks.filter((t) => t.status === 'done').length;
}

function avatar(e) {
  return h('div', { class: 'avatar', style: `background:${hex(colorOf(e))}` }, e.name.slice(0, 1));
}

function moodIcon(e) {
  const m = moraleOf(state, e);
  return m.score < 55 ? h('span', { class: 'mood', title: `المعنويات ${m.score}: ${m.mood.name}` }, m.mood.icon) : null;
}
function renderRoster() {
  const r = $('#roster');
  fill(r, ...[...state.employees].sort(byRank).map((e) =>
    h('button', { class: `chip${e.id === selectedId ? ' selected' : ''}${awayNow(e) ? ' away' : ''}`, title: awayNote(e) || undefined, onclick: () => selectEmployee(e.id) },
      h('span', { class: `dot ${awayNow(e) ? 'away' : !officeOpen ? 'home' : e.status || 'idle'}`, title: !officeOpen && !awayNow(e) ? 'في المنزل (خارج الدوام)' : undefined }),
      avatar(e),
      h('span', {}, awayNow(e) ? `🌴 ${e.name}` : e.name, moodIcon(e), h('small', {}, awayNow(e) ? `في إجازة حتى ${awayNow(e).to}` : titleFor(e))))));
}

// ------------------------------------------------------------ side panel
function selectEmployee(id) {
  const e = emp(id);
  if (!e) return;
  selectedId = id;
  office.setSelected(id);
  office.focusOn(id);
  $('#panel').hidden = false;
  renderPanel();
  renderRoster();
}
function closePanel() {
  selectedId = null;
  office.setSelected(null);
  $('#panel').hidden = true;
  renderRoster();
}
$('#p-close').addEventListener('click', closePanel);
document.querySelectorAll('#panel .tabs button').forEach((b) => b.addEventListener('click', () => {
  activeTab = b.dataset.tab;
  renderPanel();
}));

function renderPanel() {
  const e = emp(selectedId);
  if (!e) return closePanel();
  $('#p-avatar').replaceWith(Object.assign(avatar(e), { id: 'p-avatar' }));
  $('#p-name').textContent = e.name;
  $('#p-title').textContent = `${titleFor(e)} · ${DEPARTMENTS[e.dept].name}`;
  document.querySelectorAll('#panel .tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === activeTab));
  document.querySelectorAll('#panel .pane').forEach((p) => p.classList.toggle('active', p.dataset.pane === activeTab));
  if (activeTab === 'chat') renderChat(e);
  if (activeTab === 'tasks') renderEmpTasks(e);
  if (activeTab === 'profile') renderProfile(e);
  if (activeTab === 'team') renderTeamTalk(e);
}

// ---- chat
function renderChat(e) {
  const log = $('#chat-log');
  const history = state.chats[e.id] || [];
  const items = history.map((m) => h('div', { class: `msg ${m.role}` },
    h('span', { class: 'who' }, m.role === 'user' ? 'أنت' : e.name), richText(m.content)));
  if (!history.length) {
    items.push(h('div', { class: 'empty' }, `ابدأ محادثة مع ${e.name}. اسأله عن عمله، أو اطلب رأيه، أو كلّفه بشيء.`));
  }
  if (busy.has(`chat:${e.id}`)) items.push(h('div', { class: 'msg assistant typing' }, `${e.name} يكتب…`));
  if (awayNow(e)) items.unshift(h('div', { class: 'notice' }, `🌴 ${awayNote(e)}. لا تُسند إليه مهام حتى يعود، ويرد عليك باختصار.`));
  fill(log, ...items);
  log.scrollTop = log.scrollHeight;
}

$('#chat-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const e = emp(selectedId);
  const input = $('#chat-input');
  const text = input.value.trim();
  if (!e || !text || busy.has(`chat:${e.id}`)) return;
  input.value = '';
  const history = (state.chats[e.id] ||= []);
  history.push({ role: 'user', content: text });
  save();
  busy.add(`chat:${e.id}`);
  office.recall(e.id);
  const prev = e.status;
  setStatus(e, 'talking', '💬');
  renderPanel();
  try {
    let raw = await ask(e, 'chat', history.slice(-30));
    let financeNote = '';
    if (e.id === cfo()?.id) {
      const parsed = parseFinanceOrders(raw, state.employees.filter((x) => x.id !== e.id));
      raw = parsed.text;
      financeNote = applyFinanceOrders(parsed.orders, e);
    }
    let messageNote = '';
    const reach = e.id === ceoNow()?.id || e.id === hrHead()?.id ? state.employees.filter((x) => x.id !== e.id) : teamOf(e.id);
    if (reach.length) {
      const parsed = parseMessageOrders(raw, reach);
      raw = parsed.text;
      for (const o of parsed.orders) {
        for (const id of o.empIds) { sendDm(e.id, id, o.text, 'order'); queueReply(e, emp(id)); }
        messageNote = `📨 أرسلت الرسالة إلى ${o.empIds.map((id) => emp(id)?.name).join('، ')}. تجد ردودهم في تبويب «👥 الزملاء».`;
      }
      if (parsed.orders.length) save();
    }
    let hrJobs = null;
    if (e.id === hrHead()?.id) {
      const parsed = parseHrOrders(raw, state.employees, { departments: DEPARTMENTS, ladder: LADDER });
      raw = parsed.text;
      hrJobs = applyHrOrders(parsed.orders, e);
      if (hrJobs.note) financeNote = hrJobs.note;
    }
    const { text: reply, order } = extractAssignOrder(raw, e, text);
    history.push({ role: 'assistant', content: reply || 'حاضر.' });
    if (financeNote) history.push({ role: 'assistant', content: financeNote });
    if (messageNote) history.push({ role: 'assistant', content: messageNote });
    if (hrJobs?.later.length) hrJobs.later.forEach((job) => job()); // evaluations and hiring run after the reply is shown
    if (order) {
      save();
      const added = await assignTeamTasks(e, order.ids, order.perMember, order.focus, { urgent: order.urgent });
      if (added?.length) {
        const lines = order.ids.map((id) => {
          const titles = added.filter((t) => t.empId === id).map((t) => t.title);
          return titles.length ? `- ${emp(id)?.name}: ${titles.join('، ')}` : null;
        }).filter(Boolean);
        history.push({ role: 'assistant', content: `✅ تم التكليف${order.urgent ? ' بأولوية عالية، وبدأ التنفيذ فوراً' : ''}:\n${lines.join('\n')}` });
      }
    }
    save();
  } catch (err) {
    history.pop();
    input.value = text;
    toast(err.message);
  } finally {
    busy.delete(`chat:${e.id}`);
    setStatus(e, prev === 'talking' ? 'idle' : prev);
    if (selectedId === e.id) renderPanel();
  }
});
$('#chat-input').addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && !ev.shiftKey) {
    ev.preventDefault();
    $('#chat-form').requestSubmit();
  }
});

// ---- tasks
function taskCard(t, { showOwner = false } = {}) {
  const owner = emp(t.empId);
  const running = t.status === 'doing' || t.status === 'review';
  return h('div', { class: `task ${t.status}` },
    h('h4', {}, t.title),
    t.description ? h('p', {}, t.description) : null,
    h('div', { class: 'meta' },
      showOwner && owner ? h('span', { class: 'badge' }, `👤 ${owner.name}`) : null,
      t.assignedBy && emp(t.assignedBy) ? h('span', { class: 'badge' }, `📋 من ${emp(t.assignedBy).name}`) : null,
      project(t.projectId) ? h('span', { class: 'badge project', title: 'فتح المشروع', onclick: () => openClients('projects') },
        `📁 ${clientOf(project(t.projectId))?.name || ''} · ${project(t.projectId).name}`) : null,
      h('span', { class: `badge ${t.priority}` }, `أولوية ${PRIORITY_NAMES[t.priority]}`),
      h('span', { class: `badge ${t.status === 'review' ? 'doing' : t.status}` }, running ? `${STATUS_NAMES[t.status]}…` : STATUS_NAMES[t.status]),
      t.status === 'review' && emp(t.empId)?.managerId ? h('span', { class: 'badge' }, `🧐 ${emp(emp(t.empId).managerId)?.name}`) : null,
      t.status === 'done' ? h('span', { class: 'badge' }, `+${TASK_XP[t.priority]} خبرة`) : null),
    h('div', { class: 'row' },
      t.status === 'todo' ? h('button', { class: 'small primary', onclick: () => runTask(t.id) }, '▶ نفّذ الآن') : null,
      t.status === 'done' ? h('button', { class: 'small', onclick: () => showOutput(t) }, '📄 عرض النتيجة') : null,
      t.status === 'done' ? h('button', { class: 'small', onclick: () => redoTask(t.id) }, '↺ إعادة') : null,
      !running ? h('button', { class: 'small danger', onclick: () => deleteTask(t.id) }, 'حذف') : null));
}

function renderEmpTasks(e) {
  const list = state.tasks.filter((t) => t.empId === e.id)
    .sort((a, b) => ['doing', 'review', 'todo', 'done'].indexOf(a.status) - ['doing', 'review', 'todo', 'done'].indexOf(b.status));
  fill($('#emp-tasks'), ...(list.length ? list.map((t) => taskCard(t)) : [h('div', { class: 'empty' }, 'لا توجد مهام لهذا الموظف.')]));
  const keep = $('#task-project').value;
  const mine = liveProjects().filter((p) => p.leadId === e.id || p.team.includes(e.id));
  const others = liveProjects().filter((p) => !mine.includes(p));
  fill($('#task-project'), h('option', { value: '' }, 'بدون مشروع'),
    ...[...mine, ...others].map((p) => h('option', { value: p.id }, `📁 ${clientOf(p)?.name} · ${p.name}`)));
  $('#task-project').value = project(keep) ? keep : '';
}

const liveProjects = () => (state.projects || []).filter((p) => p.status === 'active' || p.status === 'proposal');
function projectSelect(value = '') {
  const sel = h('select', { 'aria-label': 'المشروع' }, h('option', { value: '' }, 'بدون مشروع'),
    ...liveProjects().map((p) => h('option', { value: p.id }, `📁 ${clientOf(p)?.name} · ${p.name}`)));
  sel.value = project(value) ? value : '';
  return sel;
}

$('#task-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const title = $('#task-title').value.trim();
  if (!title || !selectedId) return;
  const t = addTask(selectedId, title, $('#task-desc').value.trim(), $('#task-priority').value, null, $('#task-project').value || null);
  if (t.priority === 'high') runWhenFree(t.id);
  ev.target.reset();
  $('#task-priority').value = 'medium';
  if (t.priority !== 'high') toast('تمت إضافة المهمة');
});

function addTask(empId, title, description, priority, assignedBy = null, projectId = null) {
  const t = { id: newId(state, 't'), empId, title, description, priority, status: 'todo', output: '', createdAt: Date.now(), assignedBy,
    ...(project(projectId) ? { projectId } : {}) };
  state.tasks.push(t);
  save();
  refresh();
  return t;
}
// High priority set by the owner means "now": the employee starts as soon as
// they are free (right away, or straight after their current task).
function runWhenFree(taskId, tries = 0) {
  const t = state.tasks.find((x) => x.id === taskId);
  const e = t && emp(t.empId);
  if (!t || !e || t.status !== 'todo') return;
  if (awayNow(e)) { toast(`${awayNote(e)}. بقيت المهمة في قائمته، أو انقلها لزميل من لوحة المهام.`); return; }
  if (busy.has(e.id) || meeting?.attendees.includes(e.id)) {
    if (tries < 400) setTimeout(() => runWhenFree(taskId, tries + 1), 3000);
    return;
  }
  if (tries === 0) toast(`⚡ أولوية عالية: ${e.name} بدأ «${t.title}» فوراً`);
  runTask(taskId);
}

function deleteTask(id) {
  state.tasks = state.tasks.filter((t) => t.id !== id);
  save();
  refresh();
}
function redoTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  t.status = 'todo';
  t.output = '';
  save();
  refresh();
}

function taskPrompt(t, reviewer) {
  const ctx = projectContext(state, t.projectId);
  let prompt = `${ctx ? `${ctx}\n\n` : ''}المهمة: ${t.title}\n\nالتفاصيل: ${t.description || 'لا توجد تفاصيل إضافية، استخدم خبرتك.'}\n\nالأولوية: ${PRIORITY_NAMES[t.priority]}`;
  if (t.feedback && t.output) {
    prompt += `\n\nهذه نسخة معدّلة. مسودتك السابقة:\n${t.output.slice(0, 2500)}\n\nملاحظات ${reviewer?.name || 'مديرك'}: ${t.feedback}\n` +
      'عدّل العمل بناءً على الملاحظات وقدّم النسخة النهائية كاملة.';
  }
  return prompt;
}

// The manager reads the delivered work and approves it or asks for changes.
async function reviewBy(mgr, e, t) {
  const ctx = projectContext(state, t.projectId);
  const content = `${ctx ? `${ctx}\n` : ''}الموظف: ${e.name} (${titleFor(e)})\nالمهمة: ${t.title}\nالمطلوب: ${t.description || '—'}\n\nالعمل المسلّم:\n${t.output.slice(0, 4500)}`;
  const reply = await ask(mgr, 'review', [{ role: 'user', content }]);
  try {
    const v = JSON.parse(reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1));
    return {
      decision: v.decision === 'revise' ? 'revise' : 'approve',
      feedback: typeof v.feedback === 'string' ? v.feedback.trim().slice(0, 600) : '',
      bonus: v.decision !== 'revise' && v.bonus === true,
      bonusReason: typeof v.bonusReason === 'string' ? v.bonusReason.trim().slice(0, 300) : '',
    };
  } catch {
    return { decision: 'approve', feedback: '' };
  }
}

// An employee works on a task at their desk. If they report to someone, they
// walk over to hand it in; the manager reviews it and may ask for one round
// of changes before signing it off. Reporting straight to the owner means the
// work is done once delivered.
async function runTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  const e = t && emp(t.empId);
  if (!t || !e || t.status !== 'todo') return;
  if (busy.has(e.id)) return toast(`${e.name} مشغول بمهمة أخرى الآن`);
  if (meeting?.attendees.includes(e.id)) return toast(`${e.name} في اجتماع الآن`);
  if (awayNow(e)) return toast(awayNote(e));
  if (!officeOpen) openOffice([e.id]);
  await arrived([e.id]);
  if (busy.has(e.id)) return;
  busy.add(e.id);
  await office.recall(e.id);
  t.status = 'doing';
  t.reviews ||= [];
  setStatus(e, 'working', `⌨️ ${t.title}`);
  office.setDeskLit(e.desk, true);
  refresh();
  const mgr = actingManager(e); // the next manager up stands in for one on leave
  try {
    for (let round = 0; ; round++) {
      t.output = await ask(e, 'task', [{ role: 'user', content: taskPrompt(t, mgr) }]);
      if (!mgr || !emp(mgr.id)) {
        finishTask(t, e, null);
        break;
      }
      t.status = 'review';
      setStatus(e, 'idle', '📤 يسلّم العمل');
      refresh();
      const walked = await office.visit(e.id, mgr.id);
      const prevStatus = mgr.status;
      const prevBubble = bubbles.get(mgr.id) || '';
      setStatus(mgr, 'talking', `🧐 يراجع عمل ${e.name}`);
      let verdict;
      try {
        verdict = await reviewBy(mgr, e, t);
      } finally {
        if (mgr.status === 'talking') setStatus(mgr, prevStatus === 'talking' ? 'idle' : prevStatus, prevBubble);
      }
      t.reviews.push({ by: mgr.id, decision: verdict.decision, feedback: verdict.feedback, at: Date.now() });
      if (walked) {
        setStatus(e, 'idle', verdict.decision === 'approve' ? '👍' : '📝 ملاحظات');
        await sleep(1500);
        await office.recall(e.id);
      }
      if (verdict.decision === 'approve' || round >= 1) {
        finishTask(t, e, mgr, verdict);
        break;
      }
      t.feedback = verdict.feedback || 'راجع العمل وحسّنه.';
      sendDm(mgr.id, e.id, `بخصوص «${t.title}»: ${t.feedback}`, 'review');
      sendDm(e.id, mgr.id, 'حاضر، سأعدّلها الآن وأرسلها لك.', 'auto');
      t.status = 'doing';
      setStatus(e, 'working', `✏️ يعدّل: ${t.title}`);
      toast(`↩️ ${mgr.name} طلب تعديلات من ${e.name}: ${t.title}`);
      refresh();
    }
  } catch (err) {
    t.status = 'todo';
    toast(err.message);
    office.recall(e.id);
  } finally {
    busy.delete(e.id);
    setStatus(e, meeting?.attendees.includes(e.id) ? 'meeting' : 'idle');
    save();
    refresh();
  }
}

function finishTask(t, e, mgr, verdict) {
  t.status = 'done';
  t.doneAt = Date.now();
  t.feedback = '';
  // No automatic bonus: a manager who finds the work outstanding (approved
  // on the first review) recommends one, and it climbs the approval chain.
  const suggested = state.finance?.taskBonus?.[t.priority] || 0;
  if (mgr && verdict?.bonus && t.reviews?.length === 1 && suggested > 0) {
    try {
      createBonusRequest(state, {
        empId: e.id, recommenderId: mgr.id, amount: suggested, taskId: t.id, newId,
        reason: `${verdict.bonusReason || 'عمل متميز'} (المهمة: ${t.title})`.slice(0, 300),
      });
      setTimeout(() => toast(`🏅 ${mgr.name} رشّح ${e.name} لمكافأة، والطلب في طريقه للموارد البشرية`), 2500);
      processBonusQueue();
    } catch { /* a request that cannot be opened must never block finishing work */ }
  }
  const before = e.xp;
  e.xp += TASK_XP[t.priority];
  const next = nextRung(e);
  if (next && before < next.xp && e.xp >= next.xp) toast(`🎉 ${e.name} أصبح مستحقاً للترقية إلى "${next.name}"`);
  else if (mgr) toast(`✅ ${mgr.name} ${verdict?.decision === 'approve' ? 'اعتمد' : 'اعتمد مع ملاحظات'} عمل ${e.name}: ${t.title}`);
  else toast(`✅ ${e.name} أنهى: ${t.title}`);
}

// ---- managers assign job-specific tasks to their team
const teamOf = (managerId) => state.employees.filter((x) => isUnder(x.id, managerId));
const topManager = () => [...state.employees].filter((x) => !x.managerId && teamOf(x.id).length).sort(byRank)[0];
const openTitles = (empId) => state.tasks.filter((t) => t.empId === empId && t.status !== 'done').map((t) => t.title);

function parseAssignments(reply, members) {
  const ids = new Set(members.map((m) => m.id));
  try {
    const json = JSON.parse(reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1));
    const perEmp = {};
    return (Array.isArray(json.tasks) ? json.tasks : []).filter((t) => {
      if (!t || !ids.has(t.empId) || typeof t.title !== 'string' || !t.title.trim()) return false;
      perEmp[t.empId] = (perEmp[t.empId] || 0) + 1;
      return perEmp[t.empId] <= 3;
    }).map((t) => ({
      empId: t.empId,
      title: t.title.trim().slice(0, 200),
      description: typeof t.description === 'string' ? t.description.trim().slice(0, 1500) : '',
      priority: ['low', 'medium', 'high'].includes(t.priority) ? t.priority : 'medium',
    }));
  } catch {
    return [];
  }
}

// Ready-made tasks from each member's department, skipping ones they already have.
function libraryAssignments(members, perMember) {
  return members.flatMap((m) => {
    const have = new Set(state.tasks.filter((t) => t.empId === m.id).map((t) => t.title));
    return (ROLE_TASKS[m.dept] || []).filter(([title]) => !have.has(title)).slice(0, perMember)
      .map(([title, description, priority]) => ({ empId: m.id, title, description, priority }));
  });
}

// A manager's chat reply may end with [[تكليف: names | count | focus]] when the
// owner asked for assignments. Strip it and resolve it to team members.
function extractAssignOrder(reply, manager, ownerAsk = '') {
  const m = reply.match(/\[\[\s*تكليف\s*:([^\]]*)\]\]/);
  if (!m) return { text: reply.trim(), order: null };
  const text = reply.replace(m[0], '').trim();
  const team = teamOf(manager.id);
  if (!team.length) return { text, order: null };
  const [who = '', count = '', focus = '', priority = ''] = m[1].split('|').map((x) => x.trim());
  const names = who.split(/[،,]| و/).map((x) => x.trim()).filter(Boolean);
  const all = !names.length || names.some((n) => /^(ال)?كل|الجميع|الفريق/.test(n));
  const ids = all ? team.map((x) => x.id) : team.filter((x) => names.some((n) => n.includes(x.name) || x.name.includes(n))).map((x) => x.id);
  if (!ids.length) return { text, order: null };
  const digits = count.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const perMember = Math.min(3, Math.max(1, parseInt(digits, 10) || 2));
  // Urgent if the manager marked it so, or if the owner's own words said so.
  const urgent = /عال|عاجل|فور/.test(priority) || URGENT_WORDS.test(ownerAsk);
  return { text, order: { ids, perMember, focus: focus.slice(0, 300), urgent } };
}
const URGENT_WORDS = /عاجل|فور[اًا]?|حالاً|حالا|أولوية عالية|اولوية عالية|بأسرع وقت|الآن/;

async function assignTeamTasks(manager, onlyIds = null, perMember = 2, focus = '', { urgent = false } = {}) {
  const members = teamOf(manager.id).filter((m) => !onlyIds || onlyIds.includes(m.id));
  if (!members.length) return toast(`لا يوجد موظفون تحت إدارة ${manager.name}`);
  return assignTasks(manager, members, perMember, focus, null, { urgent });
}

// A project lead splits the project into tasks for the project team.
async function assignProjectTasks(p) {
  const lead = emp(p.leadId);
  if (!lead) return toast('حدد قائداً للمشروع أولاً');
  const members = p.team.map(emp).filter(Boolean);
  if (!members.length) return toast('أضف أعضاء إلى فريق المشروع أولاً');
  return assignTasks(lead, members, 2, '', p);
}

async function assignTasks(manager, members, perMember, focus, proj, { urgent = false } = {}) {
  const key = `assign:${manager.id}`;
  if (busy.has(key)) return;
  if (awayNow(manager)) return toast(`${awayNote(manager)}. اطلب التوزيع من مديره أو أضف المهام من لوحة المهام.`);
  const away = members.filter(awayNow);
  members = atWork(members);
  if (away.length) toast(`لن يُكلَّف ${away.map((m) => m.name).join('، ')} لأنه في إجازة`);
  if (!members.length) return;
  busy.add(key);
  const prev = manager.status;
  setStatus(manager, 'talking', '📋 توزّع المهام');
  refresh();
  const brief = members.map((m) => {
    const open = openTitles(m.id);
    return `- empId: ${m.id} | ${m.name} | ${titleFor(m)} | قسم ${DEPARTMENTS[m.dept].name} | المهارات: ${skillsFor(m)}` +
      ` | مهامه المفتوحة: ${open.length ? open.join('، ') : 'لا شيء'}`;
  }).join('\n');
  let tasks = [];
  try {
    const ctx = proj ? projectContext(state, proj.id) : '';
    const reply = await ask(manager, 'assign', [{ role: 'user', content:
      `${ctx ? `أنت قائد هذا المشروع، والمطلوب تقسيمه إلى مهام لفريقه.\n${ctx}\n\n` : ''}فريقك:\n${brief}\n\n` +
      `كلّف كل عضو بـ${perMember === 1 ? 'مهمة واحدة' : `${perMember} مهام`} خاصة بوظيفته${proj ? ' تخدم هذا المشروع مباشرة' : ''}.` +
      (focus ? `\nطلب المالك أن تركّز المهام على: ${focus}` : '') +
      (urgent ? '\nالمالك طلبها بأولوية عالية: اجعلها مهاماً عاجلة قابلة للتنفيذ فوراً.' : '') }]);
    tasks = parseAssignments(reply, members);
  } catch (err) {
    toast(err.message);
  }
  if (!tasks.length && !proj) tasks = libraryAssignments(members, perMember);
  if (!tasks.length && proj) toast('تعذّر الحصول على مهام للمشروع. حاول مرة أخرى.');
  const created = tasks.map((t) => addTask(t.empId, t.title, t.description, urgent ? 'high' : t.priority, manager.id, proj ? proj.id : null));
  if (urgent) created.forEach((t) => runWhenFree(t.id));
  busy.delete(key);
  setStatus(manager, prev === 'talking' ? 'idle' : prev);
  const got = [...new Set(tasks.map((t) => t.empId))];
  for (const id of got) {
    const mine = created.filter((t) => t.empId === id);
    const m0 = emp(id);
    if (!m0 || !mine.length) continue;
    sendDm(manager.id, id, `${m0.name}، كلّفتك ${mine.length === 1 ? 'بمهمة' : `بـ${mine.length} مهام`}${proj ? ` في مشروع «${proj.name}»` : ''}${urgent ? ' عاجلة، ابدأ بها فوراً' : ''}:\n` +
      mine.map((t) => `- ${t.title} (أولوية ${PRIORITY_NAMES[t.priority]})`).join('\n') + (focus ? `\nالتركيز: ${focus}` : ''), 'task');
    queueReply(manager, m0);
  }
  for (const id of got) {
    const m = emp(id);
    if (m && m.status === 'idle') {
      office.setStatus(id, 'idle', '📥 مهمة جديدة');
      setTimeout(() => emp(id)?.status === 'idle' && office.setStatus(id, 'idle'), 5000);
    }
  }
  refresh();
  toast(tasks.length ? `📋 ${manager.name} كلّفت ${got.length} من الفريق بـ${tasks.length} مهام` : 'لم تُضف مهام جديدة');
  return tasks;
}

// Each employee works through their own queue; employees work in parallel.
const workdayLabel = (text) => { $('#btn-workday').textContent = text; };
async function startWorkday() {
  if (workdayRunning) return;
  const today = dayKey();
  if (!state.tasks.some((t) => t.status === 'todo' && !meeting?.attendees.includes(t.empId) && !awayNow(emp(t.empId)))) {
    return toast('لا توجد مهام في الانتظار. اطلب من سارة تكليف الفريق، أو أضف مهاماً من لوحة المهام.');
  }
  if (!isWorkDay(state, today)) {
    const off = dayEvents(state, today).holiday;
    if (!(await confirmBox(`اليوم ${WEEKDAYS[new Date().getDay()]} ${off ? `عطلة (${off.name})` : 'عطلة نهاية الأسبوع'}. هل تريد أن يعمل الفريق اليوم؟`, 'نعم، يوم عمل'))) return;
  }
  workdayRunning = true;
  $('#btn-workday').disabled = true;
  if (!officeOpen) {
    workdayLabel('🚶 الفريق يصل…');
    await openOffice();
  }
  const order = { high: 0, medium: 1, low: 2 };
  syncAway();
  markAttendance(state, today, atWork(state.employees).map((e) => e.id));
  save();
  await peopleDaily();
  workdayLabel('☀️ خطة الصباح…');
  await morningStandup(today);
  workdayLabel('⏳ الفريق يعمل…');
  await Promise.all(atWork(state.employees).map(async (e) => {
    for (;;) {
      if (meeting?.attendees.includes(e.id)) return;
      const next = state.tasks.filter((t) => t.empId === e.id && t.status === 'todo')
        .sort((a, b) => order[a.priority] - order[b.priority])[0];
      if (!next) return;
      await runTask(next.id);
      if (next.status !== 'done') return; // stop this employee's queue on error
    }
  }));
  workdayLabel('📝 تقارير نهاية اليوم…');
  const eod = await endOfDayReports(today);
  const weekly = lastWorkDayOfWeek(state, today) && !reportOf(state, 'weekly', today) ? await weeklyReport(today) : null;
  workdayRunning = false;
  $('#btn-workday').disabled = false;
  workdayLabel('▶ ابدأ يوم العمل');
  toast(`🏁 انتهى يوم العمل${eod ? ` · ${countOf(eod, REPORTS_WORD)} في التقويم` : ''}${weekly ? ' · 📊 التقرير الأسبوعي جاهز' : ''}`);
  refresh();
  if (new Date().getHours() >= WORK_HOURS[1]) setTimeout(() => closeOffice({ auto: true }), 4000);
}

// ---- office hours, day and night, visitors
const WORK_HOURS = [8, 17];
const PHASES = { morning: '🌅 صباحاً', day: '☀️ نهاراً', evening: '🌇 مساءً', night: '🌙 ليلاً' };
const LIGHT_MODES = { auto: 'حسب الوقت', day: 'نهار', evening: 'مساء', night: 'ليل' };
let lightMode = 'auto';
let officeOpen = true;
const phaseOf = (hr) => (hr >= 5 && hr < 8 ? 'morning' : hr >= 8 && hr < 17 ? 'day' : hr >= 17 && hr < 20 ? 'evening' : 'night');
const inWorkHours = () => { const hr = new Date().getHours(); return isWorkDay(state, dayKey()) && hr >= WORK_HOURS[0] && hr < WORK_HOURS[1]; };
function updateDaylight() {
  const now = new Date();
  const phase = lightMode === 'auto' ? phaseOf(now.getHours()) : lightMode;
  office.setDaylight(phase, { lit: officeOpen });
  const el = $('#clock-pill');
  el.hidden = false;
  el.textContent = `${PHASES[phase]} · ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}${officeOpen ? '' : ' · المكتب مغلق'}`;
  $('#office-toggle').textContent = officeOpen ? '🌙' : '🏢';
  $('#office-toggle').title = officeOpen ? 'انصراف الفريق وإغلاق المكتب' : 'فتح المكتب ووصول الفريق';
  $('#light-toggle').title = `الإضاءة: ${LIGHT_MODES[lightMode]}`;
}
// Everyone walks in, those needed right now first; callers wait only for the people they need.
const arrivals = new Map();
const arrived = (ids) => Promise.all(ids.map((id) => arrivals.get(id)));
function openOffice(first = []) {
  if (officeOpen) return Promise.resolve();
  officeOpen = true;
  updateDaylight();
  renderRoster();
  toast('🚶 الفريق يصل إلى المكتب…');
  const order = [...state.employees].sort((a, b) => first.includes(b.id) - first.includes(a.id) || a.desk - b.desk);
  return Promise.all(order.map((e, i) => {
    const p = office.arrive(e.id, i * 160);
    arrivals.set(e.id, p);
    return p;
  }));
}
const teamBusy = () => workdayRunning || Boolean(meeting) || state.employees.some((e) => busy.has(e.id));
async function closeOffice({ auto = false } = {}) {
  if (!officeOpen) return;
  if (teamBusy()) { if (!auto) toast('الفريق مشغول الآن. انتظر حتى ينتهي العمل.'); return; }
  officeOpen = false;
  updateDaylight();
  renderRoster();
  toast('🌙 انصرف الفريق إلى منازلهم. المكتب مغلق حتى تبدأ يوم العمل، ويمكنك مراسلتهم من المنزل.');
  await Promise.all(state.employees.map((e, i) => office.leave(e.id, i * 180)));
}
$('#office-toggle').addEventListener('click', () => (officeOpen ? closeOffice() : openOffice()));
$('#light-toggle').addEventListener('click', () => {
  const keys = Object.keys(LIGHT_MODES);
  lightMode = keys[(keys.indexOf(lightMode) + 1) % keys.length];
  updateDaylight();
  toast(`💡 الإضاءة: ${LIGHT_MODES[lightMode]}`);
});

// A client who comes in: through the front door to a meeting room, with their contact at the agency.
// Employees never join the client in the meeting room on their own: only meetings the owner sets up seat staff there.
const visitorKey = (c) => `v:${c.id}`;
const FEMALE_NAMES = ['نوف', 'ريم', 'لين', 'هيا', 'لمى', 'جود', 'أمل', 'غدير', 'رهف', 'شهد', 'دانة', 'منيرة', 'سارة', 'ليلى'];
const guessGender = (name) => { const n = name.replace(/^(د\.|م\.|أ\.)\s*/, '').trim(); return n.startsWith('أم ') || FEMALE_NAMES.includes(n.split(' ')[0]) || /[ةى]$/.test(n.split(' ')[0]) ? 'f' : 'm'; };
function clientVisit(c) {
  if (!officeOpen || !c || office.whereIs(visitorKey(c))) return null;
  const who = contactOf(c);
  const room = meeting?.room === 'b' ? 'a' : 'b';
  const arrival = office.visitorArrive({ id: visitorKey(c), name: who.name, title: `عميل · ${c.name}`, color: 0x64748b,
    look: lookFor({ id: c.id, name: who.name, gender: guessGender(who.name), level: 7 }) }, room);
  return { c, room, host: null, arrival };
}
async function endVisit(visit) {
  if (!visit) return;
  await visit.arrival;
  office.visitorLeave(visitorKey(visit.c));
  if (!visit.host) return;
  if (office.whereIs(visit.host.id) === visit.room) await office.returnToDesks([visit.host.id]);
  if (visit.host.status === 'meeting') setStatus(visit.host, 'idle');
}

// ---- reports: the morning plan, each manager's end of day, the weekly report
const REPORTS_WORD = ['تقرير واحد', 'تقريران', 'تقارير', 'تقريراً'];
const reportTitle = (r) => `${REPORT_TYPES[r.type]} · ${r.day}${emp(r.by) ? ` · ${emp(r.by).name}` : ''}`;
const showReport = (r) => { r.seen = true; save(); renderApprovalsBadge(); showOutput({ title: reportTitle(r), output: r.text, doneAt: r.at }); };
function upsertReport(type, day, by, text) {
  const old = reportOf(state, type, day, by);
  if (old) Object.assign(old, { text: text.slice(0, 6000), at: Date.now(), seen: false });
  return old || addReport(state, { type, day, by, text }, { newId });
}
const listTasks = (list) => list.map((t) => `- ${emp(t.empId)?.name || '—'}: ${t.title}${t.priority === 'high' ? ' (عالية)' : ''}`).join('\n');

async function morningStandup(today) {
  if (reportOf(state, 'standup', today)) return null;
  const heads = atWork(state.employees.filter((e) => e.level >= MANAGER_LEVEL)).sort(byRank);
  const lead = heads[0];
  if (!lead) return null;
  const prevStatus = lead.status;
  setStatus(lead, 'working', '☀️ يكتب خطة اليوم');
  const todo = state.tasks.filter((t) => t.status === 'todo' && !awayNow(emp(t.empId)));
  const soon = (state.projects || []).filter((p) => p.status === 'active' && p.due && p.due >= today && p.due <= addDays(today, 3));
  const talks = (state.deals || []).filter((d) => d.stage === 'negotiation' || d.stage === 'proposal');
  const away = state.employees.filter(awayNow);
  let text = '';
  try {
    text = await ask(lead, 'report', [{ role: 'user', content: (
      `نوع التقرير: خطة الصباح. في حدود 150 كلمة.\n` +
      `اليوم: ${WEEKDAYS[new Date().getDay()]} ${today}\n` +
      `المهام المنتظرة (${todo.length}):\n${listTasks(todo.slice(0, 25)) || '- لا شيء'}\n` +
      `في إجازة: ${away.map((e) => e.name).join('، ') || 'لا أحد'}\n` +
      `مشاريع تسليمها خلال 3 أيام: ${soon.map((p) => `${p.name} (${p.due})`).join('، ') || 'لا شيء'}\n` +
      `فرص بيع في مرحلة العرض أو التفاوض: ${talks.map((d) => `${d.title} (${fmt(d.value)})`).join('، ') || 'لا شيء'}`).slice(0, 5800) }]);
  } catch (err) {
    toast(err.message);
  }
  setStatus(lead, prevStatus === 'working' ? 'idle' : prevStatus || 'idle');
  if (!text) return null;
  const r = upsertReport('standup', today, lead.id, text);
  save();
  toast(`☀️ ${lead.name}: خطة اليوم جاهزة في التقويم`);
  return r;
}

async function endOfDayReports(today) {
  const doneToday = state.tasks.filter((t) => t.status === 'done' && t.doneAt && dayKey(t.doneAt) === today);
  if (!doneToday.length) return 0;
  const direct = (m) => state.employees.filter((x) => x.managerId === m.id);
  const managers = atWork(state.employees)
    .map((m) => ({ m, done: doneToday.filter((t) => direct(m).some((x) => x.id === t.empId)) }))
    .filter((x) => x.done.length)
    .sort((a, b) => b.done.length - a.done.length || byRank(a.m, b.m))
    .slice(0, 4);
  let n = 0;
  for (const { m, done } of managers) {
    const left = state.tasks.filter((t) => t.status !== 'done' && direct(m).some((x) => x.id === t.empId));
    const prev = m.status;
    setStatus(m, 'working', '📝 تقرير نهاية اليوم');
    try {
      const text = await ask(m, 'report', [{ role: 'user', content: (
        `نوع التقرير: تقرير نهاية اليوم عن فريقك المباشر، ${today}. في حدود 120 كلمة.\n` +
        `ما أنجزه فريقك اليوم:\n${done.map((t) => `- ${emp(t.empId)?.name}: ${t.title}${t.reviews?.length ? (t.reviews[0].decision === 'approve' ? ' (اعتُمد من أول مراجعة)' : ` (اعتُمد بعد ${t.reviews.length - 1} تعديل)`) : ''}`).join('\n')}\n` +
        `المتبقي على فريقك:\n${listTasks(left.slice(0, 15)) || '- لا شيء'}\n` +
        `في إجازة من فريقك: ${direct(m).filter(awayNow).map((e) => e.name).join('، ') || 'لا أحد'}`).slice(0, 5800) }]);
      if (text) { upsertReport('eod', today, m.id, text); n++; }
    } catch (err) {
      toast(err.message);
    } finally {
      setStatus(m, prev === 'working' ? 'idle' : prev || 'idle');
    }
  }
  save();
  return n;
}

async function weeklyReport(today) {
  const ceo = atWork([positionHolder(POSITIONS[0]), topManager(), ...state.employees.filter((e) => e.level >= MANAGER_LEVEL).sort(byRank)].filter(Boolean))[0];
  if (!ceo || busy.has('weekly')) return null;
  busy.add('weekly');
  const from = weekStart(today);
  const st = weeklyStats(state, from, today);
  const live = (state.projects || []).filter((p) => p.status === 'active');
  const prev = ceo.status;
  setStatus(ceo, 'working', '📊 التقرير الأسبوعي');
  let r = null;
  try {
    const text = await ask(ceo, 'report', [{ role: 'user', content: (
      `نوع التقرير: التقرير الأسبوعي إلى المالك عن الأسبوع من ${from} إلى ${today}. في حدود 250 كلمة.\n` +
      `مهام منجزة: ${st.tasksDone}، منها ${st.firstPass} اعتُمدت من أول مراجعة\n` +
      `الأكثر إنجازاً: ${st.top.map((x) => `${emp(x.empId)?.name || '—'} (${x.n})`).join('، ') || 'لا أحد'}\n` +
      `المالية هذا الأسبوع (${state.finance.currency}): إيرادات ${fmt(st.income)}، مصروفات ${fmt(st.expense)}، الرصيد الحالي ${fmt(balance(state))}، مستحقات العملاء ${fmt(receivables(state))}\n` +
      `صفقات فزنا بها: ${st.won.map((d) => `${d.title} (${fmt(d.value)})`).join('، ') || 'لا شيء'}\n` +
      `صفقات خسرناها: ${st.lost.map((d) => `${d.title}${d.lostReason ? ` — ${d.lostReason}` : ''}`).join('، ') || 'لا شيء'}\n` +
      `مسار المبيعات المفتوح: ${pipelineStats(state).open} فرص بقيمة ${fmt(pipelineStats(state).value)}\n` +
      `المشاريع الجارية: ${live.map((p) => `${p.name} (${projectProgress(state, p).pct}%${isLate(p) ? '، متأخر' : ''})`).join('، ') || 'لا شيء'}\n` +
      `تسليمات الأسبوع القادم: ${st.projectsDue.map((p) => `${p.name} (${p.due})`).join('، ') || 'لا شيء'}\n` +
      `الفريق: ${state.employees.length} موظفاً، ${st.workdays} أيام عمل مسجلة بمتوسط حضور ${st.presence}، وأيام إجازة ${st.leaveDays}، واجتماعات ${st.meetings}`).slice(0, 5800) }]);
    if (text) {
      r = upsertReport('weekly', today, ceo.id, text);
      save();
    }
  } catch (err) {
    toast(err.message);
  } finally {
    setStatus(ceo, prev === 'working' ? 'idle' : prev || 'idle');
    busy.delete('weekly');
  }
  return r;
}
$('#btn-workday').addEventListener('click', startWorkday);

function showOutput(t) {
  const e = emp(t.empId);
  $('#out-title').textContent = t.title;
  $('#out-meta').textContent = `${e ? `${e.name} · ${titleFor(e)}` : ''}${t.doneAt ? ` · ${new Date(t.doneAt).toLocaleString('ar')}` : ''}`;
  fill($('#out-body'), richText(t.output || ''));
  if (t.reviews?.length) {
    $('#out-body').append(h('div', { class: 'reviews' },
      h('h4', {}, 'المراجعة'),
      ...t.reviews.map((r) => h('p', {},
        h('b', {}, `${r.decision === 'approve' ? '✅' : '↩️'} ${emp(r.by)?.name || 'المدير'}: `), r.feedback || (r.decision === 'approve' ? 'اعتمد العمل.' : 'طلب تعديلات.')))));
  }
  if (t.status === 'done' && emp(t.empId)) {
    const stars = h('div', { class: 'stars', role: 'radiogroup', 'aria-label': 'تقييمك لهذا العمل' },
      h('span', { class: 'muted' }, 'تقييمك لهذا العمل: '),
      ...[1, 2, 3, 4, 5].map((n) => h('button', {
        class: `star${(t.rating || 0) >= n ? ' on' : ''}`, role: 'radio', 'aria-checked': String(t.rating === n), title: `${n} من 5`,
        onclick: () => { t.rating = n; save(); showOutput(t); refresh(); toast(`قيّمت عمل ${emp(t.empId).name}: ${n} من 5`); },
      }, '★')));
    $('#out-body').prepend(stars);
  }
  $('#out-copy').onclick = () => navigator.clipboard?.writeText(t.output).then(() => toast('تم النسخ'), () => toast('تعذّر النسخ'));
  $('#out-download').hidden = !canDownload();
  $('#out-download').onclick = () => saveFile(t.title, 'md', libraryMd([{ title: t.title, text: t.output || '', at: t.doneAt || Date.now(),
    empId: t.empId, projectId: t.projectId, rating: t.rating }]));
  if (!$('#dlg-output').open) $('#dlg-output').showModal();
}

// ------------------------------------------------------------ files
// In claude.ai the runtime hands the file to the viewer, who confirms the
// save; on the local server an ordinary browser download does the job.
// Every save starts inside the click that asked for it.
let downloads = window.claude?.use ? null : 'local';
window.claude?.use?.('downloads').then((d) => { downloads = d; }, () => {});
const canDownload = () => Boolean(downloads);
const safeName = (s) => String(s).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'ملف';
const MIME = { html: 'text/html', csv: 'text/csv', md: 'text/markdown' };
const DL_ERRORS = {
  declined: 'أُلغي التنزيل.',
  rate_limited: 'هناك طلب تنزيل مفتوح بالفعل، حاول بعد قليل.',
  too_large: 'الملف أكبر من المسموح.',
  rejected_extension: 'صيغة الملف غير مسموحة هنا.',
  extension_not_enabled: 'صيغة الملف غير متاحة في هذا العرض.',
  bad_request: 'تعذّر تجهيز الملف.',
  transform_error: 'تعذّر تجهيز الملف.',
  host_unavailable: 'هذا التطبيق لا يحفظ الملفات. افتح الوكالة من المتصفح أو الحاسوب لتنزيلها.',
};
const KEEP_OFFERING = new Set(['declined', 'rate_limited', 'too_large', 'rejected_extension', 'extension_not_enabled', 'bad_request', 'transform_error']);

function saveFile(name, ext, data) {
  const filename = `${safeName(name)}.${ext}`;
  if (downloads === 'local') {
    const url = URL.createObjectURL(new Blob([data], { type: `${MIME[ext]};charset=utf-8` }));
    const a = h('a', { href: url, download: filename, hidden: true });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast(`⬇️ ${filename}`);
    return;
  }
  if (!downloads) { toast('التنزيل غير متاح في هذا العرض.'); return; }
  downloads.save({ filename, data }).then((r) => {
    if (r?.status === 'saved') toast(`⬇️ حُفظ ${filename}`);
  }, (err) => {
    const code = err?.code;
    toast(DL_ERRORS[code] || 'التنزيل غير متاح في هذا العرض.');
    if (KEEP_OFFERING.has(code)) return;
    // unavailable, host_unavailable or a runtime lifecycle code: stop offering files here
    downloads = null;
    $('#out-download').hidden = true;
    if ($('#dlg-library').open) renderLibrary();
    if ($('#dlg-finance').open) renderFinance();
    if ($('#dlg-clients').open) renderClients();
  });
}
const dlButton = (label, make, cls = 'small') => (canDownload()
  ? h('button', { class: cls, onclick: () => saveFile(...make()) }, label) : null);
const today = () => new Date().toISOString().slice(0, 10);

// ------------------------------------------------------------ works library
const libFilter = { clientId: '', empId: '', kind: '', q: '' };
const WORKS_WORD = ['عمل واحد', 'عملان', 'أعمال', 'عملاً'];
const projectLabel = (id) => { const p = project(id); return p ? { client: clientOf(p)?.name || '—', name: p.name } : null; };
const libraryMd = (items) => itemsMarkdown(items, { nameOf: (id) => emp(id)?.name || '', projectOf: projectLabel, agency: state.company.name });

function openLibrary(preset = {}) {
  Object.assign(libFilter, { clientId: '', empId: '', kind: '', q: '' }, preset);
  fill($('#lib-client'), h('option', { value: '' }, 'كل العملاء'), (state.clients || []).map((c) => h('option', { value: c.id }, c.name)));
  fill($('#lib-emp'), h('option', { value: '' }, 'كل الموظفين'), [...state.employees].sort(byRank).map((e) => h('option', { value: e.id }, e.name)));
  $('#lib-client').value = libFilter.clientId;
  $('#lib-emp').value = libFilter.empId;
  $('#lib-kind').value = libFilter.kind;
  $('#lib-q').value = libFilter.q;
  renderLibrary();
  if (!$('#dlg-library').open) $('#dlg-library').showModal();
}

function libraryCard(it) {
  const plain = it.text.replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '').replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();
  return h('article', { class: 'lib-item' },
    h('h4', {}, it.title),
    h('div', { class: 'muted' }, [emp(it.empId)?.name, new Date(it.at).toLocaleDateString('ar'), it.rating ? '★'.repeat(it.rating) : ''].filter(Boolean).join(' · ')),
    h('p', {}, plain.length > 180 ? `${plain.slice(0, 180)}…` : plain),
    h('div', { class: 'actions' },
      h('button', { class: 'small', onclick: () => (it.kind === 'task'
        ? showOutput(state.tasks.find((t) => t.id === it.id))
        : showOutput({ title: it.title, output: it.text, doneAt: it.at })) }, '👁 عرض'),
      dlButton('⬇️ تنزيل', () => [it.title, 'md', libraryMd([it])])));
}

function renderLibrary() {
  const items = libraryItems(state, libFilter);
  const shown = items.slice(0, 150);
  $('#lib-count').textContent = items.length
    ? `${countOf(items.length, WORKS_WORD)}${items.length > shown.length ? ` · يظهر أحدث ${shown.length}` : ''}` : '';
  $('#lib-download-all').hidden = !canDownload() || !items.length;
  const groups = new Map();
  for (const it of shown) {
    const p = project(it.projectId);
    const key = it.kind === 'meeting' ? 'meetings' : p ? p.id : 'general';
    if (!groups.has(key)) {
      groups.set(key, { title: it.kind === 'meeting' ? '👥 محاضر الاجتماعات' : p ? `${clientOf(p)?.name || '—'} · ${p.name}` : '🗂️ أعمال عامة', items: [] });
    }
    groups.get(key).items.push(it);
  }
  const filtered = libFilter.q || libFilter.clientId || libFilter.empId || libFilter.kind;
  fill($('#lib-list'), items.length
    ? [...groups.values()].map((g) => h('section', { class: 'lib-group' },
      h('h3', {}, g.title, h('span', { class: 'muted' }, ` (${g.items.length})`)),
      h('div', { class: 'lib-items' }, g.items.map(libraryCard))))
    : h('div', { class: 'empty' }, filtered ? 'لا توجد أعمال مطابقة.' : 'لا توجد أعمال منجزة بعد. ابدأ يوم العمل ليُنجز الفريق مهامه.'));
}
$('#btn-library').addEventListener('click', () => openLibrary());
$('#lib-q').addEventListener('input', (ev) => { libFilter.q = ev.target.value.slice(0, 80); renderLibrary(); });
[['#lib-client', 'clientId'], ['#lib-emp', 'empId'], ['#lib-kind', 'kind']].forEach(([sel, key]) =>
  $(sel).addEventListener('change', (ev) => { libFilter[key] = ev.target.value; renderLibrary(); }));
$('#lib-download-all').addEventListener('click', () => {
  const items = libraryItems(state, libFilter);
  if (items.length) saveFile(`مكتبة الأعمال ${today()}`, 'md', libraryMd(items));
});

// ------------------------------------------------------------ calendar
let calMonth = null; // [year, month]
let calDay = null;
function openCalendar() {
  const now = new Date();
  calMonth ||= [now.getFullYear(), now.getMonth()];
  calDay ||= dayKey();
  renderCalendar();
  if (!$('#dlg-calendar').open) $('#dlg-calendar').showModal();
}
function renderCalendar() {
  const [y, m] = calMonth;
  const today = dayKey();
  $('#cal-title').textContent = `📅 ${MONTHS[m]} ${y}`;
  const cell = (key) => {
    if (!key) return h('div', { class: 'cal-cell blank' });
    const ev = dayEvents(state, key);
    const badges = [
      ev.leave.length ? `🌴${ev.leave.length}` : '', ev.due.length ? `📌${ev.due.length}` : '', ev.meetings.length ? `👥${ev.meetings.length}` : '',
      ev.done.length ? `✅${ev.done.length}` : '', ev.reports.length ? `📝${ev.reports.length}` : '',
    ].filter(Boolean);
    return h('button', {
      class: `cal-cell${ev.work ? '' : ' off'}${key === today ? ' today' : ''}${key === calDay ? ' picked' : ''}`,
      title: ev.holiday ? ev.holiday.name : undefined,
      onclick: () => { calDay = key; renderCalendar(); },
    }, h('b', {}, String(Number(key.slice(8)))), ev.holiday ? h('small', { class: 'hol' }, ev.holiday.name) : null, h('small', {}, badges.join(' ')));
  };
  fill($('#cal-grid'),
    WEEKDAYS.map((d) => h('div', { class: 'cal-head' }, d)),
    monthGrid(y, m).flat().map(cell));
  renderCalendarDay();
  fill($('#cal-workdays'), h('span', { class: 'muted' }, 'أيام العمل: '), WEEKDAYS.map((name, i) => h('label', { class: 'check' },
    h('input', { type: 'checkbox', checked: workDays(state).includes(i), onchange: (ev) => {
      const set = new Set(workDays(state));
      if (ev.target.checked) set.add(i); else set.delete(i);
      if (!set.size) { ev.target.checked = true; return toast('يجب أن يبقى يوم عمل واحد على الأقل'); }
      state.calendar = { ...(state.calendar || {}), workDays: [...set].sort(), holidays: state.calendar?.holidays || [] };
      save();
      renderCalendar();
    } }), name)));
}
function renderCalendarDay() {
  const key = calDay;
  const ev = dayEvents(state, key);
  const d = new Date(`${key}T12:00:00`);
  const section = (title, items) => (items.length ? h('div', { class: 'cal-sec' }, h('h4', {}, title), h('ul', {}, items.map((x) => h('li', {}, x)))) : null);
  fill($('#cal-day'),
    h('div', { class: 'row', style: 'justify-content: space-between' },
      h('h3', {}, `${WEEKDAYS[d.getDay()]} ${key}${ev.work ? '' : ev.holiday ? ` · عطلة: ${ev.holiday.name}` : ' · عطلة نهاية الأسبوع'}`),
      ev.holiday
        ? h('button', { class: 'small', onclick: () => { setHoliday(state, key, ''); save(); renderCalendar(); } }, 'إلغاء العطلة')
        : ev.work ? h('button', { class: 'small', onclick: async () => {
          const name = await promptBox(`اسم العطلة في ${key}`, 'مثال: اليوم الوطني');
          if (!name) return;
          try { setHoliday(state, key, name); save(); renderCalendar(); } catch (err) { toast(err.message); }
        } }, '🏖️ اجعله عطلة') : null),
    ev.attendance ? h('p', { class: 'muted' }, `الحضور: ${ev.attendance.present.length}${ev.attendance.leave.length ? ` · في إجازة ${ev.attendance.leave.length}` : ''}`) : null,
    section('📝 التقارير', ev.reports.map((r) => h('button', { class: 'linkish', onclick: () => showReport(r) }, `${REPORT_TYPES[r.type]}${emp(r.by) ? ` — ${emp(r.by).name}` : ''}`))),
    section('📌 تسليمات', ev.due.map((p) => `${p.name} — ${clientOf(p)?.name || ''}${isLate(p) ? ' (متأخر)' : ''}`)),
    section('🌴 إجازات', ev.leave.map((x) => `${x.emp.name} (${LEAVE_TYPES[x.leave.type].name})`)),
    section('👥 اجتماعات', ev.meetings.map((mt) => h('button', { class: 'linkish', onclick: () => showOutput({ title: `محضر: ${mt.topic}`, output: `${mt.summary || ''}\n\n${(mt.log || []).map((l) => `${l.who}: ${l.text}`).join('\n\n')}`, doneAt: mt.at }) }, mt.topic))),
    section('✅ أعمال أُنجزت', ev.done.map((t) => h('button', { class: 'linkish', onclick: () => showOutput(t) }, `${t.title} — ${emp(t.empId)?.name || ''}`))),
    !ev.reports.length && !ev.due.length && !ev.leave.length && !ev.meetings.length && !ev.done.length
      ? h('p', { class: 'empty' }, key > dayKey() ? 'لا شيء مجدول لهذا اليوم.' : 'لم يُسجَّل شيء في هذا اليوم.') : null);
}
$('#btn-calendar').addEventListener('click', openCalendar);
$('#cal-prev').addEventListener('click', () => { const [y, m] = calMonth; calMonth = m ? [y, m - 1] : [y - 1, 11]; renderCalendar(); });
$('#cal-next').addEventListener('click', () => { const [y, m] = calMonth; calMonth = m === 11 ? [y + 1, 0] : [y, m + 1]; renderCalendar(); });
$('#cal-today').addEventListener('click', () => { const n = new Date(); calMonth = [n.getFullYear(), n.getMonth()]; calDay = dayKey(); renderCalendar(); });
$('#cal-weekly').addEventListener('click', async () => {
  $('#cal-weekly').disabled = true;
  const r = await weeklyReport(dayKey());
  $('#cal-weekly').disabled = false;
  if (r) { calDay = r.day; renderCalendar(); showReport(r); }
});

// ------------------------------------------------------------ sales pipeline
const DELIVERY = new Set(['strategy', 'marketing', 'content', 'social', 'ads', 'design', 'seo', 'pr', 'email']);
const salesHead = () => atWork(state.employees.filter((x) => x.dept === 'sales')).sort(byRank)[0] || null;
const clientById = (id) => state.clients?.find((c) => c.id === id) || null;
const DEALS_WORD = ['فرصة واحدة', 'فرصتين', 'فرص', 'فرصة'];
// Who leads delivery on a newly won project: a senior delivery person with the fewest live projects.
function deliveryLead() {
  const live = (id) => (state.projects || []).filter((p) => p.leadId === id && (p.status === 'active' || p.status === 'proposal')).length;
  return atWork(state.employees.filter((e) => DELIVERY.has(e.dept) && e.level >= MANAGER_LEVEL))
    .sort((a, b) => live(a.id) - live(b.id) || byRank(a, b))[0] || topManager() || null;
}
const dealProposal = (d) => (d.projectId && project(d.projectId) ? proposalTask(project(d.projectId)) : null);

function renderPipeline(body) {
  const st = pipelineStats(state);
  const head = salesHead();
  const deals = state.deals || [];
  const closed = deals.filter((d) => !isOpen(d)).sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0)).slice(0, 8);
  fill(body,
    h('div', { class: 'tiles' },
      tile('فرص مفتوحة', String(st.open)),
      tile('قيمة المسار', money(st.value)),
      tile('المتوقع (حسب احتمال كل مرحلة)', money(st.weighted), 'good'),
      tile('نسبة الفوز', st.winRate === null ? '—' : `${st.winRate}% (${st.won} من ${st.won + st.lost})`)),
    h('div', { class: 'row' },
      h('button', { class: 'primary', onclick: () => openDealForm() }, '＋ فرصة جديدة'),
      h('button', { disabled: busy.has('leads') || !head, onclick: findLeads, title: head ? undefined : 'لا يوجد موظف مبيعات في المكتب الآن' },
        busy.has('leads') ? `⏳ ${head?.name || ''} يبحث…` : `🔎 ${head ? `${head.name} يبحث عن عملاء محتملين` : 'ابحث عن عملاء محتملين'}`)),
    h('div', { class: 'pipeline' }, OPEN_STAGES.map((stage) => {
      const list = deals.filter((d) => d.stage === stage).sort((a, b) => b.value - a.value);
      return h('section', { class: 'pipe-col' },
        h('h3', {}, DEAL_STAGES[stage].name, h('span', { class: 'badge' }, String(list.length))),
        h('div', { class: 'muted' }, `${money(list.reduce((s, d) => s + d.value, 0))} · احتمال ${DEAL_STAGES[stage].p}%`),
        list.length ? list.map(dealCard) : h('div', { class: 'empty' }, '—'));
    })),
    closed.length ? h('h3', {}, 'آخر الفرص المغلقة') : null,
    closed.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'fin' },
      h('thead', {}, h('tr', {}, ...['الفرصة', 'العميل', 'النتيجة', 'القيمة', 'السبب', 'التاريخ'].map((x) => h('th', {}, x)))),
      h('tbody', {}, ...closed.map((d) => h('tr', {},
        h('td', {}, d.title), h('td', {}, clientById(d.clientId)?.name || '—'),
        h('td', {}, d.stage === 'won' ? '🎉 فزنا بها' : '✖ خسرناها'), h('td', { class: 'num' }, fmt(d.value)),
        h('td', {}, d.lostReason || '—'), h('td', {}, new Date(d.closedAt || d.updatedAt).toLocaleDateString('ar'))))))) : null);
}

function dealCard(d) {
  const c = clientById(d.clientId);
  const owner = emp(d.ownerId);
  const next = OPEN_STAGES[OPEN_STAGES.indexOf(d.stage) + 1];
  const pt = dealProposal(d);
  const writing = d.projectId && state.tasks.some((t) => t.projectId === d.projectId && t.status !== 'done' && t.title.startsWith('عرض فني ومالي'));
  const since = Math.floor((Date.now() - (d.history?.at(-1)?.at || d.createdAt)) / 86400000);
  const talking = c && busy.has(`client:${c.id}`);
  const late = d.stage === 'proposal' || d.stage === 'negotiation';
  return h('article', { class: 'deal' },
    h('h4', {}, d.title),
    h('div', { class: 'client' }, `${c?.name || '—'} · ${d.type}`),
    h('div', { class: 'money' }, h('b', {}, money(d.value)), h('span', { class: 'muted' }, owner ? `👤 ${owner.name}` : 'بلا مسؤول')),
    d.note ? h('p', { class: 'brief' }, d.note) : null,
    d.counter ? h('p', { class: 'notice' }, `${contactOf(c).name} يقبل بـ${money(d.counter)}`) : null,
    d.lastReply ? h('p', { class: 'brief' }, `💬 «${d.lastReply}»`) : null,
    h('div', { class: 'since' }, since > 0 ? `في هذه المرحلة منذ ${daysWord(since)}` : 'تحرّكت اليوم'),
    h('div', { class: 'actions' },
      next ? h('button', { class: 'small', onclick: () => advanceDeal(d, next) }, `← ${DEAL_STAGES[next].name}`) : null,
      !late ? h('button', { class: 'small', onclick: () => followUp(d) }, '✉️ متابعة') : null,
      d.stage === 'meeting' || (d.stage === 'contact' && d.value > 0)
        ? h('button', { class: 'small', disabled: writing, onclick: () => proposalForDeal(d) }, writing ? '⏳ العرض قيد الكتابة' : '📝 كتابة العرض') : null,
      pt ? h('button', { class: 'small', onclick: () => showOutput(pt) }, '📄 العرض') : null,
      late ? h('button', { class: 'small primary', disabled: talking || writing, onclick: () => sendDealToClient(d) }, talking ? '⏳ ينتظر الرد' : '📨 أرسل للعميل') : null,
      d.counter ? h('button', { class: 'small primary', onclick: () => winDeal(d, d.counter) }, `✅ قبول ${fmt(d.counter)}`) : null,
      late ? h('button', { class: 'small', onclick: () => winDeal(d) }, '🎉 فزنا') : null,
      c ? h('button', { class: 'small', onclick: () => openClientChat(c) }, '💬') : null,
      h('button', { class: 'small', onclick: () => openDealForm(d), title: 'تعديل' }, '✏️'),
      h('button', { class: 'small danger', onclick: () => loseDeal(d), title: 'خسرناها' }, '✖')));
}

function advanceDeal(d, stage) {
  try {
    moveDeal(state, d.id, stage, { newId });
    save();
    renderClients();
  } catch (err) { toast(err.message); }
}

function winDeal(d, value) {
  try {
    const { project: p } = moveDeal(state, d.id, 'won', { newId, value, leadId: deliveryLead()?.id || null, note: value ? `اتفقنا على ${fmt(value)}` : 'فزنا بالفرصة' });
    d.counter = null;
    save();
    refresh();
    renderClients();
    toast(`🎉 فزنا بـ«${d.title}» بقيمة ${money(d.value)}، وبدأ مشروع «${p.name}»${emp(p.leadId) ? ` بقيادة ${emp(p.leadId).name}` : ''}`);
  } catch (err) { toast(err.message); }
}

async function loseDeal(d) {
  const reason = await promptBox(`لماذا خسرنا «${d.title}»؟`, 'مثال: السعر مرتفع، اختار وكالة أخرى، أجّل المشروع');
  if (reason === null) return;
  try {
    moveDeal(state, d.id, 'lost', { newId, note: reason || 'لم يُذكر سبب' });
    save();
    refresh();
    renderClients();
    toast(`أُغلقت «${d.title}» كخسارة`);
  } catch (err) { toast(err.message); }
}

function followUp(d) {
  const owner = emp(d.ownerId) || salesHead();
  if (!owner) return toast('حدد مسؤولاً عن الفرصة أولاً');
  const c = clientById(d.clientId);
  addTask(owner.id, `رسالة متابعة إلى ${c?.name || 'العميل'}`.slice(0, 200),
    `اكتب رسالة متابعة قصيرة ومهنية إلى ${contactOf(c).name} من ${c?.name} بخصوص «${d.title}» (${d.type}، المرحلة: ${DEAL_STAGES[d.stage].name}، القيمة التقديرية ${fmt(d.value)} ${state.finance.currency}). ` +
      `${d.note ? `احتياج العميل: ${d.note}. ` : ''}${c?.notes ? `عن العميل: ${c.notes}. ` : ''}اقترح الخطوة التالية بوضوح: موعد اجتماع أو إرسال عرض.`,
    'medium');
  d.history = [...(d.history || []), { at: Date.now(), stage: d.stage, note: 'رسالة متابعة' }].slice(-20);
  d.updatedAt = Date.now();
  save();
  toast(`📋 كُلّف ${owner.name} بكتابة رسالة متابعة لـ${c?.name || 'العميل'}${awayNow(owner) ? ' (سيكتبها عند عودته من الإجازة)' : ''}`);
}

// The proposal is written as a project at the quote stage, led by whoever will deliver it.
function proposalForDeal(d) {
  const lead = deliveryLead();
  if (!lead) return toast('لا يوجد مدير متاح لكتابة العرض');
  try {
    let p = d.projectId ? project(d.projectId) : null;
    if (!p || p.status === 'cancelled') {
      p = saveProject(state, { clientId: d.clientId, name: d.title, type: d.type, fee: d.value, status: 'proposal', brief: d.note, leadId: lead.id }, { newId });
    }
    linkProposal(state, d.id, p.id);
    save();
    requestProposal(p);
  } catch (err) { toast(err.message); }
}

async function sendDealToClient(d) {
  const c = clientById(d.clientId);
  if (!c || busy.has(`client:${c.id}`)) return;
  const pt = dealProposal(d);
  busy.add(`client:${c.id}`);
  renderClients();
  const visit = clientVisit(c);
  toast(`📨 أُرسل العرض إلى ${contactOf(c).name}…`);
  try {
    const talk = (d.history || []).filter((x) => x.note).slice(-6).map((x) => `- ${DEAL_STAGES[x.stage].name}: ${x.note}`).join('\n');
    const reply = await askClient(c, 'deal_review', [{ role: 'user', content: (
      `عرض من ${state.company.name}: «${d.title}» (${d.type})\nالسعر المعروض: ${d.value} ${state.finance.currency}\n` +
      (d.note ? `ما فهمناه من احتياجك: ${d.note}\n` : '') +
      (pt?.output ? `\nنص العرض:\n${pt.output.slice(0, 3500)}\n` : '\n(لم يُرفق نص عرض مفصّل، فقط الفكرة والسعر.)\n') +
      (talk ? `\nسجل تواصلنا:\n${talk}` : '')).slice(0, 5800) }]);
    const r = parseDealReview(reply);
    if (!r) throw new Error(`لم يصل رد واضح من ${contactOf(c).name}. حاول مرة أخرى.`);
    d.lastReply = r.feedback;
    (state.clientChats[c.id] ||= []).push(
      { role: 'user', content: `أرسلنا لك عرض «${d.title}» بسعر ${fmt(d.value)} ${state.finance.currency}.` },
      { role: 'assistant', content: r.feedback || '—' });
    if (r.decision === 'accept') {
      busy.delete(`client:${c.id}`);
      winDeal(d);
      toast(`🎉 ${contactOf(c).name} قبِل العرض: «${r.feedback}»`);
    } else if (r.decision === 'negotiate') {
      if (d.stage !== 'negotiation') moveDeal(state, d.id, 'negotiation', { newId, note: r.value ? `يطلب ${fmt(r.value)}` : 'يريد التفاوض' });
      d.counter = r.value && r.value !== d.value ? r.value : null;
      toast(`🤝 ${contactOf(c).name} يفاوض${d.counter ? ` على ${money(d.counter)}` : ''}: «${r.feedback}»`);
    } else {
      moveDeal(state, d.id, 'lost', { newId, note: r.feedback || 'رفض العرض' });
      toast(`✖ ${contactOf(c).name} رفض العرض: «${r.feedback}»`);
    }
  } catch (err) {
    toast(err.message);
  } finally {
    busy.delete(`client:${c.id}`);
    endVisit(visit);
    save();
    refresh();
    if ($('#dlg-clients').open) renderClients();
  }
}

async function findLeads() {
  const head = salesHead();
  if (!head || busy.has('leads')) return;
  busy.add('leads');
  renderClients();
  const prev = head.status;
  setStatus(head, 'working', '🔎 يبحث عن عملاء');
  const taken = (state.clients || []).map((c) => c.name);
  let list = null;
  try {
    const reply = await ask(head, 'leads', [{ role: 'user', content: (
      `عن الوكالة: ${state.company.about || state.company.name}\nأنواع المشاريع التي نقدمها: ${PROJECT_TYPES.join('، ')}\n` +
      `عملاؤنا الحاليون، فلا تكررهم: ${taken.join('، ') || 'لا أحد بعد'}`).slice(0, 5800) }]);
    list = parseLeads(reply, { taken });
  } catch (err) {
    toast(err.message);
  } finally {
    setStatus(head, prev === 'working' ? 'idle' : prev || 'idle');
    busy.delete('leads');
  }
  if (!list) list = sampleLeads({ taken, seed: state.nextId });
  let added = 0;
  for (const l of list.leads) {
    try {
      const c = saveClient(state, { name: l.name, industry: l.industry, city: l.city, contact: l.contact, notes: l.notes, status: 'prospect' }, { newId });
      saveDeal(state, { clientId: c.id, title: `${l.type} لـ${l.name}`, type: l.type, value: l.value, ownerId: head.id, note: l.need, source: 'sales' }, { newId });
      added++;
    } catch { /* a cap was reached: keep what was added */ }
  }
  save();
  refresh();
  if ($('#dlg-clients').open) renderClients();
  toast(added ? `💼 ${head.name} أضاف ${countOf(added, DEALS_WORD)} إلى مسار المبيعات${list.note ? `: «${list.note}»` : ''}` : 'لم تُضف فرص جديدة');
}

let editingDeal = null;
function openDealForm(d = null) {
  editingDeal = d?.id || null;
  $('#deal-form').reset();
  $('#deal-form-title').textContent = d ? `تعديل «${d.title}»` : 'فرصة بيع جديدة';
  fill($('#deal-client'), (state.clients || []).map((c) => h('option', { value: c.id }, c.name)), h('option', { value: '__new' }, '＋ عميل جديد…'));
  fill($('#deal-type'), PROJECT_TYPES.map((t) => h('option', { value: t }, t)));
  const people = [...state.employees].sort((a, b) => (b.dept === 'sales') - (a.dept === 'sales') || byRank(a, b));
  fill($('#deal-owner'), h('option', { value: '' }, 'بلا مسؤول'), people.map((e) => h('option', { value: e.id }, `${e.name} — ${titleFor(e)}`)));
  fill($('#deal-stage'), OPEN_STAGES.map((k) => h('option', { value: k }, DEAL_STAGES[k].name)));
  $('#deal-stage-row').hidden = Boolean(d);
  $('#deal-client').value = d?.clientId || (state.clients?.find((c) => c.status === 'prospect')?.id ?? '__new');
  $('#deal-title').value = d?.title || '';
  $('#deal-type').value = d?.type || PROJECT_TYPES[0];
  $('#deal-value').value = d ? String(d.value) : '';
  $('#deal-owner').value = d ? d.ownerId || '' : salesHead()?.id || '';
  $('#deal-note').value = d?.note || '';
  $('#deal-new-client').hidden = $('#deal-client').value !== '__new';
  $('#dlg-deal').showModal();
}
$('#deal-client').addEventListener('change', () => { $('#deal-new-client').hidden = $('#deal-client').value !== '__new'; });
$('#dlg-deal').addEventListener('close', () => {
  if ($('#dlg-deal').returnValue !== 'ok') return;
  try {
    let clientId = $('#deal-client').value;
    if (clientId === '__new') {
      clientId = saveClient(state, { name: $('#deal-client-name').value, industry: $('#deal-client-industry').value, status: 'prospect' }, { newId }).id;
    }
    const d = saveDeal(state, { id: editingDeal || undefined, clientId, title: $('#deal-title').value, type: $('#deal-type').value,
      value: $('#deal-value').value || 0, ownerId: $('#deal-owner').value || null, note: $('#deal-note').value, stage: $('#deal-stage').value }, { newId });
    save();
    refresh();
    crmTab = 'pipeline';
    if ($('#dlg-clients').open) renderClients();
    toast(editingDeal ? 'حُفظت الفرصة' : `💼 أُضيفت «${d.title}» إلى مسار المبيعات`);
  } catch (err) { toast(err.message); }
});

// ------------------------------------------------------------ the HR manager's orders
// Leave is recorded at once; evaluations and hiring rounds start after her reply.
function applyHrOrders(orders, hr) {
  const lines = [];
  const later = [];
  for (const o of orders) {
    const e = emp(o.empId);
    try {
      if (o.kind === 'leave') {
        const l = grantLeave(state, { empId: o.empId, type: o.type, from: o.from, days: o.days, reason: o.reason || `بطلب من المالك عبر ${hr.name}` }, { newId, by: hr.id });
        lines.push(`✅ إجازة ${LEAVE_TYPES[l.type].name} لـ${e.name}: ${daysWord(l.days)} من ${l.from} إلى ${l.to}`);
        sendDm(hr.id, e.id, `سجّلت لك إجازة ${LEAVE_TYPES[l.type].name} ${daysWord(l.days)} من ${l.from} إلى ${l.to}.`, 'hr');
      } else if (o.kind === 'endLeave') {
        const l = upcomingLeaves(state).find((x) => x.empId === o.empId);
        if (!l) throw new Error(`${e.name} ليس في إجازة`);
        const r = endLeave(state, l.id);
        lines.push(r.cancelled ? `✅ أُلغيت إجازة ${e.name}` : `✅ عاد ${e.name} من إجازته اليوم`);
      } else if (o.kind === 'evaluate') {
        const people = o.empIds.map(emp).filter((x) => x && x.id !== hr.id && metricsOf(state, x.id).done > 0);
        const skipped = o.empIds.length - people.length;
        if (!people.length) throw new Error('لا يوجد من لديه أعمال منجزة لتقييمه بعد');
        lines.push(`📝 بدأت تقييم ${people.map((x) => x.name).join('، ')}${skipped ? ` (تُرك ${skipped} بلا أعمال منجزة بعد أو لأنه أنا)` : ''}`);
        later.push(() => evaluateAll({ by: hr, people }));
      } else if (o.kind === 'hire') {
        if (state.hiring) throw new Error('هناك جولة توظيف مفتوحة بالفعل');
        if (!(o.cap > 0)) throw new Error('حدّد لي الحد الأقصى للراتب قبل أن أبدأ');
        const ceo = positionHolder(POSITIONS[0]) || topManager();
        const head = state.employees.filter((x) => x.dept === o.dept).sort(byRank)[0];
        lines.push(`🎤 بدأت البحث عن مرشحين لوظيفة ${titleFor({ dept: o.dept, level: o.level })}، وسأقابلهم وأفاوضهم دون تجاوز ${money(o.cap)}، ثم أرفع لك توصيتي`);
        later.push(() => startHiringRound({ dept: o.dept, level: o.level, managerId: (head && head.level > o.level ? head : ceo)?.id || null, position: '', takeover: false, cap: o.cap, auto: true }));
      } else if (o.kind === 'bonus') {
        if (o.empId === hr.id) throw new Error('لا أقترح مكافأة لنفسي');
        const amount = Math.min(o.amount, Math.round(e.salary * 0.5));
        createBonusRequest(state, { empId: e.id, recommenderId: hr.id, amount, reason: o.reason || `مكافأة اقترحتها ${hr.name}`, newId });
        later.push(() => processBonusQueue());
        lines.push(`💰 اقترحت مكافأة ${money(amount)} لـ${e.name}${amount < o.amount ? ' (خُفّضت إلى نصف راتبه)' : ''}. تمر على المدير المالي ثم المدير التنفيذي، ولا تُصرف إلا باعتمادك`);
      } else if (o.kind === 'train') {
        const options = coursesFor(state, e);
        const words = o.course.split(/\s+/).filter((w) => w.length > 2);
        const course = options.find((c) => c.title === o.course) || options.find((c) => words.some((w) => c.title.includes(w))) || options.find((c) => c.dept === e.dept);
        if (!course) throw new Error(`لا توجد دورة متاحة تناسب ${e.name}`);
        const t = enroll(state, { empId: e.id, courseId: course.id, by: hr.id }, { newId });
        sendDm(hr.id, e.id, `سجّلتك في دورة «${t.title}» (${daysWord(t.days)}، من ${t.from}). بالتوفيق!`, 'hr');
        lines.push(`🎓 سجّلت ${e.name} في دورة «${t.title}» بتكلفة ${money(t.cost)}، والمتبقي من ميزانية التدريب ${money(trainingBudget(state).left)}`);
      } else if (o.kind === 'promise') {
        const p = promisePromotion(state, { empId: e.id, by: hr.id, condition: o.condition, reason: o.reason, toLevel: nextLevel(e.level) }, { newId, maxLevel: STAFF_TOP });
        sendDm(hr.id, e.id, `أعدك بالترقية إلى «${LADDER[p.toLevel].name}»${p.condition ? ` إذا ${p.condition}` : ''}. القرار النهائي للمالك.`, 'hr');
        queueReply(hr, e);
        lines.push(`🤝 وعدت ${e.name} بالترقية إلى «${LADDER[p.toLevel].name}»${p.condition ? ` إذا: ${p.condition}` : ''}. الترقية نفسها قرارك، وتجد الوعد في صندوق الموافقات`);
      }
    } catch (err) {
      lines.push(`❌ ${e ? `${e.name}: ` : ''}${err.message}`);
    }
  }
  if (lines.length) { save(); refresh(); }
  return { note: lines.join('\n'), later };
}

// ------------------------------------------------------------ morale, workload, training
function moraleCard(e) {
  const mo = moraleOf(state, e);
  const r = pendingResignation(state, e.id);
  return h('div', { class: 'card' },
    h('h3', {}, `${mo.mood.icon} المعنويات: ${mo.score} من 100 (${mo.mood.name})`),
    h('div', { class: 'mood-bar' }, h('i', { class: mo.mood.cls, style: `width:${mo.score}%` })),
    mo.factors.length ? h('ul', { class: 'factors' }, mo.factors.map((f) => h('li', { class: f.delta > 0 ? 'plus' : 'minus' }, `${f.delta > 0 ? '+' : ''}${f.delta} ${f.label}`)))
      : h('p', { class: 'muted' }, 'لا شيء يؤثر في معنوياته الآن.'),
    r ? h('p', { class: 'notice' }, `📄 قدّم استقالته. قرارك في صندوق الموافقات.`) : mo.score < RESIGN_BELOW ? h('p', { class: 'notice' }, '⚠️ معنوياته منخفضة جداً، وقد يستقيل قريباً.') : null);
}

function trainingCard(e) {
  const now = activeTraining(state, e.id);
  const done = (state.trainings || []).filter((t) => t.empId === e.id && t.status === 'done');
  return h('div', { class: 'card' },
    h('h3', {}, '🎓 التدريب والتطوير'),
    now ? h('p', {}, `يحضر «${now.title}» حتى ${now.to}`) : null,
    done.length ? h('p', { class: 'muted' }, `أنهى: ${done.map((t) => t.title).join('، ')}`) : h('p', { class: 'muted' }, 'لم يحضر دورات بعد.'),
    h('button', { disabled: Boolean(now) || !coursesFor(state, e).length, onclick: () => openTraining(e) }, '🎓 تسجيل في دورة'));
}

let trainingFor = null;
function openTraining(e) {
  trainingFor = e.id;
  const options = coursesFor(state, e);
  const budget = trainingBudget(state);
  $('#train-title').textContent = `🎓 تسجيل ${e.name} في دورة`;
  fill($('#train-course'), options.map((c) => h('option', { value: c.id, disabled: c.cost > budget.left }, `${c.title} · ${daysWord(c.days)} · ${money(c.cost)}${c.cost > budget.left ? ' (الميزانية لا تكفي)' : ''}`)));
  const update = () => {
    const c = courseById($('#train-course').value);
    $('#train-info').textContent = c ? `تضيف ${c.xp} نقطة خبرة عند انتهائها، وترفع معنوياته، ويطبّق ما تعلمه في عمله. المتبقي من ميزانية التدريب ${money(budget.left)} من ${money(budget.total)}.` : 'لا توجد دورات متاحة.';
    $('#train-ok').disabled = !c || c.cost > budget.left;
  };
  $('#train-course').onchange = update;
  update();
  $('#dlg-train').showModal();
}
$('#dlg-train').addEventListener('close', () => {
  if ($('#dlg-train').returnValue !== 'ok') return;
  const e = emp(trainingFor);
  if (!e) return;
  try {
    const t = enroll(state, { empId: e.id, courseId: $('#train-course').value, by: 'owner' }, { newId });
    const hr = hrHead();
    if (hr && hr.id !== e.id) sendDm(hr.id, e.id, `سجّلتك الإدارة في دورة «${t.title}» من ${t.from} إلى ${t.to}. بالتوفيق!`, 'hr');
    save();
    refresh();
    toast(`🎓 سُجّل ${e.name} في «${t.title}» (${money(t.cost)})`);
  } catch (err) { toast(err.message); }
});

// Once a day: finished courses, and whether someone at the end of their rope resigns.
async function peopleDaily({ force = false } = {}) {
  const today = dayKey();
  if (!force && state.peopleDay === today) return;
  state.peopleDay = today;
  for (const t of completeTrainings(state)) {
    const e = emp(t.empId);
    const hr = hrHead();
    if (e && hr && hr.id !== e.id) sendDm(hr.id, e.id, `مبروك إنهاء دورة «${t.title}»! أُضيفت لك ${t.xp} نقطة خبرة.`, 'hr');
    if (e) toast(`🎓 أنهى ${e.name} دورة «${t.title}»`);
  }
  const candidates = atWork(state.employees).filter((e) => e.level < 8 && !pendingResignation(state, e.id) && !(e.retainedAt && Date.now() - e.retainedAt < 30 * 86400000))
    .map((e) => ({ e, mo: moraleOf(state, e) })).filter((x) => x.mo.score < RESIGN_BELOW).sort((a, b) => a.mo.score - b.mo.score);
  const quitter = candidates.find((x) => Math.random() < resignationRisk(x.mo.score));
  if (quitter) await resign(quitter.e, quitter.mo);
  save();
  refresh();
}

async function resign(e, mo) {
  let letter = '';
  try {
    letter = await ask(e, 'resign', [{ role: 'user', content: `أسبابك: ${mo.factors.filter((f) => f.delta < 0).map((f) => f.label).join('، ') || 'لم تعد مرتاحاً في العمل'}. معنوياتك ${mo.score} من 100.` }]);
  } catch { letter = 'أقدّم استقالتي من الوكالة، فلم أعد مرتاحاً في عملي. شكراً على الفرصة.'; }
  state.resignations ||= [];
  state.resignations.push({ id: newId(state, 'rs'), empId: e.id, at: Date.now(), letter: letter.replace(/\[\[[^\]]*\]\]/g, '').trim().slice(0, 1500), status: 'pending', score: mo.score });
  state.resignations = state.resignations.slice(-30);
  save();
  renderApprovalsBadge();
  toast(`📄 ${e.name} قدّم استقالته. قرارك في صندوق الموافقات.`);
}

let retaining = null;
function openRetain(r) {
  const e = emp(r.empId);
  if (!e) return;
  retaining = r.id;
  const mo = moraleOf(state, e);
  $('#retain-title').textContent = `🤝 محاولة إبقاء ${e.name}`;
  fill($('#retain-why'), h('p', { class: 'notice' }, `«${r.letter}»`),
    h('ul', { class: 'factors' }, mo.factors.map((f) => h('li', { class: f.delta > 0 ? 'plus' : 'minus' }, `${f.delta > 0 ? '+' : ''}${f.delta} ${f.label}`))));
  fill($('#retain-type'), Object.entries(OFFERS).map(([k, o]) => h('option', { value: k }, o.name)));
  const update = () => {
    const type = $('#retain-type').value;
    $('#retain-amount-row').hidden = !OFFERS[type].amount;
    if (OFFERS[type].amount && !$('#retain-amount').dataset.touched) $('#retain-amount').value = String(Math.round(e.salary * (type === 'raise' ? 0.1 : 0.3)));
    $('#retain-hint').textContent = { raise: `راتبه الحالي ${money(e.salary)}.`, bonus: 'تُصرف مع راتب هذا الشهر.', promise: `وعد بالترقية إلى «${nextRung(e)?.name || '—'}»، والترقية نفسها قرارك لاحقاً.`,
      lighten: `تنتقل نصف مهامه المنتظرة إلى زملائه (لديه ${workloadOf(state, e.id).hours} ساعة مفتوحة).`, talk: 'تتحدث معه فقط دون عرض.' }[type];
  };
  $('#retain-amount').oninput = () => { $('#retain-amount').dataset.touched = '1'; };
  delete $('#retain-amount').dataset.touched;
  $('#retain-type').onchange = () => { delete $('#retain-amount').dataset.touched; update(); };
  update();
  $('#dlg-retain').showModal();
}
$('#dlg-retain').addEventListener('close', async () => {
  if ($('#dlg-retain').returnValue !== 'ok') return;
  const r = (state.resignations || []).find((x) => x.id === retaining);
  const e = r && emp(r.empId);
  if (!e || r.status !== 'pending') return;
  const offer = { type: $('#retain-type').value, amount: Number($('#retain-amount').value) || 0 };
  if (OFFERS[offer.type].amount && !(offer.amount > 0)) return toast('حدد المبلغ');
  if (offer.type === 'promise' && !nextRung(e)) return toast(`${e.name} في أعلى مستوى يمكن الترقية إليه`);
  const outcome = retentionOutcome(state, e, offer);
  const what = `${OFFERS[offer.type].name}${OFFERS[offer.type].amount ? ` ${money(offer.amount)}` : ''}`;
  let reply = '';
  try {
    reply = await ask(e, 'retain_reply', [{ role: 'user', content: `استقالتك: «${r.letter}»\nعرض المالك: ${what}.\nالقرار: ${outcome.stays ? 'البقاء' : 'المغادرة'}` }]);
  } catch { reply = outcome.stays ? 'شكراً لك، سأبقى.' : 'أقدّر عرضك، لكني أفضّل المغادرة.'; }
  r.offer = offer;
  r.reply = reply.trim().slice(0, 800);
  r.decidedAt = Date.now();
  if (!outcome.stays) {
    r.status = 'accepted';
    toast(`${e.name}: «${r.reply}»`);
    departEmployee(e, 'resigned');
    return;
  }
  try {
    if (offer.type === 'raise') addAdjustment(state, { empId: e.id, type: 'raise', amount: offer.amount, reason: 'عرض للبقاء بعد الاستقالة', by: 'owner' });
    if (offer.type === 'bonus') addAdjustment(state, { empId: e.id, type: 'bonus', amount: offer.amount, reason: 'عرض للبقاء بعد الاستقالة', by: 'owner' });
    if (offer.type === 'promise') promisePromotion(state, { empId: e.id, by: 'owner', toLevel: nextLevel(e.level), condition: '', reason: 'عرض للبقاء بعد الاستقالة' }, { newId, maxLevel: STAFF_TOP });
    if (offer.type === 'lighten') lightenLoad(e);
  } catch (err) { toast(err.message); }
  r.status = 'retained';
  e.retainedAt = Date.now();
  e.moraleBoost = { amount: outcome.boost, until: Date.now() + 60 * 86400000, reason: `عرض البقاء: ${OFFERS[offer.type].name}` };
  save();
  refresh();
  toast(`🤝 ${e.name} قرر البقاء: «${r.reply}»`);
});

function acceptResignation(r) {
  const e = emp(r.empId);
  if (!e) return;
  r.status = 'accepted';
  r.decidedAt = Date.now();
  departEmployee(e, 'resigned');
}

// Half of someone's waiting tasks go to their least busy teammates.
function lightenLoad(e) {
  const mates = atWork(state.employees.filter((x) => x.id !== e.id && x.managerId && x.managerId === e.managerId));
  if (!mates.length) return 0;
  const waiting = state.tasks.filter((t) => t.empId === e.id && t.status === 'todo').sort((a, b) => ({ low: 0, medium: 1, high: 2 })[a.priority] - ({ low: 0, medium: 1, high: 2 })[b.priority]);
  let moved = 0;
  for (const t of waiting.slice(0, Math.ceil(waiting.length / 2))) {
    const to = [...mates].sort((a, b) => workloadOf(state, a.id).hours - workloadOf(state, b.id).hours)[0];
    t.empId = to.id;
    sendDm(e.managerId, to.id, `نقلت إليك مهمة «${t.title}» من ${e.name} لتخفيف الضغط عليه.`, 'task');
    moved++;
  }
  return moved;
}

function runRebalance(plan) {
  const m = emp(plan.managerId);
  const moved = applyRebalance(state, plan);
  for (const x of moved) {
    sendDm(plan.managerId, x.to, `نقلت إليك مهمة «${x.title}» من ${emp(x.from)?.name} لتوزيع الضغط.`, 'task');
    sendDm(plan.managerId, x.from, `نقلت مهمة «${x.title}» إلى ${emp(x.to)?.name} لتخفيف الضغط عليك.`, 'task');
  }
  toast(moved.length ? `⚖️ ${m?.name || 'المدير'} نقل ${countOf(moved.length, TASKS_WORD)}` : 'تغيّرت المهام منذ الاقتراح، فلم يُنقل شيء');
}

function graduate(e, by) {
  if (e.level !== 0) return;
  changeLevel(e, 1);
  if (by && by.id !== e.id) sendDm(by.id, e.id, `🎉 مبروك! عُيّنت رسمياً بمسمى «${titleFor(e)}» بعد أدائك المتميز في فترة التدريب.`, 'hr');
  e.moraleBoost = { amount: 12, until: Date.now() + 60 * 86400000, reason: 'تعيينه رسمياً' };
}

// ------------------------------------------------------------ leave and attendance
let leaveFor = null;
function openLeave(e) {
  leaveFor = e.id;
  $('#leave-form').reset();
  $('#leave-title').textContent = `🌴 إجازة ${e.name}`;
  fill($('#leave-type'), Object.entries(LEAVE_TYPES).map(([k, t]) => h('option', { value: k }, `إجازة ${t.name}`)));
  $('#leave-from').min = dayKey();
  $('#leave-from').value = dayKey();
  $('#leave-days').max = String(MAX_LEAVE_DAYS);
  const open = state.tasks.filter((t) => t.empId === e.id && t.status === 'todo');
  const others = atWork(state.employees.filter((x) => x.id !== e.id)).sort((a, b) => (b.dept === e.dept) - (a.dept === e.dept) || byRank(a, b));
  fill($('#leave-handover'), h('option', { value: '' }, open.length ? `تبقى معه (${countOf(open.length, TASKS_WORD)})` : 'لا توجد مهام مفتوحة'),
    open.length ? others.map((x) => h('option', { value: x.id }, `تُنقل إلى ${x.name} — ${titleFor(x)}`)) : []);
  $('#leave-handover').disabled = !open.length;
  updateLeavePreview();
  $('#dlg-leave').showModal();
}
function updateLeavePreview() {
  const e = emp(leaveFor);
  if (!e) return;
  const type = $('#leave-type').value;
  const days = Math.floor(Number($('#leave-days').value)) || 0;
  const from = $('#leave-from').value;
  const bal = leaveBalance(state, e.id, type, (from || dayKey()).slice(0, 4));
  const parts = [];
  if (/^\d{4}-\d{2}-\d{2}$/.test(from) && days >= 1 && days <= MAX_LEAVE_DAYS) parts.push(`من ${from} إلى ${addDays(from, days - 1)}، ويعود ${addDays(from, days)}`);
  if (bal.quota !== null) parts.push(`استخدم هذه السنة ${bal.used} من ${bal.quota} يوماً، والمتبقي ${daysWord(bal.left)}`);
  else if (days >= 1) parts.push(`يُخصم ${money(Math.round((e.salary / 30) * days * 100) / 100)} من راتب الشهر المفتوح (أجر يوم عن كل يوم)`);
  $('#leave-preview').textContent = parts.join(' · ');
}
['#leave-type', '#leave-from', '#leave-days'].forEach((sel) => $(sel).addEventListener('input', updateLeavePreview));
$('#dlg-leave').addEventListener('close', () => {
  if ($('#dlg-leave').returnValue !== 'ok') return;
  const e = emp(leaveFor);
  if (!e) return;
  try {
    const l = grantLeave(state, { empId: e.id, type: $('#leave-type').value, from: $('#leave-from').value,
      days: Number($('#leave-days').value), reason: $('#leave-reason').value }, { newId });
    const to = emp($('#leave-handover').value);
    let moved = 0;
    if (to) for (const t of state.tasks) if (t.empId === e.id && t.status === 'todo') { t.empId = to.id; moved++; }
    save();
    refresh();
    if ($('#dlg-performance').open) renderPerformance();
    toast(`🌴 ${e.name}: إجازة ${LEAVE_TYPES[l.type].name} ${daysWord(l.days)} من ${l.from}${moved ? ` · نُقلت ${countOf(moved, TASKS_WORD)} إلى ${to.name}` : ''}`);
  } catch (err) { toast(err.message); }
});
async function bringBack(l) {
  const e = emp(l.empId);
  const upcoming = l.from > dayKey();
  if (!(await confirmBox(upcoming ? `إلغاء إجازة ${e?.name || ''} (${l.from} — ${l.to})؟` : `إنهاء إجازة ${e?.name || ''} اليوم وعودته إلى مكتبه؟`, upcoming ? 'إلغاء الإجازة' : 'إنهاء الإجازة'))) return;
  try {
    const r = endLeave(state, l.id);
    save();
    refresh();
    if ($('#dlg-performance').open) renderPerformance();
    toast(r.cancelled ? `أُلغيت إجازة ${e?.name || ''}` : `👋 عاد ${e?.name || ''} إلى مكتبه`);
  } catch (err) { toast(err.message); }
}
function leaveCard(e) {
  const now = awayNow(e);
  const coming = upcomingLeaves(state).filter((l) => l.empId === e.id);
  const att = attendanceOf(state, e.id);
  const year = dayKey().slice(0, 4);
  return h('div', { class: 'card' },
    h('h3', {}, '🌴 الإجازات والحضور'),
    now ? h('p', { class: 'notice' }, `${awayNote(e)}، ويعود ${addDays(now.to, 1)}.`) : null,
    h('p', { class: 'muted' }, `رصيد ${year}: ` + ['annual', 'sick', 'emergency'].map((k) => {
      const b = leaveBalance(state, e.id, k, year);
      return `${LEAVE_TYPES[k].name} ${b.used} من ${b.quota}`;
    }).join(' · ')),
    h('p', { class: 'muted' }, att.workdays
      ? `آخر 30 يوماً: ${att.workdays} يوم عمل · حضر ${att.present} · إجازة ${att.leave}`
      : 'لم يُسجَّل حضور بعد. يُسجَّل حضور الفريق كلما بدأت يوم العمل.'),
    ...coming.map((l) => h('div', { class: 'row', style: 'justify-content: space-between' },
      h('span', {}, `${LEAVE_TYPES[l.type].name}: ${l.from} ← ${l.to} (${daysWord(l.days)})${l.reason ? ` · ${l.reason}` : ''}`),
      h('button', { class: 'small', onclick: () => bringBack(l) }, l.from > dayKey() ? 'إلغاء' : '↩️ إنهاؤها اليوم'))),
    h('button', { onclick: () => openLeave(e) }, '🌴 منح إجازة'));
}
function renderAttendance() {
  const today = dayKey();
  const rec = state.attendance?.[today];
  const away = state.employees.filter(awayNow);
  const coming = upcomingLeaves(state).filter((l) => l.from > today);
  fill($('#perf-body'),
    h('div', { class: 'tiles' },
      tile('في المكتب اليوم', String(state.employees.length - away.length), 'good'),
      tile('في إجازة اليوم', String(away.length), away.length ? 'bad' : ''),
      tile('إجازات قادمة', String(coming.length)),
      tile('حضور اليوم', rec ? `${rec.present.length} حضروا` : 'لم يبدأ يوم العمل')),
    h('p', { class: 'muted' },
      `الإجازة السنوية ${LEAVE_TYPES.annual.quota} يوماً في السنة، والمرضية حتى ${LEAVE_TYPES.sick.quota}، والاضطرارية ${LEAVE_TYPES.emergency.quota} أيام. ` +
      'الإجازة بدون راتب يُخصم عنها أجر يوم (الراتب ÷ 30) عن كل يوم. من في إجازة لا تُسند إليه مهام ولا يحضر الاجتماعات، ويظهر مكتبه فارغاً، ' +
      'ويراجع أعمال فريقه مديره الأعلى حتى يعود. يُسجَّل الحضور كلما بدأت يوم العمل.'),
    h('div', { class: 'table-wrap' }, h('table', { class: 'fin' },
      h('thead', {}, h('tr', {}, ...['الموظف', 'اليوم', 'أيام العمل (30 يوماً)', 'حضر', 'سنوية', 'مرضية', 'اضطرارية', 'الإجازة القادمة', ''].map((x) => h('th', {}, x)))),
      h('tbody', {}, ...[...state.employees].sort(byRank).map((e) => {
        const a = attendanceOf(state, e.id);
        const now = awayNow(e);
        const next = upcomingLeaves(state).find((l) => l.empId === e.id);
        const bal = (k) => { const b = leaveBalance(state, e.id, k, today.slice(0, 4)); return `${b.used}/${b.quota}`; };
        return h('tr', {},
          h('td', {}, e.name),
          h('td', {}, now ? `🌴 ${LEAVE_TYPES[now.type].name}` : rec?.present.includes(e.id) ? '✅ حاضر' : '—'),
          h('td', { class: 'num' }, String(a.workdays)), h('td', { class: 'num' }, String(a.present)),
          h('td', { class: 'num' }, bal('annual')), h('td', { class: 'num' }, bal('sick')), h('td', { class: 'num' }, bal('emergency')),
          h('td', {}, next ? `${next.from} ← ${next.to}` : '—'),
          h('td', {}, h('div', { class: 'row' },
            h('button', { class: 'small', onclick: () => openLeave(e) }, '🌴 إجازة'),
            next ? h('button', { class: 'small', onclick: () => bringBack(next) }, next.from > today ? 'إلغاء' : '↩️ عودة') : null)));
      })))));
}
document.querySelectorAll('[data-perf]').forEach((b) => b.addEventListener('click', () => { perfTab = b.dataset.perf; renderPerformance(); }));

// ------------------------------------------------------------ hiring through interviews
// The HR manager (or else the role's future manager) shortlists three people; the
// owner interviews them in chat, sets the salary offer and hires one.
const hrHead = () => state.employees.filter((x) => x.dept === 'hr' && x.level >= MANAGER_LEVEL).sort(byRank)[0] || null;
const QUESTIONS_WORD = ['سؤال واحد', 'سؤالان', 'أسئلة', 'سؤالاً'];
let ivActive = null; // the candidate being interviewed

async function startHiringRound(spec) {
  if (state.hiring) { openInterviews(); return; }
  if (busy.has('hiring')) return;
  if (freeSeat(state, spec.level) === undefined) { toast('لا يوجد مكتب شاغر لهذه الوظيفة.'); return; }
  const recruiter = atWork([hrHead(), emp(spec.managerId), topManager()].filter(Boolean))[0] || null;
  const title = titleFor({ dept: spec.dept, level: spec.level });
  const base = defaultSalary(spec.level);
  const years = [0, 1, 3, 5, 7, 9, 12, 16, 20][spec.level] ?? 3;
  const [lo, hi] = salaryRange(base);
  const taken = state.employees.map((e) => e.name);
  busy.add('hiring');
  let list = null;
  if (recruiter) {
    const prev = recruiter.status;
    setStatus(recruiter, 'working', '🔎 يبحث عن مرشحين');
    toast(`🔎 ${recruiter.name} يبحث عن مرشحين لوظيفة ${title}…`);
    try {
      const reply = await ask(recruiter, 'candidates', [{ role: 'user', content:
        `الوظيفة الشاغرة: ${title}\nالقسم: ${DEPARTMENTS[spec.dept].name} (المهارات: ${DEPARTMENTS[spec.dept].skills})\n` +
        `المستوى: ${LADDER[spec.level].name}، وخبرة معتادة نحو ${years} ${years > 10 ? 'سنة' : 'سنوات'}\n` +
        `المدير المباشر: ${emp(spec.managerId)?.name || 'مالك الوكالة'}\n` +
        `نطاق الراتب: من ${lo} إلى ${hi} ${state.finance.currency} شهرياً (المعتاد ${base})\n` +
        `أسماء الموظفين الحاليين، فلا تكررها: ${taken.join('، ')}`.slice(0, 5800) }]);
      list = parseCandidates(reply, { base, years, taken });
    } catch (err) {
      toast(err.message);
    } finally {
      setStatus(recruiter, prev === 'working' ? 'idle' : prev || 'idle');
    }
  }
  if (!list?.candidates.length) list = sampleCandidates({ deptName: DEPARTMENTS[spec.dept].name, years, base, taken, seed: state.nextId });
  busy.delete('hiring');
  const { auto, ...kept } = spec;
  state.hiring = {
    id: newId(state, 'h'), ...kept, title, by: recruiter?.id || null, at: Date.now(), note: list.note || '',
    candidates: list.candidates.map((c, i) => ({ ...c, id: `c${i + 1}`, offer: Math.min(c.salary, spec.cap || c.salary), chat: [] })),
  };
  ivActive = null;
  save();
  refresh();
  if (auto && hrHead()) hrInterviews();
  else openInterviews();
}

function openInterviews() {
  if (!state.hiring) return;
  renderInterviews();
  if (!$('#dlg-interviews').open) $('#dlg-interviews').showModal();
}

function candidatePersona(c, r, interviewer = null) {
  const mgr = emp(r.managerId);
  return {
    manager: interviewer ? `${interviewer.name} (${titleFor(interviewer)})` : '',
    name: c.name, title: r.title, level: LADDER[r.level].name, department: DEPARTMENTS[r.dept].name, skills: DEPARTMENTS[r.dept].skills,
    personality: [c.personality, c.style && `أسلوبك في العمل: ${c.style}`, c.strengths && `نقاط قوتك: ${c.strengths}`, c.weakness && `نقطة ضعفك: ${c.weakness}`]
      .filter(Boolean).join(' ').slice(0, 1100),
    bio: `عمرك ${c.age} سنة، وخبرتك ${c.years} ${c.years > 10 ? 'سنة' : 'سنوات'}. ${c.background}`.slice(0, 1100),
    memory: (`الراتب الذي تطلبه ${c.salary} ${state.finance.currency} شهرياً. المدير المباشر للوظيفة: ${mgr ? `${mgr.name} (${titleFor(mgr)})` : 'مالك الوكالة'}.` +
      (emp(r.by) ? ` رشّحك ${emp(r.by).name} من الوكالة.` : '')).slice(0, 1100),
    duties: 'candidate',
  };
}

function renderInterviews() {
  const r = state.hiring;
  if (!r) return;
  const rec = emp(r.by);
  const [lo] = salaryRange(defaultSalary(r.level));
  $('#iv-title').textContent = `🎤 مقابلات: ${r.title}`;
  $('#iv-sub').textContent = `${DEPARTMENTS[r.dept].name} · المدير المباشر: ${emp(r.managerId)?.name || 'أنت'} · ${rec ? `رشّحهم ${rec.name} (${titleFor(rec)})` : 'قائمة مرشحين جاهزة'}`;
  const hr = hrHead();
  const pickC = r.pick && r.candidates.find((x) => x.id === r.pick.candId);
  fill($('#iv-note'),
    r.note ? h('p', { class: 'notice' }, h('b', {}, `${rec?.name || 'الموارد البشرية'}: `), r.note) : null,
    pickC ? h('p', { class: 'notice' }, h('b', {}, `✅ ${emp(r.pick.by)?.name || 'الموارد البشرية'} توصي بتوظيف ${pickC.name} براتب ${money(r.pick.salary)}: `), r.pick.reason,
      ' ', h('button', { class: 'small primary', onclick: () => hireCandidate(pickC, { salary: r.pick.salary }) }, '✅ اعتماد التوظيف')) : null,
    r.hrNote ? h('p', { class: 'notice' }, r.hrNote) : null);
  fill($('#iv-controls'),
    h('label', {}, 'الحد الأقصى للراتب ', h('input', { type: 'number', min: String(lo), step: 'any', value: r.cap ? String(r.cap) : '', placeholder: 'حدده أنت', style: 'width:130px',
      onchange: (ev) => {
        const v = Math.round(Number(ev.target.value));
        if (!(v > 0)) { ev.target.value = r.cap ? String(r.cap) : ''; return; }
        r.cap = v;
        save();
        toast(`الحد الأقصى للراتب الآن ${money(v)}`);
      } })),
    hr ? h('button', { class: 'primary', disabled: busy.has('ivhr') || awayNow(hr), onclick: hrInterviews },
      busy.has('ivhr') ? `⏳ ${hr.name} تجري المقابلات…` : `🤝 ${hr.name} تقابلهم وتفاوض على الراتب`) : null);
  fill($('#iv-cards'), r.candidates.map((c) => {
    const asked = c.chat.filter((m) => m.role === 'user' && !m.who).length;
    const outcome = c.agreed ? `✅ اتفقنا على ${money(c.agreed)}` : c.declined ? '✖ لم نتفق على الراتب' : '';
    return h('article', { class: `iv-card${ivActive === c.id ? ' active' : ''}` },
      h('div', { class: 'row', style: 'justify-content: space-between' },
        h('h3', {}, c.name), h('span', { class: 'muted' }, `${c.gender === 'f' ? 'أنثى' : 'ذكر'} · ${c.age} سنة · خبرة ${c.years}`)),
      c.background ? h('p', {}, c.background) : null,
      c.style ? h('p', { class: 'muted' }, `الأسلوب: ${c.style}`) : null,
      c.strengths ? h('p', {}, `💪 ${c.strengths}`) : null,
      c.weakness ? h('p', {}, `⚠️ ${c.weakness}`) : null,
      h('p', { class: 'muted' }, `يطلب ${money(c.salary)} · ${asked ? `سألته ${countOf(asked, QUESTIONS_WORD)}` : c.chat.some((m) => m.who) ? `قابلته ${c.chat.find((m) => m.who).who}` : 'لم تقابله بعد'}`),
      outcome ? h('p', {}, h('b', {}, outcome)) : null,
      h('label', {}, 'الراتب المعروض', h('input', {
        type: 'number', min: String(lo), step: 'any', value: String(c.offer), 'aria-label': `الراتب المعروض على ${c.name}`,
        onchange: (ev) => {
          const v = Number(ev.target.value);
          if (!(v >= lo)) { ev.target.value = String(c.offer); toast(`أقل راتب لهذه الوظيفة ${money(lo)}`); return; }
          c.offer = Math.round(v);
          save();
        },
      })),
      h('div', { class: 'actions' },
        h('button', { class: 'small', onclick: () => { ivActive = c.id; renderInterviews(); $('#iv-input').focus(); } }, '💬 مقابلة'),
        h('button', { class: 'small primary', onclick: () => hireCandidate(c) }, '✅ توظيف'),
        r.candidates.length > 1 ? h('button', { class: 'small', onclick: () => dropCandidate(c) }, '✖ استبعاد') : null));
  }));
  const c = r.candidates.find((x) => x.id === ivActive);
  $('#iv-chat').hidden = !c;
  if (!c) return;
  $('#iv-chat-title').textContent = `💬 مقابلة مع ${c.name}`;
  const log = $('#iv-log');
  fill(log,
    c.chat.length ? c.chat.map((m) => h('div', { class: `msg ${m.role}` }, h('span', { class: 'who' }, m.role === 'user' ? m.who || 'أنت' : c.name), richText(m.content)))
      : h('div', { class: 'empty' }, `اسأل ${c.name} عن خبرته، أو كيف يتصرف في موقف من العمل، أو عن الراتب.`),
    busy.has(`iv:${c.id}`) ? h('div', { class: 'msg assistant typing' }, `${c.name} يكتب…`) : null);
  log.scrollTop = log.scrollHeight;
}

$('#iv-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const r = state.hiring;
  const c = r?.candidates.find((x) => x.id === ivActive);
  const text = $('#iv-input').value.trim();
  if (!c || !text || busy.has(`iv:${c.id}`)) return;
  $('#iv-input').value = '';
  c.chat.push({ role: 'user', content: text.slice(0, 2000) });
  busy.add(`iv:${c.id}`);
  renderInterviews();
  try {
    const reply = await askEmployee({ mode: 'chat', persona: candidatePersona(c, r),
      company: { name: state.company.name, about: state.company.about || '' }, messages: c.chat.slice(-20).map(({ role, content }) => ({ role, content })) });
    c.chat.push({ role: 'assistant', content: reply });
  } catch (err) {
    c.chat.pop();
    $('#iv-input').value = text;
    toast(err.message);
  } finally {
    busy.delete(`iv:${c.id}`);
    c.chat = c.chat.slice(-24);
    save();
    if (state.hiring === r) renderInterviews();
  }
});
$('#iv-input').addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && !ev.shiftKey) {
    ev.preventDefault();
    $('#iv-form').requestSubmit();
  }
});

// The HR manager interviews each candidate (two questions), negotiates the
// salary without passing the owner's cap, then recommends one. Hiring waits
// for the owner's approval.
const plainLine = (text) => String(text || '').replace(/^["«]|["»]$/g, '').trim();
async function hrInterviews() {
  const r = state.hiring;
  const hr = hrHead();
  if (!r || !hr || busy.has('ivhr')) return;
  if (awayNow(hr)) return toast(awayNote(hr));
  if (!(r.cap > 0)) return toast('حدّد الحد الأقصى للراتب أولاً');
  busy.add('ivhr');
  r.hrNote = '';
  r.pick = null;
  const cur = state.finance.currency;
  const company = { name: state.company.name, about: state.company.about || '' };
  const rerender = () => { if ($('#dlg-interviews').open) whenIdle('#dlg-interviews', renderInterviews); };
  const prev = hr.status;
  setStatus(hr, 'talking', '🎤 تقابل المرشحين');
  toast(`🎤 ${hr.name} بدأت المقابلات (الحد الأقصى ${money(r.cap)})`);
  rerender();
  const transcript = (c) => c.chat.map((m) => `${m.role === 'user' ? m.who || 'المالك' : c.name}: ${m.content}`).join('\n');
  const candidateSays = async (c, mode) => askEmployee({ mode, persona: candidatePersona(c, r, hr), company,
    messages: c.chat.slice(-20).map(({ role, content }) => ({ role, content })) });
  try {
    for (const c of r.candidates) {
      if (state.hiring !== r) return;
      if (c.agreed || c.declined) continue;
      ivActive = c.id;
      for (let q = 0; q < 2; q++) {
        const question = await ask(hr, 'interview', [{ role: 'user', content: (
          `المرشح: ${c.name}، ${c.age} سنة، خبرة ${c.years}. ${c.background}\nالوظيفة: ${r.title}\n` +
          (c.chat.length ? `المقابلة حتى الآن:\n${transcript(c)}` : 'لم تبدأ المقابلة بعد.')).slice(0, 5800) }]);
        c.chat.push({ role: 'user', content: plainLine(question).slice(0, 600) || 'حدثني عن خبرتك.', who: hr.name });
        rerender();
        c.chat.push({ role: 'assistant', content: await candidateSays(c, 'chat') });
        save();
        rerender();
      }
      c.offers = [];
      let step = nextOffer({ asking: c.salary, cap: r.cap });
      for (let i = 0; i < 3 && step?.offer; i++) {
        c.offers.push(step.offer);
        c.chat.push({ role: 'user', who: hr.name, content: `العرض: ${step.offer} ${cur} شهرياً${step.final ? '، وهو أقصى ما نستطيعه' : ''}.` });
        rerender();
        const ans = parseOfferReply(await candidateSays(c, 'offer_reply')) || { decision: 'counter', value: c.salary, reply: '' };
        c.chat.push({ role: 'assistant', content: ans.reply || (ans.decision === 'accept' ? 'أقبل العرض.' : ans.decision === 'reject' ? 'أعتذر، العرض لا يناسبني.' : `أطلب ${ans.value} ${cur}.`) });
        step = nextOffer({ asking: c.salary, cap: r.cap, offers: c.offers, answer: ans });
        if (step?.agreed) {
          c.agreed = step.agreed;
          c.offer = step.agreed;
          c.chat.push({ role: 'user', who: hr.name, content: `اتفقنا على ${step.agreed} ${cur} شهرياً. سأرفع توصيتي للمالك، والقرار النهائي له.` });
        }
        if (step?.failed) c.declined = true;
        save();
        rerender();
      }
    }
    if (state.hiring !== r) return;
    const agreed = r.candidates.filter((c) => c.agreed);
    if (!agreed.length) {
      r.hrNote = `${hr.name}: لم نتفق مع أي مرشح ضمن الحد الأقصى (${money(r.cap)}). ارفع الحد ثم أعد المقابلات، أو ألغِ الجولة.`;
      toast(r.hrNote);
      return;
    }
    let pick = null;
    try {
      pick = parsePick(await ask(hr, 'hire_pick', [{ role: 'user', content: (`الوظيفة: ${r.title}. الحد الأقصى للراتب: ${r.cap} ${cur}.\n\n` +
        r.candidates.map((c) => `المرشح: ${c.name} (${c.age} سنة، خبرة ${c.years})\n${c.agreed ? `اتفقنا على ${c.agreed} ${cur}` : 'لم نتفق على الراتب'}\n${transcript(c).slice(0, 1400)}`).join('\n\n')).slice(0, 5800) }]), r.candidates);
    } catch (err) {
      toast(err.message);
    }
    if (!pick) {
      const best = [...agreed].sort((a, b) => b.years - a.years || a.agreed - b.agreed)[0];
      pick = { candId: best.id, reason: 'اتفقنا معه على راتب ضمن الحد، وخبرته الأعلى بين من اتفقنا معهم.' };
    }
    r.pick = { ...pick, salary: r.candidates.find((c) => c.id === pick.candId).agreed, by: hr.id, at: Date.now() };
    toast(`🎤 ${hr.name} أنهت المقابلات وتوصي بتوظيف ${r.candidates.find((c) => c.id === pick.candId).name} براتب ${money(r.pick.salary)}. القرار لك في صندوق الموافقات.`);
  } catch (err) {
    toast(err.message);
  } finally {
    busy.delete('ivhr');
    setStatus(hr, prev === 'talking' ? 'idle' : prev || 'idle');
    save();
    refresh();
    rerender();
  }
}

async function hireCandidate(c, { salary = null, confirm = true } = {}) {
  const r = state.hiring;
  if (salary) c.offer = salary;
  if (!r || (confirm && !(await confirmBox(`توظيف ${c.name} بمسمى «${r.title}» براتب ${money(c.offer)} شهرياً؟`, 'توظيف')))) return;
  const e = hireEmployee({
    name: c.name, gender: c.gender, dept: r.dept, level: r.level, managerId: emp(r.managerId) ? r.managerId : null,
    salary: c.offer, personality: c.personality || c.style || '',
    bio: { age: c.age, years: c.years, background: c.background || 'انضم إلى الوكالة بعد مقابلة مع المالك.', style: c.style || 'مهني وواضح.' },
    takeover: r.takeover ? state.employees.filter((x) => (x.managerId || null) === (r.managerId || null)) : [],
  });
  if (!e) return;
  // The interview is where they first met: it stays in their chat history.
  if (c.chat.length) state.chats[e.id] = c.chat.map((m) => ({ role: m.role, content: m.who ? `${m.who}: ${m.content}` : m.content }));
  state.hiring = null;
  ivActive = null;
  $('#dlg-interviews').close();
  save();
  refresh();
  selectEmployee(e.id);
  toast(`👋 انضم ${e.name} إلى الفريق بعد المقابلة!`);
}

function dropCandidate(c) {
  const r = state.hiring;
  if (!r) return;
  r.candidates = r.candidates.filter((x) => x !== c);
  if (ivActive === c.id) ivActive = null;
  save();
  renderInterviews();
  toast(`استُبعد ${c.name}`);
}

$('#iv-cancel').addEventListener('click', async () => {
  if (!state.hiring || !(await confirmBox('إلغاء جولة التوظيف واستبعاد كل المرشحين؟', 'إلغاء الجولة'))) return;
  state.hiring = null;
  ivActive = null;
  $('#dlg-interviews').close();
  save();
  refresh();
  toast('أُلغيت جولة التوظيف');
});

// ------------------------------------------------------------ invoices and statements
const isClientPayment = (l) => l.type === 'income' && (l.projectId || l.category === 'دفعة عميل');
const invoiceButton = (l, label = '🧾 فاتورة') => dlButton(label, () => [`فاتورة ${invoiceNumber(l)}`, 'html', invoiceHtml(state, l)]);
const statementButton = (c, label = '📄 كشف حساب') => dlButton(label, () => [`كشف حساب ${c.name} ${today()}`, 'html', statementHtml(state, c.id)]);

// ---- messages between employees: a manager's orders and tasks, and the replies
const threadKey = (a, b) => [a, b].sort().join('__');
const threadOf = (a, b) => state.dms?.[threadKey(a, b)] || [];
function sendDm(fromId, toId, text, kind = 'note') {
  if (!fromId || !toId || fromId === toId || !text) return null;
  state.dms ||= {};
  const k = threadKey(fromId, toId);
  const m = { from: fromId, to: toId, text: String(text).trim().slice(0, 1500), at: Date.now(), kind };
  state.dms[k] = [...(state.dms[k] || []), m].slice(-40);
  const from = emp(fromId);
  if (from?.status === 'idle') {
    office.setStatus(fromId, 'idle', `💬 ← ${emp(toId)?.name || ''}`);
    setTimeout(() => emp(fromId)?.status === 'idle' && office.setStatus(fromId, 'idle'), 4000);
  }
  if (selectedId === toId || selectedId === fromId) whenIdle('#panel', renderPanel);
  return m;
}
// The recipient answers in their own voice; someone on leave sends an automatic note.
const replyQueue = [];
let replying = false;
function queueReply(from, to) { replyQueue.push([from.id, to.id]); drainReplies(); }
async function drainReplies() {
  if (replying) return;
  replying = true;
  while (replyQueue.length) {
    const [fromId, toId] = replyQueue.shift();
    const from = emp(fromId);
    const to = emp(toId);
    if (!from || !to) continue;
    if (awayNow(to)) { sendDm(to.id, from.id, `رد تلقائي: أنا في إجازة حتى ${awayNow(to).to}، وسأتابع عند عودتي.`, 'auto'); continue; }
    const thread = threadOf(from.id, to.id).slice(-12);
    try {
      const reply = await ask(to, 'dm', [{ role: 'user', content: (
        `${thread.map((m) => `${emp(m.from)?.name || '—'}: ${m.text}`).join('\n')}\n\n` +
        `آخر رسالة وصلتك من ${from.name} (${titleFor(from)}). اكتب ردك عليه.`).slice(0, 5800) }]);
      sendDm(to.id, from.id, reply.replace(/\[\[[^\]]*\]\]/g, '').trim() || 'حاضر.', 'reply');
      save();
    } catch (err) {
      sendDm(to.id, from.id, 'حاضر، وصلتني رسالتك.', 'auto');
    }
  }
  replying = false;
}

let openThreads = new Set();
function renderTeamTalk(e) {
  const threads = Object.entries(state.dms || {}).filter(([k]) => k.split('__').includes(e.id))
    .map(([k, list]) => ({ other: emp(k.split('__').find((id) => id !== e.id)), list }))
    .filter((t) => t.other && t.list.length)
    .sort((a, b) => b.list.at(-1).at - a.list.at(-1).at);
  fill($('#team-pane'),
    h('p', { class: 'muted' }, `رسائل ${e.name} مع زملائه: أوامر المدراء وتكليفاتهم، والردود عليها، وإشعارات الموارد البشرية والإدارة.`),
    threads.length ? threads.map(({ other, list }) => {
      const k = threadKey(e.id, other.id);
      const shown = openThreads.has(k) ? list : list.slice(-6);
      return h('div', { class: 'dm-thread' },
        h('h4', {}, h('span', {}, `مع ${other.name}`), h('small', { class: 'muted' }, titleFor(other))),
        list.length > shown.length ? h('button', { class: 'linkish', onclick: () => { openThreads.add(k); renderPanel(); } }, `عرض كل الرسائل (${list.length})`) : null,
        shown.map((m) => h('div', { class: `dm ${m.from === e.id ? 'mine' : 'theirs'}` },
          h('small', {}, `${emp(m.from)?.name || '—'} · ${new Date(m.at).toLocaleString('ar', { dateStyle: 'short', timeStyle: 'short' })}`),
          richText(m.text))));
    }) : h('div', { class: 'empty' }, 'لا توجد رسائل مع الزملاء بعد. تظهر هنا رسائل المدير عند التكليف بالمهام أو الأوامر، وردود الموظف عليها.'));
}

// ---- profile, promotion, termination
function renderProfile(e) {
  const level = LADDER[e.level];
  const next = nextRung(e);
  const pct = next ? Math.min(100, Math.round(((e.xp - level.xp) / (next.xp - level.xp)) * 100)) : 100;
  const eligible = next && e.xp >= next.xp;
  const mgr = e.managerId ? emp(e.managerId) : null;
  const reports = state.employees.filter((x) => x.managerId === e.id);
  const done = state.tasks.filter((t) => t.empId === e.id && t.status === 'done').length;

  const titleInput = h('input', { maxlength: 60, placeholder: titleFor({ ...e, customTitle: '' }), value: e.customTitle || '' });
  const skillsInput = h('textarea', { rows: 3, maxlength: 1000, placeholder: skillsFor({ ...e, skills: '' }) }, e.skills || '');
  const mgrSelect = h('select', {},
    h('option', { value: '' }, 'مالك الوكالة مباشرة'),
    state.employees.filter((x) => x.id !== e.id && !isUnder(x.id, e.id))
      .map((x) => h('option', { value: x.id, selected: x.id === e.managerId }, `${x.name} — ${titleFor(x)}`)));

  fill($('#profile-pane'), 
    h('div', { class: 'card' },
      h('dl', { class: 'kv' },
        h('dt', {}, 'المسمى'), h('dd', {}, titleFor(e)),
        h('dt', {}, 'القسم'), h('dd', {}, DEPARTMENTS[e.dept].name),
        h('dt', {}, 'المستوى'), h('dd', {}, `${activeLevels().findIndex((l) => l.i === e.level) + 1} / ${activeLevels().length} — ${level.name}`),
        h('dt', {}, 'المدير'), h('dd', {}, mgr ? mgr.name : 'مالك الوكالة'),
        h('dt', {}, 'المرؤوسون'), h('dd', {}, reports.length ? reports.map((r) => r.name).join('، ') : '—'),
        h('dt', {}, 'مهام منجزة'), h('dd', {}, String(done)),
        h('dt', {}, 'المهارات'), h('dd', {}, skillsFor(e)),
        h('dt', {}, 'العمر'), h('dd', {}, `${bioFor(e).age} سنة · خبرة ${bioFor(e).years} ${bioFor(e).years > 10 ? 'سنة' : 'سنوات'}`),
        h('dt', {}, 'الخلفية'), h('dd', {}, bioFor(e).background),
        h('dt', {}, 'أسلوبه'), h('dd', {}, bioFor(e).style))),
    performanceCard(e),
    moraleCard(e),
    trainingCard(e),
    leaveCard(e),
    h('div', { class: 'card' },
      h('h3', {}, 'التقدم الوظيفي'),
      h('div', { class: 'progress' }, h('i', { style: `width:${pct}%` })),
      h('p', { class: 'muted' }, next
        ? `${e.xp} نقطة خبرة · الترقية إلى "${next.name}" عند ${next.xp} نقطة${eligible ? ' — ✅ مستحق للترقية' : ''}`
        : `${e.xp} نقطة خبرة · وصل إلى قمة السلم الوظيفي`),
      openPromise(state, e.id) ? h('p', { class: 'notice' }, `🤝 وعد بالترقية إلى «${LADDER[openPromise(state, e.id).toLevel]?.name}» من ${emp(openPromise(state, e.id).by)?.name || 'الموارد البشرية'}${openPromise(state, e.id).condition ? ` · الشرط: ${openPromise(state, e.id).condition}` : ''}`) : null,
      h('div', { class: 'row' },
        h('button', { class: eligible ? 'primary' : '', disabled: !next, onclick: () => changeLevel(e, 1) }, '⬆️ ترقية'),
        h('button', { disabled: e.level === 0, onclick: () => changeLevel(e, -1) }, '⬇️ تخفيض'))),
    h('div', { class: 'card' },
      h('h3', {}, 'تعديل'),
      h('label', {}, 'مسمى وظيفي مخصص (اتركه فارغاً للمسمى التلقائي)', titleInput),
      h('label', {}, 'المدير المباشر', mgrSelect),
      h('label', {}, 'المهارات (اتركها فارغة للمهارات التلقائية حسب القسم والمستوى)', skillsInput),
      h('button', { onclick: () => {
        e.customTitle = titleInput.value.trim();
        e.managerId = mgrSelect.value || null;
        e.skills = skillsInput.value.trim().slice(0, 1000);
        save();
        refresh();
        toast('تم حفظ التعديلات');
      } }, 'حفظ')),
    done ? h('button', { onclick: () => openLibrary({ empId: e.id }) }, `📚 أعمال ${e.name} (${done})`) : null,
    reports.length ? h('button', { class: 'primary', disabled: busy.has(`assign:${e.id}`), onclick: () => assignTeamTasks(e) },
      `📋 كلّف فريقك بمهام (${teamOf(e.id).length})`) : null,
    h('button', { class: 'danger', onclick: () => fire(e) }, 'إنهاء خدمة الموظف'));
}

function isUnder(id, bossId) {
  let cur = emp(id);
  const seen = new Set();
  while (cur?.managerId && !seen.has(cur.id)) {
    if (cur.managerId === bossId) return true;
    seen.add(cur.id);
    cur = emp(cur.managerId);
  }
  return false;
}

function changeLevel(e, delta) {
  const to = delta === 1 ? nextLevel(e.level) : delta === -1 ? prevLevel(e.level) : e.level + delta;
  if (to === null || to < 0 || to >= LADDER.length || LADDER[to].retired) return toast(delta > 0 ? `${e.name} في أعلى السلم الوظيفي المتاح` : 'لا يوجد مستوى أدنى');
  e.level = to;
  if (delta > 0 && e.xp < LADDER[to].xp) e.xp = LADDER[to].xp;
  const promise = openPromise(state, e.id);
  if (promise && delta > 0 && to >= promise.toLevel) closePromise(state, promise.id, 'kept');
  // A promotion lifts the salary to at least the new level's starting pay.
  if (delta > 0 && state.finance && e.salary < defaultSalary(to)) {
    addAdjustment(state, { empId: e.id, type: 'raise', amount: defaultSalary(to) - e.salary, reason: `ترقية إلى ${LADDER[to].name}`, by: 'owner' });
  }
  // Becoming a manager moves you into a private office if one is free;
  // dropping below manager moves you back to the open area if a desk is free.
  let moved = '';
  if (!busy.has(e.id) && !meeting?.attendees.includes(e.id)) {
    const seat = to >= MANAGER_LEVEL && !isPrivateOffice(e.desk) ? freeSeat(state, to, { officeOnly: true })
      : to < MANAGER_LEVEL && isPrivateOffice(e.desk) ? freeSeat(state, to, { openOnly: true }) : undefined;
    if (seat !== undefined) {
      reseat(e, seat);
      moved = isPrivateOffice(seat) ? ' وانتقل إلى مكتب خاص' : ' وعاد إلى المساحة المفتوحة';
    } else {
      reseat(e, e.desk); // same seat, new clothes for the new rank
    }
  }
  save();
  refresh();
  toast((delta > 0 ? `🎉 تمت ترقية ${e.name} إلى "${titleFor(e)}"` : `تم تعديل مستوى ${e.name} إلى "${titleFor(e)}"`) + moved);
}

function reseat(e, desk) {
  office.removeEmployee(e.id);
  office.setDeskLit(e.desk, false);
  e.desk = desk;
  office.addEmployee(actorOf(e), titleFor(e));
  if (selectedId === e.id) office.setSelected(e.id);
}

async function fire(e) {
  if (busy.has(e.id) || meeting?.attendees.includes(e.id)) return toast('لا يمكن إنهاء الخدمة أثناء العمل أو الاجتماع');
  if (!(await confirmBox(`هل تريد إنهاء خدمة ${e.name}؟ ستنتقل مهامه غير المكتملة إلى مديره.`, 'إنهاء الخدمة'))) return;
  departEmployee(e, 'fired');
}
// Someone leaves (let go or resigned): open work goes to their manager, their reports move up.
function departEmployee(e, why) {
  for (const t of state.tasks) {
    if (t.empId === e.id && t.status !== 'done') {
      if (e.managerId) t.empId = e.managerId;
      else t.deleted = true;
    }
  }
  state.tasks = state.tasks.filter((t) => !t.deleted);
  for (const x of state.employees) if (x.managerId === e.id) x.managerId = e.managerId;
  for (const p of state.projects || []) {
    p.team = p.team.filter((id) => id !== e.id);
    if (p.leadId === e.id) p.leadId = e.managerId || null;
  }
  state.employees = state.employees.filter((x) => x.id !== e.id);
  delete state.chats[e.id];
  office.removeEmployee(e.id);
  office.setDeskLit(e.desk, false);
  save();
  closePanel();
  refresh();
  toast(why === 'resigned' ? `👋 غادر ${e.name} الوكالة بعد استقالته، وانتقلت مهامه إلى مديره` : `تم إنهاء خدمة ${e.name}`);
}

// ------------------------------------------------------------ hiring
function fillHireForm() {
  delete $('#hire-salary').dataset.touched;
  const used = new Set(state.employees.map((x) => x.desk));
  const freeOpen = [...Array(OPEN_DESKS).keys()].filter((d) => !used.has(d)).length;
  const freeOffices = [...Array(PRIVATE_OFFICES).keys()].filter((k) => !used.has(OPEN_DESKS + k)).length;
  $('#hire-capacity').textContent = freeOpen + freeOffices > 0
    ? `شاغر: ${freeOpen} مكتب في المساحة المفتوحة، و${freeOffices} مكتب خاص للمدراء`
    : 'لا توجد مكاتب شاغرة.';
  $('#hire-submit').disabled = freeOpen + freeOffices <= 0;
  fill($('#hire-dept'), ...Object.entries(DEPARTMENTS).map(([k, d]) => h('option', { value: k }, d.name)));
  fill($('#hire-level'), ...activeLevels().map((l) => h('option', { value: l.i, selected: l.i === 1 }, l.name)));
  fill($('#hire-manager'), h('option', { value: '' }, 'مالك الوكالة مباشرة'),
    ...[...state.employees].sort(byRank).map((x, i) => h('option', { value: x.id, selected: i === 0 }, `${x.name} — ${titleFor(x)}`)));
  $('#hire-takeover-row').hidden = true;
  fill($('#hire-position'), h('option', { value: '' }, 'منصب مخصص (اختر القسم والمستوى)'),
    ...POSITIONS.map((p) => {
      const holder = p.unique && positionHolder(p);
      return h('option', { value: p.key, disabled: Boolean(holder) }, holder ? `${p.name} (${holder.gender === 'f' ? 'تشغله' : 'يشغله'} ${holder.name})` : p.name);
    }));
  updateHirePreview();
  $('#hire-interview').textContent = state.hiring ? '🎤 جولة المقابلات المفتوحة' : '🎤 مقابلات: رشّحوا لي 3 مرشحين';
  $('#hire-interview').disabled = busy.has('hiring');
}
const positionHolder = (p) => state.employees.find((x) => x.dept === p.dept && x.level === p.level && !x.customTitle);
$('#hire-position').addEventListener('change', () => {
  const p = POSITIONS.find((x) => x.key === $('#hire-position').value);
  if (!p) return;
  $('#hire-dept').value = p.dept;
  $('#hire-level').value = String(p.level);
  // Report to the next post up: CEO to the owner, GM to the CEO, department heads to the GM or CEO.
  const ceo = positionHolder(POSITIONS[0]);
  const top = [...state.employees].sort(byRank)[0];
  const boss = p.key === 'ceo' ? null : ceo || top;
  $('#hire-manager').value = boss ? boss.id : '';
  updateHirePreview();
});
// Who would move under a newly hired CEO or GM: everyone currently reporting
// to the same boss the new hire reports to (the owner, or the CEO for a GM).
function takeoverCandidates() {
  const pos = $('#hire-position').value;
  if (pos !== 'ceo') return [];
  const boss = $('#hire-manager').value || null;
  return state.employees.filter((x) => (x.managerId || null) === boss);
}
function updateTakeover() {
  const list = takeoverCandidates();
  $('#hire-takeover-row').hidden = !list.length;
  $('#hire-takeover-text').textContent = `اجعل ${list.map((x) => x.name).join('، ')} تحت إدارته`;
}
['#hire-position', '#hire-manager'].forEach((s) => $(s).addEventListener('change', updateTakeover));
function updateHirePreview() {
  const preview = { dept: $('#hire-dept').value, level: Number($('#hire-level').value) };
  $('#hire-preview').textContent = `المسمى الوظيفي: ${titleFor(preview)}`;
  if (!$('#hire-salary').dataset.touched) $('#hire-salary').value = defaultSalary(preview.level);
}
$('#hire-salary').addEventListener('input', () => { $('#hire-salary').dataset.touched = '1'; });
['#hire-dept', '#hire-level'].forEach((s) => $(s).addEventListener('change', () => {
  $('#hire-position').value = '';
  updateHirePreview();
}));
$('#btn-hire').addEventListener('click', () => { fillHireForm(); $('#dlg-hire').showModal(); });
function hireEmployee({ name, gender, dept, level, managerId, salary, personality = '', bio = null, takeover = [] }) {
  const desk = freeSeat(state, level);
  if (desk === undefined) {
    toast(level >= MANAGER_LEVEL ? 'لا يوجد مكتب شاغر.' : 'لا يوجد مكتب شاغر في المساحة المفتوحة.');
    return null;
  }
  const e = {
    id: newId(state, 'e'), name, gender, dept, level, xp: LADDER[level].xp, personality,
    salary: salary > 0 ? Math.round(salary) : defaultSalary(level),
    desk, managerId: managerId || null, hiredAt: Date.now(), status: 'idle', ...(bio ? { bio } : {}),
  };
  state.employees.push(e);
  for (const x of takeover) x.managerId = e.id;
  office.addEmployee(actorOf(e), titleFor(e));
  if (!officeOpen) office.setHome(e.id, true);
  return e;
}
$('#dlg-hire').addEventListener('close', () => {
  const choice = $('#dlg-hire').returnValue;
  if (choice === 'interview') {
    const level = Number($('#hire-level').value);
    const cap = Math.round(Number($('#hire-cap').value));
    if (!state.hiring && !(cap > 0)) {
      toast('حدّد الحد الأقصى للراتب أولاً: لن تتجاوزه الموارد البشرية في التفاوض.');
      $('#dlg-hire').showModal();
      $('#hire-cap').focus();
      return;
    }
    const spec = { dept: $('#hire-dept').value, level, managerId: $('#hire-manager').value || null, position: $('#hire-position').value || '',
      takeover: $('#hire-takeover').checked && takeoverCandidates().length > 0, cap };
    $('#hire-form').reset();
    $('#hire-takeover-row').hidden = true;
    startHiringRound(spec);
    return;
  }
  if (choice !== 'ok') return;
  const name = $('#hire-name').value.trim();
  if (!name) return;
  const e = hireEmployee({
    name, gender: $('#hire-gender').value, dept: $('#hire-dept').value, level: Number($('#hire-level').value),
    managerId: $('#hire-manager').value || null, salary: Number($('#hire-salary').value), personality: $('#hire-personality').value.trim(),
    takeover: $('#hire-takeover').checked ? takeoverCandidates() : [],
  });
  if (!e) return;
  save();
  $('#hire-form').reset();
  $('#hire-takeover-row').hidden = true;
  refresh();
  selectEmployee(e.id);
  toast(`👋 مرحباً بـ${e.name} في الفريق!`);
});

// ------------------------------------------------------------ task board
function renderBoard() {
  const filter = $('#board-filter').value;
  const pf = $('#board-project').value;
  const tasks = state.tasks.filter((t) => (!filter || t.empId === filter) && (!pf || t.projectId === pf));
  const cols = ['todo', 'doing', 'done'].map((s) => {
    const list = tasks.filter((t) => t.status === s || (s === 'doing' && t.status === 'review'));
    return h('div', { class: 'column' },
      h('h3', {}, STATUS_NAMES[s], h('span', { class: 'badge' }, String(list.length))),
      ...list.map((t) => taskCard(t, { showOwner: true })));
  });
  const assign = h('select', {}, ...state.employees.map((x) => h('option', { value: x.id, selected: x.id === filter }, x.name)));
  const title = h('input', { maxlength: 200, placeholder: 'عنوان المهمة', required: true });
  const desc = h('textarea', { rows: 2, maxlength: 1500, placeholder: 'التفاصيل' });
  const prio = h('select', {}, ...Object.entries(PRIORITY_NAMES).map(([k, v]) => h('option', { value: k, selected: k === 'medium' }, `أولوية ${v}`)));
  const proj = projectSelect(pf);
  const form = h('form', { class: 'column stack', onsubmit: (ev) => {
    ev.preventDefault();
    if (!title.value.trim() || !assign.value) return;
    const t = addTask(assign.value, title.value.trim(), desc.value.trim(), prio.value, null, proj.value || null);
    if (t.priority === 'high') runWhenFree(t.id);
    else toast('تمت إضافة المهمة');
  } }, h('h3', {}, 'تكليف جديد'), h('label', {}, 'الموظف', assign), title, desc, prio, proj, h('button', { class: 'primary', type: 'submit' }, 'إضافة'));
  cols[0].firstChild.after(form);
  const loads = atWork(state.employees).map((x) => ({ x, w: workloadOf(state, x.id) })).sort((a, b) => b.w.hours - a.w.hours);
  const strip = h('div', { class: 'load-strip', title: 'ساعات العمل المفتوحة لكل موظف (حسب أولوية مهامه)' },
    h('b', {}, '⚖️ ضغط العمل:'),
    loads.map(({ x, w }) => h('span', { class: w.hours >= OVERLOAD_HOURS ? 'over' : w.hours === 0 ? 'idle' : '' }, `${x.name} ${w.hours ? `${w.hours}س` : 'متاح'}`)));
  fill($('#board'), strip, ...cols);
}
$('#btn-board').addEventListener('click', () => {
  const f = $('#board-filter');
  const keep = f.value;
  fill(f, h('option', { value: '' }, 'كل الموظفين'), ...state.employees.map((x) => h('option', { value: x.id }, x.name)));
  f.value = state.employees.some((x) => x.id === keep) ? keep : '';
  const pf = $('#board-project');
  const keepP = pf.value;
  fill(pf, h('option', { value: '' }, 'كل المشاريع'), ...liveProjects().map((p) => h('option', { value: p.id }, `${clientOf(p)?.name} · ${p.name}`)));
  pf.value = project(keepP) ? keepP : '';
  renderBoard();
  $('#dlg-board').showModal();
});
$('#board-filter').addEventListener('change', renderBoard);
$('#board-project').addEventListener('change', renderBoard);
$('#board-close').addEventListener('click', () => $('#dlg-board').close());
$('#board-assign').addEventListener('click', () => {
  const m = topManager();
  if (!m) return toast('لا يوجد مدير لديه فريق. حدّد المدير المباشر للموظفين من ملفاتهم.');
  assignTeamTasks(m);
});

// ------------------------------------------------------------ org chart & ladder
function renderOrg() {
  const node = (e) => h('li', {},
    h('button', { class: 'org-node', onclick: () => { $('#dlg-org').close(); selectEmployee(e.id); } },
      avatar(e), h('span', {}, e.name, h('small', {}, titleFor(e)))),
    children(e.id));
  const children = (id) => {
    const kids = state.employees.filter((x) => (x.managerId || null) === id).sort(byRank);
    return kids.length ? h('ul', {}, ...kids.map(node)) : null;
  };
  fill($('#org-tree'), h('ul', {}, h('li', {},
    h('div', { class: 'org-node owner' }, h('div', { class: 'avatar', style: 'background:#7c5cff' }, '★'), h('span', {}, 'أنت', h('small', {}, 'مالك الوكالة'))),
    children(null))));
  fill($('#ladder'), ...activeLevels().map(({ i, ...l }, n) => {
    const people = state.employees.filter((x) => x.level === i);
    return h('li', { style: `border-color:hsl(${250 - i * 25} 80% 65%)` },
      h('b', {}, `${i + 1}. ${l.name}`, h('span', { class: 'muted' }, `${l.xp} نقطة`)),
      h('p', {}, l.desc),
      people.length ? h('div', { class: 'people' }, people.map((p) => p.name).join('، ')) : null);
  }));
}
$('#btn-org').addEventListener('click', () => { renderOrg(); $('#dlg-org').showModal(); });

// ------------------------------------------------------------ meetings
function fillMeetingForm() {
  fill($('#meet-room'), ...Object.entries(ROOMS).map(([k, r]) => h('option', { value: k }, `${r.name} (${r.seats} مقاعد)`)));
  // Nobody is ticked: only the people the owner adds go into the meeting.
  $('#meet-suggest').hidden = true;
  fill($('#meet-people'), ...atWork([...state.employees].sort(byRank)).map((e) =>
    h('label', { title: titleFor(e) }, h('input', { type: 'checkbox', value: e.id, onchange: updateSeatCount }), `${e.name}`)),
  ...state.employees.filter(awayNow).map((e) => h('label', { class: 'muted', title: awayNote(e) }, h('input', { type: 'checkbox', disabled: true }), `🌴 ${e.name}`)));
  updateSeatCount();
  const hist = state.meetings.slice().reverse();
  $('#meet-history').hidden = !hist.length;
  fill($('#meet-history-list'), ...hist.map((m) => h('div', { class: 'task' },
    h('h4', {}, m.topic),
    h('p', {}, `${ROOMS[m.room]?.name || ''} · ${new Date(m.at).toLocaleString('ar')}`),
    h('div', { class: 'row' }, h('button', { type: 'button', class: 'small', onclick: () => {
      $('#dlg-meeting').close();
      showOutput({ title: `محضر: ${m.topic}`, output: `${m.summary}\n\n— — —\n\n${m.log.map((l) => `${l.who}: ${l.text}`).join('\n\n')}`, doneAt: m.at });
    } }, '📄 المحضر')))));
}
function updateSeatCount() {
  const picked = document.querySelectorAll('#meet-people input:checked').length;
  const seats = ROOMS[$('#meet-room').value]?.seats ?? 0;
  const el = $('#meet-count');
  el.textContent = `${picked} من ${seats} مقاعد`;
  el.classList.toggle('over', picked > seats);
}
$('#meet-room').addEventListener('change', updateSeatCount);
$('#btn-meeting').addEventListener('click', () => {
  if (meeting) return toast('هناك اجتماع جارٍ بالفعل');
  fillMeetingForm();
  $('#dlg-meeting').showModal();
});
$('#dlg-meeting').addEventListener('close', async () => {
  if ($('#dlg-meeting').returnValue !== 'ok') return;
  const room = $('#meet-room').value;
  const topic = $('#meet-topic').value.trim();
  const picked = [...document.querySelectorAll('#meet-people input:checked')].map((i) => i.value);
  const attendees = picked.filter((id) => !busy.has(id)).map(emp).sort(byRank).map((e) => e.id);
  if (!topic) return;
  if (attendees.length < 1) return toast(picked.length ? 'من اخترتهم مشغولون بمهام الآن. اختر غيرهم أو انتظر.' : 'أضف من تريد حضوره: لا يدخل الاجتماع إلا من تضيفه.');
  if (attendees.length > ROOMS[room].seats) return toast(`${ROOMS[room].name} تتسع لـ${ROOMS[room].seats} فقط`);
  if (attendees.length < picked.length) toast(`لن يدخل ${picked.filter((id) => busy.has(id)).map((id) => emp(id)?.name).join('، ')} لأنه مشغول بمهمة الآن`);
  $('#meeting-form').reset();
  meeting = { room, topic, attendees, log: [], busy: true, at: Date.now() };
  closePanel();
  $('#m-title').textContent = `اجتماع في ${ROOMS[room].name}`;
  $('#m-topic').textContent = topic;
  $('#meeting-panel').hidden = false;
  attendees.forEach((id) => setStatus(emp(id), 'meeting', '🚶'));
  renderMeeting('الفريق في الطريق إلى غرفة الاجتماعات…');
  office.focusOn(room);
  await Promise.all(attendees.map((id) => office.recall(id)));
  if (!officeOpen) openOffice(attendees);
  await arrived(attendees);
  await office.sendToMeeting(attendees, room);
  attendees.forEach((id) => setStatus(emp(id), 'meeting'));
  meeting.busy = false;
  await meetingRound();
});

function renderMeeting(note) {
  if (!meeting) return;
  const items = meeting.log.map((l) => h('div', { class: `msg ${l.empId ? 'assistant' : 'user'}` },
    h('span', { class: 'who' }, l.who), richText(l.text)));
  if (note) items.push(h('div', { class: 'msg system' }, note));
  if (!meeting.log.length && !note) items.push(h('div', { class: 'empty' }, 'ابدأ جولة نقاش أو اكتب افتتاحية الاجتماع.'));
  fill($('#m-log'), ...items);
  $('#m-log').scrollTop = $('#m-log').scrollHeight;
  $('#m-round').disabled = $('#m-end').disabled = meeting.busy;
}

function meetingPrompt(e, extra = '') {
  const names = meeting.attendees.map((id) => `${emp(id).name} (${titleFor(emp(id))})`).join('، ');
  const transcript = meeting.log.length
    ? meeting.log.map((l) => `${l.who}: ${l.text}`).join('\n\n')
    : '(لم يتحدث أحد بعد — أنت من يفتتح النقاش)';
  return `موضوع الاجتماع: ${meeting.topic}\nالحاضرون: ${names}، ومالك الوكالة.\n\nما قيل حتى الآن:\n${transcript}\n\n${extra || `الآن دورك يا ${e.name}.`}`;
}

async function meetingRound() {
  if (!meeting || meeting.busy) return;
  meeting.busy = true;
  renderMeeting();
  for (const id of meeting.attendees) {
    const e = emp(id);
    if (!e || !meeting) break;
    setStatus(e, 'talking', '🗣️');
    renderMeeting(`${e.name} يتحدث…`);
    try {
      const text = await ask(e, 'meeting', [{ role: 'user', content: meetingPrompt(e) }]);
      meeting.log.push({ empId: e.id, who: `${e.name} — ${titleFor(e)}`, text });
    } catch (err) {
      toast(err.message);
      setStatus(e, 'meeting');
      break;
    }
    setStatus(e, 'meeting');
  }
  meeting.busy = false;
  renderMeeting();
}
$('#m-round').addEventListener('click', meetingRound);
$('#m-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const text = $('#m-input').value.trim();
  if (!meeting || !text) return;
  meeting.log.push({ empId: null, who: 'أنت (المالك)', text });
  $('#m-input').value = '';
  renderMeeting();
  meetingRound();
});
$('#m-end').addEventListener('click', async () => {
  if (!meeting || meeting.busy) return;
  meeting.busy = true;
  const lead = emp(meeting.attendees[0]);
  let summary = '';
  if (meeting.log.length) {
    setStatus(lead, 'talking', '📝');
    renderMeeting(`${lead.name} يكتب المحضر…`);
    try {
      summary = await ask(lead, 'summary', [{ role: 'user', content: meetingPrompt(lead, 'انتهى الاجتماع. اكتب المحضر الآن.') }]);
    } catch (err) {
      toast(err.message);
    }
  }
  const done = meeting;
  meeting = null;
  if (done.log.length) {
    state.meetings.push({ room: done.room, topic: done.topic, at: done.at, attendees: done.attendees, log: done.log, summary: summary || '(لم يُكتب محضر)' });
    state.meetings = state.meetings.slice(-30);
    save();
  }
  $('#meeting-panel').hidden = true;
  done.attendees.forEach((id) => emp(id) && setStatus(emp(id), 'idle', '🚶'));
  office.focusOn('overview');
  if (summary) showOutput({ title: `محضر: ${done.topic}`, output: summary, doneAt: Date.now() });
  await office.returnToDesks(done.attendees);
  done.attendees.forEach((id) => emp(id) && setStatus(emp(id), 'idle'));
});

// ------------------------------------------------------------ performance
const PART_NAMES = { quality: 'الجودة (اعتماد من أول مراجعة)', rating: 'تقييمك بالنجوم', output: 'الإنتاجية', punctuality: 'الالتزام بمواعيد المشاريع' };

function scoreBar(score, cls = '') {
  return h('div', { class: `progress ${cls}` }, h('i', { style: `width:${score ?? 0}%` }));
}

function performanceCard(e) {
  const row = teamPerformance(state).find((r) => r.emp.id === e.id);
  const ev = lastEvaluation(state, e.id);
  const evaluator = evaluatorOf(state, e);
  const m = row.m;
  return h('div', { class: 'card' },
    h('h3', {}, 'الأداء (آخر 90 يوماً)'),
    row.score === null
      ? h('p', { class: 'muted' }, 'لا توجد أعمال منجزة بعد لحساب الأداء.')
      : h('div', { class: 'stack' },
        h('div', { class: 'row', style: 'justify-content: space-between' },
          h('b', { class: `grade ${row.grade.cls}` }, `${row.score} من 100 · ${row.grade.name}`),
          employeeOfMonth(state)?.emp.id === e.id ? h('span', { class: 'badge flag-badge' }, '⭐ موظف الشهر') : null),
        scoreBar(row.score, row.grade.cls),
        h('dl', { class: 'kv' }, ...Object.entries(row.parts).flatMap(([k, v]) => [h('dt', {}, PART_NAMES[k]), h('dd', {}, `${v}%`)])),
        h('p', { class: 'muted' }, `أنجز ${m.done} · اعتُمد من أول مرة ${m.firstPass} من ${m.reviewed} · تعديلات ${m.revisions}` +
          `${m.rated ? ` · متوسط تقييمك ${m.ratingAvg.toFixed(1)} من 5` : ''}${m.projectDone ? ` · في موعد المشروع ${m.onTime} من ${m.projectDone}` : ''}`)),
    ev ? h('div', { class: 'evaluation' },
      h('b', {}, `آخر تقييم من ${emp(ev.by)?.name || '—'} · ${new Date(ev.at).toLocaleDateString('ar')}`),
      h('p', {}, ev.summary),
      ev.strengths ? h('p', {}, h('b', {}, 'نقاط القوة: '), ev.strengths) : null,
      ev.improve ? h('p', {}, h('b', {}, 'للتحسين: '), ev.improve) : null,
      h('p', {}, h('b', {}, 'التوصية: '), `${RECOMMENDATIONS[ev.recommendation]}${ev.reason ? ` — ${ev.reason}` : ''}`)) : null,
    evaluator
      ? h('button', { class: 'small', disabled: busy.has(`eval:${e.id}`) || row.score === null, onclick: () => evaluate(e).then(() => selectedId === e.id && renderPanel()) },
        `📝 اطلب تقييمه من ${evaluator.name}`)
      : h('p', { class: 'muted' }, 'يتبعك مباشرة: تقييمه بيدك من هذه الأرقام.'));
}

// The evaluator writes an assessment from the numbers and recent manager notes,
// with a recommendation the agency then acts on.
async function evaluate(e, { quiet = false, by = null } = {}) {
  const evaluator = by && by.id !== e.id ? by : evaluatorOf(state, e);
  if (!evaluator) { if (!quiet) toast(`${e.name} يتبعك مباشرة، فلا يوجد مدير يقيّمه`); return null; }
  const row = teamPerformance(state).find((r) => r.emp.id === e.id);
  if (row.score === null) { if (!quiet) toast(`لا توجد أعمال منجزة لـ${e.name} لتقييمها بعد`); return null; }
  const key = `eval:${e.id}`;
  if (busy.has(key)) return null;
  busy.add(key);
  const prev = evaluator.status;
  const prevBubble = bubbles.get(evaluator.id) || '';
  setStatus(evaluator, 'talking', `📝 يقيّم ${e.name}`);
  const m = row.m;
  const notes = state.tasks.filter((t) => t.empId === e.id && t.status === 'done' && t.reviews?.length)
    .sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 5)
    .map((t) => `- ${t.title}: ${t.reviews.map((r) => `${r.decision === 'approve' ? 'اعتماد' : 'تعديل'}${r.feedback ? ` («${r.feedback}»)` : ''}`).join(' ثم ')}${t.rating ? ` · تقييم المالك ${t.rating}/5` : ''}`);
  const next = nextRung(e);
  const content = [
    `تقييم أداء ${e.name} (${titleFor(e)})، آخر 90 يوماً.`,
    `الدرجة المحسوبة: ${row.score} من 100 (${row.grade.name}). التفصيل: ${Object.entries(row.parts).map(([k, v]) => `${PART_NAMES[k]} ${v}%`).join('، ')}.`,
    `مهام منجزة ${m.done}، اعتُمد منها من أول مراجعة ${m.firstPass} من ${m.reviewed}، وطلبات تعديل ${m.revisions}، ومهام مفتوحة ${m.open}.`,
    m.projectDone ? `مهام المشاريع: ${m.onTime} من ${m.projectDone} أُنجزت قبل موعد تسليم المشروع.` : '',
    m.rated ? `متوسط تقييم المالك لأعماله: ${m.ratingAvg.toFixed(1)} من 5 (${m.rated} تقييمات).` : '',
    next ? `المستوى الحالي ${LADDER[e.level].name}، والترقية التالية إلى ${next.name}${e.xp >= next.xp ? ' وهو مستوفٍ لنقاطها' : ''}.` : 'في أعلى السلم الوظيفي.',
    notes.length ? `ملاحظات المراجعة الأخيرة:\n${notes.join('\n')}` : '',
  ].filter(Boolean).join('\n');
  let ev = null;
  try {
    const parsed = parseEvaluation(await ask(evaluator, 'evaluation', [{ role: 'user', content: content.slice(0, 5800) }]));
    if (!parsed) throw new Error(`تعذّر قراءة تقييم ${evaluator.name}، حاول مرة أخرى`);
    ev = recordEvaluation(state, { empId: e.id, by: evaluator.id, row, parsed, newId });
    actOnRecommendation(e, evaluator, ev);
    save();
    if (!quiet) toast(`📝 ${evaluator.name} قيّم ${e.name}: ${ev.grade} — التوصية: ${RECOMMENDATIONS[ev.recommendation]}`);
  } catch (err) {
    toast(err.message);
  } finally {
    busy.delete(key);
    if (evaluator.status === 'talking') setStatus(evaluator, prev === 'talking' ? 'idle' : prev, prevBubble);
    refresh();
  }
  return ev;
}

// A bonus recommendation enters the approval chain; a promotion waits in the
// owner's approvals box; the rest stays on record in the profile.
function actOnRecommendation(e, evaluator, ev) {
  if (ev.recommendation === 'bonus') {
    try {
      createBonusRequest(state, { empId: e.id, recommenderId: evaluator.id, amount: state.finance?.taskBonus?.high || 200, newId,
        reason: `تقييم الأداء: ${ev.reason || ev.summary}`.slice(0, 300) });
      processBonusQueue();
    } catch { /* e.g. evaluating oneself: no request */ }
  }
  if (ev.recommendation === 'promote' && nextRung(e)) ev.pendingPromotion = true;
}

async function evaluateAll({ by = null, people: only = null } = {}) {
  const people = (only || state.employees).filter((e) => (by ? e.id !== by.id || evaluatorOf(state, e) : evaluatorOf(state, e)) && metricsOf(state, e.id).done > 0);
  if (!people.length) return toast('لا يوجد من لديه أعمال منجزة لتقييمه بعد');
  toast(by ? `📝 ${by.name} بدأت تقييم ${people.length} من الموظفين` : `📝 بدأ المدراء تقييم ${people.length} من الموظفين`);
  let n = 0;
  for (const e of people) {
    if (await evaluate(e, { quiet: true, by })) n++;
    if ($('#dlg-performance').open) renderPerformance();
  }
  toast(`✅ اكتملت ${n} تقييمات. التوصيات بالمكافآت دخلت سلسلة الموافقات، والترقيات في صندوق موافقاتك`);
  if ($('#dlg-performance').open) renderPerformance();
}

// The HR manager reviews completed work and evaluations, then proposes bonuses
// (they enter the approval chain) and promises of promotion (they wait for the owner).
async function hrRewards() {
  const hr = hrHead();
  if (!hr || busy.has('rewards')) return;
  if (awayNow(hr)) return toast(awayNote(hr));
  busy.add('rewards');
  if ($('#dlg-performance').open) renderPerformance();
  const prev = hr.status;
  setStatus(hr, 'working', '🏅 تراجع المكافآت');
  const pendingBonus = new Set((state.bonusRequests || []).filter((q) => q.status === 'in_review' || q.status === 'awaiting_owner').map((q) => q.empId));
  const rows = teamPerformance(state).filter((row) => row.emp.id !== hr.id);
  const lines = rows.map(({ emp: e, score, grade, m }) => {
    const ev = lastEvaluation(state, e.id);
    return `- ${e.name} (${titleFor(e)}): درجة ${score === null ? 'لا بيانات' : `${score} (${grade.name})`} · منجزة ${m.done} · من أول مراجعة ${m.firstPass} من ${m.reviewed}` +
      ` · آخر تقييم: ${ev ? `${ev.grade}، توصية ${RECOMMENDATIONS[ev.recommendation]}` : 'لا يوجد'} · الراتب ${e.salary} · حد المكافأة ${Math.round(e.salary * 0.25)}` +
      `${nextRung(e) ? '' : ' · في أعلى السلم'}${openPromise(state, e.id) ? ' · لديه وعد ترقية مفتوح' : ''}${pendingBonus.has(e.id) ? ' · لديه مكافأة قيد المراجعة' : ''}`;
  });
  let made = { bonuses: 0, promises: 0 };
  try {
    const parsed = parseRewards(await ask(hr, 'rewards', [{ role: 'user', content: `أداء الموظفين في آخر 90 يوماً (${state.finance.currency}):\n${lines.join('\n')}`.slice(0, 5800) }]),
      state.employees, { exclude: [hr.id, ...pendingBonus] });
    if (!parsed) throw new Error(`تعذّر قراءة مقترحات ${hr.name}، حاول مرة أخرى`);
    for (const b of parsed.bonuses) {
      try { createBonusRequest(state, { empId: b.empId, recommenderId: hr.id, amount: b.amount, reason: b.reason || `اقتراح ${hr.name}`, newId }); made.bonuses++; } catch { /* skip */ }
    }
    for (const p of parsed.promotions) {
      const e = emp(p.empId);
      try { promisePromotion(state, { empId: e.id, by: hr.id, condition: p.condition, reason: p.reason, toLevel: nextLevel(e.level) }, { newId, maxLevel: STAFF_TOP }); made.promises++; } catch { /* skip */ }
    }
    save();
    if (made.bonuses) processBonusQueue();
    toast(made.bonuses || made.promises
      ? `🏅 ${hr.name}: ${made.bonuses ? `${made.bonuses} مكافأة دخلت سلسلة الموافقات` : ''}${made.bonuses && made.promises ? '، و' : ''}${made.promises ? `${made.promises} وعد بالترقية في صندوق موافقاتك` : ''}${parsed.note ? ` · «${parsed.note}»` : ''}`
      : `🏅 ${hr.name} لا ترى من يستحق مكافأة أو وعداً الآن${parsed.note ? `: «${parsed.note}»` : ''}`);
  } catch (err) {
    toast(err.message);
  } finally {
    busy.delete('rewards');
    setStatus(hr, prev === 'working' ? 'idle' : prev || 'idle');
    refresh();
    if ($('#dlg-performance').open) renderPerformance();
  }
}

let perfTab = 'score';
function renderPerformance() {
  document.querySelectorAll('[data-perf]').forEach((b) => b.classList.toggle('active', b.dataset.perf === perfTab));
  if (perfTab === 'attendance') return renderAttendance();
  const rows = teamPerformance(state);
  const eom = employeeOfMonth(state);
  fill($('#perf-body'),
    eom ? h('div', { class: 'card eom' }, h('b', {}, `⭐ موظف الشهر: ${eom.emp.name}`), h('span', { class: 'muted' }, `${titleFor(eom.emp)} · ${eom.score} من 100`)) : null,
    h('p', { class: 'muted' }, 'الدرجة من 100 تُحسب من آخر 90 يوماً: الجودة (اعتماد العمل من أول مراجعة) 35%، وتقييمك بالنجوم 25%، والإنتاجية مقارنة بالأكثر إنجازاً 25%، والالتزام بمواعيد المشاريع 15%. ما لا تتوفر بياناته لا يُحتسب. قيّم أي عمل بالنجوم من نافذة «عرض النتيجة».'),
    h('div', { class: 'row' },
      h('button', { class: 'primary', disabled: [...busy].some((k) => k.startsWith('eval:')), onclick: () => evaluateAll() }, '📝 اطلب من المدراء تقييم فرقهم'),
      hrHead() ? h('button', { disabled: [...busy].some((k) => k.startsWith('eval:')), onclick: () => evaluateAll({ by: hrHead() }) },
        `📝 ${hrHead().name} (الموارد البشرية) تقيّم كل الموظفين`) : null,
      hrHead() ? h('button', { disabled: busy.has('rewards'), onclick: hrRewards },
        busy.has('rewards') ? `⏳ ${hrHead().name} تراجع…` : `🏅 ${hrHead().name} تقترح مكافآت ووعود ترقية`) : null),
    h('div', { class: 'table-wrap' }, h('table', { class: 'fin' },
      h('thead', {}, h('tr', {}, ...['#', 'الموظف', 'الدرجة', 'التقدير', 'منجزة', 'من أول مرة', 'نجومك', 'المعنويات', 'آخر تقييم', ''].map((x) => h('th', {}, x)))),
      h('tbody', {}, ...rows.map((r, i) => {
        const ev = lastEvaluation(state, r.emp.id);
        return h('tr', {},
          h('td', {}, r.score === null ? '—' : String(i + 1)),
          h('td', {}, `${r.emp.name}${eom?.emp.id === r.emp.id ? ' ⭐' : ''}`),
          h('td', { class: 'num' }, r.score === null ? '—' : h('span', { class: `grade ${r.grade.cls}` }, String(r.score))),
          h('td', {}, r.grade?.name || 'لا بيانات'),
          h('td', { class: 'num' }, String(r.m.done)),
          h('td', { class: 'num' }, r.m.reviewed ? `${Math.round((r.m.firstPass / r.m.reviewed) * 100)}%` : '—'),
          h('td', { class: 'num' }, r.m.rated ? r.m.ratingAvg.toFixed(1) : '—'),
          (() => { const mo = moraleOf(state, r.emp); return h('td', { title: mo.factors.map((f) => `${f.delta > 0 ? '+' : ''}${f.delta} ${f.label}`).join('\n') }, `${mo.mood.icon} ${mo.score}`); })(),
          h('td', {}, ev ? `${ev.grade} · ${RECOMMENDATIONS[ev.recommendation]}` : '—'),
          h('td', {}, h('button', { class: 'small', onclick: () => { $('#dlg-performance').close(); selectEmployee(r.emp.id); activeTab = 'profile'; renderPanel(); } }, 'الملف')));
      })))));
}
$('#btn-performance').addEventListener('click', () => { renderPerformance(); $('#dlg-performance').showModal(); });

// ------------------------------------------------------------ bonus approvals
// A recommended bonus climbs HR → CFO → CEO, each reviewer weighing in from
// their own angle (via the AI), then waits in the owner's approvals box.
let bonusQueueRunning = false;
const ROLE_ANGLE = {
  hr: 'بصفتك مدير الموارد البشرية: تحقق من عدالة المكافأة مقارنة بزملائه وبسجل أدائه، وألا تكون مجاملة.',
  cfo: 'بصفتك المدير المالي: تحقق من أثرها على الرصيد ومسير الرواتب، ومن أن المبلغ معقول.',
  ceo: 'بصفتك المدير التنفيذي: قرّر هل ترفعها للمالك للاعتماد النهائي، بالنظر إلى أثرها على الفريق والوكالة.',
};

function bonusContext(req, reviewer, stage) {
  const e = emp(req.empId);
  const done = state.tasks.filter((t) => t.empId === req.empId && t.status === 'done');
  const firstPass = done.filter((t) => t.reviews?.length && t.reviews[0].decision === 'approve').length;
  const monthBonuses = (state.bonusRequests || []).filter((r) => r.empId === req.empId && r.status === 'approved' && periodOfMs(r.closedAt) === state.finance.period);
  const prior = req.chain.filter((s) => s.decision && s.decision !== 'skipped')
    .map((s) => `${emp(s.empId)?.name || ROLE_NAMES[s.role]} (${ROLE_NAMES[s.role]}): ${s.decision === 'approve' ? `وافق بمبلغ ${fmt(s.amount)}` : 'رفض'} — ${s.note || ''}`);
  return [
    ROLE_ANGLE[stage.role],
    `طلب مكافأة لـ${e?.name} (${e ? titleFor(e) : ''}) بمبلغ ${fmt(req.amount)} ${state.finance.currency}.`,
    `سبب الترشيح: ${req.reason}`,
    `سجل الموظف: الراتب ${fmt(e?.salary || 0)}، مهام منجزة ${done.length}، منها ${firstPass} اعتُمدت من أول مراجعة، ومكافآت معتمدة هذا الشهر ${monthBonuses.length}.`,
    `المالية: الرصيد ${fmt(balance(state))}، ومسير هذا الشهر حتى الآن ${fmt(payrollPreview(state).total)}، وطلبات مكافآت أخرى قيد المراجعة ${inReview(state).length - 1}.`,
    prior.length ? `آراء من راجعه قبلك:\n${prior.join('\n')}` : '',
  ].filter(Boolean).join('\n');
}
const periodOfMs = (ms) => (ms ? `${new Date(ms).getFullYear()}-${String(new Date(ms).getMonth() + 1).padStart(2, '0')}` : '');

async function processBonusQueue() {
  if (bonusQueueRunning) return;
  bonusQueueRunning = true;
  try {
    for (let guard = 0; guard < 50; guard++) {
      const req = inReview(state)[0];
      if (!req) break;
      const stage = currentStage(req);
      if (!stage || stage.role === 'owner') break;
      const reviewer = emp(stage.empId);
      if (!reviewer) { skipStage(state, req, 'غادر الوكالة'); save(); continue; }
      const prev = reviewer.status;
      const prevBubble = bubbles.get(reviewer.id) || '';
      setStatus(reviewer, 'talking', `🧾 يراجع مكافأة ${emp(req.empId)?.name || ''}`);
      let verdict = { decision: 'approve', amount: req.amount, note: '' };
      try {
        const reply = await ask(reviewer, 'bonus', [{ role: 'user', content: bonusContext(req, reviewer, stage).slice(0, 5800) }]);
        try {
          const v = JSON.parse(reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1));
          verdict = { decision: v.decision === 'reject' ? 'reject' : 'approve', amount: Number(v.amount) || req.amount, note: typeof v.note === 'string' ? v.note : '' };
        } catch { /* unreadable answer: pass it on unchanged */ }
      } catch (err) {
        toast(err.message);
        break; // try again later rather than skip a reviewer because the AI was unavailable
      } finally {
        if (reviewer.status === 'talking') setStatus(reviewer, prev === 'talking' ? 'idle' : prev, prevBubble);
      }
      decideStage(state, req, verdict);
      save();
      const who = emp(req.empId)?.name || '';
      if (req.status === 'rejected') toast(`✋ ${reviewer.name} رفض مكافأة ${who}: ${verdict.note}`.slice(0, 160));
      else if (req.status === 'awaiting_owner') toast(`📥 مكافأة ${who} (${money(req.amount)}) وصلت بانتظار موافقتك`);
      renderApprovalsBadge();
      if ($('#dlg-approvals').open) renderApprovals();
    }
  } finally {
    bonusQueueRunning = false;
    renderApprovalsBadge();
  }
}

const pendingPromotions = () => (state.evaluations || []).filter((ev) => ev.pendingPromotion && emp(ev.empId) && nextRung(emp(ev.empId)));
// Everything else that waits on the owner: proposals written, projects past
// their due date, and people whose points qualify them for the next rung.
const proposalTask = (p) => state.tasks.filter((t) => t.projectId === p.id && t.status === 'done' && t.title.startsWith('عرض فني ومالي')).at(-1);
const readyProposals = () => (state.projects || []).filter((p) => p.status === 'proposal' && !p.proposalSeen && proposalTask(p));
const lateProjects = () => (state.projects || []).filter((p) => isLate(p) && p.lateAck !== p.due);
const dueForPromotion = () => state.employees.filter((e) => nextRung(e) && e.xp >= nextRung(e).xp && e.promoAck !== e.level
  && !pendingPromotions().some((ev) => ev.empId === e.id));
const unreadWeekly = () => (state.reports || []).filter((r) => r.type === 'weekly' && !r.seen);
const openPromisesForOwner = () => (state.promises || []).filter((p) => p.status === 'open' && !p.ack && emp(p.empId));
const pendingResignations = () => (state.resignations || []).filter((r) => r.status === 'pending' && emp(r.empId));
const visiblePlans = () => rebalancePlans(state, { available: (x) => !awayNow(x) }).filter((p) => state.rebalanceAck?.[p.managerId] !== dayKey() && emp(p.managerId));
const graduates = () => graduationCandidates(state, teamPerformance(state));
const inboxCount = () => pendingResignations().length + visiblePlans().length + graduates().length + openPromisesForOwner().length + unreadWeekly().length + (state.hiring ? 1 : 0) + pendingForOwner(state).length + pendingPromotions().length + readyProposals().length + lateProjects().length + dueForPromotion().length;
function renderApprovalsBadge() {
  const n = inboxCount();
  const badge = $('#approvals-count');
  badge.textContent = String(n);
  badge.hidden = n === 0;
}

function chainTrail(req) {
  const icon = { approve: '✅', reject: '❌', skipped: '⏭️' };
  const waiting = currentStage(req);
  return h('ol', { class: 'trail' }, ...req.chain.map((s) => {
    const who = s.role === 'owner' ? 'أنت' : emp(s.empId)?.name || '—';
    const state_ = s.decision ? icon[s.decision] : s === waiting ? '⏳' : '·';
    const detail = s.decision === 'approve' ? `${s.role === 'manager' ? 'رشّح' : 'وافق'} بمبلغ ${fmt(s.amount)}` : s.decision === 'reject' ? 'رفض' : s.decision === 'skipped' ? 'تخطّى' : s === waiting ? 'بانتظار المراجعة' : '';
    return h('li', { class: `step ${s.decision || (s === waiting ? 'waiting' : '')}` },
      h('b', {}, `${state_} ${who}`), h('small', {}, ` · ${ROLE_NAMES[s.role]}${detail ? ` · ${detail}` : ''}`),
      s.note ? h('p', {}, s.note) : null);
  }));
}

function requestCard(req, { actions = false } = {}) {
  const e = emp(req.empId);
  const amount = h('input', { type: 'number', min: '0.01', step: 'any', value: String(req.amount), 'aria-label': 'المبلغ' });
  const note = h('input', { maxlength: 300, placeholder: 'ملاحظة (اختياري)', 'aria-label': 'ملاحظة' });
  const decide = (approve) => {
    try {
      const adj = ownerDecision(state, req, { approve, amount: amount.value, note: note.value });
      save();
      toast(approve ? `✅ اعتمدت مكافأة ${e?.name} (${money(adj.amount)})، وستُصرف مع رواتب ${periodLabel(state.finance.period)}` : `رفضت مكافأة ${e?.name}`);
    } catch (err) { toast(err.message); }
    renderApprovals();
    renderApprovalsBadge();
    if ($('#dlg-finance').open) renderFinance();
  };
  return h('div', { class: 'project request' },
    h('div', { class: 'row', style: 'justify-content: space-between' },
      h('h4', {}, `🏅 مكافأة ${e?.name || 'موظف سابق'} · ${money(req.amount)}`),
      h('span', { class: `badge ${req.status === 'approved' ? 'active' : req.status === 'rejected' ? 'cancelled' : 'proposal'}` }, REQUEST_STATUS[req.status])),
    h('div', { class: 'client' }, `${e ? titleFor(e) : ''} · ${new Date(req.createdAt).toLocaleDateString('ar')}${req.requested !== req.amount ? ` · المبلغ المرشَّح ${fmt(req.requested)}` : ''}`),
    chainTrail(req),
    actions ? h('div', { class: 'row' },
      h('label', { class: 'grow' }, 'المبلغ', amount), h('label', { class: 'grow' }, 'ملاحظتك', note)) : null,
    actions ? h('div', { class: 'actions' },
      h('button', { class: 'small primary', onclick: () => decide(true) }, '✅ اعتماد'),
      h('button', { class: 'small danger', onclick: () => decide(false) }, '❌ رفض')) : null);
}

function promotionCard(ev) {
  const e = emp(ev.empId);
  const next = nextRung(e);
  const done = (promote) => {
    ev.pendingPromotion = false;
    if (promote) changeLevel(e, 1); else { save(); toast(`أبقيت ${e.name} على مستواه`); }
    renderApprovals();
    renderApprovalsBadge();
  };
  return h('div', { class: 'project request' },
    h('div', { class: 'row', style: 'justify-content: space-between' },
      h('h4', {}, `⬆️ ترقية ${e.name} إلى «${next.name}»`), h('span', { class: 'badge proposal' }, 'توصية تقييم')),
    h('div', { class: 'client' }, `${titleFor(e)} · تقييم ${ev.grade} (${ev.score} من 100) من ${emp(ev.by)?.name || '—'}`),
    h('p', { class: 'brief' }, ev.reason || ev.summary),
    h('div', { class: 'actions' },
      h('button', { class: 'small primary', onclick: () => done(true) }, '✅ ترقية'),
      h('button', { class: 'small', onclick: () => done(false) }, 'ليس الآن')));
}

function inboxCard(title, badge, sub, text, actions) {
  return h('div', { class: 'project request' },
    h('div', { class: 'row', style: 'justify-content: space-between' }, h('h4', {}, title), h('span', { class: 'badge proposal' }, badge)),
    sub ? h('div', { class: 'client' }, sub) : null,
    text ? h('p', { class: 'brief' }, text) : null,
    h('div', { class: 'actions' }, ...actions.map(([label, fn, cls]) => h('button', { class: `small ${cls || ''}`, onclick: () => { fn(); save(); refresh(); renderApprovals(); } }, label))));
}

function otherInboxCards() {
  const cards = [];
  for (const r of pendingResignations()) {
    const e = emp(r.empId);
    const mo = moraleOf(state, e);
    cards.push(inboxCard(`📄 ${e.name} قدّم استقالته`, 'استقالة', `${titleFor(e)} · المعنويات ${mo.mood.icon} ${mo.score} · ${mo.factors.filter((f) => f.delta < 0).slice(0, 3).map((f) => f.label).join('، ')}`,
      r.letter, [
        ['🤝 حاول إبقاءه', () => { $('#dlg-approvals').close(); openRetain(r); }, 'primary'],
        ['✅ قبول الاستقالة', () => { acceptResignation(r); }, 'danger'],
      ]));
  }
  for (const plan of visiblePlans()) {
    const m = emp(plan.managerId);
    const heavy = [...new Set(plan.moves.map((x) => x.from))].map(emp);
    cards.push(inboxCard(`⚖️ ${m.name} تقترح إعادة توزيع المهام`, 'ضغط العمل',
      heavy.map((x) => `${x.name}: ${workloadOf(state, x.id).hours} ساعة مفتوحة`).join(' · '),
      plan.moves.map((x) => `«${state.tasks.find((t) => t.id === x.taskId)?.title}» من ${emp(x.from)?.name} إلى ${emp(x.to)?.name}`).join('؛ '), [
        ['✅ نفّذ الخطة', () => runRebalance(plan), 'primary'],
        ['ليس اليوم', () => { (state.rebalanceAck ||= {})[plan.managerId] = dayKey(); }],
      ]));
  }
  for (const row of graduates()) {
    const e = row.emp;
    const by = hrHead() || emp(e.managerId);
    cards.push(inboxCard(`🎓 ${by ? `${by.name} توصي` : 'توصية'} بتعيين ${e.name} رسمياً`, 'تعيين',
      `${titleFor(e)} · أداء ${row.score} (${row.grade.name}) · ${row.m.done} مهام منجزة`, `يصبح «${LADDER[1].name}» براتب ${money(defaultSalary(1))} على الأقل.`, [
        ['✅ تعيين رسمي', () => graduate(e, by), 'primary'],
        ['ليس الآن', () => { e.gradAck = Date.now(); }],
      ]));
  }
  for (const r of unreadWeekly()) {
    cards.push(inboxCard(`📊 التقرير الأسبوعي من ${emp(r.by)?.name || 'الإدارة'}`, 'تقرير', `أسبوع ${weekStart(r.day)} — ${r.day}`, '',
      [['📄 قراءة التقرير', () => { $('#dlg-approvals').close(); showReport(r); }, 'primary'], ['تمت القراءة', () => { r.seen = true; }]]));
  }
  if (state.hiring) {
    const r = state.hiring;
    const pc = r.pick && r.candidates.find((x) => x.id === r.pick.candId);
    if (pc) {
      cards.push(inboxCard(`🎤 ${emp(r.pick.by)?.name || 'الموارد البشرية'} توصي بتوظيف ${pc.name}`, 'توظيف',
        `${r.title} · راتب ${money(r.pick.salary)} (الحد الذي حددته ${money(r.cap)}) · ${pc.age} سنة، خبرة ${pc.years}`, r.pick.reason, [
          ['✅ اعتماد التوظيف', () => { $('#dlg-approvals').close(); hireCandidate(pc, { salary: r.pick.salary, confirm: false }); }, 'primary'],
          ['📄 قراءة المقابلات', () => { $('#dlg-approvals').close(); ivActive = pc.id; openInterviews(); }],
          ['❌ لا أوافق', () => { r.pick = null; r.hrNote = `رفضت توصية توظيف ${pc.name}. يمكنك مقابلة غيره أو إلغاء الجولة.`; }, 'danger'],
        ]));
    } else {
      cards.push(inboxCard(`🎤 مقابلات: ${r.title}`, 'توظيف', `${countOf(r.candidates.length, ['مرشح واحد', 'مرشحان', 'مرشحين', 'مرشحاً'])}${emp(r.by) ? ` · رشّحهم ${emp(r.by).name}` : ''}`,
        r.hrNote || r.note, [['فتح المقابلات', () => { $('#dlg-approvals').close(); openInterviews(); }, 'primary']]));
    }
  }
  for (const p of openPromisesForOwner()) {
    const e = emp(p.empId);
    cards.push(inboxCard(p.by === 'owner' ? `🤝 وعدت ${e.name} بالترقية` : `🤝 ${emp(p.by)?.name || 'الموارد البشرية'} وعدت ${e.name} بالترقية`, 'وعد ترقية',
      `من «${titleFor(e)}» إلى «${LADDER[p.toLevel]?.name}»${p.condition ? ` · الشرط: ${p.condition}` : ''}`, p.reason, [
        ['⬆️ رقّه الآن', () => { changeLevel(e, p.toLevel - e.level); }, 'primary'],
        ['لاحقاً', () => { p.ack = true; }],
        ['❌ إلغاء الوعد', () => { closePromise(state, p.id, 'cancelled'); toast(`أُلغي وعد ترقية ${e.name}`); }, 'danger'],
      ]));
  }
  for (const p of readyProposals()) {
    const t = proposalTask(p);
    cards.push(inboxCard(`📝 عرض «${p.name}» جاهز`, 'عرض سعر', `${clientOf(p)?.name} · ${money(p.fee)} · كتبه ${emp(t.empId)?.name || '—'}`,
      'اقرأ العرض، ثم سجّل رد العميل عليه.', [
        ['📄 قراءة العرض', () => { $('#dlg-approvals').close(); showOutput(t); }],
        ['✅ العميل قبِل: ابدأ المشروع', () => { saveProject(state, { ...p, status: 'active' }, { newId }); syncDealWithProject(state, p); toast(`🎉 بدأ مشروع ${p.name}`); }, 'primary'],
        ['❌ العميل رفض', () => { saveProject(state, { ...p, status: 'cancelled' }, { newId }); syncDealWithProject(state, p); }, 'danger'],
        ['لاحقاً', () => { p.proposalSeen = true; }],
      ]));
  }
  for (const p of lateProjects()) {
    const prog = projectProgress(state, p);
    // Extend from today when already overdue, so the new date is really ahead.
    const extend = (days) => {
      const from = Math.max(Date.parse(p.due), Date.parse(new Date().toISOString().slice(0, 10)));
      p.due = new Date(from + days * 86400000).toISOString().slice(0, 10);
      toast(`مُدّد تسليم ${p.name} إلى ${p.due}`);
    };
    cards.push(inboxCard(`⏰ «${p.name}» متأخر`, 'مشروع متأخر', `${clientOf(p)?.name} · كان التسليم ${p.due} · أُنجز ${prog.done} من ${prog.total}`,
      emp(p.leadId) ? `قائد المشروع: ${emp(p.leadId).name}` : '', [
        ['تمديد أسبوع', () => extend(7), 'primary'],
        ['تمديد أسبوعين', () => extend(14)],
        ['تجاهل', () => { p.lateAck = p.due; }],
      ]));
  }
  for (const e of dueForPromotion()) {
    const next = nextRung(e);
    cards.push(inboxCard(`⬆️ ${e.name} مستوفٍ للترقية`, 'نقاط الخبرة', `${titleFor(e)} · ${e.xp} نقطة من ${next.xp} المطلوبة لـ«${next.name}»`, '', [
      ['✅ ترقية', () => changeLevel(e, 1), 'primary'],
      ['ليس الآن', () => { e.promoAck = e.level; }],
    ]));
  }
  return cards;
}

function renderApprovals() {
  const waiting = pendingForOwner(state);
  const moving = inReview(state);
  const closed = (state.bonusRequests || []).filter((r) => r.status === 'approved' || r.status === 'rejected').slice(-20).reverse();
  fill($('#approvals-body'), 
    h('p', { class: 'muted' }, 'كل ما ينتظر قرارك في مكان واحد: المكافآت (بعد مرورها على الموارد البشرية والمالية والمدير التنفيذي)، وتوصيات الترقية من التقييمات، ومن استوفى نقاط الترقية، والعروض الجاهزة، والمشاريع المتأخرة.'),
    h('h3', {}, `بانتظار قرارك (${inboxCount()})`),
    pendingPromotions().length ? h('div', { class: 'clients-list' }, ...pendingPromotions().map(promotionCard)) : null,
    waiting.length ? h('div', { class: 'clients-list' }, ...waiting.map((r) => requestCard(r, { actions: true }))) : null,
    otherInboxCards().length ? h('div', { class: 'clients-list' }, ...otherInboxCards()) : null,
    inboxCount() ? null : h('div', { class: 'empty' }, 'لا يوجد ما ينتظر قرارك.'),
    moving.length ? h('h3', {}, `قيد المراجعة (${moving.length})`) : null,
    moving.length ? h('div', { class: 'clients-list' }, ...moving.map((r) => requestCard(r))) : null,
    moving.length && !bonusQueueRunning ? h('button', { class: 'small', onclick: () => processBonusQueue() }, '↻ متابعة المراجعة') : null,
    closed.length ? h('h3', {}, 'آخر القرارات') : null,
    closed.length ? h('div', { class: 'clients-list' }, ...closed.map((r) => requestCard(r))) : null);
}

$('#btn-approvals').addEventListener('click', () => { renderApprovals(); $('#dlg-approvals').showModal(); });

// ------------------------------------------------------------ clients & projects
let crmTab = 'projects';
let projectFilter = 'live';

function openClients(tab = crmTab) {
  crmTab = tab;
  renderClients();
  if (!$('#dlg-clients').open) $('#dlg-clients').showModal();
}

function personChip(e, lead = false) {
  return Object.assign(avatar(e), { title: `${e.name} — ${titleFor(e)}${lead ? ' (قائد المشروع)' : ''}`, className: `avatar${lead ? ' lead' : ''}` });
}

function profitLine(p) {
  const r = projectProfit(state, p);
  if (!r.cost && !r.tasks) return null;
  return h('div', { class: `money ${r.profit >= 0 ? 'gain' : 'loss'}`, title: `وقت الفريق ${fmt(r.laborHours)} ساعة = ${fmt(r.labor)} · مصروفات ${fmt(r.expenses)}` },
    h('span', {}, `التكلفة ${fmt(r.cost)} · الربح ${fmt(r.profit)}`), h('span', {}, r.margin === null ? '' : `هامش ${r.margin}%`));
}

function projectCard(p) {
  const c = clientOf(p);
  const prog = projectProgress(state, p);
  const lead = emp(p.leadId);
  const late = isLate(p);
  return h('div', { class: 'project' },
    h('div', { class: 'row', style: 'justify-content: space-between' },
      h('h4', {}, p.name),
      h('span', { class: `badge ${p.status}` }, PROJECT_STATUS[p.status])),
    h('div', { class: 'client' }, `${c?.name || '—'} · ${p.type}`),
    p.brief ? h('p', { class: 'brief' }, p.brief) : null,
    h('div', { class: 'people' },
      lead ? personChip(lead, true) : h('span', { class: 'muted' }, 'بلا قائد'),
      ...p.team.map(emp).filter(Boolean).map((e) => personChip(e))),
    h('div', {},
      h('div', { class: 'progress' }, h('i', { style: `width:${prog.pct}%` })),
      h('div', { class: 'money muted' },
        h('span', {}, prog.total ? `أُنجز ${prog.done} من ${countOf(prog.total, TASKS_WORD)}` : 'لا توجد مهام بعد'),
        p.due ? h('span', { class: late ? 'badge late' : '' }, `${late ? 'متأخر · ' : 'التسليم '}${p.due}`) : null)),
    h('div', { class: 'money' },
      h('span', {}, `القيمة ${money(p.fee)}`),
      h('span', { class: 'muted' }, `محصّل ${fmt(p.paid || 0)} · متبقٍ ${fmt(outstanding(p))}`)),
    profitLine(p),
    h('div', { class: 'actions' },
      p.status === 'active' || p.status === 'proposal'
        ? h('button', { class: 'small primary', disabled: !lead || busy.has(`assign:${p.leadId}`), onclick: () => assignProjectTasks(p).then(() => renderClients()) },
          `📋 ${lead ? `${lead.name} يوزّع المهام` : 'توزيع المهام'}`) : null,
      p.status === 'proposal' && lead
        ? h('button', { class: 'small', onclick: () => requestProposal(p) }, '📝 كتابة العرض') : null,
      outstanding(p) > 0 && p.status !== 'cancelled' ? h('button', { class: 'small', onclick: () => openPay(p) }, '💵 تحصيل دفعة') : null,
      p.status !== 'cancelled' ? h('button', { class: 'small', onclick: () => openPay(p, 'expense') }, '💸 مصروف') : null,
      pendingDeliveries(state, p).length && p.status !== 'cancelled'
        ? h('button', { class: 'small primary', disabled: busy.has(`client:${p.clientId}`), onclick: () => sendToClient(p) }, `📤 إرسال للعميل (${pendingDeliveries(state, p).length})`) : null,
      h('button', { class: 'small', onclick: () => openMeetingFor(p) }, '👥 اجتماع'),
      h('button', { class: 'small', onclick: () => showProjectTasks(p) }, '📋 المهام'),
      h('button', { class: 'small', onclick: () => openProjectForm(p) }, '✏️ تعديل')));
}

function renderClients() {
  document.querySelectorAll('[data-crm]').forEach((b) => b.classList.toggle('active', b.dataset.crm === crmTab));
  const body = $('#crm-body');
  if (crmTab === 'pipeline') {
    renderPipeline(body);
  } else if (crmTab === 'projects') {
    const groups = { live: ['active', 'proposal'], done: ['done'], cancelled: ['cancelled'], all: Object.keys(PROJECT_STATUS) };
    const list = (state.projects || []).filter((p) => groups[projectFilter].includes(p.status))
      .sort((a, b) => ['active', 'proposal', 'done', 'cancelled'].indexOf(a.status) - ['active', 'proposal', 'done', 'cancelled'].indexOf(b.status));
    const active = (state.projects || []).filter((p) => p.status === 'active');
    fill(body, 
      h('div', { class: 'tiles' },
        tile('مشاريع قيد التنفيذ', String(active.length)),
        tile('عروض أسعار', String((state.projects || []).filter((p) => p.status === 'proposal').length)),
        tile('قيمة المشاريع الجارية', money(active.reduce((s, p) => s + p.fee, 0))),
        tile('مستحقات غير محصّلة', money(receivables(state)), receivables(state) ? 'bad' : 'good')),
      h('div', { class: 'crm-filters' }, ...[['live', 'الجارية'], ['done', 'المكتملة'], ['cancelled', 'الملغاة'], ['all', 'الكل']].map(([k, label]) =>
        h('button', { class: `small${projectFilter === k ? ' active' : ''}`, onclick: () => { projectFilter = k; renderClients(); } }, label))),
      list.length ? h('div', { class: 'projects' }, ...list.map(projectCard))
        : h('div', { class: 'empty' }, state.clients?.length ? 'لا توجد مشاريع هنا. أضف مشروعاً جديداً لأحد العملاء.' : 'أضف عميلاً أولاً، ثم أنشئ له مشروعاً.'));
  } else {
    const clients = [...(state.clients || [])].sort((a, b) => ['active', 'prospect', 'past'].indexOf(a.status) - ['active', 'prospect', 'past'].indexOf(b.status));
    fill(body, clients.length ? h('div', { class: 'clients-list' }, ...clients.map((c) => {
      const tot = clientTotals(state, c.id);
      return h('div', { class: 'project' },
        h('div', { class: 'row', style: 'justify-content: space-between' },
          h('h4', {}, c.name), h('span', { class: `badge ${c.status === 'active' ? 'active' : c.status === 'prospect' ? 'proposal' : 'cancelled'}` }, CLIENT_STATUS[c.status])),
        h('div', { class: 'client' }, [c.industry, c.city].filter(Boolean).join(' · ') || '—'),
        c.contact ? h('div', { class: 'client' }, `👤 ${c.contact}`) : null,
        ...(state.deals || []).filter((d) => d.clientId === c.id && isOpen(d)).map((d) =>
          h('div', { class: 'client' }, `💼 ${d.title} · ${DEAL_STAGES[d.stage].name} · ${money(d.value)}`)),
        c.notes ? h('p', { class: 'brief' }, c.notes) : null,
        h('div', { class: 'money' }, h('span', {}, `${countOf(tot.projects, PROJECTS_WORD)} · ${money(tot.fee)}`), h('span', { class: 'muted' }, `متبقٍ ${fmt(tot.owed)}`)),
        tot.projects ? (() => { const cp = clientProfit(state, c.id); return h('div', { class: `money ${cp.profit >= 0 ? 'gain' : 'loss'}` },
          h('span', {}, `الربح حتى الآن ${money(cp.profit)}`), h('span', {}, cp.margin === null ? '' : `هامش ${cp.margin}%`)); })() : null,
        clientSatisfaction(state, c.id) !== null ? h('div', { class: 'money' }, h('span', {}, 'رضا العميل'),
          h('span', { class: 'sat' }, `${'★'.repeat(Math.round(clientSatisfaction(state, c.id)))}${'☆'.repeat(5 - Math.round(clientSatisfaction(state, c.id)))} ${clientSatisfaction(state, c.id)}`)) : null,
        h('div', { class: 'actions' },
          h('button', { class: 'small', onclick: () => openClientChat(c) }, `💬 محادثة ${contactOf(c).name}`),
          h('button', { class: 'small primary', onclick: () => openProjectForm(null, c.id) }, '＋ مشروع'),
          tot.projects ? h('button', { class: 'small', onclick: () => openLibrary({ clientId: c.id }) }, '📚 الأعمال') : null,
          tot.projects ? statementButton(c) : null,
          h('button', { class: 'small', onclick: () => openClientForm(c) }, '✏️ تعديل')));
    })) : h('div', { class: 'empty' }, 'لا يوجد عملاء بعد.'));
  }
}

function openClientForm(c = null) {
  $('#client-form').reset();
  $('#client-form-title').textContent = c ? `تعديل ${c.name}` : 'عميل جديد';
  fill($('#cl-status'), ...Object.entries(CLIENT_STATUS).map(([k, v]) => h('option', { value: k }, v)));
  $('#cl-id').value = c?.id || '';
  for (const f of ['name', 'industry', 'city', 'contact', 'notes']) $(`#cl-${f}`).value = c?.[f] || '';
  $('#cl-status').value = c?.status || 'active';
  $('#cl-delete').hidden = !c;
  $('#dlg-client').showModal();
}
$('#dlg-client').addEventListener('close', () => {
  if ($('#dlg-client').returnValue !== 'ok') return;
  try {
    const c = saveClient(state, {
      id: $('#cl-id').value || undefined, name: $('#cl-name').value, industry: $('#cl-industry').value, city: $('#cl-city').value,
      contact: $('#cl-contact').value, status: $('#cl-status').value, notes: $('#cl-notes').value,
    }, { newId });
    save();
    toast(`تم حفظ العميل ${c.name}`);
  } catch (err) { toast(err.message); }
  renderClients();
});
$('#cl-delete').addEventListener('click', async () => {
  const c = state.clients.find((x) => x.id === $('#cl-id').value);
  $('#dlg-client').close();
  if (!c || !(await confirmBox(`حذف العميل ${c.name}؟`, 'حذف'))) return;
  try { deleteClient(state, c.id); save(); toast('تم حذف العميل'); } catch (err) { toast(err.message); }
  renderClients();
});

function openProjectForm(p = null, clientId = '') {
  if (!state.clients?.length) return toast('أضف عميلاً أولاً');
  $('#project-form').reset();
  $('#project-form-title').textContent = p ? `تعديل ${p.name}` : 'مشروع جديد';
  fill($('#pj-client'), ...state.clients.map((c) => h('option', { value: c.id }, c.name)));
  fill($('#pj-type'), ...PROJECT_TYPES.map((t) => h('option', { value: t }, t)));
  fill($('#pj-status'), ...Object.entries(PROJECT_STATUS).map(([k, v]) => h('option', { value: k }, v)));
  const people = [...state.employees].sort(byRank);
  fill($('#pj-lead'), h('option', { value: '' }, 'بدون قائد'), ...people.map((e) => h('option', { value: e.id }, `${e.name} — ${titleFor(e)}`)));
  fill($('#pj-team'), ...people.map((e) => h('label', { title: titleFor(e) },
    h('input', { type: 'checkbox', value: e.id, checked: Boolean(p?.team.includes(e.id)) }), e.name)));
  $('#pj-id').value = p?.id || '';
  $('#pj-client').value = p?.clientId || clientId || state.clients[0].id;
  $('#pj-name').value = p?.name || '';
  $('#pj-type').value = p?.type || PROJECT_TYPES[0];
  $('#pj-brief').value = p?.brief || '';
  $('#pj-fee').value = p ? String(p.fee) : '0';
  $('#pj-due').value = p?.due || '';
  $('#pj-status').value = p?.status || 'proposal';
  $('#pj-lead').value = p?.leadId || '';
  $('#pj-delete').hidden = !p;
  $('#dlg-project').showModal();
}
$('#dlg-project').addEventListener('close', () => {
  if ($('#dlg-project').returnValue !== 'ok') return;
  try {
    const p = saveProject(state, {
      id: $('#pj-id').value || undefined, clientId: $('#pj-client').value, name: $('#pj-name').value, type: $('#pj-type').value,
      brief: $('#pj-brief').value, fee: $('#pj-fee').value, due: $('#pj-due').value, status: $('#pj-status').value,
      leadId: $('#pj-lead').value || null, team: [...document.querySelectorAll('#pj-team input:checked')].map((i) => i.value),
    }, { newId });
    save();
    refresh();
    toast(`تم حفظ المشروع ${p.name}`);
  } catch (err) { toast(err.message); }
  renderClients();
});
$('#pj-delete').addEventListener('click', async () => {
  const p = project($('#pj-id').value);
  $('#dlg-project').close();
  if (!p || !(await confirmBox(`حذف مشروع ${p.name}؟ تبقى مهامه ودفعاته المسجلة، لكن دون ربط بالمشروع.`, 'حذف'))) return;
  deleteProject(state, p.id);
  save();
  refresh();
  renderClients();
  toast('تم حذف المشروع');
});

// ---- the client as a person: chat, reviewing deliveries, satisfaction
function contactOf(c) {
  const m = (c.contact || '').match(/^(.*?)\s*\((.*)\)\s*$/);
  if (m) return { name: m[1].trim() || 'ممثل العميل', title: m[2].trim() || 'صاحب القرار' };
  return { name: c.contact?.trim() || 'ممثل العميل', title: 'صاحب القرار' };
}

function clientMemory(c) {
  const ps = (state.projects || []).filter((p) => p.clientId === c.id);
  const lines = ps.map((p) => {
    const last = (p.clientReviews || []).at(-1);
    return `مشروع «${p.name}» (${PROJECT_STATUS[p.status]}، القيمة ${fmt(p.fee)}، دفعت منها ${fmt(p.paid || 0)})` +
      (last ? `، وآخر رد منك على أعماله: ${last.decision === 'approve' ? 'اعتماد' : 'طلب تعديلات'} — «${last.feedback}»` : '');
  });
  for (const d of (state.deals || []).filter((x) => x.clientId === c.id && isOpen(x))) {
    lines.push(`تتحدث مع الوكالة عن «${d.title}» (${DEAL_STAGES[d.stage].name}، القيمة المطروحة ${fmt(d.value)})${d.note ? `، واحتياجك: ${d.note}` : ''}`);
  }
  const sat = clientSatisfaction(state, c.id);
  return `${lines.join('؛ ')}${sat !== null ? `. رضاك عن الوكالة حالياً ${sat} من 5.` : ''}`.slice(0, 1150);
}

function askClient(c, mode, messages) {
  const who = contactOf(c);
  return askEmployee({
    mode,
    persona: { name: who.name, title: who.title, level: 'عميل', department: c.name, skills: [c.industry, c.city].filter(Boolean).join('، '),
      personality: c.notes || '', memory: clientMemory(c), duties: 'client' },
    company: { name: state.company.name, about: state.company.about || '' },
    messages,
  });
}

let chattingClient = null;
let chatVisit = null;
$('#dlg-client-chat').addEventListener('close', () => { endVisit(chatVisit); chatVisit = null; chattingClient = null; });
function openClientChat(c) {
  if (chattingClient !== c.id) { endVisit(chatVisit); chatVisit = clientVisit(c); }
  chattingClient = c.id;
  const who = contactOf(c);
  $('#cc-title').textContent = `💬 ${who.name} · ${c.name}`;
  const sat = clientSatisfaction(state, c.id);
  $('#cc-sub').textContent = `${who.title}${c.industry ? ` · ${c.industry}` : ''}${sat !== null ? ` · رضا العميل ${sat} من 5` : ''}`;
  renderClientChat();
  if (!$('#dlg-client-chat').open) $('#dlg-client-chat').showModal();
}
function renderClientChat() {
  const c = state.clients.find((x) => x.id === chattingClient);
  if (!c) return;
  const history = (state.clientChats ||= {})[c.id] || [];
  const who = contactOf(c);
  fill($('#cc-log'), history.length ? history.map((m) => h('div', { class: `msg ${m.role}` },
    h('span', { class: 'who' }, m.role === 'user' ? 'أنت' : who.name), richText(m.content)))
    : h('div', { class: 'empty' }, `ابدأ محادثة مع ${who.name}. يعرف مشاريعه معكم وما سلّمتموه له.`),
  busy.has(`client:${c.id}`) ? h('div', { class: 'msg assistant typing' }, `${who.name} يكتب…`) : null);
  $('#cc-log').scrollTop = $('#cc-log').scrollHeight;
}
$('#cc-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const c = state.clients.find((x) => x.id === chattingClient);
  const text = $('#cc-input').value.trim();
  if (!c || !text || busy.has(`client:${c.id}`)) return;
  $('#cc-input').value = '';
  const history = ((state.clientChats ||= {})[c.id] ||= []);
  history.push({ role: 'user', content: text });
  busy.add(`client:${c.id}`);
  renderClientChat();
  try {
    history.push({ role: 'assistant', content: await askClient(c, 'chat', history.slice(-30)) });
    state.clientChats[c.id] = history.slice(-60);
    save();
  } catch (err) {
    history.pop();
    $('#cc-input').value = text;
    toast(err.message);
  } finally {
    busy.delete(`client:${c.id}`);
    renderClientChat();
  }
});
$('#cc-input').addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); $('#cc-form').requestSubmit(); }
});

// Finished project work goes to the client, who approves it (and pays a
// milestone) or asks for changes, which become revision tasks.
async function sendToClient(p) {
  const c = clientOf(p);
  const items = pendingDeliveries(state, p).slice(0, 4);
  if (!c || !items.length) return;
  const key = `client:${c.id}`;
  if (busy.has(key)) return;
  busy.add(key);
  renderClients();
  const who = contactOf(c);
  const visit = clientVisit(c);
  const per = Math.floor(4200 / items.length);
  const content = [
    `المشروع: ${p.name} (${p.type}).`, p.brief ? `موجز المشروع كما اتفقتم: ${p.brief}` : '',
    'الأعمال المرسلة لك:', ...items.map((t, i) => `${i + 1}) ${t.title}:\n${(t.output || '').slice(0, per)}`),
  ].filter(Boolean).join('\n\n').slice(0, 5800);
  try {
    const reply = await askClient(c, 'client_review', [{ role: 'user', content }]);
    let v;
    try { v = JSON.parse(reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1)); } catch { v = null; }
    if (!v) throw new Error(`تعذّر قراءة رد ${who.name}، أعد الإرسال`);
    const { review, payment } = recordClientReview(state, p, { decision: v.decision, feedback: v.feedback, satisfaction: v.satisfaction, taskIds: items.map((t) => t.id) });
    ((state.clientChats ||= {})[c.id] ||= []).push(
      { role: 'user', content: `أرسلنا لك ${countOf(items.length, TASKS_WORD)} من مشروع «${p.name}»: ${items.map((t) => t.title).join('، ')}` },
      { role: 'assistant', content: review.feedback || (review.decision === 'approve' ? 'معتمد.' : 'أريد تعديلات.') });
    if (review.decision === 'changes') {
      const lead = emp(p.leadId);
      for (const t of items) {
        const author = emp(t.empId) || lead;
        if (!author) continue;
        addTask(author.id, `تعديلات ${who.name}: ${t.title}`.slice(0, 200),
          `ملاحظات العميل: ${review.feedback}\n\nالعمل السابق (مختصر):\n${(t.output || '').slice(0, 900)}`.slice(0, 1500),
          'medium', lead ? lead.id : null, p.id);
      }
      toast(`↩️ ${who.name} طلب تعديلات (رضا ${review.satisfaction}/5)، وأُنشئت مهام التعديل`);
    } else {
      toast(`✅ ${who.name} اعتمد الأعمال (رضا ${review.satisfaction}/5)${payment ? ` ودفع ${money(payment.amount)}` : ''}`);
    }
    save();
  } catch (err) {
    toast(err.message);
  } finally {
    busy.delete(key);
    endVisit(visit);
    refresh();
    renderClients();
    if ($('#dlg-client-chat').open) renderClientChat();
  }
}

let payingProject = null;
let payMode = 'pay';
// One small form for both money in (a client payment) and money out (a project expense).
function openPay(p, mode = 'pay') {
  payingProject = p.id;
  payMode = mode;
  $('#pay-form').reset();
  $('#pay-title').textContent = mode === 'expense' ? 'مصروف على المشروع' : 'تحصيل دفعة';
  $('#pay-info').textContent = mode === 'expense'
    ? `${clientOf(p)?.name} · ${p.name} — يُسجَّل في الدفتر ويُخصم من ربح المشروع`
    : `${clientOf(p)?.name} · ${p.name} — المتبقي ${money(outstanding(p))}`;
  $('#pay-amount').max = mode === 'expense' ? '' : String(outstanding(p));
  $('#pay-amount').value = mode === 'expense' ? '' : String(outstanding(p));
  $('#pay-note').placeholder = mode === 'expense' ? 'مثال: ميزانية إعلانات ممولة، تصوير، أدوات' : 'مثال: الدفعة الأولى 40%';
  $('#dlg-pay').showModal();
}
$('#dlg-pay').addEventListener('close', () => {
  if ($('#dlg-pay').returnValue !== 'ok' || !payingProject) return;
  try {
    const amount = Number($('#pay-amount').value);
    const note = $('#pay-note').value.trim();
    const entry = payMode === 'expense'
      ? recordProjectExpense(state, payingProject, amount, { note })
      : recordPayment(state, payingProject, amount, { note });
    save();
    toast(payMode === 'expense' ? `💸 سُجّل مصروف ${money(entry.amount)} على المشروع`
      : `💵 سُجّلت دفعة ${money(entry.amount)} في الدفتر برقم ${invoiceNumber(entry)} (الفاتورة في المالية ← الفواتير)`);
  } catch (err) { toast(err.message); }
  payingProject = null;
  renderClients();
  if ($('#dlg-finance').open) renderFinance();
});

// The lead gets a task to write the proposal for a project still at the quote stage.
function requestProposal(p) {
  const lead = emp(p.leadId);
  if (!lead) return toast('حدد قائداً للمشروع أولاً');
  if (state.tasks.some((t) => t.projectId === p.id && t.status !== 'done' && t.title.startsWith('عرض فني ومالي'))) return toast(`${lead.name} يعمل على العرض بالفعل`);
  addTask(lead.id, `عرض فني ومالي: ${p.name}`.slice(0, 200),
    `اكتب عرضاً للعميل يتضمن: فهمنا لاحتياجه، الأهداف، نطاق العمل والمخرجات، الجدول الزمني، الفريق، والتكلفة (${fmt(p.fee)} ${state.finance?.currency || ''})، ثم الخطوات التالية.`,
    'high', null, p.id);
  runWhenFree(state.tasks.at(-1).id); // high priority from the owner: start now
  toast(`📝 كُلّف ${lead.name} بكتابة عرض ${p.name}`);
  renderClients();
}

function showProjectTasks(p) {
  $('#dlg-clients').close();
  $('#btn-board').click();
  $('#board-filter').value = '';
  $('#board-project').value = p.id;
  renderBoard();
}

function openMeetingFor(p) {
  if (meeting) return toast('هناك اجتماع جارٍ بالفعل');
  $('#dlg-clients').close();
  fillMeetingForm();
  // The project team is offered, not added: the owner decides who comes in.
  const people = atWork([p.leadId, ...p.team].map(emp).filter(Boolean)).slice(0, Math.max(...Object.values(ROOMS).map((r) => r.seats)));
  if (people.length) {
    $('#meet-suggest').hidden = false;
    fill($('#meet-suggest'), h('button', { type: 'button', class: 'small', onclick: () => {
      document.querySelectorAll('#meet-people input').forEach((i) => { if (people.some((x) => x.id === i.value)) i.checked = true; });
      if (people.length > ROOMS.b.seats) $('#meet-room').value = 'a';
      updateSeatCount();
    } }, `＋ أضف فريق المشروع: ${people.map((x) => x.name).join('، ')}`));
  }
  updateSeatCount();
  $('#meet-topic').value = `مشروع «${p.name}» لـ${clientOf(p)?.name}: ${p.brief || p.type}`.slice(0, 600);
  $('#dlg-meeting').showModal();
}

$('#btn-clients').addEventListener('click', () => openClients());
$('#btn-new-project').addEventListener('click', () => openProjectForm());
$('#btn-new-client').addEventListener('click', () => openClientForm());
document.querySelectorAll('[data-crm]').forEach((b) => b.addEventListener('click', () => openClients(b.dataset.crm)));

// ------------------------------------------------------------ finance
let finTab = 'summary';
const hoursLabel = (n) => `${fmt(n)} ${n >= 3 && n <= 10 && Number.isInteger(n) ? 'ساعات' : 'ساعة'}`;

// Orders the finance manager wrote in a chat reply, applied as the owner asked.
function applyFinanceOrders(orders, by) {
  if (!orders.length) return '';
  const done = [];
  const failed = [];
  for (const o of orders) {
    for (const id of o.empIds) {
      const e = emp(id);
      try {
        const a = addAdjustment(state, {
          empId: id, type: o.type, reason: o.reason, by: by.id,
          ...(o.type === 'overtime' ? { hours: o.value } : { amount: o.value }),
        });
        done.push(`- ${ADJ_TYPES[o.type].name} لـ${e.name}: ${o.type === 'overtime' ? `${hoursLabel(a.hours)} = ` : ''}${money(a.amount)}${o.type === 'raise' || o.type === 'cut' ? ` (الراتب الآن ${money(e.salary)})` : ''}${a.reason ? ` — ${a.reason}` : ''}`);
        const why = `السبب: ${a.reason || '—'}`;
        sendDm(by.id, id, {
          cut: `بطلب من المالك خُفّض راتبك الشهري ${money(a.amount)} ليصبح ${money(e.salary)}. ${why}`,
          deduction: `خُصم ${money(a.amount)} من راتبك هذا الشهر. ${why}`,
          bonus: `🎉 أُضيفت لك مكافأة ${money(a.amount)} مع راتب هذا الشهر. ${why}`,
          raise: `🎉 زيد راتبك الشهري ${money(a.amount)} ليصبح ${money(e.salary)}. ${why}`,
          overtime: `سُجّل لك عمل إضافي ${hoursLabel(a.hours)} بقيمة ${money(a.amount)}. ${why}`,
        }[o.type], 'pay');
      } catch (err) {
        failed.push(`- ${e?.name || id}: ${err.message}`);
      }
    }
  }
  save();
  if ($('#dlg-finance').open) renderFinance();
  return [done.length ? `✅ سُجّل في الحسابات:\n${done.join('\n')}` : '', failed.length ? `⚠️ لم يُسجّل:\n${failed.join('\n')}` : ''].filter(Boolean).join('\n\n');
}

function tile(label, value, cls = '') {
  return h('div', { class: `tile ${cls}` }, h('small', {}, label), h('b', {}, value));
}

function renderFinance() {
  const fin = state.finance;
  $('#fin-period').textContent = `الشهر المفتوح: ${periodLabel(fin.period)}`;
  document.querySelectorAll('[data-fin]').forEach((b) => b.classList.toggle('active', b.dataset.fin === finTab));
  const body = $('#fin-body');
  const keeper = cfo();
  if (finTab === 'summary') {
    const m = monthTotals(state);
    const p = payrollPreview(state);
    const last = fin.payrolls.at(-1);
    fill(body, 
      h('div', { class: 'tiles' },
        tile('الرصيد الحالي', money(balance(state)), balance(state) >= 0 ? 'good' : 'bad'),
        tile(`إيرادات ${periodLabel(fin.period)}`, money(m.income), 'good'),
        tile(`مصروفات ${periodLabel(fin.period)}`, money(m.expense), 'bad'),
        tile('مسير الرواتب المتوقع', money(p.total)),
        tile('حركات مفتوحة', String(fin.adjustments.filter((a) => !a.paid && a.type !== 'raise').length)),
        tile('مستحقات العملاء', money(receivables(state)))),
      h('p', { class: 'muted' }, keeper
        ? `${keeper.name} (${titleFor(keeper)}) مسؤول عن الرواتب والخصومات والمكافآت، ويراجع طلبات المكافأة ضمن سلسلة الموافقات. اطلب منه في المحادثة، مثلاً: «اخصم 200 من خالد بسبب التأخير» أو «أضف 6 ساعات أوفرتايم لليلى».`
        : 'لا يوجد مدير مالي حالياً. يمكنك توظيف «المدير المالي» من نموذج التوظيف.'),
      last ? h('div', { class: 'card' },
        h('h3', {}, `آخر مسير: ${periodLabel(last.period)} · ${money(last.total)}`),
        h('p', { class: 'muted' }, `أعدّه ${emp(last.by)?.name || 'المالك'} · ${new Date(last.at).toLocaleDateString('ar')}`),
        last.memo ? h('div', { class: 'memo' }, richText(last.memo)) : null) : null);
  } else if (finTab === 'payroll') {
    const p = payrollPreview(state);
    const rows = p.lines.map((l) => {
      const e = emp(l.empId);
      return h('tr', {},
        h('td', {}, l.name), h('td', {}, titleFor(e)),
        h('td', { class: 'num' }, fmt(l.base)),
        h('td', { class: 'num plus' }, l.overtime ? fmt(l.overtime) : '—'),
        h('td', { class: 'num plus' }, l.bonuses ? fmt(l.bonuses) : '—'),
        h('td', { class: 'num minus' }, l.deductions ? fmt(l.deductions) : '—'),
        h('td', { class: 'num' }, h('b', {}, fmt(l.net))),
        h('td', {}, h('button', { class: 'small', onclick: () => openAdjust(l.empId) }, '＋ حركة')));
    });
    fill(body, 
      h('div', { class: 'table-wrap' }, h('table', { class: 'fin' },
        h('thead', {}, h('tr', {}, ...['الموظف', 'المسمى', 'الأساسي', 'أوفرتايم', 'مكافآت', 'خصومات', 'الصافي', ''].map((x) => h('th', {}, x)))),
        h('tbody', {}, ...rows),
        h('tfoot', {}, h('tr', {}, h('td', { colspan: 6 }, `الإجمالي (${fin.currency})`), h('td', { class: 'num' }, fmt(p.total)), h('td', {}))))),
      h('div', { class: 'row' },
        h('button', { onclick: () => openAdjust() }, '＋ حركة جديدة'),
        h('button', { class: 'primary', id: 'run-payroll', disabled: busy.has('payroll'), onclick: payPayroll },
          `💸 صرف رواتب ${periodLabel(fin.period)}${keeper ? ` (يُعدّها ${keeper.name})` : ''}`)));
  } else if (finTab === 'moves') {
    const list = [...fin.adjustments].reverse();
    fill(body, list.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'fin' },
      h('thead', {}, h('tr', {}, ...['التاريخ', 'الموظف', 'النوع', 'المبلغ', 'السبب', 'بواسطة', 'الحالة'].map((x) => h('th', {}, x)))),
      h('tbody', {}, ...list.map((a) => h('tr', {},
        h('td', {}, new Date(a.at).toLocaleDateString('ar')),
        h('td', {}, emp(a.empId)?.name || '—'),
        h('td', {}, ADJ_TYPES[a.type].name + (a.hours ? ` (${hoursLabel(a.hours)})` : '')),
        h('td', { class: `num ${a.type === 'deduction' || a.type === 'cut' ? 'minus' : 'plus'}` }, (a.type === 'deduction' || a.type === 'cut' ? '−' : '+') + fmt(a.amount)),
        h('td', {}, a.reason || '—'),
        h('td', {}, a.by === 'owner' ? 'المالك' : emp(a.by)?.name || '—'),
        h('td', {}, a.type === 'raise' || a.type === 'cut' ? `${fmt(a.from)} ← ${fmt(a.to)}` : a.paid ? `صُرفت (${periodLabel(a.period)})` : 'مفتوحة'))))))
      : h('div', { class: 'empty' }, 'لا توجد حركات بعد.'));
  } else if (finTab === 'profit') {
    const rows = (state.projects || []).filter((p) => p.status !== 'cancelled').map((p) => ({ p, r: projectProfit(state, p) }))
      .sort((a, b) => b.r.profit - a.r.profit);
    const tot = rows.reduce((t, { p, r }) => ({ fee: t.fee + p.fee, paid: t.paid + (p.paid || 0), cost: t.cost + r.cost, profit: t.profit + r.profit }), { fee: 0, paid: 0, cost: 0, profit: 0 });
    fill(body,
      h('div', { class: 'tiles' },
        tile('قيمة المشاريع', money(tot.fee)), tile('المحصّل منها', money(tot.paid), 'good'),
        tile('التكلفة حتى الآن', money(tot.cost), 'bad'), tile('الربح المتوقع', money(tot.profit), tot.profit >= 0 ? 'good' : 'bad')),
      h('p', { class: 'muted' }, `التكلفة = وقت الفريق (ساعات كل مهمة منجزة حسب أولويتها × أجر ساعة صاحبها، ونصف ساعة من وقت المراجِع لكل مراجعة) + المصروفات المسجلة على المشروع. تقدير مبني على الرواتب الحالية؛ عدّل ساعات المهام من الإعدادات.`),
      rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'fin' },
        h('thead', {}, h('tr', {}, ...['العميل', 'المشروع', 'الحالة', 'القيمة', 'محصّل', 'ساعات الفريق', 'تكلفة الفريق', 'مصروفات', 'الربح', 'الهامش'].map((x) => h('th', {}, x)))),
        h('tbody', {}, ...rows.map(({ p, r }) => h('tr', {},
          h('td', {}, clientOf(p)?.name || '—'), h('td', {}, p.name), h('td', {}, PROJECT_STATUS[p.status]),
          h('td', { class: 'num' }, fmt(p.fee)), h('td', { class: 'num' }, fmt(p.paid || 0)), h('td', { class: 'num' }, fmt(r.laborHours)),
          h('td', { class: 'num minus' }, fmt(r.labor)), h('td', { class: 'num minus' }, r.expenses ? fmt(r.expenses) : '—'),
          h('td', { class: `num ${r.profit >= 0 ? 'plus' : 'minus'}` }, h('b', {}, fmt(r.profit))),
          h('td', { class: 'num' }, r.margin === null ? '—' : `${r.margin}%`)))))) : h('div', { class: 'empty' }, 'لا توجد مشاريع بعد.'));
  } else if (finTab === 'invoices') {
    const pays = fin.ledger.filter(isClientPayment).reverse();
    const billed = (state.clients || []).filter((c) => clientTotals(state, c.id).projects);
    fill(body,
      h('div', { class: 'tiles' },
        tile('فواتير صادرة', String(pays.length)),
        tile('إجمالي المحصّل', money(pays.reduce((s, l) => s + l.amount, 0)), 'good'),
        tile('مستحقات العملاء', money(receivables(state)), receivables(state) ? 'bad' : 'good')),
      canDownload() ? null : h('p', { class: 'muted' }, 'تنزيل الملفات غير متاح في هذا العرض.'),
      h('h3', {}, 'كشوف حساب العملاء'),
      billed.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'fin' },
        h('thead', {}, h('tr', {}, ...['العميل', 'المشاريع', 'القيمة', 'المدفوع', 'المتبقي', ''].map((x) => h('th', {}, x)))),
        h('tbody', {}, ...billed.map((c) => {
          const t = clientTotals(state, c.id);
          return h('tr', {}, h('td', {}, c.name), h('td', { class: 'num' }, String(t.projects)), h('td', { class: 'num' }, fmt(t.fee)),
            h('td', { class: 'num plus' }, fmt(t.paid)), h('td', { class: `num ${t.owed ? 'minus' : ''}` }, fmt(t.owed)), h('td', {}, statementButton(c, '📄 تنزيل')));
        })))) : h('div', { class: 'empty' }, 'لا يوجد عملاء لهم مشاريع بعد.'),
      h('h3', {}, 'الفواتير'),
      pays.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'fin' },
        h('thead', {}, h('tr', {}, ...['رقم الفاتورة', 'التاريخ', 'العميل', 'المشروع', 'المبلغ', ''].map((x) => h('th', {}, x)))),
        h('tbody', {}, ...pays.map((l) => {
          const p = project(l.projectId);
          return h('tr', {}, h('td', {}, invoiceNumber(l)), h('td', {}, new Date(l.at).toLocaleDateString('ar')),
            h('td', {}, clientOf(p)?.name || l.note.split(' — ')[0] || '—'), h('td', {}, p?.name || '—'),
            h('td', { class: 'num plus' }, fmt(l.amount)), h('td', {}, invoiceButton(l, '🧾 تنزيل')));
        })))) : h('div', { class: 'empty' }, 'لا توجد دفعات من العملاء بعد. سجّل دفعة من «العملاء ← تحصيل دفعة»، أو تُسجَّل تلقائياً حين يعتمد العميل تسليماً.'));
  } else if (finTab === 'ledger') {
    const type = h('select', { id: 'led-type' }, h('option', { value: 'income' }, 'إيراد'), h('option', { value: 'expense' }, 'مصروف'));
    const cat = h('input', { id: 'led-cat', maxlength: 60, placeholder: 'البند: دفعة عميل، إعلانات، اشتراكات…' });
    const amount = h('input', { id: 'led-amount', type: 'number', min: '0.01', step: 'any', placeholder: 'المبلغ' });
    const note = h('input', { id: 'led-note', maxlength: 200, placeholder: 'ملاحظة' });
    const form = h('form', { class: 'form-grid card', onsubmit: (ev) => {
      ev.preventDefault();
      try {
        addLedger(state, { type: type.value, category: cat.value, amount: amount.value, note: note.value });
        save();
        renderFinance();
        toast('تم تسجيل القيد');
      } catch (err) { toast(err.message); }
    } }, h('label', {}, 'النوع', type), h('label', {}, 'البند', cat), h('label', {}, 'المبلغ', amount), h('label', {}, 'ملاحظة', note),
      h('button', { class: 'primary', type: 'submit' }, 'تسجيل'));
    const rows = [...fin.ledger].reverse().map((l) => h('tr', {},
      h('td', {}, new Date(l.at).toLocaleDateString('ar')),
      h('td', {}, l.type === 'income' ? 'إيراد' : 'مصروف'), h('td', {}, l.category), h('td', {}, l.note || '—'),
      h('td', { class: `num ${l.type === 'income' ? 'plus' : 'minus'}` }, (l.type === 'income' ? '+' : '−') + fmt(l.amount)),
      h('td', {}, isClientPayment(l) ? invoiceButton(l, '🧾') : null)));
    fill(body, form,
      h('div', { class: 'row', style: 'justify-content: space-between' },
        h('p', { class: 'muted' }, `الرصيد الافتتاحي ${money(fin.openingBalance)} · الرصيد الحالي ${money(balance(state))}`),
        fin.ledger.length ? dlButton('⬇️ تنزيل الدفتر (CSV)', () => [`دفتر ${state.company.name} ${today()}`, 'csv', ledgerCsv(state)]) : null),
      rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'fin' },
        h('thead', {}, h('tr', {}, ...['التاريخ', 'النوع', 'البند', 'ملاحظة', 'المبلغ', ''].map((x) => h('th', {}, x)))),
        h('tbody', {}, ...rows))) : h('div', { class: 'empty' }, 'لا توجد قيود بعد. سجّل دفعات العملاء والمصروفات هنا.'));
  } else {
    const field = (label, id, value, attrs = {}) => h('label', {}, label, h('input', { id, value: String(value), ...attrs }));
    const form = h('form', { class: 'form-grid card', onsubmit: (ev) => {
      ev.preventDefault();
      const num = (id) => Number($(`#${id}`).value);
      const vals = { ob: num('fs-ob'), ot: num('fs-ot'), hrs: num('fs-hrs'), low: num('fs-low'), med: num('fs-med'), high: num('fs-high'),
        hl: num('fs-hl'), hm: num('fs-hm'), hh: num('fs-hh'), tb: num('fs-tb') };
      if (Object.values(vals).some((v) => !Number.isFinite(v) || v < 0) || vals.ot < 1 || vals.hrs < 1) return toast('تحقق من الأرقام: يجب أن تكون موجبة.');
      fin.currency = $('#fs-cur').value.trim().slice(0, 8) || fin.currency;
      fin.openingBalance = vals.ob;
      fin.overtimeRate = vals.ot;
      fin.monthlyHours = vals.hrs;
      fin.taskBonus = { low: vals.low, medium: vals.med, high: vals.high };
      fin.taskHours = { low: vals.hl, medium: vals.hm, high: vals.hh };
      fin.trainingBudget = vals.tb;
      save();
      renderFinance();
      toast('تم حفظ الإعدادات المالية');
    } },
    field('العملة', 'fs-cur', fin.currency, { maxlength: 8 }),
    field('الرصيد الافتتاحي', 'fs-ob', fin.openingBalance, { type: 'number', min: '0', step: 'any' }),
    field('معامل العمل الإضافي', 'fs-ot', fin.overtimeRate, { type: 'number', min: '1', step: '0.25' }),
    field('ساعات العمل الشهرية', 'fs-hrs', fin.monthlyHours, { type: 'number', min: '1' }),
    field('ساعات مهمة منخفضة (لحساب التكلفة)', 'fs-hl', (fin.taskHours || {}).low ?? 2, { type: 'number', min: '0', step: 'any' }),
    field('ساعات مهمة متوسطة', 'fs-hm', (fin.taskHours || {}).medium ?? 4, { type: 'number', min: '0', step: 'any' }),
    field('ساعات مهمة عالية', 'fs-hh', (fin.taskHours || {}).high ?? 8, { type: 'number', min: '0', step: 'any' }),
    field('ميزانية التدريب السنوية', 'fs-tb', trainingBudget(state).total, { type: 'number', min: '0', step: 'any' }),
    field('المكافأة المقترحة لعمل متميز (أولوية منخفضة)', 'fs-low', fin.taskBonus.low, { type: 'number', min: '0' }),
    field('المكافأة المقترحة لعمل متميز (أولوية متوسطة)', 'fs-med', fin.taskBonus.medium, { type: 'number', min: '0' }),
    field('المكافأة المقترحة لعمل متميز (أولوية عالية)', 'fs-high', fin.taskBonus.high, { type: 'number', min: '0' }),
    h('button', { class: 'primary', type: 'submit' }, 'حفظ'));
    fill(body, form, h('p', { class: 'muted' },
      'أجر ساعة العمل الإضافي = الراتب الأساسي ÷ ساعات العمل الشهرية × المعامل. ' +
      'لا تُصرف أي مكافأة تلقائياً: المدير يرشّح صاحب العمل المتميز بالمبلغ المقترح أعلاه، ثم يمر الطلب على الموارد البشرية والمالية والمدير التنفيذي، ولا يُسجَّل في الرواتب إلا بموافقتك.'));
  }
}

async function payPayroll() {
  if (busy.has('payroll')) return;
  const p = payrollPreview(state);
  if (!(await confirmBox(`صرف رواتب ${periodLabel(p.period)} بإجمالي ${money(p.total)} لـ${p.lines.length} موظفاً؟`, 'صرف الرواتب'))) return;
  busy.add('payroll');
  renderFinance();
  const keeper = cfo();
  let memo = '';
  if (keeper) {
    const prev = keeper.status;
    setStatus(keeper, 'working', '💰 يُعدّ مسير الرواتب');
    const lines = p.lines.map((l) => `${l.name}: أساسي ${fmt(l.base)}، أوفرتايم ${fmt(l.overtime)}، مكافآت ${fmt(l.bonuses)}، خصومات ${fmt(l.deductions)}، صافي ${fmt(l.net)}`).join('\n');
    try {
      memo = await ask(keeper, 'memo', [{ role: 'user', content:
        `مسير رواتب ${periodLabel(p.period)} (${state.finance.currency}):\n${lines}\nالإجمالي: ${fmt(p.total)}\nالرصيد قبل الصرف: ${fmt(balance(state))}`.slice(0, 5800) }]);
    } catch (err) {
      toast(err.message);
    } finally {
      setStatus(keeper, prev === 'working' ? 'idle' : prev);
    }
  }
  try {
    const rec = runPayroll(state, { by: keeper ? keeper.id : 'owner', memo });
    save();
    toast(`💸 صُرفت رواتب ${periodLabel(rec.period)}: ${money(rec.total)}`);
    finTab = 'summary';
  } catch (err) {
    toast(err.message);
  } finally {
    busy.delete('payroll');
    renderFinance();
    refresh();
  }
}

function openAdjust(empId) {
  fill($('#adj-emp'), ...[...state.employees].sort(byRank).map((e) => h('option', { value: e.id, selected: e.id === empId }, `${e.name} — ${money(e.salary)}`)));
  $('#adjust-form').reset();
  if (empId) $('#adj-emp').value = empId;
  updateAdjustPreview();
  $('#dlg-adjust').showModal();
}
function updateAdjustPreview() {
  const e = emp($('#adj-emp').value);
  const type = $('#adj-type').value;
  $('#adj-amount-label').textContent = type === 'overtime' ? 'عدد الساعات' : 'المبلغ';
  const v = Number($('#adj-amount').value) || 0;
  const fin = state.finance;
  let text = '';
  if (e && type === 'overtime') text = `أجر الساعة الإضافية ${money(e.salary / fin.monthlyHours * fin.overtimeRate)} · الإجمالي ${money(v * e.salary / fin.monthlyHours * fin.overtimeRate)}`;
  else if (e && type === 'raise') text = `الراتب سيصبح ${money(e.salary + v)} شهرياً`;
  else if (e && type === 'cut') text = v >= e.salary ? 'التخفيض يجب أن يكون أقل من الراتب الحالي' : `الراتب سيصبح ${money(e.salary - v)} شهرياً بقرار منك`;
  else if (e) text = `تُحتسب في رواتب ${periodLabel(fin.period)}`;
  $('#adj-preview').textContent = text;
}
['#adj-emp', '#adj-type', '#adj-amount'].forEach((s) => $(s).addEventListener('input', updateAdjustPreview));
$('#dlg-adjust').addEventListener('close', () => {
  if ($('#dlg-adjust').returnValue !== 'ok') return;
  const type = $('#adj-type').value;
  const value = Number($('#adj-amount').value);
  try {
    const a = addAdjustment(state, { empId: $('#adj-emp').value, type, reason: $('#adj-reason').value, by: 'owner',
      ...(type === 'overtime' ? { hours: value } : { amount: value }) });
    save();
    toast(`تم تسجيل ${ADJ_TYPES[type].name} لـ${emp(a.empId).name}: ${money(a.amount)}`);
  } catch (err) {
    toast(err.message);
  }
  if ($('#dlg-finance').open) renderFinance();
});

$('#btn-finance').addEventListener('click', () => { renderFinance(); $('#dlg-finance').showModal(); });
document.querySelectorAll('[data-fin]').forEach((b) => b.addEventListener('click', () => { finTab = b.dataset.fin; renderFinance(); }));

// The top bar can wrap onto two rows on narrower screens; panels sit below it.
new ResizeObserver(([entry]) => {
  document.documentElement.style.setProperty('--topbar-h', `${Math.ceil(entry.target.getBoundingClientRect().height)}px`);
}).observe($('.topbar'));

// ------------------------------------------------------------ moving the view
function startRepeat(fn) {
  fn();
  const timer = setInterval(fn, 90);
  const stop = () => { clearInterval(timer); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); };
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
}
document.querySelectorAll('#nav-pad button:is([data-pan], [data-zoom], [data-reset])').forEach((b) => {
  b.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    if (b.dataset.reset !== undefined) return office.focusOn('overview');
    if (b.dataset.zoom) return startRepeat(() => office.zoom(Number(b.dataset.zoom)));
    const [dx, dy] = b.dataset.pan.split(',').map(Number);
    startRepeat(() => office.pan(dx, dy));
  });
  // Keyboard activation (Enter/Space) arrives as a click with no pointer: one step.
  b.addEventListener('click', (ev) => {
    if (ev.detail !== 0) return;
    if (b.dataset.reset !== undefined) office.focusOn('overview');
    else if (b.dataset.zoom) office.zoom(Number(b.dataset.zoom));
    else office.pan(...b.dataset.pan.split(',').map(Number));
  });
});
window.addEventListener('keydown', (ev) => {
  if (ev.target.closest?.('input, textarea, select, dialog[open]') || document.querySelector('dialog[open]')) return;
  const keys = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  if (keys[ev.key]) { ev.preventDefault(); office.pan(...keys[ev.key]); }
  else if (ev.key === '+' || ev.key === '=') office.zoom(0.85);
  else if (ev.key === '-') office.zoom(1.18);
});

// ------------------------------------------------------------ settings
$('#btn-settings').addEventListener('click', () => {
  $('#set-name').value = state.company.name;
  $('#set-about').value = state.company.about || '';
  $('#dlg-settings').showModal();
});
$('#dlg-settings').addEventListener('close', () => {
  if ($('#dlg-settings').returnValue !== 'ok') return;
  state.company.name = $('#set-name').value.trim() || state.company.name;
  state.company.about = $('#set-about').value.trim();
  save();
  refresh();
});
$('#set-reset').addEventListener('click', async () => {
  $('#dlg-settings').close();
  if (!(await confirmBox('سيتم حذف كل الموظفين الجدد والمهام والمحادثات والعودة للفريق الأساسي.', 'إعادة الوكالة'))) return;
  if (busy.size || meeting) return toast('انتظر حتى ينتهي العمل الجاري أو الاجتماع');
  applyState(createInitialState());
  save();
  toast('عادت الوكالة إلى بدايتها');
});
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

// ------------------------------------------------------------ boot
function refresh() {
  syncAway();
  renderHeader();
  renderApprovalsBadge();
  const eom = employeeOfMonth(state);
  for (const e of state.employees) office.setFlag(e.id, eom?.emp.id === e.id ? '⭐ موظف الشهر' : '');
  renderRoster();
  for (const e of state.employees) office.updateEmployee(e, titleFor(e));
  for (let k = 0; k < PRIVATE_OFFICES; k++) {
    const who = state.employees.find((e) => e.desk === OPEN_DESKS + k);
    const label = k === 0 ? (who ? `جناح المدير التنفيذي · ${who.name}` : 'جناح المدير التنفيذي (شاغر)') : who ? `مكتب ${who.name}` : 'مكتب شاغر';
    office.setOfficeLabel(k, label, Boolean(who));
  }
  if (selectedId) whenIdle('#panel', renderPanel);
  if ($('#dlg-board').open) whenIdle('#dlg-board', renderBoard);
}

// Swap in a whole new state (cloud load or reset) and rebuild the office.
function applyState(next) {
  closePanel();
  for (const e of state.employees) {
    office.removeEmployee(e.id);
    office.setDeskLit(e.desk, false);
  }
  state = next;
  state.employees.forEach((e) => office.addEmployee(actorOf(e), titleFor(e)));
  if (!officeOpen) state.employees.forEach((e) => office.setHome(e.id, true));
  refresh();
}

state.employees.forEach((e) => office.addEmployee(actorOf(e), titleFor(e)));
officeOpen = inWorkHours();
if (!officeOpen) {
  state.employees.forEach((e) => office.setHome(e.id, true));
  setTimeout(() => toast('🌙 خارج الدوام: الفريق في منازلهم. ابدأ يوم العمل ليصلوا إلى المكتب، أو اضغط 🏢.'), 1500);
}
updateDaylight();
setInterval(updateDaylight, 60_000);
setTimeout(() => peopleDaily(), 8000); // finished courses and resignations, once a day
refresh();
saveState(state);
setInterval(() => { if (state.employees.some((e) => Boolean(awayNow(e)) !== (office.whereIs(e.id) === 'away'))) refresh(); }, 60_000); // leave starts or ends at midnight

const SYNC_LABELS = { loading: '☁️ جارٍ التحميل…', saving: '☁️ جارٍ الحفظ…', saved: '☁️ محفوظ', error: '⚠️ لم يُحفظ', offline: '⚠️ السحابة غير متاحة' };
function setSync(status, detail) {
  const el = $('#sync-state');
  el.hidden = false;
  el.textContent = SYNC_LABELS[status];
  el.title = detail || '';
  el.className = `mode-pill ${status === 'saved' ? 'live' : status === 'error' || status === 'offline' ? 'demo' : ''}`;
  if (status === 'error' && detail) toast(detail);
}

connectCloud().then(async (c) => {
  if (!c) return; // not on claude.ai, or storage unavailable: browser storage only
  setSync('loading');
  c.onStatus(setSync);
  try {
    const remote = await c.load();
    const migrated = remote ? applyMigrations(remote) : false;
    if (remote && !busy.size && !meeting) {
      applyState(remote);
      saveState(state);
    }
    cloud = c;
    processBonusQueue();
    if (!remote || migrated) cloud.save(state); // first visit uploads; a one-time update is stored
    setSync('saved');
  } catch {
    setSync('offline', 'تعذّر الوصول إلى الحفظ السحابي. التعديلات تُحفظ في هذا المتصفح فقط الآن.');
  }
});

// Office life: now and then someone who isn't busy takes a short coffee break.
setInterval(() => {
  if (document.hidden || workdayRunning) return;
  const candidates = state.employees.filter((e) => e.status === 'idle' && !busy.has(e.id) && e.id !== selectedId
    && !meeting?.attendees.includes(e.id) && office.whereIs(e.id) === 'desk');
  const onBreak = state.employees.filter((e) => office.whereIs(e.id) === 'break').length;
  if (!candidates.length || onBreak >= 2 || Math.random() < 0.4) return;
  const e = candidates[Math.floor(Math.random() * candidates.length)];
  if (office.takeBreak(e.id, 6000 + Math.random() * 6000)) {
    setStatus(e, 'idle', '☕');
    setTimeout(() => { if (e.status === 'idle' && bubbles.get(e.id) === '☕') setStatus(e, 'idle'); }, 30000);
  }
}, 12000);

renderApprovalsBadge();
setTimeout(() => processBonusQueue(), 4000); // resume requests left mid-review

backendStatus().then((s) => {
  const pill = $('#ai-mode');
  pill.textContent = s.label;
  pill.className = `mode-pill ${s.ai ? 'live' : 'demo'}`;
});
