import { Api, TelegramClient } from 'teleproto';
import { StringSession } from 'teleproto/sessions';

const PAGE_SIZE = 100;
const MAX_API_PAGES_PER_REQUEST = 3;
const TARGET_NEW_GROUPS = 100;
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
      !['channel', 'chat'].includes(value.offsetPeer?.kind) ||
      (value.offsetPeer.kind === 'channel' &&
        (!/^\d+$/.test(value.offsetPeer.channelId || '') || !/^-?\d+$/.test(value.offsetPeer.accessHash || ''))) ||
      (value.offsetPeer.kind === 'chat' && !/^\d+$/.test(value.offsetPeer.chatId || ''))
    ) {
      throw new Error('Курсор поиска устарел. Начните поиск заново.');
    }
    return value;
  } catch (error) {
    if (error?.message?.includes('Курсор поиска')) throw error;
    throw new Error('Некорректный курсор поиска. Начните поиск заново.');
  }
}

function restoreOffsetPeer(value) {
  if (value.kind === 'channel') {
    return new Api.InputPeerChannel({
      channelId: BigInt(value.channelId),
      accessHash: BigInt(value.accessHash)
    });
  }
  return new Api.InputPeerChat({ chatId: BigInt(value.chatId) });
}

function serializeOffsetPeer(peer) {
  if (peer instanceof Api.InputPeerChannel) {
    return {
      kind: 'channel',
      channelId: String(peer.channelId),
      accessHash: String(peer.accessHash)
    };
  }
  if (peer instanceof Api.InputPeerChat) {
    return { kind: 'chat', chatId: String(peer.chatId) };
  }
  return null;
}

function peerIdForMessage(message) {
  return message?.peerId?.channelId ?? message?.peerId?.chatId ?? null;
}

export async function searchPublicGroups(query, cursor = null, seenUsernames = []) {
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
    const found = new Map();
    const seen = new Set(
      (Array.isArray(seenUsernames) ? seenUsernames : [])
        .map(name => String(name).replace(/^@/, '').toLowerCase())
        .filter(name => USERNAME_RE.test(name))
    );
    let currentPage = page;
    let nextCursor = cursor;

    for (let pageNumber = 0; pageNumber < MAX_API_PAGES_PER_REQUEST; pageNumber += 1) {
      const offsetPeer = currentPage
        ? restoreOffsetPeer(currentPage.offsetPeer)
        : new Api.InputPeerEmpty();
      const result = await client.invoke(new Api.messages.SearchGlobal({
        q: query,
        filter: new Api.InputMessagesFilterEmpty(),
        minDate: 0,
        maxDate: 0,
        offsetRate: currentPage?.offsetRate ?? 0,
        offsetPeer,
        offsetId: currentPage?.offsetId ?? 0,
        limit: PAGE_SIZE,
        groupsOnly: true
      }));

      const chats = result.chats || [];
      const chatsById = new Map(chats.filter(chat => chat?.id != null).map(chat => [String(chat.id), chat]));
      for (const chat of chats) {
        if (!chat.username || chat.broadcast === true) continue;
        const username = String(chat.username).replace(/^@/, '');
        if (!USERNAME_RE.test(username)) continue;
        const key = username.toLowerCase();
        if (!seen.has(key) && !found.has(key)) {
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
        message?.peerId
      );
      const peerId = peerIdForMessage(lastPageMessage);
      const peerEntity = peerId == null ? null : chatsById.get(String(peerId));
      let serializedPeer = null;
      if (lastPageMessage && peerEntity) {
        try {
          serializedPeer = serializeOffsetPeer(await client.getInputEntity(peerEntity));
        } catch {
          serializedPeer = null;
        }
      }

      const mayHaveMore = Boolean(result.nextRate) ||
        Number(result.count || 0) > messages.length ||
        messages.length >= PAGE_SIZE;
      const rawNextRate = Number(result.nextRate);
      const candidate = mayHaveMore && lastPageMessage && serializedPeer
        ? {
            query: normalizeQuery(query),
            offsetRate: Number.isInteger(rawNextRate) && rawNextRate > 0
              ? rawNextRate
              : Number(lastPageMessage.date),
            offsetId: Number(lastPageMessage.id),
            offsetPeer: serializedPeer
          }
        : null;
      const candidateCursor = candidate ? encodeCursor(candidate) : null;

      if (!candidateCursor || candidateCursor === nextCursor) {
        nextCursor = null;
        break;
      }
      nextCursor = candidateCursor;
      currentPage = candidate;
      if (!mayHaveMore || messages.length === 0 || found.size >= TARGET_NEW_GROUPS) break;
    }

    return { items: [...found.values()], nextCursor };
  } finally {
    await client.disconnect().catch(() => {});
  }
}
