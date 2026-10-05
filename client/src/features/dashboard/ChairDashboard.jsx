// HIPO 3.1 – Dashboard (grade level chairperson)
// Grade-level overview and shortcuts to sections, faculty load and the plotter.
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StaffLayout from '../../components/StaffLayout'
import { DashboardPanel, EmptyState, Icon, MetricCard } from '../../components/DashboardPrimitives'

const countOf = data => Array.isArray(data) ? data.length : Array.isArray(data?.rows) ? data.rows.length : null

export default function ChairDashboard({ user }) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ teachers: null, sections: null, pending: null })
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    const endpoints = [['teachers', '/api/teachers'], ['sections', '/api/sections'], ['pending', '/api/schedule-approvals']]
    Promise.all(endpoints.map(async ([key, url]) => {
      try {
        const response = await fetch(url, { credentials: 'include' })
        return response.ok ? [key, countOf(await response.json())] : [key, null]
      } catch { return [key, null] }
    })).then(entries => {
      if (mounted) { setStats(Object.fromEntries(entries)); setLoading(false) }
    })
    return () => { mounted = false }
  }, [])

  return (
    <StaffLayout user={user} title="Grade level overview" subtitle="Coordinate faculty, sections, and schedule submissions for your assigned scope." notificationCount={stats.pending || 0}>
      <div className="dash-page">
        <div className="dash-welcome-strip"><div className="dash-welcome-title"><span className="dash-welcome-mark"><Icon name="sections" size={19} /></span><div><strong>Your academic scope</strong><span>Department {user?.department_id || 'not assigned'} · Grade-level coordination</span></div></div><span className="dash-health"><i />Workspace active</span></div>
        <section><div className="dash-section-label"><h2>Grade-level overview</h2><span>Assigned department</span></div><div className="dash-metrics"><MetricCard label="Assigned grade levels" value={user?.department_id ? 1 : '—'} detail={user?.department_id ? `Department ${user.department_id}` : 'Scope not assigned'} icon="sections" tone="gold" /><MetricCard label="Faculty members" value={stats.teachers} loading={loading} detail="Directory count" icon="users" /><MetricCard label="Grade sections" value={stats.sections} loading={loading} detail="Current catalog" icon="books" tone="green" /><MetricCard label="Schedule submissions" value={stats.pending} loading={loading} detail="Review queue" icon="inbox" tone="gold" /></div></section>
        <div className="dash-grid"><DashboardPanel title="Department schedule" eyebrow="Academic planning" action={<button className="dash-panel-action" onClick={() => navigate('/plot-schedule')}>Open planner <Icon name="arrow" size={14} /></button>}><EmptyState title="Ready for planning" detail="View and coordinate schedules for sections within your assigned department." icon="calendar" /></DashboardPanel><DashboardPanel title="Faculty load" eyebrow="Teaching team" action={<button className="dash-panel-action" onClick={() => navigate('/teachers')}>Faculty directory <Icon name="arrow" size={14} /></button>}><EmptyState title="Faculty overview" detail="Open the directory to review faculty and their assigned academic resources." icon="users" /></DashboardPanel></div>
        <div className="dash-grid dash-grid-equal"><DashboardPanel title="Submitted schedules" eyebrow="Review workflow" action={<button className="dash-panel-action" onClick={() => navigate('/submitted-schedules')}>View submissions <Icon name="arrow" size={14} /></button>}><EmptyState title="No submissions shown" detail="Schedule submissions will be available here when connected to the review list." icon="inbox" /></DashboardPanel><DashboardPanel title="Common tasks" eyebrow="Quick actions"><div className="dash-actions"><button className="dash-action-link primary" onClick={() => navigate('/plot-schedule')}><Icon name="calendar" size={15} />Plan schedule</button><button className="dash-action-link" onClick={() => navigate('/sections')}><Icon name="sections" size={15} />Grade sections</button><button className="dash-action-link" onClick={() => navigate('/reports')}><Icon name="chart" size={15} />View reports</button></div></DashboardPanel></div>
      </div>
    </StaffLayout>
  )
}
