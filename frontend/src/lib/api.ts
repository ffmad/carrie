import type { CarrieTurnRequest, CarrieTurnResponse } from '../types'

/** Thin fetch wrapper for the backend. Vite proxies /api to http://localhost:3050 in dev. */
const BASE = '/api'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(BASE + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(0, 'The Carrie backend is not reachable')
  }
  if (!response.ok) {
    throw new ApiError(response.status, `Request to ${path} failed (${response.status})`)
  }
  return (await response.json()) as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
}

export const getHealth = () => api.get<{ ok: boolean; carrie: 'claude' | 'script'; live?: string | null }>('/health')

export const carrieTurn = (body: CarrieTurnRequest) => api.post<CarrieTurnResponse>('/carrie/turn', body)

/** Facts from Rose's latest words, worked out beside a GPT-Live call (a turn response without `reply`). */
export const carrieFacts = (body: CarrieTurnRequest) => api.post<Omit<CarrieTurnResponse, 'reply'>>('/carrie/facts', body)
