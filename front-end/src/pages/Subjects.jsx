import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StaffLayout from '../components/StaffLayout'
import '../styles/adminDashboard.css'

export default function Subjects({ user }) {
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({ subject_name: '', grade_level_id: '' })
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    const fetchSubjects = async () => {
      try {
        const res = await fetch('/api/subjects', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          if (mounted) setSubjects(Array.isArray(data) ? data : (data.rows || []))
        }
      } catch (e) { /* ignore */ }
      finally { if (mounted) setLoading(false) }
    }
    fetchSubjects()
    return () => { mounted = false }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const body = { subject_name: formData.subject_name, grade_level_id: Number(formData.grade_level_id) }
      const url = editingId ? `/api/subjects/${editingId}` : '/api/subjects'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json().catch(() => null); throw new Error(d && d.error ? d.error : 'Operation failed') }
      setShowForm(false)
      setEditingId(null)
      setFormData({ subject_name: '', grade_level_id: '' })
      const data = await res.json()
      setSubjects(list => editingId ? list.map(s => s.subject_id === editingId ? data : s) : [...list, data])
    } catch (err) { setError(err.message) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this subject?')) return
    try {
      const res = await fetch(`/api/subjects/${id}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) setSubjects(list => list.filter(s => s.subject_id !== id))
      else { const d = await res.json().catch(() => null); alert(d && d.error ? d.error : 'Delete failed') }
    } catch (err) { alert('Delete failed') }
  }

  const openEdit = (s) => {
    setEditingId(s.subject_id)
    setFormData({ subject_name: s.subject_name, grade_level_id: String(s.grade_level_id ?? '') })
    setShowForm(true)
  }

  return (
    <StaffLayout user={user}>
      <div style={{ padding: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1>Subjects</h1>
          <button className="action-btn primary" onClick={() => { setEditingId(null); setFormData({ subject_name: '', grade_level_id: '' }); setShowForm(true) }}>+ Add Subject</button>
        </div>
        {showForm && (
          <form onSubmit={handleSubmit} style={{ background: 'var(--card-bg)', padding: 16, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3>{editingId ? 'Edit Subject' : 'Add Subject'}</h3>
            {error && <div className="login-error" style={{ margin: 0 }}>{error}</div>}
            <input className="login-input" placeholder="Subject Name" value={formData.subject_name} onChange={e => setFormData({ ...formData, subject_name: e.target.value })} required />
            <input className="login-input" placeholder="Grade Level ID" type="number" value={formData.grade_level_id} onChange={e => setFormData({ ...formData, grade_level_id: e.target.value })} required />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="action-btn primary">{editingId ? 'Update' : 'Add'}</button>
              <button type="button" className="action-btn" onClick={() => { setShowForm(false); setEditingId(null); setError(null) }}>Cancel</button>
            </div>
          </form>
        )}
        {loading ? <div className="placeholder">Loading subjects…</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)' }}>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Subject ID</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Subject Name</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Grade Level</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map(s => (
                <tr key={s.subject_id}>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{s.subject_id}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{s.subject_name}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{s.grade_level_id ?? '—'}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
                    <button className="action-btn" onClick={() => openEdit(s)} style={{ marginRight: 6 }}>Edit</button>
                    <button className="action-btn" onClick={() => handleDelete(s.subject_id)} style={{ color: '#a91d2b', borderColor: 'rgba(169,29,43,0.2)' }}>Delete</button>
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
