import { apiRequest, hasBackend } from './request'

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
  localPath?: string
  expiresAt: string
  fileName: string
  fileSize: number | null
  metadata: ViewerAssetMeta
}

type SeedAsset = { name: string; fileSize: number }

// 仅供当前无后端环境联调。生产环境始终由 /v1/models/{modelId}/viewer 返回短期签名 URL。
const seedAssets: SeedAsset[] = [
  { name: 'Box', fileSize: 1664 },
  { name: 'BoxAnimated', fileSize: 11944 },
  { name: 'BoxInterleaved', fileSize: 1632 },
  { name: 'BoxTextured', fileSize: 5956 },
  { name: 'AnimatedMorphCube', fileSize: 6752 },
  { name: 'DirectionalLight', fileSize: 453520 },
  { name: 'EmissiveStrengthTest', fileSize: 10668 },
  { name: 'RiggedFigure', fileSize: 50116 },
  { name: 'RiggedSimple', fileSize: 15104 },
  { name: 'TextureSettingsTest', fileSize: 42840 },
  { name: 'UnlitTest', fileSize: 3992 },
  { name: 'VertexColorTest', fileSize: 26220 }
]

function mockViewerAsset(modelId: string): ViewerAsset {
  const parsed = Number(modelId.match(/(\d+)$/)?.[1] ?? 1)
  const asset = seedAssets[(Math.max(1, parsed) - 1) % seedAssets.length]
  return {
    modelId,
    format: 'glb',
    modelUrl: '',
    localPath: `/subpackage-lab/seed-assets/${asset.name}.glb`,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    fileName: `${asset.name}.glb`,
    fileSize: asset.fileSize,
    metadata: {
      vertices: null,
      faces: null,
      dimensions: null,
      unit: null,
      animations: null,
      textures: null
    }
  }
}

export async function fetchViewerAsset(modelId: string): Promise<ViewerAsset> {
  if (!hasBackend) return mockViewerAsset(modelId)
  return apiRequest<ViewerAsset>({ path: '/v1/models/' + encodeURIComponent(modelId) + '/viewer' })
}