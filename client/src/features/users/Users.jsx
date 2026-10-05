// HIPO 4.3 – Users & Roles
// Admin page: list, create, edit, delete and approve user accounts.
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StaffLayout from '../../components/StaffLayout'
import '../../styles/adminDashboard.css'

export default function Users({ user }) {
  const [users, setUsers] = useState([])
  const [pendingUsers, setPendingUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({ username: '', role_id: '', department_id: '', assigned_grade_level_id: '' })
  const [gradeLevels, setGradeLevels] = useState([])
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    const fetchData = async () => {
      try {
        const [usersRes, pendingRes, gradeLevelsRes] = await Promise.all([
          fetch('/api/users', { credentials: 'include' }),
          fetch('/api/users/pending', { credentials: 'include' }),
          fetch('/api/grade-levels', { credentials: 'include' })
        ])
        if (usersRes.ok) {
          const data = await usersRes.json()
          if (mounted) setUsers(Array.isArray(data) ? data : (data.rows || []))
        }
        if (pendingRes.ok) {
          const data = await pendingRes.json()
          if (mounted) setPendingUsers(Array.isArray(data) ? data : (data.rows || []))
        }
        if (gradeLevelsRes.ok) {
          const data = await gradeLevelsRes.json()
          if (mounted) setGradeLevels(Array.isArray(data) ? data : data?.rows || [])
        }
      } catch (e) { /* ignore */ }
      finally { if (mounted) setLoading(false) }
    }
    fetchData()
    return () => { mounted = false }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const body = { username: formData.username, role_id: Number(formData.role_id), department_id: formData.department_id ? Number(formData.department_id) : null, assigned_grade_level_id: formData.assigned_grade_level_id ? Number(formData.assigned_grade_level_id) : null }
      const url = editingId ? `/api/users/${editingId}` : '/api/users'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json().catch(() => null); throw new Error(d && d.error ? d.error : 'Operation failed') }
      const data = await res.json()
      setShowForm(false)
      setEditingId(null)
      setFormData({ username: '', role_id: '', department_id: '', assigned_grade_level_id: '' })
      setUsers(list => editingId ? list.map(u => u.user_id === editingId ? data : u) : [...list, data])
    } catch (err) { setError(err.message) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user?')) return
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) setUsers(list => list.filter(u => u.user_id !== id))
      else { const d = await res.json().catch(() => null); alert(d && d.error ? d.error : 'Delete failed') }
    } catch (err) { alert('Delete failed') }
  }

  const handleApprove = async (id) => {
    try {
      const res = await fetch(`/api/users/${id}/approve`, { method: 'POST', credentials: 'include' })
      if (res.ok) {
        setPendingUsers(list => list.filter(u => u.user_id !== id))
        setUsers(list => {
          const user = pendingUsers.find(u => u.user_id === id)
          if (user) {
            const updated = { ...user, is_approved: true }
            return [...list, updated]
          }
          return list
        })
        alert('User approved!')
      } else { const d = await res.json().catch(() => null); alert(d && d.error ? d.error : 'Approve failed') }
    } catch (err) { alert('Approve failed') }
  }

  const openEdit = (u) => {
    setEditingId(u.user_id)
    setFormData({ username: u.username, role_id: String(u.role_id), department_id: String(u.department_id ?? ''), assigned_grade_level_id: String(u.assigned_grade_level_id ?? '') })
    setShowForm(true)
  }

  return (
    <StaffLayout user={user}>
      <div style={{ padding: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1>Users & Roles</h1>
          <button className="action-btn primary" onClick={() => { setEditingId(null); setFormData({ username: '', role_id: '', department_id: '', assigned_grade_level_id: '' }); setShowForm(true) }}>+ Add User</button>
        </div>
        {showForm && (
          <form onSubmit={handleSubmit} style={{ background: 'var(--card-bg)', padding: 16, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3>{editingId ? 'Edit User' : 'Add User'}</h3>
            {error && <div className="login-error" style={{ margin: 0 }}>{error}</div>}
            <input className="login-input" placeholder="Username" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} required />
            <input className="login-input" placeholder="Role ID" type="number" value={formData.role_id} onChange={e => setFormData({ ...formData, role_id: e.target.value, assigned_grade_level_id: e.target.value === '2' ? formData.assigned_grade_level_id : '' })} required />
            <input className="login-input" placeholder="Department ID (optional)" type="number" value={formData.department_id} onChange={e => setFormData({ ...formData, department_id: e.target.value })} />
            <label style={{ display: 'grid', gap: 6, color: '#66616a', fontSize: 12, fontWeight: 700 }}>Assigned JHS grade level
              <select className="login-input" value={formData.assigned_grade_level_id} disabled={Number(formData.role_id) !== 2} required={Number(formData.role_id) === 2} onChange={e => setFormData({ ...formData, assigned_grade_level_id: e.target.value })}>
                <option value="">{Number(formData.role_id) === 2 ? 'Select chairperson grade' : 'Only for Grade Level Chairperson'}</option>
                {gradeLevels.filter(level => /\b(?:grade\s*)?(7|8|9|10)\b/i.test(level.grade_level_name)).map(level => <option key={level.grade_level_id} value={level.grade_level_id}>{level.grade_level_name}</option>)}
              </select>
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="action-btn primary">{editingId ? 'Update' : 'Add'}</button>
              <button type="button" className="action-btn" onClick={() => { setShowForm(false); setEditingId(null); setError(null) }}>Cancel</button>
            </div>
          </form>
        )}
        {loading ? <div className="placeholder">Loading users…</div> : (
          <div>
            <h3 style={{ marginBottom: 8 }}>All Users ({users.length})</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
              <thead>
                <tr style={{ background: 'var(--bg-2)' }}>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Username</th>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Role ID</th>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Dept ID</th>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Assigned Grade</th>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Approved</th>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.user_id}>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{u.username}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{u.role_id}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{u.department_id ?? '—'}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{u.assigned_grade_level_name || '—'}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{u.is_approved ? 'Yes' : 'No'}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
                      <button className="action-btn" onClick={() => openEdit(u)} style={{ marginRight: 6 }}>Edit</button>
                      <button className="action-btn" onClick={() => handleDelete(u.user_id)} style={{ color: '#a91d2b', borderColor: 'rgba(169,29,43,0.2)' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 style={{ marginBottom: 8 }}>Pending Approvals ({pendingUsers.length})</h3>
            {pendingUsers.length === 0 ? (
              <div className="placeholder">No pending users.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-2)' }}>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Username</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Role ID</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map(u => (
                    <tr key={u.user_id}>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{u.username}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{u.role_id}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
                        <button className="action-btn primary" onClick={() => handleApprove(u.user_id)}>Approve</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </StaffLayout>
  )
}
