import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureAuthenticated } from './auth'

function createStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key) },
    setItem: (key, value) => { values.set(key, String(value)) },
  }
}

describe('breadboard access mode', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('localStorage', createStorage())
    vi.stubGlobal('sessionStorage', createStorage())
  })

  it('enters guest mode without a token instead of redirecting', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(ensureAuthenticated()).resolves.toBe('guest')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('authenticated')).toBe('true')
    expect(sessionStorage.getItem('offline_mode')).toBe('true')
  })

  it('enables cloud projects when an active token validates', async () => {
    sessionStorage.setItem('eda_token', 'valid-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 200,
      data: { productAccess: { status: 'ACTIVE' } },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    await expect(ensureAuthenticated()).resolves.toBe('authenticated')
    expect(sessionStorage.getItem('offline_mode')).toBeNull()
  })

  it('falls back to guest mode when a stored token is rejected', async () => {
    localStorage.setItem('eda_token', 'expired-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))

    await expect(ensureAuthenticated()).resolves.toBe('guest')
    expect(localStorage.getItem('eda_token')).toBeNull()
    expect(sessionStorage.getItem('offline_mode')).toBe('true')
  })
})
