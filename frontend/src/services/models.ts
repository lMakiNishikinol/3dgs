import type {
  CommentItem, ModelDetail, ModelSummary, PageQuery, PageResult, UserProfile
} from '@/types/api'
import { apiRequest, hasBackend } from './request'
import { mockComments, mockCreators, mockCurrentUser, mockDelay, mockModelDetail, mockModels, paginate } from './mockData'

export interface ModelListQuery extends PageQuery {
  keyword?: string
  ownerId?: string
  favoriteBy?: string
  sort?: 'latest' | 'popular'
}

export async function fetchModels(query: ModelListQuery): Promise<PageResult<ModelSummary>> {
  if (hasBackend) {
    const params = new URLSearchParams()
    params.set('page', String(query.page))
    params.set('pageSize', String(query.pageSize))
    if (query.keyword) params.set('keyword', query.keyword)
    if (query.ownerId) params.set('ownerId', query.ownerId)
    if (query.favoriteBy) params.set('favoriteBy', query.favoriteBy)
    if (query.sort) params.set('sort', query.sort)
    return apiRequest<PageResult<ModelSummary>>({ path: `/v1/models?${params.toString()}` })
  }
  const keyword = query.keyword?.trim().toLowerCase()
  let items = mockModels.filter((model) => {
    const matchesKeyword = !keyword || model.title.toLowerCase().includes(keyword)
    const matchesOwner = !query.ownerId || model.ownerId === query.ownerId
    const matchesFavorite = !query.favoriteBy || model.isFavorite
    return matchesKeyword && matchesOwner && matchesFavorite
  })
  if (query.sort === 'popular') items = [...items].sort((a, b) => b.favoriteCount - a.favoriteCount)
  return mockDelay(paginate(items, query.page, query.pageSize))
}

export async function fetchModelDetail(id: string): Promise<ModelDetail> {
  if (hasBackend) return apiRequest<ModelDetail>({ path: `/v1/models/${encodeURIComponent(id)}` })
  return mockDelay(mockModelDetail(id))
}

export async function fetchComments(modelId: string, query: PageQuery): Promise<PageResult<CommentItem>> {
  if (hasBackend) {
    return apiRequest<PageResult<CommentItem>>({
      path: `/v1/models/${encodeURIComponent(modelId)}/comments?page=${query.page}&pageSize=${query.pageSize}`
    })
  }
  return mockDelay(paginate(mockComments(modelId), query.page, query.pageSize))
}

export async function fetchUserProfile(userId: string): Promise<UserProfile> {
  if (hasBackend) return apiRequest<UserProfile>({ path: `/v1/users/${encodeURIComponent(userId)}` })
  if (userId === 'user-current') return mockDelay(mockCurrentUser)
  return mockDelay(mockCreators.find((creator) => creator.id === userId) ?? mockCreators[0])
}

