import fs from 'node:fs'
import path from 'node:path'

const JSON_CHUNK = 0x4e4f534a
const BIN_CHUNK = 0x004e4942

function imageSize(bytes, mimeType = '') {
  if (mimeType === 'image/png' && bytes.length >= 24 && bytes.toString('ascii', 1, 4) === 'PNG') {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
  }
  if (mimeType === 'image/jpeg' && bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue }
      const marker = bytes[offset + 1]
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) }
      }
      if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue }
      offset += 2 + bytes.readUInt16BE(offset + 2)
    }
  }
  return null
}

function primitiveTriangles(primitive, accessors) {
  const accessorIndex = primitive.indices ?? primitive.attributes?.POSITION
  const count = accessors?.[accessorIndex]?.count ?? 0
  const mode = primitive.mode ?? 4
  if (mode === 4) return Math.floor(count / 3)
  if (mode === 5 || mode === 6) return Math.max(0, count - 2)
  return 0
}

function inspect(filePath) {
  const data = fs.readFileSync(filePath)
  if (data.length < 20) throw new Error('文件小于 20 字节')
  if (data.toString('ascii', 0, 4) !== 'glTF') throw new Error('magic 不是 glTF')
  const version = data.readUInt32LE(4)
  const declaredLength = data.readUInt32LE(8)
  if (version !== 2) throw new Error(`仅支持 GLB 2.0，当前为 ${version}`)
  if (declaredLength !== data.length) throw new Error(`声明长度 ${declaredLength} 与实际 ${data.length} 不一致`)

  const chunks = []
  let offset = 12
  while (offset + 8 <= data.length) {
    const byteLength = data.readUInt32LE(offset)
    const type = data.readUInt32LE(offset + 4)
    const start = offset + 8
    const end = start + byteLength
    if (end > data.length) throw new Error('数据块越界')
    chunks.push({ type, start, end, byteLength })
    offset = end
  }
  if (offset !== data.length) throw new Error('GLB 尾部不完整')

  const jsonChunk = chunks.find((chunk) => chunk.type === JSON_CHUNK)
  const binChunk = chunks.find((chunk) => chunk.type === BIN_CHUNK)
  if (!jsonChunk) throw new Error('缺少 JSON 数据块')
  const jsonText = data.subarray(jsonChunk.start, jsonChunk.end).toString('utf8').replace(/[\u0000\u0020]+$/g, '')
  const gltf = JSON.parse(jsonText)

  const images = (gltf.images ?? []).map((image, index) => {
    if (image.bufferView === undefined || !binChunk) return { index, embedded: false, mimeType: image.mimeType ?? null }
    const view = gltf.bufferViews?.[image.bufferView]
    if (!view) throw new Error(`图片 ${index} 的 bufferView 无效`)
    const start = binChunk.start + (view.byteOffset ?? 0)
    const end = start + view.byteLength
    if (end > binChunk.end) throw new Error(`图片 ${index} 越界`)
    const bytes = data.subarray(start, end)
    return { index, embedded: true, mimeType: image.mimeType ?? null, byteLength: bytes.length, ...imageSize(bytes, image.mimeType) }
  })
  const primitives = (gltf.meshes ?? []).flatMap((mesh) => mesh.primitives ?? [])
  const vertices = primitives.reduce((sum, primitive) => {
    const accessor = gltf.accessors?.[primitive.attributes?.POSITION]
    return sum + (accessor?.count ?? 0)
  }, 0)
  const triangles = primitives.reduce((sum, primitive) => sum + primitiveTriangles(primitive, gltf.accessors), 0)

  return {
    file: path.basename(filePath),
    bytes: data.length,
    version,
    chunks: chunks.length,
    meshes: gltf.meshes?.length ?? 0,
    primitives: primitives.length,
    vertices,
    triangles,
    materials: gltf.materials?.length ?? 0,
    animations: gltf.animations?.length ?? 0,
    extensionsUsed: gltf.extensionsUsed ?? [],
    images
  }
}

let failed = false
for (const filePath of process.argv.slice(2)) {
  try {
    console.log(JSON.stringify({ ok: true, ...inspect(filePath) }))
  } catch (error) {
    failed = true
    console.error(JSON.stringify({ ok: false, file: path.basename(filePath), error: error.message }))
  }
}
if (!process.argv.slice(2).length) {
  console.error('用法: node scripts/inspect-glb.mjs <model.glb> [...]')
  failed = true
}
process.exitCode = failed ? 1 : 0

