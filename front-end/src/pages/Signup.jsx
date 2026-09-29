import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/login.css'

export default function Signup({ onLogin }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [role, setRole] = useState('')
  const [roles, setRoles] = useState([])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await fetch('/api/roles/public')
        if (!response.ok) throw new Error('Unable to load roles')
        const data = await response.json()
        setRoles(data)
        if (data.length > 0) setRole(String(data[0].role_id))
      } catch (err) {
        setError('Unable to load signup roles. Please refresh and try again.')
      }
    }

    fetchRoles()
  }, [])

  const doSignup = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, email, school_id: schoolId, role_id: role, password, confirm_password: confirmPassword })
      })

      if (!res.ok) {
        const d = await res.json().catch(() => null)
        setError(d && d.error ? d.error : 'Signup failed')
        setLoading(false)
        return
      }

      const d = await res.json().catch(() => null)
      setSuccess('Account created successfully. Redirecting...')
      // If backend returned a session user, navigate to dashboard
      if (d && d.user && d.user.role_id) {
        setTimeout(() => {
          if (onLogin) onLogin(d.user)
          navigate('/')
        }, 700)
        return
      }

      // Otherwise created but pending
      setSuccess('Account created successfully. Your account is pending approval.')
    } catch (err) {
      setError('Signup error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-root signup-page">
      <div className="auth-shell" role="main">
        <div className="brand-panel" aria-label="School branding">
          <img className="brand-logo" src="https://vote.ercihs.edu.ph/ERCIHS%20LOGO.png" alt="ERCIHS Logo" />
          <div className="brand-copy">
            <span className="brand-eyebrow">Learner Government Commission</span>
            <p>Secure <span>•</span> Transparent <span>•</span> Reliable</p>
            <small>EMMANUEL RESURRECCION CONGRESSIONAL INTEGRATED HIGH SCHOOL</small>
          </div>
        </div>
        <div className="login-card">
        <div className="login-top">
          <h2>Create Account</h2>
          <p className="login-sub">Register for an account</p>
        </div>

        {error && <div className="login-error" role="alert">{error}</div>}
        {success && <div className="login-success" role="status">{success}</div>}

        <form className="login-form" onSubmit={doSignup}>
          <label className="login-label" htmlFor="signup-full-name">Full name</label>
          <input id="signup-full-name" className="login-input" value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" required />

          <label className="login-label" htmlFor="signup-email">School email address</label>
          <input id="signup-email" className="login-input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />

          <label className="login-label" htmlFor="signup-school-id">School ID number</label>
          <input id="signup-school-id" className="login-input" value={schoolId} onChange={e => setSchoolId(e.target.value)} required />

          <label className="login-label" htmlFor="signup-role">Role</label>
          <select id="signup-role" className="login-input" value={role} onChange={e => setRole(e.target.value)} required>
            <option value="" disabled>Select your role</option>
            {roles.map(item => (
              <option key={item.role_id} value={item.role_id}>{item.role_name}</option>
            ))}
          </select>

          <label className="login-label" htmlFor="signup-password">Password</label>
          <div className="login-password-row">
            <input id="signup-password" className="login-input" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required />
            <button type="button" className="show-btn" onClick={() => setShowPassword(s => !s)} aria-label="Toggle password visibility"><span aria-hidden="true">👁</span></button>
          </div>
          <p className="password-hint">At least 8 characters, 1 uppercase letter, 1 number, and 1 special character.</p>

          <label className="login-label" htmlFor="signup-confirm-password">Confirm password</label>
          <div className="login-password-row">
            <input id="signup-confirm-password" className="login-input" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" required />
            <button type="button" className="show-btn" onClick={() => setShowConfirmPassword(s => !s)} aria-label="Toggle confirm password visibility"><span aria-hidden="true">👁</span></button>
          </div>

          <button className="login-btn" type="submit" disabled={loading}>{loading ? 'Signing up...' : 'Sign Up'}</button>
        </form>

        <div className="login-footer">
          Already have an account? <a href="/login">Sign in</a>
          <a className="guest-btn" href="/">Continue as Guest</a>
        </div>
        </div>
      </div>
    </div>
  )
}
