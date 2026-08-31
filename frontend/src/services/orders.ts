import type { OrderDetail, OrderStatus, OrderSummary, PageQuery, PageResult } from '@/types/api'
import { apiRequest } from './request'

export interface OrderListQuery extends PageQuery {
  keyword?: string
  status?: OrderStatus | OrderStatus[]
}

export async function fetchOrders(query: OrderListQuery): Promise<PageResult<OrderSummary>> {
  const params = new URLSearchParams()
  params.set('page', String(query.page))
  params.set('pageSize', String(query.pageSize))
  if (query.keyword) params.set('keyword', query.keyword)
  const statuses = Array.isArray(query.status) ? query.status : query.status ? [query.status] : []
  statuses.forEach((status) => params.append('status', status))
  return apiRequest<PageResult<OrderSummary>>({ path: `/v1/orders?${params.toString()}` })
}

export async function fetchOrderDetail(orderId: string): Promise<OrderDetail> {
  return apiRequest<OrderDetail>({ path: `/v1/orders/${encodeURIComponent(orderId)}` })
}

export async function updateOrderVisibility(orderId: string, isPublic: boolean): Promise<OrderDetail> {
  return apiRequest<OrderDetail, { isPublic: boolean }>({
    path: `/v1/orders/${encodeURIComponent(orderId)}/visibility`,
    method: 'PATCH',
    data: { isPublic }
  })
}
