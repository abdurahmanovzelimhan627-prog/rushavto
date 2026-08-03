const { pool, ensureSchema } = require('./_db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'method not allowed' });
    return;
  }

  const adminToken = process.env.ADMIN_TOKEN;
  const token = req.query.token;
  if (!adminToken || token !== adminToken) {
    res.status(401).json({ ok: false, error: 'неверный или отсутствующий token' });
    return;
  }

  await ensureSchema();
  const result = await pool.query('SELECT * FROM leads ORDER BY id DESC');
  res.status(200).json({ ok: true, leads: result.rows });
};
