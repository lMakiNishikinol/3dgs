import type { OrderDetail, OrderStatus, OrderSummary, PageQuery, PageResult } from '@/types/api'
import { apiRequest, hasBackend } from './request'
import { mockDelay, mockOrderDetail, mockOrders, paginate } from './mockData'

export interface OrderListQuery extends PageQuery {
  keyword?: string
  status?: OrderStatus
}

export async function fetchOrders(query: OrderListQuery): Promise<PageResult<OrderSummary>> {
  if (hasBackend) {
    const params = new URLSearchParams()
    params.set('page', String(query.page))
    params.set('pageSize', String(query.pageSize))
    if (query.keyword) params.set('keyword', query.keyword)
    if (query.status) params.set('status', query.status)
    return apiRequest<PageResult<OrderSummary>>({ path: `/v1/orders?${params.toString()}` })
  }
  const keyword = query.keyword?.trim().toLowerCase()
  const items = mockOrders.filter((order) => {
    const matchesKeyword = !keyword || order.id.toLowerCase().includes(keyword) || order.modelTitle.toLowerCase().includes(keyword) || order.description.toLowerCase().includes(keyword)
    return matchesKeyword && (!query.status || order.status === query.status)
  })
  return mockDelay(paginate(items, query.page, query.pageSize))
}

export async function fetchOrderDetail(orderId: string): Promise<OrderDetail> {
  if (hasBackend) return apiRequest<OrderDetail>({ path: `/v1/orders/${encodeURIComponent(orderId)}` })
  return mockDelay(mockOrderDetail(orderId))
}

