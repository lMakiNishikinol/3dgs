import Taro from '@tarojs/taro'
import { apiRequest } from './request'

export interface PrepareUploadRequest {
  fileName: string
  fileSize: number
  mimeType: string
  durationSeconds?: number
}

export interface PrepareUploadResponse {
  uploadId: string
  objectKey: string
  uploadMode: 'direct'
  partSize: number
  totalParts: number
  expiresAt: string
  status: 'prepared'
}

export interface UploadedPart {
  partNumber: number
  etag: string
  sha256: string
}

export interface UploadSession extends PrepareUploadResponse {
  parts: UploadedPart[]
}

export interface CompleteUploadRequest {
  uploadId: string
  objectKey: string
  parts: UploadedPart[]
  product: {
    title: string
    description: string
    category: string
    price: number
    currency: 'CNY'
    visibility: 'public' | 'private'
  }
  modelObjectName: string
  visibility: 'public' | 'private'
  trainingProfile: 'fast' | 'balanced' | 'quality'
}

export interface CompleteUploadResponse {
  uploadId: string
  productId: string
  orderId: string
  modelId: string
  jobId: string
  status: 'accepted'
}

export function prepareVideoUpload(payload: PrepareUploadRequest): Promise<PrepareUploadResponse> {
  return apiRequest<PrepareUploadResponse, PrepareUploadRequest>({
    path: '/v1/uploads/video/prepare',
    method: 'POST',
    data: payload
  })
}

function readVideoPart(filePath: string, position: number, length: number): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    Taro.getFileSystemManager().readFile({
      filePath,
      position,
      length,
      success: (result) => {
        if (typeof result.data === 'string') reject(new Error('视频分片读取格式错误'))
        else resolve(result.data as ArrayBuffer)
      },
      fail: reject
    })
  })
}

export async function uploadVideoParts(input: {
  filePath: string
  fileName: string
  fileSize: number
  durationSeconds: number
  mimeType: string
  onPrepared?: (uploadId: string) => void
  onProgress?: (progress: number) => void
}): Promise<UploadSession> {
  const prepared = await prepareVideoUpload({
    fileName: input.fileName,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
    durationSeconds: input.durationSeconds
  })
  input.onPrepared?.(prepared.uploadId)
  const parts: UploadedPart[] = []
  for (let partNumber = 1; partNumber <= prepared.totalParts; partNumber += 1) {
    const position = (partNumber - 1) * prepared.partSize
    const length = Math.min(prepared.partSize, input.fileSize - position)
    const data = await readVideoPart(input.filePath, position, length)
    const part = await apiRequest<UploadedPart, ArrayBuffer>({
      path: `/v1/uploads/${encodeURIComponent(prepared.uploadId)}/parts/${partNumber}`,
      method: 'POST',
      data,
      header: { 'content-type': 'application/octet-stream' }
    })
    parts.push(part)
    input.onProgress?.(Math.round((partNumber / prepared.totalParts) * 100))
  }
  return { ...prepared, parts }
}

export function completeVideoUpload(
  session: UploadSession,
  modelObjectName: string,
  visibility: 'public' | 'private'
): Promise<CompleteUploadResponse> {
  const payload: CompleteUploadRequest = {
    uploadId: session.uploadId,
    objectKey: session.objectKey,
    parts: session.parts,
    product: {
      title: modelObjectName,
      description: '通过小程序上传视频创建的 3DGS 建模任务',
      category: '3dgs',
      price: 0,
      currency: 'CNY',
      visibility
    },
    modelObjectName,
    visibility,
    trainingProfile: 'fast'
  }
  return apiRequest<CompleteUploadResponse, CompleteUploadRequest>({
    path: '/v1/uploads/video/complete',
    method: 'POST',
    data: payload
  })
}

export function abortVideoUpload(uploadId: string): Promise<void> {
  return apiRequest<void>({
    path: `/v1/uploads/${encodeURIComponent(uploadId)}`,
    method: 'DELETE'
  })
}
