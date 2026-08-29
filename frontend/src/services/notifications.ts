import type { PageQuery, PageResult } from '@/types/api'
import { apiRequest, hasBackend } from './request'
import { mockDelay, paginate } from './mock'

export interface NotificationItem {
  id: string
  title: string
  createdAt: string
  read: boolean
}

const mockNotifications: NotificationItem[] = Array.from({ length: 18 }, (_, index) => ({
  id: `notification-${index + 1}`,
  title: index % 3 === 0
    ? `模型“环绕作品 ${String(index + 1).padStart(2, '0')}”已完成重建`
    : index % 3 === 1
      ? `您的作品收到 ${index + 6} 个新收藏`
      : `订单 order-${String(index + 17).padStart(5, '0')} 正在处理中`,
  createdAt: new Date(Date.UTC(2026, 7, 24 - index, 9, 30)).toISOString(),
  read: index > 2
}))

export async function fetchNotifications(query: PageQuery): Promise<PageResult<NotificationItem>> {
  if (hasBackend) {
    return apiRequest<PageResult<NotificationItem>>({
      path: `/v1/notifications?page=${query.page}&pageSize=${query.pageSize}`
    })
  }
  return mockDelay(paginate(mockNotifications, query.page, query.pageSize))
}
