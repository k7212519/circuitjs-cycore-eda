const TOKEN_KEYS = ['eda_token'] as const
export type AccessMode = 'authenticated' | 'guest'

export function getToken(): string | null {
  for (const key of TOKEN_KEYS) {
    const token = sessionStorage.getItem(key) || localStorage.getItem(key)
    if (token?.trim()) return token.trim()
  }
  return null
}

export function clearAuthentication(): void {
  for (const key of ['eda_token', 'eda_user', 'eda_user_info', 'userId']) {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  }
  sessionStorage.removeItem('authenticated')
}

export function loginUrl(): string {
  return import.meta.env.VITE_LOGIN_URL
    || (import.meta.env.DEV ? '/circuit-engine/login.html' : '/circuit/login.html')
}

export function activationUrl(): string {
  return import.meta.env.VITE_ACTIVATION_URL
    || (import.meta.env.DEV ? '/circuit-engine/activate.html' : '/circuit/activate.html')
}

async function importDevelopmentTokenFromCircuitJs(): Promise<void> {
  if (!import.meta.env.DEV || getToken() || !window.opener) return

  const opener = window.opener
  const configuredOrigin = import.meta.env.VITE_CIRCUITJS_DEV_ORIGIN
    || `${window.location.protocol}//${window.location.hostname}:8000`
  const expectedOrigin = new URL(configuredOrigin, window.location.href).origin

  await new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      window.removeEventListener('message', receiveToken)
      window.clearTimeout(timeout)
      resolve()
    }
    const receiveToken = (event: MessageEvent) => {
      if (event.origin !== expectedOrigin
        || event.source !== opener
        || event.data?.type !== 'cycore-breadboard-auth-response') return
      if (typeof event.data.token === 'string' && event.data.token.trim()) {
        sessionStorage.setItem('eda_token', event.data.token.trim())
      }
      finish()
    }
    const timeout = window.setTimeout(finish, 1200)
    window.addEventListener('message', receiveToken)
    opener.postMessage({ type: 'cycore-breadboard-auth-request' }, expectedOrigin)
  })
}

function enterGuestMode(): AccessMode {
  sessionStorage.setItem('authenticated', 'true')
  sessionStorage.setItem('offline_mode', 'true')
  sessionStorage.removeItem('redirect_after_login')
  return 'guest'
}

export async function ensureAuthenticated(): Promise<AccessMode> {
  if (import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH_BYPASS === 'true') {
    return enterGuestMode()
  }
  await importDevelopmentTokenFromCircuitJs()
  const token = getToken()
  if (!token) return enterGuestMode()

  const base = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '/api' : 'https://api-eda.cycore.com.cn')
  let response: Response
  try {
    response = await fetch(`${base}/eda/login/validate`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    return enterGuestMode()
  }
  if (response.status === 401) {
    clearAuthentication()
    return enterGuestMode()
  }
  const result = await response.json() as { code?: number; data?: { productAccess?: { status?: string } } }
  if (!response.ok || result.code !== 200) {
    clearAuthentication()
    return enterGuestMode()
  }
  if (result.data?.productAccess?.status !== 'ACTIVE') {
    window.location.assign(activationUrl())
    throw new Error('ACTIVATION_REDIRECT')
  }
  sessionStorage.setItem('authenticated', 'true')
  sessionStorage.removeItem('offline_mode')
  sessionStorage.removeItem('redirect_after_login')
  return 'authenticated'
}
