const schemaRef = (name) => ({ $ref: `#/components/schemas/${name}` })
const responseRef = (name) => ({ $ref: `#/components/responses/${name}` })
const parameterRef = (name) => ({ $ref: `#/components/parameters/${name}` })
const jsonBody = (schema) => ({ required: true, content: { 'application/json': { schema } } })
const envelope = (schema) => ({ type: 'object', required: ['code', 'message', 'data', 'requestId'], properties: { code: { type: 'integer', const: 0 }, message: { type: 'string', const: 'ok' }, data: schema, requestId: { type: 'string' } } })
const jsonResponse = (description, schema) => ({ description, content: { 'application/json': { schema } } })
const authenticated = [{ bearerAuth: [] }]

const extensionPaths = {
  '/v1/orders/{orderId}/payment-intents': {
    parameters: [parameterRef('OrderId')],
    post: {
      tags: ['payments'], operationId: 'createPaymentIntent', security: authenticated,
      parameters: [parameterRef('IdempotencyKey')], requestBody: jsonBody(schemaRef('CreatePaymentIntentRequest')),
      responses: { '201': responseRef('PaymentIntent'), '404': responseRef('NotFoundProblem'), '409': responseRef('ConflictProblem'), '422': responseRef('ValidationProblem') }
    }
  },
  '/v1/payments/{paymentId}': {
    parameters: [parameterRef('PaymentId')],
    get: { tags: ['payments'], operationId: 'getPayment', security: authenticated, responses: { '200': responseRef('Payment'), '404': responseRef('NotFoundProblem') } }
  },
  '/internal/v1/payments/wechat/notify': {
    post: {
      tags: ['internal'], operationId: 'receiveWechatPaymentNotification', security: [{ wechatPaySignature: [] }],
      parameters: [parameterRef('IdempotencyKey')], requestBody: jsonBody(schemaRef('WechatPaymentNotification')),
      responses: { '204': { description: 'Notification verified and applied' }, '401': responseRef('UnauthorizedProblem'), '409': responseRef('ConflictProblem') }
    }
  },
  '/v1/users/me/email-verifications': {
    post: {
      tags: ['users'], operationId: 'requestEmailVerification', security: authenticated,
      parameters: [parameterRef('IdempotencyKey')], requestBody: jsonBody(schemaRef('EmailVerificationRequest')),
      responses: { '202': responseRef('EmailVerification'), '422': responseRef('ValidationProblem'), '429': responseRef('RateLimitProblem') }
    }
  },
  '/v1/users/me/email': {
    put: {
      tags: ['users'], operationId: 'confirmEmail', security: authenticated,
      parameters: [parameterRef('IdempotencyKey')], requestBody: jsonBody(schemaRef('ConfirmEmailRequest')),
      responses: { '200': responseRef('CurrentUser'), '409': responseRef('ConflictProblem'), '422': responseRef('ValidationProblem') }
    }
  },
  '/v1/uploads/assets/prepare': {
    post: {
      tags: ['uploads'], operationId: 'prepareAssetUpload', security: authenticated,
      parameters: [parameterRef('IdempotencyKey')], requestBody: jsonBody(schemaRef('PrepareAssetUploadRequest')),
      responses: { '201': responseRef('PreparedAssetUpload'), '413': responseRef('PayloadTooLargeProblem'), '422': responseRef('ValidationProblem') }
    }
  },
  '/v1/uploads/assets/complete': {
    post: {
      tags: ['uploads'], operationId: 'completeAssetUpload', security: authenticated,
      parameters: [parameterRef('IdempotencyKey')], requestBody: jsonBody(schemaRef('CompleteAssetUploadRequest')),
      responses: { '200': responseRef('CompletedAssetUpload'), '404': responseRef('NotFoundProblem'), '409': responseRef('ConflictProblem') }
    }
  },
  '/v1/feedback': {
    post: {
      tags: ['feedback'], operationId: 'createFeedback', security: authenticated,
      parameters: [parameterRef('IdempotencyKey')], requestBody: jsonBody(schemaRef('CreateFeedbackRequest')),
      responses: { '201': responseRef('Feedback'), '422': responseRef('ValidationProblem') }
    }
  }
}

const extensionSchemas = {
  PaymentStatus: { type: 'string', enum: ['created', 'pending', 'succeeded', 'failed', 'closed', 'refunded'] },
  CreatePaymentIntentRequest: { type: 'object', required: ['paymentMethod'], additionalProperties: false, properties: { paymentMethod: { type: 'string', const: 'wechat-jsapi' } } },
  PaymentIntent: { type: 'object', required: ['paymentId', 'orderId', 'status', 'amount', 'currency', 'wechatPayParameters', 'expiresAt'], properties: { paymentId: { type: 'string', format: 'uuid' }, orderId: { type: 'string', format: 'uuid' }, status: schemaRef('PaymentStatus'), amount: { type: 'number', minimum: 0 }, currency: { type: 'string', pattern: '^[A-Z]{3}$' }, wechatPayParameters: { type: 'object', required: ['timeStamp', 'nonceStr', 'package', 'signType', 'paySign'], properties: { timeStamp: { type: 'string' }, nonceStr: { type: 'string' }, package: { type: 'string' }, signType: { type: 'string', const: 'RSA' }, paySign: { type: 'string' } } }, expiresAt: { type: 'string', format: 'date-time' } } },
  Payment: { type: 'object', required: ['id', 'orderId', 'status', 'amount', 'currency', 'createdAt', 'updatedAt'], properties: { id: { type: 'string', format: 'uuid' }, orderId: { type: 'string', format: 'uuid' }, providerTransactionId: { type: ['string', 'null'] }, status: schemaRef('PaymentStatus'), amount: { type: 'number', minimum: 0 }, currency: { type: 'string' }, paidAt: { type: ['string', 'null'], format: 'date-time' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' } } },
  WechatPaymentNotification: { type: 'object', required: ['notificationId', 'transactionId', 'orderId', 'tradeState', 'amount', 'occurredAt'], properties: { notificationId: { type: 'string' }, transactionId: { type: 'string' }, orderId: { type: 'string', format: 'uuid' }, tradeState: { type: 'string', enum: ['SUCCESS', 'CLOSED', 'REFUND'] }, amount: { type: 'number', minimum: 0 }, occurredAt: { type: 'string', format: 'date-time' } } },
  EmailVerificationRequest: { type: 'object', required: ['email'], additionalProperties: false, properties: { email: { type: 'string', format: 'email' } } },
  EmailVerification: { type: 'object', required: ['verificationId', 'expiresAt', 'retryAfterSeconds'], properties: { verificationId: { type: 'string', format: 'uuid' }, expiresAt: { type: 'string', format: 'date-time' }, retryAfterSeconds: { type: 'integer', minimum: 1 } } },
  ConfirmEmailRequest: { type: 'object', required: ['verificationId', 'verificationCode'], additionalProperties: false, properties: { verificationId: { type: 'string', format: 'uuid' }, verificationCode: { type: 'string', pattern: '^[0-9]{6}$' } } },
  PrepareAssetUploadRequest: { type: 'object', required: ['purpose', 'fileName', 'fileSize', 'mimeType', 'sha256'], additionalProperties: false, properties: { purpose: { type: 'string', enum: ['avatar', 'product-cover', 'feedback-attachment'] }, fileName: { type: 'string', maxLength: 255 }, fileSize: { type: 'integer', minimum: 1, maximum: 20971520 }, mimeType: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] }, sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' } } },
  PreparedAssetUpload: { type: 'object', required: ['uploadId', 'objectKey', 'uploadUrl', 'headers', 'expiresAt'], properties: { uploadId: { type: 'string', format: 'uuid' }, objectKey: { type: 'string' }, uploadUrl: { type: 'string', format: 'uri' }, headers: { type: 'object', additionalProperties: { type: 'string' } }, expiresAt: { type: 'string', format: 'date-time' } } },
  CompleteAssetUploadRequest: { type: 'object', required: ['uploadId', 'objectKey', 'etag'], additionalProperties: false, properties: { uploadId: { type: 'string', format: 'uuid' }, objectKey: { type: 'string' }, etag: { type: 'string' } } },
  CompletedAssetUpload: { type: 'object', required: ['uploadId', 'objectKey', 'assetUrl', 'status'], properties: { uploadId: { type: 'string', format: 'uuid' }, objectKey: { type: 'string' }, assetUrl: { type: 'string', format: 'uri' }, status: { type: 'string', const: 'completed' } } },
  CreateFeedbackRequest: { type: 'object', required: ['content'], additionalProperties: false, properties: { content: { type: 'string', minLength: 1, maxLength: 5000 }, contact: { type: ['string', 'null'], maxLength: 320 }, attachmentObjectKeys: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 512 } } } },
  Feedback: { type: 'object', required: ['id', 'status', 'createdAt'], properties: { id: { type: 'string', format: 'uuid' }, status: { type: 'string', enum: ['received', 'processing', 'resolved', 'closed'] }, createdAt: { type: 'string', format: 'date-time' } } }
}

const extensionParameters = {
  PaymentId: { name: 'paymentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
}

const extensionResponses = {
  PaymentIntent: jsonResponse('WeChat payment intent', envelope(schemaRef('PaymentIntent'))),
  Payment: jsonResponse('Payment state', envelope(schemaRef('Payment'))),
  EmailVerification: jsonResponse('Verification sent', envelope(schemaRef('EmailVerification'))),
  PreparedAssetUpload: jsonResponse('Asset direct upload prepared', envelope(schemaRef('PreparedAssetUpload'))),
  CompletedAssetUpload: jsonResponse('Asset verified', envelope(schemaRef('CompletedAssetUpload'))),
  Feedback: jsonResponse('Feedback accepted', envelope(schemaRef('Feedback'))),
  RateLimitProblem: { description: 'Rate limit exceeded', content: { 'application/problem+json': { schema: schemaRef('Problem') } } }
}

export { extensionPaths, extensionSchemas, extensionParameters, extensionResponses }
