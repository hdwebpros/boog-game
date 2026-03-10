const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const API_URL = 'https://api.pixellab.ai/v1'
const API_KEY = 'd0498097-128b-4c78-8e33-1d1b295ecbfe'
const OUT_DIR = path.resolve(__dirname, '../public/sprites')

fs.mkdirSync(OUT_DIR, { recursive: true })

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

function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}

// ─── TILE DEFINITIONS ────────────────────────────────────────
// Names match TileType enum: GRASS=1, DIRT=2, STONE=3, WOOD=4, LEAVES=5,
// IRON_ORE=6, DIAMOND_ORE=7, TITANIUM_ORE=8, LAVA=9, WATER=10, SAND=11, CORAL=12, CARBON_FIBER=13
//
// These are TILEABLE BLOCK TEXTURES for a 2D side-scrolling platformer (like Terraria).
// Each tile is a square cross-section of material — NOT an object or item.
// They must fill the entire square uniformly so they tile seamlessly when placed next to each other.
const TILES = [
  {
    name: 'tile_1', label: 'grass',
    desc: 'seamless tileable grass-over-dirt block texture for a 2D side-scrolling platformer. Top 25% is bright green grass with small grass blade details on the top edge. Bottom 75% is brown dirt. Fills the entire square. Terraria style.',
  },
  {
    name: 'tile_2', label: 'dirt',
    desc: 'seamless tileable dirt block texture for a 2D side-scrolling platformer. Uniform brown earth filling the entire square with small pebble and root details scattered throughout. Terraria style.',
  },
  {
    name: 'tile_3', label: 'stone',
    desc: 'seamless tileable stone block texture for a 2D side-scrolling platformer. Uniform gray rock filling the entire square with subtle crack lines and rough surface detail. Terraria style.',
  },
  {
    name: 'tile_4', label: 'wood',
    desc: 'seamless tileable wood plank block texture for a 2D side-scrolling platformer. Brown wooden planks filling the entire square with horizontal wood grain lines and knot details. Terraria style.',
  },
  {
    name: 'tile_5', label: 'leaves',
    desc: 'seamless tileable leaf foliage block texture for a 2D side-scrolling platformer. Dense cluster of green leaves filling the entire square with small light gaps between leaves. NOT a tree, just leaves texture. Terraria style.',
  },
  {
    name: 'tile_6', label: 'iron_ore',
    desc: 'seamless tileable iron ore block texture for a 2D side-scrolling platformer. Gray stone base filling the entire square with clusters of brownish-orange iron ore deposits embedded in the rock. Terraria style.',
  },
  {
    name: 'tile_7', label: 'diamond_ore',
    desc: 'seamless tileable diamond ore block texture for a 2D side-scrolling platformer. Gray stone base filling the entire square with bright cyan blue diamond crystals embedded in the rock. Terraria style.',
  },
  {
    name: 'tile_8', label: 'titanium_ore',
    desc: 'seamless tileable titanium ore block texture for a 2D side-scrolling platformer. Gray stone base filling the entire square with shiny silver-white metallic titanium veins running through the rock. Terraria style.',
  },
  {
    name: 'tile_9', label: 'lava',
    desc: 'seamless tileable lava block texture for a 2D side-scrolling platformer. Bright orange-red molten magma filling the entire square with yellow-white glowing hot spots and dark cooling cracks. Terraria style.',
  },
  {
    name: 'tile_10', label: 'water',
    desc: 'seamless tileable water block texture for a 2D side-scrolling platformer. Semi-transparent blue water filling the entire square with light wave ripple highlights and darker blue depth variation. Terraria style.',
  },
  {
    name: 'tile_11', label: 'sand',
    desc: 'seamless tileable sand block texture for a 2D side-scrolling platformer. Pale yellow-beige sand filling the entire square with tiny grain variation and occasional small shell or pebble. Terraria style.',
  },
  {
    name: 'tile_12', label: 'coral',
    desc: 'seamless tileable coral block texture for a 2D side-scrolling platformer. Bright pink coral material filling the entire square with bumpy organic branch-like texture patterns. Terraria style.',
  },
  {
    name: 'tile_13', label: 'carbon_fiber',
    desc: 'seamless tileable carbon fiber block texture for a 2D side-scrolling platformer. Dark navy blue-black high-tech material filling the entire square with a tight woven crosshatch pattern and subtle sheen. Terraria style.',
  },
]

// ─── ENEMY DEFINITIONS ──────────────────────────────────────
// Side-view characters for a 2D platformer. Facing right. Transparent background.
const ENEMIES = [
  {
    name: 'enemy_space_slug', w: 32, h: 32,
    desc: 'small alien slug enemy for a 2D side-scrolling platformer game. Green slimy oval body low to the ground, two antennae on head, small beady eyes. Facing right. Pixel art creature sprite.',
  },
  {
    name: 'enemy_cave_bat', w: 32, h: 32,
    desc: 'small bat enemy for a 2D side-scrolling platformer game. Dark purple body with outstretched membrane wings, pointy ears, small red eyes, tiny fangs. Flying pose facing right. Pixel art creature sprite.',
  },
  {
    name: 'enemy_rock_golem', w: 32, h: 48,
    desc: 'medium rock golem enemy for a 2D side-scrolling platformer game. Bulky humanoid body made of stacked gray boulders, glowing orange eyes, thick stone arms with fist hands, short legs. Standing facing right. Pixel art creature sprite.',
  },
  {
    name: 'enemy_anglerfish', w: 32, h: 32,
    desc: 'deep sea anglerfish enemy for a 2D side-scrolling platformer game. Round dark blue fish body, huge open mouth with sharp white teeth, one big eye, glowing yellow bioluminescent lure dangling from head. Facing right. Pixel art creature sprite.',
  },
  {
    name: 'enemy_lava_serpent', w: 32, h: 48,
    desc: 'fire serpent enemy for a 2D side-scrolling platformer game. Vertical coiling orange-red snake body with small horns on head, yellow slit eyes, flickering flame on tail tip. Facing right. Pixel art creature sprite.',
  },
  {
    name: 'enemy_corrupted_drone', w: 32, h: 32,
    desc: 'hostile robot drone enemy for a 2D side-scrolling platformer game. Compact red metallic sphere body with small rotor blades on top, single glowing red camera eye, small gun barrel pointing forward. Hovering, facing right. Pixel art creature sprite.',
  },
]

// ─── BOSS DEFINITIONS ───────────────────────────────────────
// Large boss characters, side-view, transparent background.
const BOSSES = [
  {
    name: 'boss_vine_guardian', w: 48, h: 64,
    desc: 'large forest guardian boss for a 2D side-scrolling platformer game. Tall living tree creature with thick bark trunk body, two long vine whip arms, glowing yellow eyes in the trunk, leafy canopy on top of head, gnarled root feet. Standing facing right. Pixel art boss sprite.',
  },
  {
    name: 'boss_deep_sea_leviathan', w: 64, h: 48,
    desc: 'large sea serpent boss for a 2D side-scrolling platformer game. Long horizontal blue-green sea monster with armored scales, massive jaw with rows of teeth, one fierce white eye, tall dorsal fin on back, tail fin. Swimming facing right. Pixel art boss sprite.',
  },
  {
    name: 'boss_crystal_golem', w: 48, h: 64,
    desc: 'huge crystal golem boss for a 2D side-scrolling platformer game. Massive humanoid body made of light blue translucent crystal, jagged crystal spike crown on head, glowing white eyes, enormous crystal fists, thick legs. Standing facing right. Pixel art boss sprite.',
  },
  {
    name: 'boss_magma_wyrm', w: 48, h: 48,
    desc: 'fire dragon boss for a 2D side-scrolling platformer game. Coiled orange-red dragon with two curved horns, small bat-like wings, glowing lava cracks along body, breathing fire from mouth, spiked tail. Facing right. Pixel art boss sprite.',
  },
  {
    name: 'boss_core_sentinel', w: 48, h: 48,
    desc: 'alien energy sentinel boss for a 2D side-scrolling platformer game. Floating diamond-shaped purple crystalline body, bright glowing pink energy core in the center, two orbiting energy ring halos, single menacing eye sensor at top. Hovering. Pixel art boss sprite.',
  },
  {
    name: 'boss_mothership', w: 64, h: 48,
    desc: 'alien UFO mothership boss for a 2D side-scrolling platformer game. Wide pink-purple flying saucer with a glass dome cockpit on top, row of small cyan glowing windows around the rim, two engine pods on sides, tractor beam emitter underneath. Hovering. Pixel art boss sprite.',
  },
]

// ─── PROJECTILE DEFINITIONS ─────────────────────────────────
const PROJECTILES = [
  {
    name: 'proj_arrow', w: 32, h: 32,
    desc: 'single arrow projectile for a 2D side-scrolling game. Thin wooden arrow shaft with pointed metal arrowhead on right and feather fletching on left. Horizontal, flying right. Pixel art.',
  },
  {
    name: 'proj_magic', w: 32, h: 32,
    desc: 'magic energy ball projectile for a 2D side-scrolling game. Glowing purple orb with bright white core center, small magical sparkle particles around it. Pixel art.',
  },
  {
    name: 'proj_enemy', w: 32, h: 32,
    desc: 'enemy fireball projectile for a 2D side-scrolling game. Small glowing red-orange fire ball with trailing flame sparks. Pixel art.',
  },
  {
    name: 'summon_minion', w: 32, h: 32,
    desc: 'small friendly floating spirit companion for a 2D side-scrolling game. Cute small teal-green ghostly wisp body with two round white eyes, soft magical glow aura around it. Pixel art.',
  },
]

// ─── GENERATION FUNCTIONS ───────────────────────────────────

async function generateTiles() {
  console.log('\n── Generating Tiles (13) ──')
  for (const tile of TILES) {
    console.log(`  Generating ${tile.label}...`)
    const data = await generate('generate-image-pixflux', {
      description: tile.desc,
      image_size: { width: 32, height: 32 },
      no_background: false,
      view: 'side',
      shading: 'basic shading',
      detail: 'medium detail',
      outline: 'lineless',
    })
    await saveAndDownscale(data, `${tile.name}.png`, 16, 16)
    await delay(300)
  }
}

async function generateEnemies() {
  console.log('\n── Generating Enemies (6) ──')
  for (const enemy of ENEMIES) {
    console.log(`  Generating ${enemy.name}...`)
    const data = await generate('generate-image-pixflux', {
      description: enemy.desc,
      image_size: { width: enemy.w, height: enemy.h },
      no_background: true,
      view: 'side',
      direction: 'east',
      shading: 'medium shading',
      detail: 'medium detail',
      outline: 'single color black outline',
    })
    await saveImage(data, `${enemy.name}.png`)
    await delay(300)
  }
}

async function generateBosses() {
  console.log('\n── Generating Bosses (6) ──')
  for (const boss of BOSSES) {
    console.log(`  Generating ${boss.name}...`)
    const data = await generate('generate-image-pixflux', {
      description: boss.desc,
      image_size: { width: boss.w, height: boss.h },
      no_background: true,
      view: 'side',
      direction: 'east',
      shading: 'medium shading',
      detail: 'highly detailed',
      outline: 'single color black outline',
    })
    await saveImage(data, `${boss.name}.png`)
    await delay(300)
  }
}

async function generateProjectiles() {
  console.log('\n── Generating Projectiles (4) ──')
  for (const proj of PROJECTILES) {
    console.log(`  Generating ${proj.name}...`)
    const data = await generate('generate-image-pixflux', {
      description: proj.desc,
      image_size: { width: proj.w, height: proj.h },
      no_background: true,
      view: 'side',
      direction: 'east',
      shading: 'basic shading',
      detail: 'medium detail',
      outline: 'lineless',
    })
    await saveImage(data, `${proj.name}.png`)
    await delay(300)
  }
}

async function main() {
  const total = TILES.length + ENEMIES.length + BOSSES.length + PROJECTILES.length
  console.log('PixelLab Sprite Generator for Starfall')
  console.log('Output:', OUT_DIR)
  console.log(`Total generations needed: ${total}`)

  await generateTiles()
  await generateEnemies()
  await generateBosses()
  await generateProjectiles()

  console.log(`\n✓ All ${total} sprites generated!`)
}

main().catch(err => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})
