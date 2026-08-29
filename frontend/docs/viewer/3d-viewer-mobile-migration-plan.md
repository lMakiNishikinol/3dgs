# 3D 模型查看器移动端迁移方案

## 1. 迁移结论

当前查看器应停止使用 `threejs-miniprogram@0.0.7`（Three.js r108）。迁移分为两步：

1. **近期落地**：使用 `three-platformize@1.133.3` 替换旧运行时。该方案已有微信真机与带纹理 GLB 示例，使用预构建包，最容易接入当前 Taro React + Webpack 5 分包。
2. **稳定后演进**：把 3D 运行时代码抽成独立构建单元，再评估 `platformize + platformize-three`。后者是维护继任方案，但主要面向 Rollup 构建，不宜在第一步直接侵入现有 Taro 构建链。

迁移必须与模型移动端优化同时进行。仅替换加载器不能解决四张 4096×4096 纹理带来的 GPU 内存问题。

## 2. GitHub 调研结论

| 项目 | 结论 | 用途 |
| --- | --- | --- |
| `wechat-miniprogram/threejs-miniprogram` | Three.js r108；真机 TextureLoader 和带贴图 GLB 有长期问题 | 淘汰 |
| `deepkolos/three-platformize` | 支持微信真机、带纹理 GLB、GLTFLoader、TextureLoader；有 550 KB 最小示例 | 第一阶段迁移基线 |
| `deepkolos/platformize` | `three-platformize` 的继任项目；提供微信 Blob、URL、XHR、Image 等适配 | 第二阶段工程化 |
| `deepkolos/three-platformize-demo-wechat-simple` | 最小 glTF 真机示例，报告包体约 550 KB | 接入参考与验收对照 |
| `sanyuered/WeChat-MiniProgram-AR-3D` | 明确只支持无纹理 GLB 或 glTF | 仅参考交互，不作为运行时基线 |
| `minisheeep/threejs-miniprogram-template` | 文档较新且宣称支持 React Three Fiber，但核心适配包当前无法从公共 npm 获取 | 暂不采用 |

## 3. 当前模型移动端评估

`华为手机.glb`：

- 文件：13,090,528 字节；
- 41 个网格，205,319 个顶点，70,635 个三角面；
- 4 张 PNG，全部为 4096×4096；
- 使用 `KHR_materials_clearcoat`，非 required；
- 几何规模可接受，纹理规模不适合微信移动端。

四张 4096 RGBA 纹理解码后约占 256 MiB；生成完整 mipmap 后约 341 MiB。即使 PNG 文件很小，GPU 内存仍按解码尺寸计算。

## 4. 目标架构

```text
模型详情/个人中心入口
        ↓
Viewer Source Resolver
  ├─ 本地选择文件 → USER_DATA_PATH
  └─ 后端 manifest → wx.downloadFile → USER_DATA_PATH
        ↓
GLB Inspector（文件头、大小、纹理尺寸、扩展）
        ↓
Device Quality Profile（low / medium / high）
        ↓
three-platformize + GLTFLoader
        ↓
Renderer Lifecycle（暂停、恢复、销毁、上下文丢失）
        ↓
失败降级：移动纹理版 → 无纹理版 → 海报图
```

建议新增：

- `src/subpackage-lab/model-viewer/runtime/three-runtime.ts`
- `src/subpackage-lab/model-viewer/runtime/model-loader.ts`
- `src/subpackage-lab/model-viewer/runtime/device-quality.ts`
- `src/subpackage-lab/model-viewer/runtime/dispose.ts`
- `src/subpackage-lab/model-viewer/services/viewer-source.ts`
- `src/subpackage-lab/model-viewer/types.ts`

页面 TSX 只负责状态展示和手势，不再直接包含 Three.js 初始化与资源处理。

## 5. 移动端模型规范

后端/离线处理必须为每个模型生成移动端变体：

| 指标 | low | medium | high |
| --- | ---: | ---: | ---: |
| GLB 目标体积 | ≤ 4 MB | ≤ 8 MB | ≤ 10 MB |
| 单张纹理上限 | 1024 | 2048 | 2048 |
| 推荐三角面 | ≤ 50k | ≤ 120k | ≤ 250k |
| Pixel Ratio | 1.0 | 1.5 | 2.0 |
| 抗锯齿 | 关闭 | 可选 | 开启 |

资源处理规则：

- BaseColor 无透明通道时优先 JPEG/WebP；需要透明时保留 PNG。
- Metallic/Roughness 若为纯色或近似纯色，改为材质常量，不保留 4096 空白纹理。
- Normal、AO、Metallic/Roughness 通常低于 BaseColor 一个分辨率档位。
- 第一阶段不启用 Draco/Meshopt，避免同时引入 WASM 与 iOS/Android 解码差异；包体稳定后再评估 Meshopt。
- 文件名和缓存路径使用 ASCII，避免部分平台本地路径编码问题。

针对当前模型，第一批资产应至少生成：

- `huawei-phone.mobile-1024.glb`
- `huawei-phone.mobile-2048.glb`
- `huawei-phone.geometry-only.glb`
- `huawei-phone.poster.webp`

## 6. 前端迁移步骤

### 阶段 A：运行时替换

1. 新增 `three-platformize@1.133.3`。
2. 删除查看器对 `threejs-miniprogram` 与自带 r108 GLTFLoader 的引用。
3. 使用 `WechatPlatform(canvas)` 和 `THREE.PLATFORM.set(platform)` 初始化。
4. 使用适配后的 GLTFLoader 加载 ArrayBuffer/本地缓存文件。
5. 页面卸载时执行 `THREE.PLATFORM.dispose()`、renderer/material/texture/geometry 释放。
6. 保持整个运行时只存在于 `subpackage-lab` 分包。

### 阶段 B：移动端质量控制

1. 读取 `benchmarkLevel`、平台、Pixel Ratio 与画布尺寸。
2. Pixel Ratio 强制限制在 1–2；低档设备默认 1。
3. 低档设备关闭 antialias、阴影和环境贴图。
4. 首帧前不启动持续动画；模型静止时按需渲染。
5. 页面进入后台时暂停 RAF，返回时恢复。
6. 连续进入/退出页面 10 次不得持续增长纹理和 WebGL 上下文。

### 阶段 C：可靠加载与降级

1. `选择文件` 成功后先校验并展示文件名、大小、纹理上限。
2. 纹理超过 2048 时不直接送入 GPU：提示使用优化版本，或自动切换 geometry-only。
3. `textured → geometry-only → poster` 三级降级。
4. 分离下载、文件读取、GLB 解析、纹理解码、GPU 首帧超时。
5. 错误结构统一为 `stage/code/message/retryable`，前端不再显示笼统超时。

## 7. 后端对齐接口

### 获取模型查看清单

`GET /v1/models/{modelId}/viewer-manifest`

```json
{
  "modelId": "model_123",
  "version": "2026-08-26-01",
  "posterUrl": "https://cdn.example.com/models/model_123/poster.webp",
  "variants": [
    {
      "profile": "low",
      "format": "glb",
      "url": "https://cdn.example.com/models/model_123/mobile-1024.glb",
      "sizeBytes": 3800000,
      "sha256": "...",
      "textureMaxSize": 1024,
      "vertices": 120000,
      "triangles": 45000,
      "extensions": []
    },
    {
      "profile": "geometry-only",
      "format": "glb",
      "url": "https://cdn.example.com/models/model_123/geometry-only.glb",
      "sizeBytes": 2100000,
      "sha256": "...",
      "textureMaxSize": 0,
      "vertices": 205319,
      "triangles": 70635,
      "extensions": []
    }
  ],
  "expiresAt": "2026-08-26T08:00:00Z"
}
```

前端根据设备档位选择 variant；失败时按清单顺序降级。生产环境使用 `wx.downloadFile` 下载到临时文件，再复制到 `USER_DATA_PATH`，不要让 GLTFLoader 直接以 XHR 获取超过限制的 ArrayBuffer。

## 8. 验收标准

- 当前华为手机模型的 1024 版本在 Android、iOS 真机均能显示纹理。
- geometry-only 版本必须在所有测试机显示。
- Wi-Fi 环境下 medium 首帧目标 ≤ 5 秒，low ≤ 3 秒。
- 任意缺失/损坏/超限文件在 3 秒内进入明确错误或降级状态，不无限等待。
- 低档 Android、主流 Android、近三代 iPhone 各至少一台验证旋转、缩放、FIT、页面切换。
- 连续进入/退出查看器 10 次无闪退、无明显持续内存增长。
- 微信实际预览打包报告中主包与查看器分包均保留明显低于 2 MB 的余量。

## 9. 实施顺序与交付点

1. **迁移试验**：用 1024 纹理样例跑通 `three-platformize` 真机首帧。
2. **替换旧运行时**：迁移现有查看器交互、状态与资源释放。
3. **当前模型优化**：输出 1024、2048、geometry-only 三个 GLB。
4. **移动端降级**：设备分档与三级 fallback。
5. **后端接入**：接入 viewer-manifest 和 CDN 下载。
6. **真机矩阵**：性能、内存、包体与异常路径验收。

只有步骤 1 真机通过后才删除旧实现；在此之前保留可回退分支/备份。
