import path from 'node:path'
import { defineConfig } from '@tarojs/cli'

const apiBaseUrl = process.env.TARO_APP_API_BASE_URL ?? ''
const localViewerSeeds = [
  'Box', 'BoxAnimated', 'BoxInterleaved', 'BoxTextured',
  'AnimatedMorphCube', 'DirectionalLight', 'EmissiveStrengthTest',
  'RiggedFigure', 'RiggedSimple', 'TextureSettingsTest', 'UnlitTest', 'VertexColorTest'
]

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
    __API_BASE_URL__: JSON.stringify(apiBaseUrl)
  },
  copy: {
    patterns: apiBaseUrl ? [] : localViewerSeeds.map((name) => ({
      from: path.resolve(__dirname, '..', 'backend-seed', 'glb', `${name}.glb`),
      to: `dist/subpackage-lab/seed-assets/${name}.glb`
    })),
    options: {}
  },
  mini: {
    webpackChain(chain) {
      chain.module.noParse(/threejs-miniprogram[\\/]dist[\\/]index\.js$/)
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