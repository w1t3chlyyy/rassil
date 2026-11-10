import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import qrcode from 'qrcode-terminal';
import { TelegramClient } from 'teleproto';
import { StringSession } from 'teleproto/sessions';

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
if (!apiId || !apiHash) {
  console.error('Заполните TELEGRAM_API_ID и TELEGRAM_API_HASH в .env.local');
  process.exit(1);
}
const rl = createInterface({ input: stdin, output: stdout });
const client = new TelegramClient(new StringSession(''), apiId, apiHash, { connectionRetries: 5 });
try {
  await client.connect();
  await client.signInUserWithQrCode({ apiId, apiHash }, {
    qrCode: async ({ token, expires }) => {
      const url = `tg://login?token=${token.toString('base64url')}`;
      console.clear();
      console.log('Telegram → Настройки → Устройства → Подключить устройство:');
      qrcode.generate(url, { small: true });
      console.log(`QR действует ${expires} сек.; если истечёт, новый появится здесь.`);
    },
    password: async hint => rl.question(`Пароль двухэтапной проверки${hint ? ` (${hint})` : ''}: `),
    onError: err => { console.error('Ошибка QR-входа:', err?.message || err); return false; }
  });
  console.log('\nВход выполнен. Секрет сессии (не отправляйте его в чат и не коммитьте в Git):\n');
  console.log(client.session.save());
  console.log('\nДобавьте это значение в Vercel как TELEGRAM_SESSION_STRING.');
} catch (err) {
  console.error('Не удалось завершить QR-вход:', err?.message || err);
  process.exitCode = 1;
} finally {
  rl.close();
  await client.disconnect().catch(() => {});
}
