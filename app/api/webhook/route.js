import { isAdmin, json, telegram } from '../../../lib/server.js';
import { searchPublicGroups } from '../../../lib/telegram-search.js';
export const dynamic = 'force-dynamic';
async function say(chat_id, text, extra={}) { try { await telegram('sendMessage',{chat_id,text,...extra}); } catch(e) { console.error('sendMessage:',e.message); } }
const esc = s => String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export async function POST(req) {
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || req.headers.get('x-telegram-bot-api-secret-token') !== process.env.TELEGRAM_WEBHOOK_SECRET) return json({ok:false},401);
  let update; try { update=await req.json(); } catch { return json({ok:true}); }
  const m=update.message; if(!m?.chat || m.chat.type!=='private' || !m.from?.id) return json({ok:true});
  const uid=m.from.id, chat=String(m.chat.id), text=(m.text||'').trim(), cmd=text.split(/\s+/)[0].split('@')[0].toLowerCase();
  if(cmd==='/start' || cmd==='/help') { await say(chat,'Я нахожу публичные Telegram-группы по теме и возвращаю ссылки. Используйте: /search предприниматели. Поиск доступен только администратору.'); return json({ok:true}); }
  if(cmd==='/panel') {
    if(!isAdmin(uid)){await say(chat,'Панель доступна только администратору.');return json({ok:true});}
    await say(chat,'Откройте поиск групп:',{reply_markup:{inline_keyboard:[[{text:'Открыть Mini App',web_app:{url:process.env.APP_URL}}]]}});return json({ok:true});
  }
  if(cmd==='/search') {
    if(!isAdmin(uid)){await say(chat,'Поиск доступен только администратору.');return json({ok:true});}
    const query=text.slice(text.split(/\s+/)[0].length).trim();
    if(query.length<2){await say(chat,'Укажите тему: /search предприниматели');return json({ok:true});}
    try {
      const {items=[]}=await searchPublicGroups(query);
      if(!items.length){await say(chat,'В глобальном поиске Telegram не нашёл публичных групп по совпадающим сообщениям. Попробуйте другой запрос.');return json({ok:true});}
      const lines=items.slice(0,10).map((x,i)=>`${i+1}. <b>${esc(x.title)}</b>\n<a href="${esc(x.url)}">${esc(x.url)}</a>`).join('\n\n');
      await say(chat,`Публичные группы по запросу «${esc(query)}» (первые ${Math.min(items.length,10)}):\n\n${lines}\n\nДля просмотра следующих страниц откройте Mini App командой /panel. Результаты основаны на совпадениях в публичных сообщениях и не являются полным каталогом.`,{parse_mode:'HTML',disable_web_page_preview:true});
    } catch(e) { console.error('search:',e?.message||e); await say(chat,'Поиск сейчас недоступен. Проверьте API ID/hash и session string на сервере.'); }
    return json({ok:true});
  }
  return json({ok:true});
}
