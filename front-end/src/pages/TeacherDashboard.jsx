import React from 'react'
import StaffLayout from '../components/StaffLayout'

export default function TeacherDashboard({ user }) {
  if (!user) return <div>Please login as Teacher.</div>

  return (
    <StaffLayout user={user}>
      <div style={{ padding: 8 }}>
        <h1>Teacher Dashboard</h1>
        <p>Welcome, {user.username}</p>
        <p>This view is read-only for schedule/profile.</p>
      </div>
    </StaffLayout>
  )
}
