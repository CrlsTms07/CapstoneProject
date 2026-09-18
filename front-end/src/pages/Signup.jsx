import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/login.css'

export default function Signup() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('')
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const r = await fetch('/api/roles/public')
        if (!r.ok) return
        const data = await r.json()
        setRoles(data)
        if (data && data.length > 0) setRole(data[0].role_id)
      } catch (err) {}
    }
    fetchRoles()
  }, [])

  const doSignup = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role_id: role })
      })

      if (!res.ok) {
        const d = await res.json().catch(() => null)
        setError(d && d.error ? d.error : 'Signup failed')
        setLoading(false)
        return
      }

      const d = await res.json().catch(() => null)
      // If backend returned a session user, navigate to dashboard
      if (d && d.user && d.user.role_id) {
        // Redirect to appropriate dashboard route
        switch (Number(d.user.role_id)) {
          case 1:
            navigate('/admin')
            break
          case 2:
            navigate('/chair')
            break
          case 3:
            navigate('/master-teacher')
            break
          case 4:
            navigate('/teacher')
            break
          default:
            navigate('/')
        }
        return
      }

      // Otherwise created but pending
      setError('Account created and pending admin approval')
    } catch (err) {
      setError('Signup error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-root signup-page">
      <div className="auth-shell" role="main">
        <div className="brand-panel" aria-label="ERCIHS Vote">
          <img className="brand-logo" src="https://vote.ercihs.edu.ph/ERCIHS%20LOGO.png" alt="ERCIHS Logo" />
          <div className="brand-copy">
            <span className="brand-eyebrow">Learner Government Commission</span>
            <h1>ERCIHS Vote</h1>
            <p>Secure <span>•</span> Transparent <span>•</span> Reliable</p>
            <small>EMMANUEL RESURRECCION CONGRESSIONAL INTEGRATED HIGH SCHOOL</small>
          </div>
        </div>
        <div className="login-card">
        <div className="login-top">
          <div className="login-kicker">ERCIHS Vote</div>
          <h2>Create Account</h2>
          <p className="login-sub">Register for an account</p>
        </div>

        {error && <div className="login-error" role="alert">{error}</div>}

        <form className="login-form" onSubmit={doSignup}>
          <label className="login-label">Username</label>
          <input className="login-input" value={username} onChange={e => setUsername(e.target.value)} required />

          <label className="login-label">Password</label>
          <input className="login-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />

          <label className="login-label">Role</label>
          <select className="login-input" value={role || ''} onChange={e => setRole(e.target.value)}>
            {roles.map(r => (
              <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
            ))}
          </select>

          <button className="login-btn" type="submit" disabled={loading}>{loading ? 'Signing up...' : 'Sign Up'}</button>
        </form>

        <div className="login-footer">Already have an account? <a href="/login">Sign in</a></div>
        </div>
      </div>
    </div>
  )
}
