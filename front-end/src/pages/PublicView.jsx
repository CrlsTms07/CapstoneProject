import React, { useEffect, useState, useMemo } from 'react'
import '../styles/publicView.css'

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday']

export default function PublicView(){
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [filters, setFilters] = useState({ department_id: '', grade_level_id: '', section_id: '', day: '' })

  useEffect(() => {
    let mounted = true
    const fetchSchedules = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/public/schedules')
        if (!res.ok) throw new Error('Failed to load schedules')
        const data = await res.json()
        if (mounted) setSchedules(Array.isArray(data) ? data : (data.rows || []))
      } catch (err) {
        setError(err.message || 'Error loading schedules')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchSchedules()
    return () => { mounted = false }
  }, [])

  // derive filter options from schedules
  const departments = useMemo(() => {
    const map = new Map()
    schedules.forEach(s => { if (s.department_id) map.set(s.department_id, s.department_name || `Dept ${s.department_id}`) })
    return Array.from(map.entries()).map(([id,name])=>({ id, name }))
  }, [schedules])

  const gradeLevels = useMemo(() => {
    const map = new Map()
    schedules.forEach(s => { if (s.grade_level_id) map.set(s.grade_level_id, s.grade_level_id) })
    return Array.from(map.values())
  }, [schedules])

  const sections = useMemo(() => {
    const map = new Map()
    schedules.forEach(s => { if (s.section_id) map.set(s.section_id, s.section_name || `Section ${s.section_id}`) })
    return Array.from(map.entries()).map(([id,name])=>({ id, name }))
  }, [schedules])

  const filtered = useMemo(() => {
    return schedules.filter(s => {
      if (filters.department_id && String(s.department_id) !== String(filters.department_id)) return false
      if (filters.grade_level_id && String(s.grade_level_id) !== String(filters.grade_level_id)) return false
      if (filters.section_id && String(s.section_id) !== String(filters.section_id)) return false
      if (filters.day && s.day_of_week && s.day_of_week !== filters.day) return false
      return true
    })
  }, [schedules, filters])

  // compute times
  const times = useMemo(() => {
    const set = new Set()
    filtered.forEach(s => s.start_time && set.add(s.start_time))
    return Array.from(set).sort()
  }, [filtered])

  // make lookup by time and day
  const grid = useMemo(() => {
    const g = {}
    filtered.forEach(s => {
      const time = s.start_time || '00:00:00'
      const day = s.day_of_week || ''
      g[time] = g[time] || {}
      g[time][day] = g[time][day] || []
      g[time][day].push(s)
    })
    return g
  }, [filtered])

  return (
    <div className="pv-root">
      <header className="pv-header">
        <div className="pv-brand">
          <div className="pv-logo">📘</div>
          <div>
            <div className="pv-title">ERCIHS</div>
            <div className="pv-sub">Class Scheduling System — S.Y. 2026-2027</div>
          </div>
        </div>
        <div>
          <a href="/login" className="pv-staff-btn">Staff Login</a>
        </div>
      </header>

      <main className="pv-main">
        <div className="pv-hero">
          <h1>Class Schedule</h1>
          <p>View class schedules by department, grade level, and section.</p>
        </div>

        <section className="pv-filters">
          <div className="pv-filter-card">
            <div className="pv-filter-row">
              <div>
                <label>Department</label>
                <select value={filters.department_id} onChange={e => setFilters(f => ({...f, department_id: e.target.value}))}>
                  <option value="">All</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label>Grade Level</label>
                <select value={filters.grade_level_id} onChange={e => setFilters(f => ({...f, grade_level_id: e.target.value}))}>
                  <option value="">All</option>
                  {gradeLevels.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label>Section</label>
                <select value={filters.section_id} onChange={e => setFilters(f => ({...f, section_id: e.target.value}))}>
                  <option value="">All</option>
                  {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label>Day</label>
                <select value={filters.day} onChange={e => setFilters(f => ({...f, day: e.target.value}))}>
                  <option value="">All</option>
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="pv-results">
          <div className="pv-results-card">
            {loading && <div className="pv-loading">Loading schedules…</div>}
            {error && <div className="pv-error">{error}</div>}
            {!loading && !error && filtered.length === 0 && (
              <div className="pv-empty">No schedules found for selected filters.</div>
            )}

            {!loading && !error && filtered.length > 0 && (
              <div className="pv-grid-wrapper">
                <table className="pv-grid">
                  <thead>
                    <tr>
                      <th>Time</th>
                      {DAYS.map(d => <th key={d}>{d}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {times.map(time => (
                      <tr key={time}>
                        <td className="pv-time-cell">{time.replace(':00','')}</td>
                        {DAYS.map(day => (
                          <td key={day} className="pv-day-cell">
                            {grid[time] && grid[time][day] ? (
                              grid[time][day].map((s, idx) => (
                                <div key={idx} className="pv-schedule-card">
                                  <div className="pv-subject">{s.subject_name || s.subject || 'Subject'}</div>
                                  <div className="pv-meta">{s.teacher_last_name ? `Teacher: ${s.teacher_last_name}` : (s.teacher_name || '')}</div>
                                  <div className="pv-meta">Room: {s.room_number || s.room_id || '—'}</div>
                                  <div className="pv-meta small">Section: {s.section_name || s.section_id}</div>
                                </div>
                              ))
                            ) : null}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
