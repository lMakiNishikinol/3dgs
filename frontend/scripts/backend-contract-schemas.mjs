const ref = (name) => ({ $ref: `#/components/schemas/${name}` })
const uuid = { type: 'string', format: 'uuid' }
const dateTime = { type: 'string', format: 'date-time' }
const nullableString = { type: ['string', 'null'] }
const visibility = { type: 'string', enum: ['public', 'private'] }
const version = { type: 'integer', minimum: 1 }
const sha256 = { type: 'string', pattern: '^[a-f0-9]{64}$' }

const schemas = {
  Problem: {
    type: 'object', required: ['type', 'title', 'status', 'detail', 'requestId', 'code'],
    properties: {
      type: { type: 'string', format: 'uri' }, title: { type: 'string' }, status: { type: 'integer', minimum: 400, maximum: 599 },
      detail: { type: 'string' }, instance: { type: 'string' }, requestId: { type: 'string' }, code: { type: 'string', pattern: '^[A-Z0-9_]+$' },
      errors: { type: 'array', items: ref('FieldError') }
    }
  },
  FieldError: { type: 'object', required: ['field', 'message', 'code'], properties: { field: { type: 'string' }, message: { type: 'string' }, code: { type: 'string' } } },
  PageResultBase: { type: 'object', required: ['page', 'pageSize', 'total', 'totalPages', 'hasNext'], properties: { page: { type: 'integer', minimum: 1 }, pageSize: { type: 'integer', minimum: 1, maximum: 50 }, total: { type: 'integer', minimum: 0 }, totalPages: { type: 'integer', minimum: 0 }, hasNext: { type: 'boolean' } } },
  Visibility: visibility,
  ProductStatus: { type: 'string', enum: ['draft', 'submitted', 'modeling', 'ready', 'failed', 'archived'] },
  ModelStatus: { type: 'string', enum: ['processing', 'ready', 'failed'] },
  OrderStatus: { type: 'string', enum: ['pending_payment', 'pending_production', 'processing', 'shipped', 'completed', 'cancelled', 'refunded', 'failed'] },
  JobStatus: { type: 'string', enum: ['queued', 'preprocessing', 'training', 'converting', 'validating', 'succeeded', 'failed', 'cancelled'] },
  WechatLoginRequest: { type: 'object', required: ['code'], additionalProperties: false, properties: { code: { type: 'string', minLength: 1, maxLength: 128 }, profile: { type: 'object', additionalProperties: false, properties: { name: { type: 'string', maxLength: 60 }, avatarUrl: { type: 'string', format: 'uri' } } } } },
  RefreshTokenRequest: { type: 'object', required: ['refreshToken'], additionalProperties: false, properties: { refreshToken: { type: 'string', minLength: 32 } } },
  PublicUser: {
    type: 'object', required: ['id', 'name', 'bio', 'modelCount', 'favoriteCount', 'followingCount', 'version'],
    properties: { id: uuid, name: { type: 'string' }, company: nullableString, bio: { type: 'string' }, avatarUrl: { type: ['string', 'null'], format: 'uri' }, modelCount: { type: 'integer', minimum: 0 }, favoriteCount: { type: 'integer', minimum: 0 }, followingCount: { type: 'integer', minimum: 0 }, version }
  },
  PrivateUser: { allOf: [ref('PublicUser'), { type: 'object', required: ['roles', 'createdAt', 'updatedAt'], properties: { email: { type: ['string', 'null'], format: 'email' }, phone: nullableString, roles: { type: 'array', items: { type: 'string', enum: ['user', 'creator', 'admin'] } }, createdAt: dateTime, updatedAt: dateTime } }] },
  UpdateUserRequest: { type: 'object', minProperties: 1, additionalProperties: false, properties: { name: { type: 'string', minLength: 1, maxLength: 60 }, company: { type: ['string', 'null'], maxLength: 120 }, bio: { type: 'string', maxLength: 500 }, phone: { type: ['string', 'null'], maxLength: 30 }, email: { type: ['string', 'null'], format: 'email' }, avatarObjectKey: { type: ['string', 'null'], maxLength: 512 } } },
  AuthTokens: { type: 'object', required: ['accessToken', 'refreshToken', 'expiresIn', 'user'], properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' }, expiresIn: { type: 'integer', minimum: 60 }, user: ref('PrivateUser') } },
  ProductInput: {
    type: 'object', required: ['title', 'description', 'category', 'visibility'], additionalProperties: false,
    properties: { title: { type: 'string', minLength: 1, maxLength: 120 }, description: { type: 'string', minLength: 1, maxLength: 2000 }, category: { type: 'string', minLength: 1, maxLength: 80 }, sku: { type: ['string', 'null'], maxLength: 80 }, price: { type: ['number', 'null'], minimum: 0 }, currency: { type: 'string', pattern: '^[A-Z]{3}$', default: 'CNY' }, coverObjectKey: { type: ['string', 'null'], maxLength: 512 }, attributes: { type: 'object', additionalProperties: true }, visibility }
  },
  UpdateProductRequest: {
    type: 'object', minProperties: 1, additionalProperties: false,
    properties: { title: { type: 'string', minLength: 1, maxLength: 120 }, description: { type: 'string', minLength: 1, maxLength: 2000 }, category: { type: 'string', minLength: 1, maxLength: 80 }, sku: { type: ['string', 'null'], maxLength: 80 }, price: { type: ['number', 'null'], minimum: 0 }, currency: { type: 'string', pattern: '^[A-Z]{3}$' }, coverObjectKey: { type: ['string', 'null'], maxLength: 512 }, attributes: { type: 'object', additionalProperties: true }, visibility, status: ref('ProductStatus') }
  },
  Product: {
    type: 'object', required: ['id', 'ownerId', 'title', 'description', 'category', 'currency', 'visibility', 'status', 'version', 'createdAt', 'updatedAt'],
    properties: { id: uuid, ownerId: uuid, title: { type: 'string' }, description: { type: 'string' }, category: { type: 'string' }, sku: nullableString, price: { type: ['number', 'null'] }, currency: { type: 'string' }, coverUrl: { type: ['string', 'null'], format: 'uri' }, attributes: { type: 'object', additionalProperties: true }, visibility, status: ref('ProductStatus'), currentModelId: { type: ['string', 'null'], format: 'uuid' }, version, createdAt: dateTime, updatedAt: dateTime }
  },
  PrepareUploadRequest: {
    type: 'object', required: ['fileName', 'fileSize', 'mimeType', 'durationSeconds', 'sha256'], additionalProperties: false,
    properties: { fileName: { type: 'string', minLength: 1, maxLength: 255 }, fileSize: { type: 'integer', minimum: 1, maximum: 5368709120 }, mimeType: { type: 'string', enum: ['video/mp4', 'video/quicktime'] }, durationSeconds: { type: 'number', minimum: 1, maximum: 1800 }, sha256 }
  },
  PreparedUpload: { type: 'object', required: ['uploadId', 'objectKey', 'uploadMode', 'partSize', 'totalParts', 'expiresAt', 'status'], properties: { uploadId: uuid, objectKey: { type: 'string' }, uploadMode: { type: 'string', const: 'multipart' }, partSize: { type: 'integer', minimum: 5242880 }, totalParts: { type: 'integer', minimum: 1, maximum: 10000 }, expiresAt: dateTime, status: { type: 'string', const: 'prepared' } } },
  SignUploadPartRequest: { type: 'object', required: ['contentLength', 'sha256'], additionalProperties: false, properties: { contentLength: { type: 'integer', minimum: 1 }, sha256 } },
  SignedUploadPart: { type: 'object', required: ['partNumber', 'uploadUrl', 'headers', 'expiresAt'], properties: { partNumber: { type: 'integer' }, uploadUrl: { type: 'string', format: 'uri' }, headers: { type: 'object', additionalProperties: { type: 'string' } }, expiresAt: dateTime } },
  CompletedPart: { type: 'object', required: ['partNumber', 'etag', 'sha256'], additionalProperties: false, properties: { partNumber: { type: 'integer', minimum: 1 }, etag: { type: 'string' }, sha256 } },
  CompleteUploadRequest: { type: 'object', required: ['uploadId', 'objectKey', 'parts', 'product', 'modelObjectName', 'visibility'], additionalProperties: false, properties: { uploadId: uuid, objectKey: { type: 'string' }, parts: { type: 'array', minItems: 1, items: ref('CompletedPart') }, product: ref('ProductInput'), modelObjectName: { type: 'string', minLength: 1, maxLength: 40 }, visibility, trainingProfile: { type: 'string', enum: ['balanced', 'quality', 'fast'], default: 'balanced' } } },
  Upload: { type: 'object', required: ['id', 'status', 'fileName', 'fileSize', 'progress', 'createdAt', 'updatedAt'], properties: { id: uuid, status: { type: 'string', enum: ['prepared', 'uploading', 'verifying', 'completed', 'failed', 'aborted'] }, fileName: { type: 'string' }, fileSize: { type: 'integer' }, progress: { type: 'integer', minimum: 0, maximum: 100 }, failureCode: nullableString, failureMessage: nullableString, createdAt: dateTime, updatedAt: dateTime } },
  ModelingAccepted: { type: 'object', required: ['uploadId', 'productId', 'orderId', 'modelId', 'jobId', 'status', 'statusUrl'], properties: { uploadId: uuid, productId: uuid, orderId: uuid, modelId: uuid, jobId: uuid, status: { type: 'string', const: 'queued' }, statusUrl: { type: 'string' } } },
  ModelingJob: {
    type: 'object', required: ['id', 'userId', 'uploadId', 'productId', 'orderId', 'modelId', 'status', 'stage', 'progress', 'attempt', 'maxAttempts', 'algorithmVersion', 'createdAt', 'updatedAt'],
    properties: { id: uuid, userId: uuid, uploadId: uuid, productId: uuid, orderId: uuid, modelId: uuid, providerJobId: nullableString, status: ref('JobStatus'), stage: { type: 'string' }, progress: { type: 'integer', minimum: 0, maximum: 100 }, attempt: { type: 'integer', minimum: 1 }, maxAttempts: { type: 'integer', minimum: 1 }, algorithmVersion: { type: 'string' }, errorCode: nullableString, errorMessage: nullableString, startedAt: { type: ['string', 'null'], format: 'date-time' }, finishedAt: { type: ['string', 'null'], format: 'date-time' }, createdAt: dateTime, updatedAt: dateTime }
  },
  ModelingJobEventRequest: { type: 'object', required: ['eventId', 'occurredAt', 'status', 'stage', 'progress'], additionalProperties: false, properties: { eventId: uuid, occurredAt: dateTime, providerJobId: nullableString, status: ref('JobStatus'), stage: { type: 'string', maxLength: 80 }, progress: { type: 'integer', minimum: 0, maximum: 100 }, errorCode: nullableString, errorMessage: nullableString, asset: { anyOf: [ref('GeneratedAssetInput'), { type: 'null' }] } } },
  GeneratedAssetInput: { type: 'object', required: ['format', 'variant', 'objectKey', 'fileName', 'fileSize', 'sha256'], additionalProperties: false, properties: { format: { type: 'string', enum: ['glb', 'ply', 'splat', 'spz'] }, variant: { type: 'string', enum: ['mobile-1024', 'mobile-2048', 'geometry-only', 'source'] }, objectKey: { type: 'string', maxLength: 512 }, fileName: { type: 'string', maxLength: 255 }, fileSize: { type: 'integer', minimum: 1 }, sha256, metadata: { type: 'object', additionalProperties: true } } },
  Order: {
    type: 'object', required: ['id', 'userId', 'productId', 'modelId', 'jobId', 'modelTitle', 'description', 'status', 'modelStatus', 'viewerAvailable', 'progress', 'paidAmount', 'currency', 'isPublic', 'version', 'createdAt', 'updatedAt'],
    properties: { id: uuid, userId: uuid, productId: uuid, modelId: uuid, jobId: uuid, modelTitle: { type: 'string' }, description: { type: 'string' }, status: ref('OrderStatus'), modelStatus: ref('ModelStatus'), viewerAvailable: { type: 'boolean' }, progress: { type: 'integer', minimum: 0, maximum: 100 }, originalAmount: { type: 'number' }, discountAmount: { type: 'number' }, paidAmount: { type: 'number' }, currency: { type: 'string' }, contactEmail: { type: ['string', 'null'], format: 'email' }, isPublic: { type: 'boolean' }, version, paidAt: { type: ['string', 'null'], format: 'date-time' }, deliveredAt: { type: ['string', 'null'], format: 'date-time' }, createdAt: dateTime, updatedAt: dateTime }
  },
  Model: {
    type: 'object', required: ['id', 'productId', 'ownerId', 'title', 'description', 'ownerName', 'visibility', 'status', 'viewerAvailable', 'favoriteCount', 'commentCount', 'viewCount', 'isFavorite', 'version', 'createdAt', 'updatedAt'],
    properties: { id: uuid, productId: uuid, ownerId: uuid, title: { type: 'string' }, description: { type: 'string' }, ownerName: { type: 'string' }, visibility, status: ref('ModelStatus'), viewerAvailable: { type: 'boolean' }, favoriteCount: { type: 'integer', minimum: 0 }, commentCount: { type: 'integer', minimum: 0 }, viewCount: { type: 'integer', minimum: 0 }, isFavorite: { type: 'boolean' }, colorSeed: { type: 'integer', minimum: 0 }, sourceVideoDuration: { type: 'number', minimum: 0 }, version, createdAt: dateTime, updatedAt: dateTime }
  },
  UpdateModelRequest: { type: 'object', minProperties: 1, additionalProperties: false, properties: { title: { type: 'string', minLength: 1, maxLength: 120 }, description: { type: 'string', maxLength: 2000 }, visibility } },
  VisibilityRequest: { type: 'object', required: ['isPublic'], additionalProperties: false, properties: { isPublic: { type: 'boolean' } } },
  ViewerAsset: { type: 'object', required: ['modelId', 'format', 'variant', 'modelUrl', 'expiresAt', 'fileName', 'fileSize', 'sha256', 'metadata'], properties: { modelId: uuid, format: { type: 'string', const: 'glb' }, variant: { type: 'string', enum: ['mobile-1024', 'mobile-2048', 'geometry-only'] }, modelUrl: { type: 'string', format: 'uri' }, expiresAt: dateTime, fileName: { type: 'string' }, fileSize: { type: 'integer', minimum: 1 }, sha256, metadata: { type: 'object', additionalProperties: true } } },
  Comment: { type: 'object', required: ['id', 'modelId', 'userId', 'userName', 'content', 'likeCount', 'likedByMe', 'createdAt'], properties: { id: uuid, modelId: uuid, userId: uuid, userName: { type: 'string' }, content: { type: 'string' }, likeCount: { type: 'integer', minimum: 0 }, likedByMe: { type: 'boolean' }, createdAt: dateTime } },
  CreateCommentRequest: { type: 'object', required: ['content'], additionalProperties: false, properties: { content: { type: 'string', minLength: 1, maxLength: 1000 } } },
  Notification: { type: 'object', required: ['id', 'type', 'title', 'body', 'read', 'createdAt'], properties: { id: uuid, type: { type: 'string', enum: ['modeling_progress', 'modeling_succeeded', 'modeling_failed', 'favorite', 'comment', 'system'] }, title: { type: 'string' }, body: { type: 'string' }, read: { type: 'boolean' }, resourceType: nullableString, resourceId: { type: ['string', 'null'], format: 'uuid' }, createdAt: dateTime } },
  UpdateNotificationRequest: { type: 'object', required: ['read'], additionalProperties: false, properties: { read: { type: 'boolean' } } },
  Home: { type: 'object', required: ['currentUser', 'featuredModels', 'latestModels', 'activeOrders', 'unreadNotificationCount'], properties: { currentUser: ref('PrivateUser'), featuredModels: { type: 'array', maxItems: 20, items: ref('Model') }, latestModels: { type: 'array', maxItems: 20, items: ref('Model') }, activeOrders: { type: 'array', maxItems: 10, items: ref('Order') }, unreadNotificationCount: { type: 'integer', minimum: 0 } } }
}

export { schemas }
