// HIPO 3.4 – Manage Section
// Sections page: list, create, edit and delete sections, with class adviser, co-adviser and (Grades 11–12) strand.
import React, { useEffect, useState } from 'react'
import StaffLayout from '../../components/StaffLayout'
import '../../styles/adminDashboard.css'

const EMPTY_FORM = { section_name: '', grade_level_id: '', adviser_id: '', co_adviser_id: '', strand: '' }
const cell = { padding: '8px', borderBottom: '1px solid var(--border)' }
const headCell = { padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }
const teacherName = teacher => teacher.full_name || teacher.last_name

export default function Sections({ user }) {
  const [sections, setSections] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    const fetchSections = async () => {
      try {
        const [sectionRes, teacherRes] = await Promise.all([
          fetch('/api/sections', { credentials: 'include' }),
          fetch('/api/teachers', { credentials: 'include' })
        ])
        if (sectionRes.ok) {
          const data = await sectionRes.json()
          if (mounted) setSections(Array.isArray(data) ? data : (data.rows || []))
        }
        if (teacherRes.ok) {
          const data = await teacherRes.json()
          if (mounted) setTeachers(Array.isArray(data) ? data : (data.rows || []))
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
    if (formData.adviser_id && formData.adviser_id === formData.co_adviser_id) {
      setError('The class adviser and the co-adviser must be different teachers.')
      return
    }
    try {
      // Blank adviser, co-adviser or strand clears the saved value.
      const body = {
        section_name: formData.section_name,
        grade_level_id: Number(formData.grade_level_id),
        adviser_id: formData.adviser_id ? Number(formData.adviser_id) : null,
        co_adviser_id: formData.co_adviser_id ? Number(formData.co_adviser_id) : null,
        strand: formData.strand.trim() || null
      }
      const url = editingId ? `/api/sections/${editingId}` : '/api/sections'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json().catch(() => null); throw new Error(d && d.error ? d.error : 'Operation failed') }
      setShowForm(false)
      setEditingId(null)
      setFormData(EMPTY_FORM)
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
    setFormData({
      section_name: s.section_name,
      grade_level_id: String(s.grade_level_id ?? ''),
      adviser_id: String(s.adviser_id ?? ''),
      co_adviser_id: String(s.co_adviser_id ?? ''),
      strand: s.strand || ''
    })
    setShowForm(true)
  }

  const teacherSelect = (field, label) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label}
      <select className="login-input" value={formData[field]} onChange={e => setFormData({ ...formData, [field]: e.target.value })}>
        <option value="">None</option>
        {teachers.map(teacher => <option key={teacher.teacher_id} value={String(teacher.teacher_id)}>{teacherName(teacher)}</option>)}
      </select>
    </label>
  )

  return (
    <StaffLayout user={user}>
      <div style={{ padding: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1>Sections</h1>
          <button className="action-btn primary" onClick={() => { setEditingId(null); setFormData(EMPTY_FORM); setShowForm(true) }}>+ Add Section</button>
        </div>
        {showForm && (
          <form onSubmit={handleSubmit} style={{ background: 'var(--card-bg)', padding: 16, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3>{editingId ? 'Edit Section' : 'Add Section'}</h3>
            {error && <div className="login-error" style={{ margin: 0 }}>{error}</div>}
            <input className="login-input" placeholder="Section Name" value={formData.section_name} onChange={e => setFormData({ ...formData, section_name: e.target.value })} required />
            <input className="login-input" placeholder="Grade Level ID" type="number" value={formData.grade_level_id} onChange={e => setFormData({ ...formData, grade_level_id: e.target.value })} required />
            {teacherSelect('adviser_id', 'Class adviser')}
            {teacherSelect('co_adviser_id', 'Co-adviser')}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              Strand (Grades 11–12 only)
              <input className="login-input" placeholder="e.g. ABM, STEM, HUMSS" maxLength={30} value={formData.strand} onChange={e => setFormData({ ...formData, strand: e.target.value })} />
            </label>
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
                <th style={headCell}>Section ID</th>
                <th style={headCell}>Section Name</th>
                <th style={headCell}>Grade Level</th>
                <th style={headCell}>Strand</th>
                <th style={headCell}>Class Adviser</th>
                <th style={headCell}>Co-Adviser</th>
                <th style={headCell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sections.map(s => (
                <tr key={s.section_id}>
                  <td style={cell}>{s.section_id}</td>
                  <td style={cell}>{s.section_name}</td>
                  <td style={cell}>{s.grade_level_id ?? '—'}</td>
                  <td style={cell}>{s.strand || '—'}</td>
                  <td style={cell}>{s.adviser_name || '—'}</td>
                  <td style={cell}>{s.co_adviser_name || '—'}</td>
                  <td style={cell}>
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
