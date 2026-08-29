import Taro from '@tarojs/taro'
import type { ApiEnvelope } from '@/types/api'

declare const __API_BASE_URL__: string

export const API_BASE_URL = __API_BASE_URL__
export const hasBackend = API_BASE_URL.length > 0

export interface RequestOptions<TBody> {
  path: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  data?: TBody
  header?: Record<string, string>
}

export async function apiRequest<TResponse, TBody = Record<string, unknown>>(
  options: RequestOptions<TBody>
): Promise<TResponse> {
  if (!hasBackend) throw new Error('API_BASE_URL_NOT_CONFIGURED')
  const token = Taro.getStorageSync<string>('accessToken')
  const response = await Taro.request<ApiEnvelope<TResponse>>({
    url: API_BASE_URL + options.path,
    method: options.method ?? 'GET',
    data: options.data,
    timeout: 15000,
    header: {
      'content-type': 'application/json',
      ...(token ? { authorization: 'Bearer ' + token } : {}),
      ...options.header
    }
  })
  if (response.statusCode < 200 || response.statusCode >= 300) throw new Error('HTTP_' + response.statusCode)
  if (response.data.code !== 0) throw new Error(response.data.message || 'API_ERROR')
  return response.data.data
}
