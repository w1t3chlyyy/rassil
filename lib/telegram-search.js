import { Api, TelegramClient } from 'teleproto';
import { StringSession } from 'teleproto/sessions';

export async function searchPublicGroups(query) {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH;
  const sessionString = process.env.TELEGRAM_SESSION_STRING;
  if (!apiId || !apiHash || !sessionString) throw new Error('MTProto не настроен: задайте API ID, API hash и session string.');
  const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, { connectionRetries: 2 });
  await client.connect();
  try {
    const result = await client.invoke(new Api.messages.SearchGlobal({
      q: query,
      filter: new Api.InputMessagesFilterEmpty(),
      minDate: 0,
      maxDate: 0,
      offsetRate: 0,
      offsetPeer: new Api.InputPeerEmpty(),
      offsetId: 0,
      limit: 50,
      groupsOnly: true
    }));
    const found = new Map();
    for (const chat of result.chats || []) {
      // Return public supergroups only; private chats have no joinable public username.
      if (!chat.username || chat.megagroup !== true) continue;
      const username = String(chat.username).replace(/^@/, '');
      if (!/^[A-Za-z0-9_]{5,32}$/.test(username)) continue;
      if (!found.has(username.toLowerCase())) found.set(username.toLowerCase(), {
        title: chat.title || username,
        username,
        url: `https://t.me/${username}`
      });
    }
    return [...found.values()].slice(0, 10);
  } finally {
    await client.disconnect().catch(() => {});
  }
}
