import { useEffect } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import './App.css'
import { useTaskTower } from './context/TaskTowerContext.jsx'
import { LoginPage, RegisterPage } from './pages/AuthPages.jsx'
import { ChoreDashboardPage, ChoreDetailsPage, ChoreEditorPage } from './pages/ChorePages.jsx'
import NotificationsPage from './features/notifications/NotificationsPage.jsx'
import { AddHousePage, JoinHousePage } from './pages/MenuPages.jsx'
import HouseholdDashboard from './features/dashboard/HouseholdDashboard.jsx'
import ShoppingPage from './features/shopping/ShoppingPage.jsx'
import CommunicationPage from './features/communication/CommunicationPage.jsx'
import AdultSettingsPage, { AdultProfileSettingsPage } from './features/settings/AdultSettingsPage.jsx'
import HouseholdHubPage from './features/households/HouseholdHubPage.jsx'
import ActivityPage from './features/activity/ActivityPage.jsx'

function RouteLoading() {
  return <div className="route-loading" role="status"><span>Opening your household…</span></div>
}

function StartPage() {
  const { activeHouse, authReady, householdsReady, user } = useTaskTower()
  if (!authReady || (user && !householdsReady)) return <RouteLoading />
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={activeHouse ? `/house/${activeHouse.id}` : '/menu'} replace />
}

function RequireAuth({ children }) {
  const { authReady, user } = useTaskTower()
  if (!authReady) return <RouteLoading />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicOnly({ children }) {
  const { authReady, user } = useTaskTower()
  if (!authReady) return <RouteLoading />
  if (user) return <Navigate to="/" replace />
  return children
}

function RequireHouse({ children }) {
  const { houseId } = useParams()
  const { activeHouse, houses, householdsReady, selectHouse } = useTaskTower()
  const matchingHouse = houses.find((house) => house.id === houseId)

  useEffect(() => {
    if (matchingHouse && activeHouse?.id !== houseId) {
      selectHouse(houseId, { withHaptic: false }).catch(() => {})
    }
  }, [activeHouse?.id, houseId, matchingHouse, selectHouse])

  if (!householdsReady) return <RouteLoading />
  if (!matchingHouse) return <Navigate to="/menu" replace />
  if (activeHouse?.id !== houseId) return <RouteLoading />
  return children
}

const protectedRoute = (element) => <RequireAuth>{element}</RequireAuth>
const householdRoute = (element) => protectedRoute(<RequireHouse>{element}</RequireHouse>)

function App() {
  return (
    <Routes>
      <Route path="/" element={<StartPage />} />
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
      <Route path="/menu" element={protectedRoute(<HouseholdHubPage />)} />
      <Route path="/house/new" element={protectedRoute(<AddHousePage />)} />
      <Route path="/house/join" element={protectedRoute(<JoinHousePage />)} />
      <Route path="/settings" element={protectedRoute(<AdultProfileSettingsPage />)} />
      <Route path="/notifications" element={protectedRoute(<NotificationsPage />)} />
      <Route path="/house/:houseId" element={householdRoute(<HouseholdDashboard />)} />
      <Route path="/house/:houseId/chores" element={householdRoute(<ChoreDashboardPage />)} />
      <Route path="/house/:houseId/chores/new" element={householdRoute(<ChoreEditorPage />)} />
      <Route path="/house/:houseId/chores/:choreId" element={householdRoute(<ChoreDetailsPage />)} />
      <Route path="/house/:houseId/chores/:choreId/edit" element={householdRoute(<ChoreEditorPage />)} />
      <Route path="/house/:houseId/shopping" element={householdRoute(<ShoppingPage />)} />
      <Route path="/house/:houseId/messages" element={householdRoute(<CommunicationPage />)} />
      <Route path="/house/:houseId/activity" element={householdRoute(<ActivityPage />)} />
      <Route path="/house/:houseId/settings" element={householdRoute(<AdultSettingsPage />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
