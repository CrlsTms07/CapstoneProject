// HIPO 3.4 – Manage Section
// Sections page: list, create, edit and delete sections.
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StaffLayout from '../../components/StaffLayout'
import '../../styles/adminDashboard.css'

export default function Sections({ user }) {
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({ section_name: '', grade_level_id: '' })
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    const fetchSections = async () => {
      try {
        const res = await fetch('/api/sections', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          if (mounted) setSections(Array.isArray(data) ? data : (data.rows || []))
        }
      } catch (e) { /* ignore */ }
      finally { if (mounted) setLoading(false) }
    }
    fetchSections()
    return () => { mounted = false }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const body = { section_name: formData.section_name, grade_level_id: Number(formData.grade_level_id) }
      const url = editingId ? `/api/sections/${editingId}` : '/api/sections'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json().catch(() => null); throw new Error(d && d.error ? d.error : 'Operation failed') }
      setShowForm(false)
      setEditingId(null)
      setFormData({ section_name: '', grade_level_id: '' })
      const data = await res.json()
      setSections(list => editingId ? list.map(s => s.section_id === editingId ? data : s) : [...list, data])
    } catch (err) { setError(err.message) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this section?')) return
    try {
      const res = await fetch(`/api/sections/${id}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) setSections(list => list.filter(s => s.section_id !== id))
      else { const d = await res.json().catch(() => null); alert(d && d.error ? d.error : 'Delete failed') }
    } catch (err) { alert('Delete failed') }
  }

  const openEdit = (s) => {
    setEditingId(s.section_id)
    setFormData({ section_name: s.section_name, grade_level_id: String(s.grade_level_id ?? '') })
    setShowForm(true)
  }

  return (
    <StaffLayout user={user}>
      <div style={{ padding: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1>Sections</h1>
          <button className="action-btn primary" onClick={() => { setEditingId(null); setFormData({ section_name: '', grade_level_id: '' }); setShowForm(true) }}>+ Add Section</button>
        </div>
        {showForm && (
          <form onSubmit={handleSubmit} style={{ background: 'var(--card-bg)', padding: 16, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3>{editingId ? 'Edit Section' : 'Add Section'}</h3>
            {error && <div className="login-error" style={{ margin: 0 }}>{error}</div>}
            <input className="login-input" placeholder="Section Name" value={formData.section_name} onChange={e => setFormData({ ...formData, section_name: e.target.value })} required />
            <input className="login-input" placeholder="Grade Level ID" type="number" value={formData.grade_level_id} onChange={e => setFormData({ ...formData, grade_level_id: e.target.value })} required />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="action-btn primary">{editingId ? 'Update' : 'Add'}</button>
              <button type="button" className="action-btn" onClick={() => { setShowForm(false); setEditingId(null); setError(null) }}>Cancel</button>
            </div>
          </form>
        )}
        {loading ? <div className="placeholder">Loading sections…</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)' }}>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Section ID</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Section Name</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Grade Level</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sections.map(s => (
                <tr key={s.section_id}>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{s.section_id}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{s.section_name}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{s.grade_level_id ?? '—'}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
                    <button className="action-btn" onClick={() => openEdit(s)} style={{ marginRight: 6 }}>Edit</button>
                    <button className="action-btn" onClick={() => handleDelete(s.section_id)} style={{ color: '#a91d2b', borderColor: 'rgba(169,29,43,0.2)' }}>Delete</button>
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
