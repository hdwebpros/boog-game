const fs = require('fs')
const path = require('path')

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

function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}

const BASE = 'astronaut character for a 2D side-scrolling platformer game. Dark charcoal-black space suit with gray panel details, round teal-cyan glowing visor helmet, silver backpack unit. Small 32x64 pixel art character sprite. Transparent background.'

const FRAMES = [
  {
    name: 'player_idle1',
    desc: `${BASE} Standing idle pose: legs slightly apart, arms relaxed at sides. Facing right.`,
  },
  {
    name: 'player_idle2',
    desc: `${BASE} Standing idle pose: legs slightly apart, one arm slightly raised in a breathing animation. Facing right.`,
  },
]

async function main() {
  console.log('Regenerating player idle frames to match dark suit...')
  for (const frame of FRAMES) {
    console.log(`  Generating ${frame.name}...`)
    const data = await generate('generate-image-pixflux', {
      description: frame.desc,
      image_size: { width: 32, height: 64 },
      no_background: true,
      view: 'side',
      direction: 'east',
      shading: 'medium shading',
      detail: 'medium detail',
      outline: 'single color black outline',
    })
    await saveImage(data, `${frame.name}.png`)
    await delay(500)
  }
  console.log('\n✓ Idle frames regenerated!')
}

main().catch(err => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})
