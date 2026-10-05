// HIPO 3.2 – Schedule Plotter (database layer)
// Startup migration: time templates replace department_time_rules (CLAUDE.md "Scheduling Rules").
//   time_templates       – one template per grade level (and its department), e.g. "Grade 7 Class Program"
//   time_template_slots  – the template's periods: day_pattern, start_min–end_min, slot_type, label
//     day_pattern  MON_THU (Junior High: one schedule for Monday–Thursday) | FRI | MON | TUE | WED | THU
//     slot_type    class | break | lunch | no_class
//     default_delivery_mode – optional; an SHS window such as 09:30–11:30 is "asynchronous"
//
// Additive only. department_time_rules is no longer read but is left in place with its rows.
// The Grade 7 (JHS) and Grade 12 (SHS) templates from CLAUDE.md are seeded once per matching grade
// level; a grade level that does not exist yet is seeded on a later start, after it is created.
const pool = require('../../config/database')
const { gradeOf } = require('../../modules/schedules/schedules.validation')

const TIME_TEMPLATE_TABLES_SQL = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Lets time_templates point at (grade level, department) as one pair.
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grade_levels_id_department_unique') THEN
        ALTER TABLE grade_levels ADD CONSTRAINT grade_levels_id_department_unique UNIQUE (grade_level_id, department_id);
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS time_templates (
        template_id SERIAL PRIMARY KEY,
        department_id INT NOT NULL REFERENCES departments(department_id) ON UPDATE CASCADE ON DELETE CASCADE,
        grade_level_id INT NOT NULL,
        template_name VARCHAR(100) NOT NULL CHECK (BTRIM(template_name) <> ''),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT time_templates_grade_unique UNIQUE (grade_level_id),
        CONSTRAINT time_templates_grade_department_fk FOREIGN KEY (grade_level_id, department_id)
            REFERENCES grade_levels(grade_level_id, department_id) ON UPDATE CASCADE ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS time_template_slots (
        slot_id SERIAL PRIMARY KEY,
        template_id INT NOT NULL REFERENCES time_templates(template_id) ON UPDATE CASCADE ON DELETE CASCADE,
        day_pattern VARCHAR(7) NOT NULL CHECK (day_pattern IN ('MON_THU', 'FRI', 'MON', 'TUE', 'WED', 'THU')),
        start_min SMALLINT NOT NULL,
        end_min SMALLINT NOT NULL,
        slot_type VARCHAR(8) NOT NULL CHECK (slot_type IN ('class', 'break', 'lunch', 'no_class')),
        label VARCHAR(60),
        default_delivery_mode VARCHAR(13) CHECK (default_delivery_mode IN ('face_to_face', 'asynchronous')),
        CONSTRAINT time_template_slots_time_order CHECK (0 <= start_min AND start_min < end_min AND end_min <= 1440),
        CONSTRAINT time_template_slots_delivery_on_class CHECK (default_delivery_mode IS NULL OR slot_type = 'class'),
        CONSTRAINT time_template_slots_no_overlap EXCLUDE USING GIST
            (template_id WITH =, day_pattern WITH =, int4range(start_min, end_min) WITH &&)
    );
    CREATE INDEX IF NOT EXISTS time_template_slots_template_idx ON time_template_slots (template_id, day_pattern, start_min);

    -- A template is either Junior High (MON_THU + FRI) or one pattern per day; MON_THU never mixes
    -- with MON / TUE / WED / THU, otherwise Monday would have two different schedules.
    CREATE OR REPLACE FUNCTION guard_time_template_patterns() RETURNS TRIGGER AS $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM time_template_slots s
        WHERE s.template_id = NEW.template_id AND s.slot_id IS DISTINCT FROM NEW.slot_id
          AND ((NEW.day_pattern = 'MON_THU' AND s.day_pattern IN ('MON', 'TUE', 'WED', 'THU'))
            OR (NEW.day_pattern IN ('MON', 'TUE', 'WED', 'THU') AND s.day_pattern = 'MON_THU'))
      ) THEN
        RAISE EXCEPTION 'A time template uses MON_THU or separate MON/TUE/WED/THU patterns, not both.'
          USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS time_template_pattern_guard ON time_template_slots;
    CREATE TRIGGER time_template_pattern_guard
      BEFORE INSERT OR UPDATE ON time_template_slots
      FOR EACH ROW EXECUTE FUNCTION guard_time_template_patterns();
`

const t = text => {
  const [hours, minutes] = text.split(':').map(Number)
  return hours * 60 + minutes
}
const slot = (day_pattern, start, end, slot_type = 'class', label = null, default_delivery_mode = null) =>
  ({ day_pattern, start_min: t(start), end_min: t(end), slot_type, label, default_delivery_mode })

// Grade 7 – Honesty class program, S.Y. 2026-2027 (CLAUDE.md "Scheduling Rules").
const GRADE_7_SLOTS = [
  slot('MON_THU', '06:30', '07:15'), slot('MON_THU', '07:15', '08:00'), slot('MON_THU', '08:00', '09:20'),
  slot('MON_THU', '09:20', '09:40', 'break', 'BREAK'),
  slot('MON_THU', '09:40', '10:25'), slot('MON_THU', '10:25', '11:45'), slot('MON_THU', '11:45', '12:30'),
  slot('MON_THU', '12:30', '12:50', 'lunch', 'LUNCH'),
  slot('MON_THU', '12:50', '14:10'), slot('MON_THU', '14:10', '14:55'), slot('MON_THU', '14:55', '15:40'),
  slot('MON_THU', '15:40', '16:25'),
  slot('FRI', '06:30', '07:10'), slot('FRI', '07:10', '07:50'), slot('FRI', '07:50', '09:10'),
  slot('FRI', '09:10', '09:30', 'break', 'BREAK'),
  slot('FRI', '09:30', '10:10'), slot('FRI', '10:10', '11:30'), slot('FRI', '11:30', '12:10'),
  slot('FRI', '12:10', '12:30', 'lunch', 'LUNCH'),
  slot('FRI', '12:30', '13:50'), slot('FRI', '13:50', '14:30'), slot('FRI', '14:30', '15:10'),
  slot('FRI', '15:10', '15:50'), slot('FRI', '15:50', '16:30', 'class', 'HGP')
]

// Grade 12 (ABM 12-1) class program, First Term S.Y. 2026-2027 – the same day shape Monday to Friday.
const GRADE_12_DAY = pattern => [
  slot(pattern, '09:30', '11:30', 'class', 'ASYNCHRONOUS', 'asynchronous'),
  slot(pattern, '11:30', '12:30', 'no_class', 'NO CLASS'),
  slot(pattern, '12:30', '14:30'),
  slot(pattern, '14:30', '15:00', 'break', 'BREAK'),
  slot(pattern, '15:00', '17:00'),
  slot(pattern, '17:00', '19:00')
]
const GRADE_12_SLOTS = ['MON', 'TUE', 'WED', 'THU', 'FRI'].flatMap(GRADE_12_DAY)

const SEEDED_TEMPLATES = [
  { grade: 7, name: 'Grade 7 Class Program', slots: GRADE_7_SLOTS },
  { grade: 12, name: 'Grade 12 Class Program', slots: GRADE_12_SLOTS }
]

const seedMarker = (grade, gradeLevelId) => `seed-time-template-grade-${grade}:${gradeLevelId}`

const insertTemplate = async (client, gradeLevel, template) => {
  const created = await client.query(`
    INSERT INTO time_templates (department_id, grade_level_id, template_name)
    VALUES ($1, $2, $3) RETURNING template_id
  `, [gradeLevel.department_id, gradeLevel.grade_level_id, template.name])
  const templateId = created.rows[0].template_id
  for (const item of template.slots) {
    await client.query(`
      INSERT INTO time_template_slots (template_id, day_pattern, start_min, end_min, slot_type, label, default_delivery_mode)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [templateId, item.day_pattern, item.start_min, item.end_min, item.slot_type, item.label, item.default_delivery_mode])
  }
  return templateId
}

// Seeds each template once per matching grade level that has no template yet. The marker keeps a
// template an admin deleted on purpose from coming back on the next start.
const seedTimeTemplates = async client => {
  const gradeLevels = (await client.query(`
    SELECT gl.grade_level_id, gl.grade_level_name, gl.department_id
    FROM grade_levels gl
    WHERE NOT EXISTS (SELECT 1 FROM time_templates tt WHERE tt.grade_level_id = gl.grade_level_id)
  `)).rows
  const seeded = []
  for (const template of SEEDED_TEMPLATES) {
    for (const gradeLevel of gradeLevels.filter(level => gradeOf(level.grade_level_name) === template.grade)) {
      const marker = seedMarker(template.grade, gradeLevel.grade_level_id)
      const done = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [marker])
      if (done.rowCount) continue
      await insertTemplate(client, gradeLevel, template)
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [marker])
      seeded.push(gradeLevel.grade_level_id)
    }
  }
  return seeded
}

const ensureTimeTemplatesSchema = async () => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('CREATE EXTENSION IF NOT EXISTS btree_gist')
    await client.query(TIME_TEMPLATE_TABLES_SQL)
    await seedTimeTemplates(client)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

module.exports = { ensureTimeTemplatesSchema, seedTimeTemplates, GRADE_7_SLOTS, GRADE_12_SLOTS }
