import path from 'node:path'
import { defineConfig } from '@tarojs/cli'

const backendEnv = {} as Record<string, string>
const apiBaseUrl = process.env.TARO_APP_API_BASE_URL ?? ''
const enableTestLogin = process.env.TARO_APP_ENABLE_TEST_LOGIN !== undefined
  ? process.env.TARO_APP_ENABLE_TEST_LOGIN === 'true'
  : false

export default defineConfig({
  projectName: 'wechat-3dgs-program',
  date: '2026-08-24',
  designWidth: 375,
  deviceRatio: { 375: 2, 750: 1 },
  sourceRoot: 'src',
  outputRoot: 'dist',
  framework: 'react',
  compiler: 'webpack5',
  alias: {
    '@': path.resolve(__dirname, '..', 'src')
  },
  cache: { enable: true },
  defineConstants: {
    __API_BASE_URL__: JSON.stringify(apiBaseUrl),
    __ENABLE_TEST_LOGIN__: JSON.stringify(enableTestLogin)
  },
  copy: {
    patterns: [
      {
        from: 'src/sitemap.json',
        to: 'dist/sitemap.json'
      }
    ],
    options: {}
  },
  mini: {
    webpackChain(chain) {
      chain.module.noParse(/threejs-miniprogram[\\/]dist[\\/]index\.js$/)
      // 微信分包单包限制为 2 MiB；Three.js 已位于按需加载的独立分包中。
      // 关闭 Webpack 面向网页的 244 KiB 通用提示，实际包体由 check:weapp 严格校验。
      chain.performance.hints(false)
    },
    optimizeMainPackage: { enable: true },
    postcss: {
      pxtransform: { enable: true, config: {} },
      url: { enable: true, config: { limit: 1024 } },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]'
        }
      }
    }
  }
})
