const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require(path.join(__dirname, '..', 'src', 'config', 'database'));
const bcrypt = require('bcrypt');

const ensureRole = async (roleName) => {
  const found = await pool.query('SELECT role_id FROM roles WHERE role_name = $1 LIMIT 1', [roleName]);
  if (found.rows.length > 0) return found.rows[0].role_id;

  const inserted = await pool.query('INSERT INTO roles (role_name) VALUES ($1) RETURNING role_id, role_name', [roleName]);
  return inserted.rows[0].role_id;
};

const findUserByRole = async (roleId) => {
  const r = await pool.query('SELECT user_id, username, password_hash FROM users WHERE role_id = $1 LIMIT 1', [roleId]);
  return r.rows[0] || null;
};

const createTestUser = async (username, password, roleId) => {
  // ensure username unique
  const exists = await pool.query('SELECT user_id FROM users WHERE username = $1 LIMIT 1', [username]);
  if (exists.rows.length > 0) return null;

  const hash = await bcrypt.hash(password, 10);
  const res = await pool.query(
    `INSERT INTO users (username, role_id, password_hash) VALUES ($1, $2, $3) RETURNING user_id, username, role_id`,
    [username, roleId, hash]
  );

  return { created: true, user: res.rows[0], password };
};

const verifyPassword = async (username, plain) => {
  const r = await pool.query('SELECT password_hash FROM users WHERE username = $1 LIMIT 1', [username]);
  if (r.rows.length === 0) return false;
  const hash = r.rows[0].password_hash;
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
};

const run = async () => {
  try {
    console.log('Checking roles...');

    const adminIdRes = await pool.query("SELECT role_id FROM roles WHERE role_name = 'Admin' LIMIT 1");
    const glcIdRes = await pool.query("SELECT role_id FROM roles WHERE role_name = 'Grade Level Chairperson' LIMIT 1");
    const mtIdRes = await pool.query("SELECT role_id FROM roles WHERE role_name = 'Master Teacher' LIMIT 1");

    const adminId = adminIdRes.rows[0] && adminIdRes.rows[0].role_id;
    const glcId = glcIdRes.rows[0] && glcIdRes.rows[0].role_id;
    const mtId = mtIdRes.rows[0] && mtIdRes.rows[0].role_id;

    console.log('Found role IDs:', { adminId, glcId, mtId });

    const teacherId = await ensureRole('Teacher');
    console.log('Teacher role_id =', teacherId);

    // Check users for each role
    console.log('\nChecking user accounts and login capability:');

    const check = async (roleId, roleName, createIfMissing) => {
      const u = await findUserByRole(roleId);
      if (u) {
        console.log(`${roleName}: user '${u.username}' exists; has password: ${!!u.password_hash}`);
        return { roleName, username: u.username, exists: true, hasPassword: !!u.password_hash };
      }

      if (createIfMissing) {
        const uname = `${roleName.toLowerCase().replace(/\s+/g, '_')}_test_account`;
        const created = await createTestUser(uname, 'TestPass123!', roleId);
        if (created) {
          console.log(`${roleName}: created test user '${uname}' with password 'TestPass123!'`);
          return { roleName, username: uname, created: true, password: 'TestPass123!' };
        }
      }

      console.log(`${roleName}: no user found`);
      return { roleName, exists: false };
    };

    const adminCheck = await check(adminId, 'Admin', false);
    const glcCheck = await check(glcId, 'Grade Level Chairperson', false);
    const mtCheck = await check(mtId, 'Master Teacher', true);
    const teacherCheck = await check(teacherId, 'Teacher', true);

    // Verify test users' passwords where we created them
    if (mtCheck.created) {
      const ok = await verifyPassword(mtCheck.username, mtCheck.password);
      console.log(`Master Teacher test login verification: ${ok ? 'OK' : 'FAILED'}`);
    }

    if (teacherCheck.created) {
      const ok = await verifyPassword(teacherCheck.username, teacherCheck.password);
      console.log(`Teacher test login verification: ${ok ? 'OK' : 'FAILED'}`);
    }

    // Confirm Student/Guest is not a login role
    const studentRole = await pool.query("SELECT role_id FROM roles WHERE role_name = 'Student' OR role_name = 'Guest' LIMIT 1");
    console.log('\nStudent/Guest role present?', studentRole.rows.length > 0);

    console.log('\nDone. Minimal changes applied: added Teacher role if missing; created test users only when needed.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
};

run();
