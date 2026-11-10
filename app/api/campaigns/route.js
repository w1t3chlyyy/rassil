import { json } from '../../../lib/server.js';

export const dynamic = 'force-dynamic';

function disabled() {
  return json({ error: 'Функции кампаний отключены.' }, 410);
}

export const GET = disabled;
export const POST = disabled;
