import type { CommentItem, ModelDetail, ModelSummary, OrderDetail, OrderStatus, OrderSummary, PageResult, UserProfile } from '@/types/api'

const demoUser: UserProfile = {
  id: 'user-demo', name: '演示用户', company: '示例工作室', email: 'demo@example.com',
  bio: '用于本地开发的公开演示账号。', modelCount: 1, favoriteCount: 0, followingCount: 0,
  phone: '000 0000 0000', avatarSeed: 1
}

export const mockCreators: UserProfile[] = [demoUser]
export const mockCurrentUser = demoUser
export const mockModels: ModelSummary[] = [{
  id: 'model-demo', title: '示例模型 001', description: '用于本地开发的公开演示模型。', ownerId: demoUser.id,
  ownerName: demoUser.name, favoriteCount: 0, commentCount: 0, isFavorite: false, visibility: 'public',
  status: 'ready', viewerAvailable: true, colorSeed: 0, createdAt: new Date(Date.UTC(2026, 7, 24)).toISOString()
}]
export const mockOrders: OrderSummary[] = [{
  id: 'order-demo', modelId: 'model-demo', modelTitle: '示例模型 001', description: '本地开发演示订单',
  status: 'completed', modelStatus: 'ready', viewerAvailable: true, progress: 100, paidAmount: 0,
  createdAt: new Date(Date.UTC(2026, 7, 24, 9)).toISOString(), updatedAt: new Date(Date.UTC(2026, 7, 24, 10)).toISOString()
}]

export function paginate<T>(items: T[], page: number, pageSize: number): PageResult<T> {
  const safePageSize = Math.max(1, Math.min(pageSize, 50))
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize))
  const safePage = Math.max(1, Math.min(page, totalPages))
  const start = (safePage - 1) * safePageSize
  return { items: items.slice(start, start + safePageSize), page: safePage, pageSize: safePageSize, total: items.length, totalPages, hasNext: safePage < totalPages }
}

export function mockModelDetail(id: string): ModelDetail {
  const item = mockModels.find((model) => model.id === id) ?? mockModels[0]
  return { ...item, viewCount: 0, sourceVideoDuration: 0 }
}

export function mockOrderDetail(id: string): OrderDetail {
  const item = mockOrders.find((order) => order.id === id) ?? mockOrders[0]
  return { ...item, contactEmail: 'demo@example.com', originalAmount: item.paidAmount, discountAmount: 0, isPublic: true }
}

export function mockComments(modelId: string): CommentItem[] {
  return [{ id: `comment-${modelId}-demo`, modelId, userId: demoUser.id, userName: demoUser.name, content: '公开演示评论。', likeCount: 0, createdAt: new Date(Date.UTC(2026, 7, 24)).toISOString() }]
}

export async function mockDelay<T>(value: T, delay = 0): Promise<T> {
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
  return value
}
