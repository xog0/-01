import { createOffice, ROOMS } from './scene.js';
import {
  LADDER, DEPARTMENTS, POSITIONS, OPEN_DESKS, PRIVATE_OFFICES, MANAGER_LEVEL, freeSeat, isPrivateOffice, ROLE_TASKS, TASK_XP, PRIORITY_NAMES, STATUS_NAMES,
  titleFor, lookFor, bioFor, loadState, saveState, createInitialState, applyMigrations, newId,
} from './data.js';
import { askEmployee, backendStatus } from './api.js';
import { connectCloud } from './cloud.js';
import {
  ADJ_TYPES, addAdjustment, addLedger, balance, defaultSalary, financeBrief, monthTotals, parseFinanceOrders,
  payrollPreview, periodLabel, runPayroll,
} from './finance.js';
import {
  CLIENT_STATUS, PROJECT_STATUS, PROJECT_TYPES, clientTotals, deleteClient, deleteProject, isLate, outstanding,
  portfolioBrief, projectContext, projectProgress, receivables, recordPayment, saveClient, saveProject,
} from './crm.js';
import {
  REQUEST_STATUS, ROLE_NAMES, createBonusRequest, currentStage, decideStage, inReview, ownerDecision, pendingForOwner, skipStage,
} from './approvals.js';

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

// What someone remembers at work: their last finished tasks and the last
// note their manager gave them.
function memoryOf(e) {
  const done = state.tasks.filter((t) => t.empId === e.id && t.status === 'done').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const parts = [];
  if (done.length) parts.push(`آخر مهامك المنجزة: ${done.slice(0, 4).map((t) => t.title).join('، ')}.`);
  const note = done.find((t) => t.reviews?.length)?.reviews.at(-1);
  if (note?.feedback) parts.push(`آخر ملاحظة من ${emp(note.by)?.name || 'مديرك'} على عملك: "${note.feedback}"`);
  const live = (state.projects || []).filter((p) => (p.status === 'active' || p.status === 'proposal') && (p.leadId === e.id || p.team.includes(e.id)));
  if (live.length) {
    parts.push(`مشاريعك: ${live.map((p) => `${p.name} لـ${clientOf(p)?.name || 'عميل'} (${p.leadId === e.id ? 'أنت قائده' : 'عضو في الفريق'})`).join('، ')}.`);
  }
  return parts.join(' ').slice(0, 1100);
}

function personaOf(e) {
  const mgr = e.managerId ? emp(e.managerId) : null;
  const bio = bioFor(e);
  return {
    name: e.name,
    title: titleFor(e),
    level: LADDER[e.level].name,
    department: DEPARTMENTS[e.dept].name,
    skills: DEPARTMENTS[e.dept].skills,
    personality: e.personality || '',
    manager: mgr ? `${mgr.name} (${titleFor(mgr)})` : 'مالك الوكالة مباشرة',
    reports: teamOf(e.id).map((m) => `${m.name} (${titleFor(m)})`).join('، '),
    duties: e.id === cfo()?.id ? 'finance' : '',
    bio: `عمرك ${bio.age} سنة، وخبرتك ${bio.years} ${bio.years > 10 ? 'سنة' : 'سنوات'}. ${bio.background} أسلوبك في التواصل: ${bio.style}`.slice(0, 1100),
    memory: e.id === cfo()?.id
      ? `${financeBrief(state, fmt)} مستحقات العملاء غير المحصّلة: ${fmt(receivables(state))} ${state.finance.currency}. ${memoryOf(e)}`.slice(0, 1150)
      : memoryOf(e),
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

function renderRoster() {
  const r = $('#roster');
  fill(r, ...[...state.employees].sort(byRank).map((e) =>
    h('button', { class: `chip${e.id === selectedId ? ' selected' : ''}`, onclick: () => selectEmployee(e.id) },
      h('span', { class: `dot ${e.status || 'idle'}` }),
      avatar(e),
      h('span', {}, e.name, h('small', {}, titleFor(e))))));
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
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
  activeTab = b.dataset.tab;
  renderPanel();
}));

function renderPanel() {
  const e = emp(selectedId);
  if (!e) return closePanel();
  $('#p-avatar').replaceWith(Object.assign(avatar(e), { id: 'p-avatar' }));
  $('#p-name').textContent = e.name;
  $('#p-title').textContent = `${titleFor(e)} · ${DEPARTMENTS[e.dept].name}`;
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === activeTab));
  document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('active', p.dataset.pane === activeTab));
  if (activeTab === 'chat') renderChat(e);
  if (activeTab === 'tasks') renderEmpTasks(e);
  if (activeTab === 'profile') renderProfile(e);
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
      const parsed = parseFinanceOrders(raw, state.employees);
      raw = parsed.text;
      financeNote = applyFinanceOrders(parsed.orders, e);
    }
    const { text: reply, order } = extractAssignOrder(raw, e);
    history.push({ role: 'assistant', content: reply || 'حاضر.' });
    if (financeNote) history.push({ role: 'assistant', content: financeNote });
    if (order) {
      save();
      const added = await assignTeamTasks(e, order.ids, order.perMember, order.focus);
      if (added?.length) {
        const lines = order.ids.map((id) => {
          const titles = added.filter((t) => t.empId === id).map((t) => t.title);
          return titles.length ? `- ${emp(id)?.name}: ${titles.join('، ')}` : null;
        }).filter(Boolean);
        history.push({ role: 'assistant', content: `✅ تم التكليف:\n${lines.join('\n')}` });
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
  addTask(selectedId, title, $('#task-desc').value.trim(), $('#task-priority').value, null, $('#task-project').value || null);
  ev.target.reset();
  $('#task-priority').value = 'medium';
  toast('تمت إضافة المهمة');
});

function addTask(empId, title, description, priority, assignedBy = null, projectId = null) {
  state.tasks.push({ id: newId(state, 't'), empId, title, description, priority, status: 'todo', output: '', createdAt: Date.now(), assignedBy,
    ...(project(projectId) ? { projectId } : {}) });
  save();
  refresh();
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
  busy.add(e.id);
  await office.recall(e.id);
  t.status = 'doing';
  t.reviews ||= [];
  setStatus(e, 'working', `⌨️ ${t.title}`);
  office.setDeskLit(e.desk, true);
  refresh();
  const mgr = e.managerId ? emp(e.managerId) : null;
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
  const next = LADDER[e.level + 1];
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
function extractAssignOrder(reply, manager) {
  const m = reply.match(/\[\[\s*تكليف\s*:([^\]]*)\]\]/);
  if (!m) return { text: reply.trim(), order: null };
  const text = reply.replace(m[0], '').trim();
  const team = teamOf(manager.id);
  if (!team.length) return { text, order: null };
  const [who = '', count = '', focus = ''] = m[1].split('|').map((x) => x.trim());
  const names = who.split(/[،,]| و/).map((x) => x.trim()).filter(Boolean);
  const all = !names.length || names.some((n) => /^(ال)?كل|الجميع|الفريق/.test(n));
  const ids = all ? team.map((x) => x.id) : team.filter((x) => names.some((n) => n.includes(x.name) || x.name.includes(n))).map((x) => x.id);
  if (!ids.length) return { text, order: null };
  const digits = count.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const perMember = Math.min(3, Math.max(1, parseInt(digits, 10) || 2));
  return { text, order: { ids, perMember, focus: focus.slice(0, 300) } };
}

async function assignTeamTasks(manager, onlyIds = null, perMember = 2, focus = '') {
  const members = teamOf(manager.id).filter((m) => !onlyIds || onlyIds.includes(m.id));
  if (!members.length) return toast(`لا يوجد موظفون تحت إدارة ${manager.name}`);
  return assignTasks(manager, members, perMember, focus, null);
}

// A project lead splits the project into tasks for the project team.
async function assignProjectTasks(p) {
  const lead = emp(p.leadId);
  if (!lead) return toast('حدد قائداً للمشروع أولاً');
  const members = p.team.map(emp).filter(Boolean);
  if (!members.length) return toast('أضف أعضاء إلى فريق المشروع أولاً');
  return assignTasks(lead, members, 2, '', p);
}

async function assignTasks(manager, members, perMember, focus, proj) {
  const key = `assign:${manager.id}`;
  if (busy.has(key)) return;
  busy.add(key);
  const prev = manager.status;
  setStatus(manager, 'talking', '📋 توزّع المهام');
  refresh();
  const brief = members.map((m) => {
    const open = openTitles(m.id);
    return `- empId: ${m.id} | ${m.name} | ${titleFor(m)} | قسم ${DEPARTMENTS[m.dept].name} | المهارات: ${DEPARTMENTS[m.dept].skills}` +
      ` | مهامه المفتوحة: ${open.length ? open.join('، ') : 'لا شيء'}`;
  }).join('\n');
  let tasks = [];
  try {
    const ctx = proj ? projectContext(state, proj.id) : '';
    const reply = await ask(manager, 'assign', [{ role: 'user', content:
      `${ctx ? `أنت قائد هذا المشروع، والمطلوب تقسيمه إلى مهام لفريقه.\n${ctx}\n\n` : ''}فريقك:\n${brief}\n\n` +
      `كلّف كل عضو بـ${perMember === 1 ? 'مهمة واحدة' : `${perMember} مهام`} خاصة بوظيفته${proj ? ' تخدم هذا المشروع مباشرة' : ''}.` +
      (focus ? `\nطلب المالك أن تركّز المهام على: ${focus}` : '') }]);
    tasks = parseAssignments(reply, members);
  } catch (err) {
    toast(err.message);
  }
  if (!tasks.length && !proj) tasks = libraryAssignments(members, perMember);
  if (!tasks.length && proj) toast('تعذّر الحصول على مهام للمشروع. حاول مرة أخرى.');
  for (const t of tasks) addTask(t.empId, t.title, t.description, t.priority, manager.id, proj ? proj.id : null);
  busy.delete(key);
  setStatus(manager, prev === 'talking' ? 'idle' : prev);
  const got = [...new Set(tasks.map((t) => t.empId))];
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
async function startWorkday() {
  if (workdayRunning) return;
  workdayRunning = true;
  $('#btn-workday').disabled = true;
  $('#btn-workday').textContent = '⏳ الفريق يعمل…';
  if (!state.tasks.some((t) => t.status === 'todo' && !meeting?.attendees.includes(t.empId))) {
    workdayRunning = false;
    $('#btn-workday').disabled = false;
    $('#btn-workday').textContent = '▶ ابدأ يوم العمل';
    return toast('لا توجد مهام في الانتظار. اطلب من سارة تكليف الفريق، أو أضف مهاماً من لوحة المهام.');
  }
  const order = { high: 0, medium: 1, low: 2 };
  await Promise.all(state.employees.map(async (e) => {
    for (;;) {
      if (meeting?.attendees.includes(e.id)) return;
      const next = state.tasks.filter((t) => t.empId === e.id && t.status === 'todo')
        .sort((a, b) => order[a.priority] - order[b.priority])[0];
      if (!next) return;
      await runTask(next.id);
      if (next.status !== 'done') return; // stop this employee's queue on error
    }
  }));
  workdayRunning = false;
  $('#btn-workday').disabled = false;
  $('#btn-workday').textContent = '▶ ابدأ يوم العمل';
  toast('🏁 انتهى يوم العمل');
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
  $('#out-copy').onclick = () => navigator.clipboard?.writeText(t.output).then(() => toast('تم النسخ'), () => toast('تعذّر النسخ'));
  $('#dlg-output').showModal();
}

// ---- profile, promotion, termination
function renderProfile(e) {
  const level = LADDER[e.level];
  const next = LADDER[e.level + 1];
  const pct = next ? Math.min(100, Math.round(((e.xp - level.xp) / (next.xp - level.xp)) * 100)) : 100;
  const eligible = next && e.xp >= next.xp;
  const mgr = e.managerId ? emp(e.managerId) : null;
  const reports = state.employees.filter((x) => x.managerId === e.id);
  const done = state.tasks.filter((t) => t.empId === e.id && t.status === 'done').length;

  const titleInput = h('input', { maxlength: 60, placeholder: titleFor({ ...e, customTitle: '' }), value: e.customTitle || '' });
  const mgrSelect = h('select', {},
    h('option', { value: '' }, 'مالك الوكالة مباشرة'),
    state.employees.filter((x) => x.id !== e.id && !isUnder(x.id, e.id))
      .map((x) => h('option', { value: x.id, selected: x.id === e.managerId }, `${x.name} — ${titleFor(x)}`)));

  fill($('#profile-pane'), 
    h('div', { class: 'card' },
      h('dl', { class: 'kv' },
        h('dt', {}, 'المسمى'), h('dd', {}, titleFor(e)),
        h('dt', {}, 'القسم'), h('dd', {}, DEPARTMENTS[e.dept].name),
        h('dt', {}, 'المستوى'), h('dd', {}, `${e.level + 1} / ${LADDER.length} — ${level.name}`),
        h('dt', {}, 'المدير'), h('dd', {}, mgr ? mgr.name : 'مالك الوكالة'),
        h('dt', {}, 'المرؤوسون'), h('dd', {}, reports.length ? reports.map((r) => r.name).join('، ') : '—'),
        h('dt', {}, 'مهام منجزة'), h('dd', {}, String(done)),
        h('dt', {}, 'المهارات'), h('dd', {}, DEPARTMENTS[e.dept].skills),
        h('dt', {}, 'العمر'), h('dd', {}, `${bioFor(e).age} سنة · خبرة ${bioFor(e).years} ${bioFor(e).years > 10 ? 'سنة' : 'سنوات'}`),
        h('dt', {}, 'الخلفية'), h('dd', {}, bioFor(e).background),
        h('dt', {}, 'أسلوبه'), h('dd', {}, bioFor(e).style))),
    h('div', { class: 'card' },
      h('h3', {}, 'التقدم الوظيفي'),
      h('div', { class: 'progress' }, h('i', { style: `width:${pct}%` })),
      h('p', { class: 'muted' }, next
        ? `${e.xp} نقطة خبرة · الترقية إلى "${next.name}" عند ${next.xp} نقطة${eligible ? ' — ✅ مستحق للترقية' : ''}`
        : `${e.xp} نقطة خبرة · وصل إلى قمة السلم الوظيفي`),
      h('div', { class: 'row' },
        h('button', { class: eligible ? 'primary' : '', disabled: !next, onclick: () => changeLevel(e, 1) }, '⬆️ ترقية'),
        h('button', { disabled: e.level === 0, onclick: () => changeLevel(e, -1) }, '⬇️ تخفيض'))),
    h('div', { class: 'card' },
      h('h3', {}, 'تعديل'),
      h('label', {}, 'مسمى وظيفي مخصص (اتركه فارغاً للمسمى التلقائي)', titleInput),
      h('label', {}, 'المدير المباشر', mgrSelect),
      h('button', { onclick: () => {
        e.customTitle = titleInput.value.trim();
        e.managerId = mgrSelect.value || null;
        save();
        refresh();
        toast('تم حفظ التعديلات');
      } }, 'حفظ')),
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
  const to = e.level + delta;
  if (to < 0 || to >= LADDER.length) return;
  e.level = to;
  if (delta > 0 && e.xp < LADDER[to].xp) e.xp = LADDER[to].xp;
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
  toast(`تم إنهاء خدمة ${e.name}`);
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
  fill($('#hire-level'), ...LADDER.map((l, i) => h('option', { value: i, selected: i === 1 }, l.name)));
  fill($('#hire-manager'), h('option', { value: '' }, 'مالك الوكالة مباشرة'),
    ...[...state.employees].sort(byRank).map((x, i) => h('option', { value: x.id, selected: i === 0 }, `${x.name} — ${titleFor(x)}`)));
  $('#hire-takeover-row').hidden = true;
  fill($('#hire-position'), h('option', { value: '' }, 'منصب مخصص (اختر القسم والمستوى)'),
    ...POSITIONS.map((p) => {
      const holder = p.unique && positionHolder(p);
      return h('option', { value: p.key, disabled: Boolean(holder) }, holder ? `${p.name} (يشغله ${holder.name})` : p.name);
    }));
  updateHirePreview();
}
const positionHolder = (p) => state.employees.find((x) => x.dept === p.dept && x.level === p.level && !x.customTitle);
$('#hire-position').addEventListener('change', () => {
  const p = POSITIONS.find((x) => x.key === $('#hire-position').value);
  if (!p) return;
  $('#hire-dept').value = p.dept;
  $('#hire-level').value = String(p.level);
  // Report to the next post up: CEO to the owner, GM to the CEO, department heads to the GM or CEO.
  const ceo = positionHolder(POSITIONS[0]);
  const gm = positionHolder(POSITIONS[1]);
  const top = [...state.employees].sort(byRank)[0];
  const boss = p.key === 'ceo' ? null : p.key === 'gm' || p.reportsTo === 'ceo' ? ceo || gm || top : gm || ceo || top;
  $('#hire-manager').value = boss ? boss.id : '';
  updateHirePreview();
});
// Who would move under a newly hired CEO or GM: everyone currently reporting
// to the same boss the new hire reports to (the owner, or the CEO for a GM).
function takeoverCandidates() {
  const pos = $('#hire-position').value;
  if (pos !== 'ceo' && pos !== 'gm') return [];
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
$('#dlg-hire').addEventListener('close', () => {
  if ($('#dlg-hire').returnValue !== 'ok') return;
  const name = $('#hire-name').value.trim();
  const level = Number($('#hire-level').value);
  const desk = freeSeat(state, level);
  if (!name) return;
  if (desk === undefined) return toast(level >= MANAGER_LEVEL ? 'لا يوجد مكتب شاغر.' : 'لا يوجد مكتب شاغر في المساحة المفتوحة.');
  const takeover = $('#hire-takeover').checked ? takeoverCandidates() : [];
  const e = {
    id: newId(state, 'e'), name, gender: $('#hire-gender').value, dept: $('#hire-dept').value,
    level, xp: LADDER[level].xp, personality: $('#hire-personality').value.trim(),
    salary: Number($('#hire-salary').value) > 0 ? Math.round(Number($('#hire-salary').value)) : defaultSalary(level),
    desk, managerId: $('#hire-manager').value || null, hiredAt: Date.now(), status: 'idle',
  };
  state.employees.push(e);
  for (const x of takeover) x.managerId = e.id;
  office.addEmployee(actorOf(e), titleFor(e));
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
    addTask(assign.value, title.value.trim(), desc.value.trim(), prio.value, null, proj.value || null);
    toast('تمت إضافة المهمة');
  } }, h('h3', {}, 'تكليف جديد'), h('label', {}, 'الموظف', assign), title, desc, prio, proj, h('button', { class: 'primary', type: 'submit' }, 'إضافة'));
  cols[0].firstChild.after(form);
  fill($('#board'), ...cols);
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
  fill($('#ladder'), ...LADDER.map((l, i) => {
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
  // Preselect the most senior people, few enough to fit the smaller room.
  const fits = Math.min(...Object.values(ROOMS).map((r) => r.seats));
  fill($('#meet-people'), ...[...state.employees].sort(byRank).map((e, i) =>
    h('label', { title: titleFor(e) }, h('input', { type: 'checkbox', value: e.id, checked: i < fits, onchange: updateSeatCount }), `${e.name}`)));
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
  if (attendees.length < 1) return toast('اختر موظفاً واحداً على الأقل (غير مشغول بمهمة)');
  if (attendees.length > ROOMS[room].seats) return toast(`${ROOMS[room].name} تتسع لـ${ROOMS[room].seats} فقط`);
  if (attendees.length < picked.length) toast('بعض الموظفين مشغولون بمهام وسيلحقون لاحقاً');
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

function renderApprovalsBadge() {
  const n = pendingForOwner(state).length;
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

function renderApprovals() {
  const waiting = pendingForOwner(state);
  const moving = inReview(state);
  const closed = (state.bonusRequests || []).filter((r) => r.status === 'approved' || r.status === 'rejected').slice(-20).reverse();
  fill($('#approvals-body'), 
    h('p', { class: 'muted' }, 'المكافآت لا تُصرف تلقائياً. يرشّح المدير صاحب العمل المتميز، ثم يمر الطلب على مدير الموارد البشرية، ثم المدير المالي، ثم المدير التنفيذي، ثم يصل إليك. لا يُسجَّل شيء في الرواتب إلا باعتمادك.'),
    h('h3', {}, `بانتظار موافقتك (${waiting.length})`),
    waiting.length ? h('div', { class: 'clients-list' }, ...waiting.map((r) => requestCard(r, { actions: true }))) : h('div', { class: 'empty' }, 'لا يوجد ما ينتظر موافقتك.'),
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
    h('div', { class: 'actions' },
      p.status === 'active' || p.status === 'proposal'
        ? h('button', { class: 'small primary', disabled: !lead || busy.has(`assign:${p.leadId}`), onclick: () => assignProjectTasks(p).then(() => renderClients()) },
          `📋 ${lead ? `${lead.name} يوزّع المهام` : 'توزيع المهام'}`) : null,
      p.status === 'proposal' && lead
        ? h('button', { class: 'small', onclick: () => requestProposal(p) }, '📝 كتابة العرض') : null,
      outstanding(p) > 0 && p.status !== 'cancelled' ? h('button', { class: 'small', onclick: () => openPay(p) }, '💵 تحصيل دفعة') : null,
      h('button', { class: 'small', onclick: () => openMeetingFor(p) }, '👥 اجتماع'),
      h('button', { class: 'small', onclick: () => showProjectTasks(p) }, '📋 المهام'),
      h('button', { class: 'small', onclick: () => openProjectForm(p) }, '✏️ تعديل')));
}

function renderClients() {
  document.querySelectorAll('[data-crm]').forEach((b) => b.classList.toggle('active', b.dataset.crm === crmTab));
  const body = $('#crm-body');
  if (crmTab === 'projects') {
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
        c.notes ? h('p', { class: 'brief' }, c.notes) : null,
        h('div', { class: 'money' }, h('span', {}, `${countOf(tot.projects, PROJECTS_WORD)} · ${money(tot.fee)}`), h('span', { class: 'muted' }, `متبقٍ ${fmt(tot.owed)}`)),
        h('div', { class: 'actions' },
          h('button', { class: 'small primary', onclick: () => openProjectForm(null, c.id) }, '＋ مشروع'),
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

let payingProject = null;
function openPay(p) {
  payingProject = p.id;
  $('#pay-form').reset();
  $('#pay-info').textContent = `${clientOf(p)?.name} · ${p.name} — المتبقي ${money(outstanding(p))}`;
  $('#pay-amount').max = String(outstanding(p));
  $('#pay-amount').value = String(outstanding(p));
  $('#dlg-pay').showModal();
}
$('#dlg-pay').addEventListener('close', () => {
  if ($('#dlg-pay').returnValue !== 'ok' || !payingProject) return;
  try {
    const entry = recordPayment(state, payingProject, Number($('#pay-amount').value), { note: $('#pay-note').value.trim() });
    save();
    toast(`💵 سُجّلت دفعة ${money(entry.amount)} في الدفتر`);
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
  const people = [p.leadId, ...p.team].filter((id) => emp(id)).slice(0, Math.max(...Object.values(ROOMS).map((r) => r.seats)));
  document.querySelectorAll('#meet-people input').forEach((i) => { i.checked = people.includes(i.value); });
  if (people.length > ROOMS.b.seats) $('#meet-room').value = 'a';
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
        done.push(`- ${ADJ_TYPES[o.type].name} لـ${e.name}: ${o.type === 'overtime' ? `${hoursLabel(a.hours)} = ` : ''}${money(a.amount)}${o.type === 'raise' ? ` (الراتب الآن ${money(e.salary)})` : ''}${a.reason ? ` — ${a.reason}` : ''}`);
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
        h('td', { class: `num ${a.type === 'deduction' ? 'minus' : 'plus'}` }, (a.type === 'deduction' ? '−' : '+') + fmt(a.amount)),
        h('td', {}, a.reason || '—'),
        h('td', {}, a.by === 'owner' ? 'المالك' : emp(a.by)?.name || '—'),
        h('td', {}, a.type === 'raise' ? `${fmt(a.from)} ← ${fmt(a.to)}` : a.paid ? `صُرفت (${periodLabel(a.period)})` : 'مفتوحة'))))))
      : h('div', { class: 'empty' }, 'لا توجد حركات بعد.'));
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
      h('td', { class: `num ${l.type === 'income' ? 'plus' : 'minus'}` }, (l.type === 'income' ? '+' : '−') + fmt(l.amount))));
    fill(body, form,
      h('p', { class: 'muted' }, `الرصيد الافتتاحي ${money(fin.openingBalance)} · الرصيد الحالي ${money(balance(state))}`),
      rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'fin' },
        h('thead', {}, h('tr', {}, ...['التاريخ', 'النوع', 'البند', 'ملاحظة', 'المبلغ'].map((x) => h('th', {}, x)))),
        h('tbody', {}, ...rows))) : h('div', { class: 'empty' }, 'لا توجد قيود بعد. سجّل دفعات العملاء والمصروفات هنا.'));
  } else {
    const field = (label, id, value, attrs = {}) => h('label', {}, label, h('input', { id, value: String(value), ...attrs }));
    const form = h('form', { class: 'form-grid card', onsubmit: (ev) => {
      ev.preventDefault();
      const num = (id) => Number($(`#${id}`).value);
      const vals = { ob: num('fs-ob'), ot: num('fs-ot'), hrs: num('fs-hrs'), low: num('fs-low'), med: num('fs-med'), high: num('fs-high') };
      if (Object.values(vals).some((v) => !Number.isFinite(v) || v < 0) || vals.ot < 1 || vals.hrs < 1) return toast('تحقق من الأرقام: يجب أن تكون موجبة.');
      fin.currency = $('#fs-cur').value.trim().slice(0, 8) || fin.currency;
      fin.openingBalance = vals.ob;
      fin.overtimeRate = vals.ot;
      fin.monthlyHours = vals.hrs;
      fin.taskBonus = { low: vals.low, medium: vals.med, high: vals.high };
      save();
      renderFinance();
      toast('تم حفظ الإعدادات المالية');
    } },
    field('العملة', 'fs-cur', fin.currency, { maxlength: 8 }),
    field('الرصيد الافتتاحي', 'fs-ob', fin.openingBalance, { type: 'number', min: '0', step: 'any' }),
    field('معامل العمل الإضافي', 'fs-ot', fin.overtimeRate, { type: 'number', min: '1', step: '0.25' }),
    field('ساعات العمل الشهرية', 'fs-hrs', fin.monthlyHours, { type: 'number', min: '1' }),
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
document.querySelectorAll('#nav-pad button').forEach((b) => {
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
  renderHeader();
  renderApprovalsBadge();
  renderRoster();
  for (const e of state.employees) office.updateEmployee(e, titleFor(e));
  for (let k = 0; k < PRIVATE_OFFICES; k++) {
    const who = state.employees.find((e) => e.desk === OPEN_DESKS + k);
    const label = k === 0 ? (who ? `جناح المدير التنفيذي · ${who.name}` : 'جناح المدير التنفيذي (شاغر)') : who ? `مكتب ${who.name}` : 'مكتب شاغر';
    office.setOfficeLabel(k, label, Boolean(who));
  }
  if (selectedId) renderPanel();
  if ($('#dlg-board').open) renderBoard();
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
  refresh();
}

state.employees.forEach((e) => office.addEmployee(actorOf(e), titleFor(e)));
refresh();
saveState(state);

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
