import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Lazy proxy preserves compatibility with older app/api routes that still import `supabase`.
// Current topic-finder routes do not use Supabase.
let supabaseClient;
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to use legacy Supabase routes.');
  if (!supabaseClient) supabaseClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return supabaseClient;
}
export const supabase = new Proxy({}, {
  get(_target, property) {
    const client = getSupabaseClient();
    const value = client[property];
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

export function isAdmin(id) {
  return (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(x => x.trim()).filter(Boolean).includes(String(id));
}
export function verifyInitData(raw) {
  if (!raw || !process.env.TELEGRAM_BOT_TOKEN) return null;
  const p = new URLSearchParams(raw), hash = p.get('hash');
  if (!hash) return null;
  p.delete('hash');
  const check = [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest();
  const expected = crypto.createHmac('sha256', secret).update(check).digest('hex');
  const a = Buffer.from(hash, 'hex'), b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const authDate = Number(p.get('auth_date') || 0);
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > 86400) return null;
  try { const user = JSON.parse(p.get('user') || 'null'); return user && isAdmin(user.id) ? user : null; } catch { return null; }
}
export async function requireAdmin(request) { return verifyInitData(request.headers.get('x-telegram-init-data')); }
export async function telegram(method, payload) {
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), cache: 'no-store'
  });
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(j.description || `Telegram ${method} failed`);
  return j.result;
}
export function json(data, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } }); }
