const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require(path.join(__dirname, '..', 'src', 'config', 'database'));

const inspect = async () => {
  try {
    const roles = await pool.query('SELECT role_id, role_name FROM roles ORDER BY role_id');
    console.log('\n== ROLES ==');
    if (roles.rows.length === 0) console.log('(no roles found)');
    else console.table(roles.rows);

    const users = await pool.query('SELECT user_id, username, role_id, department_id, password_hash FROM users ORDER BY user_id');
    console.log('\n== USERS ==');
    if (users.rows.length === 0) console.log('(no users found)');
    else console.table(users.rows.map(u => ({ user_id: u.user_id, username: u.username, role_id: u.role_id, department_id: u.department_id, has_password: !!u.password_hash })));

    process.exit(0);
  } catch (err) {
    console.error('Inspect error:', err.message);
    process.exit(1);
  }
};

inspect();
