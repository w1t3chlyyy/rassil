import { json, requireAdmin } from '../../../lib/server.js';
import { searchPublicGroups } from '../../../lib/telegram-search.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export async function POST(request) {
  if (!await requireAdmin(request)) return json({ error: 'Нет доступа' }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Некорректный запрос' }, 400); }
  const query = String(body.query || '').trim();
  if (query.length < 2 || query.length > 80) {
    return json({ error: 'Введите тему длиной от 2 до 80 символов.' }, 400);
  }
  try {
    const result = await searchPublicGroups(query, body.cursor || null);
    return json({
      query,
      items: result.items,
      nextCursor: result.nextCursor,
      note: 'Поиск идёт по публичным сообщениям групп. Нажмите «Ещё группы» или повторите тот же запрос, чтобы перейти к следующей странице. Приватные группы без публичной ссылки не показываются.'
    });
  } catch (error) {
    console.error('MTProto search failed:', error?.message || error);
    return json({ error: error?.message || 'Поиск не выполнен. Проверьте MTProto session и попробуйте позже.' }, 502);
  }
}
