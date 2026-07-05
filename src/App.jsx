import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import './features/adultFeatures.css'
import './features/wiredExtras.css'
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

function StartPage() {
  const { activeHouse, user, authReady } = useTaskTower()
  if (!authReady) return <div className="app-shell"><section className="mobile-screen route-loading"><span className="route-loading__mark">D</span><p>Opening Dwellio…</p></section></div>
  const justLoggedIn = sessionStorage.getItem('tasktower.justLoggedIn')
  if (justLoggedIn) {
    sessionStorage.removeItem('tasktower.justLoggedIn')
    return <Navigate to={activeHouse ? `/house/${activeHouse.id}` : '/menu'} replace />
  }
  if (activeHouse) return <Navigate to={`/house/${activeHouse.id}`} replace />
  return <Navigate to={user ? '/menu' : '/login'} replace />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<StartPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/menu" element={<HouseholdHubPage />} />
      <Route path="/house/new" element={<AddHousePage />} />
      <Route path="/house/join" element={<JoinHousePage />} />
      <Route path="/settings" element={<AdultProfileSettingsPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/house/:houseId" element={<HouseholdDashboard />} />
      <Route path="/house/:houseId/chores" element={<ChoreDashboardPage />} />
      <Route path="/house/:houseId/chores/new" element={<ChoreEditorPage />} />
      <Route path="/house/:houseId/chores/:choreId" element={<ChoreDetailsPage />} />
      <Route path="/house/:houseId/chores/:choreId/edit" element={<ChoreEditorPage />} />
      <Route path="/house/:houseId/shopping" element={<ShoppingPage />} />
      <Route path="/house/:houseId/messages" element={<CommunicationPage />} />
      <Route path="/house/:houseId/activity" element={<ActivityPage />} />
      <Route path="/house/:houseId/settings" element={<AdultSettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
