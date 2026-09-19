// Duka Bee API (Cloudflare Worker). Static pages are served by the assets binding; only /api/* runs here.
//   POST /api/leads        capture an "I want this store" request (public)
//   GET  /api/leads        list leads            (Authorization: Bearer <ADMIN_KEY>)
//   GET  /api/leads/<id>   one lead incl. draft  (Authorization: Bearer <ADMIN_KEY>)
// Leads live in a SQLite-backed Durable Object, so there is no database to provision by hand.
import { DurableObject } from 'cloudflare:workers';

const BEST_TIMES = ['Morning', 'Afternoon', 'Evening', 'Anytime'];
const MAX_DRAFT_CHARS = 1_500_000;
const MAX_PER_IP_PER_HOUR = 5;

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const normalisePhone = (v) => String(v || '').replace(/[^0-9]/g, '').replace(/^0/, '254').replace(/^7/, '2547').replace(/^1/, '2541');

export class Leads extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      store_name TEXT,
      best_time TEXT,
      wants_addons INTEGER NOT NULL DEFAULT 0,
      draft TEXT,
      ip TEXT
    )`);
  }

  add(lead) {
    if (lead.ip) {
      const since = new Date(Date.now() - 3600_000).toISOString();
      const n = this.sql.exec('SELECT COUNT(*) AS n FROM leads WHERE ip = ? AND created_at > ?', lead.ip, since).one().n;
      if (n >= MAX_PER_IP_PER_HOUR) return { limited: true };
    }
    const cur = this.sql.exec(
      'INSERT INTO leads (created_at, name, phone, store_name, best_time, wants_addons, draft, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
      new Date().toISOString(), lead.name, lead.phone, lead.storeName, lead.bestTime, lead.wantsAddons ? 1 : 0, lead.draft, lead.ip,
    ).one();
    return { id: cur.id };
  }

  list() {
    return this.sql.exec('SELECT id, created_at, name, phone, store_name, best_time, wants_addons, LENGTH(draft) AS draft_size FROM leads ORDER BY id DESC LIMIT 500').toArray();
  }

  get(id) {
    return this.sql.exec('SELECT id, created_at, name, phone, store_name, best_time, wants_addons, draft FROM leads WHERE id = ?', id).toArray()[0] || null;
  }
}

const isAdmin = (request, env) => {
  const key = env.ADMIN_KEY;
  if (!key) return false;
  const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  // Constant-time-ish compare: avoid early exit on the first differing character.
  if (given.length !== key.length) return false;
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
};

async function createLead(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid request.' }, 400); }
  // Honeypot: real people never fill this hidden field. Pretend success so bots don't retry.
  if (body.website) return json({ ok: true });

  const name = clean(body.name, 80);
  const phone = normalisePhone(clean(body.phone, 30));
  const storeName = clean(body.storeName, 80);
  const bestTime = BEST_TIMES.includes(body.bestTime) ? body.bestTime : 'Anytime';
  if (name.length < 2) return json({ ok: false, error: 'Please add your name.', field: 'name' }, 400);
  if (phone.length < 11 || phone.length > 15) return json({ ok: false, error: 'Please add a valid phone or WhatsApp number.', field: 'phone' }, 400);

  let draft = null;
  if (body.draft != null) {
    draft = typeof body.draft === 'string' ? body.draft : JSON.stringify(body.draft);
    if (draft.length > MAX_DRAFT_CHARS) return json({ ok: false, error: 'Your store draft is too large to send. Try smaller photos.' }, 413);
  }

  const stub = env.LEADS.get(env.LEADS.idFromName('main'));
  const res = await stub.add({
    name, phone, storeName, bestTime, wantsAddons: !!body.wantsAddons, draft,
    ip: request.headers.get('cf-connecting-ip') || '',
  });
  if (res.limited) return json({ ok: false, error: 'Too many requests from this connection. Please try again later, or message us on WhatsApp.' }, 429);
  return json({ ok: true, id: res.id });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/leads' && request.method === 'POST') return createLead(request, env);

    if (url.pathname.startsWith('/api/leads') && request.method === 'GET') {
      if (!isAdmin(request, env)) return json({ ok: false, error: 'Not authorised.' }, 401);
      const stub = env.LEADS.get(env.LEADS.idFromName('main'));
      const m = url.pathname.match(/^\/api\/leads\/(\d+)$/);
      if (m) {
        const lead = await stub.get(Number(m[1]));
        return lead ? json({ ok: true, lead }) : json({ ok: false, error: 'Not found.' }, 404);
      }
      return json({ ok: true, leads: await stub.list() });
    }

    if (url.pathname.startsWith('/api/')) return json({ ok: false, error: 'Not found.' }, 404);
    return env.ASSETS.fetch(request);
  },
};
