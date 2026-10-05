import React, { useEffect, useRef, useState } from 'react'
import Sidebar from './Sidebar'
import { Icon, initialsFor, roleLabelFor } from './DashboardPrimitives'
import '../styles/staffLayout.css'

export default function StaffLayout({ user, title, subtitle, notificationCount = 0, children }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [navigationQuery, setNavigationQuery] = useState('')
  const searchRef = useRef(null)
  const roleLabel = roleLabelFor(user)
  const today = new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())

  useEffect(() => {
    const handleSearchShortcut = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleSearchShortcut)
    return () => window.removeEventListener('keydown', handleSearchShortcut)
  }, [])

  return (
    <div className="ss-root">
      <Sidebar user={user} query={navigationQuery} />
      <main className="ss-main">
        <header className="ss-topbar">
          <div className="ss-topbar-search">
            <Icon name="search" size={18} />
            <input ref={searchRef} aria-label="Search navigation" placeholder="Search navigation" value={navigationQuery} onChange={event => setNavigationQuery(event.target.value)} />
            <kbd>⌘ K</kbd>
          </div>
          <div className="ss-topbar-actions">
            <span className="ss-date"><Icon name="calendar" size={16} />{today}</span>
            <div className="ss-notification-wrap">
              <button className={`ss-icon-button${notificationsOpen ? ' is-open' : ''}`} aria-label={`Notifications, ${notificationCount} unread`} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(open => !open)}>
                <Icon name="bell" size={18} />
                {notificationCount > 0 && <span className="ss-notification-count">{notificationCount > 99 ? '99+' : notificationCount}</span>}
              </button>
              {notificationsOpen && <div className="ss-notification-popover"><strong>Notifications</strong><p>{notificationCount ? `You have ${notificationCount} items needing your attention.` : 'You are all caught up.'}</p></div>}
            </div>
            <span className="ss-role-indicator">{roleLabel}</span>
          </div>
        </header>
        {title && <section className="ss-page-heading">
          <div><span className="ss-page-kicker">ERCIHS PORTAL <span /> SCHOOL YEAR 2026-2027</span><h1>{title}</h1><p>{subtitle}</p></div>
          <div className="ss-heading-avatar" aria-hidden="true">{initialsFor(user)}</div>
        </section>}
        <div className="ss-content">
          {children}
        </div>
      </main>
    </div>
  )
}
