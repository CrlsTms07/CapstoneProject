import React, { useEffect, useMemo, useState } from 'react'
import StaffLayout from '../components/StaffLayout'
import { Icon } from '../components/DashboardPrimitives'
import '../styles/schedulePlotter.css'

const GRADES = ['7', '8', '9', '10']
const MON_THU_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday']
const ACTIVITIES = ['BREAK', 'LUNCH', 'HOMEROOM', 'FLAG CEREMONY', 'OTHER']
const SCHOOL_ADDRESS = 'Poinsettia St., Via Verde Village, San Agustin II, City of Dasmariñas, Cavite, 4114'
const DEPED_LOGO = 'https://www.deped.gov.ph/wp-content/uploads/Bagong-Pilipinas-Logo.png'
const ERCIHS_LOGO = 'https://vote.ercihs.edu.ph/ERCIHS%20LOGO.png'

const makeRow = () => ({
  id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  monThuTime: '', monThuSubjectId: '', monThuActivity: '', monThuTeacherId: '', monThuBuildingId: '', monThuRoomId: '',
  fridayTime: '', fridaySubjectId: '', fridayActivity: '', fridayTeacherId: '', fridayBuildingId: '', fridayRoomId: ''
})

const makeDraft = grade => ({
  schoolName: 'Emmanuel Resurreccion Congressional Integrated High School',
  schoolAddress: SCHOOL_ADDRESS,
  contactDetails: '',
  schoolId: '301179',
  regionName: 'Region IV-A',
  divisionName: 'Schools Division of Dasmariñas City',
  schoolYear: '2026-2027',
  grade,
  section: '',
  adviser: '',
  depedLogo: DEPED_LOGO,
  divisionLogo: ERCIHS_LOGO,
  policyReferences: 'DO 10, s. 2024; DO 09, s. 2026; DO 12, s. 2024',
  preparedBy: '',
  conforme: '',
  recommendingApproval: '',
  approvedBy: '',
  paperSize: 'letter',
  rows: [makeRow()]
})

const gradeNumber = value => String(value || '').match(/\b(?:grade\s*)?(7|8|9|10)\b/i)?.[1] || null
const minutesFromTime = value => {
  const [hours, minutes] = String(value || '').split(':').map(Number)
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null
}
const formatPeriod = value => {
  const start = minutesFromTime(value)
  if (start === null) return ''
  const format = total => `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  return `${format(start)} - ${format(start + 45)}`
}
const formatHours = minutes => `${(minutes / 60).toFixed(2)} hrs`

function buildEntries(rows) {
  const entries = []
  rows.forEach(row => {
    const addSide = (prefix, days) => {
      const time = row[`${prefix}Time`]
      const subjectId = row[`${prefix}SubjectId`]
      const activity = row[`${prefix}Activity`]
      const teacherId = row[`${prefix}TeacherId`]
      const roomId = row[`${prefix}RoomId`]
      const buildingId = row[`${prefix}BuildingId`]
      if (!time || (!subjectId && !activity)) return
      if (subjectId && (!teacherId || !roomId || !buildingId)) return
      if (!subjectId && !activity) return
      days.forEach(day => entries.push({
        day_of_week: day,
        start_time: time,
        duration_minutes: 45,
        subject_id: subjectId ? Number(subjectId) : null,
        activity: subjectId ? null : activity,
        teacher_id: subjectId ? Number(teacherId) : null,
        room_id: subjectId ? Number(roomId) : null
      }))
    }
    addSide('monThu', MON_THU_DAYS)
    addSide('friday', ['Friday'])
  })
  return entries
}

function rowsFromEntries(entries) {
  const weekdays = entries.filter(entry => entry.day_of_week !== 'Friday')
  const monTimes = [...new Set(weekdays.map(entry => String(entry.start_time).slice(0, 5)))].sort()
  const fridayEntries = entries.filter(entry => entry.day_of_week === 'Friday').sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
  const weekdayEntries = monTimes.map(time => weekdays.find(entry => entry.day_of_week === 'Monday' && String(entry.start_time).slice(0, 5) === time) || weekdays.find(entry => String(entry.start_time).slice(0, 5) === time))
  const count = Math.max(monTimes.length, fridayEntries.length, 1)
  return Array.from({ length: count }, (_, index) => {
    const row = makeRow()
    const mon = weekdayEntries[index]
    const friday = fridayEntries[index]
    if (mon) Object.assign(row, {
      monThuTime: String(mon.start_time).slice(0, 5), monThuSubjectId: mon.subject_id ? String(mon.subject_id) : '',
      monThuActivity: mon.activity || '', monThuTeacherId: mon.teacher_id ? String(mon.teacher_id) : '',
      monThuBuildingId: mon.building_id ? String(mon.building_id) : '', monThuRoomId: mon.room_id ? String(mon.room_id) : ''
    })
    if (friday) Object.assign(row, {
      fridayTime: String(friday.start_time).slice(0, 5), fridaySubjectId: friday.subject_id ? String(friday.subject_id) : '',
      fridayActivity: friday.activity || '', fridayTeacherId: friday.teacher_id ? String(friday.teacher_id) : '',
      fridayBuildingId: friday.building_id ? String(friday.building_id) : '', fridayRoomId: friday.room_id ? String(friday.room_id) : ''
    })
    return row
  })
}

function ProgramDocument({ draft, rows, options }) {
  const totalMonThu = rows.reduce((total, row) => total + (row.monThuTime && (row.monThuSubjectId || row.monThuActivity) ? 45 : 0), 0)
  const totalFriday = rows.reduce((total, row) => total + (row.fridayTime && (row.fridaySubjectId || row.fridayActivity) ? 45 : 0), 0)
  const subjectName = id => options.subjects.find(item => Number(item.subject_id) === Number(id))?.subject_name || ''
  const roomName = id => {
    const room = options.rooms.find(item => Number(item.room_id) === Number(id))
    const building = room && options.buildings.find(item => Number(item.building_id) === Number(room.building_id))
    return room ? `${building?.building_name ? `${building.building_name} · ` : ''}${room.room_number}` : ''
  }
  const teacherName = id => {
    const teacher = options.teachers.find(item => Number(item.teacher_id) === Number(id))
    return teacher?.full_name || teacher?.last_name || ''
  }

  return (
    <article className={`plot-print${draft.paperSize === 'long' ? ' plot-print-long' : ''}`}>
      <header className="print-official-header">
        <div className="print-logo print-logo-left"><img src={draft.depedLogo} alt="Department of Education official header mark" onError={event => { event.currentTarget.style.display = 'none' }} /><span>DEPARTMENT<br />OF EDUCATION</span></div>
        <div className="print-agency-copy"><div>Republic of the Philippines</div><strong>Department of Education</strong><div>{draft.regionName} · {draft.divisionName}</div></div>
        <div className="print-logo print-logo-right"><img src={draft.divisionLogo} alt="Regional or division logo" onError={event => { event.currentTarget.style.display = 'none' }} /><span>REGION /<br />DIVISION SEAL</span></div>
      </header>
      <section className="print-school-heading">
        <h1>{draft.schoolName}</h1><p>{draft.schoolAddress}</p>
        {draft.contactDetails && <p>{draft.contactDetails}</p>}
        <p>School ID: {draft.schoolId}</p>
        <h2>JHS GRADE {draft.grade} - CLASS PROGRAM</h2>
        <p><strong>S.Y. {draft.schoolYear}</strong></p>
        <p><strong>GRADE {draft.grade} - {draft.section || 'SECTION'}</strong></p>
        <p>Class Adviser: <strong>{draft.adviser || '____________________________'}</strong></p>
      </section>
      <table className="print-program-table">
        <colgroup><col className="print-time-col" /><col className="print-min-col" /><col className="print-subject-col" /><col className="print-time-col" /><col className="print-min-col" /><col className="print-subject-col" /><col className="print-teacher-col" /></colgroup>
        <thead><tr><th colSpan="3">MONDAY - THURSDAY</th><th colSpan="4">FRIDAY</th></tr><tr><th>TIME</th><th>No. of<br />Mins.</th><th>SUBJECT / ACTIVITY · ROOM</th><th>TIME</th><th>No. of<br />Mins.</th><th>SUBJECT / ACTIVITY · ROOM</th><th>TEACHER ASSIGNED</th></tr></thead>
        <tbody>{rows.map((row, index) => {
          const monSubject = row.monThuSubjectId ? subjectName(row.monThuSubjectId) : row.monThuActivity
          const friSubject = row.fridaySubjectId ? subjectName(row.fridaySubjectId) : row.fridayActivity
          return <tr key={row.id}>
            <td>{formatPeriod(row.monThuTime)}</td><td>{row.monThuTime && (row.monThuSubjectId || row.monThuActivity) ? 45 : ''}</td><td className="print-subject-cell">{monSubject}{row.monThuRoomId && <small className="print-room-line">{roomName(row.monThuRoomId)}</small>}</td>
            <td>{formatPeriod(row.fridayTime)}</td><td>{row.fridayTime && (row.fridaySubjectId || row.fridayActivity) ? 45 : ''}</td><td className="print-subject-cell">{friSubject}{row.fridayRoomId && <small className="print-room-line">{roomName(row.fridayRoomId)}</small>}</td><td>{teacherName(row.fridayTeacherId)}</td>
          </tr>
        })}
          <tr className="print-summary-row"><th colSpan="2">TOTAL MINUTES / DAY</th><td>{totalMonThu}</td><th colSpan="2">TOTAL MINUTES / DAY</th><td colSpan="2">{totalFriday}</td></tr>
          <tr className="print-summary-row"><th colSpan="2">TOTAL HOURS / DAY</th><td>{formatHours(totalMonThu)}</td><th colSpan="2">TOTAL HOURS / DAY</th><td colSpan="2">{formatHours(totalFriday)}</td></tr>
        </tbody>
      </table>
      <p className="print-policy"><strong>DepEd Orders / Policy References:</strong> {draft.policyReferences}</p>
      <section className="print-signatories" aria-label="Program signatories">
        <div><span>Prepared by:</span><strong>{draft.preparedBy || '____________________________'}</strong><small>Head Teacher III</small></div>
        <div><span>Conforme:</span><strong>{draft.conforme || draft.adviser || '____________________________'}</strong><small>Class Adviser</small></div>
        <div><span>Recommending Approval:</span><strong>{draft.recommendingApproval || '____________________________'}</strong><small>School Principal II</small></div>
        <div><span>Approved by:</span><strong>{draft.approvedBy || '____________________________'}</strong><small>PSDS Cluster IV</small></div>
      </section>
    </article>
  )
}

function ScheduleSide({ row, prefix, label, subjects, teachers, buildings, rooms, updateRow }) {
  const buildingId = row[`${prefix}BuildingId`]
  const availableRooms = rooms.filter(room => !buildingId || String(room.building_id) === String(buildingId))
  const update = (field, value) => updateRow(row.id, field, value)
  return <>
    <td><input type="time" aria-label={`${label} time`} value={row[`${prefix}Time`]} onChange={event => update(`${prefix}Time`, event.target.value)} /></td>
    <td className="plotter-fixed-minutes">45</td>
    <td className="plotter-subject-input">
      <select aria-label={`${label} subject`} value={row[`${prefix}SubjectId`] || (row[`${prefix}Activity`] ? '__activity__' : '')} onChange={event => {
        const value = event.target.value
        update(`${prefix}SubjectId`, value === '__activity__' || !value ? '' : value)
        update(`${prefix}Activity`, value === '__activity__' ? row[`${prefix}Activity`] || 'BREAK' : '')
        if (value === '__activity__') {
          update(`${prefix}TeacherId`, '')
          update(`${prefix}RoomId`, '')
          update(`${prefix}BuildingId`, '')
        }
      }}>
        <option value="">Select subject / activity</option>
        <option value="__activity__">Break / lunch / activity</option>
        {subjects.map(subject => <option key={subject.subject_id} value={String(subject.subject_id)}>{subject.subject_name}</option>)}
      </select>
      {!row[`${prefix}SubjectId`] && row[`${prefix}Activity`] && <select aria-label={`${label} activity`} value={row[`${prefix}Activity`]} onChange={event => update(`${prefix}Activity`, event.target.value)}>{ACTIVITIES.map(activity => <option key={activity} value={activity}>{activity}</option>)}</select>}
    </td>
    <td><select aria-label={`${label} teacher`} value={row[`${prefix}TeacherId`]} disabled={!row[`${prefix}SubjectId`]} onChange={event => update(`${prefix}TeacherId`, event.target.value)}><option value="">Assign teacher</option>{teachers.map(teacher => <option key={teacher.teacher_id} value={teacher.teacher_id}>{teacher.full_name || teacher.last_name}</option>)}</select></td>
    <td><select aria-label={`${label} building`} value={buildingId} disabled={!row[`${prefix}SubjectId`]} onChange={event => { update(`${prefix}BuildingId`, event.target.value); update(`${prefix}RoomId`, '') }}><option value="">Building</option>{buildings.map(building => <option key={building.building_id} value={building.building_id}>{building.building_name}</option>)}</select></td>
    <td><select aria-label={`${label} room`} value={row[`${prefix}RoomId`]} disabled={!row[`${prefix}SubjectId`] || !buildingId} onChange={event => update(`${prefix}RoomId`, event.target.value)}><option value="">Room</option>{availableRooms.map(room => <option key={room.room_id} value={room.room_id}>{room.room_number}</option>)}</select></td>
  </>
}

export default function SchedulePlotter({ user }) {
  const [grade, setGrade] = useState('7')
  const [sectionId, setSectionId] = useState('')
  const [sections, setSections] = useState([])
  const [gradeLevels, setGradeLevels] = useState([])
  const [options, setOptions] = useState({ subjects: [], teachers: [], rooms: [], buildings: [] })
  const [draft, setDraft] = useState(() => makeDraft('7'))
  const [programId, setProgramId] = useState(null)
  const [status, setStatus] = useState('draft')
  const [theme, setTheme] = useState('light')
  const [view, setView] = useState('editor')
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadingProgram, setLoadingProgram] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [validation, setValidation] = useState({ conflicts: [], warnings: [] })

  useEffect(() => {
    let active = true
    Promise.all([
      fetch('/api/sections', { credentials: 'include' }).then(response => response.ok ? response.json() : []),
      fetch('/api/grade-levels', { credentials: 'include' }).then(response => response.ok ? response.json() : []),
      fetch('/api/subjects', { credentials: 'include' }).then(response => response.ok ? response.json() : []),
      fetch('/api/teachers', { credentials: 'include' }).then(response => response.ok ? response.json() : []),
      fetch('/api/rooms', { credentials: 'include' }).then(response => response.ok ? response.json() : []),
      fetch('/api/buildings', { credentials: 'include' }).then(response => response.ok ? response.json() : [])
    ]).then(([sectionData, gradeData, subjectData, teacherData, roomData, buildingData]) => {
      if (!active) return
      setSections(Array.isArray(sectionData) ? sectionData : sectionData?.rows || [])
      setGradeLevels(Array.isArray(gradeData) ? gradeData : gradeData?.rows || [])
      setOptions({
        subjects: Array.isArray(subjectData) ? subjectData : subjectData?.rows || [],
        teachers: Array.isArray(teacherData) ? teacherData : teacherData?.rows || [],
        rooms: Array.isArray(roomData) ? roomData : roomData?.rows || [],
        buildings: Array.isArray(buildingData) ? buildingData : buildingData?.rows || []
      })
    }).catch(() => { if (active) setError('Unable to load JHS sections and schedule resources. Please sign in and try again.') })
      .finally(() => { if (active) setLoadingOptions(false) })
    return () => { active = false }
  }, [])

  const gradeIds = useMemo(() => new Set(gradeLevels.filter(item => gradeNumber(item.grade_level_name) === grade).map(item => String(item.grade_level_id))), [grade, gradeLevels])
  const assignedGradeLevel = gradeLevels.find(item => Number(item.grade_level_id) === Number(user?.assigned_grade_level_id))
  const assignedGrade = gradeNumber(assignedGradeLevel?.grade_level_name)
  const gradeOptions = Number(user?.role_id) === 2 ? (assignedGrade ? [assignedGrade] : []) : GRADES
  const gradeSections = useMemo(() => sections.filter(section =>
    gradeIds.has(String(section.grade_level_id)) && (Number(user?.role_id) !== 2 || String(section.grade_level_id) === String(user?.assigned_grade_level_id))
  ), [sections, gradeIds, user?.role_id, user?.assigned_grade_level_id])
  const selectedSection = gradeSections.find(section => String(section.section_id) === sectionId)
  const gradeSubjects = options.subjects.filter(subject => gradeIds.has(String(subject.grade_level_id)))
  const entries = useMemo(() => buildEntries(draft.rows), [draft.rows])
  const totalMonThu = draft.rows.reduce((sum, row) => sum + (row.monThuTime && (row.monThuSubjectId || row.monThuActivity) ? 45 : 0), 0)
  const totalFriday = draft.rows.reduce((sum, row) => sum + (row.fridayTime && (row.fridaySubjectId || row.fridayActivity) ? 45 : 0), 0)
  const incompleteCount = draft.rows.filter(row => ['monThu', 'friday'].some(prefix => {
    const active = row[`${prefix}Time`] || row[`${prefix}SubjectId`] || row[`${prefix}Activity`] || row[`${prefix}TeacherId`] || row[`${prefix}RoomId`]
    if (!active) return false
    if (row[`${prefix}SubjectId`]) return !row[`${prefix}Time`] || !row[`${prefix}TeacherId`] || !row[`${prefix}BuildingId`] || !row[`${prefix}RoomId`]
    return !row[`${prefix}Time`] || !row[`${prefix}Activity`]
  })).length

  useEffect(() => {
    if (Number(user?.role_id) !== 2 || !assignedGrade || assignedGrade === grade) return
    setGrade(assignedGrade)
    setSectionId('')
    setProgramId(null)
    setStatus('draft')
    setDraft(current => ({ ...makeDraft(assignedGrade), schoolYear: current.schoolYear }))
  }, [user?.role_id, assignedGrade, grade])

  useEffect(() => {
    if (!sectionId || !entries.length) {
      setValidation({ conflicts: [], warnings: [] })
      return undefined
    }
    let active = true
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/class-programs/validate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ section_id: Number(sectionId), program_id: programId, entries })
        })
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.error || 'Schedule validation failed.')
        if (active) setValidation(data)
      } catch (validationError) {
        if (active) setValidation({ conflicts: [], warnings: [], error: validationError.message })
      }
    }, 350)
    return () => { active = false; window.clearTimeout(timer) }
  }, [sectionId, programId, entries])

  useEffect(() => {
    if (!sectionId) return undefined
    let active = true
    const loadProgram = async () => {
      setLoadingProgram(true)
      setError('')
      try {
        const response = await fetch(`/api/class-programs/section/${sectionId}?school_year=${encodeURIComponent(draft.schoolYear)}`, { credentials: 'include' })
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.error || 'Unable to load saved class program.')
        if (!active) return
        const program = data?.program
        setProgramId(program?.program_id || null)
        setStatus(program?.status || 'draft')
        setValidation({ conflicts: [], warnings: data?.warnings || [] })
        setDraft(current => ({ ...makeDraft(grade), ...(program?.header || {}), grade, section: selectedSection?.section_name || '', schoolYear: current.schoolYear, rows: program ? rowsFromEntries(program.entries || []) : [makeRow()] }))
      } catch (loadError) {
        if (active) setError(loadError.message)
      } finally {
        if (active) setLoadingProgram(false)
      }
    }
    loadProgram()
    return () => { active = false }
  }, [sectionId, draft.schoolYear, grade, selectedSection?.section_name])

  const updateHeader = (field, value) => {
    setDraft(current => ({ ...current, [field]: value }))
    setError('')
  }

  const updateRow = (rowId, field, value) => {
    setDraft(current => ({ ...current, rows: current.rows.map(row => row.id === rowId ? { ...row, [field]: value } : row) }))
    setError('')
  }

  const changeGrade = value => {
    setGrade(value)
    setSectionId('')
    setProgramId(null)
    setStatus('draft')
    setDraft(current => ({ ...makeDraft(value), schoolYear: current.schoolYear }))
  }

  const changeSection = value => {
    setSectionId(value)
    setProgramId(null)
    setStatus('draft')
    setValidation({ conflicts: [], warnings: [] })
    setDraft(current => ({ ...makeDraft(grade), schoolYear: current.schoolYear }))
  }

  const changeSchoolYear = value => {
    setProgramId(null)
    setStatus('draft')
    updateHeader('schoolYear', value)
  }

  const addRow = () => setDraft(current => ({ ...current, rows: [...current.rows, makeRow()] }))
  const removeRow = rowId => setDraft(current => ({ ...current, rows: current.rows.length > 1 ? current.rows.filter(row => row.id !== rowId) : [makeRow()] }))
  const moveRow = (index, amount) => setDraft(current => {
    const target = index + amount
    if (target < 0 || target >= current.rows.length) return current
    const rows = [...current.rows]
    ;[rows[index], rows[target]] = [rows[target], rows[index]]
    return { ...current, rows }
  })

  const saveProgram = async nextStatus => {
    if (!sectionId) { setError('Select a registered Grade 7–10 section first.'); return }
    if (validation.conflicts.length) { setError('Resolve the schedule conflicts before saving or submitting.'); return }
    if (validation.error) { setError(validation.error); return }
    if (incompleteCount) { setError('Complete the time, teacher, and room assignments for each selected subject.'); return }
    if (nextStatus === 'pending' && !entries.some(entry => entry.subject_id)) { setError('Add at least one assigned subject before submitting.'); return }
    setSaving(true)
    setError('')
    try {
      const header = { ...draft, section: selectedSection?.section_name || draft.section, grade }
      const response = await fetch('/api/class-programs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ section_id: Number(sectionId), school_year: draft.schoolYear, header, entries, status: nextStatus })
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.message || data?.error || 'Unable to save the class program.')
      setProgramId(data.program.program_id)
      setStatus(data.program.status)
      setValidation(current => ({ ...current, warnings: data.warnings || [] }))
      setSaveMessage(nextStatus === 'pending' ? 'Submitted for admin approval.' : 'Draft saved to the database.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  const resetDraft = () => {
    if (!window.confirm('Clear this unsaved editor view? The saved database draft will remain unchanged.')) return
    setDraft({ ...makeDraft(grade), schoolYear: draft.schoolYear, section: selectedSection?.section_name || '' })
    setSaveMessage('Unsaved editor values cleared.')
    setError('')
  }

  const exportCsv = () => {
    const subjectName = id => options.subjects.find(item => Number(item.subject_id) === Number(id))?.subject_name || ''
    const teacherName = id => options.teachers.find(item => Number(item.teacher_id) === Number(id))?.full_name || options.teachers.find(item => Number(item.teacher_id) === Number(id))?.last_name || ''
    const roomName = id => options.rooms.find(item => Number(item.room_id) === Number(id))?.room_number || ''
    const csvRows = [['Day', 'Time', 'Minutes', 'Subject / Activity', 'Teacher', 'Room', 'Building']]
    entries.forEach(entry => {
      const row = draft.rows.find(item => (item.monThuTime === entry.start_time && (item.monThuSubjectId ? Number(item.monThuSubjectId) === entry.subject_id : item.monThuActivity === entry.activity)) || (item.fridayTime === entry.start_time && (item.fridaySubjectId ? Number(item.fridaySubjectId) === entry.subject_id : item.fridayActivity === entry.activity)))
      const friday = entry.day_of_week === 'Friday'
      const prefix = friday ? 'friday' : 'monThu'
      const id = field => row?.[`${prefix}${field}`]
      const buildingName = options.buildings.find(item => Number(item.building_id) === Number(id('BuildingId')))?.building_name || ''
      csvRows.push([entry.day_of_week, entry.start_time, 45, entry.subject_id ? subjectName(entry.subject_id) : entry.activity, teacherName(id('TeacherId')), roomName(id('RoomId')), buildingName])
    })
    const csv = csvRows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `JHS-Grade-${grade}-${(draft.section || 'class-program').replace(/[^a-z0-9-]/gi, '-')}-${draft.schoolYear}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const subjectCount = new Set(entries.filter(entry => entry.subject_id).map(entry => `${entry.teacher_id}:${entry.subject_id}`)).size

  return (
    <StaffLayout user={user} title="Schedule Plotter" subtitle="Plot and submit Junior High School class programs for Grades 7–10.">
      <div className="schedule-plotter" data-view={view} data-theme={theme}>
        <div className="plotter-interface">
          {Number(user?.role_id) === 2 && !user?.assigned_grade_level_id && <div className="plotter-error" role="status">Your administrator must assign your Grade 7–10 level before you can plot class programs.</div>}
          <section className="plotter-toolbar flex flex-wrap items-end gap-3" aria-label="Schedule plotter controls">
            <div className="plotter-selectors">
              <label>Grade level<select value={grade} onChange={event => changeGrade(event.target.value)}>{gradeOptions.map(item => <option key={item} value={item}>Grade {item}</option>)}</select></label>
              <label>Section<select value={sectionId} onChange={event => changeSection(event.target.value)} disabled={loadingOptions}><option value="">Select section</option>{gradeSections.map(section => <option key={section.section_id} value={section.section_id}>{section.section_name}</option>)}</select></label>
              <label>School year<select value={draft.schoolYear} onChange={event => changeSchoolYear(event.target.value)}>{['2025-2026', '2026-2027', '2027-2028'].map(year => <option key={year} value={year}>{year}</option>)}</select></label>
              <label className="plotter-paper-select">Paper<select value={draft.paperSize} onChange={event => updateHeader('paperSize', event.target.value)}><option value="letter">Short bond · 8.5 × 11 in</option><option value="long">Long bond · 8.5 × 13 in</option></select></label>
            </div>
            <div className="plotter-actions">
              <span className={`plotter-program-status status-${status}`}>{status === 'pending' ? 'Pending Admin Approval' : status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected · revise draft' : 'Draft'}</span>
              <button className="plotter-button" type="button" onClick={resetDraft}>Reset</button>
              <button className="plotter-button plotter-button-primary" type="button" disabled={saving || loadingProgram || status === 'pending' || status === 'approved'} onClick={() => saveProgram('draft')}>Save Draft</button>
              <button className="plotter-button plotter-button-primary" type="button" disabled={saving || loadingProgram || status === 'pending' || status === 'approved'} onClick={() => saveProgram('pending')}>{saving ? 'Saving…' : 'Submit for Admin Approval'}</button>
              <button className="plotter-button" type="button" onClick={exportCsv}>Export CSV</button>
              <button className="plotter-button" type="button" onClick={() => setTheme(current => current === 'light' ? 'dark' : 'light')}>{theme === 'light' ? 'Dark mode' : 'Light mode'}</button>
              <button className="plotter-button plotter-button-print" type="button" onClick={() => window.print()}><Icon name="inbox" size={15} />Export / Print PDF</button>
            </div>
          </section>

          <nav className="plotter-view-tabs" aria-label="Plotter view"><button type="button" className={view === 'editor' ? 'active' : ''} onClick={() => setView('editor')}>Editor</button><button type="button" className={view === 'preview' ? 'active' : ''} onClick={() => setView('preview')}>Print preview</button></nav>

          {(error || validation.error) && <div className="plotter-error" role="alert">{error || validation.error}</div>}
          {saveMessage && <div className="plotter-feedback" role="status">{saveMessage}</div>}
          {loadingOptions && <div className="placeholder">Loading JHS sections and resources…</div>}
          {loadingProgram && <div className="placeholder">Loading saved program…</div>}

          {view === 'editor' ? <>
            <section className="plotter-summary grid gap-3" aria-label="Daily schedule totals">
              <article><span>Mon–Thu minutes / day</span><strong>{totalMonThu}</strong><small>{formatHours(totalMonThu)} · 45-minute periods</small></article>
              <article><span>Friday minutes / day</span><strong>{totalFriday}</strong><small>{formatHours(totalFriday)} · 45-minute periods</small></article>
              <article><span>Subject / teacher allocation</span><strong>{subjectCount}</strong><small>{incompleteCount ? `${incompleteCount} incomplete row(s)` : 'Assignments checked'}</small></article>
            </section>

            <section className="plotter-panel">
              <header className="plotter-panel-heading"><div><span>DOCUMENT DETAILS</span><h2>ERCIHS class program</h2></div><span className="plotter-scope-badge">JHS · Grade {grade}</span></header>
              <div className="plotter-fields">
                <label className="plotter-field-wide">School name<input value={draft.schoolName} onChange={event => updateHeader('schoolName', event.target.value)} /></label>
                <label className="plotter-field-wide">School address<input value={draft.schoolAddress} onChange={event => updateHeader('schoolAddress', event.target.value)} /></label>
                <label>Contact details<input value={draft.contactDetails} onChange={event => updateHeader('contactDetails', event.target.value)} placeholder="Telephone / email" /></label>
                <label>School ID<input value={draft.schoolId} onChange={event => updateHeader('schoolId', event.target.value)} /></label>
                <label>Region<input value={draft.regionName} onChange={event => updateHeader('regionName', event.target.value)} /></label>
                <label>Division<input value={draft.divisionName} onChange={event => updateHeader('divisionName', event.target.value)} /></label>
                <label>Grade & section<input value={selectedSection?.section_name ? `GRADE ${grade} - ${selectedSection.section_name}` : ''} readOnly placeholder="Select a registered section" /></label>
                <label>Class adviser<input value={draft.adviser} onChange={event => updateHeader('adviser', event.target.value)} placeholder="Full name" /></label>
              </div>
              <details className="plotter-logo-settings"><summary>Official heading logos</summary><div className="plotter-fields"><label>DepEd logo URL<input value={draft.depedLogo} onChange={event => updateHeader('depedLogo', event.target.value)} /></label><label>Region / division logo URL<input value={draft.divisionLogo} onChange={event => updateHeader('divisionLogo', event.target.value)} /></label></div></details>
            </section>

            <section className="plotter-panel plotter-rows-panel">
              <header className="plotter-panel-heading"><div><span>WEEKLY PROGRAM</span><h2>Time slots and resource assignments</h2></div><button className="plotter-button plotter-button-primary" type="button" onClick={addRow}>＋ Add Time Slot / Row</button></header>
              <div className="plotter-fixed-note">Class periods are fixed at 45 minutes, Monday through Friday.</div>
              <div className="plotter-table-scroll">
                <table className="plotter-editor-table plotter-jhs-editor-table">
                  <thead><tr><th colSpan="6">MONDAY - THURSDAY</th><th colSpan="6">FRIDAY</th><th rowSpan="2">Order / Delete</th></tr><tr><th>Time</th><th>Mins.</th><th>Subject / activity</th><th>Teacher</th><th>Building</th><th>Room</th><th>Time</th><th>Mins.</th><th>Subject / activity</th><th>Teacher assigned</th><th>Building</th><th>Room</th></tr></thead>
                  <tbody>{draft.rows.map((row, index) => <tr key={row.id}>
                    <ScheduleSide row={row} prefix="monThu" label={`Monday to Thursday row ${index + 1}`} subjects={gradeSubjects} teachers={options.teachers} buildings={options.buildings} rooms={options.rooms} updateRow={updateRow} />
                    <ScheduleSide row={row} prefix="friday" label={`Friday row ${index + 1}`} subjects={gradeSubjects} teachers={options.teachers} buildings={options.buildings} rooms={options.rooms} updateRow={updateRow} />
                    <td className="plotter-row-actions"><button type="button" aria-label={`Move row ${index + 1} up`} disabled={index === 0} onClick={() => moveRow(index, -1)}>↑</button><button type="button" aria-label={`Move row ${index + 1} down`} disabled={index === draft.rows.length - 1} onClick={() => moveRow(index, 1)}>↓</button><button className="plotter-delete-row" type="button" aria-label={`Delete row ${index + 1}`} onClick={() => removeRow(row.id)}>×</button></td>
                  </tr>)}</tbody>
                  <tfoot><tr><th colSpan="2">TOTAL MINUTES / DAY</th><td>{totalMonThu}</td><th colSpan="3">TOTAL MINUTES / DAY</th><td>{totalFriday}</td><th colSpan="6">{formatHours(totalMonThu)} Mon–Thu · {formatHours(totalFriday)} Friday</th></tr></tfoot>
                </table>
              </div>
            </section>

            <section className="plotter-load-panel" aria-live="polite">
              <div className="plotter-load-title"><div><span>LIVE VALIDATION</span><strong>Conflicts and teacher workload</strong></div><span className={validation.conflicts.length ? 'plotter-warning-badge' : 'plotter-ok-badge'}>{validation.conflicts.length ? `${validation.conflicts.length} conflict(s)` : 'No conflicts'}</span></div>
              {validation.conflicts.map((conflict, index) => <p className="plotter-conflict-line" key={`${conflict.resource}-${conflict.day_of_week}-${index}`}>{conflict.message} {conflict.day_of_week} · {conflict.start_time}</p>)}
              {validation.warnings.map(teacher => <div className={`plotter-teacher-load${teacher.overloaded ? ' overloaded' : ''}`} key={teacher.teacher_id}><strong>{teacher.teacher_name}</strong><span>{teacher.subject_count} / {teacher.max_subject_load} subjects</span>{teacher.overloaded && <b>Overload</b>}{teacher.ancillary_tasks?.length > 0 && <small>Ancillary: {teacher.ancillary_tasks.join(', ')}</small>}</div>)}
              {incompleteCount > 0 && <p className="plotter-load-help">Complete the time, teacher, building, and room assignments for each subject row.</p>}
            </section>

            <section className="plotter-panel plotter-signatory-editor">
              <header className="plotter-panel-heading"><div><span>APPROVALS</span><h2>Policy references and signatories</h2></div></header>
              <div className="plotter-fields">
                <label className="plotter-field-wide">DepEd Orders / policy references<input value={draft.policyReferences} onChange={event => updateHeader('policyReferences', event.target.value)} /></label>
                <label>Prepared by · Head Teacher III<input value={draft.preparedBy} onChange={event => updateHeader('preparedBy', event.target.value)} /></label>
                <label>Conforme · Class Adviser<input value={draft.conforme} onChange={event => updateHeader('conforme', event.target.value)} /></label>
                <label>Recommending Approval · School Principal II<input value={draft.recommendingApproval} onChange={event => updateHeader('recommendingApproval', event.target.value)} /></label>
                <label>Approved by · PSDS Cluster IV<input value={draft.approvedBy} onChange={event => updateHeader('approvedBy', event.target.value)} /></label>
              </div>
            </section>
          </> : <div className="plotter-preview-wrap"><div className="plotter-preview-note"><Icon name="inbox" size={16} />Print preview · {draft.paperSize === 'long' ? 'Long bond, 8.5 × 13 in' : 'Short bond, 8.5 × 11 in'}<button type="button" onClick={() => setView('editor')}>Back to editor</button></div><ProgramDocument draft={{ ...draft, section: selectedSection?.section_name || draft.section }} rows={draft.rows} options={options} /></div>}
        </div>
        <div className="plotter-print-only"><ProgramDocument draft={{ ...draft, section: selectedSection?.section_name || draft.section }} rows={draft.rows} options={options} /></div>
      </div>
    </StaffLayout>
  )
}