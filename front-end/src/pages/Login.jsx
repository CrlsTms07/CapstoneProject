import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/login.css'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [roles, setRoles] = useState([])
  const [selectedRole, setSelectedRole] = useState(null)
  const navigate = useNavigate()

  const doLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role_id: selectedRole })
      })

      if (!res.ok) {
        const d = await res.json().catch(() => null)
        setError(d && d.error ? d.error : 'Login failed')
        setLoading(false)
        return
      }

      const d = await res.json()
      if (onLogin) onLogin(d.user)
      // role-based routing handled by App effect
      navigate('/')
    } catch (err) {
      setError('Login error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const r = await fetch('/api/roles/public')
        if (!r.ok) return
        const data = await r.json()
        setRoles(data)
        if (data && data.length > 0) setSelectedRole(data[0].role_id)
      } catch (err) {}
    }

    fetchRoles()
  }, [])

  return (
    <div className="login-root">
      <div className="login-card" role="main">
        <div className="login-top">
          <div className="login-icon">📘</div>
          <h2>Welcome Back</h2>
          <p className="login-sub">Sign in to your account</p>
        </div>

        {error && <div className="login-error" role="alert">{error}</div>}

        <form className="login-form" onSubmit={doLogin}>
          <label className="login-label">Username</label>
          <input
            className="login-input"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
            required
          />

          <label className="login-label">Password</label>
          <div className="login-password-row">
            <input
              className="login-input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button type="button" className="show-btn" onClick={() => setShowPassword(s => !s)} aria-label="Toggle password">
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          <label className="login-label">Role</label>
          <select className="login-input" value={selectedRole || ''} onChange={e => setSelectedRole(e.target.value)}>
            {roles.map(r => (
              <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
            ))}
          </select>

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
        </div>
      </div>
    </div>
  )
}
