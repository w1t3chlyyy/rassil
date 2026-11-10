import { json, requireAdmin } from '../../../lib/server.js';
import { createTelegramFolder } from '../../../lib/telegram-folders.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 20;

export async function POST(request) {
  if (!await requireAdmin(request)) return json({ error: 'Нет доступа' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Некорректный запрос' }, 400);
  }

  const title = String(body.title || '').trim();
  const usernames = Array.isArray(body.usernames) ? body.usernames : [];
  if (!title || title.length > 32) {
    return json({ error: 'Название папки должно содержать от 1 до 32 символов.' }, 400);
  }
  if (!usernames.length || usernames.length > 100) {
    return json({ error: 'Выберите от 1 до 100 чатов.' }, 400);
  }
  if (usernames.some(username => !/^[A-Za-z0-9_]{5,32}$/.test(String(username).replace(/^@/, '')))) {
    return json({ error: 'Список чатов содержит некорректные username.' }, 400);
  }

  try {
    const result = await createTelegramFolder({ title, usernames });
    if (!result.ok) {
      return json({
        error: 'Сначала вручную вступите в выбранные группы в Telegram. Автоматическое вступление отключено.',
        missing: result.missing
      }, 409);
    }
    return json(result);
  } catch (error) {
    console.error('Telegram folder creation failed:', error?.message || error);
    return json({ error: error?.message || 'Не удалось создать папку Telegram.' }, 502);
  }
}
