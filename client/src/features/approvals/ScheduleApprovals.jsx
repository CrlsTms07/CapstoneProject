// HIPO 5.0 – Approvals
// Review queue: section weeks submitted for approval (GET /api/approvals/submissions?status=pending).
// The admin approves or rejects each one (POST /api/approvals/review); every action is in approval_logs.
import React, { useEffect, useState } from 'react'
import StaffLayout from '../../components/StaffLayout'

const cell = { padding: 8, textAlign: 'left', borderBottom: '1px solid var(--border)' }
const formatDate = value => value ? new Date(value).toLocaleString() : '—'
const ACTION_LABELS = { submitted: 'submitted', approved: 'approved', rejected: 'rejected' }

// Log rows are per entry; one action on one section shares the same time, so group them for display.
const groupLogs = logs => {
  const groups = new Map()
  logs.forEach(log => {
    const key = `${log.created_at}-${log.section_id}-${log.action}`
    const group = groups.get(key) || { ...log, entry_count: 0 }
    group.entry_count += 1
    groups.set(key, group)
  })
  return [...groups.values()]
}

export default function ScheduleApprovals({ user }) {
  const isAdmin = Number(user?.role_id) === 1
  const [submissions, setSubmissions] = useState([])
  const [logs, setLogs] = useState([])
  const [notes, setNotes] = useState({})
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState(null)
  const [message, setMessage] = useState('')

  const load = async () => {
    try {
      const [queue, history] = await Promise.all([
        fetch('/api/approvals/submissions?status=pending', { credentials: 'include' }).then(response => response.ok ? response.json() : []),
        fetch('/api/approvals/logs', { credentials: 'include' }).then(response => response.ok ? response.json() : [])
      ])
      setSubmissions(queue)
      setLogs(groupLogs(history).slice(0, 20))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const keyOf = submission => `${submission.term_id}-${submission.section_id}`

  const review = async (submission, decision) => {
    setReviewing(keyOf(submission))
    setMessage('')
    try {
      const response = await fetch('/api/approvals/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ term_id: submission.term_id, section_id: submission.section_id, decision, notes: notes[keyOf(submission)] || '' })
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Unable to review this schedule.')
      setMessage(`${submission.grade_level_name} - ${submission.section_name}: ${decision}.`)
      await load()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setReviewing(null)
    }
  }

  return (
    <StaffLayout user={user}>
      <div style={{ padding: 8 }}>
        <h1>Schedule Approvals</h1>
        <p>Section schedules submitted by grade level chairpersons and master teachers.{!isAdmin && ' Only the administrator can approve or reject them.'}</p>
        {message && <div className="placeholder" role="status">{message}</div>}
        {loading ? <div className="placeholder">Loading submissions…</div> : submissions.length === 0
          ? <div className="placeholder">No schedules are waiting for approval.</div>
          : submissions.map(submission => (
            <section key={keyOf(submission)} style={{ marginTop: 20, border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
              <h2 style={{ margin: 0 }}>{submission.grade_level_name} - {submission.section_name}</h2>
              <p style={{ margin: '4px 0 8px' }}>{submission.school_year} · {submission.term_name} · submitted by {submission.performed_by_name} on {formatDate(submission.last_action_at)}{submission.last_notes ? ` · “${submission.last_notes}”` : ''}</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: 'var(--bg-2)' }}>{['Day', 'Time', 'Subject / activity', 'Teacher', 'Room'].map(label => <th key={label} style={cell}>{label}</th>)}</tr></thead>
                  <tbody>{submission.entries.map(entry => (
                    <tr key={entry.entry_id}>
                      <td style={cell}>{entry.day_of_week}</td>
                      <td style={cell}>{entry.start_time}–{entry.end_time}</td>
                      <td style={cell}>{entry.subject_name || entry.activity}</td>
                      <td style={cell}>{entry.teacher_name || '—'}</td>
                      <td style={cell}>{entry.room_number ? `${entry.building_name} · ${entry.room_number}` : '—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {isAdmin && (
                <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                  <textarea aria-label="Review notes" placeholder="Notes (required when rejecting)" rows={2} value={notes[keyOf(submission)] || ''} onChange={event => setNotes(current => ({ ...current, [keyOf(submission)]: event.target.value }))} />
                  <div>
                    <button className="action-btn primary" disabled={reviewing === keyOf(submission)} onClick={() => review(submission, 'approved')}>{reviewing === keyOf(submission) ? 'Saving…' : 'Approve'}</button>
                    <button className="action-btn" disabled={reviewing === keyOf(submission)} onClick={() => review(submission, 'rejected')} style={{ marginLeft: 6, color: '#a91d2b' }}>Reject</button>
                  </div>
                </div>
              )}
            </section>
          ))}

        <section style={{ marginTop: 28 }}>
          <h2>Recent activity</h2>
          {logs.length === 0 ? <div className="placeholder">No approval activity yet.</div> : (
            <ul>{logs.map(log => (
              <li key={`${log.created_at}-${log.section_id}-${log.action}`}>
                {formatDate(log.created_at)} · <strong>{log.performed_by_name}</strong> {ACTION_LABELS[log.action]} {log.grade_level_name} - {log.section_name} ({log.entry_count} entries){log.notes ? ` · “${log.notes}”` : ''}
              </li>
            ))}</ul>
          )}
        </section>
      </div>
    </StaffLayout>
  )
}
