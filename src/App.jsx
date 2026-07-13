import { useEffect, useLayoutEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import './App.css'
import './styles/dwellio-loader.css'
import orbitLoader from './assets/branding/dwellio-orbit-loader.svg'
import splashScreen from './assets/branding/dwellio-splash-original.png'
import { useTaskTower } from './context/TaskTowerContext.jsx'
import { useAndroidNativeBackButton } from './lib/nativeBack.js'
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

const ROUTE_TRANSITION_MS = 420
const STARTUP_LOADER_MS = 1450

function LoadingContent({ size = 180 }) {
  return (
    <div className="dwellio-loading__content">
      <img
        className="dwellio-loading__mark"
        src={orbitLoader}
        alt=""
        aria-hidden="true"
        style={{ '--dwellio-loader-size': `${size}px` }}
      />
    </div>
  )
}

function StartupSplash() {
  return (
    <div className="dwellio-startup-splash" role="status" aria-live="polite" aria-label="Loading Dwellio">
      <img src={splashScreen} alt="" aria-hidden="true" />
    </div>
  )
}

function RouteLoading({ label = 'Loading Dwellio', size = 180 }) {
  return (
    <div className="route-loading" role="status" aria-live="polite" aria-label={label}>
      <LoadingContent size={size} />
    </div>
  )
}

function StartPage() {
  const { activeHouse, authReady, householdsReady, user } = useTaskTower()
  if (!authReady || (user && !householdsReady)) return <RouteLoading label="Opening your household" />
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={activeHouse ? `/house/${activeHouse.id}` : '/menu'} replace />
}

function RequireAuth({ children }) {
  const { authReady, user } = useTaskTower()
  if (!authReady) return <RouteLoading label="Checking your account" />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicOnly({ children }) {
  const { authReady, user } = useTaskTower()
  if (!authReady) return <RouteLoading label="Preparing Dwellio" />
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

  if (!householdsReady) return <RouteLoading label="Opening your household" />
  if (!matchingHouse) return <Navigate to="/menu" replace />
  if (activeHouse?.id !== houseId) return <RouteLoading label="Opening this household" />
  return children
}

const protectedRoute = (element) => <RequireAuth>{element}</RequireAuth>
const householdRoute = (element) => protectedRoute(<RequireHouse>{element}</RequireHouse>)

function AppRoutes({ location }) {
  return (
    <Routes location={location}>
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

function App() {
  const location = useLocation()
  const [displayedLocation, setDisplayedLocation] = useState(location)
  const [transitioning, setTransitioning] = useState(false)
  const [showStartupLoader, setShowStartupLoader] = useState(true)
  useAndroidNativeBackButton()

  useEffect(() => {
    const timer = window.setTimeout(() => setShowStartupLoader(false), STARTUP_LOADER_MS)
    return () => window.clearTimeout(timer)
  }, [])

  useLayoutEffect(() => {
    if (location.key === displayedLocation.key) return undefined

    setTransitioning(true)
    const timer = window.setTimeout(() => {
      setDisplayedLocation(location)
      setTransitioning(false)
    }, ROUTE_TRANSITION_MS)

    return () => window.clearTimeout(timer)
  }, [displayedLocation.key, location])

  if (showStartupLoader) return <StartupSplash />
  if (transitioning) return <RouteLoading label="Loading page" />
  return <AppRoutes location={displayedLocation} />
}

export default App
