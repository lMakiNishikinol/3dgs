import type {
  CommentItem, ModelDetail, ModelSummary, PageQuery, PageResult, UserProfile
} from '@/types/api'
import { apiRequest } from './request'

export interface ModelListQuery extends PageQuery {
  keyword?: string
  ownerId?: string
  favoriteBy?: string
  sort?: 'latest' | 'popular'
}

export async function fetchModels(query: ModelListQuery): Promise<PageResult<ModelSummary>> {
  const params = new URLSearchParams()
  params.set('page', String(query.page))
  params.set('pageSize', String(query.pageSize))
  if (query.keyword) params.set('keyword', query.keyword)
  if (query.ownerId) params.set('ownerId', query.ownerId)
  if (query.favoriteBy) params.set('favoriteBy', query.favoriteBy)
  if (query.sort) params.set('sort', query.sort)
  return apiRequest<PageResult<ModelSummary>>({ path: `/v1/models?${params.toString()}` })
}

export async function fetchModelDetail(id: string): Promise<ModelDetail> {
  return apiRequest<ModelDetail>({ path: `/v1/models/${encodeURIComponent(id)}` })
}

export async function fetchComments(modelId: string, query: PageQuery): Promise<PageResult<CommentItem>> {
  return apiRequest<PageResult<CommentItem>>({
    path: `/v1/models/${encodeURIComponent(modelId)}/comments?page=${query.page}&pageSize=${query.pageSize}`
  })
}

export async function fetchUserProfile(userId: string): Promise<UserProfile> {
  const path = userId === 'user-current' ? '/v1/users/me' : `/v1/users/${encodeURIComponent(userId)}`
  return apiRequest<UserProfile>({ path })
}

export interface FavoriteResult {
  favorited: boolean
  favoriteCount: number
}

export async function setModelFavorite(modelId: string, favorite: boolean): Promise<FavoriteResult> {
  return apiRequest<FavoriteResult>({
    path: `/v1/models/${encodeURIComponent(modelId)}/favorite`,
    method: favorite ? 'PUT' : 'DELETE'
  })
}

export async function createComment(modelId: string, content: string): Promise<CommentItem> {
  return apiRequest<CommentItem, { content: string }>({
    path: `/v1/models/${encodeURIComponent(modelId)}/comments`,
    method: 'POST',
    data: { content },
    header: { 'Idempotency-Key': `comment-${Date.now()}` }
  })
}

export async function setCommentLike(commentId: string, liked: boolean): Promise<CommentItem> {
  return apiRequest<CommentItem>({
    path: `/v1/comments/${encodeURIComponent(commentId)}/like`,
    method: liked ? 'PUT' : 'DELETE'
  })
}
