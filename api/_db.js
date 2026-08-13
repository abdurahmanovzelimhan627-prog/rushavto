const { Pool } = require('pg');

const connectionString =
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_POSTGRES_URL ||
  process.env.POSTGRES_URL_DATABASE_URL ||
  process.env.POSTGRES_URL_PRISMA_DATABASE_URL;

if (!connectionString) {
  throw new Error('Не найдена строка подключения к Postgres (POSTGRES_URL / POSTGRES_URL_*)');
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

let initialized = false;

async function ensureSchema() {
  if (initialized) return;
  await pool.query(`
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
  `);
  // Таблица уже существовала в проде до этих полей — CREATE TABLE IF NOT EXISTS
  // их не добавит, поэтому доливаем недостающие колонки отдельно.
  await pool.query(`
    ALTER TABLE leads
      ADD COLUMN IF NOT EXISTS body_type TEXT,
      ADD COLUMN IF NOT EXISTS year TEXT,
      ADD COLUMN IF NOT EXISTS exterior_color TEXT,
      ADD COLUMN IF NOT EXISTS interior_color TEXT,
      ADD COLUMN IF NOT EXISTS ip TEXT
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_consents (
      chat_id BIGINT PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      rules_shown_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      consented_at TIMESTAMPTZ
    )
  `);
  initialized = true;
}

module.exports = { pool, ensureSchema };
