require('dotenv').config()
const pool = require('../src/config/database')

const run = async () => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const resources = await client.query(`
      SELECT sec.section_id, u.user_id
      FROM sections sec
      JOIN grade_levels gl ON gl.grade_level_id = sec.grade_level_id
      CROSS JOIN users u
      WHERE gl.grade_level_name ILIKE '%7%'
      LIMIT 1
    `)
    if (!resources.rows[0]) throw new Error('Test requires a Grade 7 section and user fixture.')
    const { section_id, user_id } = resources.rows[0]
    const program = await client.query(`
      INSERT INTO jhs_class_programs (section_id, school_year, header, status, created_by)
      VALUES ($1, '2099-2100', '{}'::JSONB, 'draft', $2)
      RETURNING program_id
    `, [section_id, user_id])
    const insertEntry = () => client.query(`
      INSERT INTO jhs_class_program_entries
        (program_id, section_id, day_of_week, start_time, duration_minutes, activity, status)
      VALUES ($1, $2, 'Monday', '23:15', 45, 'BREAK', 'draft')
    `, [program.rows[0].program_id, section_id])
    await insertEntry()
    try {
      await insertEntry()
      throw new Error('Expected the database to reject the overlapping second entry.')
    } catch (error) {
      if (error.code !== '23P01') throw error
    }
    await client.query('ROLLBACK')
    console.log('PASS: PostgreSQL rejected a same-period teacher/room/section overlap (test transaction rolled back).')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('FAIL: JHS conflict constraint smoke test:', error.message)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

run()