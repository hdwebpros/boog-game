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

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

// Exact character description matching idle1 appearance
const CHAR = 'small pixel art astronaut character with dark gray space suit, round cyan teal glowing visor helmet, dark boots, standing upright, side view facing right, for a 2D platformer game'

async function main() {
  const frames = [
    {
      name: 'player_mine1',
      desc: `${CHAR}, holding a small pickaxe raised above head with right arm`,
      w: 48, h: 64,
    },
    {
      name: 'player_mine2',
      desc: `${CHAR}, swinging a small pickaxe downward with right arm`,
      w: 48, h: 64,
    },
    {
      name: 'player_attack1',
      desc: `${CHAR}, holding a small sword raised behind with right arm`,
      w: 48, h: 64,
    },
    {
      name: 'player_attack2',
      desc: `${CHAR}, slashing a small sword forward with right arm extended`,
      w: 48, h: 64,
    },
  ]

  for (const frame of frames) {
    console.log(`Generating ${frame.name}...`)
    try {
      const data = await generate('generate-image-pixflux', {
        description: frame.desc,
        image_size: { width: 48, height: 64 },
        no_background: true,
        view: 'side',
        direction: 'east',
        shading: 'medium shading',
        detail: 'medium detail',
        outline: 'single color black outline',
        seed: 42,
      })

      let b64 = data.image.base64
      if (b64.includes(',')) b64 = b64.split(',')[1]
      const buf = Buffer.from(b64, 'base64')

      const outPath = path.join(OUT_DIR, `${frame.name}.png`)
      fs.writeFileSync(outPath, buf)
      console.log(`  ✓ ${frame.name}.png`)
      await delay(400)
    } catch (err) {
      console.error(`  ✗ ${frame.name}: ${err.message}`)
    }
  }

  console.log('\nDone!')
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
