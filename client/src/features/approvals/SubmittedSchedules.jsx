// HIPO 5.0 – Approvals
// Lists schedules submitted for review (chair / master teacher view).
import React, { useEffect, useState } from 'react'
import StaffLayout from '../../components/StaffLayout'

export default function SubmittedSchedules({ user }) {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const fetchSchedules = async () => {
      try {
        const res = await fetch('/api/schedules', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          if (mounted) setSchedules(Array.isArray(data) ? data : (data.rows || []))
        }
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchSchedules()
    return () => { mounted = false }
  }, [])

  return (
    <StaffLayout user={user}>
      <div style={{ padding: 8 }}>
        <h1>Submitted Schedules</h1>
        <p>View submitted schedule requests for S.Y. 2026-2027</p>
        {loading ? <div className="placeholder">Loading submitted schedules…</div> : (
          <div style={{ marginTop: 16 }}>
            <p>{schedules.length} submitted schedule(s) found.</p>
            {schedules.length === 0 ? (
              <div className="placeholder">No submitted schedules.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-2)' }}>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Schedule ID</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Subject</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Teacher</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Room</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Day</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map(s => (
                    <tr key={s.schedule_id}>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{s.schedule_id}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{s.subject_name || s.subject || '—'}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{s.teacher_name || s.teacher_last_name || '—'}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{s.room_number || s.room_id || '—'}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{s.day_of_week || '—'}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{s.status || 'Pending'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </StaffLayout>
  )
}
