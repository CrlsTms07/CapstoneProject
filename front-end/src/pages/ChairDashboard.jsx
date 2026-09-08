import React, { useEffect, useState } from 'react'
import StaffLayout from '../components/StaffLayout'
import '../styles/chairDashboard.css'

export default function ChairDashboard({ user }) {
  if (!user) return <div>Please login as Chairperson.</div>

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ gradeLevel: null, teachers: null, sections: null, pending: null })

  useEffect(() => {
    let mounted = true
    const fetchStats = async () => {
      try {
        const results = {}
        try {
          const resT = await fetch('/api/teachers', { credentials: 'include' })
          if (resT.ok){ const d = await resT.json(); results.teachers = Array.isArray(d) ? d.length : (d.rows ? d.rows.length : null) }
        } catch(e){}
        try {
          const resS = await fetch('/api/sections', { credentials: 'include' })
          if (resS.ok){ const d = await resS.json(); results.sections = Array.isArray(d) ? d.length : (d.rows ? d.rows.length : null) }
        } catch(e){}
        try {
          const resP = await fetch('/api/schedule-approvals', { credentials: 'include' })
          if (resP.ok){ const d = await resP.json(); results.pending = Array.isArray(d) ? d.length : (d.rows ? d.rows.length : null) }
        } catch(e){}

        if (mounted) setStats(prev => ({...prev, ...results}))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchStats()
    return () => { mounted = false }
  }, [])

  const display = (val) => loading ? 'Loading...' : (val === null || val === undefined ? '—' : String(val))

  return (
    <StaffLayout user={user}>
      <div className="chair-root">
        <header className="chair-header">
          <div>
            <h1>Grade Level Chairperson Dashboard</h1>
            <p className="chair-sub">Manage schedules and academic resources within your assigned scope.</p>
          </div>
          <div className="chair-scope">Assigned Scope: <strong>{user.department_id ? `Dept ${user.department_id}` : 'Not assigned'}</strong></div>
        </header>

        <section className="chair-summary">
          <div className="cstat-card">
            <div className="cstat-icon">🎯</div>
            <div>
              <div className="cstat-value">{display(stats.gradeLevel)}</div>
              <div className="cstat-label">Assigned Grade Level</div>
            </div>
          </div>

          <div className="cstat-card">
            <div className="cstat-icon">👩‍🏫</div>
            <div>
              <div className="cstat-value">{display(stats.teachers)}</div>
              <div className="cstat-label">Total Teachers</div>
            </div>
          </div>

          <div className="cstat-card">
            <div className="cstat-icon">🏷️</div>
            <div>
              <div className="cstat-value">{display(stats.sections)}</div>
              <div className="cstat-label">Total Sections</div>
            </div>
          </div>

          <div className="cstat-card">
            <div className="cstat-icon">📥</div>
            <div>
              <div className="cstat-value">{display(stats.pending)}</div>
              <div className="cstat-label">Pending Submissions</div>
            </div>
          </div>
        </section>

        <section className="chair-main-grid">
          <div className="panel">
            <h3>Today's Schedule</h3>
            <div className="panel-body">{loading ? <div className="placeholder">Loading…</div> : <div className="placeholder">No schedule available for today.</div>}</div>
          </div>

          <div className="panel">
            <h3>Pending Schedule Submissions</h3>
            <div className="panel-body">{loading ? <div className="placeholder">Loading…</div> : <div className="placeholder">No pending submissions.</div>}</div>
          </div>

          <div className="panel">
            <h3>Quick Actions</h3>
            <div className="panel-body actions">
              <button className="action-btn primary">Plot Schedule</button>
              <button className="action-btn">Teachers</button>
              <button className="action-btn">Sections</button>
              <button className="action-btn">Rooms</button>
              <button className="action-btn">Subjects</button>
            </div>
          </div>
        </section>
      </div>
    </StaffLayout>
  )
}
