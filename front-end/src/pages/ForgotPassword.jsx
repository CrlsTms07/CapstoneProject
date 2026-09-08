import React, { useState } from 'react'
import '../styles/login.css'

export default function ForgotPassword() {
  const [step, setStep] = useState(1)
  const [username, setUsername] = useState('')
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  const sendRequest = async (e) => {
    e.preventDefault()
    setMessage(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      })
      const d = await res.json().catch(() => null)
      setMessage(d && d.message ? d.message : 'If account exists, an email was sent.')
      setStep(2)
    } catch (err) {
      setMessage('Request failed')
    } finally { setLoading(false) }
  }

  const doReset = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, token, new_password: newPassword })
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) setMessage(d && d.error ? d.error : 'Reset failed')
      else setMessage(d && d.message ? d.message : 'Password updated')
    } catch (err) {
      setMessage('Reset failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="login-root">
      <div className="login-card">
        <div className="login-top">
          <div className="login-icon">🔐</div>
          <h2>Forgot Password</h2>
          <p className="login-sub">Reset your account password</p>
        </div>

        {message && <div className="login-error">{message}</div>}

        {step === 1 && (
          <form className="login-form" onSubmit={sendRequest}>
            <label className="login-label">Username</label>
            <input className="login-input" value={username} onChange={e => setUsername(e.target.value)} required />
            <button className="login-btn" type="submit" disabled={loading}>{loading ? 'Sending...' : 'Send Reset Token'}</button>
          </form>
        )}

        {step === 2 && (
          <form className="login-form" onSubmit={doReset}>
            <label className="login-label">Reset Token</label>
            <input className="login-input" value={token} onChange={e => setToken(e.target.value)} required />
            <label className="login-label">New password</label>
            <input className="login-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
            <button className="login-btn" type="submit" disabled={loading}>{loading ? 'Updating...' : 'Update Password'}</button>
          </form>
        )}

      </div>
    </div>
  )
}
