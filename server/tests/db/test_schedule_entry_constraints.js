// HIPO 3.2 – Schedule Plotter (database test)
// Smoke test on the real database: PostgreSQL must reject an overlapping schedule entry for the
// same section (exclusion constraint) and ignore rejected rows. Everything is rolled back.
require('dotenv').config({ quiet: true })
const pool = require('../../src/config/database')

const run = async () => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const fixture = await client.query(`
      SELECT (SELECT section_id FROM sections LIMIT 1) AS section_id,
             (SELECT term_id FROM terms ORDER BY is_active DESC LIMIT 1) AS term_id
    `)
    const { section_id, term_id } = fixture.rows[0]
    if (!section_id || !term_id) throw new Error('Test requires at least one section and one term.')
    const insert = status => client.query(`
      INSERT INTO schedule_entries (term_id, section_id, activity, day_of_week, start_min, end_min, status)
      VALUES ($1, $2, 'SMOKE TEST', 'Saturday', 1380, 1425, $3)
    `, [term_id, section_id, status])
    await insert('draft')
    await insert('rejected') // rejected rows never block
    await client.query('SAVEPOINT overlap')
    try {
      await insert('draft')
      throw new Error('Expected the database to reject the overlapping entry.')
    } catch (error) {
      if (error.code !== '23P01') throw error
    }
    await client.query('ROLLBACK')
    console.log('PASS: schedule_entries rejected a same-section overlap and ignored rejected rows (rolled back).')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('FAIL: schedule_entries constraint smoke test:', error.message)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

run()
