import React, { useEffect, useState } from 'react'
import StaffLayout from '../components/StaffLayout'
import '../styles/adminDashboard.css'

export default function AdminDashboard({ user }) {
  if (!user) return <div>Please login as Admin.</div>

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ teachers: null, sections: null, subjects: null, pending: null })
  const [pendingUsers, setPendingUsers] = useState([])
  const [loadingPendingUsers, setLoadingPendingUsers] = useState(true)
  const [approving, setApproving] = useState(null)

  useEffect(() => {
    let mounted = true
    // Try to fetch counts if APIs exist; otherwise show placeholders
    const fetchStats = async () => {
      try {
        const results = {}
        const endpoints = [
          ['teachers','/api/teachers'],
          ['sections','/api/sections'],
          ['subjects','/api/subjects'],
          ['pending','/api/schedule-approvals']
        ]
        await Promise.all(endpoints.map(async ([key, url]) => {
          try {
            const res = await fetch(url, { credentials: 'include' })
            if (!res.ok) return
            const data = await res.json()
            if (Array.isArray(data)) results[key] = data.length
            else if (data && Array.isArray(data.rows)) results[key] = data.rows.length
          } catch (e) {
            // ignore
          }
        }))

        if (mounted) setStats(prev => ({...prev, ...results}))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchStats()

    // fetch pending users for admin
    const fetchPendingUsers = async () => {
      setLoadingPendingUsers(true)
      try {
        const res = await fetch('/api/users/pending', { credentials: 'include' })
        if (!res.ok) return setPendingUsers([])
        const data = await res.json()
        setPendingUsers(data || [])
      } catch (e) {
        setPendingUsers([])
      } finally {
        setLoadingPendingUsers(false)
      }
    }

    fetchPendingUsers()
    return () => { mounted = false }
  }, [])

  const display = (val) => {
    if (loading) return 'Loading...'
    return (val === null || val === undefined) ? '—' : String(val)
  }

  return (
    <StaffLayout user={user}>
      <div className="admin-root">
        <header className="admin-header">
          <div>
            <h1>Admin Dashboard</h1>
            <p className="admin-sub">Overview of the class scheduling system</p>
          </div>
          <div className="admin-user">Signed in as <strong>{user.username}</strong></div>
        </header>

        <section className="admin-summary">
          <div className="stat-card">
            <div className="stat-icon">👩‍🏫</div>
            <div className="stat-body">
              <div className="stat-value">{display(stats.teachers)}</div>
              <div className="stat-label">Total Teachers</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🏷️</div>
            <div className="stat-body">
              <div className="stat-value">{display(stats.sections)}</div>
              <div className="stat-label">Total Sections</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📚</div>
            <div className="stat-body">
              <div className="stat-value">{display(stats.subjects)}</div>
              <div className="stat-label">Total Subjects</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-body">
              <div className="stat-value">{display(stats.pending)}</div>
              <div className="stat-label">Pending Approvals</div>
            </div>
          </div>
        </section>

        <section className="admin-main-grid">
          <div className="panel">
            <h3>Today's Schedule</h3>
            <div className="panel-body">
              {loading ? <div className="placeholder">Loading schedule…</div> : <div className="placeholder">No schedule data available.</div>}
            </div>
          </div>

          <div className="panel">
            <h3>Pending Approvals</h3>
            <div className="panel-body">
              {loadingPendingUsers ? (
                <div className="placeholder">Loading approvals…</div>
              ) : pendingUsers.length === 0 ? (
                <div className="placeholder">No pending users.</div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:10,width:'100%'}}>
                  {pendingUsers.map(u => (
                    <div key={u.user_id} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div>
                        <div><strong>{u.username}</strong></div>
                        <div style={{fontSize:12,color:'#6b7280'}}>role: {u.role_id} • dept: {u.department_id ?? '—'}</div>
                      </div>
                      <div>
                        <button className="action-btn" onClick={async ()=>{
                          if (approving) return
                          try {
                            setApproving(u.user_id)
                            const res = await fetch(`/api/users/${u.user_id}/approve`, { method: 'POST', credentials: 'include' })
                            if (res.ok) {
                              // remove from list
                              setPendingUsers(list => list.filter(x => x.user_id !== u.user_id))
                            } else {
                              const d = await res.json().catch(()=>null)
                              alert(d && d.error ? d.error : 'Approve failed')
                            }
                          } catch (err) {
                            alert('Approve failed')
                          } finally {
                            setApproving(null)
                          }
                        }}>{approving===u.user_id ? 'Approving…' : 'Approve'}</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <h3>Recent Activity</h3>
            <div className="panel-body">
              <div className="placeholder">No recent activity to show.</div>
            </div>
          </div>

          <div className="panel">
            <h3>Quick Actions</h3>
            <div className="panel-body actions">
              <button className="action-btn primary">Plot Schedule</button>
              <button className="action-btn">Manage Teachers</button>
              <button className="action-btn">Manage Sections</button>
              <button className="action-btn">Manage Rooms</button>
              <button className="action-btn">View Approvals</button>
            </div>
          </div>
        </section>
      </div>
    </StaffLayout>
  )
}
