// HIPO 10.0 – Guest schedule view
// Public landing page with the class schedule grid and department / grade / section / day filters.
// Data: GET /api/public/schedules (approved classes of the current term) and /api/public/terms.
import React, { useEffect, useState, useMemo } from 'react'
import './publicView.css'

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday']

export default function PublicView(){
  const [schedules, setSchedules] = useState([])
  const [term, setTerm] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [filters, setFilters] = useState({ department_id: '', grade_level_id: '', section_id: '', day: '' })

  useEffect(() => {
    let mounted = true
    const fetchSchedules = async () => {
      setLoading(true)
      setError(null)
      try {
        const [res, termsRes] = await Promise.all([fetch('/api/public/schedules'), fetch('/api/public/terms')])
        if (!res.ok) throw new Error('Failed to load schedules')
        const data = await res.json()
        const terms = termsRes.ok ? await termsRes.json() : []
        if (mounted) {
          setSchedules(Array.isArray(data) ? data : [])
          setTerm(terms.find(item => item.is_active) || terms[0] || null)
        }
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
    schedules.forEach(s => { if (s.grade_level_id) map.set(s.grade_level_id, s.grade_level_name || `Grade level ${s.grade_level_id}`) })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
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
      <div className="pv-utility">
        <div>REPUBLIC OF THE PHILIPPINES</div>
        <div className="pv-utility-links"><span>DepEd CALABARZON</span></div>
      </div>

      <header className="pv-header">
        <a className="pv-brand" href="/" aria-label="ERCIHS home">
          <img className="pv-logo" src="https://vote.ercihs.edu.ph/ERCIHS%20LOGO.png" alt="ERCIHS logo" />
          <div>
            <div className="pv-title">Emmanuel Resurreccion Congressional Integrated High School</div>
            <div className="pv-sub">City of Dasmarinas, Cavite</div>
          </div>
        </a>
        <a href="/login" className="pv-staff-btn">Login</a>
      </header>

      <main id="home" className="pv-main">
        <section className="pv-hero">
          <div className="pv-hero-copy">
            <span className="pv-eyebrow">EMMANUEL RESURRECCION CONGRESSIONAL INTEGRATED HIGH SCHOOL</span>
            <h1>OFFICIAL CLASS SCHEDULING</h1>
            <p>Access the class schedule and essential information of Emmanuel Resurreccion Congressional Integrated High School.</p>
            <a className="pv-hero-btn" href="#schedule">Class Schedule</a>
          </div>
          <div className="pv-hero-mark" aria-hidden="true">ERCIHS</div>
        </section>

        <section id="about" className="pv-welcome">
          <div>
            <span className="pv-eyebrow">SCHOOL INFORMATION</span>
            <h2>Emmanuel Resurreccion Congressional Integrated High School</h2>
          </div>
          <p>Find class schedules by department, grade level, section, and day. This public view keeps essential school information easy to access for learners, families, and the community.</p>
        </section>

        <section id="schedule" className="pv-schedule-section">
          <div className="pv-section-heading">
            <div>
              <span className="pv-eyebrow">ACADEMIC SERVICES</span>
              <h2>Class Schedule</h2>
            </div>
            <span className="pv-school-year">{term ? `School Year ${term.school_year} · ${term.term_name}` : 'School Year'}</span>
          </div>

          <section className="pv-filters">
            <div className="pv-filter-card">
              <div className="pv-filter-row">
                <div>
                  <label>Department</label>
                  <select value={filters.department_id} onChange={e => setFilters(f => ({...f, department_id: e.target.value}))}>
                    <option value="">All departments</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label>Grade Level</label>
                  <select value={filters.grade_level_id} onChange={e => setFilters(f => ({...f, grade_level_id: e.target.value}))}>
                    <option value="">All grade levels</option>
                    {gradeLevels.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label>Section</label>
                  <select value={filters.section_id} onChange={e => setFilters(f => ({...f, section_id: e.target.value}))}>
                    <option value="">All sections</option>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label>Day</label>
                  <select value={filters.day} onChange={e => setFilters(f => ({...f, day: e.target.value}))}>
                    <option value="">All days</option>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </section>

          <section className="pv-results">
            <div className="pv-results-card">
              {loading && <div className="pv-loading">Loading schedules...</div>}
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
                          <td className="pv-time-cell">{time}</td>
                          {DAYS.map(day => (
                            <td key={day} className="pv-day-cell">
                              {grid[time] && grid[time][day] ? (
                                grid[time][day].map((s, idx) => (
                                  <div key={idx} className="pv-schedule-card">
                                    <div className="pv-subject">{s.subject_name || s.activity}</div>
                                    <div className="pv-meta">{s.start_time}–{s.end_time}</div>
                                    {s.teacher_name && <div className="pv-meta">Teacher: {s.teacher_name}</div>}
                                    <div className="pv-meta">Room: {s.room_number ? `${s.building_name} · ${s.room_number}` : '-'}</div>
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
        </section>
      </main>

      <footer id="contact" className="pv-footer">
        <div className="pv-footer-main">
          <div>
            <div className="pv-footer-brand">EMMANUEL RESURRECCION CONGRESSIONAL INTEGRATED HIGH SCHOOL</div>
            <p>Poinsettia St., Via Verde Village, Brgy. San Agustin II, City of Dasmarinas, Cavite 4114</p>
          </div>
          <div>
            <div className="pv-footer-heading">SCHOOL OFFICE</div>
            <p>301179@deped.gov.ph<br />(046) 894-1463 / (046) 472-9768</p>
          </div>
        </div>
        <div className="pv-footer-bottom">© ERCIHS Class Scheduling System <span> Official Class Scheduling System</span></div>
      </footer>
    </div>
  )
}
