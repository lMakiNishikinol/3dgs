import { API_BASE_URL, apiRequest } from './request'

export interface ViewerAssetMeta {
  vertices: number | null
  faces: number | null
  dimensions: { x: number; y: number; z: number } | null
  unit: string | null
  animations: number | null
  textures: number | null
}

export interface ViewerAsset {
  modelId: string
  format: 'glb'
  modelUrl: string
  expiresAt?: string
  fileName: string
  fileSize: number | null
  metadata: ViewerAssetMeta
}

interface BackendViewerAsset {
  modelId: string
  format: 'glb'
  url?: string | null
  modelUrl?: string | null
  available?: boolean
  expiresAt?: string
  fileName?: string
  fileSize?: number | null
  metadata?: ViewerAssetMeta
}

export async function fetchViewerAsset(modelId: string): Promise<ViewerAsset> {
  const asset = await apiRequest<BackendViewerAsset>({
    path: '/v1/models/' + encodeURIComponent(modelId) + '/viewer'
  })
  const sourceUrl = asset.modelUrl || asset.url
  if (asset.available === false || !sourceUrl) throw new Error('MODEL_ASSET_NOT_READY')
  const modelUrl = /^https?:\/\//i.test(sourceUrl)
    ? sourceUrl
    : API_BASE_URL.replace(/\/$/, '') + (sourceUrl.startsWith('/') ? sourceUrl : '/' + sourceUrl)
  return {
    modelId: asset.modelId || modelId,
    format: 'glb',
    modelUrl,
    expiresAt: asset.expiresAt,
    fileName: asset.fileName || `${modelId}.glb`,
    fileSize: asset.fileSize ?? null,
    metadata: asset.metadata ?? {
      vertices: null,
      faces: null,
      dimensions: null,
      unit: null,
      animations: null,
      textures: null
    }
  }
}
