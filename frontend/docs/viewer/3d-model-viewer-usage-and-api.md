# 3D 模型查看器使用目录与正式版接入规范

> 更新日期：2026-08-27  
> 适用项目：Taro React 微信小程序  
> 当前格式范围：仅支持 GLB 2.0（glTF binary）  
> 本文是 3D 查看器正式版接入的主文档。

## 目录

1. [功能定位](#1-功能定位)
2. [当前调试版与正式版边界](#2-当前调试版与正式版边界)
3. [用户使用流程](#3-用户使用流程)
4. [前端页面接入方式](#4-前端页面接入方式)
5. [模型加载接口](#5-模型加载接口)
6. [前端下载与渲染流程](#6-前端下载与渲染流程)
7. [加载状态与错误处理](#7-加载状态与错误处理)
8. [后端资源与数据表要求](#8-后端资源与数据表要求)
9. [移动端模型约束](#9-移动端模型约束)
10. [正式版删除清单](#10-正式版删除清单)
11. [联调与验收清单](#11-联调与验收清单)
12. [相关文件](#12-相关文件)

## 1. 功能定位

3D 模型查看器负责展示商品绑定的 GLB 模型，并提供以下移动端操作：

- 单指自由旋转；
- 严格按照 X、Y、Z 坐标轴旋转；
- 沿 Y 轴垂直移动物体；
- 双指捏合缩放；
- `−`、`＋`、`FIT` 和复位；
- 正视图、右视图、顶视图和等轴视图；
- 坐标轴与网格显示开关；
- 顶点数、三角面数、纹理数和包围盒尺寸展示。

查看器只负责获取、校验和渲染商品已经绑定的模型，不负责在正式版中提供模型搜索、模型库选择或用户本地文件导入。

## 2. 当前调试版与正式版边界

### 2.1 历史调试版（已于 2026-08-27 清理）

历史调试版为了验证 GLB 兼容性，曾暂时保留：

- 个人主页中的“临时 GLB 查看器”入口；
- 查看器右上区域的“模型库”按钮；
- 独立模型库页面；
- 内置 Box 测试模型和构建期 GLB 扫描；
- 从微信文件选择 GLB 的调试能力；
- 通过 `path` 路由参数加载分包内模型。

这些能力仅用于开发与真机测试，不属于正式产品功能。

### 2.2 正式版

正式版必须遵守以下规则：

1. 删除个人主页的临时入口。
2. 删除模型库页面、模型库按钮和内置模型选择逻辑。
3. 删除面向用户的本地 GLB 文件选择入口。
4. 商品与模型在后端建立一对一的当前有效绑定；用户打开某个商品时，只能加载该商品绑定的模型。
5. 前端路由只传 `modelId`，不传签名 URL、对象存储路径或本地文件路径。
6. 查看器根据 `modelId` 请求加载接口，再下载并渲染 GLB。
7. 正式界面不显示“已加载 / 模型库”调试工具条；加载中、失败和重试状态应保留，但以查看器状态层呈现。

## 3. 用户使用流程

```text
效果展示 / 收藏 / 创作者主页
        ↓ 选择商品
商品详情页 /pages/model-detail/index?id={modelId}
        ↓ 点击“查看 3D 模型”
3D 查看器 /subpackage-lab/model-viewer/index?modelId={modelId}
        ↓
请求 GET /v1/models/{modelId}/viewer
        ↓
下载该商品绑定的 GLB
        ↓
校验 GLB 2.0 → 解析 → FIT → 允许用户交互
```

商品未完成重建、模型解析失败或当前用户无权查看时，不进入空白等待；页面应显示明确状态并允许返回商品详情。

## 4. 前端页面接入方式

### 4.1 商品详情页入口

正式版在商品详情页增加“查看 3D 模型”按钮。按钮只在商品状态为 `ready` 且存在可用模型资源时启用。

```tsx
const openViewer = (modelId: string) => {
  void Taro.navigateTo({
    url: `/subpackage-lab/model-viewer/index?modelId=${encodeURIComponent(modelId)}`
  })
}
```

禁止把 `modelUrl` 放进页面路由。签名 URL 可能包含临时凭据，写入路由会进入页面栈、日志或埋点。

### 4.2 查看器页面参数

| 参数 | 必填 | 说明 |
|---|---:|---|
| `modelId` | 是 | 当前商品/模型的业务 ID，也是加载接口路径参数 |

正式版不再接受 `path`、`source=temporary`、内置模型名称或模型库 EventChannel 结果。

### 4.3 已有前端服务

仓库已存在：

```ts
fetchViewerAsset(modelId: string): Promise<ViewerAsset>
```

文件位置：`src/services/modelViewer.ts`。

该服务请求 `/v1/models/{modelId}/viewer`。当前查看器已读取 `modelId`、获取资源、使用 `downloadFile` 下载并进入既有 GLB 校验与渲染流程；无后端模式仅使用 Khronos 公开样例做联调。 无后端构建由 `config/index.ts` 精确复制 12 个小型样例到查看器分包，避免微信合法域名限制；设置 `TARO_APP_API_BASE_URL` 后不复制样例并完全走远程下载。

## 5. 模型加载接口

### 5.1 GET /v1/models/{modelId}/viewer

用途：返回当前商品绑定的可查看 GLB、短期签名下载地址和展示元数据。

请求头：

```http
Authorization: Bearer <accessToken>
Accept: application/json
```

权限规则：

- 公开且状态为 `ready` 的商品允许登录用户访问；
- 私有商品仅作者、订单所有者或管理员可访问；
- 已删除、审核禁用或未完成的资源不能返回下载地址；
- 服务端必须依据数据库权限判断，不能相信前端传入的 ownerId 或 visibility。

成功响应使用项目统一信封：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "modelId": "model-01J8YV6N9E2JYJ8YJ0A1",
    "format": "glb",
    "modelUrl": "https://cdn.example.com/models/01J8/mobile.glb?signature=...",
    "expiresAt": "2026-08-27T08:10:00Z",
    "fileName": "product-chair.glb",
    "fileSize": 1834200,
    "metadata": {
      "vertices": 18240,
      "faces": 29680,
      "dimensions": { "x": 0.82, "y": 1.12, "z": 0.76 },
      "unit": "m",
      "animations": 0,
      "textures": 2
    }
  },
  "requestId": "req_01J8YV7A2M"
}
```

字段说明：

| 字段 | 类型 | 是否可空 | 说明 |
|---|---|---:|---|
| `modelId` | string | 否 | 商品绑定模型的业务 ID |
| `format` | `glb` | 否 | 首期固定为 `glb` |
| `modelUrl` | string | 否 | HTTPS 短期签名下载地址 |
| `expiresAt` | ISO 8601 string | 否 | 签名失效时间，建议有效期 10 分钟 |
| `fileName` | string | 否 | 展示和日志使用的安全文件名 |
| `fileSize` | number | 是 | GLB 字节数；未知时为 `null` |
| `metadata.vertices` | number | 是 | 顶点数 |
| `metadata.faces` | number | 是 | 三角面数 |
| `metadata.dimensions` | object | 是 | 模型包围盒尺寸 |
| `metadata.unit` | string | 是 | 推荐 `m`、`cm` 或 `mm` |
| `metadata.animations` | number | 是 | 动画片段数量 |
| `metadata.textures` | number | 是 | 纹理数量 |

### 5.2 接口状态约束

后端仅在以下条件全部满足时返回 `modelUrl`：

- `models.status = ready`；
- 存在当前有效的 `model_assets` 记录；
- `model_assets.parse_status = ready`；
- `format = glb`；
- 对象存储文件存在；
- 当前用户通过可见性校验。

### 5.3 错误响应

```json
{
  "code": 40421,
  "message": "MODEL_ASSET_NOT_FOUND",
  "data": null,
  "requestId": "req_01J8YV8F6Q"
}
```

建议业务错误：

| message | HTTP | 前端处理 |
|---|---:|---|
| `MODEL_NOT_FOUND` | 404 | 显示“商品不存在或已下架” |
| `MODEL_FORBIDDEN` | 403 | 显示“无权查看此模型”并返回 |
| `MODEL_ASSET_NOT_READY` | 409 | 显示“模型仍在生成”并允许稍后重试 |
| `MODEL_ASSET_FAILED` | 422 | 显示“模型生成失败” |
| `MODEL_FORMAT_UNSUPPORTED` | 415 | 显示“暂不支持此模型格式” |
| `MODEL_SIGNATURE_EXPIRED` | 401/403 | 重新请求 viewer 接口一次，再次失败则停止 |
| `RATE_LIMITED` | 429 | 延迟后重试，禁止快速循环请求 |

### 5.4 可选的多档移动端资源

后续需要适配不同性能手机时，可以保持上述字段兼容并增加 `variants`：

```json
{
  "variants": [
    {
      "quality": "mobile-1024",
      "url": "https://cdn.example.com/models/01J8/mobile-1024.glb?signature=...",
      "fileSize": 3200000,
      "maxTextureSize": 1024
    },
    {
      "quality": "mobile-2048",
      "url": "https://cdn.example.com/models/01J8/mobile-2048.glb?signature=...",
      "fileSize": 6800000,
      "maxTextureSize": 2048
    },
    {
      "quality": "geometry-only",
      "url": "https://cdn.example.com/models/01J8/geometry-only.glb?signature=...",
      "fileSize": 1400000,
      "maxTextureSize": 0
    }
  ]
}
```

前端优先选择适合设备的移动端版本，失败时只允许按高质量 → 低质量 → 无纹理顺序降级，不能跳转到其他商品的模型。

## 6. 前端下载与渲染流程

正式版建议拆成以下步骤：

1. 从路由读取并校验 `modelId`。
2. 调用 `fetchViewerAsset(modelId)`。
3. 校验 `format === 'glb'` 和签名剩余有效期。
4. 使用 `Taro.downloadFile` 下载 `modelUrl`。
5. 校验 HTTP 状态、文件大小和 GLB 文件头。
6. 使用文件系统读取 `ArrayBuffer`。
7. 对内嵌纹理执行当前小程序兼容预处理。
8. 交给 GLTFLoader 解析。
9. 计算包围盒、执行 FIT 并显示模型信息。
10. 页面卸载时释放纹理、材质、几何体、动画帧和临时文件。

伪代码：

```ts
const asset = await fetchViewerAsset(modelId)
if (asset.format !== 'glb') throw new Error('MODEL_FORMAT_UNSUPPORTED')

const download = await Taro.downloadFile({
  url: asset.modelUrl,
  timeout: 60000
})
if (download.statusCode < 200 || download.statusCode >= 300) {
  throw new Error(`MODEL_DOWNLOAD_HTTP_${download.statusCode}`)
}

// 将 download.tempFilePath 交给现有 GLB 读取、校验与渲染流程。
```

不要让 GLTFLoader 直接保存或长期复用签名 URL；下载和解析应分开记录错误阶段。

## 7. 加载状态与错误处理

查看器至少包含以下状态：

| 状态 | 用户提示 | 是否自动重试 |
|---|---|---:|
| `requesting` | 正在获取模型信息 | 网络瞬时错误最多 1 次 |
| `downloading` | 正在下载模型 | 最多 1 次 |
| `validating` | 正在校验模型 | 否 |
| `parsing` | 正在解析模型 | 否 |
| `ready` | 进入交互 | 不适用 |
| `not_ready` | 模型仍在生成 | 否，用户主动重试 |
| `forbidden` | 无权查看 | 否 |
| `failed` | 模型加载失败 | 用户主动重试 |

要求：

- 任何阶段都必须有超时，不能无限显示“加载中”；
- 下载失败、读取失败、GLB 校验失败、纹理解码失败和 GPU 初始化失败分别记录；
- 日志包含 `modelId`、阶段、requestId 和经过脱敏的错误码，不记录完整签名 URL；
- 签名过期只重新获取一次地址，防止循环；
- 切换页面或重新打开商品时取消旧任务，避免旧模型覆盖新商品。

## 8. 后端资源与数据表要求

### 8.1 商品与资源关系

每个正式商品必须绑定一个当前有效模型资源：

```text
models.id 1 ─── N model_assets.model_id
                   └─ is_active = true 的 GLB 只能有一个
```

建议数据库使用部分唯一索引或事务约束，保证同一模型只有一个有效展示资源。重新生成模型时先创建新资源，解析完成后再原子切换 `is_active`，避免商品短暂没有可用模型。

### 8.2 model_assets 建议字段

| 字段 | 说明 |
|---|---|
| `id` | 资源 ID |
| `model_id` | 关联商品/模型 ID |
| `format` | 固定 `glb` |
| `object_key` | 对象存储键，不直接返回前端 |
| `file_name` | 安全文件名 |
| `file_size` | 字节数 |
| `sha256` | 完整性校验值 |
| `vertices` / `faces` | 几何统计 |
| `bbox_x` / `bbox_y` / `bbox_z` | 包围盒尺寸 |
| `unit` | 单位 |
| `animations` / `textures` | 动画与纹理数量 |
| `parse_status` | `pending / ready / failed` |
| `failure_code` | 解析失败原因 |
| `is_active` | 当前商品是否使用该资源 |
| `parsed_at` | 解析完成时间 |
| `created_at` / `updated_at` | 审计时间 |

### 8.3 对象存储与域名

- 只使用 HTTPS；
- 下载域名必须加入微信小程序 `downloadFile` 合法域名；
- 响应设置 `Content-Type: model/gltf-binary`；
- 建议返回 `Content-Length`、`ETag` 和合理缓存头；
- 不向前端返回对象存储永久密钥；
- 私有模型使用短期签名 URL；
- CDN 需要支持 Range 请求，便于后续断点和分段能力。

## 9. 移动端模型约束

推荐生产基线：

- GLB 2.0；
- 单个移动端 GLB 目标不超过 8 MB；
- 低端机纹理最长边不超过 1024；
- 常规移动端纹理最长边不超过 2048；
- 避免大量 4096 纹理；
- 使用 2 的幂尺寸纹理并控制材质数量；
- 上传后异步校验文件头、数据块、纹理尺寸和扩展；
- 为复杂商品生成 `mobile-1024` 和 `geometry-only` 降级版本。

这些是项目性能建议，不代替真机内存和 GPU 测试。

## 10. 正式版删除清单

上线前应完成以下删除或改造：

- [x] 删除 `src/pages/profile/index.tsx` 中“临时 GLB 查看器”菜单项。
- [x] 删除 `src/subpackage-lab/model-library/` 页面目录。
- [x] 从 `src/app.config.ts` 分包页面中删除 `model-library/index`。
- [x] 删除查看器中的“模型库”按钮、`openModelLibrary`、EventChannel 和内置模型选择状态。
- [x] 删除正式 UI 中“已加载 / 模型库”调试工具条；保留必要的加载失败状态层。
- [x] 删除面向正式用户的 `chooseMessageFile` 入口；如研发仍需，放入不参与生产构建的测试工具。
- [x] 删除 `config/index.ts` 中 `__TEMP_GLB_*`、目录扫描和测试 GLB 自动复制逻辑。
- [x] 不把 `src/subpackage-lab/assets/samples/` 测试 GLB 打入正式分包。
- [x] 查看器路由由 `path` 改为唯一的 `modelId`。
- [x] 商品详情页增加“查看 3D 模型”入口。
- [x] 查看器调用 `fetchViewerAsset(modelId)` 并实现 `downloadFile` 流程。
- [ ] 后端保证每个 ready 商品绑定一个 active GLB（本仓库已提供 DDL、接口规范和 16 个种子资源，待后端实施）。

## 11. 联调与验收清单

### 正常流程

- [ ] 从三个不同商品进入查看器时分别加载各自模型。
- [ ] 前进、返回、再次进入不会显示上一个商品模型。
- [ ] 公开模型、本人私有模型和无权私有模型权限正确。
- [ ] GLB 材质、纹理、尺寸和 FIT 正常。
- [ ] 双指缩放、自由旋转、轴向旋转和垂直移动正常。
- [ ] 页面卸载后无持续动画帧和明显内存增长。

### 异常流程

- [ ] 模型仍在生成时显示明确提示，不无限等待。
- [ ] 签名过期时重新获取一次地址。
- [ ] 下载超时、404、损坏 GLB 和不支持格式均有对应提示。
- [ ] 资源不存在或无权限时不泄露对象存储地址。
- [ ] 快速切换商品不会发生旧请求覆盖新页面。

### 正式版界面

- [ ] 个人主页无临时查看器入口。
- [ ] 查看器无模型库按钮和模型库页面。
- [ ] 用户不能在正式版任意选择其他商品或本地 GLB。
- [ ] 当前商品模型是查看器唯一数据源。

## 12. 相关文件

- `src/subpackage-lab/model-viewer/index.tsx`：当前查看器页面与交互。
- `src/subpackage-lab/model-viewer/glb.ts`：GLB 校验入口。
- `src/subpackage-lab/model-viewer/glb-core.ts`：GLB 解析与纹理预处理。
- `src/services/modelViewer.ts`：正式版 viewer 接口类型和请求函数。
- `src/pages/model-detail/index.tsx`：正式版“查看 3D 模型”入口应放置的位置。
- [`3d-model-viewer-backend.md`](../backend/integrations/3d-model-viewer-backend.md)：后端接口摘要。
- [`3d-viewer-mobile-migration-plan.md`](./3d-viewer-mobile-migration-plan.md)：移动端运行时与模型降级方案。
- [`glb-basic-test-report.md`](../testing/glb-basic-test-report.md)：基础 GLB 测试记录。
