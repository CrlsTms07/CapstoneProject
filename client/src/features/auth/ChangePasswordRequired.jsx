// HIPO 2.0 – Login (account recovery)
// Forces a new password after signing in with a temporary password.
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './login.css'

export default function ChangePasswordRequired({ onPasswordChanged }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPassword, confirm_password: confirmPassword })
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setError(data?.error || 'Unable to change password.')
        return
      }
      onPasswordChanged?.()
      navigate('/')
    } catch {
      setError('Unable to change your password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-root">
      <div className="login-card recovery-card">
        <div className="login-top">
          <div className="login-kicker">ACCOUNT SECURITY</div>
          <h2>Change Password Required</h2>
          <p className="login-sub">Set a new password before continuing to the faculty portal.</p>
        </div>
        {error && <div className="login-error" role="alert">{error}</div>}
        {error?.includes('expired') && <p className="login-footer"><Link to="/forgot">Submit a new account recovery request</Link></p>}
        <form className="login-form" onSubmit={submit}>
          <label className="login-label" htmlFor="new-password">New Password</label>
          <input id="new-password" className="login-input" type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} required />
          <p className="password-hint">At least 8 characters, with an uppercase letter, a number, and a special character.</p>
          <label className="login-label" htmlFor="confirm-password">Confirm New Password</label>
          <input id="confirm-password" className="login-input" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required />
          <button className="login-btn" type="submit" disabled={loading}>{loading ? 'Updating...' : 'Change Password'}</button>
        </form>
      </div>
    </div>
  )
}
