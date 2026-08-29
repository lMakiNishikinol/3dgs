import { paths } from './backend-contract-source.mjs'
import { schemas } from './backend-contract-schemas.mjs'

const schemaRef = (name) => ({ $ref: `#/components/schemas/${name}` })
const jsonResponse = (description, schema, extra = {}) => ({ description, ...extra, content: { 'application/json': { schema } } })
const problemResponse = (description) => ({ description, content: { 'application/problem+json': { schema: schemaRef('Problem') } } })
const envelope = (schema) => ({ type: 'object', required: ['code', 'message', 'data', 'requestId'], properties: { code: { type: 'integer', const: 0 }, message: { type: 'string', const: 'ok' }, data: schema, requestId: { type: 'string' } } })
const pageOf = (itemSchema) => envelope({ allOf: [schemaRef('PageResultBase'), { type: 'object', required: ['items'], properties: { items: { type: 'array', items: itemSchema } } }] })
const uuid = { type: 'string', format: 'uuid' }

const parameters = {
  Page: { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  PageSize: { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
  Keyword: { name: 'keyword', in: 'query', schema: { type: 'string', maxLength: 100 } },
  IdempotencyKey: { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', minLength: 16, maxLength: 128 } },
  IfMatch: { name: 'If-Match', in: 'header', required: true, schema: { type: 'string', pattern: '^"[0-9]+"$' } },
  UserId: { name: 'userId', in: 'path', required: true, schema: uuid },
  ProductId: { name: 'productId', in: 'path', required: true, schema: uuid },
  UploadId: { name: 'uploadId', in: 'path', required: true, schema: uuid },
  PartNumber: { name: 'partNumber', in: 'path', required: true, schema: { type: 'integer', minimum: 1, maximum: 10000 } },
  JobId: { name: 'jobId', in: 'path', required: true, schema: uuid },
  OrderId: { name: 'orderId', in: 'path', required: true, schema: uuid },
  ModelId: { name: 'modelId', in: 'path', required: true, schema: uuid },
  CommentId: { name: 'commentId', in: 'path', required: true, schema: uuid },
  NotificationId: { name: 'notificationId', in: 'path', required: true, schema: uuid },
  ProductStatusFilter: { name: 'status', in: 'query', schema: schemaRef('ProductStatus') },
  OrderStatusFilter: { name: 'status', in: 'query', schema: schemaRef('OrderStatus') },
  ModelStatusFilter: { name: 'status', in: 'query', schema: schemaRef('ModelStatus') },
  ModelOwnerFilter: { name: 'ownerId', in: 'query', schema: uuid },
  FavoriteFilter: { name: 'favoriteBy', in: 'query', schema: { type: 'string', enum: ['me'] } },
  ModelSort: { name: 'sort', in: 'query', schema: { type: 'string', enum: ['latest', 'popular'] } },
  VisibilityFilter: { name: 'visibility', in: 'query', schema: schemaRef('Visibility') },
  UnreadOnly: { name: 'unreadOnly', in: 'query', schema: { type: 'boolean', default: false } }
}

const etag = { headers: { ETag: { schema: { type: 'string' } } } }
const location = { headers: { Location: { schema: { type: 'string' } } } }
const responses = {
  Health: jsonResponse('Healthy', { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['ok', 'degraded'] }, checks: { type: 'object', additionalProperties: true } } }),
  AuthTokens: jsonResponse('Authenticated', envelope(schemaRef('AuthTokens'))),
  Home: jsonResponse('Home aggregate', envelope(schemaRef('Home'))),
  CurrentUser: jsonResponse('Private current-user profile', envelope(schemaRef('PrivateUser')), etag),
  PublicUser: jsonResponse('Public profile without email or phone', envelope(schemaRef('PublicUser'))),
  Product: jsonResponse('Product', envelope(schemaRef('Product')), etag),
  ProductPage: jsonResponse('Product page', pageOf(schemaRef('Product'))),
  PreparedUpload: jsonResponse('Multipart upload prepared', envelope(schemaRef('PreparedUpload')), location),
  SignedUploadPart: jsonResponse('Short-lived signed part URL', envelope(schemaRef('SignedUploadPart'))),
  Upload: jsonResponse('Upload state', envelope(schemaRef('Upload'))),
  ModelingAccepted: jsonResponse('Upload verified and modeling accepted', envelope(schemaRef('ModelingAccepted')), location),
  ModelingJob: jsonResponse('Modeling job', envelope(schemaRef('ModelingJob'))),
  Order: jsonResponse('Purchased modeling order', envelope(schemaRef('Order')), etag),
  OrderPage: jsonResponse('Authenticated user orders', pageOf(schemaRef('Order'))),
  Model: jsonResponse('Generated model', envelope(schemaRef('Model')), etag),
  ModelPage: jsonResponse('Model page', pageOf(schemaRef('Model'))),
  ViewerAsset: jsonResponse('Private short-lived viewer asset', envelope(schemaRef('ViewerAsset'))),
  Comment: jsonResponse('Comment', envelope(schemaRef('Comment'))),
  CommentPage: jsonResponse('Comment page', pageOf(schemaRef('Comment'))),
  Notification: jsonResponse('Notification', envelope(schemaRef('Notification'))),
  NotificationPage: jsonResponse('Notification page', pageOf(schemaRef('Notification'))),
  UnauthorizedProblem: problemResponse('Authentication required'),
  ForbiddenProblem: problemResponse('Forbidden'),
  NotFoundProblem: problemResponse('Not found'),
  ConflictProblem: problemResponse('State, version or idempotency conflict'),
  PayloadTooLargeProblem: problemResponse('File too large'),
  ValidationProblem: problemResponse('Validation failed'),
  UpstreamProblem: problemResponse('Upstream WeChat, storage or training service failure'),
  ServiceUnavailable: problemResponse('Required dependency unavailable')
}

const openapi = {
  openapi: '3.1.0',
  info: {
    title: '3DGS Mini Program Backend API', version: '1.0.0',
    description: 'Contract-first API for WeChat login, one-stop video upload and reconstruction, purchased products, model viewing, home feeds, profiles, social actions and notifications.'
  },
  servers: [{ url: 'https://api.example.com', description: 'Production placeholder' }],
  tags: ['system', 'auth', 'home', 'users', 'products', 'uploads', 'modeling-jobs', 'orders', 'models', 'comments', 'notifications', 'internal'].map((name) => ({ name })),
  paths,
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      internalHmac: { type: 'apiKey', in: 'header', name: 'X-Training-Signature', description: 'HMAC-SHA256 with timestamp and replay protection.' }
    },
    parameters,
    schemas,
    responses
  },
  security: [{ bearerAuth: [] }]
}

export { openapi }
