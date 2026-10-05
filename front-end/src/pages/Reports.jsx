import React from 'react'
import StaffLayout from '../components/StaffLayout'

export default function Reports({ user }) {
  return (
    <StaffLayout user={user}>
      <div style={{ padding: 8 }}>
        <h1>Reports</h1>
        <p>Generate and view system reports for S.Y. 2026-2027</p>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="panel">
            <h3>Schedule Summary Report</h3>
            <div className="panel-body"><span className="placeholder">Report generation coming soon.</span></div>
          </div>
          <div className="panel">
            <h3>Teacher Workload Report</h3>
            <div className="panel-body"><span className="placeholder">Report generation coming soon.</span></div>
          </div>
          <div className="panel">
            <h3>Room Utilization Report</h3>
            <div className="panel-body"><span className="placeholder">Report generation coming soon.</span></div>
          </div>
        </div>
      </div>
    </StaffLayout>
  )
}
