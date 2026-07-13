import { Capacitor } from '@capacitor/core'
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { useTaskTower } from '../context/TaskTowerContext.jsx'

const ANDROID_BACK_GLOBAL = 'DwellioAndroidBack'

let nextBackActionId = 0
const backActions = []

const isAndroidNative = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

function runRegisteredBackAction() {
  const activeActions = [...backActions].sort((a, b) => b.priority - a.priority || b.id - a.id)
  for (const action of activeActions) {
    if (action.handler() !== false) return true
  }
  return false
}

function parentRouteFor(pathname, activeHouse) {
  const choreEditMatch = pathname.match(/^\/house\/([^/]+)\/chores\/([^/]+)\/edit$/)
  if (choreEditMatch) return `/house/${choreEditMatch[1]}/chores/${choreEditMatch[2]}`

  const choreDetailMatch = pathname.match(/^\/house\/([^/]+)\/chores\/([^/]+)$/)
  if (choreDetailMatch) return `/house/${choreDetailMatch[1]}/chores`

  const choreNewMatch = pathname.match(/^\/house\/([^/]+)\/chores\/new$/)
  if (choreNewMatch) return `/house/${choreNewMatch[1]}/chores`

  const houseSectionMatch = pathname.match(/^\/house\/([^/]+)\/(activity|chores|messages|settings|shopping)$/)
  if (houseSectionMatch) return `/house/${houseSectionMatch[1]}`

  if (pathname === '/house/new' || pathname === '/house/join') return '/menu'
  if (pathname === '/register') return '/login'
  if (pathname === '/notifications') return activeHouse?.id ? `/house/${activeHouse.id}` : '/menu'
  if (pathname === '/settings') return activeHouse?.id ? `/house/${activeHouse.id}/settings` : '/menu'

  return null
}

function isRootRoute(pathname) {
  return pathname === '/' || pathname === '/login' || pathname === '/menu' || /^\/house\/[^/]+$/.test(pathname)
}

export function useNativeBackAction(handler, active = true, priority = 10) {
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    if (!active) return undefined

    const action = {
      id: nextBackActionId += 1,
      priority,
      handler: () => handlerRef.current?.(),
    }
    backActions.push(action)

    return () => {
      const index = backActions.findIndex((item) => item.id === action.id)
      if (index >= 0) backActions.splice(index, 1)
    }
  }, [active, priority])
}

export function useAndroidNativeBackButton() {
  const location = useLocation()
  const navigate = useNavigate()
  const navigationType = useNavigationType()
  const { activeHouse } = useTaskTower()
  const routeStackRef = useRef([])
  const stateRef = useRef({ activeHouse, location, navigate })
  const handleBackRef = useRef(() => false)

  useEffect(() => {
    stateRef.current = { activeHouse, location, navigate }
  }, [activeHouse, location, navigate])

  useEffect(() => {
    const currentRoute = { key: location.key, pathname: location.pathname, search: location.search }
    const stack = routeStackRef.current
    const currentTopRoute = stack[stack.length - 1]

    if (currentTopRoute?.key === location.key) {
      stack[stack.length - 1] = currentRoute
      return
    }

    if (navigationType === 'REPLACE') {
      if (stack.length) stack[stack.length - 1] = currentRoute
      else stack.push(currentRoute)
      return
    }

    if (navigationType === 'POP') {
      const existingIndex = stack.findIndex((route) => route.key === location.key)
      if (existingIndex >= 0) stack.splice(existingIndex + 1)
      else stack.push(currentRoute)
      return
    }

    stack.push(currentRoute)
  }, [location.key, location.pathname, location.search, navigationType])

  handleBackRef.current = () => {
    if (runRegisteredBackAction()) return true

    const { activeHouse: latestHouse, location: latestLocation, navigate: latestNavigate } = stateRef.current
    if (isRootRoute(latestLocation.pathname)) return false

    const routeStack = routeStackRef.current
    if (routeStack.length > 1) {
      latestNavigate(-1)
      return true
    }

    const parentRoute = parentRouteFor(latestLocation.pathname, latestHouse)
    if (parentRoute) {
      latestNavigate(parentRoute, { replace: true })
      return true
    }

    return false
  }

  useEffect(() => {
    if (!isAndroidNative()) return undefined

    const previousBackBridge = window[ANDROID_BACK_GLOBAL]
    window[ANDROID_BACK_GLOBAL] = {
      handle: () => Boolean(handleBackRef.current?.()),
    }

    const handleNativeBackEvent = () => {
      handleBackRef.current?.()
    }
    window.addEventListener('dwellio:native-back', handleNativeBackEvent)

    return () => {
      window.removeEventListener('dwellio:native-back', handleNativeBackEvent)
      if (previousBackBridge) window[ANDROID_BACK_GLOBAL] = previousBackBridge
      else delete window[ANDROID_BACK_GLOBAL]
    }
  }, [])
}
