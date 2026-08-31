import Taro from '@tarojs/taro'
import type { ApiEnvelope } from '@/types/api'

declare const __API_BASE_URL__: string

export const API_BASE_URL = __API_BASE_URL__

export interface RequestOptions<TBody> {
  path: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  data?: TBody
  header?: Record<string, string>
}

export async function apiRequest<TResponse, TBody = Record<string, unknown>>(
  options: RequestOptions<TBody>
): Promise<TResponse> {
  if (!API_BASE_URL) throw new Error('后端 API 地址未配置，请设置 TARO_APP_API_BASE_URL 后重新构建')
  const token = Taro.getStorageSync<string>('accessToken')
  const response = await Taro.request<ApiEnvelope<TResponse>>({
    url: API_BASE_URL.replace(/\/$/, '') + options.path,
    method: options.method ?? 'GET',
    data: options.data,
    timeout: 15000,
    header: {
      'content-type': 'application/json',
      ...(token ? { authorization: 'Bearer ' + token } : {}),
      ...options.header
    }
  })
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(response.data?.message || 'HTTP_' + response.statusCode)
  }
  if (response.data.code !== 0) throw new Error(response.data.message || 'API_ERROR')
  return response.data.data
}
