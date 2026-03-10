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

async function main() {
  // Use idle1 as reference - upscale to 64x64 for the API
  const idle1Buf = fs.readFileSync(path.join(OUT_DIR, 'player_idle1.png'))
  const refBuf = await sharp(idle1Buf).resize(64, 64, { kernel: 'nearest' }).png().toBuffer()
  const refB64 = refBuf.toString('base64')

  // Character description to keep consistent
  const CHAR = 'astronaut in white-gray space suit with cyan teal visor helmet and dark boots'

  // Animation sets to regenerate - each produces 2+ frames
  const animSets = [
    {
      action: 'jumping upward',
      desc: CHAR,
      outFrames: [{ name: 'player_jump', idx: 0, w: 32, h: 64 }],
    },
    {
      action: 'falling downward',
      desc: CHAR,
      outFrames: [{ name: 'player_fall', idx: 0, w: 32, h: 64 }],
    },
    {
      action: 'walking forward',
      desc: CHAR,
      outFrames: [{ name: 'player_walk4', idx: 1, w: 32, h: 64 }],
    },
    {
      action: 'swinging a pickaxe',
      desc: CHAR,
      outFrames: [
        { name: 'player_mine1', idx: 0, w: 48, h: 64 },
        { name: 'player_mine2', idx: 1, w: 48, h: 64 },
      ],
    },
    {
      action: 'slashing a sword',
      desc: CHAR,
      outFrames: [
        { name: 'player_attack1', idx: 0, w: 48, h: 64 },
        { name: 'player_attack2', idx: 1, w: 48, h: 64 },
      ],
    },
  ]

  for (const anim of animSets) {
    console.log(`Generating ${anim.action}...`)
    try {
      const data = await generate('animate-with-text', {
        description: anim.desc,
        action: anim.action,
        reference_image: { base64: refB64 },
        image_size: { width: 64, height: 64 },
        no_background: true,
        number_of_images: 2,
        direction: 'east',
        view: 'side',
      })

      const images = data.images || [data.image]
      console.log(`  Got ${images.length} frames`)

      for (const outFrame of anim.outFrames) {
        const idx = Math.min(outFrame.idx, images.length - 1)
        let b64 = images[idx].base64
        if (b64.includes(',')) b64 = b64.split(',')[1]
        const buf = Buffer.from(b64, 'base64')

        // Find character bounds
        const { data: pixels, info } = await sharp(buf)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })

        let minX = info.width, maxX = 0, minY = info.height, maxY = 0
        for (let y = 0; y < info.height; y++) {
          for (let x = 0; x < info.width; x++) {
            const alpha = pixels[(y * info.width + x) * 4 + 3]
            if (alpha > 10) {
              minX = Math.min(minX, x)
              maxX = Math.max(maxX, x)
              minY = Math.min(minY, y)
              maxY = Math.max(maxY, y)
            }
          }
        }

        if (maxX < minX) {
          console.log(`  WARNING: No visible pixels in ${outFrame.name}, using idle1`)
          await sharp(idle1Buf).resize(outFrame.w, outFrame.h, { kernel: 'nearest' }).png()
            .toFile(path.join(OUT_DIR, `${outFrame.name}.png`))
          continue
        }

        const cropW = maxX - minX + 1
        const cropH = maxY - minY + 1
        await sharp(buf)
          .extract({ left: minX, top: minY, width: cropW, height: cropH })
          .resize(outFrame.w, outFrame.h, { kernel: 'nearest' })
          .png()
          .toFile(path.join(OUT_DIR, `${outFrame.name}.png`))

        console.log(`  ✓ ${outFrame.name}.png (${outFrame.w}x${outFrame.h}) crop ${cropW}x${cropH}`)
      }

      await delay(500)
    } catch (err) {
      console.error(`  ✗ ${anim.action}: ${err.message}`)
      // Fallback: use idle1 for critical frames
      for (const outFrame of anim.outFrames) {
        if (outFrame.name.includes('jump') || outFrame.name.includes('fall')) {
          console.log(`  → Falling back to idle1 for ${outFrame.name}`)
          await sharp(idle1Buf).resize(outFrame.w, outFrame.h, { kernel: 'nearest' }).png()
            .toFile(path.join(OUT_DIR, `${outFrame.name}.png`))
        }
      }
    }
  }

  console.log('\nDone! Check the sprites in public/sprites/')
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
