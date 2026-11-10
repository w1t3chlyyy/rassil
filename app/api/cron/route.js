import { json } from '../../../lib/server.js';

export const dynamic = 'force-dynamic';

function disabled() {
  return json({ error: 'Автоматическая обработка кампаний отключена.' }, 410);
}

export const GET = disabled;
export const POST = disabled;
