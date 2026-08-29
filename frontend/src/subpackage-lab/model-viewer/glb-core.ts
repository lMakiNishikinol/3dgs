const GLB_MAGIC = 0x46546c67
const JSON_CHUNK_TYPE = 0x4e4f534a
const BIN_CHUNK_TYPE = 0x004e4942

type GlbChunk = { type: number; data: Uint8Array }
type GlbJson = {
  asset?: { version?: string }
  bufferViews?: Array<{ buffer?: number; byteOffset?: number; byteLength?: number }>
  images?: Array<{ uri?: string; mimeType?: string; bufferView?: number }>
}
export type PreparedGlb = { data: ArrayBuffer; version: string; embeddedImageCount: number; temporaryFiles: string[] }

function decodeUtf8(bytes: Uint8Array) {
  let output = ''
  let index = 0
  while (index < bytes.length) {
    const first = bytes[index++]
    if (first < 0x80) {
      output += String.fromCharCode(first)
    } else if (first < 0xe0) {
      const second = bytes[index++]
      output += String.fromCharCode(((first & 0x1f) << 6) | (second & 0x3f))
    } else if (first < 0xf0) {
      const second = bytes[index++]
      const third = bytes[index++]
      output += String.fromCharCode(((first & 0x0f) << 12) | ((second & 0x3f) << 6) | (third & 0x3f))
    } else {
      const second = bytes[index++]
      const third = bytes[index++]
      const fourth = bytes[index++]
      let codePoint = ((first & 0x07) << 18) | ((second & 0x3f) << 12) | ((third & 0x3f) << 6) | (fourth & 0x3f)
      codePoint -= 0x10000
      output += String.fromCharCode(0xd800 + (codePoint >> 10), 0xdc00 + (codePoint & 0x3ff))
    }
  }
  return output
}

function encodeUtf8(value: string) {
  const bytes: number[] = []
  for (let index = 0; index < value.length; index += 1) {
    let codePoint = value.charCodeAt(index)
    if (codePoint >= 0xd800 && codePoint <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (next - 0xdc00)
        index += 1
      }
    }
    if (codePoint < 0x80) bytes.push(codePoint)
    else if (codePoint < 0x800) bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f))
    else if (codePoint < 0x10000) bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f))
    else bytes.push(0xf0 | (codePoint >> 18), 0x80 | ((codePoint >> 12) & 0x3f), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f))
  }
  return new Uint8Array(bytes)
}

function parseGlb(data: ArrayBuffer) {
  if (data.byteLength < 20) throw new Error('文件过小，不是完整的 GLB')
  const view = new DataView(data)
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error('文件头不是 glTF binary')
  const version = view.getUint32(4, true)
  if (version !== 2) throw new Error(`仅支持 GLB 2.0，当前版本为 ${version}`)
  const declaredLength = view.getUint32(8, true)
  if (declaredLength !== data.byteLength) throw new Error(`文件长度校验失败（声明 ${declaredLength}，实际 ${data.byteLength}）`)

  const chunks: GlbChunk[] = []
  let offset = 12
  while (offset + 8 <= declaredLength) {
    const length = view.getUint32(offset, true)
    const type = view.getUint32(offset + 4, true)
    const start = offset + 8
    const end = start + length
    if (end > declaredLength) throw new Error('GLB 数据块越界，文件可能已损坏')
    chunks.push({ type, data: new Uint8Array(data, start, length) })
    offset = end
  }
  if (offset !== declaredLength) throw new Error('GLB 尾部数据不完整')
  const jsonChunk = chunks.find((chunk) => chunk.type === JSON_CHUNK_TYPE)
  if (!jsonChunk) throw new Error('GLB 缺少 JSON 数据块')
  let json: GlbJson
  try {
    json = JSON.parse(decodeUtf8(jsonChunk.data).replace(/[\u0000\u0020]+$/g, '')) as GlbJson
  } catch {
    throw new Error('GLB 的 JSON 数据无法解析')
  }
  return {
    version: String(json.asset?.version || version),
    chunks,
    jsonChunk,
    binChunk: chunks.find((chunk) => chunk.type === BIN_CHUNK_TYPE),
    json
  }
}

function extensionForMimeType(mimeType = '') {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  return 'png'
}

function rebuildGlb(chunks: GlbChunk[], jsonChunk: GlbChunk, json: GlbJson) {
  const encoded = encodeUtf8(JSON.stringify(json))
  const paddedJson = new Uint8Array(Math.ceil(encoded.byteLength / 4) * 4)
  paddedJson.fill(0x20)
  paddedJson.set(encoded)
  const rebuiltChunks = chunks.map((chunk) => chunk === jsonChunk ? { type: JSON_CHUNK_TYPE, data: paddedJson } : chunk)
  const totalLength = 12 + rebuiltChunks.reduce((total, chunk) => total + 8 + chunk.data.byteLength, 0)
  const output = new ArrayBuffer(totalLength)
  const outputView = new DataView(output)
  const outputBytes = new Uint8Array(output)
  outputView.setUint32(0, GLB_MAGIC, true)
  outputView.setUint32(4, 2, true)
  outputView.setUint32(8, totalLength, true)
  let offset = 12
  rebuiltChunks.forEach((chunk) => {
    outputView.setUint32(offset, chunk.data.byteLength, true)
    outputView.setUint32(offset + 4, chunk.type, true)
    outputBytes.set(chunk.data, offset + 8)
    offset += 8 + chunk.data.byteLength
  })
  return output
}

export async function prepareGlbForMiniProgram(
  data: ArrayBuffer,
  createImagePath: (index: number, extension: string) => string,
  writeBinary: (filePath: string, data: ArrayBuffer) => Promise<void>
): Promise<PreparedGlb> {
  const parsed = parseGlb(data)
  const embeddedImages = (parsed.json.images || [])
    .map((image, index) => ({ image, index }))
    .filter(({ image }) => image.bufferView !== undefined)
  if (!embeddedImages.length) return { data, version: parsed.version, embeddedImageCount: 0, temporaryFiles: [] }
  if (!parsed.binChunk) throw new Error('GLB 包含内嵌图片，但缺少二进制数据块')

  const temporaryFiles: string[] = []
  await Promise.all(embeddedImages.map(async ({ image, index }) => {
    const bufferView = parsed.json.bufferViews?.[image.bufferView as number]
    if (!bufferView || (bufferView.buffer ?? 0) !== 0 || !bufferView.byteLength) throw new Error(`第 ${index + 1} 张内嵌纹理的数据范围无效`)
    const start = bufferView.byteOffset || 0
    const end = start + bufferView.byteLength
    if (end > parsed.binChunk!.data.byteLength) throw new Error(`第 ${index + 1} 张内嵌纹理越界`)
    const filePath = createImagePath(index, extensionForMimeType(image.mimeType))
    const imageData = new Uint8Array(parsed.binChunk!.data.slice(start, end)).buffer
    await writeBinary(filePath, imageData)
    temporaryFiles.push(filePath)
    image.uri = filePath
    delete image.bufferView
  }))
  return {
    data: rebuildGlb(parsed.chunks, parsed.jsonChunk, parsed.json),
    version: parsed.version,
    embeddedImageCount: embeddedImages.length,
    temporaryFiles
  }
}
