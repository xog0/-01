import { createOffice, MAX_DESKS, ROOMS } from './scene.js';
import {
  LADDER, DEPARTMENTS, TASK_XP, PRIORITY_NAMES, STATUS_NAMES,
  titleFor, loadState, saveState, createInitialState, newId,
} from './data.js';
import { askEmployee, backendStatus } from './api.js';
import { connectCloud } from './cloud.js';

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

function personaOf(e) {
  const mgr = e.managerId ? emp(e.managerId) : null;
  return {
    name: e.name,
    title: titleFor(e),
    level: LADDER[e.level].name,
    department: DEPARTMENTS[e.dept].name,
    skills: DEPARTMENTS[e.dept].skills,
    personality: e.personality || '',
    manager: mgr ? `${mgr.name} (${titleFor(mgr)})` : 'مالك الوكالة مباشرة',
  };
}
function companyOf(except) {
  return {
    name: state.company.name,
    about: state.company.about || '',
    team: state.employees.filter((x) => x.id !== except).map((x) => `${x.name} (${titleFor(x)})`).join('، '),
  };
}
function ask(e, mode, messages) {
  return askEmployee({ mode, persona: personaOf(e), company: companyOf(e.id), messages });
}

// ------------------------------------------------------------ 3D office
const office = createOffice($('#stage'), { onSelect: (id) => selectEmployee(id) });

function setStatus(e, status, bubble = '') {
  e.status = status;
  office.setStatus(e.id, status, bubble);
  renderRoster();
}

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
  r.replaceChildren(...[...state.employees].sort(byRank).map((e) =>
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
  log.replaceChildren(...items);
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
  const prev = e.status;
  setStatus(e, 'talking', '💬');
  renderPanel();
  try {
    const reply = await ask(e, 'chat', history.slice(-30));
    history.push({ role: 'assistant', content: reply });
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
  const running = t.status === 'doing';
  return h('div', { class: `task ${t.status}` },
    h('h4', {}, t.title),
    t.description ? h('p', {}, t.description) : null,
    h('div', { class: 'meta' },
      showOwner && owner ? h('span', { class: 'badge' }, `👤 ${owner.name}`) : null,
      h('span', { class: `badge ${t.priority}` }, `أولوية ${PRIORITY_NAMES[t.priority]}`),
      h('span', { class: `badge ${t.status}` }, running ? `${STATUS_NAMES.doing}…` : STATUS_NAMES[t.status]),
      t.status === 'done' ? h('span', { class: 'badge' }, `+${TASK_XP[t.priority]} خبرة`) : null),
    h('div', { class: 'row' },
      t.status === 'todo' ? h('button', { class: 'small primary', onclick: () => runTask(t.id) }, '▶ نفّذ الآن') : null,
      t.status === 'done' ? h('button', { class: 'small', onclick: () => showOutput(t) }, '📄 عرض النتيجة') : null,
      t.status === 'done' ? h('button', { class: 'small', onclick: () => redoTask(t.id) }, '↺ إعادة') : null,
      !running ? h('button', { class: 'small danger', onclick: () => deleteTask(t.id) }, 'حذف') : null));
}

function renderEmpTasks(e) {
  const list = state.tasks.filter((t) => t.empId === e.id)
    .sort((a, b) => ['doing', 'todo', 'done'].indexOf(a.status) - ['doing', 'todo', 'done'].indexOf(b.status));
  $('#emp-tasks').replaceChildren(...(list.length ? list.map((t) => taskCard(t)) : [h('div', { class: 'empty' }, 'لا توجد مهام لهذا الموظف.')]));
}

$('#task-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const title = $('#task-title').value.trim();
  if (!title || !selectedId) return;
  addTask(selectedId, title, $('#task-desc').value.trim(), $('#task-priority').value);
  ev.target.reset();
  $('#task-priority').value = 'medium';
  toast('تمت إضافة المهمة');
});

function addTask(empId, title, description, priority) {
  state.tasks.push({ id: newId(state, 't'), empId, title, description, priority, status: 'todo', output: '', createdAt: Date.now() });
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

async function runTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  const e = t && emp(t.empId);
  if (!t || !e || t.status !== 'todo') return;
  if (busy.has(e.id)) return toast(`${e.name} مشغول بمهمة أخرى الآن`);
  if (meeting?.attendees.includes(e.id)) return toast(`${e.name} في اجتماع الآن`);
  busy.add(e.id);
  t.status = 'doing';
  setStatus(e, 'working', `⌨️ ${t.title}`);
  office.setDeskLit(e.desk, true);
  refresh();
  try {
    const prompt = `المهمة: ${t.title}\n\nالتفاصيل: ${t.description || 'لا توجد تفاصيل إضافية، استخدم خبرتك.'}\n\nالأولوية: ${PRIORITY_NAMES[t.priority]}`;
    t.output = await ask(e, 'task', [{ role: 'user', content: prompt }]);
    t.status = 'done';
    t.doneAt = Date.now();
    const before = e.xp;
    e.xp += TASK_XP[t.priority];
    const next = LADDER[e.level + 1];
    if (next && before < next.xp && e.xp >= next.xp) toast(`🎉 ${e.name} أصبح مستحقاً للترقية إلى "${next.name}"`);
    else toast(`✅ ${e.name} أنهى: ${t.title}`);
  } catch (err) {
    t.status = 'todo';
    toast(err.message);
  } finally {
    busy.delete(e.id);
    setStatus(e, meeting?.attendees.includes(e.id) ? 'meeting' : 'idle');
    save();
    refresh();
  }
}

// Each employee works through their own queue; employees work in parallel.
async function startWorkday() {
  if (workdayRunning) return;
  const hasWork = () => state.tasks.some((t) => t.status === 'todo' && !meeting?.attendees.includes(t.empId));
  if (!hasWork()) return toast('لا توجد مهام في الانتظار. أضف مهاماً من لوحة المهام.');
  workdayRunning = true;
  $('#btn-workday').disabled = true;
  $('#btn-workday').textContent = '⏳ الفريق يعمل…';
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
  $('#out-body').replaceChildren(richText(t.output || ''));
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

  $('#profile-pane').replaceChildren(
    h('div', { class: 'card' },
      h('dl', { class: 'kv' },
        h('dt', {}, 'المسمى'), h('dd', {}, titleFor(e)),
        h('dt', {}, 'القسم'), h('dd', {}, DEPARTMENTS[e.dept].name),
        h('dt', {}, 'المستوى'), h('dd', {}, `${e.level + 1} / ${LADDER.length} — ${level.name}`),
        h('dt', {}, 'المدير'), h('dd', {}, mgr ? mgr.name : 'مالك الوكالة'),
        h('dt', {}, 'المرؤوسون'), h('dd', {}, reports.length ? reports.map((r) => r.name).join('، ') : '—'),
        h('dt', {}, 'مهام منجزة'), h('dd', {}, String(done)),
        h('dt', {}, 'المهارات'), h('dd', {}, DEPARTMENTS[e.dept].skills))),
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
  save();
  refresh();
  toast(delta > 0 ? `🎉 تمت ترقية ${e.name} إلى "${titleFor(e)}"` : `تم تعديل مستوى ${e.name} إلى "${titleFor(e)}"`);
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
  const free = MAX_DESKS - state.employees.length;
  $('#hire-capacity').textContent = free > 0 ? `المكاتب الشاغرة: ${free} من ${MAX_DESKS}` : 'لا توجد مكاتب شاغرة.';
  $('#hire-submit').disabled = free <= 0;
  $('#hire-dept').replaceChildren(...Object.entries(DEPARTMENTS).map(([k, d]) => h('option', { value: k }, d.name)));
  $('#hire-level').replaceChildren(...LADDER.map((l, i) => h('option', { value: i, selected: i === 1 }, l.name)));
  $('#hire-manager').replaceChildren(h('option', { value: '' }, 'مالك الوكالة مباشرة'),
    ...[...state.employees].sort(byRank).map((x, i) => h('option', { value: x.id, selected: i === 0 }, `${x.name} — ${titleFor(x)}`)));
  updateHirePreview();
}
function updateHirePreview() {
  const preview = { dept: $('#hire-dept').value, level: Number($('#hire-level').value) };
  $('#hire-preview').textContent = `المسمى الوظيفي: ${titleFor(preview)}`;
}
['#hire-dept', '#hire-level'].forEach((s) => $(s).addEventListener('change', updateHirePreview));
$('#btn-hire').addEventListener('click', () => { fillHireForm(); $('#dlg-hire').showModal(); });
$('#dlg-hire').addEventListener('close', () => {
  if ($('#dlg-hire').returnValue !== 'ok') return;
  const name = $('#hire-name').value.trim();
  const used = new Set(state.employees.map((x) => x.desk));
  const desk = [...Array(MAX_DESKS).keys()].find((i) => !used.has(i));
  if (!name || desk === undefined) return;
  const level = Number($('#hire-level').value);
  const e = {
    id: newId(state, 'e'), name, gender: $('#hire-gender').value, dept: $('#hire-dept').value,
    level, xp: LADDER[level].xp, personality: $('#hire-personality').value.trim(),
    desk, managerId: $('#hire-manager').value || null, hiredAt: Date.now(), status: 'idle',
  };
  state.employees.push(e);
  office.addEmployee({ ...e, color: colorOf(e) }, titleFor(e));
  save();
  $('#hire-form').reset();
  refresh();
  selectEmployee(e.id);
  toast(`👋 مرحباً بـ${e.name} في الفريق!`);
});

// ------------------------------------------------------------ task board
function renderBoard() {
  const filter = $('#board-filter').value;
  const tasks = state.tasks.filter((t) => !filter || t.empId === filter);
  const cols = ['todo', 'doing', 'done'].map((s) => {
    const list = tasks.filter((t) => t.status === s);
    return h('div', { class: 'column' },
      h('h3', {}, STATUS_NAMES[s], h('span', { class: 'badge' }, String(list.length))),
      ...list.map((t) => taskCard(t, { showOwner: true })));
  });
  const assign = h('select', {}, ...state.employees.map((x) => h('option', { value: x.id, selected: x.id === filter }, x.name)));
  const title = h('input', { maxlength: 200, placeholder: 'عنوان المهمة', required: true });
  const desc = h('textarea', { rows: 2, maxlength: 1500, placeholder: 'التفاصيل' });
  const prio = h('select', {}, ...Object.entries(PRIORITY_NAMES).map(([k, v]) => h('option', { value: k, selected: k === 'medium' }, `أولوية ${v}`)));
  const form = h('form', { class: 'column stack', onsubmit: (ev) => {
    ev.preventDefault();
    if (!title.value.trim() || !assign.value) return;
    addTask(assign.value, title.value.trim(), desc.value.trim(), prio.value);
    toast('تمت إضافة المهمة');
  } }, h('h3', {}, 'تكليف جديد'), h('label', {}, 'الموظف', assign), title, desc, prio, h('button', { class: 'primary', type: 'submit' }, 'إضافة'));
  cols[0].firstChild.after(form);
  $('#board').replaceChildren(...cols);
}
$('#btn-board').addEventListener('click', () => {
  const f = $('#board-filter');
  const keep = f.value;
  f.replaceChildren(h('option', { value: '' }, 'كل الموظفين'), ...state.employees.map((x) => h('option', { value: x.id }, x.name)));
  f.value = state.employees.some((x) => x.id === keep) ? keep : '';
  renderBoard();
  $('#dlg-board').showModal();
});
$('#board-filter').addEventListener('change', renderBoard);
$('#board-close').addEventListener('click', () => $('#dlg-board').close());

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
  $('#org-tree').replaceChildren(h('ul', {}, h('li', {},
    h('div', { class: 'org-node owner' }, h('div', { class: 'avatar', style: 'background:#7c5cff' }, '★'), h('span', {}, 'أنت', h('small', {}, 'مالك الوكالة'))),
    children(null))));
  $('#ladder').replaceChildren(...LADDER.map((l, i) => {
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
  $('#meet-room').replaceChildren(...Object.entries(ROOMS).map(([k, r]) => h('option', { value: k }, `${r.name} (${r.seats} مقاعد)`)));
  $('#meet-people').replaceChildren(...[...state.employees].sort(byRank).map((e) =>
    h('label', {}, h('input', { type: 'checkbox', value: e.id, checked: true }), `${e.name}`)));
  const hist = state.meetings.slice().reverse();
  $('#meet-history').hidden = !hist.length;
  $('#meet-history-list').replaceChildren(...hist.map((m) => h('div', { class: 'task' },
    h('h4', {}, m.topic),
    h('p', {}, `${ROOMS[m.room]?.name || ''} · ${new Date(m.at).toLocaleString('ar')}`),
    h('div', { class: 'row' }, h('button', { type: 'button', class: 'small', onclick: () => {
      $('#dlg-meeting').close();
      showOutput({ title: `محضر: ${m.topic}`, output: `${m.summary}\n\n— — —\n\n${m.log.map((l) => `${l.who}: ${l.text}`).join('\n\n')}`, doneAt: m.at });
    } }, '📄 المحضر')))));
}
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
  $('#m-log').replaceChildren(...items);
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
  renderRoster();
  for (const e of state.employees) office.updateEmployee(e, titleFor(e));
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
  state.employees.forEach((e) => office.addEmployee({ ...e, color: colorOf(e) }, titleFor(e)));
  refresh();
}

state.employees.forEach((e) => office.addEmployee({ ...e, color: colorOf(e) }, titleFor(e)));
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
    if (remote && !busy.size && !meeting) {
      applyState(remote);
      saveState(state);
    }
    cloud = c;
    if (!remote) cloud.save(state); // first visit: upload this agency
    setSync('saved');
  } catch {
    setSync('offline', 'تعذّر الوصول إلى الحفظ السحابي. التعديلات تُحفظ في هذا المتصفح فقط الآن.');
  }
});

backendStatus().then((s) => {
  const pill = $('#ai-mode');
  pill.textContent = s.label;
  pill.className = `mode-pill ${s.ai ? 'live' : 'demo'}`;
});
