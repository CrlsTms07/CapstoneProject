require('dotenv').config();
const pool = require('../src/config/database');

(async () => {
  try {
    // Find test users by common test name patterns
    const selectRes = await pool.query(`
      SELECT user_id, username
      FROM users
      WHERE username LIKE 'agent_signup_test_%'
         OR username LIKE 'teacher_test%'
         OR username IN ('master_teacher_test_account','teacher_test_account')
    `);

    if (selectRes.rows.length === 0) {
      console.log('No matching test users found.');
      process.exit(0);
    }

    console.log('Found users to delete:');
    selectRes.rows.forEach(r => console.log(r.user_id, r.username));

    const ids = selectRes.rows.map(r => r.user_id);

    const delRes = await pool.query('DELETE FROM users WHERE user_id = ANY($1::int[]) RETURNING user_id, username', [ids]);

    console.log(`Deleted ${delRes.rowCount} user(s):`);
    delRes.rows.forEach(r => console.log(r.user_id, r.username));

    process.exit(0);
  } catch (err) {
    console.error('Cleanup error:', err);
    process.exit(1);
  }
})();
