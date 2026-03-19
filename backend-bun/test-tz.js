const { Pool } = require('pg');
const pool = new Pool({
  user: 'wagatewayuser',
  host: 'localhost',
  database: 'wagateway',
  password: 'wagateway2024',
  port: 5432,
});

async function run() {
  const rs = await pool.query("SELECT scheduled_at, created_at FROM messages WHERE status='completed' LIMIT 1");
  console.log("Raw from DB scheduled_at:", rs.rows[0].scheduled_at);
  console.log("Date object scheduled_at:", new Date(rs.rows[0].scheduled_at));
  console.log("Raw from DB created_at:", rs.rows[0].created_at);
  pool.end();
}
run();
