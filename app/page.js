'use client';

import { useEffect, useState } from 'react';

const normalizeQuery = value => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');
const uniqueItems = items => {
  const seen = new Set();
  return (items || []).filter(item => {
    const key = String(item.username || '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export default function Home() {
  const [initData, setInitData] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [activeQuery, setActiveQuery] = useState('');
  const [nextCursor, setNextCursor] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState([]);
  const [folderTitle, setFolderTitle] = useState('');
  const [folderBusy, setFolderBusy] = useState(false);
  const [folderMessage, setFolderMessage] = useState('');
  const [folderLink, setFolderLink] = useState('');

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      setInitData(tg.initData || '');
    }
  }, []);

  async function runSearch(e, forceNext = false) {
    e?.preventDefault?.();
    if (busy) return;

    const trimmedQuery = query.trim();
    const key = normalizeQuery(trimmedQuery);
    if (key.length < 2) return;

    const continuing = activeQuery === key && Boolean(nextCursor);
    if (forceNext && !continuing) return;
    if (!continuing && activeQuery === key && items.length) {
      setError('Все доступные результаты по этой теме уже показаны.');
      return;
    }

    const cursor = continuing ? nextCursor : null;
    if (!continuing) {
      setItems([]);
      setSelected([]);
      setFolderLink('');
      setFolderMessage('');
      setFolderTitle(trimmedQuery.slice(0, 32));
    }
    setBusy(true);
    setError('');
    setNote('');

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-telegram-init-data': initData
        },
        body: JSON.stringify({
          query: trimmedQuery,
          cursor,
          seenUsernames: continuing ? items.map(item => item.username) : []
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Поиск не выполнен');

      const pageItems = uniqueItems(data.items || []);
      if (continuing) {
        const alreadyShown = new Set(items.map(item => item.username.toLowerCase()));
        const freshItems = pageItems.filter(item => !alreadyShown.has(item.username.toLowerCase()));
        setItems(current => uniqueItems([...current, ...freshItems]));
        if (!freshItems.length && data.nextCursor) {
          setError('Telegram пока вернул только уже показанные группы; курсор поиска сдвинут. Нажмите «Ещё группы», чтобы продолжить.');
        } else if (!freshItems.length) {
          setError('Новых групп по этой теме больше не найдено.');
        }
      } else {
        setItems(pageItems);
        setActiveQuery(key);
        if (!pageItems.length) setError('Совпадений не найдено. Попробуйте другие ключевые слова.');
      }

      setActiveQuery(key);
      setNextCursor(data.nextCursor || '');
      setNote(data.note || '');
    } catch (searchError) {
      setError(searchError.message || 'Поиск не выполнен');
    } finally {
      setBusy(false);
    }
  }

  function toggleSelected(username) {
    setSelected(current => current.includes(username)
      ? current.filter(item => item !== username)
      : [...current, username]);
  }

  function toggleAll() {
    const allSelected = items.length > 0 && items.every(item => selected.includes(item.username));
    setSelected(allSelected ? [] : items.map(item => item.username));
  }

  async function createFolder() {
    if (!selected.length || folderBusy) return;
    setFolderBusy(true);
    setFolderMessage('');
    setFolderLink('');
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-telegram-init-data': initData
        },
        body: JSON.stringify({ title: folderTitle, usernames: selected })
      });
      const data = await response.json();
      if (!response.ok) {
        const missing = data.missing?.length ? ` Не добавлены: ${data.missing.join(', ')}.` : '';
        throw new Error(`${data.error || 'Не удалось создать папку.'}${missing}`);
      }
      setFolderMessage(`Папка «${data.title}» создана в Telegram; добавлено чатов: ${data.added}.`);
      setFolderLink(data.folderLink || '');
    } catch (folderError) {
      setFolderMessage(folderError.message || 'Не удалось создать папку Telegram.');
    } finally {
      setFolderBusy(false);
    }
  }

  const sameTopicHasMore = activeQuery === normalizeQuery(query) && Boolean(nextCursor);
  const allSelected = items.length > 0 && items.every(item => selected.includes(item.username));

  return (
    <main className="wrap">
      <div className="eyebrow">TELEGRAM · PUBLIC GROUP FINDER</div>
      <h1>Поиск групп</h1>
      <p className="lead">
        Ищите публичные группы по совпадениям в сообщениях. Повторите тот же запрос или нажмите
        «Ещё группы», чтобы открыть следующую страницу без повторов.
      </p>

      <form onSubmit={e => runSearch(e)}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          minLength={2}
          maxLength={80}
          placeholder="Например: предприниматели"
        />
        <button disabled={busy || !initData || query.trim().length < 2}>
          {busy ? 'Ищу…' : sameTopicHasMore ? 'Искать дальше' : 'Найти группы'}
        </button>
      </form>

      {!initData && <p className="warn">Откройте Mini App через Telegram командой /panel.</p>}
      {error && <div className="error">{error}</div>}

      {items.length > 0 && (
        <>
          <div className="resultsHeading">
            <h2>Уникальных чатов: {items.length}</h2>
            {sameTopicHasMore && (
              <button className="secondary" disabled={busy} onClick={() => runSearch(null, true)}>
                {busy ? 'Ищу…' : 'Ещё группы'}
              </button>
            )}
          </div>

          <div className="selectionActions">
            <button className="textButton" type="button" onClick={toggleAll}>
              {allSelected ? 'Снять выбор' : 'Выбрать все'}
            </button>
            <span>Выбрано: {selected.length}</span>
          </div>

          <div className="results">
            {items.map((item, index) => (
              <article key={item.username.toLowerCase()}>
                <input
                  className="check"
                  type="checkbox"
                  checked={selected.includes(item.username)}
                  onChange={() => toggleSelected(item.username)}
                  aria-label={`Добавить ${item.title} в папку`}
                />
                <span className="num">{index + 1}</span>
                <div className="itemInfo">
                  <b>{item.title}</b>
                  <a href={item.url} target="_blank" rel="noreferrer">{item.url} ↗</a>
                </div>
              </article>
            ))}
          </div>

          <section className="folderBox">
            <h2>Папка Telegram</h2>
            <p>Можно добавить только группы, в которые аккаунт уже вступил. Приложение не вступает в группы автоматически.</p>
            <div className="folderForm">
              <input
                value={folderTitle}
                onChange={e => setFolderTitle(e.target.value)}
                maxLength={32}
                placeholder="Название папки"
                aria-label="Название папки"
              />
              <button disabled={folderBusy || !initData || !selected.length || !folderTitle.trim()} onClick={createFolder}>
                {folderBusy ? 'Создаю…' : `Создать папку (${selected.length})`}
              </button>
            </div>
            {folderMessage && <p className="folderMessage">{folderMessage}</p>}
            {folderLink && <a className="folderLink" href={folderLink} target="_blank" rel="noreferrer">Открыть ссылку на папку ↗</a>}
          </section>

          <p className="note">{note}</p>
        </>
      )}

      <footer>
        Показываются только публичные группы с доступными ссылками t.me. Автоматического вступления в группы и отправки сообщений нет.
      </footer>

      <style jsx>{`
        *{box-sizing:border-box}
        .wrap{max-width:760px;margin:0 auto;padding:32px 18px 50px;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033}
        .eyebrow{font-size:11px;letter-spacing:.14em;color:#5167d5;font-weight:800}
        h1{font-size:34px;margin:8px 0 10px}
        h2{font-size:18px;margin:0}
        .lead,.note,footer,.folderBox p{color:#68748a;line-height:1.55}
        .lead{margin:0 0 22px}
        form,.folderForm{display:flex;gap:9px}
        input:not(.check){flex:1;min-width:0;padding:13px 14px;border:1px solid #dce2ec;border-radius:10px;font:inherit}
        button{border:0;border-radius:10px;padding:12px 18px;background:#5167d5;color:#fff;font-weight:700;cursor:pointer}
        button:disabled{opacity:.5;cursor:not-allowed}
        .secondary{padding:9px 13px}
        .error,.warn{background:#fff4e5;color:#8a5100;padding:12px;border-radius:9px;margin-top:15px}
        .error{background:#fff0f0;color:#a33333}
        .resultsHeading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:28px 0 12px}
        .selectionActions{display:flex;justify-content:space-between;align-items:center;color:#68748a;font-size:13px;margin:0 2px 10px}
        .textButton{padding:6px 0;background:transparent;color:#4054c5}
        .results{border:1px solid #e6eaf1;border-radius:14px;overflow:hidden}
        article{display:flex;align-items:center;gap:12px;padding:14px;border-bottom:1px solid #edf0f5}
        article:last-child{border-bottom:0}
        .check{width:18px;height:18px;flex:none;accent-color:#5167d5}
        .num{width:26px;height:26px;display:grid;place-items:center;border-radius:50%;background:#eef2ff;color:#4458c7;font-size:12px;font-weight:700;flex:none}
        .itemInfo{min-width:0}
        .itemInfo b,.itemInfo a{display:block}
        .itemInfo a{color:#4054c5;margin-top:5px;text-decoration:none;word-break:break-all}
        .folderBox{margin-top:20px;padding:16px;border:1px solid #e6eaf1;border-radius:14px;background:#fafbff}
        .folderBox p{font-size:13px;margin:8px 0 13px}
        .folderMessage{margin-bottom:0!important}
        .folderLink{display:inline-block;margin-top:10px;color:#4054c5;font-weight:700;word-break:break-all}
        .note{font-size:12px}
        footer{font-size:12px;margin-top:30px}
        @media(max-width:520px){form,.folderForm{flex-direction:column}button{min-height:44px}.resultsHeading{align-items:flex-start;flex-direction:column}}
      `}</style>
    </main>
  );
}
