import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = path.join(projectRoot, 'dist')
const maxPackageBytes = 2 * 1024 * 1024

function fail(message) {
  console.error('[产物检查失败] ' + message)
  process.exitCode = 1
}

function requireFile(relativePath) {
  const absolutePath = path.join(distRoot, relativePath)
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    fail('缺少 ' + relativePath)
    return false
  }
  return true
}

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(distRoot, relativePath), 'utf8'))
  } catch (error) {
    fail(relativePath + ' 不是有效 JSON：' + error.message)
    return null
  }
}

function walk(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(absolutePath) : [absolutePath]
  })
}

for (const file of ['app.js', 'app.json', 'app.wxss', 'project.config.json', 'sitemap.json']) {
  requireFile(file)
}

const app = readJson('app.json')
const project = readJson('project.config.json')
if (project) {
  if (project.miniprogramRoot !== './') fail('dist/project.config.json 的 miniprogramRoot 必须是 ./')
  if (project.scripts && Object.keys(project.scripts).length) {
    fail('dist 不得包含 beforeCompile 等 npm 脚本，否则直接导入 dist 会因缺少 package.json 而启动失败')
  }
}

if (app) {
  const pages = [
    ...(app.pages || []),
    ...(app.subpackages || []).flatMap((subpackage) =>
      (subpackage.pages || []).map((page) => subpackage.root + '/' + page)
    ),
  ]
  for (const page of pages) {
    // Taro 可将页面样式统一合并到 app.wxss，因此页面级 wxss 不是必需文件。
    for (const extension of ['.js', '.json', '.wxml']) requireFile(page + extension)
  }
}

const javascript = walk(distRoot)
  .filter((file) => file.endsWith('.js'))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n')
if (!/https?:\\?\/\\?\/[^"'\s]+/.test(javascript)) {
  fail('构建产物中没有后端 API 地址，请检查 backend/.env 的 BASE_URL')
}

const subpackageRoots = new Set((app?.subpackages || []).map((item) => item.root))
const allFiles = walk(distRoot)
const mainBytes = allFiles
  .filter((file) => {
    const relative = path.relative(distRoot, file)
    return !subpackageRoots.has(relative.split(path.sep)[0])
  })
  .reduce((total, file) => total + fs.statSync(file).size, 0)

if (mainBytes > maxPackageBytes) fail('主包超过 2 MiB：' + mainBytes + ' bytes')
for (const root of subpackageRoots) {
  const bytes = walk(path.join(distRoot, root)).reduce((total, file) => total + fs.statSync(file).size, 0)
  if (bytes > maxPackageBytes) fail('分包 ' + root + ' 超过 2 MiB：' + bytes + ' bytes')
  else console.log('[产物检查] 分包 ' + root + '：' + (bytes / 1024).toFixed(1) + ' KiB / 2048 KiB')
}

if (!process.exitCode) {
  console.log('[产物检查] 主包：' + (mainBytes / 1024).toFixed(1) + ' KiB / 2048 KiB')
  console.log('[产物检查] 页面、配置、API 地址和包体大小全部通过')
}
