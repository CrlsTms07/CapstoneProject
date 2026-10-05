import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StaffLayout from '../components/StaffLayout'
import { DashboardPanel, EmptyState, Icon, MetricCard, initialsFor } from '../components/DashboardPrimitives'

const countOf = data => Array.isArray(data) ? data.length : Array.isArray(data?.rows) ? data.rows.length : null

export default function AdminDashboard({ user }) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ teachers: null, sections: null, subjects: null, pending: null })
  const [pendingUsers, setPendingUsers] = useState([])
  const [recoveryRequests, setRecoveryRequests] = useState([])
  const [loadingRecoveryRequests, setLoadingRecoveryRequests] = useState(true)
  const [loadingPendingUsers, setLoadingPendingUsers] = useState(true)
  const [approving, setApproving] = useState(null)
  const [reviewingRecovery, setReviewingRecovery] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    const loadDashboard = async () => {
      const endpoints = [
        ['teachers', '/api/teachers'], ['sections', '/api/sections'],
        ['subjects', '/api/subjects'], ['pending', '/api/schedule-approvals']
      ]
      const [counts, usersResponse, recoveryResponse] = await Promise.all([
        Promise.all(endpoints.map(async ([key, url]) => {
          try {
            const response = await fetch(url, { credentials: 'include' })
            return response.ok ? [key, countOf(await response.json())] : [key, null]
          } catch { return [key, null] }
        })),
        fetch('/api/users/pending', { credentials: 'include' }).catch(() => null),
        fetch('/api/password-reset-requests', { credentials: 'include' }).catch(() => null)
      ])
      const users = usersResponse?.ok ? await usersResponse.json().catch(() => []) : []
      const requests = recoveryResponse?.ok ? await recoveryResponse.json().catch(() => []) : []
      if (mounted) {
        setStats(Object.fromEntries(counts))
        setPendingUsers(Array.isArray(users) ? users : [])
        setRecoveryRequests(Array.isArray(requests) ? requests : [])
        setLoading(false)
        setLoadingPendingUsers(false)
        setLoadingRecoveryRequests(false)
      }
    }
    loadDashboard()
    return () => { mounted = false }
  }, [])

  const reviewRecovery = async (request, decision) => {
    setReviewingRecovery(request.request_id)
    try {
      const response = await fetch(`/api/password-reset-requests/${request.request_id}/${decision}`, { method: 'POST', credentials: 'include' })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Unable to review request.')
      setRecoveryRequests(items => items.filter(item => item.request_id !== request.request_id))
    } catch (error) {
      window.alert(error.message || 'Unable to review request.')
    } finally {
      setReviewingRecovery(null)
    }
  }

  const approveUser = async pendingUser => {
    setApproving(pendingUser.user_id)
    try {
      const response = await fetch(`/api/users/${pendingUser.user_id}/approve`, { method: 'POST', credentials: 'include' })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Approval failed.')
      setPendingUsers(items => items.filter(item => item.user_id !== pendingUser.user_id))
    } catch (error) {
      window.alert(error.message || 'Approval failed.')
    } finally {
      setApproving(null)
    }
  }

  const pendingCount = (stats.pending || 0) + pendingUsers.length + recoveryRequests.length

  return (
    <StaffLayout user={user} title="System overview" subtitle="Monitor academic operations, user access, and schedule activity." notificationCount={recoveryRequests.length + pendingUsers.length}>
      <div className="dash-page">
        <div className="dash-welcome-strip">
          <div className="dash-welcome-title"><span className="dash-welcome-mark"><Icon name="spark" size={19} /></span><div><strong>Welcome back, {user?.full_name?.split(' ')[0] || 'Administrator'}</strong><span>Here is your institution's operational snapshot.</span></div></div>
          <span className="dash-health"><i />All systems active</span>
        </div>

        <section aria-labelledby="admin-metrics-title">
          <div className="dash-section-label"><h2 id="admin-metrics-title">Institution overview</h2><span>Live data from the portal</span></div>
          <div className="dash-metrics">
            <MetricCard label="Faculty members" value={stats.teachers} loading={loading} detail="Registered" icon="users" />
            <MetricCard label="Active sections" value={stats.sections} loading={loading} detail="Across grade levels" icon="sections" tone="gold" />
            <MetricCard label="Subject offerings" value={stats.subjects} loading={loading} detail="Academic catalog" icon="books" tone="green" />
            <MetricCard label="Items to review" value={loading ? null : pendingCount} loading={loading} detail="Needs attention" icon="inbox" tone="gold" />
          </div>
        </section>

        <div className="dash-grid">
          <DashboardPanel title="Account recovery requests" eyebrow="Access management" action={<button className="dash-panel-action" onClick={() => document.getElementById('recovery-queue')?.scrollIntoView({ behavior: 'smooth' })}>Review queue <Icon name="arrow" size={14} /></button>}>
            {loadingRecoveryRequests ? <EmptyState title="Loading requests" detail="Checking for account recovery requests." icon="clock" /> : recoveryRequests.length === 0 ? <EmptyState title="All caught up!" detail="No pending recovery requests. New requests will appear here for review." /> : (
              <div className="dash-list" id="recovery-queue">
                {recoveryRequests.map(request => <article className="dash-list-item" key={request.request_id}>
                  <div className="dash-list-main"><span className="dash-list-avatar">{initialsFor({ full_name: request.full_name || request.email })}</span><div className="dash-list-copy"><strong>{request.full_name || request.email}</strong><span>{request.employee_id} · {request.department_name || 'No department'} · {request.reason}</span><span>{request.email} · {request.contact_number} · {new Date(request.requested_at).toLocaleString()}</span></div></div>
                  <div className="dash-actions"><span className="dash-status">Pending</span><button className="dash-action-link primary" disabled={reviewingRecovery === request.request_id} onClick={() => reviewRecovery(request, 'approve')}>{reviewingRecovery === request.request_id ? 'Sending…' : 'Approve'}</button><button className="dash-action-link" disabled={reviewingRecovery === request.request_id} onClick={() => reviewRecovery(request, 'reject')}>Reject</button></div>
                </article>)}
              </div>
            )}
          </DashboardPanel>

          <DashboardPanel title="Today's schedule" eyebrow="Academic operations" action={<button className="dash-panel-action" onClick={() => navigate('/plot-schedule')}>Open planner <Icon name="arrow" size={14} /></button>}>
            <EmptyState title="Schedule view is ready" detail="Open the schedule planner to manage today's classes and room assignments." icon="calendar" />
          </DashboardPanel>
        </div>

        <div className="dash-grid dash-grid-equal">
          <DashboardPanel title="Pending user approvals" eyebrow="Account administration">
            {loadingPendingUsers ? <EmptyState title="Loading approvals" detail="Checking recently created accounts." icon="clock" /> : pendingUsers.length === 0 ? <EmptyState title="All caught up!" detail="There are no accounts waiting for approval." /> : <div className="dash-list">{pendingUsers.map(pendingUser => <article className="dash-list-item" key={pendingUser.user_id}><div className="dash-list-main"><span className="dash-list-avatar">{initialsFor({ username: pendingUser.username })}</span><div className="dash-list-copy"><strong>{pendingUser.username}</strong><span>Role {pendingUser.role_id} · Department {pendingUser.department_id ?? '—'}</span></div></div><button className="dash-action-link primary" disabled={approving === pendingUser.user_id} onClick={() => approveUser(pendingUser)}>{approving === pendingUser.user_id ? 'Approving…' : 'Approve'}</button></article>)}</div>}
          </DashboardPanel>

          <DashboardPanel title="Quick actions" eyebrow="Common tasks">
            <div className="dash-actions"><button className="dash-action-link primary" onClick={() => navigate('/plot-schedule')}><Icon name="calendar" size={15} />Plot schedule</button><button className="dash-action-link" onClick={() => navigate('/teachers')}><Icon name="users" size={15} />Manage faculty</button><button className="dash-action-link" onClick={() => navigate('/users')}><Icon name="shield" size={15} />User access</button><button className="dash-action-link" onClick={() => navigate('/reports')}><Icon name="chart" size={15} />View reports</button></div>
          </DashboardPanel>
        </div>
      </div>
    </StaffLayout>
  )
}
