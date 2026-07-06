export function getAuthRedirectUrl() {
  const configuredUrl = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim()
  const url = configuredUrl || (typeof window !== 'undefined' ? window.location.origin : '')
  if (!url) return undefined
  return url.endsWith('/') ? url : `${url}/`
}
