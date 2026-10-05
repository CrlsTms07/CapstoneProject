// HIPO 6.0 – Reports (with HIPO 7.0 – Export PDF/CSV)
// Pick a report and a term, preview it, and download it as CSV or PDF. All three come from the same
// endpoint, GET /api/reports/:type, so the preview and the files always show the same data.
import React, { useEffect, useMemo, useState } from 'react'
import StaffLayout from '../../components/StaffLayout'

const REPORTS = [
  { type: 'section', label: 'Class program (one section)', needs: 'section_id' },
  { type: 'teacher', label: 'Teacher schedule', needs: 'teacher_id' },
  { type: 'room', label: 'Room schedule', needs: 'room_id' },
  { type: 'teacher-load', label: 'Teacher workload summary', needs: null },
  { type: 'room-utilization', label: 'Room utilization summary', needs: null }
]
const cell = { padding: 8, textAlign: 'left', borderBottom: '1px solid var(--border)' }
const asList = data => Array.isArray(data) ? data : []

export default function Reports({ user }) {
  const [terms, setTerms] = useState([])
  const [options, setOptions] = useState({ section_id: [], teacher_id: [], room_id: [] })
  const [choice, setChoice] = useState({ type: 'section', term_id: '', id: '' })
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const get = url => fetch(url, { credentials: 'include' }).then(response => response.ok ? response.json() : [])
    Promise.all([get('/api/terms'), get('/api/sections'), get('/api/teachers'), get('/api/rooms')]).then(([termData, sections, teachers, rooms]) => {
      setTerms(termData.terms || [])
      setChoice(current => ({ ...current, term_id: String(termData.active_term?.term_id || termData.terms?.[0]?.term_id || '') }))
      setOptions({
        section_id: asList(sections).map(item => ({ id: item.section_id, label: item.section_name })),
        teacher_id: asList(teachers).map(item => ({ id: item.teacher_id, label: item.full_name || item.last_name })),
        room_id: asList(rooms).map(item => ({ id: item.room_id, label: `Room ${item.room_number}` }))
      })
    })
  }, [])

  const selected = REPORTS.find(item => item.type === choice.type)
  const ready = choice.term_id && (!selected.needs || choice.id)
  const query = useMemo(() => {
    const params = new URLSearchParams({ term_id: choice.term_id })
    if (selected.needs) params.set(selected.needs, choice.id)
    return `/api/reports/${choice.type}?${params}`
  }, [choice, selected])

  useEffect(() => {
    if (!ready) { setReport(null); return undefined }
    let active = true
    setLoading(true)
    setError('')
    fetch(query, { credentials: 'include' })
      .then(async response => {
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.error || 'Unable to load the report.')
        if (active) setReport(data)
      })
      .catch(loadError => { if (active) { setReport(null); setError(loadError.message) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query, ready])

  return (
    <StaffLayout user={user} title="Reports" subtitle="Approved schedules only. Download any report as CSV or PDF.">
      <div style={{ padding: 8 }}>
        <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', alignItems: 'end' }}>
          <label>Report<select value={choice.type} onChange={event => setChoice(current => ({ ...current, type: event.target.value, id: '' }))}>{REPORTS.map(item => <option key={item.type} value={item.type}>{item.label}</option>)}</select></label>
          <label>Term<select value={choice.term_id} onChange={event => setChoice(current => ({ ...current, term_id: event.target.value }))}>{terms.map(term => <option key={term.term_id} value={term.term_id}>{term.school_year} · {term.term_name}</option>)}</select></label>
          {selected.needs && (
            <label>{selected.needs === 'section_id' ? 'Section' : selected.needs === 'teacher_id' ? 'Teacher' : 'Room'}
              <select value={choice.id} onChange={event => setChoice(current => ({ ...current, id: event.target.value }))}>
                <option value="">Select…</option>
                {options[selected.needs].map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
          )}
          <div>
            <a className={`action-btn${ready ? '' : ' disabled'}`} aria-disabled={!ready} href={ready ? `${query}&format=csv` : undefined}>Download CSV</a>
            <a className={`action-btn primary${ready ? '' : ' disabled'}`} aria-disabled={!ready} href={ready ? `${query}&format=pdf` : undefined} style={{ marginLeft: 6 }}>Download PDF</a>
          </div>
        </section>

        {error && <div className="placeholder" role="alert" style={{ marginTop: 16 }}>{error}</div>}
        {!ready && <div className="placeholder" style={{ marginTop: 16 }}>Choose what the report is about.</div>}
        {loading && <div className="placeholder" style={{ marginTop: 16 }}>Loading report…</div>}
        {report && !loading && (
          <section style={{ marginTop: 20 }}>
            <h2 style={{ marginBottom: 0 }}>{report.title}</h2>
            <p style={{ marginTop: 4 }}>{report.subtitle}</p>
            {report.rows.length === 0 ? <div className="placeholder">No approved schedule entries for this choice.</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: 'var(--bg-2)' }}>{report.columns.map(column => <th key={column.key} style={cell}>{column.label}</th>)}</tr></thead>
                  <tbody>{report.rows.map((row, index) => <tr key={index}>{report.columns.map(column => <td key={column.key} style={cell}>{row[column.key]}</td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </StaffLayout>
  )
}
