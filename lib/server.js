import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
export const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL||'',process.env.SUPABASE_SERVICE_ROLE_KEY||'',{auth:{persistSession:false,autoRefreshToken:false}});
export function isAdmin(id){return (process.env.ADMIN_TELEGRAM_IDS||'').split(',').map(x=>x.trim()).filter(Boolean).includes(String(id));}
export function verifyInitData(raw){
 if(!raw||!process.env.TELEGRAM_BOT_TOKEN)return null;
 const p=new URLSearchParams(raw),hash=p.get('hash');if(!hash)return null;p.delete('hash');
 const check=[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
 const secret=crypto.createHmac('sha256','WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest();
 const expected=crypto.createHmac('sha256',secret).update(check).digest('hex'),a=Buffer.from(hash,'hex'),b=Buffer.from(expected,'hex');
 if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
 const t=Number(p.get('auth_date')||0);if(!t||Math.abs(Date.now()/1000-t)>86400)return null;
 try{const u=JSON.parse(p.get('user')||'null');return u&&isAdmin(u.id)?u:null;}catch{return null;}
}
export async function requireAdmin(req){return verifyInitData(req.headers.get('x-telegram-init-data'));}
export async function telegram(method,payload){const r=await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.description||`Telegram ${method} failed`);return j.result;}
export function json(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
