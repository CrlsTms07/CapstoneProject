// Shared – test helper: a separate PostgreSQL database for the integration tests.
//
// The tests never touch the real database: they use "<DB_NAME>_test" (created automatically),
// wipe it, build the schema exactly like production (base tables + startup migrations) and add a
// small set of sample records (seedFixtures). Require this file BEFORE anything from src/.
require('dotenv').config({ quiet: true })

process.env.NODE_ENV = 'test'
if (!String(process.env.DB_NAME || '').endsWith('_test')) process.env.DB_NAME = `${process.env.DB_NAME}_test`
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'integration-test-secret'

const { Client } = require('pg')
const bcrypt = require('bcrypt')
const pool = require('../../src/config/database')
const { createBaseTables } = require('../../src/db/seeds/baseSchema')
const { runMigrations } = require('../../src/db/migrations')
const { seedTimeTemplates } = require('../../src/db/migrations/timeTemplates.migration')

const TEST_PASSWORD = 'Test-Password-1'

const createDatabaseIfMissing = async () => {
  const admin = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres'
  })
  await admin.connect()
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [process.env.DB_NAME])
    if (!exists.rowCount) await admin.query(`CREATE DATABASE "${process.env.DB_NAME}"`)
  } finally {
    await admin.end()
  }
}

// Wipes the TEST database and rebuilds the schema. Refuses to run on a database not named *_test.
const resetTestDatabase = async () => {
  if (!process.env.DB_NAME.endsWith('_test')) throw new Error('Refusing to reset a database that is not a _test database.')
  await createDatabaseIfMissing()
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;')
  await createBaseTables(pool)
  await pool.query(`
    INSERT INTO roles (role_id, role_name) VALUES
      (1, 'Admin'), (2, 'Grade Level Chairperson'), (3, 'Master Teacher'), (4, 'Teacher');
    SELECT setval('roles_role_id_seq', 10);
  `)
  await runMigrations()
}

const one = async (sql, params) => (await pool.query(sql, params)).rows[0]

// Sample school: a JHS department (Grade 7: Rizal, Mabini) and an SHS department (Grade 11: STEM A),
// rooms in each building, subjects, and one account per role.
const seedFixtures = async () => {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4)
  const jhs = await one(`INSERT INTO departments (department_name) VALUES ('Junior High School') RETURNING department_id`)
  const shs = await one(`INSERT INTO departments (department_name) VALUES ('Senior High School') RETURNING department_id`)
  const grade7 = await one('INSERT INTO grade_levels (grade_level_name, department_id) VALUES ($1, $2) RETURNING grade_level_id', ['Grade 7', jhs.department_id])
  const grade11 = await one('INSERT INTO grade_levels (grade_level_name, department_id) VALUES ($1, $2) RETURNING grade_level_id', ['Grade 11', shs.department_id])

  const section = async (name, gradeLevelId) => (await one('INSERT INTO sections (section_name, grade_level_id) VALUES ($1, $2) RETURNING section_id', [name, gradeLevelId])).section_id
  const sections = {
    rizal: await section('Rizal', grade7.grade_level_id),
    mabini: await section('Mabini', grade7.grade_level_id),
    stemA: await section('STEM A', grade11.grade_level_id)
  }

  const jhsBuilding = await one(`INSERT INTO buildings (building_name, department_id) VALUES ('JHS Building', $1) RETURNING building_id`, [jhs.department_id])
  const shsBuilding = await one(`INSERT INTO buildings (building_name, department_id) VALUES ('SHS Building', $1) RETURNING building_id`, [shs.department_id])
  const room = async (number, buildingId) => (await one('INSERT INTO rooms (room_number, building_id) VALUES ($1, $2) RETURNING room_id', [number, buildingId])).room_id
  const rooms = {
    r101: await room('101', jhsBuilding.building_id),
    r102: await room('102', jhsBuilding.building_id),
    r201: await room('201', shsBuilding.building_id),
    r202: await room('202', shsBuilding.building_id),
    r203: await room('203', shsBuilding.building_id)
  }

  // Weekly minutes follow the Grade 7 class program: an "Enhanced" subject takes an 80-minute period
  // every day (4 × 80 + 80), a regular one a 45-minute Mon–Thu period plus 40 on Friday (4 × 45 + 40).
  const subject = async (name, gradeLevelId, weeklyMinutes = null) => (await one('INSERT INTO subjects (subject_name, grade_level_id, weekly_minutes) VALUES ($1, $2, $3) RETURNING subject_id', [name, gradeLevelId, weeklyMinutes])).subject_id
  const subjects = {
    math7: await subject('Math 7', grade7.grade_level_id, 400),
    english7: await subject('English 7', grade7.grade_level_id, 220),
    science7: await subject('Science 7', grade7.grade_level_id, 220),
    genMath: await subject('General Mathematics', grade11.grade_level_id, 240)
  }

  const user = async (key, roleId, extra = {}) => (await one(`
    INSERT INTO users (username, full_name, email, password_hash, role_id, department_id, assigned_grade_level_id, is_approved)
    VALUES ($1, $2, $1, $3, $4, $5, $6, TRUE) RETURNING user_id
  `, [`${key}@school.test`, extra.fullName || key, passwordHash, roleId, extra.departmentId || null, extra.gradeLevelId || null])).user_id
  const users = {
    admin: await user('admin', 1),
    chair7: await user('chair7', 2, { departmentId: jhs.department_id, gradeLevelId: grade7.grade_level_id }),
    chair11: await user('chair11', 2, { departmentId: shs.department_id, gradeLevelId: grade11.grade_level_id }),
    masterJhs: await user('master', 3, { departmentId: jhs.department_id }),
    chairUnassigned: await user('chairnone', 2)
  }

  const teacher = async (key, fullName, extra = {}) => {
    const userId = await user(key, 4, { fullName, departmentId: extra.departmentId || jhs.department_id })
    return (await one('INSERT INTO teachers (user_id, last_name, max_subject_load, weekly_load_minutes) VALUES ($1, $2, $3, $4) RETURNING teacher_id',
      [userId, fullName.split(' ').pop(), extra.maxSubjects || null, extra.weeklyMinutes || null])).teacher_id
  }
  const teachers = {
    cruz: await teacher('cruz', 'Ana Cruz'),
    santos: await teacher('santos', 'Ben Santos'),
    reyes: await teacher('reyes', 'Carla Reyes', { departmentId: shs.department_id })
  }
  await pool.query('INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES ($1, $2), ($3, $4), ($3, $5), ($6, $7)', [
    teachers.cruz, subjects.math7, teachers.santos, subjects.english7, subjects.science7, teachers.reyes, subjects.genMath
  ])

  const term = await one('SELECT term_id FROM terms WHERE is_active')
  return {
    termId: term.term_id,
    departments: { jhs: jhs.department_id, shs: shs.department_id },
    gradeLevels: { grade7: grade7.grade_level_id, grade11: grade11.grade_level_id },
    sections,
    rooms,
    subjects,
    users,
    teachers
  }
}

// Inserts an entry straight into the table (bypassing the API) – for setting up a situation.
// The database trigger adds teacher_id to entry_teachers; coTeacherId adds a second teacher.
const insertEntry = async (entry) => {
  const row = await one(`
    INSERT INTO schedule_entries (term_id, section_id, subject_id, teacher_id, room_id, activity, delivery_mode, day_of_week, start_min, end_min, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *
  `, [entry.term_id, entry.section_id, entry.subject_id ?? null, entry.teacher_id ?? null, entry.room_id ?? null,
    entry.activity ?? null, entry.delivery_mode || 'face_to_face', entry.day_of_week, entry.start_min, entry.end_min, entry.status || 'draft'])
  if (entry.coTeacherId) {
    // The copied columns are placeholders; the trigger fills them from the entry.
    await pool.query("INSERT INTO entry_teachers (entry_id, teacher_id, term_id, day_of_week, start_min, end_min, status) VALUES ($1, $2, 0, '', 0, 0, '')", [row.entry_id, entry.coTeacherId])
  }
  return row
}

// Seeds the CLAUDE.md time templates for every matching grade level that has none (e.g. the fixture's Grade 7).
const seedTemplates = () => seedTimeTemplates(pool)

module.exports = { pool, TEST_PASSWORD, resetTestDatabase, seedFixtures, insertEntry, seedTemplates }
