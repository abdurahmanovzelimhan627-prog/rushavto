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
