import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { openapi } from './backend-openapi-final.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const methods = new Set(['get', 'post', 'put', 'patch', 'delete'])

function resolvePointer(document, pointer) {
  assert.match(pointer, /^#\//, `Only local references are allowed: ${pointer}`)
  return pointer.slice(2).split('/').reduce((value, part) => value?.[part.replace(/~1/g, '/').replace(/~0/g, '~')], document)
}

function walk(value, callback) {
  if (!value || typeof value !== 'object') return
  callback(value)
  Object.values(value).forEach((child) => walk(child, callback))
}

function parameterNames(pathItem, operation) {
  return [...(pathItem.parameters || []), ...(operation.parameters || [])].map((parameter) => {
    const resolved = parameter.$ref ? resolvePointer(openapi, parameter.$ref) : parameter
    return `${resolved.in}:${resolved.name}`
  })
}

function operations() {
  return Object.entries(openapi.paths).flatMap(([path, pathItem]) =>
    Object.entries(pathItem).filter(([method]) => methods.has(method)).map(([method, operation]) => ({ path, pathItem, method, operation }))
  )
}

test('OpenAPI is serializable, generated JSON is current, and all references resolve', async () => {
  const generated = JSON.parse(await readFile(resolve(root, 'docs', 'backend', 'api', 'backend-api-openapi.json'), 'utf8'))
  assert.deepEqual(generated, JSON.parse(JSON.stringify(openapi)))
  assert.equal(openapi.openapi, '3.1.0')
  let refs = 0
  walk(openapi, (value) => {
    if (value.$ref) {
      refs += 1
      assert.ok(resolvePointer(openapi, value.$ref), `Unresolved reference: ${value.$ref}`)
    }
  })
  assert.ok(refs > 100, `Expected broad reusable contract coverage, got ${refs} references`)
})

test('every operation has a unique operationId, responses, and the expected authentication boundary', () => {
  const seen = new Set()
  const publicIds = new Set(['getHealth', 'getReadiness', 'loginWithWechat', 'refreshAccessToken'])
  for (const { path, method, operation } of operations()) {
    assert.ok(operation.operationId, `${method.toUpperCase()} ${path} has no operationId`)
    assert.ok(!seen.has(operation.operationId), `Duplicate operationId: ${operation.operationId}`)
    seen.add(operation.operationId)
    assert.ok(Object.keys(operation.responses || {}).length > 0, `${operation.operationId} has no responses`)
    const security = operation.security ?? openapi.security
    if (publicIds.has(operation.operationId)) assert.deepEqual(security, [], `${operation.operationId} must be public`)
    else assert.ok(Array.isArray(security) && security.length > 0, `${operation.operationId} must be authenticated`)
    if (method === 'get') assert.equal(operation.requestBody, undefined, `${operation.operationId} GET must not have a body`)
  }
})

test('all path placeholders have required path parameters', () => {
  for (const { path, pathItem, operation } of operations()) {
    const declared = new Set(parameterNames(pathItem, operation))
    for (const match of path.matchAll(/\{([^}]+)\}/g)) {
      assert.ok(declared.has(`path:${match[1]}`), `${operation.operationId} is missing path parameter ${match[1]}`)
    }
  }
})

test('critical state-changing operations require idempotency and optimistic writes require If-Match', () => {
  const idempotentIds = [
    'createProduct', 'prepareVideoUpload', 'signUploadPart', 'completeVideoUploadAndStartModeling',
    'retryModelingJob', 'cancelModelingJob', 'cancelOrder', 'createModelComment', 'recordModelingJobEvent',
    'createPaymentIntent', 'receiveWechatPaymentNotification', 'requestEmailVerification', 'confirmEmail',
    'prepareAssetUpload', 'completeAssetUpload', 'createFeedback'
  ]
  const optimisticIds = ['updateCurrentUser', 'updateProduct', 'updateOrderVisibility', 'updateModel']
  const byId = new Map(operations().map((item) => [item.operation.operationId, item]))
  for (const id of idempotentIds) {
    const item = byId.get(id)
    assert.ok(item, `Missing required operation ${id}`)
    assert.ok(parameterNames(item.pathItem, item.operation).includes('header:Idempotency-Key'), `${id} must require Idempotency-Key`)
  }
  for (const id of optimisticIds) {
    const item = byId.get(id)
    assert.ok(item, `Missing required operation ${id}`)
    assert.ok(parameterNames(item.pathItem, item.operation).includes('header:If-Match'), `${id} must require If-Match`)
  }
})

test('the three requested user journeys have complete endpoint coverage', () => {
  const required = {
    oneStopModeling: [
      'loginWithWechat', 'prepareVideoUpload', 'signUploadPart', 'completeVideoUploadAndStartModeling',
      'getUpload', 'getModelingJob', 'recordModelingJobEvent'
    ],
    purchasesAndViewer: ['listOrders', 'getOrder', 'createPaymentIntent', 'getPayment', 'getModel', 'getModelViewerAsset'],
    homeAndProfiles: ['getHome', 'getCurrentUser', 'updateCurrentUser', 'getPublicUser', 'listNotifications', 'updateNotification']
  }
  const ids = new Set(operations().map(({ operation }) => operation.operationId))
  for (const [journey, expected] of Object.entries(required)) {
    for (const id of expected) assert.ok(ids.has(id), `${journey} is missing ${id}`)
  }
})

test('one-stop completion creates stable cross-domain identifiers and viewer assets are verifiable', () => {
  const complete = openapi.components.schemas.CompleteUploadRequest
  assert.deepEqual(complete.required, ['uploadId', 'objectKey', 'parts', 'product', 'modelObjectName', 'visibility'])
  const accepted = openapi.components.schemas.ModelingAccepted
  for (const field of ['uploadId', 'productId', 'orderId', 'modelId', 'jobId', 'statusUrl']) assert.ok(accepted.required.includes(field))
  const viewer = openapi.components.schemas.ViewerAsset
  for (const field of ['modelId', 'variant', 'modelUrl', 'expiresAt', 'fileSize', 'sha256']) assert.ok(viewer.required.includes(field))
  assert.deepEqual(viewer.properties.format, { type: 'string', const: 'glb' })
})

test('public profiles cannot expose private contact data and errors use problem+json', () => {
  const publicProperties = openapi.components.schemas.PublicUser.properties
  assert.equal(publicProperties.email, undefined)
  assert.equal(publicProperties.phone, undefined)
  const privateProperties = openapi.components.schemas.PrivateUser.allOf[1].properties
  assert.ok(privateProperties.email)
  assert.ok(privateProperties.phone)
  for (const [name, response] of Object.entries(openapi.components.responses)) {
    if (!name.endsWith('Problem')) continue
    assert.ok(response.content?.['application/problem+json'], `${name} must use application/problem+json`)
    assert.equal(response.content['application/problem+json'].schema.$ref, '#/components/schemas/Problem')
  }
})

test('database baseline contains the required aggregates, constraints and delivery guarantees', async () => {
  const sql = [
    await readFile(resolve(root, 'docs', 'backend', 'database', 'backend-schema.sql'), 'utf8'),
    await readFile(resolve(root, 'docs', 'backend', 'database', 'backend-schema-extensions.sql'), 'utf8')
  ].join('\n').toLowerCase()
  const tables = [
    'users', 'refresh_tokens', 'products', 'uploads', 'upload_parts', 'models', 'orders',
    'reconstruction_jobs', 'modeling_job_events', 'model_assets', 'favorites', 'comments',
    'comment_likes', 'notifications', 'idempotency_keys', 'outbox_events', 'payments',
    'payment_notifications', 'email_verifications', 'asset_uploads', 'feedback'
  ]
  for (const table of tables) assert.match(sql, new RegExp(`create table ${table}\\s*\\(`), `Missing table ${table}`)
  assert.match(sql, /unique index uq_model_assets_active_variant/)
  assert.match(sql, /primary key \(user_id, operation, idempotency_key\)/)
  assert.match(sql, /idx_outbox_unpublished/)
  assert.match(sql, /foreign key \(reconstruction_job_id\) references reconstruction_jobs/)
  assert.match(sql, /format in \('glb', 'ply', 'splat', 'spz'\)/)
})

test('the typed mini-program client exposes every public application operation', async () => {
  const source = await readFile(resolve(root, 'src', 'services', 'backend.ts'), 'utf8')
  const internalOnly = new Set(['recordModelingJobEvent', 'receiveWechatPaymentNotification'])
  const excluded = new Set(['getHealth', 'getReadiness'])
  for (const { operation } of operations()) {
    const id = operation.operationId
    if (internalOnly.has(id) || excluded.has(id)) continue
    const aliases = {
      listOrders: 'listPurchasedOrders', getOrder: 'getPurchasedOrder',
      getModelViewerAsset: 'getViewerAsset', completeVideoUploadAndStartModeling: 'completeVideoUploadAndStartModeling',
      signUploadPart: 'signVideoUploadPart'
    }
    assert.match(source, new RegExp(`\\b${aliases[id] || id}\\b`), `Typed client is missing ${id}`)
  }
})
