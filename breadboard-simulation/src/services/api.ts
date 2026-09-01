import { activationUrl, clearAuthentication, getToken, loginUrl } from './auth'
import type { BreadboardDocument } from '@/domain/types'

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '/api' : 'https://api-eda.cycore.com.cn')

interface ApiEnvelope<T> {
  code: number
  msg?: string
  message?: string
  errorCode?: string
  data: T
}

export interface ProjectSummary {
  projectId: number
  projectName: string
  schemaVersion: number
  createTime: string
  updateTime: string | null
}

export interface ProjectDetail extends ProjectSummary {
  projectData: BreadboardDocument
}

export interface ProjectPage {
  total: number
  records: ProjectSummary[]
  limit: number
  offset: number
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  const payload = await response.json().catch(() => ({})) as ApiEnvelope<T>
  if (response.status === 401) {
    clearAuthentication()
    window.location.assign(loginUrl())
    throw new Error('登录状态已失效')
  }
  if (response.status === 403 && ['PRODUCT_ACCESS_REQUIRED', 'PRODUCT_ACCESS_REVOKED'].includes(payload.errorCode ?? '')) {
    window.location.assign(activationUrl())
    throw new Error('当前账户没有 L1 使用权限')
  }
  if (!response.ok || payload.code !== 200) {
    throw new Error(payload.msg || payload.message || `请求失败 (${response.status})`)
  }
  return payload.data
}

export const projectApi = {
  list: (limit = 20, offset = 0) => request<ProjectPage>(`/cycore/breadboard/projects?limit=${limit}&offset=${offset}`),
  get: (projectId: number) => request<ProjectDetail>(`/cycore/breadboard/projects/${projectId}`),
  create: (projectName: string, projectData: BreadboardDocument) => request<ProjectDetail>('/cycore/breadboard/projects', {
    method: 'POST',
    body: JSON.stringify({ projectName, schemaVersion: projectData.schemaVersion, projectData }),
  }),
  update: (projectId: number, projectName: string, projectData: BreadboardDocument) => request<ProjectDetail>(`/cycore/breadboard/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify({ projectName, schemaVersion: projectData.schemaVersion, projectData }),
  }),
  remove: (projectId: number) => request<void>(`/cycore/breadboard/projects/${projectId}`, { method: 'DELETE' }),
}
