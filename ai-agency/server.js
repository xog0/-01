// Minimal HTTP server: serves the 3D office (public/) and proxies chat
// requests to Claude so the API key never reaches the browser.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { validateChatRequest, buildSystemPrompt, ValidationError } from './public/js/prompt.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(here, 'public');
const THREE_DIR = path.join(here, 'node_modules', 'three');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const MODEL = process.env.AGENCY_MODEL || 'claude-opus-5-5';
const MAX_BODY_BYTES = 300_000;
const RATE_LIMIT = { windowMs: 60_000, max: Number(process.env.RATE_LIMIT_PER_MIN) || 120 };

const hasKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const client = hasKey ? new Anthropic() : null;
if (!hasKey) {
  console.warn('⚠️  ANTHROPIC_API_KEY غير مضبوط — سيعمل التطبيق في الوضع التجريبي بردود جاهزة.');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// The page uses one inline <script type="importmap">; allow exactly that script by hash.
const indexHtml = readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
const importMap = indexHtml.match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1] ?? '';
const importMapHash = crypto.createHash('sha256').update(importMap).digest('base64');

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    `default-src 'self'; script-src 'self' 'sha256-${importMapHash}'; style-src 'self' https://fonts.googleapis.com; ` +
    `font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'`,
};

// --- rate limiting (per IP, fixed window) ---------------------------------
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT.windowMs) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT.max;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of hits) if (now - e.start > RATE_LIMIT.windowMs) hits.delete(ip);
}, RATE_LIMIT.windowMs).unref();

// --- helpers --------------------------------------------------------------
function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}
function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new ValidationError('حجم الطلب كبير جداً'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function serveFile(res, root, relPath) {
  const target = path.normalize(path.join(root, relPath));
  if (target !== root && !target.startsWith(root + path.sep)) return send(res, 403, 'Forbidden');
  try {
    const data = await fs.readFile(target);
    const type = MIME[path.extname(target)] || 'application/octet-stream';
    send(res, 200, data, { 'Content-Type': type });
  } catch {
    send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
}

// --- Claude call ----------------------------------------------------------
const MAX_TOKENS = { chat: 2000, meeting: 800, task: 8000, summary: 1500, assign: 4000, review: 800, memo: 1500, bonus: 600, evaluation: 1200, client_review: 800 };

async function askClaude(req) {
  const system = buildSystemPrompt(req);
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS[req.mode],
    output_config: { effort: req.mode === 'task' ? 'medium' : 'low' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    messages: req.messages,
  });
  if (response.stop_reason === 'refusal') {
    return { reply: 'أعتذر، لا أستطيع المساعدة في هذا الطلب. هل يمكننا تناول الموضوع من زاوية أخرى؟' };
  }
  const reply = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  return { reply: reply || '…', truncated: response.stop_reason === 'max_tokens' };
}

async function handleChat(req, res) {
  let parsed;
  try {
    const raw = await readBody(req);
    parsed = validateChatRequest(JSON.parse(raw));
  } catch (err) {
    const msg = err instanceof ValidationError ? err.message : 'صيغة الطلب غير صالحة';
    return sendJson(res, 400, { error: msg });
  }
  if (!client) return sendJson(res, 200, { demo: true });

  try {
    sendJson(res, 200, await askClaude(parsed));
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return sendJson(res, 429, { error: 'الضغط مرتفع على الخدمة، حاول بعد قليل.' });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('Claude auth failed — check ANTHROPIC_API_KEY');
      return sendJson(res, 502, { error: 'تعذّر الاتصال بخدمة الذكاء الاصطناعي (مفتاح غير صالح).' });
    }
    if (err instanceof Anthropic.APIError) {
      console.error('Claude API error', err.status, err.message);
      return sendJson(res, 502, { error: 'خدمة الذكاء الاصطناعي غير متاحة الآن.' });
    }
    console.error('Unexpected error', err);
    return sendJson(res, 500, { error: 'حدث خطأ غير متوقع.' });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const ip = req.socket.remoteAddress || 'unknown';

  if (url.pathname.startsWith('/api/')) {
    if (rateLimited(ip)) return sendJson(res, 429, { error: 'طلبات كثيرة، انتظر دقيقة.' });
    if (url.pathname === '/api/status' && req.method === 'GET') {
      return sendJson(res, 200, { ai: Boolean(client), model: client ? MODEL : null });
    }
    if (url.pathname === '/api/chat' && req.method === 'POST') {
      if (!(req.headers['content-type'] || '').startsWith('application/json')) {
        return sendJson(res, 415, { error: 'يجب إرسال JSON' });
      }
      return handleChat(req, res);
    }
    return sendJson(res, 404, { error: 'غير موجود' });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  if (url.pathname.startsWith('/vendor/three/')) {
    return serveFile(res, THREE_DIR, decodeURIComponent(url.pathname.slice('/vendor/three/'.length)));
  }
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  return serveFile(res, PUBLIC_DIR, rel);
});

server.listen(PORT, HOST, () => {
  console.log(`🏢 الوكالة تعمل على http://${HOST}:${PORT}  (${client ? `الذكاء الاصطناعي: ${MODEL}` : 'وضع تجريبي'})`);
});
