import Taro from '@tarojs/taro'
import type { ApiEnvelope } from '@/types/api'
import type { ApiProblemBody } from '@/types/backend'

declare const __API_BASE_URL__: string

export class ApiProblem extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly fields: ApiProblemBody['errors'] = []
  ) {
    super(message)
    this.name = 'ApiProblem'
  }
}

export interface ContractRequestOptions<TBody> {
  path: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  data?: TBody
  header?: Record<string, string>
  authenticated?: boolean
}

export async function contractRequest<TResponse, TBody = Record<string, unknown>>(
  options: ContractRequestOptions<TBody>
): Promise<TResponse> {
  if (!__API_BASE_URL__) throw new ApiProblem(0, 'API_BASE_URL_NOT_CONFIGURED', '后端 API 地址未配置')
  const token = Taro.getStorageSync<string>('accessToken')
  const response = await Taro.request<ApiEnvelope<TResponse> | ApiProblemBody>({
    url: __API_BASE_URL__.replace(/\/$/, '') + options.path,
    method: options.method ?? 'GET',
    data: options.data,
    timeout: 15000,
    header: {
      'content-type': 'application/json',
      ...(options.authenticated === false || !token ? {} : { authorization: 'Bearer ' + token }),
      ...options.header
    }
  })
  if (response.statusCode === 204) return undefined as TResponse
  if (response.statusCode < 200 || response.statusCode >= 300) {
    const problem = response.data as ApiProblemBody
    throw new ApiProblem(response.statusCode, String(problem?.code || `HTTP_${response.statusCode}`), problem?.message || problem?.detail || problem?.title || '请求失败', problem?.requestId, problem?.errors)
  }
  const envelope = response.data as ApiEnvelope<TResponse>
  if (envelope.code !== 0) throw new ApiProblem(response.statusCode, 'API_ERROR', envelope.message || '请求失败', envelope.requestId)
  return envelope.data
}

export function queryString<T extends object>(values: T) {
  const pairs = Object.entries(values as Record<string, string | number | boolean | Array<string | number | boolean> | undefined>)
    .filter((entry) => entry[1] !== undefined)
    .flatMap(([key, value]) => (Array.isArray(value) ? value : [value]).map((item) =>
      `${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`
    ))
  return pairs.length ? '?' + pairs.join('&') : ''
}
