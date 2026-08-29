const assert = require('node:assert/strict')
const { createMiniProgramCanvasBridge } = require('../.artifacts/canvas-bridge-build/canvas-bridge.js')
const { createScopedThreejs } = require('../node_modules/threejs-miniprogram/dist/index.js')

const nativeCanvas = {
  width: 320,
  height: 640,
  getContext: () => ({ canvas: null }),
  createImage: () => ({}),
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => undefined
}
Object.defineProperty(nativeCanvas, 'style', {
  value: { width: '320px', height: '640px' },
  configurable: false
})

assert.throws(() => createScopedThreejs(nativeCanvas), /Cannot redefine property: style/)

const bridge = createMiniProgramCanvasBridge(nativeCanvas)
let nodeOnlyRuntimeError = ''
try {
  createScopedThreejs(bridge)
} catch (error) {
  nodeOnlyRuntimeError = String(error?.message || error)
  assert.doesNotMatch(nodeOnlyRuntimeError, /Cannot redefine property: style/)
}

assert.equal(bridge.style.width, '320px')
assert.equal(bridge.clientWidth, 320)
assert.equal(bridge.clientHeight, 640)
assert.equal(nativeCanvas.style.width, '320px')
assert.equal(Object.getOwnPropertyDescriptor(nativeCanvas, 'style').configurable, false)

console.log(JSON.stringify({
  ok: true,
  originalFailureReproduced: 'Cannot redefine property: style',
  nativeStylePreserved: true,
  bridgeClientWidth: bridge.clientWidth,
  bridgeClientHeight: bridge.clientHeight,
  nodeOnlyRuntimeError
}))
