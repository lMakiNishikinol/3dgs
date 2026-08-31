import type { ModelDetail, ModelSummary, OrderDetail, OrderSummary, PageQuery, PageResult } from './api'

export type Visibility = 'public' | 'private'
export type ProductStatus = 'draft' | 'submitted' | 'modeling' | 'ready' | 'failed' | 'archived'
export type ModelingJobStatus = 'queued' | 'preprocessing' | 'training' | 'converting' | 'validating' | 'succeeded' | 'failed' | 'cancelled'
export type UploadStatus = 'prepared' | 'uploading' | 'verifying' | 'completed' | 'failed' | 'aborted'

export interface FieldProblem { field: string; message: string; code: string }
export interface ApiProblemBody {
  message?: string
  type: string
  title: string
  status: number
  detail: string
  instance?: string
  requestId: string
  code: string
  errors?: FieldProblem[]
}

export interface PublicUser {
  id: string
  name: string
  company: string | null
  bio: string
  avatarUrl: string | null
  modelCount: number
  favoriteCount: number
  followingCount: number
  version: number
}

export interface PrivateUser extends PublicUser {
  email: string | null
  phone: string | null
  roles: Array<'user' | 'creator' | 'admin'>
  createdAt: string
  updatedAt: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: PrivateUser
}

export interface ProductInput {
  title: string
  description: string
  category: string
  sku?: string | null
  price?: number | null
  currency?: string
  coverObjectKey?: string | null
  attributes?: Record<string, unknown>
  visibility: Visibility
}

export interface Product extends Required<Pick<ProductInput, 'title' | 'description' | 'category' | 'visibility'>> {
  id: string
  ownerId: string
  sku: string | null
  price: number | null
  currency: string
  coverUrl: string | null
  attributes: Record<string, unknown>
  status: ProductStatus
  currentModelId: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface PrepareVideoUploadRequest {
  fileName: string
  fileSize: number
  mimeType: 'video/mp4' | 'video/quicktime'
  durationSeconds: number
  sha256: string
}

export interface PreparedVideoUpload {
  uploadId: string
  objectKey: string
  uploadMode: 'multipart'
  partSize: number
  totalParts: number
  expiresAt: string
  status: 'prepared'
}

export interface SignedUploadPart {
  partNumber: number
  uploadUrl: string
  headers: Record<string, string>
  expiresAt: string
}

export interface CompletedUploadPart { partNumber: number; etag: string; sha256: string }

export interface CompleteModelingUploadRequest {
  uploadId: string
  objectKey: string
  parts: CompletedUploadPart[]
  product: ProductInput
  modelObjectName: string
  visibility: Visibility
  trainingProfile?: 'balanced' | 'quality' | 'fast'
}

export interface ModelingAccepted {
  uploadId: string
  productId: string
  orderId: string
  modelId: string
  jobId: string
  status: 'queued'
  statusUrl: string
}

export interface UploadRecord {
  id: string
  status: UploadStatus
  fileName: string
  fileSize: number
  progress: number
  failureCode: string | null
  failureMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface ModelingJob {
  id: string
  userId: string
  uploadId: string
  productId: string
  orderId: string
  modelId: string
  providerJobId: string | null
  status: ModelingJobStatus
  stage: string
  progress: number
  attempt: number
  maxAttempts: number
  algorithmVersion: string
  errorCode: string | null
  errorMessage: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ViewerAssetContract {
  modelId: string
  format: 'glb'
  variant: 'mobile-1024' | 'mobile-2048' | 'geometry-only'
  modelUrl: string
  expiresAt: string
  fileName: string
  fileSize: number
  sha256: string
  metadata: Record<string, unknown>
}

export interface HomeData {
  currentUser: PrivateUser
  featuredModels: ModelSummary[]
  latestModels: ModelSummary[]
  activeOrders: OrderSummary[]
  unreadNotificationCount: number
}

export interface PaymentIntent {
  paymentId: string
  orderId: string
  status: 'created' | 'pending'
  amount: number
  currency: string
  wechatPayParameters: { timeStamp: string; nonceStr: string; package: string; signType: 'RSA'; paySign: string }
  expiresAt: string
}

export interface Payment {
  id: string
  orderId: string
  providerTransactionId: string | null
  status: 'created' | 'pending' | 'succeeded' | 'failed' | 'closed' | 'refunded'
  amount: number
  currency: string
  paidAt: string | null
  createdAt: string
  updatedAt: string
}

export interface NotificationContract {
  id: string
  type: 'modeling_progress' | 'modeling_succeeded' | 'modeling_failed' | 'favorite' | 'comment' | 'system'
  title: string
  body: string
  read: boolean
  resourceType: string | null
  resourceId: string | null
  createdAt: string
}

export interface CommentContract {
  id: string
  modelId: string
  userId: string
  userName: string
  content: string
  likeCount: number
  likedByMe: boolean
  createdAt: string
}

export interface ListProductQuery extends PageQuery { keyword?: string; status?: ProductStatus }
export interface ListOrderQuery extends PageQuery { keyword?: string; status?: OrderSummary['status'] | OrderSummary['status'][] }
export interface ListModelQuery extends PageQuery {
  keyword?: string
  ownerId?: string
  favoriteBy?: 'me'
  sort?: 'latest' | 'popular'
  status?: ModelSummary['status']
  visibility?: Visibility
}

export type ProductPage = PageResult<Product>
export type OrderPage = PageResult<OrderSummary>
export type ModelPage = PageResult<ModelSummary>
export type CommentPage = PageResult<CommentContract>
export type NotificationPage = PageResult<NotificationContract>
export type { ModelDetail, ModelSummary, OrderDetail, OrderSummary }
