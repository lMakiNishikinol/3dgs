export interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
  requestId?: string
}
export interface PageQuery { page: number; pageSize: number }
export interface PageResult<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNext: boolean
}
export type ModelVisibility = 'public' | 'private'
export type ModelStatus = 'processing' | 'ready' | 'failed'
export interface ModelSummary {
  id: string
  title: string
  description: string
  ownerId: string
  ownerName: string
  favoriteCount: number
  commentCount: number
  isFavorite: boolean
  visibility: ModelVisibility
  status: ModelStatus
  viewerAvailable: boolean
  colorSeed: number
  createdAt: string
}
export interface ModelDetail extends ModelSummary {
  viewCount: number
  sourceVideoDuration: number
}
export interface CommentItem {
  id: string
  modelId: string
  userId: string
  userName: string
  content: string
  likeCount: number
  likedByMe: boolean
  createdAt: string
}
export type OrderStatus = 'pending_payment' | 'pending_production' | 'processing' | 'shipped' | 'completed' | 'cancelled' | 'refunded' | 'failed'
export interface OrderSummary {
  id: string
  modelId: string
  modelTitle: string
  description: string
  status: OrderStatus
  modelStatus: ModelStatus
  viewerAvailable: boolean
  progress: number
  paidAmount: number | null
  createdAt: string
  updatedAt: string
}
export interface OrderDetail extends OrderSummary {
  contactEmail: string
  originalAmount: number | null
  discountAmount: number | null
  paidAt: string | null
  deliveredAt: string | null
  isPublic: boolean
}
export interface UserProfile {
  id: string
  name: string
  company: string | null
  email?: string | null
  bio: string | null
  avatarUrl: string | null
  modelCount: number
  favoriteCount: number
  followingCount: number
  phone?: string
  avatarSeed?: number
}
