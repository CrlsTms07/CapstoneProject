// HIPO 3.3 – Manage Teacher
// Faculty directory: create/edit teachers, subject load, ancillary tasks and qualified subjects (used by Auto-Generate).
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StaffLayout from '../../components/StaffLayout'
import '../../styles/adminDashboard.css'

const ANCILLARY_TASKS = ['ICT Coordinator', 'SSG Coordinator', 'Lab Manager']
const EMPTY_FORM = { user_id: '', last_name: '', max_subject_load: '', weekly_load_minutes: '', ancillary_tasks: [], subject_ids: [] }

export default function Teachers({ user }) {
  const [teachers, setTeachers] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    const fetchTeachers = async () => {
      try {
        const [res, subjectRes] = await Promise.all([
          fetch('/api/teachers', { credentials: 'include' }),
          fetch('/api/subjects', { credentials: 'include' })
        ])
        if (res.ok) {
          const data = await res.json()
          if (mounted) setTeachers(Array.isArray(data) ? data : (data.rows || []))
        }
        if (subjectRes.ok) {
          const data = await subjectRes.json()
          if (mounted) setSubjects(Array.isArray(data) ? data : (data.rows || []))
        }
      } catch (e) { /* ignore */ }
      finally { if (mounted) setLoading(false) }
    }
    fetchTeachers()
    return () => { mounted = false }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const body = { user_id: Number(formData.user_id), last_name: formData.last_name, max_subject_load: formData.max_subject_load ? Number(formData.max_subject_load) : null, weekly_load_minutes: formData.weekly_load_minutes ? Number(formData.weekly_load_minutes) : null, ancillary_tasks: formData.ancillary_tasks }
      const url = editingId ? `/api/teachers/${editingId}` : '/api/teachers'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json().catch(() => null); throw new Error(d && d.error ? d.error : 'Operation failed') }
      const data = await res.json()
      // Qualified subjects are saved separately, once the teacher record exists.
      const qualified = await fetch(`/api/teachers/${data.teacher_id}/subjects`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ subject_ids: formData.subject_ids.map(Number) }) })
      const saved = { ...data, subject_ids: formData.subject_ids.map(Number) }
      setTeachers(list => editingId ? list.map(t => t.teacher_id === editingId ? { ...t, ...saved } : t) : [...list, saved])
      if (!qualified.ok) {
        const d = await qualified.json().catch(() => null)
        setEditingId(data.teacher_id)
        throw new Error(`Teacher saved, but the qualified subjects were not: ${d && d.error ? d.error : 'request failed'}`)
      }
      setShowForm(false)
      setEditingId(null)
      setFormData(EMPTY_FORM)
    } catch (err) { setError(err.message) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this teacher?')) return
    try {
      const res = await fetch(`/api/teachers/${id}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) setTeachers(list => list.filter(t => t.teacher_id !== id))
      else { const d = await res.json().catch(() => null); alert(d && d.error ? d.error : 'Delete failed') }
    } catch (err) { alert('Delete failed') }
  }

  const openEdit = (t) => {
    setEditingId(t.teacher_id)
    setFormData({ user_id: String(t.user_id), last_name: t.last_name, max_subject_load: String(t.max_subject_load ?? ''), weekly_load_minutes: String(t.weekly_load_minutes ?? ''), ancillary_tasks: t.ancillary_tasks || [], subject_ids: (t.subject_ids || []).map(String) })
    setShowForm(true)
  }

  return (
    <StaffLayout user={user}>
      <div style={{ padding: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1>Teachers</h1>
          <button className="action-btn primary" onClick={() => { setEditingId(null); setFormData(EMPTY_FORM); setShowForm(true) }}>+ Add Teacher</button>
        </div>
        {showForm && (
          <form onSubmit={handleSubmit} style={{ background: 'var(--card-bg)', padding: 16, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3>{editingId ? 'Edit Teacher' : 'Add Teacher'}</h3>
            {error && <div className="login-error" style={{ margin: 0 }}>{error}</div>}
            <input className="login-input" placeholder="User ID" value={formData.user_id} onChange={e => setFormData({ ...formData, user_id: e.target.value })} required />
            <input className="login-input" placeholder="Last Name" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} required />
            <input className="login-input" placeholder="Max Subject Load (4 or 5)" type="number" min="4" max="5" value={formData.max_subject_load} onChange={e => setFormData({ ...formData, max_subject_load: e.target.value })} />
            <input className="login-input" placeholder="Weekly Load (min)" type="number" value={formData.weekly_load_minutes} onChange={e => setFormData({ ...formData, weekly_load_minutes: e.target.value })} />
            <fieldset style={{ display: 'flex', flexWrap: 'wrap', gap: 14, border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
              <legend>Ancillary responsibilities</legend>
              {ANCILLARY_TASKS.map(task => <label key={task} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={formData.ancillary_tasks.includes(task)} onChange={event => setFormData(current => ({ ...current, ancillary_tasks: event.target.checked ? [...current.ancillary_tasks, task] : current.ancillary_tasks.filter(item => item !== task) }))} />{task}</label>)}
            </fieldset>
            <fieldset style={{ display: 'flex', flexWrap: 'wrap', gap: 14, border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
              <legend>Qualified subjects (Auto-Generate only assigns these)</legend>
              {subjects.length === 0 && <span>No subjects yet.</span>}
              {subjects.map(subject => {
                const id = String(subject.subject_id)
                return <label key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={formData.subject_ids.includes(id)} onChange={event => setFormData(current => ({ ...current, subject_ids: event.target.checked ? [...current.subject_ids, id] : current.subject_ids.filter(item => item !== id) }))} />{subject.subject_name} <small>(grade level {subject.grade_level_id})</small></label>
              })}
            </fieldset>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="action-btn primary">{editingId ? 'Update' : 'Add'}</button>
              <button type="button" className="action-btn" onClick={() => { setShowForm(false); setEditingId(null); setError(null) }}>Cancel</button>
            </div>
          </form>
        )}
        {loading ? <div className="placeholder">Loading teachers…</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)' }}>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Teacher ID</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>User ID</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Last Name</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Max Load</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Weekly Min</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Ancillary Tasks</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Qualified Subjects</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map(t => (
                <tr key={t.teacher_id}>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{t.teacher_id}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{t.user_id}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{t.last_name}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{t.max_subject_load ?? '—'}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{t.weekly_load_minutes ?? '—'}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{(t.ancillary_tasks || []).join(', ') || '—'}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{(t.subject_ids || []).map(id => subjects.find(subject => subject.subject_id === id)?.subject_name || `#${id}`).join(', ') || '—'}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
                    <button className="action-btn" onClick={() => openEdit(t)} style={{ marginRight: 6 }}>Edit</button>
                    <button className="action-btn" onClick={() => handleDelete(t.teacher_id)} style={{ color: '#a91d2b', borderColor: 'rgba(169,29,43,0.2)' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </StaffLayout>
  )
}
