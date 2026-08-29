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
  uploadUrl: string
  expiresAt: string
  headers: Record<string, string>
}
export interface CompleteUploadRequest {
  uploadId: string
  objectKey: string
  modelObjectName: string
  visibility: 'public' | 'private'
}
export interface CompleteUploadResponse {
  orderId: string
  modelId: string
  status: 'pending'
}
export function prepareVideoUpload(payload: PrepareUploadRequest): Promise<PrepareUploadResponse> {
  return apiRequest<PrepareUploadResponse, PrepareUploadRequest>({
    path: '/v1/uploads/video/prepare',
    method: 'POST',
    data: payload
  })
}
export function completeVideoUpload(payload: CompleteUploadRequest): Promise<CompleteUploadResponse> {
  return apiRequest<CompleteUploadResponse, CompleteUploadRequest>({
    path: '/v1/uploads/video/complete',
    method: 'POST',
    data: payload
  })
}
