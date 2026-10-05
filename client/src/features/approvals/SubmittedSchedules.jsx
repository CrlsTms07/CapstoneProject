// HIPO 5.0 – Approvals
// Section schedules in the user's scope and where each one is in the flow
// (draft → pending → approved / rejected), from GET /api/approvals/submissions.
import React, { useEffect, useState } from 'react'
import StaffLayout from '../../components/StaffLayout'

const cell = { padding: 8, textAlign: 'left', borderBottom: '1px solid var(--border)' }
const STATUS_LABELS = { draft: 'Draft', pending: 'Pending admin approval', approved: 'Approved', rejected: 'Rejected · revise in the plotter' }

export default function SubmittedSchedules({ user }) {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    fetch('/api/approvals/submissions', { credentials: 'include' })
      .then(async response => {
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.error || 'Unable to load submissions.')
        if (mounted) setSubmissions(data)
      })
      .catch(loadError => { if (mounted) setError(loadError.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <StaffLayout user={user}>
      <div style={{ padding: 8 }}>
        <h1>Submitted Schedules</h1>
        <p>Every section schedule in your scope and its approval status.</p>
        {error && <div className="placeholder" role="alert">{error}</div>}
        {loading ? <div className="placeholder">Loading submitted schedules…</div> : submissions.length === 0 ? (
          <div className="placeholder">No section schedules yet. Start one in the Schedule Plotter.</div>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: 'var(--bg-2)' }}>{['Term', 'Grade / section', 'Status', 'Last action', 'Notes'].map(label => <th key={label} style={cell}>{label}</th>)}</tr></thead>
              <tbody>{submissions.map(item => (
                <tr key={`${item.term_id}-${item.section_id}`}>
                  <td style={cell}>{item.school_year} · {item.term_name}</td>
                  <td style={cell}>{item.grade_level_name} - {item.section_name}</td>
                  <td style={cell}><span className="dash-status">{STATUS_LABELS[item.status] || item.status}</span></td>
                  <td style={cell}>{item.last_action ? `${item.last_action} by ${item.performed_by_name}, ${new Date(item.last_action_at).toLocaleString()}` : '—'}</td>
                  <td style={cell}>{item.last_notes || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </StaffLayout>
  )
}
