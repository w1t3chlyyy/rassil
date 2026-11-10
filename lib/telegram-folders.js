import { Api, TelegramClient } from 'teleproto';
import { StringSession } from 'teleproto/sessions';

const USERNAME_RE = /^[A-Za-z0-9_]{5,32}$/;

function peerKey(peer) {
  const id = peer?.channelId ?? peer?.chatId ?? peer?.userId;
  return id == null ? null : `${peer.className || 'Peer'}:${String(id)}`;
}

function uniquePeers(peers) {
  const byKey = new Map();
  for (const peer of peers || []) {
    const key = peerKey(peer);
    if (key) byKey.set(key, peer);
  }
  return [...byKey.values()];
}

export async function createTelegramFolder({ title, usernames }) {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH;
  const sessionString = process.env.TELEGRAM_SESSION_STRING;
  if (!apiId || !apiHash || !sessionString) {
    throw new Error('MTProto не настроен: задайте API ID, API hash и session string.');
  }

  const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, { connectionRetries: 2 });
  await client.connect();
  try {
    const [dialogs, archivedDialogs] = await Promise.all([
      client.getDialogs({ limit: 1000, folder: 0 }),
      client.getDialogs({ limit: 1000, folder: 1 })
    ]);
    const joinedDialogs = new Map();
    for (const dialog of [...(dialogs || []), ...(archivedDialogs || [])]) {
      const username = String(dialog?.entity?.username || '').replace(/^@/, '').toLowerCase();
      if (USERNAME_RE.test(username) && dialog.inputEntity) joinedDialogs.set(username, dialog);
    }

    const requested = [...new Set(usernames.map(name => String(name).replace(/^@/, '').toLowerCase()))];
    const missing = requested.filter(username => !joinedDialogs.has(username));
    if (missing.length) {
      return { ok: false, missing };
    }

    const selectedPeers = requested.map(username => joinedDialogs.get(username).inputEntity);
    const filtersResult = await client.invoke(new Api.messages.GetDialogFilters({}));
    const filters = filtersResult?.filters || [];
    const normalizedTitle = title.trim().toLocaleLowerCase('ru');
    const existing = filters.find(filter =>
      filter instanceof Api.DialogFilter &&
      String(filter.title?.text || '').trim().toLocaleLowerCase('ru') === normalizedTitle
    );

    let id = existing?.id;
    if (id == null) {
      const usedIds = new Set(filters.map(filter => filter.id).filter(Number.isInteger));
      id = 2;
      while (usedIds.has(id) && id < 256) id += 1;
      if (id >= 256) throw new Error('В аккаунте достигнут лимит папок Telegram.');
    }

    const includePeers = uniquePeers([...(existing?.includePeers || []), ...selectedPeers]);
    const filter = new Api.DialogFilter({
      contacts: existing?.contacts,
      nonContacts: existing?.nonContacts,
      groups: existing?.groups,
      broadcasts: existing?.broadcasts,
      bots: existing?.bots,
      excludeMuted: existing?.excludeMuted,
      excludeRead: existing?.excludeRead,
      excludeArchived: existing?.excludeArchived,
      titleNoanimate: existing?.titleNoanimate,
      id,
      title: existing?.title || new Api.TextWithEntities({ text: title.trim(), entities: [] }),
      emoticon: existing?.emoticon,
      color: existing?.color,
      pinnedPeers: existing?.pinnedPeers || [],
      includePeers,
      excludePeers: existing?.excludePeers || []
    });

    await client.invoke(new Api.messages.UpdateDialogFilter({ id, filter }));

    let folderLink = null;
    try {
      const exported = await client.invoke(new Api.chatlists.ExportChatlistInvite({
        chatlist: new Api.InputChatlistDialogFilter({ filterId: id }),
        title: title.trim(),
        peers: includePeers
      }));
      folderLink = exported?.invite?.url || null;
    } catch (error) {
      console.warn('Could not export Telegram folder link:', error?.message || error);
    }

    return { ok: true, folderId: id, title: title.trim(), folderLink, added: requested.length };
  } finally {
    await client.disconnect().catch(() => {});
  }
}
