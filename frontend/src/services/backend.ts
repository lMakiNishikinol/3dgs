import Taro from '@tarojs/taro'
import type {
  AuthTokens, CommentContract, CommentPage, CompleteModelingUploadRequest, HomeData, ListModelQuery,
  ListOrderQuery, ListProductQuery, ModelingAccepted, ModelingJob, ModelDetail, ModelPage,
  NotificationContract, NotificationPage, OrderDetail, OrderPage, Payment, PaymentIntent, PreparedVideoUpload,
  PrivateUser, Product, ProductInput, ProductPage, PublicUser, SignedUploadPart, UploadRecord,
  ViewerAssetContract, Visibility
} from '@/types/backend'
import { contractRequest, queryString } from './contractRequest'

const idempotency = (key: string) => ({ 'Idempotency-Key': key })
const versionHeader = (version: number) => ({ 'If-Match': `"${version}"` })

export async function loginWithWechat(profile?: { name?: string; avatarUrl?: string }): Promise<AuthTokens> {
  const login = await Taro.login()
  const tokens = await contractRequest<AuthTokens, { code: string; profile?: typeof profile }>({
    path: '/v1/auth/wechat/login', method: 'POST', authenticated: false, data: { code: login.code, profile }
  })
  Taro.setStorageSync('accessToken', tokens.accessToken)
  Taro.setStorageSync('refreshToken', tokens.refreshToken)
  return tokens
}

export async function refreshAccessToken(): Promise<AuthTokens> {
  const refreshToken = Taro.getStorageSync<string>('refreshToken')
  const tokens = await contractRequest<AuthTokens, { refreshToken: string }>({
    path: '/v1/auth/refresh', method: 'POST', authenticated: false, data: { refreshToken }
  })
  Taro.setStorageSync('accessToken', tokens.accessToken)
  Taro.setStorageSync('refreshToken', tokens.refreshToken)
  return tokens
}

export async function logout(): Promise<void> {
  await contractRequest<void>({ path: '/v1/auth/logout', method: 'POST' })
  Taro.removeStorageSync('accessToken')
  Taro.removeStorageSync('refreshToken')
}

export const getHome = () => contractRequest<HomeData>({ path: '/v1/home' })
export const getCurrentUser = () => contractRequest<PrivateUser>({ path: '/v1/users/me' })
export const getPublicUser = (userId: string) => contractRequest<PublicUser>({ path: `/v1/users/${encodeURIComponent(userId)}` })
export const updateCurrentUser = (version: number, patch: Partial<Pick<PrivateUser, 'name' | 'company' | 'bio' | 'phone' | 'email'>>) =>
  contractRequest<PrivateUser, typeof patch>({ path: '/v1/users/me', method: 'PATCH', data: patch, header: versionHeader(version) })

export const listProducts = (query: ListProductQuery): Promise<ProductPage> =>
  contractRequest({ path: '/v1/products' + queryString(query) })
export const getProduct = (productId: string): Promise<Product> =>
  contractRequest({ path: `/v1/products/${encodeURIComponent(productId)}` })
export const createProduct = (payload: ProductInput, key: string): Promise<Product> =>
  contractRequest({ path: '/v1/products', method: 'POST', data: payload, header: idempotency(key) })
export const updateProduct = (productId: string, version: number, patch: Partial<ProductInput & { status: Product['status'] }>): Promise<Product> =>
  contractRequest({ path: `/v1/products/${encodeURIComponent(productId)}`, method: 'PATCH', data: patch, header: versionHeader(version) })

export const prepareVideoUpload = (payload: { fileName: string; fileSize: number; mimeType: 'video/mp4' | 'video/quicktime'; durationSeconds: number; sha256: string }, key: string): Promise<PreparedVideoUpload> =>
  contractRequest({ path: '/v1/uploads/video/prepare', method: 'POST', data: payload, header: idempotency(key) })
export const signVideoUploadPart = (uploadId: string, partNumber: number, payload: { contentLength: number; sha256: string }, key: string): Promise<SignedUploadPart> =>
  contractRequest({ path: `/v1/uploads/${encodeURIComponent(uploadId)}/parts/${partNumber}`, method: 'POST', data: payload, header: idempotency(key) })
export const completeVideoUploadAndStartModeling = (payload: CompleteModelingUploadRequest, key: string): Promise<ModelingAccepted> =>
  contractRequest({ path: '/v1/uploads/video/complete', method: 'POST', data: payload, header: idempotency(key) })
export const getUpload = (uploadId: string): Promise<UploadRecord> =>
  contractRequest({ path: `/v1/uploads/${encodeURIComponent(uploadId)}` })
export const abortUpload = (uploadId: string): Promise<void> =>
  contractRequest({ path: `/v1/uploads/${encodeURIComponent(uploadId)}`, method: 'DELETE' })

export const getModelingJob = (jobId: string): Promise<ModelingJob> =>
  contractRequest({ path: `/v1/modeling-jobs/${encodeURIComponent(jobId)}` })
export const retryModelingJob = (jobId: string, key: string): Promise<ModelingJob> =>
  contractRequest({ path: `/v1/modeling-jobs/${encodeURIComponent(jobId)}/retry`, method: 'POST', header: idempotency(key) })
export const cancelModelingJob = (jobId: string, key: string): Promise<ModelingJob> =>
  contractRequest({ path: `/v1/modeling-jobs/${encodeURIComponent(jobId)}/cancel`, method: 'POST', header: idempotency(key) })

export const listPurchasedOrders = (query: ListOrderQuery): Promise<OrderPage> =>
  contractRequest({ path: '/v1/orders' + queryString(query) })
export const getPurchasedOrder = (orderId: string): Promise<OrderDetail> =>
  contractRequest({ path: `/v1/orders/${encodeURIComponent(orderId)}` })
export const updateOrderVisibility = (orderId: string, version: number, isPublic: boolean): Promise<OrderDetail> =>
  contractRequest({ path: `/v1/orders/${encodeURIComponent(orderId)}/visibility`, method: 'PATCH', data: { isPublic }, header: versionHeader(version) })
export const cancelOrder = (orderId: string, key: string): Promise<OrderDetail> =>
  contractRequest({ path: `/v1/orders/${encodeURIComponent(orderId)}/cancel`, method: 'POST', header: idempotency(key) })

export const createPaymentIntent = (orderId: string, key: string): Promise<PaymentIntent> =>
  contractRequest({ path: `/v1/orders/${encodeURIComponent(orderId)}/payment-intents`, method: 'POST', data: { paymentMethod: 'wechat-jsapi' }, header: idempotency(key) })
export const getPayment = (paymentId: string): Promise<Payment> =>
  contractRequest({ path: `/v1/payments/${encodeURIComponent(paymentId)}` })

export const listModels = (query: ListModelQuery): Promise<ModelPage> =>
  contractRequest({ path: '/v1/models' + queryString(query) })
export const getModel = (modelId: string): Promise<ModelDetail> =>
  contractRequest({ path: `/v1/models/${encodeURIComponent(modelId)}` })
export const updateModel = (modelId: string, version: number, patch: { title?: string; description?: string; visibility?: Visibility }): Promise<ModelDetail> =>
  contractRequest({ path: `/v1/models/${encodeURIComponent(modelId)}`, method: 'PATCH', data: patch, header: versionHeader(version) })
export const getViewerAsset = (modelId: string): Promise<ViewerAssetContract> =>
  contractRequest({ path: `/v1/models/${encodeURIComponent(modelId)}/viewer` })
export const favoriteModel = (modelId: string): Promise<void> =>
  contractRequest({ path: `/v1/models/${encodeURIComponent(modelId)}/favorite`, method: 'PUT' })
export const unfavoriteModel = (modelId: string): Promise<void> =>
  contractRequest({ path: `/v1/models/${encodeURIComponent(modelId)}/favorite`, method: 'DELETE' })
export const listModelComments = (modelId: string, page: number, pageSize: number): Promise<CommentPage> =>
  contractRequest({ path: `/v1/models/${encodeURIComponent(modelId)}/comments` + queryString({ page, pageSize }) })
export const createModelComment = (modelId: string, content: string, key: string): Promise<CommentContract> =>
  contractRequest({ path: `/v1/models/${encodeURIComponent(modelId)}/comments`, method: 'POST', data: { content }, header: idempotency(key) })
export const deleteComment = (commentId: string): Promise<void> =>
  contractRequest({ path: `/v1/comments/${encodeURIComponent(commentId)}`, method: 'DELETE' })
export const likeComment = (commentId: string): Promise<void> =>
  contractRequest({ path: `/v1/comments/${encodeURIComponent(commentId)}/like`, method: 'PUT' })
export const unlikeComment = (commentId: string): Promise<void> =>
  contractRequest({ path: `/v1/comments/${encodeURIComponent(commentId)}/like`, method: 'DELETE' })

export const listNotifications = (page: number, pageSize: number, unreadOnly = false): Promise<NotificationPage> =>
  contractRequest({ path: '/v1/notifications' + queryString({ page, pageSize, unreadOnly }) })
export const updateNotification = (notificationId: string, read: boolean): Promise<NotificationContract> =>
  contractRequest({ path: `/v1/notifications/${encodeURIComponent(notificationId)}`, method: 'PATCH', data: { read } })

export const requestEmailVerification = (email: string, key: string): Promise<{ verificationId: string; expiresAt: string; retryAfterSeconds: number }> =>
  contractRequest({ path: '/v1/users/me/email-verifications', method: 'POST', data: { email }, header: idempotency(key) })
export const confirmEmail = (verificationId: string, verificationCode: string, key: string): Promise<PrivateUser> =>
  contractRequest({ path: '/v1/users/me/email', method: 'PUT', data: { verificationId, verificationCode }, header: idempotency(key) })
export const prepareAssetUpload = (payload: { purpose: 'avatar' | 'product-cover' | 'feedback-attachment'; fileName: string; fileSize: number; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'; sha256: string }, key: string): Promise<{ uploadId: string; objectKey: string; uploadUrl: string; headers: Record<string, string>; expiresAt: string }> =>
  contractRequest({ path: '/v1/uploads/assets/prepare', method: 'POST', data: payload, header: idempotency(key) })
export const completeAssetUpload = (payload: { uploadId: string; objectKey: string; etag: string }, key: string): Promise<{ uploadId: string; objectKey: string; assetUrl: string; status: 'completed' }> =>
  contractRequest({ path: '/v1/uploads/assets/complete', method: 'POST', data: payload, header: idempotency(key) })
export const createFeedback = (content: string, key: string, contact?: string, attachmentObjectKeys: string[] = []): Promise<{ id: string; status: string; createdAt: string }> =>
  contractRequest({ path: '/v1/feedback', method: 'POST', data: { content, contact, attachmentObjectKeys }, header: idempotency(key) })
