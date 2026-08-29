import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'

const now = () => new Date().toISOString()
const page = (items) => ({ items, page: 1, pageSize: 20, total: items.length, totalPages: items.length ? 1 : 0, hasNext: false })

function createReferenceServer() {
  const state = {
    users: new Map(), tokens: new Map(), uploads: new Map(), products: new Map(), models: new Map(),
    orders: new Map(), jobs: new Map(), payments: new Map(), assets: new Map(), notifications: [],
    idempotency: new Map(), jobEvents: new Set(), outbox: []
  }

  const ok = (res, data, status = 200, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', 'x-request-id': randomUUID(), ...headers })
    res.end(JSON.stringify({ code: 0, message: 'ok', data, requestId: randomUUID() }))
  }
  const empty = (res, status = 204) => { res.writeHead(status); res.end() }
  const problem = (res, status, code, detail) => {
    const requestId = randomUUID()
    res.writeHead(status, { 'content-type': 'application/problem+json', 'x-request-id': requestId })
    res.end(JSON.stringify({ type: `https://api.example.com/errors/${code.toLowerCase().replaceAll('_', '-')}`, title: code, status, detail, requestId, code }))
  }
  const parseBody = async (req) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}
  }
  const actor = (req) => state.users.get(state.tokens.get(req.headers.authorization?.replace(/^Bearer /, '')))
  const requireActor = (req, res) => {
    const user = actor(req)
    if (!user) problem(res, 401, 'UNAUTHORIZED', 'Access token is missing or invalid')
    return user
  }
  const idempotentResult = (req, user, operation, producer) => {
    const key = req.headers['idempotency-key']
    if (!key || String(key).length < 16) return { error: ['IDEMPOTENCY_KEY_REQUIRED', 422] }
    const mapKey = `${user.id}:${operation}:${key}`
    if (state.idempotency.has(mapKey)) return { value: state.idempotency.get(mapKey), replay: true }
    const value = producer()
    state.idempotency.set(mapKey, value)
    return { value, replay: false }
  }
  const publicUser = (user) => ({ id: user.id, name: user.name, company: user.company, bio: user.bio, avatarUrl: user.avatarUrl, modelCount: [...state.models.values()].filter((item) => item.ownerId === user.id).length, favoriteCount: 0, followingCount: 0, version: user.version })
  const privateUser = (user) => ({ ...publicUser(user), email: user.email, phone: user.phone, roles: user.roles, createdAt: user.createdAt, updatedAt: user.updatedAt })
  const orderDto = (order) => {
    const model = state.models.get(order.modelId)
    const job = state.jobs.get(order.jobId)
    return { ...order, modelStatus: model.status, viewerAvailable: model.viewerAvailable, progress: job.progress }
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost')
    const path = url.pathname
    try {
      if (req.method === 'POST' && path === '/v1/auth/wechat/login') {
        const body = await parseBody(req)
        if (!body.code) return problem(res, 422, 'VALIDATION_ERROR', 'code is required')
        let user = state.users.get(body.code)
        if (!user) {
          const stamp = now()
          user = { id: randomUUID(), name: body.profile?.name || `用户-${body.code}`, company: null, bio: '', avatarUrl: null, email: null, phone: null, roles: ['user'], version: 1, createdAt: stamp, updatedAt: stamp }
          state.users.set(body.code, user)
        }
        const accessToken = `access-${user.id}`
        state.tokens.set(accessToken, body.code)
        return ok(res, { accessToken, refreshToken: `refresh-${user.id}-${'x'.repeat(32)}`, expiresIn: 900, user: privateUser(user) })
      }

      if (req.method === 'GET' && path === '/v1/home') {
        const user = requireActor(req, res); if (!user) return
        const visible = [...state.models.values()].filter((item) => item.visibility === 'public' && item.status === 'ready')
        const orders = [...state.orders.values()].filter((item) => item.userId === user.id && !['completed', 'cancelled', 'refunded'].includes(item.status)).map(orderDto)
        return ok(res, { currentUser: privateUser(user), featuredModels: visible.slice(0, 10), latestModels: visible.slice(0, 10), activeOrders: orders, unreadNotificationCount: state.notifications.filter((item) => item.userId === user.id && !item.read).length })
      }

      if (path === '/v1/users/me' && req.method === 'GET') {
        const user = requireActor(req, res); if (!user) return
        return ok(res, privateUser(user), 200, { etag: `"${user.version}"` })
      }
      if (path === '/v1/users/me' && req.method === 'PATCH') {
        const user = requireActor(req, res); if (!user) return
        if (req.headers['if-match'] !== `"${user.version}"`) return problem(res, 409, 'VERSION_CONFLICT', 'Profile has changed')
        const body = await parseBody(req)
        Object.assign(user, body, { version: user.version + 1, updatedAt: now() })
        return ok(res, privateUser(user), 200, { etag: `"${user.version}"` })
      }

      if (req.method === 'POST' && path === '/v1/uploads/video/prepare') {
        const user = requireActor(req, res); if (!user) return
        const body = await parseBody(req)
        if (!/^[a-f0-9]{64}$/.test(body.sha256 || '')) return problem(res, 422, 'VALIDATION_ERROR', 'sha256 must be lowercase hex')
        const result = idempotentResult(req, user, 'prepareVideoUpload', () => {
          const uploadId = randomUUID(); const stamp = now(); const partSize = 8 * 1024 * 1024
          const upload = { id: uploadId, userId: user.id, objectKey: `videos/${user.id}/${uploadId}.mp4`, fileName: body.fileName, fileSize: body.fileSize, sha256: body.sha256, partSize, totalParts: Math.ceil(body.fileSize / partSize), status: 'prepared', progress: 0, parts: new Map(), createdAt: stamp, updatedAt: stamp }
          state.uploads.set(uploadId, upload)
          return { uploadId, objectKey: upload.objectKey, uploadMode: 'multipart', partSize, totalParts: upload.totalParts, expiresAt: new Date(Date.now() + 3600000).toISOString(), status: 'prepared' }
        })
        if (result.error) return problem(res, result.error[1], result.error[0], 'Idempotency-Key is required')
        return ok(res, result.value, 201, { location: `/v1/uploads/${result.value.uploadId}`, 'idempotency-replayed': String(result.replay) })
      }

      const partMatch = path.match(/^\/v1\/uploads\/([^/]+)\/parts\/(\d+)$/)
      if (req.method === 'POST' && partMatch) {
        const user = requireActor(req, res); if (!user) return
        const upload = state.uploads.get(partMatch[1])
        if (!upload || upload.userId !== user.id) return problem(res, 404, 'UPLOAD_NOT_FOUND', 'Upload not found')
        const body = await parseBody(req); const partNumber = Number(partMatch[2])
        const result = idempotentResult(req, user, `signUploadPart:${upload.id}:${partNumber}`, () => {
          upload.parts.set(partNumber, { partNumber, contentLength: body.contentLength, sha256: body.sha256 })
          upload.status = 'uploading'
          return { partNumber, uploadUrl: `https://storage.example.test/${upload.id}/${partNumber}?signature=test`, headers: { 'content-type': 'application/octet-stream' }, expiresAt: new Date(Date.now() + 600000).toISOString() }
        })
        if (result.error) return problem(res, 422, result.error[0], 'Idempotency-Key is required')
        return ok(res, result.value)
      }

      if (req.method === 'POST' && path === '/v1/uploads/video/complete') {
        const user = requireActor(req, res); if (!user) return
        const body = await parseBody(req); const upload = state.uploads.get(body.uploadId)
        if (!upload || upload.userId !== user.id) return problem(res, 404, 'UPLOAD_NOT_FOUND', 'Upload not found')
        if (body.objectKey !== upload.objectKey || body.parts?.length !== upload.totalParts) return problem(res, 409, 'UPLOAD_PARTS_INCOMPLETE', 'All signed parts are required')
        const result = idempotentResult(req, user, 'completeVideoUploadAndStartModeling', () => {
          const stamp = now(); const productId = randomUUID(); const modelId = randomUUID(); const orderId = randomUUID(); const jobId = randomUUID()
          const product = { id: productId, ownerId: user.id, ...body.product, sku: body.product.sku ?? null, price: body.product.price ?? 0, currency: body.product.currency ?? 'CNY', coverUrl: null, attributes: body.product.attributes ?? {}, status: 'modeling', currentModelId: modelId, version: 1, createdAt: stamp, updatedAt: stamp }
          const model = { id: modelId, productId, ownerId: user.id, title: product.title, description: product.description, ownerName: user.name, visibility: body.visibility, status: 'processing', viewerAvailable: false, favoriteCount: 0, commentCount: 0, viewCount: 0, isFavorite: false, colorSeed: 1, sourceVideoDuration: 60, version: 1, createdAt: stamp, updatedAt: stamp }
          const order = { id: orderId, userId: user.id, productId, modelId, jobId, modelTitle: product.title, description: product.description, status: 'processing', originalAmount: product.price, discountAmount: 0, paidAmount: product.price, currency: product.currency, contactEmail: user.email, isPublic: body.visibility === 'public', version: 1, paidAt: stamp, deliveredAt: null, createdAt: stamp, updatedAt: stamp }
          const job = { id: jobId, userId: user.id, uploadId: upload.id, productId, orderId, modelId, providerJobId: null, status: 'queued', stage: 'queued', progress: 0, attempt: 1, maxAttempts: 3, algorithmVersion: '3dgs-reference-1', errorCode: null, errorMessage: null, startedAt: null, finishedAt: null, createdAt: stamp, updatedAt: stamp }
          state.products.set(productId, product); state.models.set(modelId, model); state.orders.set(orderId, order); state.jobs.set(jobId, job)
          upload.status = 'completed'; upload.progress = 100; upload.updatedAt = stamp
          state.outbox.push({ aggregateId: jobId, eventType: 'modeling.job.queued' })
          return { uploadId: upload.id, productId, orderId, modelId, jobId, status: 'queued', statusUrl: `/v1/modeling-jobs/${jobId}` }
        })
        if (result.error) return problem(res, 422, result.error[0], 'Idempotency-Key is required')
        return ok(res, result.value, 202, { location: result.value.statusUrl, 'idempotency-replayed': String(result.replay) })
      }

      const jobMatch = path.match(/^\/v1\/modeling-jobs\/([^/]+)$/)
      if (req.method === 'GET' && jobMatch) {
        const user = requireActor(req, res); if (!user) return
        const job = state.jobs.get(jobMatch[1])
        if (!job || job.userId !== user.id) return problem(res, 404, 'JOB_NOT_FOUND', 'Job not found')
        return ok(res, job)
      }

      const eventMatch = path.match(/^\/internal\/v1\/modeling-jobs\/([^/]+)\/events$/)
      if (req.method === 'POST' && eventMatch) {
        if (req.headers['x-training-signature'] !== 'test-signature') return problem(res, 401, 'INVALID_TRAINING_SIGNATURE', 'Signature invalid')
        const body = await parseBody(req); const job = state.jobs.get(eventMatch[1])
        if (!job) return problem(res, 404, 'JOB_NOT_FOUND', 'Job not found')
        if (state.jobEvents.has(body.eventId)) return ok(res, job, 202)
        state.jobEvents.add(body.eventId)
        Object.assign(job, { status: body.status, stage: body.stage, progress: body.progress, providerJobId: body.providerJobId ?? job.providerJobId, updatedAt: now() })
        const model = state.models.get(job.modelId); const order = state.orders.get(job.orderId); const product = state.products.get(job.productId)
        if (body.status === 'succeeded') {
          if (!body.asset || body.asset.format !== 'glb') return problem(res, 409, 'MOBILE_ASSET_REQUIRED', 'A GLB mobile asset is required')
          state.assets.set(job.modelId, body.asset); Object.assign(model, { status: 'ready', viewerAvailable: true, updatedAt: now() })
          Object.assign(order, { status: 'completed', deliveredAt: now(), updatedAt: now() }); Object.assign(product, { status: 'ready', updatedAt: now() })
          Object.assign(job, { finishedAt: now(), progress: 100 })
          state.notifications.push({ id: randomUUID(), userId: job.userId, type: 'modeling_succeeded', title: '模型已完成', body: product.title, read: false, resourceType: 'model', resourceId: model.id, createdAt: now() })
        }
        return ok(res, job, 202)
      }

      if (req.method === 'GET' && path === '/v1/orders') {
        const user = requireActor(req, res); if (!user) return
        return ok(res, page([...state.orders.values()].filter((item) => item.userId === user.id).map(orderDto)))
      }
      const orderMatch = path.match(/^\/v1\/orders\/([^/]+)$/)
      if (req.method === 'GET' && orderMatch) {
        const user = requireActor(req, res); if (!user) return
        const order = state.orders.get(orderMatch[1])
        if (!order || order.userId !== user.id) return problem(res, 404, 'ORDER_NOT_FOUND', 'Order not found')
        return ok(res, orderDto(order), 200, { etag: `"${order.version}"` })
      }

      const modelMatch = path.match(/^\/v1\/models\/([^/]+)$/)
      if (req.method === 'GET' && modelMatch) {
        const user = requireActor(req, res); if (!user) return
        const model = state.models.get(modelMatch[1])
        if (!model || (model.visibility !== 'public' && model.ownerId !== user.id)) return problem(res, 404, 'MODEL_NOT_FOUND', 'Model not found')
        return ok(res, model)
      }
      const viewerMatch = path.match(/^\/v1\/models\/([^/]+)\/viewer$/)
      if (req.method === 'GET' && viewerMatch) {
        const user = requireActor(req, res); if (!user) return
        const model = state.models.get(viewerMatch[1])
        if (!model || (model.visibility !== 'public' && model.ownerId !== user.id)) return problem(res, 404, 'MODEL_NOT_FOUND', 'Model not found')
        const asset = state.assets.get(model.id)
        if (!model.viewerAvailable || !asset) return problem(res, 409, 'MODEL_ASSET_NOT_READY', 'Model is still being generated')
        return ok(res, { modelId: model.id, format: 'glb', variant: asset.variant, modelUrl: `https://storage.example.test/${asset.objectKey}?signature=viewer`, expiresAt: new Date(Date.now() + 600000).toISOString(), fileName: asset.fileName, fileSize: asset.fileSize, sha256: asset.sha256, metadata: asset.metadata })
      }

      return problem(res, 404, 'ROUTE_NOT_FOUND', 'Route not implemented by reference fixture')
    } catch (error) {
      return problem(res, 500, 'REFERENCE_SERVER_ERROR', error instanceof Error ? error.message : String(error))
    }
  })
  return { server, state }
}

async function request(base, path, options = {}) {
  const response = await fetch(base + path, options)
  const body = response.status === 204 ? undefined : await response.json()
  return { response, body }
}

test('complete authenticated upload → modeling → purchased order → viewer → home flow', async (t) => {
  const { server, state } = createReferenceServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))
  const address = server.address(); const base = `http://127.0.0.1:${address.port}`
  const jsonHeaders = { 'content-type': 'application/json' }

  const unauthorized = await request(base, '/v1/home')
  assert.equal(unauthorized.response.status, 401)
  assert.equal(unauthorized.body.code, 'UNAUTHORIZED')

  const loginA = await request(base, '/v1/auth/wechat/login', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ code: 'user-a', profile: { name: '建模用户A' } }) })
  const loginB = await request(base, '/v1/auth/wechat/login', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ code: 'user-b', profile: { name: '其他用户B' } }) })
  assert.equal(loginA.response.status, 200)
  const authA = { ...jsonHeaders, authorization: `Bearer ${loginA.body.data.accessToken}` }
  const authB = { ...jsonHeaders, authorization: `Bearer ${loginB.body.data.accessToken}` }

  const sha = 'a'.repeat(64); const partSha = 'b'.repeat(64); const prepareKey = 'prepare-video-0001'
  const prepareBody = { fileName: 'chair.mp4', fileSize: 6 * 1024 * 1024, mimeType: 'video/mp4', durationSeconds: 60, sha256: sha }
  const prepare = await request(base, '/v1/uploads/video/prepare', { method: 'POST', headers: { ...authA, 'idempotency-key': prepareKey }, body: JSON.stringify(prepareBody) })
  const prepareReplay = await request(base, '/v1/uploads/video/prepare', { method: 'POST', headers: { ...authA, 'idempotency-key': prepareKey }, body: JSON.stringify(prepareBody) })
  assert.equal(prepare.response.status, 201)
  assert.equal(prepare.body.data.uploadId, prepareReplay.body.data.uploadId)
  assert.equal(prepareReplay.response.headers.get('idempotency-replayed'), 'true')

  const upload = prepare.body.data
  const signed = await request(base, `/v1/uploads/${upload.uploadId}/parts/1`, { method: 'POST', headers: { ...authA, 'idempotency-key': 'sign-upload-part-0001' }, body: JSON.stringify({ contentLength: prepareBody.fileSize, sha256: partSha }) })
  assert.equal(signed.response.status, 200)
  assert.match(signed.body.data.uploadUrl, /^https:\/\/storage\.example\.test/)

  const completeBody = {
    uploadId: upload.uploadId, objectKey: upload.objectKey,
    parts: [{ partNumber: 1, etag: 'etag-part-1', sha256: partSha }],
    product: { title: '木质椅子', description: '环绕拍摄的商品', category: '家具', price: 199, currency: 'CNY', visibility: 'public' },
    modelObjectName: '椅子', visibility: 'public', trainingProfile: 'quality'
  }
  const completeKey = 'complete-modeling-0001'
  const complete = await request(base, '/v1/uploads/video/complete', { method: 'POST', headers: { ...authA, 'idempotency-key': completeKey }, body: JSON.stringify(completeBody) })
  const completeReplay = await request(base, '/v1/uploads/video/complete', { method: 'POST', headers: { ...authA, 'idempotency-key': completeKey }, body: JSON.stringify(completeBody) })
  assert.equal(complete.response.status, 202)
  assert.deepEqual(completeReplay.body.data, complete.body.data)
  assert.equal(state.outbox.length, 1, 'Idempotent replay must not publish a second training job')
  const accepted = complete.body.data

  const orderBefore = await request(base, `/v1/orders/${accepted.orderId}`, { headers: authA })
  assert.equal(orderBefore.response.status, 200)
  assert.equal(orderBefore.body.data.productId, accepted.productId)
  assert.equal(orderBefore.body.data.jobId, accepted.jobId)
  assert.equal(orderBefore.body.data.viewerAvailable, false)

  const viewerBefore = await request(base, `/v1/models/${accepted.modelId}/viewer`, { headers: authA })
  assert.equal(viewerBefore.response.status, 409)
  assert.equal(viewerBefore.body.code, 'MODEL_ASSET_NOT_READY')

  const unsignedEvent = await request(base, `/internal/v1/modeling-jobs/${accepted.jobId}/events`, { method: 'POST', headers: { ...jsonHeaders, 'idempotency-key': 'training-event-0001' }, body: JSON.stringify({ eventId: randomUUID(), occurredAt: now(), status: 'training', stage: 'training', progress: 50 }) })
  assert.equal(unsignedEvent.response.status, 401)

  const trainingEvent = { eventId: randomUUID(), occurredAt: now(), status: 'training', stage: 'training', progress: 55, providerJobId: 'provider-1' }
  const progress = await request(base, `/internal/v1/modeling-jobs/${accepted.jobId}/events`, { method: 'POST', headers: { ...jsonHeaders, 'x-training-signature': 'test-signature', 'idempotency-key': 'training-event-0002' }, body: JSON.stringify(trainingEvent) })
  assert.equal(progress.body.data.progress, 55)
  assert.equal(progress.body.data.status, 'training')

  const successEvent = { eventId: randomUUID(), occurredAt: now(), status: 'succeeded', stage: 'completed', progress: 100, asset: { format: 'glb', variant: 'mobile-1024', objectKey: `models/${accepted.modelId}/mobile.glb`, fileName: 'chair-mobile.glb', fileSize: 1024000, sha256: 'c'.repeat(64), metadata: { vertices: 12000, faces: 22000 } } }
  const succeeded = await request(base, `/internal/v1/modeling-jobs/${accepted.jobId}/events`, { method: 'POST', headers: { ...jsonHeaders, 'x-training-signature': 'test-signature', 'idempotency-key': 'training-event-0003' }, body: JSON.stringify(successEvent) })
  const succeededReplay = await request(base, `/internal/v1/modeling-jobs/${accepted.jobId}/events`, { method: 'POST', headers: { ...jsonHeaders, 'x-training-signature': 'test-signature', 'idempotency-key': 'training-event-0003' }, body: JSON.stringify(successEvent) })
  assert.equal(succeeded.response.status, 202)
  assert.equal(succeededReplay.body.data.status, 'succeeded')
  assert.equal(state.assets.size, 1, 'Repeated callback must not create another active asset')

  const viewerAfter = await request(base, `/v1/models/${accepted.modelId}/viewer`, { headers: authA })
  assert.equal(viewerAfter.response.status, 200)
  assert.equal(viewerAfter.body.data.modelId, accepted.modelId)
  assert.equal(viewerAfter.body.data.sha256, successEvent.asset.sha256)
  assert.ok(Date.parse(viewerAfter.body.data.expiresAt) > Date.now())

  const orders = await request(base, '/v1/orders', { headers: authA })
  assert.equal(orders.body.data.total, 1)
  assert.equal(orders.body.data.items[0].viewerAvailable, true)
  assert.equal(orders.body.data.items[0].status, 'completed')

  const crossUserOrder = await request(base, `/v1/orders/${accepted.orderId}`, { headers: authB })
  assert.equal(crossUserOrder.response.status, 404, 'Other users must not discover purchased orders')
  const publicViewer = await request(base, `/v1/models/${accepted.modelId}/viewer`, { headers: authB })
  assert.equal(publicViewer.response.status, 200, 'Public completed models are visible to another signed-in user')

  const staleProfile = await request(base, '/v1/users/me', { method: 'PATCH', headers: { ...authA, 'if-match': '"99"' }, body: JSON.stringify({ bio: '新简介' }) })
  assert.equal(staleProfile.response.status, 409)
  const current = await request(base, '/v1/users/me', { headers: authA })
  const updated = await request(base, '/v1/users/me', { method: 'PATCH', headers: { ...authA, 'if-match': current.response.headers.get('etag') }, body: JSON.stringify({ bio: '新简介' }) })
  assert.equal(updated.body.data.bio, '新简介')
  assert.equal(updated.body.data.version, 2)

  const home = await request(base, '/v1/home', { headers: authA })
  assert.equal(home.body.data.currentUser.id, loginA.body.data.user.id)
  assert.equal(home.body.data.featuredModels[0].id, accepted.modelId)
  assert.equal(home.body.data.unreadNotificationCount, 1)
})
