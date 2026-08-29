const fs = require('node:fs')

const packageEntry = require.resolve('threejs-miniprogram')
const source = fs.readFileSync(packageEntry, 'utf8')
const broken = 'h=(void 0)(('
const fixed = 'h=void 0;((' 
const brokenCount = source.split(broken).length - 1

if (brokenCount === 0 && source.includes(fixed)) {
  console.log('[threejs-miniprogram patch] already applied')
  process.exit(0)
}
if (brokenCount !== 1) {
  throw new Error(`[threejs-miniprogram patch] expected one broken IIFE boundary, found ${brokenCount}`)
}

fs.writeFileSync(packageEntry, source.replace(broken, fixed), 'utf8')
console.log('[threejs-miniprogram patch] fixed missing semicolon before injected Three UMD')

