const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const API_URL = 'https://api.pixellab.ai/v1'
const API_KEY = 'd0498097-128b-4c78-8e33-1d1b295ecbfe'
const OUT_DIR = path.resolve(__dirname, '../public/sprites')

async function generate(endpoint, body) {
  const res = await fetch(`${API_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API ${res.status}: ${err}`)
  }
  return res.json()
}

async function saveImage(data, filename) {
  let b64 = data.image.base64
  if (b64.includes(',')) b64 = b64.split(',')[1]
  const buf = Buffer.from(b64, 'base64')
  const outPath = path.join(OUT_DIR, filename)
  fs.writeFileSync(outPath, buf)
  console.log(`  ✓ ${filename}`)
  return buf
}

async function saveAndDownscale(data, filename, targetW, targetH) {
  let b64 = data.image.base64
  if (b64.includes(',')) b64 = b64.split(',')[1]
  const buf = Buffer.from(b64, 'base64')
  const outPath = path.join(OUT_DIR, filename)
  await sharp(buf).resize(targetW, targetH, { kernel: 'nearest' }).png().toFile(outPath)
  console.log(`  ✓ ${filename} (${targetW}x${targetH})`)
  return buf
}

async function main() {
  console.log('Generating Portal Sprites...\n')

  // 1. Portal tile texture (32x32 → downscale to 16x16)
  console.log('  Generating portal tile (tile_48)...')
  const tileData = await generate('generate-image-pixflux', {
    description: 'seamless tileable magical portal block texture for a 2D side-scrolling platformer. Deep purple swirling energy filling the entire square with bright violet and magenta magical vortex patterns, small white star sparkles scattered throughout, glowing mystical energy. Terraria style.',
    image_size: { width: 32, height: 32 },
    no_background: false,
    view: 'side',
    shading: 'basic shading',
    detail: 'medium detail',
    outline: 'lineless',
  })
  await saveAndDownscale(tileData, 'tile_48.png', 16, 16)

  // 2. Portal inventory item icon (32x32)
  console.log('  Generating portal item icon (item_117)...')
  const itemData = await generate('generate-image-pixflux', {
    description: 'magical portal item inventory icon for a 2D side-scrolling game. Small ornate purple stone portal arch frame with swirling violet energy vortex in the center, magical sparkles around it, mystical runes carved on the frame. Pixel art item sprite.',
    image_size: { width: 32, height: 32 },
    no_background: true,
    view: 'side',
    shading: 'medium shading',
    detail: 'medium detail',
    outline: 'single color black outline',
  })
  await saveImage(itemData, 'item_117.png')

  console.log('\n✓ Portal sprites generated!')
}

main().catch(err => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})
