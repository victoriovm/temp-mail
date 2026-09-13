const PASSWORD_STORAGE_KEY = "temp-mail:password"
const UNAUTHORIZED_EVENT = "temp-mail:unauthorized"

export function getStoredPassword() {
  if (typeof window === "undefined") return null

  return window.localStorage.getItem(PASSWORD_STORAGE_KEY)
}

export function storePassword(password: string) {
  window.localStorage.setItem(PASSWORD_STORAGE_KEY, password)
}

export function clearStoredPassword() {
  window.localStorage.removeItem(PASSWORD_STORAGE_KEY)
}

export function notifyUnauthorized() {
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
}

export function subscribeToUnauthorized(listener: () => void) {
  window.addEventListener(UNAUTHORIZED_EVENT, listener)

  return () => window.removeEventListener(UNAUTHORIZED_EVENT, listener)
}

export function withAuthHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers)
  const password = getStoredPassword()

  if (password) nextHeaders.set("Authorization", `Bearer ${password}`)

  return nextHeaders
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const response = await fetch(input, {
    ...init,
    headers: withAuthHeaders(init.headers),
  })

  if (response.status === 401) notifyUnauthorized()

  return response
}