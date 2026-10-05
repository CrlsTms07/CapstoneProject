import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/login.css'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState(() => localStorage.getItem('rememberedSchoolEmail') || '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const navigate = useNavigate()

  const doLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password, remember })
      })

      if (!res.ok) {
        const d = await res.json().catch(() => null)
        setError(d && d.error ? d.error : 'Login failed')
        setLoading(false)
        return
      }

      const d = await res.json()
      if (d.user?.must_change_password) {
        if (onLogin) onLogin(d.user)
        navigate('/change-password-required', { replace: true })
        return
      }
      if (remember) localStorage.setItem('rememberedSchoolEmail', email)
      else localStorage.removeItem('rememberedSchoolEmail')
      setSuccess('Login successful. Redirecting...')
      setTimeout(() => {
        if (onLogin) onLogin(d.user)
        navigate('/')
      }, 700)
    } catch (err) {
      setError('Login error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-root login-page">
      <div className="auth-shell" role="main">
        <div className="login-card">
        <div className="login-top">
          <h2>Welcome Back</h2>
          <p className="login-sub">Sign in to your account</p>
        </div>

        {error && <div className="login-error" role="alert">{error}</div>}
        {success && <div className="login-success" role="status">{success}</div>}

        <form className="login-form" onSubmit={doLogin}>
          <label className="login-label" htmlFor="login-email">School email address</label>
          <input
            id="login-email"
            className="login-input"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <label className="login-label" htmlFor="login-password">Password</label>
          <div className="login-password-row">
            <input
              id="login-password"
              className="login-input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button type="button" className="show-btn" onClick={() => setShowPassword(s => !s)} aria-label="Toggle password">
              <span aria-hidden="true">👁</span>
            </button>
          </div>

          <div className="login-row">
            <label className="remember">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Remember me
            </label>
            <a className="forgot" href="/forgot">Forgot password?</a>
          </div>

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="login-footer">
          Don't have an account? <a href="/signup">Sign up</a>
          <a className="guest-btn" href="/">Continue as Guest</a>
        </div>
        </div>
        <div className="brand-panel" aria-label="School branding">
          <img className="brand-logo" src="https://vote.ercihs.edu.ph/ERCIHS%20LOGO.png" alt="ERCIHS Logo" />
          <div className="brand-copy">
            <span className="brand-eyebrow">Academic Personnel Governance</span>
            <p>Secure <span>•</span> Efficient <span>•</span> Reliable</p>
            <small>EMMANUEL RESURRECCION CONGRESSIONAL INTEGRATED HIGH SCHOOL</small>
          </div>
        </div>
      </div>
    </div>
  )
}
