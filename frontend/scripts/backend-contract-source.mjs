const problemResponse = (description) => ({
  description,
  content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } } }
})

const jsonResponse = (description, schema, extra = {}) => ({
  description,
  ...extra,
  content: { 'application/json': { schema } }
})

const ref = (name) => ({ $ref: `#/components/schemas/${name}` })
const responseRef = (name) => ({ $ref: `#/components/responses/${name}` })
const parameterRef = (name) => ({ $ref: `#/components/parameters/${name}` })
const jsonBody = (schema) => ({ required: true, content: { 'application/json': { schema } } })

const authenticated = [{ bearerAuth: [] }]
const publicOperation = []
const internalOperation = [{ internalHmac: [] }]

const read = (tag, operationId, successResponse, options = {}) => ({
  tags: [tag],
  operationId,
  security: options.security ?? authenticated,
  parameters: options.parameters,
  responses: { '200': successResponse, ...options.responses }
})

const write = (tag, operationId, successCode, successResponse, options = {}) => ({
  tags: [tag],
  operationId,
  security: options.security ?? authenticated,
  parameters: options.parameters,
  requestBody: options.body ? jsonBody(options.body) : undefined,
  responses: { [successCode]: successResponse, ...options.responses }
})

const idempotent = [parameterRef('IdempotencyKey')]
const optimistic = [parameterRef('IfMatch')]
const pageParameters = [parameterRef('Page'), parameterRef('PageSize')]

const paths = {
  '/health': {
    get: read('system', 'getHealth', responseRef('Health'), { security: publicOperation })
  },
  '/ready': {
    get: read('system', 'getReadiness', responseRef('Health'), {
      security: publicOperation,
      responses: { '503': responseRef('ServiceUnavailable') }
    })
  },
  '/v1/auth/wechat/login': {
    post: write('auth', 'loginWithWechat', '200', responseRef('AuthTokens'), {
      security: publicOperation,
      body: ref('WechatLoginRequest'),
      responses: { '422': responseRef('ValidationProblem'), '502': responseRef('UpstreamProblem') }
    })
  },
  '/v1/auth/refresh': {
    post: write('auth', 'refreshAccessToken', '200', responseRef('AuthTokens'), {
      security: publicOperation,
      body: ref('RefreshTokenRequest'),
      responses: { '401': responseRef('UnauthorizedProblem') }
    })
  },
  '/v1/auth/logout': {
    post: write('auth', 'logout', '204', { description: 'Refresh session revoked' }, {
      responses: { '401': responseRef('UnauthorizedProblem') }
    })
  },
  '/v1/home': {
    get: read('home', 'getHome', responseRef('Home'), {
      responses: { '401': responseRef('UnauthorizedProblem') }
    })
  },
  '/v1/users/me': {
    get: read('users', 'getCurrentUser', responseRef('CurrentUser')),
    patch: write('users', 'updateCurrentUser', '200', responseRef('CurrentUser'), {
      parameters: optimistic,
      body: ref('UpdateUserRequest'),
      responses: { '409': responseRef('ConflictProblem'), '422': responseRef('ValidationProblem') }
    })
  },
  '/v1/users/{userId}': {
    parameters: [parameterRef('UserId')],
    get: read('users', 'getPublicUser', responseRef('PublicUser'), {
      responses: { '404': responseRef('NotFoundProblem') }
    })
  },
  '/v1/products': {
    get: read('products', 'listProducts', responseRef('ProductPage'), {
      parameters: [...pageParameters, parameterRef('Keyword'), parameterRef('ProductStatusFilter')]
    }),
    post: write('products', 'createProduct', '201', responseRef('Product'), {
      parameters: idempotent,
      body: ref('ProductInput'),
      responses: { '409': responseRef('ConflictProblem'), '422': responseRef('ValidationProblem') }
    })
  },
  '/v1/products/{productId}': {
    parameters: [parameterRef('ProductId')],
    get: read('products', 'getProduct', responseRef('Product'), {
      responses: { '404': responseRef('NotFoundProblem') }
    }),
    patch: write('products', 'updateProduct', '200', responseRef('Product'), {
      parameters: optimistic,
      body: ref('UpdateProductRequest'),
      responses: {
        '403': responseRef('ForbiddenProblem'),
        '409': responseRef('ConflictProblem'),
        '422': responseRef('ValidationProblem')
      }
    })
  },
  '/v1/uploads/video/prepare': {
    post: write('uploads', 'prepareVideoUpload', '201', responseRef('PreparedUpload'), {
      parameters: idempotent,
      body: ref('PrepareUploadRequest'),
      responses: {
        '409': responseRef('ConflictProblem'),
        '413': responseRef('PayloadTooLargeProblem'),
        '422': responseRef('ValidationProblem')
      }
    })
  },
  '/v1/uploads/{uploadId}/parts/{partNumber}': {
    parameters: [parameterRef('UploadId'), parameterRef('PartNumber')],
    post: write('uploads', 'signUploadPart', '200', responseRef('SignedUploadPart'), {
      parameters: idempotent,
      body: ref('SignUploadPartRequest'),
      responses: { '404': responseRef('NotFoundProblem'), '409': responseRef('ConflictProblem') }
    })
  },
  '/v1/uploads/video/complete': {
    post: write('uploads', 'completeVideoUploadAndStartModeling', '202', responseRef('ModelingAccepted'), {
      parameters: idempotent,
      body: ref('CompleteUploadRequest'),
      responses: {
        '404': responseRef('NotFoundProblem'),
        '409': responseRef('ConflictProblem'),
        '422': responseRef('ValidationProblem')
      }
    })
  },
  '/v1/uploads/{uploadId}': {
    parameters: [parameterRef('UploadId')],
    get: read('uploads', 'getUpload', responseRef('Upload'), {
      responses: { '404': responseRef('NotFoundProblem') }
    }),
    delete: write('uploads', 'abortUpload', '204', { description: 'Multipart upload aborted' }, {
      responses: { '404': responseRef('NotFoundProblem'), '409': responseRef('ConflictProblem') }
    })
  },
  '/v1/modeling-jobs/{jobId}': {
    parameters: [parameterRef('JobId')],
    get: read('modeling-jobs', 'getModelingJob', responseRef('ModelingJob'), {
      responses: { '404': responseRef('NotFoundProblem') }
    })
  },
  '/v1/modeling-jobs/{jobId}/retry': {
    parameters: [parameterRef('JobId')],
    post: write('modeling-jobs', 'retryModelingJob', '202', responseRef('ModelingJob'), {
      parameters: idempotent,
      responses: { '409': responseRef('ConflictProblem') }
    })
  },
  '/v1/modeling-jobs/{jobId}/cancel': {
    parameters: [parameterRef('JobId')],
    post: write('modeling-jobs', 'cancelModelingJob', '202', responseRef('ModelingJob'), {
      parameters: idempotent,
      responses: { '409': responseRef('ConflictProblem') }
    })
  },
  '/v1/orders': {
    get: read('orders', 'listOrders', responseRef('OrderPage'), {
      parameters: [...pageParameters, parameterRef('Keyword'), parameterRef('OrderStatusFilter')]
    })
  },
  '/v1/orders/{orderId}': {
    parameters: [parameterRef('OrderId')],
    get: read('orders', 'getOrder', responseRef('Order'), {
      responses: { '404': responseRef('NotFoundProblem') }
    })
  },
  '/v1/orders/{orderId}/visibility': {
    parameters: [parameterRef('OrderId')],
    patch: write('orders', 'updateOrderVisibility', '200', responseRef('Order'), {
      parameters: optimistic,
      body: ref('VisibilityRequest'),
      responses: { '409': responseRef('ConflictProblem') }
    })
  },
  '/v1/orders/{orderId}/cancel': {
    parameters: [parameterRef('OrderId')],
    post: write('orders', 'cancelOrder', '202', responseRef('Order'), {
      parameters: idempotent,
      responses: { '409': responseRef('ConflictProblem') }
    })
  },
  '/v1/models': {
    get: read('models', 'listModels', responseRef('ModelPage'), {
      parameters: [...pageParameters, parameterRef('Keyword'), parameterRef('ModelOwnerFilter'), parameterRef('FavoriteFilter'), parameterRef('ModelSort'), parameterRef('ModelStatusFilter'), parameterRef('VisibilityFilter')]
    })
  },
  '/v1/models/{modelId}': {
    parameters: [parameterRef('ModelId')],
    get: read('models', 'getModel', responseRef('Model'), {
      responses: { '404': responseRef('NotFoundProblem') }
    }),
    patch: write('models', 'updateModel', '200', responseRef('Model'), {
      parameters: optimistic,
      body: ref('UpdateModelRequest'),
      responses: { '403': responseRef('ForbiddenProblem'), '409': responseRef('ConflictProblem') }
    })
  },
  '/v1/models/{modelId}/viewer': {
    parameters: [parameterRef('ModelId')],
    get: read('models', 'getModelViewerAsset', responseRef('ViewerAsset'), {
      responses: {
        '403': responseRef('ForbiddenProblem'),
        '404': responseRef('NotFoundProblem'),
        '409': responseRef('ConflictProblem'),
        '503': responseRef('ServiceUnavailable')
      }
    })
  },
  '/v1/models/{modelId}/favorite': {
    parameters: [parameterRef('ModelId')],
    put: write('models', 'favoriteModel', '204', { description: 'Favorite exists' }, {
      responses: { '404': responseRef('NotFoundProblem') }
    }),
    delete: write('models', 'unfavoriteModel', '204', { description: 'Favorite removed or already absent' })
  },
  '/v1/models/{modelId}/comments': {
    parameters: [parameterRef('ModelId')],
    get: read('comments', 'listModelComments', responseRef('CommentPage'), {
      parameters: pageParameters
    }),
    post: write('comments', 'createModelComment', '201', responseRef('Comment'), {
      parameters: idempotent,
      body: ref('CreateCommentRequest'),
      responses: { '422': responseRef('ValidationProblem') }
    })
  },
  '/v1/comments/{commentId}': {
    parameters: [parameterRef('CommentId')],
    delete: write('comments', 'deleteComment', '204', { description: 'Comment soft-deleted' }, {
      responses: { '403': responseRef('ForbiddenProblem') }
    })
  },
  '/v1/comments/{commentId}/like': {
    parameters: [parameterRef('CommentId')],
    put: write('comments', 'likeComment', '204', { description: 'Like exists' }),
    delete: write('comments', 'unlikeComment', '204', { description: 'Like absent' })
  },
  '/v1/notifications': {
    get: read('notifications', 'listNotifications', responseRef('NotificationPage'), {
      parameters: [...pageParameters, parameterRef('UnreadOnly')]
    })
  },
  '/v1/notifications/{notificationId}': {
    parameters: [parameterRef('NotificationId')],
    patch: write('notifications', 'updateNotification', '200', responseRef('Notification'), {
      body: ref('UpdateNotificationRequest'),
      responses: { '404': responseRef('NotFoundProblem') }
    })
  },
  '/internal/v1/modeling-jobs/{jobId}/events': {
    parameters: [parameterRef('JobId')],
    post: write('internal', 'recordModelingJobEvent', '202', responseRef('ModelingJob'), {
      security: internalOperation,
      parameters: idempotent,
      body: ref('ModelingJobEventRequest'),
      responses: {
        '401': responseRef('UnauthorizedProblem'),
        '404': responseRef('NotFoundProblem'),
        '409': responseRef('ConflictProblem')
      }
    })
  }
}

export { paths, ref, responseRef, parameterRef, jsonResponse, problemResponse }
