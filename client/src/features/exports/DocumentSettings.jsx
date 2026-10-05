// HIPO 7.0 – Export PDF/CSV
// Document Settings (admin only): the printed class-program header lines, signatories, DepEd Order
// references, doc ref code and revision of each department (GET / PUT /api/document-settings).
import React, { useEffect, useState } from 'react'
import StaffLayout from '../../components/StaffLayout'
import '../../styles/adminDashboard.css'

const MAX_SIGNATORIES = 8
const EMPTY_SIGNATORY = { label: '', name: '', position: '' }
const panel = { background: 'var(--card-bg)', padding: 16, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }
const fieldLabel = { display: 'flex', flexDirection: 'column', gap: 4 }

// Text area <-> list of lines (blank lines are dropped on save).
const toLines = text => text.split('\n').map(line => line.trim()).filter(Boolean)
const formFrom = settings => ({
  headerText: (settings.header_lines || []).join('\n'),
  signatories: (settings.signatories || []).map(item => ({ ...EMPTY_SIGNATORY, ...item })),
  ordersText: (settings.deped_orders || []).join('\n'),
  doc_ref_code: settings.doc_ref_code || '',
  revision: settings.revision || ''
})

export default function DocumentSettings({ user }) {
  const isAdmin = Number(user?.role_id) === 1
  const [departments, setDepartments] = useState([])
  const [departmentId, setDepartmentId] = useState('')
  const [form, setForm] = useState(null)
  const [updatedBy, setUpdatedBy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (!isAdmin) return undefined
    let mounted = true
    fetch('/api/departments', { credentials: 'include' })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (!mounted) return
        const list = Array.isArray(data) ? data : (data.rows || [])
        setDepartments(list)
        setDepartmentId(current => current || String(list[0]?.department_id || ''))
      })
      .catch(() => { if (mounted) setError('Unable to load the departments.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isAdmin])

  useEffect(() => {
    if (!isAdmin || !departmentId) return undefined
    let mounted = true
    setForm(null)
    setError(null)
    setMessage(null)
    fetch(`/api/document-settings/${departmentId}`, { credentials: 'include' })
      .then(async res => {
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error || 'Unable to load the document settings.')
        if (!mounted) return
        setForm(formFrom(data))
        setUpdatedBy(data.updated_at ? `${data.updated_by_name || 'Unknown'} · ${new Date(data.updated_at).toLocaleString('en-PH')}` : null)
      })
      .catch(loadError => { if (mounted) setError(loadError.message) })
    return () => { mounted = false }
  }, [isAdmin, departmentId])

  const updateSignatory = (index, field, value) => setForm(current => ({
    ...current, signatories: current.signatories.map((item, position) => position === index ? { ...item, [field]: value } : item)
  }))
  const moveSignatory = (index, amount) => setForm(current => {
    const target = index + amount
    if (target < 0 || target >= current.signatories.length) return current
    const signatories = [...current.signatories]
    ;[signatories[index], signatories[target]] = [signatories[target], signatories[index]]
    return { ...current, signatories }
  })

  const handleSubmit = async event => {
    event.preventDefault()
    setError(null)
    setMessage(null)
    if (form.signatories.some(item => !item.label.trim())) {
      setError('Every signatory needs a label, e.g. "Prepared by".')
      return
    }
    setSaving(true)
    try {
      const body = {
        header_lines: toLines(form.headerText),
        signatories: form.signatories,
        deped_orders: toLines(form.ordersText),
        doc_ref_code: form.doc_ref_code,
        revision: form.revision
      }
      const res = await fetch(`/api/document-settings/${departmentId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Saving failed.')
      setForm(formFrom(data))
      setUpdatedBy(`${data.updated_by_name || 'You'} · ${new Date(data.updated_at).toLocaleString('en-PH')}`)
      setMessage('Document settings saved.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin) {
    return <StaffLayout user={user}><div style={{ padding: 8 }}><h1>Document Settings</h1><div className="login-error">Only the administrator can edit document settings.</div></div></StaffLayout>
  }

  return (
    <StaffLayout user={user}>
      <div style={{ padding: 8, maxWidth: 900 }}>
        <h1>Document Settings</h1>
        <p style={{ marginBottom: 16 }}>What the printed class programs show for each department. Nothing here is hardcoded.</p>
        {loading && <div className="placeholder">Loading departments…</div>}
        {!loading && departments.length === 0 && <div className="placeholder">Add a department first.</div>}
        {departments.length > 0 && (
          <label style={{ ...fieldLabel, marginBottom: 16 }}>
            Department
            <select className="login-input" value={departmentId} onChange={event => setDepartmentId(event.target.value)}>
              {departments.map(department => <option key={department.department_id} value={String(department.department_id)}>{department.department_name}</option>)}
            </select>
          </label>
        )}
        {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}
        {message && <div className="placeholder" role="status" style={{ marginBottom: 12 }}>{message}</div>}
        {form && (
          <form onSubmit={handleSubmit}>
            <section style={panel}>
              <h3>Header</h3>
              <label style={fieldLabel}>
                Header lines (one per line, up to 10)
                <textarea className="login-input" rows={5} value={form.headerText} placeholder={'Republic of the Philippines\nDepartment of Education\nRegion IV-A CALABARZON'} onChange={event => setForm({ ...form, headerText: event.target.value })} />
              </label>
            </section>

            <section style={panel}>
              <h3>Signatories</h3>
              {form.signatories.length === 0 && <span>No signatories yet.</span>}
              {form.signatories.map((item, index) => (
                <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
                  <label style={{ ...fieldLabel, flex: '1 1 160px' }}>Label<input className="login-input" maxLength={60} value={item.label} placeholder="Prepared by" onChange={event => updateSignatory(index, 'label', event.target.value)} required /></label>
                  <label style={{ ...fieldLabel, flex: '2 1 200px' }}>Name<input className="login-input" maxLength={120} value={item.name} placeholder="Full name" onChange={event => updateSignatory(index, 'name', event.target.value)} /></label>
                  <label style={{ ...fieldLabel, flex: '2 1 200px' }}>Position<input className="login-input" maxLength={120} value={item.position} placeholder="Head Teacher III" onChange={event => updateSignatory(index, 'position', event.target.value)} /></label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button type="button" className="action-btn" aria-label={`Move signatory ${index + 1} up`} disabled={index === 0} onClick={() => moveSignatory(index, -1)}>↑</button>
                    <button type="button" className="action-btn" aria-label={`Move signatory ${index + 1} down`} disabled={index === form.signatories.length - 1} onClick={() => moveSignatory(index, 1)}>↓</button>
                    <button type="button" className="action-btn" aria-label={`Remove signatory ${index + 1}`} style={{ color: '#a91d2b' }} onClick={() => setForm({ ...form, signatories: form.signatories.filter((_, position) => position !== index) })}>×</button>
                  </div>
                </div>
              ))}
              <div>
                <button type="button" className="action-btn" disabled={form.signatories.length >= MAX_SIGNATORIES} onClick={() => setForm({ ...form, signatories: [...form.signatories, { ...EMPTY_SIGNATORY }] })}>+ Add signatory</button>
              </div>
            </section>

            <section style={panel}>
              <h3>References and document control</h3>
              <label style={fieldLabel}>
                DepEd Order references (one per line, up to 10)
                <textarea className="login-input" rows={3} value={form.ordersText} placeholder={'DO 10, s. 2024\nDO 12, s. 2024'} onChange={event => setForm({ ...form, ordersText: event.target.value })} />
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <label style={{ ...fieldLabel, flex: '2 1 200px' }}>Doc ref code<input className="login-input" maxLength={40} value={form.doc_ref_code} placeholder="SCH-OSH-F002" onChange={event => setForm({ ...form, doc_ref_code: event.target.value })} /></label>
                <label style={{ ...fieldLabel, flex: '1 1 100px' }}>Revision<input className="login-input" maxLength={10} value={form.revision} placeholder="00" onChange={event => setForm({ ...form, revision: event.target.value })} /></label>
              </div>
            </section>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button type="submit" className="action-btn primary" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
              {updatedBy && <small>Last saved by {updatedBy}</small>}
            </div>
          </form>
        )}
      </div>
    </StaffLayout>
  )
}
