// Cloud persistence through the Artifact `db` capability (claude.ai only).
// Each viewer's agency lives in their private subtree data/users/<id>/:
//   core                  company, employees, tasks (without outputs), counters
//   core/outputs/<task>   one task's delivered output
//   core/chats/<emp>      one employee's chat history
//   core/meetings/<id>    one meeting with its minutes
// Writes are diffed against what was last stored, so only changed
// documents are sent, one write at a time per document.

const MAX_DOC_CHARS = 90_000; // stays under the 256 KiB document cap for Arabic text
const LOAD_TIMEOUT_MS = 10_000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'timeout' })), ms)),
  ]);
}

function splitState(state) {
  const docs = new Map();
  docs.set('core', {
    v: 1,
    company: state.company,
    employees: state.employees.map(({ status, ...e }) => e),
    tasks: state.tasks.map(({ output, ...t }) => ({ ...t, hasOutput: Boolean(output) })),
    nextId: state.nextId,
  });
  for (const t of state.tasks) {
    if (t.output) docs.set(`outputs/${t.id}`, { text: t.output.slice(0, MAX_DOC_CHARS) });
  }
  for (const [empId, messages] of Object.entries(state.chats)) {
    if (!messages?.length) continue;
    // Keep the newest messages that fit in one document.
    const kept = [];
    let size = 0;
    for (let i = messages.length - 1; i >= 0 && kept.length < 120; i--) {
      size += messages[i].content.length;
      if (size > MAX_DOC_CHARS) break;
      kept.unshift(messages[i]);
    }
    docs.set(`chats/${empId}`, { messages: kept });
  }
  for (const m of state.meetings) {
    const id = m.id || `m${m.at}`;
    docs.set(`meetings/${id}`, { ...m, id, summary: (m.summary || '').slice(0, 20_000),
      log: m.log.map((l) => ({ ...l, text: l.text.slice(0, 4000) })) });
  }
  return docs;
}

export async function connectCloud() {
  if (!window.claude?.use) return null;
  const [db, user] = await Promise.all([
    window.claude.use('db').catch(() => null),
    window.claude.use('user').catch(() => null),
  ]);
  if (!db || !user) return null;
  const uid = await user.id().catch(() => null);
  if (!uid) return null;

  const core = db.doc(`data/users/${uid}/core`);
  const ref = (key) => (key === 'core' ? core : core.collection(key.split('/')[0]).doc(key.split('/')[1]));
  const written = new Map(); // key -> JSON last confirmed in the store
  let pending = null;
  let timer = null;
  let running = Promise.resolve();
  let enabled = false;
  const listeners = new Set();
  const emit = (status, detail) => listeners.forEach((fn) => fn(status, detail));

  async function load() {
    const snap = await withTimeout(core.get(), LOAD_TIMEOUT_MS);
    if (!snap.exists) {
      enabled = true;
      return null;
    }
    const c = snap.data();
    const [outputs, chats, meetings] = await withTimeout(Promise.all(
      ['outputs', 'chats', 'meetings'].map((name) => core.collection(name).get()),
    ), LOAD_TIMEOUT_MS);
    const byId = (qs) => Object.fromEntries(qs.docs.map((d) => [d.id, d.data()]));
    const out = byId(outputs);
    const state = {
      company: c.company,
      employees: c.employees.map((e) => ({ ...e, status: 'idle' })),
      tasks: c.tasks.map(({ hasOutput, ...t }) => ({
        ...t,
        output: out[t.id]?.text || '',
        status: t.status === 'doing' ? 'todo' : t.status,
      })),
      chats: Object.fromEntries(Object.entries(byId(chats)).map(([k, v]) => [k, v.messages || []])),
      meetings: Object.values(byId(meetings)).sort((a, b) => a.at - b.at),
      nextId: c.nextId,
    };
    // Record what is stored now so the first save only sends real changes.
    for (const [key, body] of splitState(state)) written.set(key, JSON.stringify(body));
    for (const d of outputs.docs) written.set(`outputs/${d.id}`, written.get(`outputs/${d.id}`) ?? '?');
    for (const d of chats.docs) written.set(`chats/${d.id}`, written.get(`chats/${d.id}`) ?? '?');
    for (const d of meetings.docs) written.set(`meetings/${d.id}`, written.get(`meetings/${d.id}`) ?? '?');
    enabled = true;
    return state;
  }

  async function flushNow() {
    if (!pending) return;
    const docs = splitState(pending);
    pending = null;
    emit('saving');
    try {
      for (const [key, body] of docs) {
        const json = JSON.stringify(body);
        if (written.get(key) === json) continue;
        await ref(key).set(body);
        written.set(key, json);
      }
      for (const key of [...written.keys()]) {
        if (docs.has(key)) continue;
        await ref(key).delete();
        written.delete(key);
      }
      emit('saved');
    } catch (err) {
      emit('error', err?.code === 'quota_exceeded'
        ? 'امتلأت مساحة الحفظ. احذف بعض المهام أو الاجتماعات القديمة.'
        : 'تعذّر الحفظ على السحابة. سيُعاد المحاولة مع التعديل التالي.');
      written.clear(); // resend everything next time rather than trust a partial write
    }
  }

  function save(state) {
    if (!enabled) return;
    pending = structuredClone(state);
    clearTimeout(timer);
    timer = setTimeout(() => { running = running.then(flushNow); }, 800);
  }

  function flush() {
    clearTimeout(timer);
    running = running.then(flushNow);
    return running;
  }

  return { load, save, flush, onStatus: (fn) => listeners.add(fn) };
}
