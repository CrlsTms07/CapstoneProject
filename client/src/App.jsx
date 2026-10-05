import React, { useEffect, useState } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import AdminDashboard from './pages/AdminDashboard'
import ChairDashboard from './pages/ChairDashboard'
import MasterTeacherDashboard from './pages/MasterTeacherDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import PublicView from './pages/PublicView'
import Login from './features/auth/Login'
import Signup from './features/auth/Signup'
import ForgotPassword from './features/auth/ForgotPassword'
import ChangePasswordRequired from './features/auth/ChangePasswordRequired'
import SchedulePlotter from './pages/SchedulePlotter'
import Teachers from './features/teachers/Teachers'
import Sections from './pages/Sections'
import Subjects from './pages/Subjects'
import Rooms from './pages/Rooms'
import Users from './features/users/Users'
import Reports from './pages/Reports'
import ScheduleApprovals from './pages/ScheduleApprovals'
import SubmittedSchedules from './pages/SubmittedSchedules'

function App() {
  const [user, setUser] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()

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
    // Route new sessions from public entry pages, but preserve requested workspace pages.
    if (!user) return

    if (user.must_change_password) {
      navigate('/change-password-required')
      return
    }

    if (!['/', '/login', '/signup'].includes(location.pathname)) return

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
  }, [user, location.pathname, navigate])

  return (
    <Routes>
      <Route path="/" element={<PublicView />} />
      <Route path="/login" element={<Login onLogin={setUser} />} />
      <Route path="/signup" element={<Signup onLogin={setUser} />} />
      <Route path="/forgot" element={<ForgotPassword />} />
      <Route path="/change-password-required" element={<ChangePasswordRequired onPasswordChanged={() => setUser(current => current ? { ...current, must_change_password: false } : current)} />} />
      <Route path="/admin" element={<AdminDashboard user={user} />} />
      <Route path="/chair" element={<ChairDashboard user={user} />} />
      <Route path="/master-teacher" element={<MasterTeacherDashboard user={user} />} />
      <Route path="/teacher" element={<TeacherDashboard user={user} />} />
      <Route path="/plot-schedule" element={<SchedulePlotter user={user} />} />
      <Route path="/teachers" element={<Teachers user={user} />} />
      <Route path="/sections" element={<Sections user={user} />} />
      <Route path="/subjects" element={<Subjects user={user} />} />
      <Route path="/rooms" element={<Rooms user={user} />} />
      <Route path="/users" element={<Users user={user} />} />
      <Route path="/reports" element={<Reports user={user} />} />
      <Route path="/schedule-approvals" element={<ScheduleApprovals user={user} />} />
      <Route path="/submitted-schedules" element={<SubmittedSchedules user={user} />} />
    </Routes>
  )
}

export default App
