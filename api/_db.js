const { neon } = require('@neondatabase/serverless');

// POSTGRES_URL_DATABASE_URL от интеграции Neon/Vercel ведёт на Prisma-прокси
// (404 resource-not-found для HTTP-драйвера Neon), поэтому берём "прямой"
// POSTGRES_URL_POSTGRES_URL первым — для HTTP-драйвера pooled/direct не важно.
const connectionString =
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_POSTGRES_URL ||
  process.env.POSTGRES_URL_DATABASE_URL ||
  process.env.POSTGRES_URL_PRISMA_DATABASE_URL;

if (!connectionString) {
  throw new Error('Не найдена строка подключения к Postgres (POSTGRES_URL / POSTGRES_URL_*)');
}

for (const [name, val] of Object.entries({
  POSTGRES_URL_POSTGRES_URL: process.env.POSTGRES_URL_POSTGRES_URL,
  POSTGRES_URL_DATABASE_URL: process.env.POSTGRES_URL_DATABASE_URL,
  POSTGRES_URL_PRISMA_DATABASE_URL: process.env.POSTGRES_URL_PRISMA_DATABASE_URL,
})) {
  if (!val) { console.log('[db]', name, '= (не задана)'); continue; }
  try {
    const u = new URL(val);
    console.log('[db]', name, '-> protocol:', u.protocol, 'host:', u.hostname);
  } catch (e) {
    console.log('[db]', name, '-> не парсится как URL:', e.message);
  }
}

const sql = neon(connectionString);

let initialized = false;

async function ensureSchema() {
  if (initialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      name TEXT,
      phone TEXT,
      country TEXT,
      model TEXT,
      budget TEXT,
      source TEXT,
      telegram_ok BOOLEAN NOT NULL DEFAULT false
    )
  `;
  initialized = true;
}

module.exports = { sql, ensureSchema };
