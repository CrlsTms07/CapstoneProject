// HIPO 3.1 – Dashboard (master teacher)
// Subject and schedule-review overview.
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StaffLayout from '../../components/StaffLayout'
import { DashboardPanel, EmptyState, Icon, MetricCard } from '../../components/DashboardPrimitives'

const countOf = data => Array.isArray(data) ? data.length : Array.isArray(data?.rows) ? data.rows.length : null

export default function MasterTeacherDashboard({ user }) {
  const [metrics, setMetrics] = useState({ subjects: null, teachers: null, approvals: null })
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    const endpoints = [['subjects', '/api/subjects'], ['teachers', '/api/teachers'], ['approvals', '/api/approvals/submissions?status=pending']]
    Promise.all(endpoints.map(async ([key, url]) => {
      try { const response = await fetch(url, { credentials: 'include' }); return response.ok ? [key, countOf(await response.json())] : [key, null] }
      catch { return [key, null] }
    })).then(entries => { if (mounted) { setMetrics(Object.fromEntries(entries)); setLoading(false) } })
    return () => { mounted = false }
  }, [])

  return (
    <StaffLayout user={user} title="Master teacher workspace" subtitle="Oversee subject assignments, teaching practice, and schedule reviews." notificationCount={metrics.approvals || 0}>
      <div className="dash-page">
        <div className="dash-welcome-strip"><div className="dash-welcome-title"><span className="dash-welcome-mark"><Icon name="spark" size={19} /></span><div><strong>Teaching excellence</strong><span>Subject coordination and peer support in one place.</span></div></div><span className="dash-health"><i />Workspace active</span></div>
        <section><div className="dash-section-label"><h2>Academic overview</h2><span>Master teacher workspace</span></div><div className="dash-metrics"><MetricCard label="Subject offerings" value={metrics.subjects} loading={loading} detail="Academic catalog" icon="books" tone="gold" /><MetricCard label="Faculty directory" value={metrics.teachers} loading={loading} detail="Teaching colleagues" icon="users" /><MetricCard label="Schedule reviews" value={metrics.approvals} loading={loading} detail="Current queue" icon="check" tone="green" /><MetricCard label="Assigned department" value={user?.department_id || '—'} detail={user?.department_id ? 'Current scope' : 'No department set'} icon="building" tone="gold" /></div></section>
        <div className="dash-grid"><DashboardPanel title="Subject assignments" eyebrow="Instruction" action={<button className="dash-panel-action" onClick={() => navigate('/subjects')}>Open subjects <Icon name="arrow" size={14} /></button>}><EmptyState title="Subject catalog" detail="Review the available subject offerings and coordinate assignment details." icon="books" /></DashboardPanel><DashboardPanel title="Schedule approvals" eyebrow="Review workflow" action={<button className="dash-panel-action" onClick={() => navigate('/schedule-approvals')}>Review schedules <Icon name="arrow" size={14} /></button>}><EmptyState title="Review queue" detail="Submitted schedules requiring your review will be available in approvals." icon="check" /></DashboardPanel></div>
        <div className="dash-grid dash-grid-equal"><DashboardPanel title="Peer evaluations" eyebrow="Faculty development" action={<button className="dash-panel-action" onClick={() => navigate('/submitted-schedules')}>Open submissions <Icon name="arrow" size={14} /></button>}><EmptyState title="No evaluations due" detail="Peer review and teaching support tasks will appear here." icon="users" /></DashboardPanel><DashboardPanel title="Common tasks" eyebrow="Quick actions"><div className="dash-actions"><button className="dash-action-link primary" onClick={() => navigate('/schedule-approvals')}><Icon name="check" size={15} />Review schedules</button><button className="dash-action-link" onClick={() => navigate('/subjects')}><Icon name="books" size={15} />Subject assignments</button><button className="dash-action-link" onClick={() => navigate('/plot-schedule')}><Icon name="calendar" size={15} />Schedule planner</button></div></DashboardPanel></div>
      </div>
    </StaffLayout>
  )
}
