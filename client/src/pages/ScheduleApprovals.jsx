import React, { useEffect, useState } from 'react'
import StaffLayout from '../components/StaffLayout'

export default function ScheduleApprovals({ user }) {
  const [approvals, setApprovals] = useState([])
  const [classPrograms, setClassPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewingProgram, setReviewingProgram] = useState(null)

  useEffect(() => {
    let mounted = true
    const fetchApprovals = async () => {
      try {
        const [res, programsRes] = await Promise.all([
          fetch('/api/schedule-approvals', { credentials: 'include' }),
          fetch('/api/class-programs/pending', { credentials: 'include' })
        ])
        if (res.ok) {
          const data = await res.json()
          if (mounted) setApprovals(Array.isArray(data) ? data : (data.rows || []))
        }
        if (programsRes.ok) {
          const programs = await programsRes.json()
          if (mounted) setClassPrograms(Array.isArray(programs) ? programs : [])
        }
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchApprovals()
    return () => { mounted = false }
  }, [])

  const reviewClassProgram = async (program, decision) => {
    setReviewingProgram(program.program_id)
    try {
      const response = await fetch(`/api/class-programs/${program.program_id}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ decision })
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Unable to review class program.')
      setClassPrograms(items => items.filter(item => item.program_id !== program.program_id))
    } catch (error) {
      window.alert(error.message || 'Unable to review class program.')
    } finally {
      setReviewingProgram(null)
    }
  }

  return (
    <StaffLayout user={user}>
      <div style={{ padding: 8 }}>
        <h1>Schedule Approvals</h1>
        <p>Review and approve schedule submissions for S.Y. 2026-2027</p>
        {loading ? <div className="placeholder">Loading approvals…</div> : (
          <div style={{ marginTop: 16 }}>
            <p>{approvals.length} approval record(s) found.</p>
            {approvals.length === 0 ? (
              <div className="placeholder">No approval records.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-2)' }}>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>ID</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Status</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {approvals.map(a => (
                    <tr key={a.approval_id || a.id}>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{a.approval_id || a.id}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{a.status || 'Pending'}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
                        <button className="action-btn" onClick={async () => {
                          try {
                            const res = await fetch(`/api/schedule-approvals/${a.approval_id || a.id}`, {
                              method: 'PUT', credentials: 'include'
                            })
                            if (res.ok) {
                              setApprovals(list => list.map(x => x.approval_id === (a.approval_id || a.id) ? { ...x, status: 'Approved' } : x))
                            }
                          } catch (e) { /* ignore */ }
                        }}>Approve</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        <section style={{ marginTop: 28 }}>
          <h2>JHS Class Programs</h2>
          <p>Grade 7–10 programs submitted by grade chairpersons.</p>
          {classPrograms.length === 0 ? <div className="placeholder">No JHS class programs are pending approval.</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                <thead><tr style={{ background: 'var(--bg-2)' }}>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Grade / Section</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid var(--border)' }}>School Year</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Entries</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Status</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Decision</th>
                </tr></thead>
                <tbody>{classPrograms.map(program => <tr key={program.program_id}>
                  <td style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>{program.grade_level_name} · {program.section_name}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>{program.school_year}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>{program.entries.length} periods</td>
                  <td style={{ padding: 8, borderBottom: '1px solid var(--border)' }}><span className="dash-status">Pending Admin Approval</span></td>
                  <td style={{ padding: 8, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    <button className="action-btn primary" disabled={reviewingProgram === program.program_id} onClick={() => reviewClassProgram(program, 'approved')}>{reviewingProgram === program.program_id ? 'Saving…' : 'Approve'}</button>
                    <button className="action-btn" disabled={reviewingProgram === program.program_id} onClick={() => reviewClassProgram(program, 'rejected')} style={{ marginLeft: 6, color: '#a91d2b' }}>Reject</button>
                  </td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </StaffLayout>
  )
}
