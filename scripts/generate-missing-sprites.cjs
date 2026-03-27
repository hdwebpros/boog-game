/**
 * Generate missing sprites using PixelLab API.
 *
 * Generates:
 *   - Void Lord animation frames (idle2, attack, cast) using bitforge with style reference
 *   - Player animation frames (jump, fall) using animate-with-text
 *
 * Usage:
 *   node scripts/generate-missing-sprites.cjs
 *   node scripts/generate-missing-sprites.cjs --skip-existing
 *   node scripts/generate-missing-sprites.cjs --only-void-lord
 *   node scripts/generate-missing-sprites.cjs --only-player
 */

const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const API_URL = 'https://api.pixellab.ai/v1'
const API_KEY = 'd0498097-128b-4c78-8e33-1d1b295ecbfe'
const OUT_DIR = path.resolve(__dirname, '../public/sprites')
const SKIP_EXISTING = process.argv.includes('--skip-existing')
const ONLY_VOID_LORD = process.argv.includes('--only-void-lord')
const ONLY_PLAYER = process.argv.includes('--only-player')

function spriteExists(filename) {
  return SKIP_EXISTING && fs.existsSync(path.join(OUT_DIR, filename))
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function imageToBase64(filePath) {
  const buf = fs.readFileSync(filePath)
  return buf.toString('base64')
}

async function apiCall(endpoint, body) {
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
    throw new Error(`API ${res.status} on ${endpoint}: ${err}`)
  }
  return res.json()
}

async function saveImage(data, filename) {
  let b64 = data.image ? data.image.base64 : data.base64
  if (b64.includes(',')) b64 = b64.split(',')[1]
  const buf = Buffer.from(b64, 'base64')
  const outPath = path.join(OUT_DIR, filename)
  fs.writeFileSync(outPath, buf)
  console.log(`  ✓ ${filename}`)
  return buf
}

async function saveImages(images, prefix) {
  const results = []
  for (let i = 0; i < images.length; i++) {
    let b64 = images[i].base64
    if (b64.includes(',')) b64 = b64.split(',')[1]
    const buf = Buffer.from(b64, 'base64')
    const filename = `${prefix}_${i}.png`
    const outPath = path.join(OUT_DIR, filename)
    fs.writeFileSync(outPath, buf)
    console.log(`  ✓ ${filename}`)
    results.push(buf)
  }
  return results
}

// ─── VOID LORD ANIMATION FRAMES ──────────────────────────────

async function generateVoidLordFrames() {
  console.log('\n── Generating Void Lord Animation Frames ──')

  const refPath = path.join(OUT_DIR, 'boss_void_lord.png')
  if (!fs.existsSync(refPath)) {
    console.log('  ✗ boss_void_lord.png not found — cannot generate variants')
    console.log('    Run the main generate-sprites.cjs first or copy from boog-godot')
    return
  }

  const styleB64 = imageToBase64(refPath)

  const frames = [
    {
      name: 'boss_void_lord_idle2',
      desc: 'massive void lord final boss idle pose variant for a 2D side-scrolling platformer game. Same towering dark purple-black demonic entity with enormous curved horns and four glowing magenta eyes. Arms slightly raised outward, void energy robes billowing wider, dark crystals above head repositioned. Subtle pose shift from idle 1. Facing right. Pixel art boss sprite.',
    },
    {
      name: 'boss_void_lord_attack',
      desc: 'massive void lord final boss attack pose for a 2D side-scrolling platformer game. Same towering dark purple-black demonic entity with enormous curved horns and four glowing magenta eyes. Both huge clawed hands thrust forward shooting concentrated purple void beam energy, mouth open roaring, void robes flaring outward dramatically, dark crystals above head glowing bright. Aggressive attack stance. Facing right. Pixel art boss sprite.',
    },
    {
      name: 'boss_void_lord_cast',
      desc: 'massive void lord final boss summoning pose for a 2D side-scrolling platformer game. Same towering dark purple-black demonic entity with enormous curved horns and four glowing magenta eyes. Arms raised high above head forming a dark energy portal between clawed hands, void robes swirling upward, dimensional rift opening below, dark crystals orbiting rapidly. Casting spell. Facing right. Pixel art boss sprite.',
    },
  ]

  for (const frame of frames) {
    if (spriteExists(`${frame.name}.png`)) {
      console.log(`  ⏭ ${frame.name} (exists, skipping)`)
      continue
    }
    console.log(`  Generating ${frame.name}...`)
    try {
      const data = await apiCall('generate-image-bitforge', {
        description: frame.desc,
        image_size: { width: 128, height: 192 },
        style_image: { base64: styleB64 },
        style_strength: 80,
        no_background: true,
        view: 'side',
        direction: 'east',
        text_guidance_scale: 8,
        detail: 'highly detailed',
      })
      await saveImage(data, `${frame.name}.png`)
    } catch (err) {
      console.log(`  ✗ ${frame.name} failed: ${err.message}`)
      // Fallback: try pixflux (no style ref, but at least generates something)
      console.log(`    Trying pixflux fallback...`)
      try {
        const data = await apiCall('generate-image-pixflux', {
          description: frame.desc,
          image_size: { width: 128, height: 192 },
          no_background: true,
          view: 'side',
          direction: 'east',
          shading: 'medium shading',
          detail: 'highly detailed',
          outline: 'single color black outline',
        })
        await saveImage(data, `${frame.name}.png`)
      } catch (err2) {
        console.log(`  ✗✗ ${frame.name} pixflux fallback also failed: ${err2.message}`)
      }
    }
    await delay(500)
  }
}

// ─── PLAYER ANIMATION FRAMES ─────────────────────────────────
// Use animate-with-text to generate consistent player animation frames
// from the existing player_idle1 as reference.

async function generatePlayerAnimations() {
  console.log('\n── Generating Player Animation Frames ──')

  const refPath = path.join(OUT_DIR, 'player_idle1.png')
  if (!fs.existsSync(refPath)) {
    console.log('  ✗ player_idle1.png not found — cannot generate animations')
    return
  }

  // animate-with-text requires 64x64 — pad the 32x64 player sprite to 64x64 (centered)
  console.log('  Preparing 64x64 reference image...')
  const paddedBuf = await sharp(refPath)
    .extend({ top: 0, bottom: 0, left: 16, right: 16, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  const refB64 = paddedBuf.toString('base64')

  // animate-with-text is locked to 64x64, which fits our 32x64 player
  const animations = [
    {
      action: 'jump',
      desc: 'astronaut character in white space suit with blue visor helmet, jumping upward',
      outPrefix: 'player_anim_jump',
      nFrames: 4,
    },
    {
      action: 'fall',
      desc: 'astronaut character in white space suit with blue visor helmet, falling downward with arms out',
      outPrefix: 'player_anim_fall',
      nFrames: 2,
    },
    {
      action: 'run',
      desc: 'astronaut character in white space suit with blue visor helmet, running',
      outPrefix: 'player_anim_run',
      nFrames: 6,
    },
    {
      action: 'idle',
      desc: 'astronaut character in white space suit with blue visor helmet, standing idle breathing',
      outPrefix: 'player_anim_idle',
      nFrames: 4,
    },
    {
      action: 'attack',
      desc: 'astronaut character in white space suit with blue visor helmet, swinging a pickaxe',
      outPrefix: 'player_anim_attack',
      nFrames: 4,
    },
    {
      action: 'climb',
      desc: 'astronaut character in white space suit with blue visor helmet, climbing a ladder',
      outPrefix: 'player_anim_climb',
      nFrames: 4,
    },
    {
      action: 'death',
      desc: 'astronaut character in white space suit with blue visor helmet, collapsing and dying',
      outPrefix: 'player_anim_death',
      nFrames: 4,
    },
  ]

  for (const anim of animations) {
    // Check if first frame already exists
    if (spriteExists(`${anim.outPrefix}_0.png`)) {
      console.log(`  ⏭ ${anim.outPrefix} (exists, skipping)`)
      continue
    }
    console.log(`  Generating ${anim.outPrefix} (${anim.nFrames} frames)...`)
    try {
      const data = await apiCall('animate-with-text', {
        description: anim.desc,
        action: anim.action,
        image_size: { width: 64, height: 64 },
        reference_image: { base64: refB64 },
        view: 'side',
        direction: 'east',
        n_frames: anim.nFrames,
        start_frame_index: 0,
        text_guidance_scale: 8,
        image_guidance_scale: 2.0,
      })
      if (data.images && data.images.length > 0) {
        await saveImages(data.images, anim.outPrefix)
      } else {
        console.log(`  ✗ ${anim.outPrefix}: no images returned`)
      }
    } catch (err) {
      console.log(`  ✗ ${anim.outPrefix} failed: ${err.message}`)
    }
    await delay(500)
  }
}

// ─── MAIN ────────────────────────────────────────────────────

async function main() {
  console.log('PixelLab Missing Sprite Generator for Starfall')
  console.log('Output:', OUT_DIR)
  if (SKIP_EXISTING) console.log('Skipping existing sprites')
  console.log('')

  // Check balance first
  try {
    const res = await fetch(`${API_URL}/balance`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    })
    const bal = await res.json()
    console.log(`API Balance: ${JSON.stringify(bal)}`)
  } catch (_) {
    console.log('Could not check balance')
  }

  if (!ONLY_PLAYER) {
    await generateVoidLordFrames()
  }
  if (!ONLY_VOID_LORD) {
    await generatePlayerAnimations()
  }

  console.log('\n✓ Done!')
}

main().catch(err => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})
