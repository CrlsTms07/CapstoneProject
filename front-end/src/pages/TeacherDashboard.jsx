import React from 'react'
import { useNavigate } from 'react-router-dom'
import StaffLayout from '../components/StaffLayout'
import { DashboardPanel, EmptyState, Icon, MetricCard } from '../components/DashboardPrimitives'

export default function TeacherDashboard({ user }) {
  const navigate = useNavigate()

  return (
    <StaffLayout user={user} title="My teaching workspace" subtitle="Your class schedule, room assignments, and teaching resources." >
      <div className="dash-page">
        <div className="dash-welcome-strip"><div className="dash-welcome-title"><span className="dash-welcome-mark"><Icon name="book" size={19} /></span><div><strong>Welcome, {user?.full_name || user?.username || 'Teacher'}</strong><span>Your faculty workspace is ready for the day.</span></div></div><span className="dash-health"><i />Account active</span></div>
        <section><div className="dash-section-label"><h2>My overview</h2><span>Teaching resources</span></div><div className="dash-metrics"><MetricCard label="Today's classes" value="—" detail="Schedule availability" icon="calendar" /><MetricCard label="Room assignments" value="—" detail="Today's locations" icon="building" tone="gold" /><MetricCard label="My sections" value="—" detail="Assigned classes" icon="sections" tone="green" /><MetricCard label="Department" value={user?.department_id || '—'} detail={user?.department_id ? 'Assigned scope' : 'Contact administrator'} icon="users" tone="gold" /></div></section>
        <div className="dash-grid"><DashboardPanel title="My class schedule" eyebrow="Today" action={<button className="dash-panel-action" onClick={() => navigate('/teacher#my-schedule')}>Full schedule <Icon name="arrow" size={14} /></button>}><span id="my-schedule" /><EmptyState title="Your schedule will appear here" detail="Class meetings and teaching assignments will be listed as schedule data becomes available." icon="calendar" /></DashboardPanel><DashboardPanel title="Room assignments" eyebrow="Teaching spaces"><span id="room-assignments" /><EmptyState title="No room details yet" detail="Assigned classrooms and room information will be shown here." icon="building" /></DashboardPanel></div>
        <div className="dash-grid dash-grid-equal"><DashboardPanel title="My sections & students" eyebrow="Class lists"><span id="student-lists" /><EmptyState title="Class lists will appear here" detail="Your assigned sections and student lists will be available in this workspace." icon="users" /></DashboardPanel><DashboardPanel title="Teaching resources" eyebrow="Quick actions"><div className="dash-actions"><button className="dash-action-link primary" onClick={() => navigate('/teacher#my-schedule')}><Icon name="calendar" size={15} />View my schedule</button><button className="dash-action-link" onClick={() => navigate('/teacher#student-lists')}><Icon name="users" size={15} />My sections</button><button className="dash-action-link" onClick={() => navigate('/teacher#room-assignments')}><Icon name="building" size={15} />Room details</button></div></DashboardPanel></div>
      </div>
    </StaffLayout>
  )
}
