const { pool } = require('./_db');

module.exports = async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ ok: true, db: 'ok' });
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(500).json({ ok: false, error: 'db unreachable' });
  }
};
