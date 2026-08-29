type CanvasLike = Record<PropertyKey, any>

class MiniProgramCanvasBridge {
  private readonly source: CanvasLike

  constructor(source: CanvasLike) {
    this.source = source
  }

  get width() {
    return this.source.width
  }

  set width(value: number) {
    this.source.width = value
  }

  get height() {
    return this.source.height
  }

  set height(value: number) {
    this.source.height = value
  }

  getContext(...args: any[]) {
    return this.source.getContext(...args)
  }

  createImage(...args: any[]) {
    return this.source.createImage(...args)
  }

  requestAnimationFrame(callback: (...args: any[]) => void) {
    return this.source.requestAnimationFrame(callback)
  }

  cancelAnimationFrame(frame: number) {
    return this.source.cancelAnimationFrame(frame)
  }
}

/**
 * threejs-miniprogram r108 unconditionally defines style/clientWidth/clientHeight
 * on the canvas. Recent WeChat clients already expose a non-configurable style
 * property, so defining it again throws before WebGLRenderer can be created.
 * Keep those DOM-like shims on a proxy and delegate native operations to the
 * real mini-program canvas.
 */
export function createMiniProgramCanvasBridge(canvas: CanvasLike) {
  const bridge = new MiniProgramCanvasBridge(canvas) as CanvasLike
  return new Proxy(bridge, {
    get(target, property, receiver) {
      if (Reflect.has(target, property)) return Reflect.get(target, property, receiver)
      const value = canvas[property]
      return typeof value === 'function' ? value.bind(canvas) : value
    },
    set(target, property, value, receiver) {
      if (Reflect.has(target, property) || property === 'style' || property === 'clientWidth' || property === 'clientHeight' || property === 'ownerDocument') {
        return Reflect.set(target, property, value, receiver)
      }
      canvas[property] = value
      return true
    },
    defineProperty(target, property, descriptor) {
      return Reflect.defineProperty(target, property, { ...descriptor, configurable: true })
    }
  })
}

