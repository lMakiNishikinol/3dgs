import type { PageQuery, PageResult } from '@/types/api'
import { apiRequest } from './request'

export interface NotificationItem {
  id: string
  title: string
  createdAt: string
  read: boolean
}

export async function fetchNotifications(query: PageQuery): Promise<PageResult<NotificationItem>> {
  return apiRequest<PageResult<NotificationItem>>({
    path: `/v1/notifications?page=${query.page}&pageSize=${query.pageSize}`
  })
}
