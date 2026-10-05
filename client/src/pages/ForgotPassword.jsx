import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import '../styles/login.css'

export default function ForgotPassword() {
  const [employeeIdentifier, setEmployeeIdentifier] = useState('')
  const [reason, setReason] = useState('Forgotten Password')
  const [contactNumber, setContactNumber] = useState('')
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const submitRequest = async (event) => {
    event.preventDefault()
    setMessage(null)
    setError(null)
    setLoading(true)
    try {
      const response = await fetch('/api/password-reset-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_identifier: employeeIdentifier, reason, contact_number: contactNumber })
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setError(data?.error || 'Unable to submit the request.')
        return
      }
      setMessage(data?.message || 'Your account recovery request has been submitted.')
    } catch {
      setError('Unable to submit your request. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-root">
      <div className="login-card recovery-card">
        <div className="login-top">
          <div className="login-kicker">FACULTY / STAFF SYSTEM</div>
          <h2>Account Recovery Request</h2>
          <p className="login-sub">Submit a request to the System Administrator to reset your faculty account access.</p>
        </div>
        {error && <div className="login-error" role="alert">{error}</div>}
        {message && <div className="login-success" role="status">{message}</div>}
        <form className="login-form" onSubmit={submitRequest}>
          <label className="login-label" htmlFor="recovery-identifier">Employee ID / Official Email Address</label>
          <input id="recovery-identifier" className="login-input" value={employeeIdentifier} onChange={event => setEmployeeIdentifier(event.target.value)} autoComplete="username" required />

          <label className="login-label" htmlFor="recovery-reason">Reason for Request</label>
          <select id="recovery-reason" className="login-input" value={reason} onChange={event => setReason(event.target.value)} required>
            <option>Forgotten Password</option>
            <option>Account Locked / Suspicious Activity</option>
            <option>Other</option>
          </select>

          <label className="login-label" htmlFor="recovery-contact">Contact / Mobile Number</label>
          <input id="recovery-contact" className="login-input" type="tel" value={contactNumber} onChange={event => setContactNumber(event.target.value)} autoComplete="tel" maxLength={40} required />
          <button className="login-btn" type="submit" disabled={loading}>{loading ? 'Submitting...' : 'Submit Request to Administrator'}</button>
        </form>
        <p className="recovery-note">Note: Your request will be reviewed by the System Administrator. You will receive an email notification once your temporary credentials or request status is updated.</p>
        <div className="login-footer"><Link to="/login">Return to Sign In</Link></div>
      </div>
    </div>
  )
}
