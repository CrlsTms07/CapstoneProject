// HIPO 4.2 – Rooms & Buildings
// Rooms & Buildings page: manage buildings and their rooms.
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StaffLayout from '../../components/StaffLayout'
import '../../styles/adminDashboard.css'

export default function Rooms({ user }) {
  const [rooms, setRooms] = useState([])
  const [buildings, setBuildings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showRoomForm, setShowRoomForm] = useState(false)
  const [showBuildingForm, setShowBuildingForm] = useState(false)
  const [editingRoom, setEditingRoom] = useState(null)
  const [editingBuilding, setEditingBuilding] = useState(null)
  const [roomForm, setRoomForm] = useState({ building_id: '', room_number: '' })
  const [buildingForm, setBuildingForm] = useState({ building_name: '', department_id: '' })
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    const fetchData = async () => {
      try {
        const [roomsRes, buildingsRes] = await Promise.all([
          fetch('/api/rooms', { credentials: 'include' }),
          fetch('/api/buildings', { credentials: 'include' })
        ])
        if (roomsRes.ok) {
          const data = await roomsRes.json()
          if (mounted) setRooms(Array.isArray(data) ? data : (data.rows || []))
        }
        if (buildingsRes.ok) {
          const data = await buildingsRes.json()
          if (mounted) setBuildings(Array.isArray(data) ? data : (data.rows || []))
        }
      } catch (e) { /* ignore */ }
      finally { if (mounted) setLoading(false) }
    }
    fetchData()
    return () => { mounted = false }
  }, [])

  const handleRoomSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const body = { building_id: Number(roomForm.building_id), room_number: roomForm.room_number }
      const url = editingRoom ? `/api/rooms/${editingRoom}` : '/api/rooms'
      const method = editingRoom ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json().catch(() => null); throw new Error(d && d.error ? d.error : 'Operation failed') }
      const data = await res.json()
      setShowRoomForm(false)
      setEditingRoom(null)
      setRoomForm({ building_id: '', room_number: '' })
      setRooms(list => editingRoom ? list.map(r => r.room_id === editingRoom ? data : r) : [...list, data])
    } catch (err) { setError(err.message) }
  }

  const handleBuildingSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const body = { building_name: buildingForm.building_name, department_id: Number(buildingForm.department_id) }
      const url = editingBuilding ? `/api/buildings/${editingBuilding}` : '/api/buildings'
      const method = editingBuilding ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json().catch(() => null); throw new Error(d && d.error ? d.error : 'Operation failed') }
      const data = await res.json()
      setShowBuildingForm(false)
      setEditingBuilding(null)
      setBuildingForm({ building_name: '', department_id: '' })
      setBuildings(list => editingBuilding ? list.map(b => b.building_id === editingBuilding ? data : b) : [...list, data])
    } catch (err) { setError(err.message) }
  }

  const handleDeleteRoom = async (id) => {
    if (!window.confirm('Delete this room?')) return
    try {
      const res = await fetch(`/api/rooms/${id}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) setRooms(list => list.filter(r => r.room_id !== id))
      else { const d = await res.json().catch(() => null); alert(d && d.error ? d.error : 'Delete failed') }
    } catch (err) { alert('Delete failed') }
  }

  const handleDeleteBuilding = async (id) => {
    if (!window.confirm('Delete this building?')) return
    try {
      const res = await fetch(`/api/buildings/${id}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) setBuildings(list => list.filter(b => b.building_id !== id))
      else { const d = await res.json().catch(() => null); alert(d && d.error ? d.error : 'Delete failed') }
    } catch (err) { alert('Delete failed') }
  }

  const openEditRoom = (r) => {
    setEditingRoom(r.room_id)
    setRoomForm({ building_id: String(r.building_id), room_number: r.room_number })
    setShowRoomForm(true)
  }

  const openEditBuilding = (b) => {
    setEditingBuilding(b.building_id)
    setBuildingForm({ building_name: b.building_name, department_id: String(b.department_id ?? '') })
    setShowBuildingForm(true)
  }

  return (
    <StaffLayout user={user}>
      <div style={{ padding: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1>Rooms & Buildings</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="action-btn primary" onClick={() => { setEditingRoom(null); setRoomForm({ building_id: '', room_number: '' }); setShowRoomForm(true) }}>+ Add Room</button>
            <button className="action-btn" onClick={() => { setEditingBuilding(null); setBuildingForm({ building_name: '', department_id: '' }); setShowBuildingForm(true) }}>+ Add Building</button>
          </div>
        </div>
        {showRoomForm && (
          <form onSubmit={handleRoomSubmit} style={{ background: 'var(--card-bg)', padding: 16, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3>{editingRoom ? 'Edit Room' : 'Add Room'}</h3>
            {error && <div className="login-error" style={{ margin: 0 }}>{error}</div>}
            <input className="login-input" placeholder="Building ID" type="number" value={roomForm.building_id} onChange={e => setRoomForm({ ...roomForm, building_id: e.target.value })} required />
            <input className="login-input" placeholder="Room Number" value={roomForm.room_number} onChange={e => setRoomForm({ ...roomForm, room_number: e.target.value })} required />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="action-btn primary">{editingRoom ? 'Update' : 'Add'}</button>
              <button type="button" className="action-btn" onClick={() => { setShowRoomForm(false); setEditingRoom(null); setError(null) }}>Cancel</button>
            </div>
          </form>
        )}
        {showBuildingForm && (
          <form onSubmit={handleBuildingSubmit} style={{ background: 'var(--card-bg)', padding: 16, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3>{editingBuilding ? 'Edit Building' : 'Add Building'}</h3>
            {error && <div className="login-error" style={{ margin: 0 }}>{error}</div>}
            <input className="login-input" placeholder="Building Name" value={buildingForm.building_name} onChange={e => setBuildingForm({ ...buildingForm, building_name: e.target.value })} required />
            <input className="login-input" placeholder="Department ID" type="number" value={buildingForm.department_id} onChange={e => setBuildingForm({ ...buildingForm, department_id: e.target.value })} required />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="action-btn primary">{editingBuilding ? 'Update' : 'Add'}</button>
              <button type="button" className="action-btn" onClick={() => { setShowBuildingForm(false); setEditingBuilding(null); setError(null) }}>Cancel</button>
            </div>
          </form>
        )}
        {loading ? <div className="placeholder">Loading…</div> : (
          <div>
            <h3 style={{ marginBottom: 8 }}>Buildings ({buildings.length})</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
              <thead>
                <tr style={{ background: 'var(--bg-2)' }}>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Building</th>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Dept ID</th>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {buildings.map(b => (
                  <tr key={b.building_id}>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{b.building_name}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{b.department_id ?? '—'}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
                      <button className="action-btn" onClick={() => openEditBuilding(b)} style={{ marginRight: 6 }}>Edit</button>
                      <button className="action-btn" onClick={() => handleDeleteBuilding(b.building_id)} style={{ color: '#a91d2b', borderColor: 'rgba(169,29,43,0.2)' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 style={{ marginBottom: 8 }}>Rooms ({rooms.length})</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-2)' }}>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Room Number</th>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Building ID</th>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map(r => (
                  <tr key={r.room_id}>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{r.room_number}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{r.building_id ?? '—'}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
                      <button className="action-btn" onClick={() => openEditRoom(r)} style={{ marginRight: 6 }}>Edit</button>
                      <button className="action-btn" onClick={() => handleDeleteRoom(r.room_id)} style={{ color: '#a91d2b', borderColor: 'rgba(169,29,43,0.2)' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </StaffLayout>
  )
}
