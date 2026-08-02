// Интеграция Neon на Vercel создаёт переменные с префиксом, а не голый POSTGRES_URL,
// который по умолчанию ищет @vercel/postgres. POSTGRES_URL_POSTGRES_URL — прямое
// (non-pooled) подключение, для serverless-функций нужен пул — берём DATABASE_URL.
if (!process.env.POSTGRES_URL && process.env.POSTGRES_URL_DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.POSTGRES_URL_DATABASE_URL;
}

const { sql } = require('@vercel/postgres');

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
