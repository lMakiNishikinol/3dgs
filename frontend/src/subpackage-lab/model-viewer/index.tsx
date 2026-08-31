import { useEffect, useRef, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { Canvas, Text, View } from '@tarojs/components'
import { createScopedThreejs } from 'threejs-miniprogram'
import { registerGLTFLoader } from 'threejs-miniprogram/example/loaders/gltf-loader'
import { prepareGlbForMiniProgram, validateGlb } from './glb'
import { createMiniProgramCanvasBridge } from './canvas-bridge'
import { fetchViewerAsset } from '@/services/modelViewer'
import './index.less'


type ViewerStatus = 'loading' | 'empty' | 'ready' | 'error'
type LoadingStage = 'idle' | 'requesting' | 'downloading' | 'reading' | 'textures' | 'canvas' | 'parsing'
type ControlMode = 'orbit' | 'rotate-x' | 'rotate-y' | 'rotate-z' | 'move-y'
type AxisKey = 'x' | 'y' | 'z'
type AxisVisibility = Record<AxisKey, boolean>
type SourceMode = 'product' | 'local'
type ModelMeta = {
  name: string
  size: number
  version: string
  embeddedImages: number
  vertices: number
  faces: number
  dimensions: [number, number, number]
}
type ViewerRuntime = {
  THREE: any
  canvas: any
  renderer: any
  root: any
  scene: any
  camera: any
  orientation: any
  readoutEuler: any
  axes?: Record<AxisKey, any>
  grid?: any
  frame?: number
  rotationX: number
  rotationY: number
  rotationZ: number
  viewportLeft: number
  viewportTop: number
  viewportWidth: number
  viewportHeight: number
  objectOffsetY: number
  distance: number
  fitDistance: number
  lastTouch?: { x: number; y: number }
  lastArcball?: any
  lastPinchDistance?: number
}

const READ_TIMEOUT_MS = 60000
const CANVAS_TIMEOUT_MS = 15000
const PARSE_TIMEOUT_MS = 120000
const STAGE_LABELS: Record<LoadingStage, string> = {
  idle: '正在准备场景…',
  requesting: '正在获取模型信息…',
  downloading: '正在下载模型…',
  reading: '正在读取 GLB 文件…',
  textures: '正在处理内嵌纹理…',
  canvas: '正在初始化 3D 画布…',
  parsing: '正在解析模型并生成材质…'
}

const CONTROL_LABELS: Record<ControlMode, string> = {
  orbit: '自由旋转',
  'rotate-x': 'X 轴旋转',
  'rotate-y': 'Y 轴旋转',
  'rotate-z': 'Z 轴旋转',
  'move-y': 'Y 轴移动'
}

function errorText(error: unknown) {
  return String((error as any)?.errMsg || (error as any)?.message || error || '未知错误')
    .replace(/^Error:\s*/i, '')
    .slice(0, 160)
}

function readGlb(filePath: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    Taro.getFileSystemManager().readFile({
      filePath,
      success: (result) => resolve(result.data as ArrayBuffer),
      fail: reject
    })
  })
}

function writeBinary(filePath: string, data: ArrayBuffer) {
  return new Promise<void>((resolve, reject) => {
    Taro.getFileSystemManager().writeFile({ filePath, data, success: () => resolve(), fail: reject })
  })
}


function unlinkQuietly(filePath: string) {
  if (!filePath) return
  Taro.getFileSystemManager().unlink({ filePath, fail: () => undefined })
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), milliseconds)
    promise.then((value) => {
      clearTimeout(timer)
      resolve(value)
    }, (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}


function disposeObject(object: any) {
  object?.traverse?.((node: any) => {
    node.geometry?.dispose?.()
    const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : []
    materials.forEach((material: any) => {
      Object.keys(material).forEach((key) => material[key]?.isTexture && material[key].dispose?.())
      material.dispose?.()
    })
  })
}

function displayDegrees(radians: number) {
  const degrees = radians * 180 / Math.PI
  const normalized = ((degrees + 180) % 360 + 360) % 360 - 180
  return Math.abs(normalized) < 0.05 ? 0 : normalized
}

function angleText(value: number) {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(1)}°`
}

export default function ModelViewerPage() {
  const router = useRouter()
  const runtime = useRef<ViewerRuntime | null>(null)
  const downloadedFile = useRef('')
  const sourceRequestId = useRef(0)
  const [status, setStatus] = useState<ViewerStatus>('loading')
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('requesting')
  const [meta, setMeta] = useState<ModelMeta | null>(null)
  const [showInfo, setShowInfo] = useState(true)
  const [toolRailOpen, setToolRailOpen] = useState(false)
  const [controlMode, setControlMode] = useState<ControlMode>('orbit')
  const [axisVisibility, setAxisVisibility] = useState<AxisVisibility>({ x: false, y: false, z: false })
  const [gridVisible, setGridVisible] = useState(true)
  const [rotationDegrees, setRotationDegrees] = useState<[number, number, number]>([displayDegrees(0.12), displayDegrees(0.35), 0])
  const axisVisibilityRef = useRef<AxisVisibility>({ x: false, y: false, z: false })
  const gridVisibleRef = useRef(true)
  const lastRotationReportAt = useRef(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [sourceMode, setSourceMode] = useState<SourceMode>('product')
  const [sourceRevision, setSourceRevision] = useState(0)
  const [selectingLocal, setSelectingLocal] = useState(false)
  const [sourcePath, setSourcePath] = useState('')
  const [sourceName, setSourceName] = useState('model.glb')
  const [expectedSize, setExpectedSize] = useState(0)
  const [loadedSize, setLoadedSize] = useState(0)
  const modelId = router.params.modelId ? decodeURIComponent(router.params.modelId) : ''
  const displayedSize = meta?.size || loadedSize || expectedSize
  const [menuButtonReserve] = useState(() => {
    try {
      const rect = Taro.getMenuButtonBoundingClientRect()
      const width = Taro.getWindowInfo().windowWidth
      return Math.max(76, Math.ceil(width - rect.left + 8))
    } catch {
      return 88
    }
  })

  const syncRotationReadout = (viewer: ViewerRuntime, force = false) => {
    viewer.readoutEuler.setFromQuaternion(viewer.orientation, 'XYZ')
    viewer.rotationX = viewer.readoutEuler.x
    viewer.rotationY = viewer.readoutEuler.y
    viewer.rotationZ = viewer.readoutEuler.z
    const now = Date.now()
    if (!force && now - lastRotationReportAt.current < 80) return
    lastRotationReportAt.current = now
    setRotationDegrees([displayDegrees(viewer.rotationX), displayDegrees(viewer.rotationY), displayDegrees(viewer.rotationZ)])
  }

  useEffect(() => () => unlinkQuietly(downloadedFile.current), [])

  useEffect(() => {
    if (sourceMode !== 'product') return undefined
    let cancelled = false
    let task: any
    const requestId = ++sourceRequestId.current
    const stale = () => cancelled || requestId !== sourceRequestId.current

    const requestAndDownload = async () => {
      setStatus('loading')
      setLoadingStage('requesting')
      setErrorMessage('')
      setMeta(null)
      setLoadedSize(0)
      setExpectedSize(0)
      setSourcePath('')
      if (!modelId) {
        setErrorMessage('缺少模型编号，请从商品详情页重新进入')
        setStatus('error')
        return
      }
      try {
        const asset = await fetchViewerAsset(modelId)
        if (stale()) return
        if (asset.format !== 'glb') throw new Error('MODEL_FORMAT_UNSUPPORTED')
        if (asset.expiresAt && Date.parse(asset.expiresAt) <= Date.now()) throw new Error('MODEL_SIGNATURE_EXPIRED')
        setSourceName(asset.fileName || `${modelId}.glb`)
        setExpectedSize(asset.fileSize || 0)
        setLoadingStage('downloading')
        const download = await new Promise<any>((resolve, reject) => {
          task = Taro.downloadFile({
            url: asset.modelUrl,
            timeout: 60000,
            header: {
              ...(Taro.getStorageSync<string>('accessToken') ? { authorization: 'Bearer ' + Taro.getStorageSync<string>('accessToken') } : {})
            },
            success: resolve,
            fail: reject
          })
        })
        if (stale()) return
        if (download.statusCode < 200 || download.statusCode >= 300) throw new Error(`MODEL_DOWNLOAD_HTTP_${download.statusCode}`)
        if (!download.tempFilePath) throw new Error('MODEL_DOWNLOAD_EMPTY')
        unlinkQuietly(downloadedFile.current)
        downloadedFile.current = download.tempFilePath
        setSourcePath(download.tempFilePath)
      } catch (error) {
        if (stale()) return
        console.error('[GLBViewer] asset request/download failed', { modelId, message: errorText(error) })
        const message = errorText(error)
        const friendly = message.includes('MODEL_ASSET_NOT_READY') ? '模型仍在生成，请稍后重试'
          : message.includes('MODEL_FORBIDDEN') || message.includes('HTTP_403') ? '你没有权限查看这个模型'
            : message.includes('MODEL_NOT_FOUND') || message.includes('HTTP_404') ? '未找到该商品对应的模型'
              : message.includes('MODEL_SIGNATURE_EXPIRED') ? '模型地址已过期，请重新获取'
                : `模型获取失败：${message}`
        setErrorMessage(friendly)
        setStatus('error')
      }
    }

    void requestAndDownload()
    return () => {
      cancelled = true
      task?.abort?.()
    }
  }, [modelId, reloadKey, sourceMode])

  useEffect(() => {
    if (!sourcePath) return undefined
    let disposed = false
    let parseTimer: ReturnType<typeof setTimeout> | undefined
    let canvasTimer: ReturnType<typeof setTimeout> | undefined
    const textureFiles: string[] = []

    const logFailure = (stage: string, error: unknown) => console.error(`[GLBViewer] ${stage} failed`, error)
    const finish = (nextStatus: ViewerStatus, message = '') => {
      if (disposed) return
      if (parseTimer) clearTimeout(parseTimer)
      if (canvasTimer) clearTimeout(canvasTimer)
      setErrorMessage(message)
      setStatus(nextStatus)
    }

    const initializeViewer = (data: ArrayBuffer, originalSize: number, version: string, embeddedImages: number) => {
      setLoadingStage('canvas')
      canvasTimer = setTimeout(() => finish('error', '3D 画布初始化超时，请确认当前为真机 WebGL 环境'), CANVAS_TIMEOUT_MS)
      Taro.nextTick(() => {
        const query = Taro.createSelectorQuery()
        query.select('#model-viewer-canvas').fields({ node: true, size: true, rect: true })
        query.exec((result) => {
          if (disposed) return
          if (canvasTimer) clearTimeout(canvasTimer)
          const canvasInfo = result?.[0]
          const canvas = canvasInfo?.node
          if (!canvas) {
            finish('error', 'Canvas 初始化失败；Skyline 模拟器不支持调试该节点，请使用真机')
            return
          }

          try {
            const width = Math.max(1, Number(canvasInfo.width) || 375)
            const height = Math.max(1, Number(canvasInfo.height) || 650)
            const viewportLeft = Number(canvasInfo.left) || 0
            const viewportTop = Number(canvasInfo.top) || 0
            const pixelRatio = Math.min(2, Taro.getWindowInfo().pixelRatio || 1)
            const context = canvas.getContext('webgl')
            if (!context) throw new Error('当前设备无法创建 WebGL context')
            const canvasBridge = createMiniProgramCanvasBridge(canvas)
            const THREE = createScopedThreejs(canvasBridge)
            registerGLTFLoader(THREE)
            const renderer = new THREE.WebGLRenderer({ canvas: canvasBridge, context, antialias: true, alpha: false })
            renderer.setPixelRatio(pixelRatio)
            renderer.setSize(width, height, false)
            renderer.setClearColor(0x111318, 1)
            console.info('[GLBViewer] canvas ready', { width, height, pixelRatio, nativeStyleConfigurable: Object.getOwnPropertyDescriptor(canvas, 'style')?.configurable ?? null })
            if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding

            const scene = new THREE.Scene()
            scene.add(new THREE.HemisphereLight(0xffffff, 0x20242e, 1.8))
            const light = new THREE.DirectionalLight(0xffffff, 2)
            light.position.set(3, 5, 4)
            scene.add(light)
            const camera = new THREE.PerspectiveCamera(35, width / height, 0.01, 1000)
            camera.position.z = 3
            const root = new THREE.Group()
            scene.add(root)

            const readoutEuler = new THREE.Euler(0.12, 0.35, 0, 'XYZ')
            const orientation = new THREE.Quaternion().setFromEuler(readoutEuler)
            const viewer: ViewerRuntime = {
              THREE,
              canvas,
              renderer,
              root,
              scene,
              camera,
              orientation,
              readoutEuler,
              rotationX: readoutEuler.x,
              rotationY: readoutEuler.y,
              rotationZ: readoutEuler.z,
              viewportLeft,
              viewportTop,
              viewportWidth: width,
              viewportHeight: height,
              objectOffsetY: 0,
              distance: 3,
              fitDistance: 3
            }
            runtime.current = viewer
            const render = () => {
              if (disposed) return
              root.quaternion.copy(viewer.orientation)
              root.position.y = viewer.objectOffsetY
              camera.position.z = viewer.distance
              camera.lookAt(0, 0, 0)
              renderer.render(scene, camera)
              viewer.frame = canvas.requestAnimationFrame(render)
            }
            render()

            setLoadingStage('parsing')
            parseTimer = setTimeout(() => {
              logFailure('parse', new Error(`timeout after ${PARSE_TIMEOUT_MS}ms`))
              finish('error', '模型解析超过 120 秒；请查看调试日志中的 [GLBViewer] 详情')
            }, PARSE_TIMEOUT_MS)
            const loader = new THREE.GLTFLoader()
            loader.parse(data, '', (gltf: any) => {
              if (disposed) return
              root.add(gltf.scene)
              const box = new THREE.Box3().setFromObject(gltf.scene)
              if (box.isEmpty()) {
                finish('error', 'GLB 解析成功，但场景中没有可显示的网格')
                return
              }
              const size = box.getSize(new THREE.Vector3())
              const center = box.getCenter(new THREE.Vector3())
              gltf.scene.position.sub(center)

              let vertices = 0
              let faces = 0
              gltf.scene.traverse((node: any) => {
                const geometry = node.geometry
                if (!geometry) return
                vertices += geometry.attributes.position?.count || 0
                faces += geometry.index ? Math.floor(geometry.index.count / 3) : Math.floor((geometry.attributes.position?.count || 0) / 3)
              })

              const maxSize = Math.max(size.x, size.y, size.z)
              viewer.fitDistance = Math.max(1.8, (maxSize * 0.7) / Math.tan((camera.fov * Math.PI) / 360))
              viewer.distance = viewer.fitDistance
              camera.near = Math.max(0.001, viewer.fitDistance / 100)
              camera.far = Math.max(1000, viewer.fitDistance * 100)
              camera.updateProjectionMatrix()
              const helperSize = Math.max(0.2, maxSize * 0.34)
              const grid = new THREE.GridHelper(Math.max(4, maxSize * 2), 16, 0x465161, 0x242a34)
              grid.position.y = -size.y / 2
              grid.visible = gridVisibleRef.current
              grid.renderOrder = 1
              const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
              gridMaterials.forEach((material: any) => {
                material.depthTest = false
                material.depthWrite = false
                material.transparent = true
                material.opacity = 0.58
              })
              scene.add(grid)
              viewer.grid = grid
              const makeAxis = (axis: AxisKey, color: number) => {
                const group = new THREE.Group()
                const shaftLength = helperSize * 0.76
                const headLength = helperSize - shaftLength
                const material = new THREE.MeshBasicMaterial({ color })
                material.depthTest = false
                material.depthWrite = false
                const shaft = new THREE.Mesh(
                  new THREE.CylinderGeometry(helperSize * 0.012, helperSize * 0.012, shaftLength, 10),
                  material
                )
                shaft.position.y = shaftLength / 2
                const head = new THREE.Mesh(
                  new THREE.ConeGeometry(helperSize * 0.055, headLength, 12),
                  material
                )
                head.position.y = shaftLength + headLength / 2
                ;[shaft, head].forEach((part: any) => {
                  part.renderOrder = 2
                })
                group.add(shaft)
                group.add(head)
                if (axis === 'x') group.rotation.z = -Math.PI / 2
                else if (axis === 'z') group.rotation.x = Math.PI / 2
                group.visible = axisVisibilityRef.current[axis]
                root.add(group)
                return group
              }
              const axes = {
                x: makeAxis('x', 0xff5563),
                y: makeAxis('y', 0x55d676),
                z: makeAxis('z', 0x5685ff)
              }
              viewer.axes = axes
              syncRotationReadout(viewer, true)
              setMeta({ name: sourceName, size: originalSize, version, embeddedImages, vertices, faces, dimensions: [size.x, size.y, size.z] })
              console.info('[GLBViewer] model ready', { name: sourceName, bytes: originalSize, vertices, faces, embeddedImages })
              finish('ready')
            }, (error: unknown) => {
              logFailure('parse', error)
              finish('error', `GLB 解析失败：${errorText(error)}`)
            })
          } catch (error) {
            logFailure('canvas', error)
            finish('error', `3D 场景初始化失败：${errorText(error)}`)
          }
        })
      })
    }

    const load = async () => {
      setStatus('loading')
      setLoadingStage('reading')
      setErrorMessage('')
      setMeta(null)
      setLoadedSize(0)
      try {
        const originalData = await withTimeout(readGlb(sourcePath), READ_TIMEOUT_MS, '读取文件超过 60 秒')
        if (disposed) return
        const header = validateGlb(originalData)
        setLoadedSize(originalData.byteLength)
        setLoadingStage(header.embeddedImageCount ? 'textures' : 'canvas')
        const session = `${Date.now()}-${Math.floor(Math.random() * 100000)}`
        const prepared = await prepareGlbForMiniProgram(
          originalData,
          (index, extension) => `${Taro.env.USER_DATA_PATH}/glb-viewer-${session}-texture-${index}.${extension}`,
          writeBinary
        )
        if (disposed) {
          prepared.temporaryFiles.forEach(unlinkQuietly)
          return
        }
        textureFiles.push(...prepared.temporaryFiles)
        initializeViewer(prepared.data, originalData.byteLength, prepared.version, prepared.embeddedImageCount)
      } catch (error) {
        logFailure('file pipeline', error)
        finish('error', `模型文件处理失败：${errorText(error)}`)
      }
    }

    void load()
    return () => {
      disposed = true
      if (parseTimer) clearTimeout(parseTimer)
      if (canvasTimer) clearTimeout(canvasTimer)
      textureFiles.forEach(unlinkQuietly)
      const viewer = runtime.current
      if (viewer?.frame) viewer.canvas.cancelAnimationFrame(viewer.frame)
      disposeObject(viewer?.scene)
      viewer?.renderer?.dispose()
      runtime.current = null
    }
  }, [sourceName, sourcePath, sourceRevision])

  const clampDistance = (viewer: ViewerRuntime, distance: number) => Math.max(viewer.fitDistance * 0.15, Math.min(viewer.fitDistance * 5, distance))
  const zoom = (direction: number) => {
    const viewer = runtime.current
    if (viewer) viewer.distance = clampDistance(viewer, viewer.distance + direction * viewer.fitDistance * 0.12)
  }
  const reset = () => {
    const viewer = runtime.current
    if (!viewer) return
    viewer.readoutEuler.set(0.12, 0.35, 0, 'XYZ')
    viewer.orientation.setFromEuler(viewer.readoutEuler).normalize()
    viewer.objectOffsetY = 0
    viewer.distance = viewer.fitDistance
    setControlMode('orbit')
    syncRotationReadout(viewer, true)
  }
  const selectControlMode = (mode: ControlMode) => {
    setControlMode(mode)
    void Taro.showToast({ title: CONTROL_LABELS[mode], icon: 'none', duration: 900 })
  }
  const setStandardView = (view: 'front' | 'right' | 'top' | 'iso') => {
    const viewer = runtime.current
    if (!viewer) return
    const rotations = {
      front: [0, 0, 0],
      right: [0, -Math.PI / 2, 0],
      top: [-Math.PI / 2, 0, 0],
      iso: [-0.55, 0.75, 0]
    } as const
    const [x, y, z] = rotations[view]
    viewer.readoutEuler.set(x, y, z, 'XYZ')
    viewer.orientation.setFromEuler(viewer.readoutEuler).normalize()
    viewer.objectOffsetY = 0
    syncRotationReadout(viewer, true)
    const labels = { front: '正视图', right: '右视图', top: '顶视图', iso: '等轴测视图' }
    void Taro.showToast({ title: labels[view], icon: 'none', duration: 900 })
  }
  const toggleAxis = (axis: AxisKey) => {
    setAxisVisibility((current) => {
      const next = { ...current, [axis]: !current[axis] }
      axisVisibilityRef.current = next
      if (runtime.current?.axes?.[axis]) runtime.current.axes[axis].visible = next[axis]
      return next
    })
  }
  const toggleGrid = () => {
    setGridVisible((current) => {
      const next = !current
      gridVisibleRef.current = next
      if (runtime.current?.grid) runtime.current.grid.visible = next
      return next
    })
  }
  const arcballPoint = (touch: any, viewer: ViewerRuntime) => {
    const x = ((touch.clientX - viewer.viewportLeft) / viewer.viewportWidth) * 2 - 1
    const y = 1 - ((touch.clientY - viewer.viewportTop) / viewer.viewportHeight) * 2
    const lengthSquared = x * x + y * y
    if (lengthSquared > 1) return new viewer.THREE.Vector3(x, y, 0).normalize()
    return new viewer.THREE.Vector3(x, y, Math.sqrt(1 - lengthSquared))
  }
  const rotateOnLocalAxis = (viewer: ViewerRuntime, axis: AxisKey, angle: number) => {
    const directions = {
      x: [1, 0, 0],
      y: [0, 1, 0],
      z: [0, 0, 1]
    } as const
    const direction = directions[axis]
    const vector = new viewer.THREE.Vector3(direction[0], direction[1], direction[2])
    const delta = new viewer.THREE.Quaternion().setFromAxisAngle(vector, angle)
    viewer.orientation.multiply(delta).normalize()
  }
  const pinchDistance = (touches: any[]) => {
    const [a, b] = touches
    if (!a || !b) return 0
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)
  }
  const touchStart = (event: any) => {
    const touches = event.touches || []
    const viewer = runtime.current
    if (!viewer) return
    if (touches.length >= 2) {
      viewer.lastPinchDistance = pinchDistance(touches)
      viewer.lastTouch = undefined
      viewer.lastArcball = undefined
      return
    }
    const touch = touches[0]
    if (touch) {
      viewer.lastTouch = { x: touch.clientX, y: touch.clientY }
      viewer.lastArcball = controlMode === 'orbit' ? arcballPoint(touch, viewer) : undefined
    }
  }
  const touchMove = (event: any) => {
    const viewer = runtime.current
    const touches = event.touches || []
    if (!viewer) return
    if (touches.length >= 2) {
      const current = pinchDistance(touches)
      if (viewer.lastPinchDistance && current > 0) viewer.distance = clampDistance(viewer, viewer.distance * viewer.lastPinchDistance / current)
      viewer.lastPinchDistance = current
      viewer.lastTouch = undefined
      viewer.lastArcball = undefined
      return
    }
    const touch = touches[0]
    if (!touch || !viewer?.lastTouch) return
    const dx = touch.clientX - viewer.lastTouch.x
    const dy = touch.clientY - viewer.lastTouch.y
    if (controlMode === 'rotate-x') rotateOnLocalAxis(viewer, 'x', dy * 0.012)
    else if (controlMode === 'rotate-y') rotateOnLocalAxis(viewer, 'y', dx * 0.012)
    else if (controlMode === 'rotate-z') rotateOnLocalAxis(viewer, 'z', dx * 0.012)
    else if (controlMode === 'move-y') viewer.objectOffsetY -= dy * viewer.fitDistance * 0.0025
    else {
      const currentArcball = arcballPoint(touch, viewer)
      if (viewer.lastArcball) {
        const delta = new viewer.THREE.Quaternion().setFromUnitVectors(viewer.lastArcball, currentArcball)
        viewer.orientation.premultiply(delta).normalize()
      }
      viewer.lastArcball = currentArcball
    }
    if (controlMode !== 'move-y') syncRotationReadout(viewer)
    viewer.lastTouch = { x: touch.clientX, y: touch.clientY }
  }
  const touchEnd = (event: any) => {
    const viewer = runtime.current
    if (!viewer) return
    viewer.lastPinchDistance = undefined
    const touch = event.touches?.[0]
    viewer.lastTouch = touch ? { x: touch.clientX, y: touch.clientY } : undefined
    viewer.lastArcball = touch && controlMode === 'orbit' ? arcballPoint(touch, viewer) : undefined
  }

  const chooseLocalGlb = async () => {
    if (selectingLocal) return
    setSelectingLocal(true)
    try {
      const result = await Taro.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['glb']
      })
      const file = (result as any)?.tempFiles?.[0]
      if (!file) return
      const localName = String(file.name || 'local-model.glb').trim()
      const localPath = String(file.path || file.tempFilePath || '')
      if (!localName.toLowerCase().endsWith('.glb')) {
        void Taro.showToast({ title: '请选择 GLB 文件', icon: 'none' })
        return
      }
      if (!localPath) throw new Error('LOCAL_GLB_PATH_EMPTY')

      sourceRequestId.current += 1
      setSourceMode('local')
      setSourceName(localName)
      setExpectedSize(Math.max(0, Number(file.size) || 0))
      setLoadedSize(0)
      setMeta(null)
      setErrorMessage('')
      setStatus('loading')
      setLoadingStage('reading')
      setSourcePath(localPath)
      setSourceRevision((value) => value + 1)
    } catch (error) {
      const message = errorText(error)
      if (/cancel/i.test(message)) return
      console.error('[GLBViewer] local file selection failed', error)
      void Taro.showToast({ title: `选择失败：${message.slice(0, 24)}`, icon: 'none' })
    } finally {
      setSelectingLocal(false)
    }
  }

  const loadingLabel = STAGE_LABELS[loadingStage]
  const sourceLabel = sourceMode === 'local' ? '本机测试文件' : '商品模型'
  return <View className='page model-viewer-page'>
    <View className='model-viewer-topbar'>
      <View className='model-viewer-back' onClick={() => void Taro.navigateBack()}><Text>‹</Text></View>
      <View className='model-viewer-brand'><Text className='model-viewer-brand__eyebrow'>3D MODEL</Text><Text className='model-viewer-brand__title'>模型查看器</Text></View>
      <View
        className={`model-viewer-local-trigger ${selectingLocal ? 'is-loading' : ''}`}
        style={{ marginRight: `${menuButtonReserve}px` }}
        hoverClass='is-pressed'
        ariaRole='button'
        ariaLabel='选择本机 GLB 测试文件'
        onClick={() => void chooseLocalGlb()}
      >
        <Text className='model-viewer-local-trigger__label'>{selectingLocal ? '选择中' : '本机 GLB'}</Text>
        <Text className='model-viewer-local-trigger__badge'>TEST</Text>
      </View>
    </View>

    <View className='model-viewer-workspace'>
      <View className={`model-viewer-tool-rail ${toolRailOpen ? 'model-viewer-tool-rail--open' : ''}`}>
        {toolRailOpen && <View className='model-viewer-tool-list'>
          <View className={`model-viewer-tool-button tool-mode-orbit ${controlMode === 'orbit' ? 'is-active' : ''}`} onClick={() => selectControlMode('orbit')}><Text>◎</Text></View>
          <View className={`model-viewer-tool-button tool-mode-x ${controlMode === 'rotate-x' ? 'is-active' : ''}`} onClick={() => selectControlMode('rotate-x')}><Text>X</Text></View>
          <View className={`model-viewer-tool-button tool-mode-y ${controlMode === 'rotate-y' ? 'is-active' : ''}`} onClick={() => selectControlMode('rotate-y')}><Text>Y</Text></View>
          <View className={`model-viewer-tool-button tool-mode-z ${controlMode === 'rotate-z' ? 'is-active' : ''}`} onClick={() => selectControlMode('rotate-z')}><Text>Z</Text></View>
          <View className={`model-viewer-tool-button tool-mode-move-y ${controlMode === 'move-y' ? 'is-active' : ''}`} onClick={() => selectControlMode('move-y')}><Text>↕</Text></View>
          <View className='model-viewer-tool-button tool-view-front' onClick={() => setStandardView('front')}><Text>正</Text></View>
          <View className='model-viewer-tool-button tool-view-right' onClick={() => setStandardView('right')}><Text>右</Text></View>
          <View className='model-viewer-tool-button tool-view-top' onClick={() => setStandardView('top')}><Text>顶</Text></View>
          <View className='model-viewer-tool-button tool-view-iso' onClick={() => setStandardView('iso')}><Text>◇</Text></View>
          <View className='model-viewer-tool-button tool-reset' onClick={reset}><Text>0</Text></View>
        </View>}
      </View>
      <View className='model-viewer-stage'>
        <Canvas id='model-viewer-canvas' type='webgl' className='model-viewer-canvas' onTouchStart={touchStart} onTouchMove={touchMove} onTouchEnd={touchEnd} />
        {status === 'error' && <View className='model-viewer-empty'>
          <Text className='model-viewer-empty__mark'>◈</Text>
          <Text className='model-viewer-empty__title'>模型暂不可用</Text>
          <Text className='model-viewer-empty__copy'>{errorMessage}</Text>
          <View className='model-viewer-empty__retry' onClick={() => sourceMode === 'local' ? void chooseLocalGlb() : setReloadKey((value) => value + 1)}><Text>{sourceMode === 'local' ? '重新选择' : '重新获取'}</Text></View>
        </View>}
        {status === 'loading' && <View className='model-viewer-empty model-viewer-loading'><Text className='model-viewer-loading__dot'>◈</Text><Text>{loadingLabel}</Text><Text className='model-viewer-empty__copy'>{sourceName}{displayedSize ? ` · ${(displayedSize / 1048576).toFixed(1)} MB` : ''}</Text></View>}
      </View>
      <View className={`model-viewer-tool-rail model-viewer-tool-rail--right ${toolRailOpen ? 'model-viewer-tool-rail--open' : ''}`}>
        {toolRailOpen && <View className='model-viewer-tool-list model-viewer-tool-list--axis'>
          <View className={`model-viewer-tool-button tool-axis-x ${axisVisibility.x ? 'is-active' : ''}`} onClick={() => toggleAxis('x')}><Text>X</Text></View>
          <View className={`model-viewer-tool-button tool-axis-y ${axisVisibility.y ? 'is-active' : ''}`} onClick={() => toggleAxis('y')}><Text>Y</Text></View>
          <View className={`model-viewer-tool-button tool-axis-z ${axisVisibility.z ? 'is-active' : ''}`} onClick={() => toggleAxis('z')}><Text>Z</Text></View>
          <View className={`model-viewer-tool-button tool-toggle-grid ${gridVisible ? 'is-active' : ''}`} onClick={toggleGrid}><Text>网</Text></View>
        </View>}
      </View>
    </View>
    <View className='model-viewer-actionbar'>
      <View className='model-viewer-tool-toggle model-viewer-tool-toggle--actionbar' onClick={() => setToolRailOpen((value) => !value)}><Text>{toolRailOpen ? '×' : '☷'}</Text></View>
      <View className='model-viewer-actions'>
        <View className='model-viewer-action model-viewer-zoom-out' onClick={() => zoom(1)}><Text>−</Text></View>
        <View className='model-viewer-action model-viewer-zoom-in' onClick={() => zoom(-1)}><Text>＋</Text></View>
        <View className='model-viewer-action model-viewer-fit' onClick={() => { if (runtime.current) runtime.current.distance = runtime.current.fitDistance }}><Text>FIT</Text></View>
        <View className='model-viewer-action model-viewer-reset' onClick={reset}><Text>↺</Text></View>
      </View>
    </View>
    <View className='model-viewer-bottom'>
      <View><Text>{meta?.name || sourceName}</Text><Text className='model-viewer-sub'>{meta ? `${(meta.size / 1048576).toFixed(1)} MB · GLB ${meta.version} · ${sourceLabel}` : displayedSize ? `${(displayedSize / 1048576).toFixed(1)} MB · ${loadingLabel} · ${sourceLabel}` : `等待模型资源 · ${sourceLabel}`}</Text></View>
      <View className='model-viewer-toggle' onClick={() => setShowInfo((value) => !value)}><Text>{showInfo ? '隐藏信息' : '模型信息'}</Text></View>
    </View>
    {showInfo && <View className='model-viewer-info'>
      <View className='model-viewer-rotation-readout'>
        <Text className='model-viewer-rotation model-viewer-rotation--x'>X旋转 {angleText(rotationDegrees[0])}</Text>
        <Text className='model-viewer-rotation model-viewer-rotation--y'>Y旋转 {angleText(rotationDegrees[1])}</Text>
        <Text className='model-viewer-rotation model-viewer-rotation--z'>Z旋转 {angleText(rotationDegrees[2])}</Text>
      </View>
      <View className='model-viewer-stats'>
        <Text>顶点 {meta?.vertices ?? '—'}</Text><Text>三角面 {meta?.faces ?? '—'}</Text><Text>纹理 {meta?.embeddedImages ?? '—'}</Text><Text>尺寸 {meta?.dimensions ? meta.dimensions.map((value) => value.toFixed(2)).join(' × ') : '—'}</Text>
      </View>
    </View>}
  </View>
}
