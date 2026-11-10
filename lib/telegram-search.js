import { Api, TelegramClient } from 'teleproto';
import { StringSession } from 'teleproto/sessions';

const PAGE_SIZE = 100;
const USERNAME_RE = /^[A-Za-z0-9_]{5,32}$/;

function normalizeQuery(query) {
  return String(query || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');
}

function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeCursor(raw, query) {
  if (!raw) return null;
  try {
    const value = JSON.parse(Buffer.from(String(raw), 'base64url').toString('utf8'));
    if (
      value?.query !== normalizeQuery(query) ||
      !Number.isInteger(value.offsetRate) ||
      !Number.isInteger(value.offsetId) ||
      value.offsetId <= 0 ||
      !USERNAME_RE.test(value.offsetUsername || '')
    ) {
      throw new Error('Курсор поиска устарел. Начните поиск заново.');
    }
    return value;
  } catch (error) {
    if (error?.message?.includes('Курсор поиска')) throw error;
    throw new Error('Некорректный курсор поиска. Начните поиск заново.');
  }
}

function usernameForPeer(message, chatsById) {
  const peer = message?.peerId;
  const id = peer?.channelId ?? peer?.chatId;
  if (id == null) return null;
  const chat = chatsById.get(String(id));
  const username = String(chat?.username || '').replace(/^@/, '');
  return USERNAME_RE.test(username) ? username : null;
}

export async function searchPublicGroups(query, cursor = null) {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH;
  const sessionString = process.env.TELEGRAM_SESSION_STRING;
  if (!apiId || !apiHash || !sessionString) {
    throw new Error('MTProto не настроен: задайте API ID, API hash и session string.');
  }

  const page = decodeCursor(cursor, query);
  const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, { connectionRetries: 2 });
  await client.connect();
  try {
    const offsetPeer = page
      ? await client.getInputEntity(page.offsetUsername)
      : new Api.InputPeerEmpty();
    const result = await client.invoke(new Api.messages.SearchGlobal({
      q: query,
      filter: new Api.InputMessagesFilterEmpty(),
      minDate: 0,
      maxDate: 0,
      offsetRate: page?.offsetRate || 0,
      offsetPeer,
      offsetId: page?.offsetId || 0,
      limit: PAGE_SIZE,
      groupsOnly: true
    }));

    const chatsById = new Map(
      (result.chats || [])
        .filter(chat => chat?.id != null)
        .map(chat => [String(chat.id), chat])
    );
    const found = new Map();
    for (const chat of result.chats || []) {
      if (!chat.username || chat.broadcast === true) continue;
      const username = String(chat.username).replace(/^@/, '');
      if (!USERNAME_RE.test(username)) continue;
      const key = username.toLowerCase();
      if (!found.has(key)) {
        found.set(key, {
          title: chat.title || username,
          username,
          url: `https://t.me/${username}`
        });
      }
    }

    const messages = result.messages || [];
    const lastPageMessage = [...messages].reverse().find(message =>
      Number.isInteger(Number(message?.id)) &&
      Number.isInteger(Number(message?.date)) &&
      usernameForPeer(message, chatsById)
    );
    const lastUsername = usernameForPeer(lastPageMessage, chatsById);
    const mayHaveMore = Boolean(result.nextRate) ||
      Number(result.count || 0) > messages.length ||
      messages.length >= PAGE_SIZE;
    const candidateCursor = mayHaveMore && lastPageMessage && lastUsername
      ? encodeCursor({
          query: normalizeQuery(query),
          offsetRate: Number(result.nextRate ?? lastPageMessage.date),
          offsetId: Number(lastPageMessage.id),
          offsetUsername: lastUsername
        })
      : null;
    const nextCursor = candidateCursor && candidateCursor !== cursor ? candidateCursor : null;

    return { items: [...found.values()], nextCursor };
  } finally {
    await client.disconnect().catch(() => {});
  }
}
