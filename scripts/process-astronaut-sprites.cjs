/**
 * Process PixelLab astronaut export into game-ready sprite frames.
 *
 * - Crops transparent padding from each frame
 * - Scales character to fill target frame size (nearest-neighbor for pixel art)
 * - Aligns feet to bottom of frame consistently across all animations
 * - Outputs to public/sprites/ as astro_<anim>_<n>.png
 */
const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '..')
const BASE = path.join(ROOT, 'Astronaut_Base_extracted', 'animations')
const OUT = path.join(ROOT, 'public', 'sprites')

// Animation mapping: source folder → output config
// User confirmed:
//   "Stick arm straight out in front" = bow
//   "right arm fully extended above head swings down" = attack/mine
const ANIMATIONS = [
  { folder: 'breathing-idle',                         name: 'idle',   dir: 'east', frames: 4, outW: 32, outH: 64 },
  { folder: 'walking-6-frames',                       name: 'walk',   dir: 'east', frames: 6, outW: 32, outH: 64 },
  { folder: 'two-footed-jump',                        name: 'jump',   dir: 'east', frames: 7, outW: 32, outH: 64 },
  { folder: 'custom-right arm is fully extended ab',   name: 'attack', dir: 'east', frames: 7, outW: 48, outH: 64 },
  { folder: 'custom-Stick arm straight out in fron',   name: 'bow',    dir: 'east', frames: 7, outW: 48, outH: 64 },
  { folder: 'falling-back-death',                     name: 'death',  dir: 'east', frames: 7, outW: 32, outH: 64 },
  { folder: 'drinking',                               name: 'drink',  dir: 'east', frames: 6, outW: 32, outH: 64 },
  { folder: 'custom-climbing / scaling action',        name: 'climb',  dir: 'north', frames: 7, outW: 32, outH: 64 },
]

/** Get the non-transparent bounding box of a 64x64 RGBA image */
async function getBounds(imgPath) {
  const { data, info } = await sharp(imgPath)
    .raw()
    .toBuffer({ resolveWithObject: true })

  let minX = info.width, minY = info.height, maxX = -1, maxY = -1

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * 4 + 3]
      if (alpha > 10) { // ignore near-zero alpha noise
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

async function main() {
  // First pass: collect bounds for ALL frames across ALL animations
  // to find the global foot (maxY) and head (minY) positions
  console.log('Pass 1: Scanning all frames for bounding boxes...')

  const animBounds = [] // parallel to ANIMATIONS
  let globalMinY = 64, globalMaxY = 0

  for (const anim of ANIMATIONS) {
    const bounds = []
    for (let i = 0; i < anim.frames; i++) {
      const framePath = path.join(BASE, anim.folder, anim.dir, `frame_${String(i).padStart(3, '0')}.png`)
      if (!fs.existsSync(framePath)) {
        console.error(`  MISSING: ${framePath}`)
        bounds.push(null)
        continue
      }
      const b = await getBounds(framePath)
      bounds.push(b)
      if (b.maxY > globalMaxY) globalMaxY = b.maxY
      if (b.minY < globalMinY) globalMinY = b.minY
    }
    animBounds.push(bounds)
    console.log(`  ${anim.name}: ${bounds.filter(Boolean).length} frames`)
  }

  const globalCharH = globalMaxY - globalMinY + 1
  console.log(`\nGlobal character extent: y=${globalMinY}..${globalMaxY} (${globalCharH}px in 64px frame)`)

  // Second pass: process each animation
  console.log('\nPass 2: Processing frames...')

  for (let ai = 0; ai < ANIMATIONS.length; ai++) {
    const anim = ANIMATIONS[ai]
    const bounds = animBounds[ai]

    // Find the per-animation horizontal union (so character stays centered within each anim)
    let animMinX = 64, animMaxX = 0
    for (const b of bounds) {
      if (!b) continue
      if (b.minX < animMinX) animMinX = b.minX
      if (b.maxX > animMaxX) animMaxX = b.maxX
    }
    const animCharW = animMaxX - animMinX + 1

    console.log(`\n${anim.name}: crop x=${animMinX}..${animMaxX} (${animCharW}px), global y=${globalMinY}..${globalMaxY} (${globalCharH}px)`)

    for (let i = 0; i < anim.frames; i++) {
      const b = bounds[i]
      if (!b) continue

      const framePath = path.join(BASE, anim.folder, anim.dir, `frame_${String(i).padStart(3, '0')}.png`)

      // Crop to the animation's horizontal extent and global vertical extent
      const cropW = animCharW
      const cropH = globalCharH
      const cropped = await sharp(framePath)
        .extract({
          left: animMinX,
          top: globalMinY,
          width: cropW,
          height: cropH,
        })
        .toBuffer()

      // Scale to fill target frame (preserve aspect ratio, nearest-neighbor)
      const scaleX = anim.outW / cropW
      const scaleY = anim.outH / cropH
      const scale = Math.min(scaleX, scaleY)

      const scaledW = Math.round(cropW * scale)
      const scaledH = Math.round(cropH * scale)

      const resized = await sharp(cropped)
        .resize(scaledW, scaledH, { kernel: 'nearest' })
        .toBuffer()

      // Composite onto transparent canvas: centered horizontally, feet at bottom
      const left = Math.round((anim.outW - scaledW) / 2)
      const top = anim.outH - scaledH // feet flush with bottom

      const outPath = path.join(OUT, `astro_${anim.name}_${i}.png`)
      await sharp({
        create: {
          width: anim.outW,
          height: anim.outH,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([{ input: resized, left, top }])
        .png()
        .toFile(outPath)

      console.log(`  -> astro_${anim.name}_${i}.png (${anim.outW}x${anim.outH})`)
    }
  }

  // Generate fall frames from the last 2 jump frames
  console.log('\nGenerating fall frames from jump frames 5,6...')
  for (let fi = 0; fi < 2; fi++) {
    const src = path.join(OUT, `astro_jump_${5 + fi}.png`)
    const dst = path.join(OUT, `astro_fall_${fi}.png`)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst)
      console.log(`  -> astro_fall_${fi}.png (copied from jump_${5 + fi})`)
    }
  }

  console.log('\nDone! All astro sprites written to public/sprites/')
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
