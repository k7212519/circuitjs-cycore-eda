import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loginUrl, requireCloudToken } from './auth'
import { projectApi } from './api'

function createStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key) },
    setItem: (key, value) => { values.set(key, String(value)) },
  }
}

describe('cloud authentication on demand', () => {
  const assign = vi.fn()
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    assign.mockClear()
    vi.stubGlobal('localStorage', createStorage())
    vi.stubGlobal('sessionStorage', createStorage())
    vi.stubGlobal('window', { location: {
      origin: 'https://sim.cycore.com.cn',
      href: 'https://sim.cycore.com.cn/circuit/breadboard/', assign,
    } })
  })

  it('does not perform a separate token validation request', async () => {
    localStorage.setItem('eda_token', 'existing-token')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(requireCloudToken()).resolves.toBe('existing-token')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('authenticated')).toBeNull()
  })

  it('requires login only when a guest requests cloud data and preserves drafts', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    localStorage.setItem('cycore_breadboard_draft_v1', 'draft')
    await expect(projectApi.list()).rejects.toThrow('请登录')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(assign).toHaveBeenCalledWith(loginUrl())
    expect(sessionStorage.getItem('redirect_after_login')).toBe(window.location.href)
    expect(localStorage.getItem('cycore_breadboard_draft_v1')).toBe('draft')
  })

  it.each([401, 200])('redirects expired credentials for HTTP %s', async status => {
    localStorage.setItem('eda_token', 'expired')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 401 }), { status }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(projectApi.list()).rejects.toThrow('请登录')
    expect(localStorage.getItem('eda_token')).toBeNull()
    expect(assign).toHaveBeenCalledWith(loginUrl())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cache: 'no-store' }))
  })

  it('does not treat a network outage as expired login', async () => {
    localStorage.setItem('eda_token', 'existing')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(projectApi.list()).rejects.toThrow('Failed to fetch')
    expect(assign).not.toHaveBeenCalled()
    expect(localStorage.getItem('eda_token')).toBe('existing')
  })

  it('resolves a relative configured login path from the circuit root', () => {
    vi.stubEnv('VITE_LOGIN_URL', 'login.html')
    expect(loginUrl()).not.toContain('/breadboard/login.html')
    expect(loginUrl()).toMatch(/\/(circuit|circuit-engine)\/login.html$/)
  })
})
