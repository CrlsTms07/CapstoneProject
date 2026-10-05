// Shared – role-based sidebar navigation.
import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Icon, initialsFor, roleLabelFor } from './DashboardPrimitives'
import '../styles/staffLayout.css'

const MenuItem = ({ to, icon, label }) => {
  const location = useLocation()
  const className = location.hash === to ? 'ss-menu-item active' : 'ss-menu-item'
  const content = <><span className="ss-menu-icon"><Icon name={icon} size={18} /></span><span className="ss-menu-label">{label}</span></>
  return to.startsWith('#') ? <a href={to} className={className}>{content}</a> : <NavLink to={to} className={({isActive}) => isActive ? 'ss-menu-item active' : 'ss-menu-item'}>{content}</NavLink>
}

export default function Sidebar({ user, query = '' }) {
  if (!user) return null

  const role = Number(user.role_id)

  const adminMenu = [
    { to: '/admin', label: 'Overview', icon: 'dashboard' },
    { to: '/plot-schedule', label: 'Schedule Plotter', icon: 'calendar' },
    { to: '/teachers', label: 'Faculty Directory', icon: 'users' },
    { to: '/sections', label: 'Sections', icon: 'sections' },
    { to: '/subjects', label: 'Subjects', icon: 'books' },
    { to: '/rooms', label: 'Rooms & Buildings', icon: 'building' },
    { to: '/users', label: 'Users & Roles', icon: 'shield' },
    { to: '/schedule-approvals', label: 'Schedule Approvals', icon: 'check' },
    { to: '/reports', label: 'Reports & Insights', icon: 'chart' }
  ]

  const chairMenu = [
    { to: '/chair', label: 'Overview', icon: 'dashboard' },
    { to: '/sections', label: 'Grade Sections', icon: 'sections' },
    { to: '/teachers', label: 'Faculty Load', icon: 'users' },
    { to: '/plot-schedule', label: 'Schedule Plotter', icon: 'calendar' },
    { to: '/submitted-schedules', label: 'Submitted Schedules', icon: 'inbox' },
    { to: '/reports', label: 'Reports & Insights', icon: 'chart' }
  ]

  const masterMenu = [
    { to: '/master-teacher', label: 'Overview', icon: 'dashboard' },
    { to: '/subjects', label: 'Subject Assignments', icon: 'books' },
    { to: '/submitted-schedules', label: 'Peer Evaluations', icon: 'users' },
    { to: '/schedule-approvals', label: 'Schedule Approvals', icon: 'check' },
    { to: '/plot-schedule', label: 'Schedule Plotter', icon: 'calendar' }
  ]

  const teacherMenu = [
    { to: '/teacher', label: 'My Overview', icon: 'dashboard' },
    { to: '#my-schedule', label: 'My Class Schedule', icon: 'calendar' },
    { to: '#room-assignments', label: 'Room Assignments', icon: 'building' },
    { to: '#student-lists', label: 'Student Lists', icon: 'users' }
  ]

  let menu = []
  if (role === 1) menu = adminMenu
  else if (role === 2) menu = chairMenu
  else if (role === 3) menu = masterMenu
  else if (role === 4) menu = teacherMenu

  const filteredMenu = menu.filter(item => item.label.toLowerCase().includes(query.toLowerCase()))

  return (
    <aside className="ss-sidebar">
      <div>
        <div className="ss-brand">
          <img className="ss-logo" src="https://vote.ercihs.edu.ph/ERCIHS%20LOGO.png" alt="" onError={event => { event.currentTarget.style.display = 'none' }} />
          <div className="ss-brand-copy">
            <div className="ss-title">ERCIHS Portal</div>
            <div className="ss-sub">Academic Services</div>
          </div>
        </div>
        <div className="ss-school-year"><span />S.Y. 2026-2027</div>
        <div className="ss-nav-label">WORKSPACE</div>
        <nav className="ss-nav" aria-label="Role dashboard navigation">
          {filteredMenu.length ? filteredMenu.map((item, index) => <MenuItem key={`${item.to}-${index}`} {...item} />) : <p className="ss-no-results">No matching pages</p>}
        </nav>
      </div>

      <div className="ss-user-area">
        <div className="ss-avatar">{initialsFor(user)}</div>
        <div className="ss-user-info">
          <div className="ss-username">{user.full_name || user.username}</div>
          <div className="ss-role">{roleLabelFor(user)}</div>
        </div>
        <details className="ss-profile-menu">
          <summary aria-label="Profile actions"><Icon name="chevron" size={17} /></summary>
          <div className="ss-profile-popover">
            <NavLink to={role === 1 ? '/users' : role === 2 ? '/chair' : role === 3 ? '/master-teacher' : '/teacher'}>Profile</NavLink>
            <button onClick={async () => { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); window.location.href = '/' }}><Icon name="logout" size={16} /> Sign out</button>
          </div>
        </details>
      </div>
    </aside>
  )
}
