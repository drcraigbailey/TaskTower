import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { useTaskTower } from './context/TaskTowerContext.jsx'
import { LoginPage, RegisterPage } from './pages/AuthPages.jsx'
import { ChoreDashboardPage, ChoreDetailsPage, ChoreEditorPage } from './pages/ChorePages.jsx'
import { HousePage, LeaderboardPage, NotificationsPage, TowerPage, WinnerPage } from './pages/HousePages.jsx'
import { AddHousePage, JoinHousePage, MainMenuPage } from './pages/MenuPages.jsx'
import { GameSettingsPage, PersonalSettingsPage, SharedSettingsPage } from './pages/SettingsPages.jsx'

function StartPage() {
  const { activeHouse, user } = useTaskTower()
  const justLoggedIn = sessionStorage.getItem('tasktower.justLoggedIn')
  if (justLoggedIn) {
    sessionStorage.removeItem('tasktower.justLoggedIn')
    return <Navigate to="/menu" replace />
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
      <Route path="/menu" element={<MainMenuPage />} />
      <Route path="/house/new" element={<AddHousePage />} />
      <Route path="/house/join" element={<JoinHousePage />} />
      <Route path="/settings" element={<PersonalSettingsPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/house/:houseId" element={<HousePage />} />
      <Route path="/house/:houseId/chores" element={<ChoreDashboardPage />} />
      <Route path="/house/:houseId/chores/new" element={<ChoreEditorPage />} />
      <Route path="/house/:houseId/chores/:choreId" element={<ChoreDetailsPage />} />
      <Route path="/house/:houseId/chores/:choreId/edit" element={<ChoreEditorPage />} />
      <Route path="/house/:houseId/tower" element={<TowerPage />} />
      <Route path="/house/:houseId/leaderboard" element={<LeaderboardPage />} />
      <Route path="/house/:houseId/settings" element={<SharedSettingsPage />} />
      <Route path="/house/:houseId/settings/game" element={<GameSettingsPage />} />
      <Route path="/house/:houseId/winner" element={<WinnerPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
