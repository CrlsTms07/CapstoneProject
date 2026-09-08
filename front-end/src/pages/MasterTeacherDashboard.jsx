import React from 'react'
import StaffLayout from '../components/StaffLayout'

export default function MasterTeacherDashboard({ user }) {
  if (!user) return <div>Please login as Master Teacher.</div>

  return (
    <StaffLayout user={user}>
      <div style={{ padding: 8 }}>
        <h1>Master Teacher Dashboard</h1>
        <p>Welcome, {user.username}</p>
      </div>
    </StaffLayout>
  )
}
