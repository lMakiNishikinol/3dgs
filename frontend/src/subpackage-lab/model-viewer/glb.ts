export { prepareGlbForMiniProgram } from './glb-core'

const GLB_MAGIC = 0x46546c67

export function validateGlb(data: ArrayBuffer) {
  if (data.byteLength < 20) throw new Error('文件过小，不是完整的 GLB')
  const view = new DataView(data)
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error('文件头不是 glTF binary')
  const version = view.getUint32(4, true)
  if (version !== 2) throw new Error(`仅支持 GLB 2.0，当前版本为 ${version}`)
  const declaredLength = view.getUint32(8, true)
  if (declaredLength !== data.byteLength) throw new Error(`文件长度校验失败（声明 ${declaredLength}，实际 ${data.byteLength}）`)
  return { version: String(version), embeddedImageCount: 1 }
}
