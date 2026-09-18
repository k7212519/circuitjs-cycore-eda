const TOKEN_KEYS = ['eda_token'] as const

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
  return new URL(import.meta.env.VITE_LOGIN_URL || 'login.html',
    new URL(import.meta.env.DEV ? '/circuit-engine/' : '/circuit/', window.location.origin)).href
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

// Simulation is public. Tokens are consulted only for user-triggered cloud actions.
export async function requireCloudToken(): Promise<string> {
  await importDevelopmentTokenFromCircuitJs()
  const token = getToken()
  if (!token) redirectToLogin()
  return token!
}

export function redirectToLogin(): never {
  clearAuthentication()
  sessionStorage.setItem('redirect_after_login', window.location.href)
  window.location.assign(loginUrl())
  throw new Error('请登录后使用云端项目')
}
