import React from 'react'
import Sidebar from './Sidebar'
import '../styles/staffLayout.css'

export default function StaffLayout({ user, children }) {
  return (
    <div className="ss-root">
      <Sidebar user={user} />
      <main className="ss-main">
        <div className="ss-content">
          {children}
        </div>
      </main>
    </div>
  )
}
