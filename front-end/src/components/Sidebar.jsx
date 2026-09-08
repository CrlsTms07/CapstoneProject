import React from 'react'
import { NavLink } from 'react-router-dom'
import '../styles/staffLayout.css'

const MenuItem = ({ to, icon, label }) => (
  <NavLink to={to} className={({isActive}) => isActive ? 'ss-menu-item active' : 'ss-menu-item'}>
    <span className="ss-menu-icon" aria-hidden>{icon}</span>
    <span className="ss-menu-label">{label}</span>
  </NavLink>
)

export default function Sidebar({ user }) {
  if (!user) return null

  const role = Number(user.role_id)

  const adminMenu = [
    { to: '/admin', label: 'Dashboard', icon: '📊' },
    { to: '#', label: 'Schedule Plotter', icon: '📅' },
    { to: '#', label: 'Teachers', icon: '👩‍🏫' },
    { to: '#', label: 'Sections', icon: '🏷️' },
    { to: '#', label: 'Subjects', icon: '📚' },
    { to: '#', label: 'Rooms & Buildings', icon: '🏛️' },
    { to: '#', label: 'Users & Roles', icon: '🛡️' },
    { to: '/schedule-approvals', label: 'Approvals', icon: '✅' },
    { to: '#', label: 'Reports', icon: '📈' }
  ]

  const chairMenu = [
    { to: '/chair', label: 'Dashboard', icon: '📊' },
    { to: '#', label: 'Schedule Plotter', icon: '📅' },
    { to: '#', label: 'Teachers', icon: '👩‍🏫' },
    { to: '#', label: 'Sections', icon: '🏷️' },
    { to: '#', label: 'Subjects', icon: '📚' },
    { to: '#', label: 'Rooms & Buildings', icon: '🏛️' },
    { to: '/submitted-schedules', label: 'Submitted Schedules', icon: '📥' },
    { to: '#', label: 'Reports', icon: '📈' }
  ]

  const masterMenu = [
    { to: '/master-teacher', label: 'Dashboard', icon: '📊' },
    { to: '#', label: 'Schedule Plotter', icon: '📅' },
    { to: '#', label: 'Teachers', icon: '👩‍🏫' },
    { to: '#', label: 'Sections', icon: '🏷️' },
    { to: '#', label: 'Subjects', icon: '📚' },
    { to: '#', label: 'Rooms & Buildings', icon: '🏛️' },
    { to: '/submitted-schedules', label: 'Submitted Schedules', icon: '📥' },
    { to: '#', label: 'Reports', icon: '📈' }
  ]

  const teacherMenu = [
    { to: '/teacher', label: 'Dashboard', icon: '📊' },
    { to: '/teacher', label: 'My Schedule', icon: '📆' },
    { to: '/teacher', label: 'My Profile', icon: '👤' }
  ]

  let menu = []
  if (role === 1) menu = adminMenu
  else if (role === 2) menu = chairMenu
  else if (role === 3) menu = masterMenu
  else if (role === 4) menu = teacherMenu

  const initials = (user.username || '')
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0,2)

  return (
    <aside className="ss-sidebar">
      <div className="ss-brand">
        <div className="ss-logo">📘</div>
        <div>
          <div className="ss-title">ERCIHS</div>
          <div className="ss-sub">Class Scheduling System</div>
          <div className="ss-sub small">S.Y. 2026-2027</div>
        </div>
      </div>

      <nav className="ss-nav">
        {menu.map((m, i) => (
          <MenuItem key={i} to={m.to} icon={m.icon} label={m.label} />
        ))}
      </nav>

      <div className="ss-user-area">
        <div className="ss-avatar">{initials}</div>
        <div className="ss-user-info">
          <div className="ss-username">{user.username}</div>
          <div className="ss-role">{user.role_name || ('Role ' + user.role_id)}</div>
        </div>
        <button className="ss-logout" onClick={async () => {
          await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
          window.location.href = '/'
        }}>Logout</button>
      </div>
    </aside>
  )
}
