// Shared – icons, metric cards, panels and empty states.
import React from 'react'

const paths = {
  dashboard: <><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="13" y="10" width="8" height="11" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  sections: <><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></>,
  books: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>,
  building: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 21V9h6v12M7 7h.01M17 7h.01M7 11h.01M17 11h.01M7 15h.01M17 15h.01"/></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"/><path d="m9 12 2 2 4-4"/></>,
  chart: <><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-5 5"/></>,
  inbox: <><path d="M4 4h16v16H4z"/><path d="M4 13h4l2 3h4l2-3h4"/></>,
  book: <><path d="M2 4h7a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-7a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h8z"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  chevron: <path d="m7 10 5 5 5-5"/>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></>,
  arrow: <><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  clock: <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
  spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z"/><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14z"/></>
}

export function Icon({ name, size = 18, className = '' }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.dashboard}</svg>
}

export function MetricCard({ label, value, detail, icon = 'dashboard', tone = 'maroon', loading = false }) {
  return <article className={`dash-metric dash-metric-${tone}`}><div className="dash-metric-top"><span className="dash-metric-icon"><Icon name={icon} size={20} /></span><span className="dash-trend"><span className="dash-trend-dot" />{detail || 'Current overview'}</span></div><div className="dash-metric-value">{loading ? '...' : (value ?? '—')}</div><div className="dash-metric-label">{label}</div></article>
}

export function DashboardPanel({ title, eyebrow, action, children, className = '' }) {
  return <section className={`dash-panel ${className}`}><header className="dash-panel-header"><div>{eyebrow && <span className="dash-panel-eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{action}</header><div className="dash-panel-content">{children}</div></section>
}

export function EmptyState({ title = 'All caught up!', detail = 'There is nothing that needs your attention right now.', icon = 'check' }) {
  return <div className="dash-empty"><span className="dash-empty-icon"><Icon name={icon} size={21} /></span><strong>{title}</strong><p>{detail}</p></div>
}

export function initialsFor(user) {
  return (user?.full_name || user?.username || 'User').trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()
}

export function roleLabelFor(user) {
  const labels = { 1: 'System Admin', 2: 'Grade Chairperson', 3: 'Master Teacher', 4: 'Teacher' }
  return labels[Number(user?.role_id)] || user?.role_name || 'Staff'
}
