import React, { useEffect, useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import AdminDashboard from './pages/AdminDashboard'
import ChairDashboard from './pages/ChairDashboard'
import MasterTeacherDashboard from './pages/MasterTeacherDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import PublicView from './pages/PublicView'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'

function App() {
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    // detect current user via session
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (!res.ok) {
          setUser(null)
          return
        }
        const data = await res.json()
        if (data && data.user) setUser(data.user)
      } catch (err) {
        setUser(null)
      }
    }

    fetchMe()
  }, [])

  useEffect(() => {
    // route to appropriate dashboard after user detection
    if (!user) return

    switch (user.role_id) {
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
  }, [user, navigate])

  return (
    <Routes>
      <Route path="/" element={<PublicView />} />
      <Route path="/login" element={<Login onLogin={setUser} />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot" element={<ForgotPassword />} />
      <Route path="/admin" element={<AdminDashboard user={user} />} />
      <Route path="/chair" element={<ChairDashboard user={user} />} />
      <Route path="/master-teacher" element={<MasterTeacherDashboard user={user} />} />
      <Route path="/teacher" element={<TeacherDashboard user={user} />} />
    </Routes>
  )
}

export default App
