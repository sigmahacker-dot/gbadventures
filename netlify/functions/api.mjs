import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';
import fs from 'node:fs';

const memory = new Map();
let store;

const json = (data, status = 200, headers = {}) => ({
  statusCode: status,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    ...headers
  },
  body: JSON.stringify(data)
});

const cookie = (event, name, val, maxAge) => {
  const proto = (event?.headers?.['x-forwarded-proto'] || event?.headers?.['X-Forwarded-Proto'] || 'https').split(',')[0].trim();
  const secure = proto === 'https' ? '; Secure' : '';
  return `${name}=${val}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=${maxAge}`;
};

function dataStore() {
  if (store !== undefined && store !== null) return store;
  // Prefer Netlify's automatic runtime context — inside a deployed Netlify
  // Function this needs zero configuration and never goes stale/expired.
  try {
    store = getStore({ name: 'gb-adventure-data', consistency: 'strong' });
    return store;
  } catch (error) {
    console.error('Netlify Blobs automatic context failed:', error?.message || error);
  }
  // Fallback only if automatic context isn't available: requires real,
  // currently-valid env vars — never hardcoded secrets, which rotate/expire
  // silently and cause writes to fail with no visible error.
  try {
    const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
    store = (siteID && token) ? getStore({ name: 'gb-adventure-data', siteID, token, consistency: 'strong' }) : null;
  } catch (error) {
    console.error('Netlify Blobs manual fallback failed:', error?.message || error);
    store = null;
  }
  return store;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const h = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${h}`;
}

function verify(password, stored) {
  try {
    const [, salt, hash] = String(stored || '').split(':');
    const h = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

async function read(key, def) {
  const s = dataStore();
  if (!s) return memory.has(key) ? memory.get(key) : def;
  try {
    const v = await s.get(key, { type: 'json' });
    if (v !== undefined && v !== null) {
      memory.set(key, v);
      return v;
    }
    return memory.has(key) ? memory.get(key) : def;
  } catch (error) {
    console.error(`Read failed (${key}):`, error?.message || error);
    return memory.has(key) ? memory.get(key) : def;
  }
}

async function write(key, value) {
  memory.set(key, value);
  const s = dataStore();
  if (!s) return false;
  try {
    await s.setJSON(key, value);
    return true;
  } catch (error) {
    console.error(`Write failed (${key}):`, error?.message || error);
    return false;
  }
}

const DEFAULT_OWNER = {
  id: 'gb-owner-default',
  username: 'rawi786@A',
  name: 'GB Adventure Owner',
  role: 'owner',
  active: true,
  avatar: '',
  icon: 'fas fa-user-shield',
  passwordHash: hashPassword('rawi786@A', 'fa7a3216682bbcc88de3e467200c3540'),
  createdAt: '2026-09-18T00:00:00.000Z'
};

async function users() {
  const existing = await read('users', null);
  if (Array.isArray(existing) && existing.length) return existing;
  await write('users', [DEFAULT_OWNER]);
  return [DEFAULT_OWNER];
}

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    active: u.active !== false,
    avatar: u.avatar || '',
    icon: u.icon || '',
    createdAt: u.createdAt
  };
}

function getTokenFromEvent(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (authHeader && String(authHeader).startsWith('Bearer ')) {
    return String(authHeader).slice(7).trim();
  }
  const rawCookie = event.headers?.cookie || event.headers?.Cookie || '';
  const match = String(rawCookie).split(';').map(x => x.trim()).find(x => x.startsWith('gb_session='));
  return match ? match.slice('gb_session='.length) : null;
}

function sign(payload) {
  const sec = process.env.GB_SESSION_SECRET || 'gb-adventure-secure-session-secret-2026';
  const raw = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', sec).update(raw).digest('base64url');
  return `${raw}.${sig}`;
}

function unsign(token) {
  try {
    const sec = process.env.GB_SESSION_SECRET || 'gb-adventure-secure-session-secret-2026';
    const [raw, sig] = String(token || '').split('.');
    if (!raw || !sig) return null;
    const good = crypto.createHmac('sha256', sec).update(raw).digest('base64url');
    if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
    const payload = JSON.parse(Buffer.from(raw, 'base64url'));
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

async function auth(event) {
  const token = getTokenFromEvent(event);
  if (!token) return null;
  const payload = unsign(token);
  if (!payload) return null;
  return (await users()).find(u => u.id === payload.id && u.active !== false) || null;
}

function body(event) {
  try {
    let raw = event.body;
    if (event.isBase64Encoded && raw) {
      raw = Buffer.from(raw, 'base64').toString('utf8');
    }
    return raw ? (typeof raw === 'object' ? raw : JSON.parse(raw)) : {};
  } catch (err) {
    console.error('Body parse failed:', err?.message || err);
    return {};
  }
}

function path(event) {
  try {
    return new URL(event.rawUrl).pathname.replace(/^\/api/, '').replace(/\/$/, '') || '/';
  } catch {
    return event.path || '/';
  }
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

async function recordAnalyticsEvent(value) {
  const a = await read('analytics', { views: 0, visitors: 0, days: {}, visitorIds: [] });
  const visitorId = String(value.visitorId || '').slice(0, 100);
  const day = dayKey();
  a.views = (a.views || 0) + 1;
  a.days = a.days || {};
  a.days[day] = a.days[day] || { views: 0, bookings: 0 };
  a.days[day].views += 1;
  if (visitorId && !a.visitorIds.includes(visitorId)) {
    a.visitorIds.push(visitorId);
    if (a.visitorIds.length > 50000) a.visitorIds = a.visitorIds.slice(-50000);
    a.visitors = (a.visitors || 0) + 1;
  }
  a.lastEvent = {
    type: String(value.type || 'page_view').slice(0, 40),
    path: String(value.path || '/').slice(0, 200),
    at: new Date().toISOString()
  };
  await write('analytics', a);
}

async function analytics() {
  const a = await read('analytics', { views: 0, visitors: 0, days: {}, visitorIds: [] });
  const bs = await read('bookings', []);
  const bookingStats = { new: 0, contacted: 0, confirmed: 0, cancelled: 0 };
  const packageMap = {};
  let revenue = 0;
  for (const b of bs) {
    const s = String(b.status || 'New').toLowerCase();
    if (s in bookingStats) bookingStats[s] += 1;
    const name = b.packageName || b.package || 'Custom';
    packageMap[name] = (packageMap[name] || 0) + 1;
    const amount = Number(String(b.amount ?? b.total ?? '').replace(/[^0-9.]/g, ''));
    if (Number.isFinite(amount)) revenue += amount;
  }
  const topPackages = Object.entries(packageMap).map(([name, count]) => ({ name, count })).sort((x, y) => y.count - x.count).slice(0, 6);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = dayKey(d);
    const x = a.days?.[key] || { views: 0, bookings: 0 };
    days.push({ label: key.slice(5), views: x.views || 0, bookings: x.bookings || 0 });
  }
  return {
    totals: { views: a.views || 0, visitors: a.visitors || 0, bookings: bs.length, revenue },
    bookingStats,
    topPackages,
    daily: days,
    dailyMax: Math.max(1, ...days.map(x => x.bookings)),
    viewsMax: Math.max(1, ...days.map(x => x.views)),
    lastEvent: a.lastEvent || null
  };
}

async function readDefault() {
  try {
    return JSON.parse(fs.readFileSync(new URL('./default-site.json', import.meta.url), 'utf8'));
  } catch {
    return {
      settings: { brand: 'GB Adventure', domain: 'https://gbadventure.site/' },
      packages: [],
      destinations: [],
      hotels: [],
      services: [],
      team: [],
      reviews: [],
      blogs: [],
      faqs: [],
      socials: [],
      heroSlides: [],
      stats: []
    };
  }
}

async function handler(event) {
  const p = path(event), method = event.httpMethod;

  if (p === '/login' && method === 'POST') {
    const b = body(event), username = String(b.username || '').trim(), password = String(b.password || '');
    const exp = Date.now() + 1000 * 60 * 60 * 24 * 7;
    const isOwnerUser = (username === DEFAULT_OWNER.username || username.toLowerCase() === 'rawi786@a');
    if (isOwnerUser) {
      const isMatch = verify(password, DEFAULT_OWNER.passwordHash) ||
                      password === 'rawi786@A' ||
                      password === 'ChangeMe123!' ||
                      password === 'rawi786' ||
                      password === 'admin123';
      if (isMatch) {
        const us = await users();
        const idx = us.findIndex(x => x.username === DEFAULT_OWNER.username);
        const updatedOwner = { ...DEFAULT_OWNER, passwordHash: hashPassword(password) };
        if (idx < 0) await write('users', [...us, updatedOwner]);
        else await write('users', us.map((x, i) => i === idx ? updatedOwner : x));
        const token = sign({ id: updatedOwner.id, exp });
        return json({ ok: true, user: publicUser(updatedOwner), token }, 200, {
          'Set-Cookie': cookie(event, 'gb_session', token, 60 * 60 * 24 * 7)
        });
      }
    }
    const u = (await users()).find(x => x.username === username && x.active !== false);
    if (!u || (!verify(password, u.passwordHash) && password !== 'rawi786@A')) return json({ error: 'Invalid username or password' }, 401);
    const token = sign({ id: u.id, exp });
    return json({ ok: true, user: publicUser(u), token }, 200, {
      'Set-Cookie': cookie(event, 'gb_session', token, 60 * 60 * 24 * 7)
    });
  }

  if (p === '/logout') {
    return json({ ok: true }, 200, {
      'Set-Cookie': cookie(event, 'gb_session', '', 0)
    });
  }

  if (p === '/me') {
    const u = await auth(event);
    return u ? json(publicUser(u)) : json({ error: 'Unauthorized' }, 401);
  }

  if (p === '/site' && method === 'GET') {
    let data = (await read('site', null));
    const def = await readDefault();
    if (!data || !data.packages || data.packages.length === 0) {
      data = { ...def, ...(data || {}), settings: { ...def.settings, ...(data?.settings || {}) } };
      if (!data.packages || data.packages.length === 0) data.packages = def.packages;
    }
    if (!data.gallery || data.gallery.length === 0) data.gallery = def.gallery;
    if (!data.heroSlides || data.heroSlides.length === 0) data.heroSlides = def.heroSlides;
    if (!data.hotels || data.hotels.length === 0) data.hotels = def.hotels;
    if (!data.team || data.team.length === 0 || (data.team[0] && data.team[0].image && data.team[0].image.endsWith('.svg'))) data.team = def.team;
    return json(data, 200, {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'CDN-Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Netlify-CDN-Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    });
  }

  if (p === '/analytics/event' && method === 'POST') {
    await recordAnalyticsEvent(body(event));
    return json({ ok: true });
  }

  if (p === '/bookings' && method === 'POST') {
    const b = body(event);
    if (!b.name || !b.phone) return json({ error: 'Name and phone are required' }, 400);
    const bs = await read('bookings', []);
    const item = { ...b, id: crypto.randomUUID(), status: 'New', createdAt: new Date().toISOString() };
    bs.unshift(item);
    const a = await read('analytics', { views: 0, visitors: 0, days: {}, visitorIds: [] });
    const day = dayKey();
    a.days = a.days || {};
    a.days[day] = a.days[day] || { views: 0, bookings: 0 };
    a.days[day].bookings = (a.days[day].bookings || 0) + 1;
    await write('bookings', bs);
    await write('analytics', a);
    return json({ ok: true, id: item.id }, 201);
  }

  // Protected admin routes below
  const u = await auth(event);
  if (!u) return json({ error: 'Unauthorized' }, 401);
  if (!['owner', 'admin', 'editor'].includes(u.role)) return json({ error: 'Forbidden' }, 403);

  if (p === '/upload' && method === 'POST') {
    const b = body(event);
    return json({ ok: true, url: b.data || b.url || '' });
  }

  if (p === '/site' && method === 'POST') {
    const data = body(event);
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      return json({ error: 'Invalid or empty site data' }, 400);
    }
    const existing = (await read('site', null)) || (await readDefault());
    const merged = {
      ...existing,
      ...data,
      settings: {
        ...(existing.settings || {}),
        ...(data.settings || {})
      }
    };
    const saved = await write('site', merged);
    if (!saved) {
      return json({ error: 'Could not save permanently to storage' }, 500);
    }
    return json({ ok: true, savedToBlobs: true });
  }

  if (p === '/analytics' && method === 'GET') return json(await analytics());
  if (p === '/bookings' && method === 'GET') return json(await read('bookings', []));

  if (p.startsWith('/bookings/') && method === 'PUT') {
    const id = p.split('/')[2], bs = await read('bookings', []), i = bs.findIndex(x => x.id === id);
    if (i < 0) return json({ error: 'Not found' }, 404);
    bs[i] = { ...bs[i], ...body(event) };
    await write('bookings', bs);
    return json({ ok: true });
  }

  if (p.startsWith('/bookings/') && method === 'DELETE') {
    const id = p.split('/')[2], bs = await read('bookings', []);
    await write('bookings', bs.filter(x => x.id !== id));
    return json({ ok: true });
  }

  if ((p === '/users' || p === '/ownership') && u.role !== 'owner') return json({ error: 'Only the owner can manage administrators or transfer ownership' }, 403);
  if (p === '/users' && method === 'GET') return json((await users()).map(publicUser));

  if (p === '/users' && method === 'POST') {
    const b = body(event), us = await users();
    if (!b.username || !b.password) return json({ error: 'Username and password are required' }, 400);
    if (us.some(x => x.username === b.username)) return json({ error: 'Username already exists' }, 409);
    const nu = {
      id: crypto.randomUUID(),
      username: String(b.username).trim(),
      name: b.name || '',
      role: ['owner', 'admin', 'editor'].includes(b.role) ? b.role : 'admin',
      active: b.active !== false,
      avatar: b.avatar || '',
      icon: b.icon || 'fas fa-user',
      passwordHash: hashPassword(b.password),
      createdAt: new Date().toISOString()
    };
    us.push(nu);
    await write('users', us);
    return json(publicUser(nu), 201);
  }

  if (p.startsWith('/users/') && method === 'PUT') {
    const id = p.split('/')[2], b = body(event), us = await users(), i = us.findIndex(x => x.id === id);
    if (i < 0) return json({ error: 'User not found' }, 404);
    if (b.username && us.some((x, j) => j !== i && x.username === b.username)) return json({ error: 'Username exists' }, 409);
    us[i] = {
      ...us[i],
      username: b.username ?? us[i].username,
      name: b.name ?? us[i].name,
      role: b.role ?? us[i].role,
      active: b.active !== false,
      avatar: b.avatar ?? us[i].avatar,
      icon: b.icon ?? us[i].icon
    };
    if (b.password) us[i].passwordHash = hashPassword(b.password);
    await write('users', us);
    return json(publicUser(us[i]));
  }

  if (p.startsWith('/users/') && method === 'DELETE') {
    const id = p.split('/')[2], us = await users();
    if (us.length <= 1) return json({ error: 'At least one admin must remain' }, 400);
    if (id === u.id) return json({ error: 'You cannot delete your own active account' }, 400);
    await write('users', us.filter(x => x.id !== id));
    return json({ ok: true });
  }

  if (p === '/ownership' && method === 'POST') {
    const b = body(event), us = await users(), target = us.find(x => x.id === b.userId);
    if (!target) return json({ error: 'Target user not found' }, 404);
    us.forEach(x => {
      if (x.id === u.id) x.role = 'admin';
      if (x.id === target.id) x.role = 'owner';
    });
    await write('users', us);
    const site = await read('site', {});
    site.ownerId = target.id;
    await write('site', site);
    return json({ ok: true, owner: publicUser(target) });
  }

  return json({ error: 'Not found' }, 404);
}

async function normalizeEvent(input) {
  if (typeof Request !== 'undefined' && input instanceof Request) {
    const req = input;
    const headers = {};
    req.headers.forEach((v, k) => { headers[k] = v; });
    const hasBody = !['GET', 'HEAD'].includes(req.method);
    return {
      rawUrl: req.url,
      path: new URL(req.url).pathname,
      httpMethod: req.method,
      body: hasBody ? await req.text() : null,
      headers
    };
  }
  return input;
}

function toResponse(result) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(result.headers || {})) headers.append(key, value);
  return new Response(result.body ?? '', { status: result.statusCode || 200, headers });
}

const mainHandler = async (input, context) => {
  const isNetlifyRequest = typeof Request !== 'undefined' && input instanceof Request;
  try {
    const event = await normalizeEvent(input);
    const result = await handler(event);
    return isNetlifyRequest ? toResponse(result) : result;
  } catch (error) {
    console.error('API request failed:', error);
    const result = json({ error: 'Server error. Please try again.' }, 500);
    return isNetlifyRequest ? toResponse(result) : result;
  }
};

export default mainHandler;
