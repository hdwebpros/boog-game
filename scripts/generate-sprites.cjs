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
  {
    name: 'tile_14', label: 'station_workbench',
    desc: 'seamless tileable wooden workbench block texture for a 2D side-scrolling platformer. Brown wooden crafting table surface filling the entire square with a flat wooden top, visible tools like a hammer and saw on the surface, wooden legs at bottom. Terraria style.',
  },
  {
    name: 'tile_15', label: 'station_furnace',
    desc: 'seamless tileable furnace block texture for a 2D side-scrolling platformer. Brick-red stone furnace filling the entire square with a dark opening in the center showing orange glowing embers inside, chimney vent at top. Terraria style.',
  },
  {
    name: 'tile_16', label: 'station_anvil',
    desc: 'seamless tileable anvil block texture for a 2D side-scrolling platformer. Dark gray metallic anvil filling the entire square with a flat striking surface on top, tapered horn on one side, heavy base. Terraria style.',
  },
  {
    name: 'tile_17', label: 'station_tech_bench',
    desc: 'seamless tileable high-tech workbench block texture for a 2D side-scrolling platformer. Sleek blue-gray metal workstation filling the entire square with small blinking lights, circuit board patterns, and a glowing blue screen. Terraria style.',
  },
  {
    name: 'tile_18', label: 'station_fusion',
    desc: 'seamless tileable fusion reactor station block texture for a 2D side-scrolling platformer. Purple high-tech reactor filling the entire square with a glowing magenta energy core in the center, metallic casing, energy conduit lines. Terraria style.',
  },
  {
    name: 'tile_19', label: 'station_workbench_mk2',
    desc: 'seamless tileable upgraded workbench block texture for a 2D side-scrolling platformer. Polished tan-brown wooden workbench filling the entire square with metal reinforcements, organized tools, drawers, and a small vise on top. Terraria style.',
  },
  {
    name: 'tile_36', label: 'station_arcane_anvil',
    desc: 'seamless tileable arcane anvil block texture for a 2D side-scrolling platformer. Dark purple-black magical anvil filling the entire square with glowing violet rune engravings on the surface, ethereal purple energy wisps rising from the striking face, crystalline accents embedded in the heavy base. Terraria style.',
  },
  {
    name: 'tile_42', label: 'chest',
    desc: 'wooden treasure chest block texture for a 2D side-scrolling platformer. Brown wooden chest with darker wood plank bands, gold metal latch and hinges, slightly rounded lid on top. Fills the entire square. Terraria style.',
  },
  // ─── VOID DIMENSION TILES ──────────────────────────────────
  {
    name: 'tile_49', label: 'void_stone',
    desc: 'seamless tileable void stone block texture for a 2D side-scrolling platformer. Dark purple-black alien rock filling the entire square with faint glowing violet veins and cracks running through the surface, otherworldly corrupted stone. Terraria style.',
  },
  {
    name: 'tile_50', label: 'void_dirt',
    desc: 'seamless tileable void dirt block texture for a 2D side-scrolling platformer. Deep purple-tinted dark earth filling the entire square with small corrupted pebbles and faint magenta particle specks throughout. Terraria style.',
  },
  {
    name: 'tile_51', label: 'void_grass',
    desc: 'seamless tileable void grass block texture for a 2D side-scrolling platformer. Top 25% is vibrant purple-violet alien grass with jagged blade details on the top edge. Bottom 75% is dark purple void dirt. Fills the entire square. Terraria style.',
  },
  {
    name: 'tile_52', label: 'hellfire_ore',
    desc: 'seamless tileable hellfire ore block texture for a 2D side-scrolling platformer. Dark purple void stone base filling the entire square with clusters of bright orange-red fiery ore deposits that glow with intense heat, ember particles visible. Terraria style.',
  },
  {
    name: 'tile_53', label: 'void_crystal',
    desc: 'seamless tileable void crystal ore block texture for a 2D side-scrolling platformer. Dark purple void stone base filling the entire square with large glowing bright purple-magenta crystal formations embedded in the rock, radiating ethereal light. Terraria style.',
  },
  {
    name: 'tile_54', label: 'brimstone',
    desc: 'seamless tileable brimstone block texture for a 2D side-scrolling platformer. Dark brownish-red sulfurous rock filling the entire square with yellow-orange brimstone deposits and rough cracked surface texture, hellish volcanic material. Terraria style.',
  },
  {
    name: 'tile_55', label: 'void_wood',
    desc: 'seamless tileable void wood plank block texture for a 2D side-scrolling platformer. Very dark purple-black corrupted wood planks filling the entire square with faint glowing violet grain lines and twisted knot patterns. Terraria style.',
  },
  {
    name: 'tile_56', label: 'void_leaves',
    desc: 'seamless tileable void leaf foliage block texture for a 2D side-scrolling platformer. Dense cluster of dark purple and magenta alien leaves filling the entire square with faint ethereal glow between leaves, corrupted otherworldly foliage. Terraria style.',
  },
  {
    name: 'tile_57', label: 'ash_block',
    desc: 'seamless tileable ash block texture for a 2D side-scrolling platformer. Dark gray volcanic ash filling the entire square with fine grainy texture, subtle lighter gray streaks, and tiny charcoal fragments scattered throughout. Terraria style.',
  },
  {
    name: 'tile_58', label: 'nether_brick',
    desc: 'seamless tileable nether brick block texture for a 2D side-scrolling platformer. Dark red-maroon bricks filling the entire square in a stacked pattern with dark mortar lines between bricks, ancient demonic architecture material. Terraria style.',
  },
  {
    name: 'tile_59', label: 'soul_sand',
    desc: 'seamless tileable soul sand block texture for a 2D side-scrolling platformer. Dark brown-gray sand filling the entire square with faint ghostly face impressions in the surface, eerie wailing souls trapped within the sandy material. Terraria style.',
  },
  {
    name: 'tile_60', label: 'void_portal_block',
    desc: 'seamless tileable void portal block texture for a 2D side-scrolling platformer. Swirling deep purple and magenta energy filling the entire square with bright white-purple particle streaks, interdimensional rift energy, glowing portal material. Terraria style.',
  },
  {
    name: 'tile_321', label: 'station_void_forge',
    desc: 'seamless tileable void forge station block texture for a 2D side-scrolling platformer. Dark obsidian-purple forge filling the entire square with a glowing magenta flame in the center opening, corrupted metal framework, purple energy runes etched on the surface, void dimension crafting station. Terraria style.',
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
  {
    name: 'enemy_vampire', w: 32, h: 32,
    desc: 'small vampire bat enemy for a 2D side-scrolling platformer game. Dark purple body with outstretched membrane wings, pointy ears, small glowing red eyes, tiny white fangs. Flying pose facing right. Pixel art creature sprite.',
  },
  // ─── VOID DIMENSION ENEMIES ────────────────────────────────
  {
    name: 'enemy_void_wraith', w: 32, h: 36,
    desc: 'ghostly void wraith enemy for a 2D side-scrolling platformer game. Ethereal purple-violet floating specter with tattered dark robes, glowing magenta eyes, wispy trailing lower body that fades to nothing, outstretched clawed hands. Facing right. Pixel art creature sprite.',
  },
  {
    name: 'enemy_shadow_stalker', w: 32, h: 40,
    desc: 'shadow stalker enemy for a 2D side-scrolling platformer game. Tall sleek dark purple-black humanoid creature with elongated limbs, glowing white slit eyes, sharp claws, crouched predatory stance ready to pounce. Facing right. Pixel art creature sprite.',
  },
  {
    name: 'enemy_hellfire_imp', w: 32, h: 32,
    desc: 'small hellfire imp enemy for a 2D side-scrolling platformer game. Tiny red-orange demon with small curved horns, bat-like wings, mischievous glowing yellow eyes, flaming hands holding a fireball, pointed tail. Flying facing right. Pixel art creature sprite.',
  },
  {
    name: 'enemy_nether_golem', w: 40, h: 48,
    desc: 'large nether golem enemy for a 2D side-scrolling platformer game. Massive bulky humanoid body made of dark red nether bricks and obsidian, glowing orange lava cracks between body segments, heavy fists, burning ember eyes. Standing facing right. Pixel art creature sprite.',
  },
  {
    name: 'enemy_soul_eater', w: 32, h: 34,
    desc: 'soul eater enemy for a 2D side-scrolling platformer game. Floating pale blue ghostly jellyfish-like creature with translucent bell-shaped head, dangling ethereal tentacles, glowing cyan core inside body, eerie soul-absorbing aura. Facing right. Pixel art creature sprite.',
  },
  {
    name: 'enemy_void_serpent', w: 48, h: 24,
    desc: 'void serpent enemy for a 2D side-scrolling platformer game. Long horizontal dark purple snake with glowing violet scale patterns, menacing fangs, four small vestigial legs, spiked tail, slithering through the void. Facing right. Pixel art creature sprite.',
  },
  {
    name: 'enemy_chaos_elemental', w: 32, h: 38,
    desc: 'chaos elemental enemy for a 2D side-scrolling platformer game. Swirling humanoid figure made of unstable magenta and purple energy, crackling with pink lightning bolts, no distinct face just two bright white eye holes, fragments orbiting its body. Facing right. Pixel art creature sprite.',
  },
  {
    name: 'enemy_dark_knight', w: 36, h: 48,
    desc: 'dark knight enemy for a 2D side-scrolling platformer game. Tall armored knight in dark purple-black plate armor with glowing violet visor slit, wielding a large dark sword, tattered dark cape flowing behind, heavy boots. Standing facing right. Pixel art creature sprite.',
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
  // ─── VOID LORD BOSS ────────────────────────────────────────
  {
    name: 'boss_void_lord', w: 128, h: 192,
    desc: 'massive void lord final boss for a 2D side-scrolling platformer game. Towering dark purple-black demonic entity with enormous curved horns, four glowing magenta eyes, flowing dark robes made of void energy, huge clawed hands crackling with purple lightning, swirling dimensional rift energy around the lower body, crown of floating dark crystals above head. Menacing and godlike. Facing right. Pixel art boss sprite.',
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

// ─── ITEM / ACCESSORY DEFINITIONS ──────────────────────────
// Small inventory icon sprites. 32x32 with transparent background.
const ITEMS = [
  {
    name: 'item_250', label: 'silver_coin',
    desc: 'single shiny silver coin for a 2D side-scrolling game inventory icon. Round coin with stamped star emblem in center, metallic silver sheen with highlights. Pixel art item sprite.',
  },
  {
    name: 'item_300', label: 'cloud_boots',
    desc: 'magical cloud boots accessory for a 2D side-scrolling game inventory icon. Pair of fluffy white cloud-shaped boots with small blue wing accents on each side, soft glowing aura. Pixel art item sprite.',
  },
  {
    name: 'item_301', label: 'star_compass',
    desc: 'star compass accessory for a 2D side-scrolling game inventory icon. Ornate golden compass with a glowing cyan star needle in the center, circular brass casing with tiny jewels around the rim. Pixel art item sprite.',
  },
  {
    name: 'item_302', label: 'gravity_belt',
    desc: 'gravity belt accessory for a 2D side-scrolling game inventory icon. Thick dark purple belt with a round glowing magenta anti-gravity buckle in the center, small metallic clasps. Pixel art item sprite.',
  },
  {
    name: 'item_303', label: 'miners_lantern',
    desc: "miner's lantern accessory for a 2D side-scrolling game inventory icon. Small brass lantern with warm yellow-orange glowing flame inside glass dome, metal handle on top, rustic mining tool. Pixel art item sprite.",
  },
  {
    name: 'item_304', label: 'lucky_charm',
    desc: 'lucky charm accessory for a 2D side-scrolling game inventory icon. Small golden four-leaf clover charm on a thin chain, sparkling green gem in the center, magical sparkle particles around it. Pixel art item sprite.',
  },
  {
    name: 'item_305', label: 'celestial_cape',
    desc: 'celestial cape accessory for a 2D side-scrolling game inventory icon. Flowing dark blue-purple cape with tiny white stars and constellations pattern, glowing cosmic energy at the edges, magical space-themed fabric. Pixel art item sprite.',
  },
  {
    name: 'item_116', label: 'chest',
    desc: 'wooden treasure chest inventory icon for a 2D side-scrolling game. Small brown wooden chest with darker plank bands, gold metal latch and lock on the front, slightly rounded lid on top. Pixel art item sprite.',
  },
  {
    name: 'item_242', label: 'mystical_compass',
    desc: 'mystical compass navigation item for a 2D side-scrolling game inventory icon. Ancient ornate compass with glowing blue magical rune symbols around the rim, a spinning ethereal blue needle in the center, dark metal casing with arcane engravings. Pixel art item sprite.',
  },
  // ─── VOID DIMENSION ITEMS ─────────────────────────────────
  // Stations
  {
    name: 'item_320', label: 'super_portal',
    desc: 'super portal device inventory icon for a 2D side-scrolling game. Dark obsidian frame with swirling purple void energy in the center, glowing magenta runes on the edges, interdimensional gateway device. Pixel art item sprite.',
  },
  {
    name: 'item_321', label: 'void_forge',
    desc: 'void forge station inventory icon for a 2D side-scrolling game. Small dark purple-black anvil forge with glowing magenta flames, corrupted metal frame, purple energy runes etched on the surface. Pixel art item sprite.',
  },
  // Weapons
  {
    name: 'item_330', label: 'void_blade',
    desc: 'void blade sword inventory icon for a 2D side-scrolling game. Sleek dark purple-black sword with glowing magenta edge, ethereal void energy wisps trailing from the blade, dark metal crossguard. Pixel art item sprite.',
  },
  {
    name: 'item_331', label: 'abyssal_scythe',
    desc: 'abyssal scythe weapon inventory icon for a 2D side-scrolling game. Long dark scythe with curved glowing purple blade, twisted dark handle wrapped in void tendrils, ethereal dark energy emanating from the blade edge. Pixel art item sprite.',
  },
  {
    name: 'item_332', label: 'hellfire_bow',
    desc: 'hellfire bow weapon inventory icon for a 2D side-scrolling game. Dark red-orange bow made of smoldering hellfire material, glowing ember string, small flames licking along the curved limbs, fiery demonic weapon. Pixel art item sprite.',
  },
  {
    name: 'item_333', label: 'void_staff',
    desc: 'void staff magic weapon inventory icon for a 2D side-scrolling game. Tall dark purple staff with a floating glowing magenta void orb at the top, twisted dark metal shaft with purple energy veins running along it. Pixel art item sprite.',
  },
  {
    name: 'item_334', label: 'soul_reaver',
    desc: 'soul reaver summoning weapon inventory icon for a 2D side-scrolling game. Ethereal pale blue crystal scepter with ghostly soul wisps swirling around the glowing tip, dark handle with spectral chain wrapped around it. Pixel art item sprite.',
  },
  {
    name: 'item_335', label: 'chaos_edge',
    desc: 'chaos edge sword inventory icon for a 2D side-scrolling game. Jagged unstable sword with swirling magenta and purple chaos energy along the blade, the edge seems to distort reality, fractured crystalline crossguard. Pixel art item sprite.',
  },
  {
    name: 'item_336', label: 'dimensional_rifle',
    desc: 'dimensional rifle ranged weapon inventory icon for a 2D side-scrolling game. Sleek dark purple-black sci-fi rifle with a glowing magenta energy chamber, void crystal barrel tip, dark metal frame with purple circuit lines. Pixel art item sprite.',
  },
  {
    name: 'item_337', label: 'arcane_annihilator',
    desc: 'arcane annihilator magic weapon inventory icon for a 2D side-scrolling game. Ornate dark purple wand with a large swirling vortex of magenta and white energy at the tip, covered in glowing arcane runes, radiating destructive magical power. Pixel art item sprite.',
  },
  // Armor
  {
    name: 'item_340', label: 'void_helmet',
    desc: 'void helmet armor inventory icon for a 2D side-scrolling game. Dark purple-black helmet with glowing magenta visor slit, curved void crystal horns on top, ethereal purple energy wisps around it. Pixel art item sprite.',
  },
  {
    name: 'item_341', label: 'void_chestplate',
    desc: 'void chestplate armor inventory icon for a 2D side-scrolling game. Dark purple-black chest armor with glowing magenta energy lines along the edges, void crystal shoulder pads, ethereal dark material. Pixel art item sprite.',
  },
  {
    name: 'item_342', label: 'void_leggings',
    desc: 'void leggings armor inventory icon for a 2D side-scrolling game. Dark purple-black leg armor with glowing magenta knee guards, void energy veins running down the legs, otherworldly protective gear. Pixel art item sprite.',
  },
  {
    name: 'item_343', label: 'void_boots',
    desc: 'void boots armor inventory icon for a 2D side-scrolling game. Dark purple-black heavy boots with glowing magenta soles, void crystal accents, trailing purple energy wisps from the heels. Pixel art item sprite.',
  },
  // Materials
  {
    name: 'item_350', label: 'void_essence',
    desc: 'void essence material inventory icon for a 2D side-scrolling game. Small swirling orb of concentrated dark purple void energy with bright magenta core, ethereal wisps trailing off, mysterious alien substance. Pixel art item sprite.',
  },
  {
    name: 'item_351', label: 'hellfire_core',
    desc: 'hellfire core material inventory icon for a 2D side-scrolling game. Glowing orange-red molten core with bright yellow center, small flames and ember particles around it, intensely hot demonic material. Pixel art item sprite.',
  },
  {
    name: 'item_352', label: 'soul_fragment',
    desc: 'soul fragment material inventory icon for a 2D side-scrolling game. Translucent pale blue crystalline shard with a ghostly face faintly visible inside, soft ethereal glow, spectral wispy edges. Pixel art item sprite.',
  },
  {
    name: 'item_353', label: 'chaos_shard',
    desc: 'chaos shard material inventory icon for a 2D side-scrolling game. Jagged magenta crystal fragment crackling with unstable pink-purple energy, reality-warping distortion around the edges, volatile and dangerous looking. Pixel art item sprite.',
  },
  {
    name: 'item_354', label: 'abyssal_ingot',
    desc: 'abyssal ingot material inventory icon for a 2D side-scrolling game. Dark purple-black refined metal bar with faint glowing magenta veins through the surface, polished otherworldly alloy, heavy and dense looking. Pixel art item sprite.',
  },
  {
    name: 'item_355', label: 'dimensional_fabric',
    desc: 'dimensional fabric material inventory icon for a 2D side-scrolling game. Folded piece of shimmering dark purple fabric with tiny star-like sparkles embedded in it, edges seem to phase in and out of reality, interdimensional textile. Pixel art item sprite.',
  },
  // Artifacts
  {
    name: 'item_360', label: 'warp_crystal',
    desc: 'warp crystal artifact inventory icon for a 2D side-scrolling game. Glowing purple hexagonal crystal with swirling dimensional energy inside, bright magenta facets, small reality-warping distortion around it. Pixel art item sprite.',
  },
  {
    name: 'item_361', label: 'soul_lantern',
    desc: 'soul lantern artifact inventory icon for a 2D side-scrolling game. Small ornate dark metal lantern with a ghostly pale blue flame inside, spectral soul wisps escaping from the vents, eerie otherworldly light source. Pixel art item sprite.',
  },
  {
    name: 'item_362', label: 'chaos_heart',
    desc: 'chaos heart artifact inventory icon for a 2D side-scrolling game. Pulsing dark magenta crystalline heart shape with crackling pink energy veins, unstable chaotic energy radiating outward, powerful and dangerous. Pixel art item sprite.',
  },
  {
    name: 'item_363', label: 'void_eye',
    desc: 'void eye artifact inventory icon for a 2D side-scrolling game. Single large floating purple eyeball with bright magenta iris and dark slit pupil, surrounded by swirling void energy tendrils, all-seeing otherworldly artifact. Pixel art item sprite.',
  },
  {
    name: 'item_364', label: 'temporal_shard',
    desc: 'temporal shard artifact inventory icon for a 2D side-scrolling game. Elongated pale blue-white crystal shard with clock-like circular rune markings faintly visible inside, time-distortion shimmer effect around the edges. Pixel art item sprite.',
  },
  {
    name: 'item_365', label: 'dimensional_anchor',
    desc: 'dimensional anchor artifact inventory icon for a 2D side-scrolling game. Heavy dark purple metallic anchor-shaped artifact with glowing magenta chain links, reality-stabilizing device with void runes etched on the surface. Pixel art item sprite.',
  },
  // Special items
  {
    name: 'item_370', label: 'void_lord_summon_token',
    desc: 'void lord summon token inventory icon for a 2D side-scrolling game. Dark obsidian medallion with a glowing purple void lord sigil in the center, surrounded by swirling magenta energy, ominous boss summoning artifact. Pixel art item sprite.',
  },
  {
    name: 'item_380', label: 'trophy_void_lord',
    desc: 'trophy of the void lord inventory icon for a 2D side-scrolling game. Ornate dark purple crystalline trophy with a miniature void lord skull on top, glowing magenta base with arcane inscriptions, ultimate victory reward. Pixel art item sprite.',
  },

  // ─── SHARD COMPASSES ────────────────────────────────────────
  {
    name: 'item_385', label: 'ember_shard_compass',
    desc: 'ember shard compass item for a 2D side-scrolling game inventory icon. Ornate dark iron compass with a glowing red-orange ember crystal needle in the center, fiery orange runes etched around the rim, smoldering embers glow within the casing, dark metal frame with heat-warped edges.',
  },
  {
    name: 'item_386', label: 'frost_shard_compass',
    desc: 'frost shard compass item for a 2D side-scrolling game inventory icon. Elegant silver compass with a glowing ice-blue crystal needle in the center, frost patterns and snowflake engravings around the rim, frozen crystalline casing with a cold blue glow, icy mist emanating from edges.',
  },
  {
    name: 'item_387', label: 'storm_shard_compass',
    desc: 'storm shard compass item for a 2D side-scrolling game inventory icon. Electrified bronze compass with a crackling yellow lightning crystal needle in the center, tiny lightning bolt symbols etched around the rim, sparking golden energy arcing across the surface, copper and brass casing.',
  },
  {
    name: 'item_388', label: 'void_shard_compass',
    desc: 'void shard compass item for a 2D side-scrolling game inventory icon. Otherworldly obsidian compass with a glowing deep purple void crystal needle in the center, swirling dark energy tendrils around the rim, shadowy particles orbiting the casing, black metal frame with purple void glow.',
  },
  {
    name: 'item_389', label: 'life_shard_compass',
    desc: 'life shard compass item for a 2D side-scrolling game inventory icon. Living wooden compass with a glowing bright green life crystal needle in the center, tiny vines and leaves growing around the rim, emerald green glow pulsing from within, natural wood and living bark casing.',
  },

  // ─── MATERIALS ──────────────────────────────────────────────
  {
    name: 'item_100', label: 'iron_bar',
    desc: 'iron bar material inventory icon for a 2D side-scrolling game. Rectangular brownish-orange metallic ingot with subtle sheen and forge marks on the surface. Pixel art item sprite.',
  },
  {
    name: 'item_101', label: 'diamond',
    desc: 'diamond gem material inventory icon for a 2D side-scrolling game. Brilliant sparkling cyan-blue cut diamond gemstone with bright white highlights and faceted edges. Pixel art item sprite.',
  },
  {
    name: 'item_102', label: 'titanium_bar',
    desc: 'titanium bar material inventory icon for a 2D side-scrolling game. Sleek shiny silver-white metallic ingot with a smooth polished surface, lightweight high-tech metal. Pixel art item sprite.',
  },
  {
    name: 'item_103', label: 'carbon_plate',
    desc: 'carbon plate material inventory icon for a 2D side-scrolling game. Dark navy blue-black high-tech plate with tight woven crosshatch carbon fiber pattern, futuristic material. Pixel art item sprite.',
  },
  {
    name: 'item_104', label: 'glass',
    desc: 'glass block material inventory icon for a 2D side-scrolling game. Transparent pale blue square glass pane with white highlight reflections on the surface. Pixel art item sprite.',
  },
  {
    name: 'item_105', label: 'plant_fiber',
    desc: 'plant fiber material inventory icon for a 2D side-scrolling game. Bundle of green plant fibers tied together with a small vine, natural crafting material. Pixel art item sprite.',
  },
  {
    name: 'item_106', label: 'torch',
    desc: 'torch inventory icon for a 2D side-scrolling game. Wooden stick with a bright orange-yellow flame burning at the top, warm glow emanating from the fire. Pixel art item sprite.',
  },

  // ─── STATIONS ───────────────────────────────────────────────
  {
    name: 'item_110', label: 'workbench',
    desc: 'wooden workbench station inventory icon for a 2D side-scrolling game. Small brown wooden crafting table with tools on the surface, saw and hammer visible. Pixel art item sprite.',
  },
  {
    name: 'item_111', label: 'furnace',
    desc: 'furnace station inventory icon for a 2D side-scrolling game. Brick-red stone furnace with dark opening showing orange glowing embers inside. Pixel art item sprite.',
  },
  {
    name: 'item_112', label: 'anvil',
    desc: 'anvil station inventory icon for a 2D side-scrolling game. Dark gray metallic anvil with flat striking surface on top and tapered horn. Pixel art item sprite.',
  },
  {
    name: 'item_113', label: 'tech_bench',
    desc: 'tech bench station inventory icon for a 2D side-scrolling game. Sleek blue-gray metal workstation with blinking lights and a glowing blue screen, high-tech. Pixel art item sprite.',
  },
  {
    name: 'item_114', label: 'fusion_station',
    desc: 'fusion station inventory icon for a 2D side-scrolling game. Purple high-tech reactor with a glowing magenta energy core in the center, metallic casing. Pixel art item sprite.',
  },
  {
    name: 'item_115', label: 'workbench_mk2',
    desc: 'upgraded workbench station inventory icon for a 2D side-scrolling game. Polished tan-brown wooden workbench with metal reinforcements and organized tools. Pixel art item sprite.',
  },
  {
    name: 'item_117', label: 'portal',
    desc: 'portal station inventory icon for a 2D side-scrolling game. Glowing purple dimensional portal with swirling energy in a stone frame. Pixel art item sprite.',
  },
  {
    name: 'item_118', label: 'brewing_stand',
    desc: 'brewing stand station inventory icon for a 2D side-scrolling game. Purple-tinted alchemical stand with glass flask, bubbling potion, metal frame with hooks. Pixel art item sprite.',
  },

  // ─── TOOLS ──────────────────────────────────────────────────
  {
    name: 'item_120', label: 'wood_pickaxe',
    desc: 'wooden pickaxe tool inventory icon for a 2D side-scrolling game. Simple pickaxe with brown wooden handle and crude wooden pick head, basic mining tool. Pixel art item sprite.',
  },
  {
    name: 'item_121', label: 'stone_pickaxe',
    desc: 'stone pickaxe tool inventory icon for a 2D side-scrolling game. Pickaxe with brown wooden handle and gray stone pick head, sturdy mining tool. Pixel art item sprite.',
  },
  {
    name: 'item_122', label: 'iron_pickaxe',
    desc: 'iron pickaxe tool inventory icon for a 2D side-scrolling game. Pickaxe with brown wooden handle and brownish-orange iron pick head, reliable mining tool. Pixel art item sprite.',
  },
  {
    name: 'item_123', label: 'diamond_pickaxe',
    desc: 'diamond pickaxe tool inventory icon for a 2D side-scrolling game. Pickaxe with brown wooden handle and sparkling cyan-blue diamond pick head, powerful mining tool. Pixel art item sprite.',
  },
  {
    name: 'item_124', label: 'titanium_pickaxe',
    desc: 'titanium pickaxe tool inventory icon for a 2D side-scrolling game. Pickaxe with sleek metal handle and shiny silver-white titanium pick head, top-tier mining tool. Pixel art item sprite.',
  },

  // ─── MELEE WEAPONS ─────────────────────────────────────────
  {
    name: 'item_130', label: 'wood_sword',
    desc: 'wooden sword weapon inventory icon for a 2D side-scrolling game. Simple brown wooden sword with crude blade shape, wrapped handle, basic starting weapon. Pixel art item sprite.',
  },
  {
    name: 'item_131', label: 'stone_sword',
    desc: 'stone sword weapon inventory icon for a 2D side-scrolling game. Gray stone blade sword with brown wooden handle, chipped but sturdy edges. Pixel art item sprite.',
  },
  {
    name: 'item_132', label: 'iron_sword',
    desc: 'iron sword weapon inventory icon for a 2D side-scrolling game. Brownish-orange iron blade sword with leather-wrapped handle and simple crossguard. Pixel art item sprite.',
  },
  {
    name: 'item_133', label: 'diamond_sword',
    desc: 'diamond sword weapon inventory icon for a 2D side-scrolling game. Sparkling cyan-blue diamond blade sword with ornate handle and jeweled crossguard. Pixel art item sprite.',
  },
  {
    name: 'item_134', label: 'titanium_sword',
    desc: 'titanium sword weapon inventory icon for a 2D side-scrolling game. Gleaming silver-white titanium blade sword with sleek modern handle design, top-tier weapon. Pixel art item sprite.',
  },

  // ─── RANGED WEAPONS ────────────────────────────────────────
  {
    name: 'item_140', label: 'wood_bow',
    desc: 'wooden bow weapon inventory icon for a 2D side-scrolling game. Simple curved brown wooden bow with taut string, basic ranged weapon. Pixel art item sprite.',
  },
  {
    name: 'item_141', label: 'iron_bow',
    desc: 'iron bow weapon inventory icon for a 2D side-scrolling game. Reinforced bow with brownish-orange iron limb tips and strong string, sturdy ranged weapon. Pixel art item sprite.',
  },
  {
    name: 'item_142', label: 'laser_gun',
    desc: 'laser gun weapon inventory icon for a 2D side-scrolling game. Sleek red sci-fi pistol with glowing energy chamber, futuristic barrel tip emitting faint red light. Pixel art item sprite.',
  },

  // ─── MAGIC WEAPONS ─────────────────────────────────────────
  {
    name: 'item_150', label: 'apprentice_staff',
    desc: 'apprentice magic staff weapon inventory icon for a 2D side-scrolling game. Simple wooden staff with a small glowing purple crystal orb at the top, beginner magic weapon. Pixel art item sprite.',
  },
  {
    name: 'item_151', label: 'crystal_staff',
    desc: 'crystal staff magic weapon inventory icon for a 2D side-scrolling game. Ornate staff with a large glowing violet crystal cluster at the top, purple energy wisps, powerful magic weapon. Pixel art item sprite.',
  },

  // ─── SUMMON WEAPONS ────────────────────────────────────────
  {
    name: 'item_160', label: 'drone_totem',
    desc: 'drone totem summon weapon inventory icon for a 2D side-scrolling game. Small teal-green carved totem with glowing rune eyes, summons a helper drone companion. Pixel art item sprite.',
  },
  {
    name: 'item_161', label: 'swarm_beacon',
    desc: 'swarm beacon summon weapon inventory icon for a 2D side-scrolling game. Glowing cyan-green crystalline beacon emitting pulsing light waves, summons a swarm of minions. Pixel art item sprite.',
  },

  // ─── BOSS SUMMON ITEMS ─────────────────────────────────────
  {
    name: 'item_170', label: 'vine_beacon',
    desc: 'vine beacon boss summon item inventory icon for a 2D side-scrolling game. Green glowing vine-wrapped beacon with leaves, used to summon a forest boss. Pixel art item sprite.',
  },
  {
    name: 'item_171', label: 'tidal_pearl',
    desc: 'tidal pearl boss summon item inventory icon for a 2D side-scrolling game. Shimmering blue iridescent pearl with water droplets, used to summon an ocean boss. Pixel art item sprite.',
  },
  {
    name: 'item_172', label: 'crystal_lens',
    desc: 'crystal lens boss summon item inventory icon for a 2D side-scrolling game. Polished cyan-blue crystal disc lens with bright light refraction, used to summon a crystal boss. Pixel art item sprite.',
  },
  {
    name: 'item_173', label: 'magma_core',
    desc: 'magma core boss summon item inventory icon for a 2D side-scrolling game. Glowing red-orange molten magma sphere with cracks of bright lava, used to summon a fire boss. Pixel art item sprite.',
  },
  {
    name: 'item_174', label: 'void_sigil',
    desc: 'void sigil boss summon item inventory icon for a 2D side-scrolling game. Dark purple glowing arcane sigil disc with swirling void energy, used to summon a void boss. Pixel art item sprite.',
  },
  {
    name: 'item_175', label: 'signal_beacon',
    desc: 'signal beacon boss summon item inventory icon for a 2D side-scrolling game. Pink-purple high-tech signal beacon with pulsing energy rings, used to summon the mothership boss. Pixel art item sprite.',
  },

  // ─── JETPACK COMPONENTS ────────────────────────────────────
  {
    name: 'item_180', label: 'fuel_cell_casing',
    desc: 'fuel cell casing jetpack component inventory icon for a 2D side-scrolling game. Golden-brown metallic cylindrical fuel cell casing with connection ports, mechanical part. Pixel art item sprite.',
  },
  {
    name: 'item_181', label: 'thrust_regulator',
    desc: 'thrust regulator jetpack component inventory icon for a 2D side-scrolling game. Silver metallic device with gauges and valves, precision engineering component. Pixel art item sprite.',
  },
  {
    name: 'item_182', label: 'pressure_valve',
    desc: 'pressure valve jetpack component inventory icon for a 2D side-scrolling game. Blue-gray metal valve with pressure gauge and pipe fittings, mechanical component. Pixel art item sprite.',
  },
  {
    name: 'item_183', label: 'energy_capacitor',
    desc: 'energy capacitor jetpack component inventory icon for a 2D side-scrolling game. Purple glowing cylindrical capacitor with energy conduits, stores electrical charge. Pixel art item sprite.',
  },
  {
    name: 'item_184', label: 'ignition_core',
    desc: 'ignition core jetpack component inventory icon for a 2D side-scrolling game. Orange-red glowing hot ignition core with heat vents and spark chamber, fire starting component. Pixel art item sprite.',
  },
  {
    name: 'item_185', label: 'navigation_module',
    desc: 'navigation module jetpack component inventory icon for a 2D side-scrolling game. Green-cyan circuit board module with blinking lights and miniature screen, guidance system. Pixel art item sprite.',
  },
  {
    name: 'item_186', label: 'jetpack',
    desc: 'assembled jetpack inventory icon for a 2D side-scrolling game. Compact golden-yellow jetpack with twin thruster nozzles, fuel tank, and control panel, ready to fly. Pixel art item sprite.',
  },

  // ─── CONSUMABLES ───────────────────────────────────────────
  {
    name: 'item_190', label: 'healing_herb',
    desc: 'healing herb consumable inventory icon for a 2D side-scrolling game. Small green leafy herb plant with a soft healing glow, natural medicine. Pixel art item sprite.',
  },
  {
    name: 'item_191', label: 'cooked_meat',
    desc: 'cooked meat consumable inventory icon for a 2D side-scrolling game. Roasted brown meat leg on a bone with grill marks, hearty food item. Pixel art item sprite.',
  },
  {
    name: 'item_192', label: 'rebreather',
    desc: 'rebreather special item inventory icon for a 2D side-scrolling game. Teal underwater breathing apparatus with mask and small air tank, diving equipment. Pixel art item sprite.',
  },
  {
    name: 'item_193', label: 'forcefield_potion',
    desc: 'forcefield potion consumable inventory icon for a 2D side-scrolling game. Glass flask with swirling pale blue liquid and a shimmering shield-like aura, protective drink. Pixel art item sprite.',
  },

  // ─── ARMOR: WOOD ───────────────────────────────────────────
  {
    name: 'item_200', label: 'wood_helmet',
    desc: 'wooden helmet armor inventory icon for a 2D side-scrolling game. Simple brown wooden helmet with crude protective brim, basic head armor. Pixel art item sprite.',
  },
  {
    name: 'item_201', label: 'wood_chestplate',
    desc: 'wooden chestplate armor inventory icon for a 2D side-scrolling game. Brown wooden chest armor with leather straps and plank construction, basic torso protection. Pixel art item sprite.',
  },
  {
    name: 'item_202', label: 'wood_leggings',
    desc: 'wooden leggings armor inventory icon for a 2D side-scrolling game. Brown wooden leg guards with leather bindings, basic leg protection. Pixel art item sprite.',
  },
  {
    name: 'item_203', label: 'wood_boots',
    desc: 'wooden boots armor inventory icon for a 2D side-scrolling game. Simple brown wooden clogs/boots with leather ankle straps, basic footwear. Pixel art item sprite.',
  },

  // ─── ARMOR: STONE ──────────────────────────────────────────
  {
    name: 'item_204', label: 'stone_helmet',
    desc: 'stone helmet armor inventory icon for a 2D side-scrolling game. Heavy gray stone helmet with rough-hewn surface, sturdy head protection. Pixel art item sprite.',
  },
  {
    name: 'item_205', label: 'stone_chestplate',
    desc: 'stone chestplate armor inventory icon for a 2D side-scrolling game. Gray stone chest armor with carved rock plates, heavy torso protection. Pixel art item sprite.',
  },
  {
    name: 'item_206', label: 'stone_leggings',
    desc: 'stone leggings armor inventory icon for a 2D side-scrolling game. Gray stone leg guards with rocky plate segments, heavy leg protection. Pixel art item sprite.',
  },
  {
    name: 'item_207', label: 'stone_boots',
    desc: 'stone boots armor inventory icon for a 2D side-scrolling game. Heavy gray stone boots with thick soles, sturdy footwear. Pixel art item sprite.',
  },

  // ─── ARMOR: IRON ───────────────────────────────────────────
  {
    name: 'item_208', label: 'iron_helmet',
    desc: 'iron helmet armor inventory icon for a 2D side-scrolling game. Brownish-orange iron helmet with nose guard and riveted bands, reliable head protection. Pixel art item sprite.',
  },
  {
    name: 'item_209', label: 'iron_chestplate',
    desc: 'iron chestplate armor inventory icon for a 2D side-scrolling game. Brownish-orange iron chest armor with riveted plates and chain mail detail, solid torso protection. Pixel art item sprite.',
  },
  {
    name: 'item_210', label: 'iron_leggings',
    desc: 'iron leggings armor inventory icon for a 2D side-scrolling game. Brownish-orange iron leg guards with articulated plates, solid leg protection. Pixel art item sprite.',
  },
  {
    name: 'item_211', label: 'iron_boots',
    desc: 'iron boots armor inventory icon for a 2D side-scrolling game. Brownish-orange iron boots with metal plate covering, solid footwear. Pixel art item sprite.',
  },

  // ─── ARMOR: DIAMOND ────────────────────────────────────────
  {
    name: 'item_212', label: 'diamond_helmet',
    desc: 'diamond helmet armor inventory icon for a 2D side-scrolling game. Sparkling cyan-blue crystalline diamond helmet with faceted surface, gleaming head protection. Pixel art item sprite.',
  },
  {
    name: 'item_213', label: 'diamond_chestplate',
    desc: 'diamond chestplate armor inventory icon for a 2D side-scrolling game. Sparkling cyan-blue crystalline diamond chest armor with brilliant facets, premium torso protection. Pixel art item sprite.',
  },
  {
    name: 'item_214', label: 'diamond_leggings',
    desc: 'diamond leggings armor inventory icon for a 2D side-scrolling game. Sparkling cyan-blue crystalline diamond leg guards with faceted panels, premium leg protection. Pixel art item sprite.',
  },
  {
    name: 'item_215', label: 'diamond_boots',
    desc: 'diamond boots armor inventory icon for a 2D side-scrolling game. Sparkling cyan-blue crystalline diamond boots with faceted surface, premium footwear. Pixel art item sprite.',
  },

  // ─── ARMOR: TITANIUM ───────────────────────────────────────
  {
    name: 'item_216', label: 'titanium_helmet',
    desc: 'titanium helmet armor inventory icon for a 2D side-scrolling game. Sleek silver-white titanium helmet with smooth aerodynamic design, top-tier head protection. Pixel art item sprite.',
  },
  {
    name: 'item_217', label: 'titanium_chestplate',
    desc: 'titanium chestplate armor inventory icon for a 2D side-scrolling game. Sleek silver-white titanium chest armor with smooth plates and blue accent lights, top-tier torso protection. Pixel art item sprite.',
  },
  {
    name: 'item_218', label: 'titanium_leggings',
    desc: 'titanium leggings armor inventory icon for a 2D side-scrolling game. Sleek silver-white titanium leg guards with articulated smooth plates, top-tier leg protection. Pixel art item sprite.',
  },
  {
    name: 'item_219', label: 'titanium_boots',
    desc: 'titanium boots armor inventory icon for a 2D side-scrolling game. Sleek silver-white titanium boots with smooth design and blue accents, top-tier footwear. Pixel art item sprite.',
  },

  // ─── SHARDS & ENCHANTING ───────────────────────────────────
  {
    name: 'item_230', label: 'ember_shard',
    desc: 'ember shard material inventory icon for a 2D side-scrolling game. Small jagged orange-red crystal shard glowing with inner fire, warm ember light. Pixel art item sprite.',
  },
  {
    name: 'item_231', label: 'frost_shard',
    desc: 'frost shard material inventory icon for a 2D side-scrolling game. Small jagged pale blue ice crystal shard with frosty mist, cold gleam. Pixel art item sprite.',
  },
  {
    name: 'item_232', label: 'storm_shard',
    desc: 'storm shard material inventory icon for a 2D side-scrolling game. Small jagged yellow crystal shard crackling with tiny lightning sparks, electric energy. Pixel art item sprite.',
  },
  {
    name: 'item_233', label: 'void_shard',
    desc: 'void shard material inventory icon for a 2D side-scrolling game. Small jagged dark purple crystal shard with swirling void energy inside, otherworldly gleam. Pixel art item sprite.',
  },
  {
    name: 'item_234', label: 'life_shard',
    desc: 'life shard material inventory icon for a 2D side-scrolling game. Small jagged green crystal shard with healing aura and tiny leaf sprout, vital energy. Pixel art item sprite.',
  },
  {
    name: 'item_235', label: 'arcane_dust',
    desc: 'arcane dust material inventory icon for a 2D side-scrolling game. Small pile of shimmering pale purple magical dust with sparkle particles floating above. Pixel art item sprite.',
  },
  {
    name: 'item_236', label: 'arcane_anvil',
    desc: 'arcane anvil station inventory icon for a 2D side-scrolling game. Dark purple magical anvil with glowing violet rune engravings, ethereal energy wisps. Pixel art item sprite.',
  },

  // ─── CHANT ORBS ────────────────────────────────────────────
  {
    name: 'item_237', label: 'inferno_chant',
    desc: 'inferno chant orb inventory icon for a 2D side-scrolling game. Glowing orange-red magical orb with swirling fire runes inside, enchantment sphere. Pixel art item sprite.',
  },
  {
    name: 'item_238', label: 'glacial_chant',
    desc: 'glacial chant orb inventory icon for a 2D side-scrolling game. Glowing pale blue magical orb with swirling ice crystal patterns inside, enchantment sphere. Pixel art item sprite.',
  },
  {
    name: 'item_239', label: 'tempest_chant',
    desc: 'tempest chant orb inventory icon for a 2D side-scrolling game. Glowing yellow magical orb with swirling lightning bolt patterns inside, enchantment sphere. Pixel art item sprite.',
  },
  {
    name: 'item_240', label: 'abyssal_chant',
    desc: 'abyssal chant orb inventory icon for a 2D side-scrolling game. Glowing dark purple magical orb with swirling void energy inside, enchantment sphere. Pixel art item sprite.',
  },
  {
    name: 'item_241', label: 'verdant_chant',
    desc: 'verdant chant orb inventory icon for a 2D side-scrolling game. Glowing green magical orb with swirling leaf and vine patterns inside, enchantment sphere. Pixel art item sprite.',
  },
  {
    name: 'item_243', label: 'eternal_chant',
    desc: 'eternal chant orb inventory icon for a 2D side-scrolling game. Glowing golden magical orb with swirling divine light patterns inside, enchantment sphere. Pixel art item sprite.',
  },

  // ─── EXPLORER'S BELT ───────────────────────────────────────
  {
    name: 'item_306', label: 'explorers_belt',
    desc: "explorer's belt accessory inventory icon for a 2D side-scrolling game. Brown leather utility belt with small pouches, compass clip, and brass buckle, adventurer gear. Pixel art item sprite.",
  },

  // ─── DECORATIONS ───────────────────────────────────────────
  {
    name: 'item_310', label: 'star_lantern',
    desc: 'star lantern decoration inventory icon for a 2D side-scrolling game. Ornate golden lantern with a glowing yellow star-shaped light inside, hanging chain. Pixel art item sprite.',
  },
  {
    name: 'item_311', label: 'celestial_banner',
    desc: 'celestial banner decoration inventory icon for a 2D side-scrolling game. Flowing dark purple banner with embroidered star constellation pattern, decorative wall hanging. Pixel art item sprite.',
  },
  {
    name: 'item_312', label: 'starfall_flower',
    desc: 'starfall flower decoration inventory icon for a 2D side-scrolling game. Beautiful pink-magenta glowing flower with star-shaped petals and soft light aura. Pixel art item sprite.',
  },
  {
    name: 'item_313', label: 'sky_crystal_lamp',
    desc: 'sky crystal lamp decoration inventory icon for a 2D side-scrolling game. Floating cyan-blue crystal lamp emitting soft blue light, elegant sky-themed lighting. Pixel art item sprite.',
  },

  // ─── POTIONS ───────────────────────────────────────────────
  {
    name: 'item_400', label: 'ironskin_potion',
    desc: 'ironskin potion inventory icon for a 2D side-scrolling game. Glass flask with golden-orange metallic liquid inside, iron shield emblem on label. Pixel art item sprite.',
  },
  {
    name: 'item_401', label: 'swiftness_potion',
    desc: 'swiftness potion inventory icon for a 2D side-scrolling game. Glass flask with pale cyan swirling liquid inside, wind streak emblem on label. Pixel art item sprite.',
  },
  {
    name: 'item_402', label: 'spelunker_potion',
    desc: 'spelunker potion inventory icon for a 2D side-scrolling game. Glass flask with bright yellow glowing liquid inside, ore nugget emblem on label. Pixel art item sprite.',
  },
  {
    name: 'item_403', label: 'night_owl_potion',
    desc: 'night owl potion inventory icon for a 2D side-scrolling game. Glass flask with pale green glowing liquid inside, owl eye emblem on label. Pixel art item sprite.',
  },
  {
    name: 'item_404', label: 'featherfall_potion',
    desc: 'featherfall potion inventory icon for a 2D side-scrolling game. Glass flask with pale white wispy liquid inside, feather emblem on label. Pixel art item sprite.',
  },
  {
    name: 'item_405', label: 'rage_potion',
    desc: 'rage potion inventory icon for a 2D side-scrolling game. Glass flask with bright red bubbling liquid inside, crossed swords emblem on label. Pixel art item sprite.',
  },
  {
    name: 'item_406', label: 'regeneration_potion',
    desc: 'regeneration potion inventory icon for a 2D side-scrolling game. Glass flask with pink glowing liquid inside, heart emblem on label. Pixel art item sprite.',
  },
  {
    name: 'item_407', label: 'mana_surge_potion',
    desc: 'mana surge potion inventory icon for a 2D side-scrolling game. Glass flask with deep purple swirling liquid inside, star burst emblem on label. Pixel art item sprite.',
  },
  {
    name: 'item_408', label: 'thorns_potion',
    desc: 'thorns potion inventory icon for a 2D side-scrolling game. Glass flask with dark green liquid with tiny thorns floating inside, rose thorn emblem on label. Pixel art item sprite.',
  },
  {
    name: 'item_409', label: 'water_walking_potion',
    desc: 'water walking potion inventory icon for a 2D side-scrolling game. Glass flask with bright blue wavy liquid inside, water ripple emblem on label. Pixel art item sprite.',
  },
  {
    name: 'item_410', label: 'giant_potion',
    desc: 'giant potion inventory icon for a 2D side-scrolling game. Large glass flask with brown-orange liquid inside, upward arrow emblem on label. Pixel art item sprite.',
  },
  {
    name: 'item_411', label: 'archery_potion',
    desc: 'archery potion inventory icon for a 2D side-scrolling game. Glass flask with green-yellow liquid inside, bow and arrow emblem on label. Pixel art item sprite.',
  },
  {
    name: 'item_412', label: 'magic_power_potion',
    desc: 'magic power potion inventory icon for a 2D side-scrolling game. Glass flask with vibrant purple sparkling liquid inside, magic wand emblem on label. Pixel art item sprite.',
  },
  {
    name: 'item_413', label: 'mining_potion',
    desc: 'mining potion inventory icon for a 2D side-scrolling game. Glass flask with orange-yellow liquid inside, pickaxe emblem on label. Pixel art item sprite.',
  },
  {
    name: 'item_414', label: 'endurance_potion',
    desc: 'endurance potion inventory icon for a 2D side-scrolling game. Glass flask with teal-blue liquid inside, shield emblem on label. Pixel art item sprite.',
  },
  {
    name: 'item_415', label: 'wrath_potion',
    desc: 'wrath potion inventory icon for a 2D side-scrolling game. Glass flask with deep crimson bubbling liquid inside, flame skull emblem on label. Pixel art item sprite.',
  },
]

// ─── GENERATION FUNCTIONS ───────────────────────────────────

const SKIP_EXISTING = process.argv.includes('--skip-existing')

function spriteExists(filename) {
  return SKIP_EXISTING && fs.existsSync(path.join(OUT_DIR, filename))
}

async function generateTiles() {
  console.log(`\n── Generating Tiles (${TILES.length}) ──`)
  for (const tile of TILES) {
    if (spriteExists(`${tile.name}.png`)) {
      console.log(`  ⏭ ${tile.label} (exists, skipping)`)
      continue
    }
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
  console.log(`\n── Generating Enemies (${ENEMIES.length}) ──`)
  for (const enemy of ENEMIES) {
    if (spriteExists(`${enemy.name}.png`)) {
      console.log(`  ⏭ ${enemy.name} (exists, skipping)`)
      continue
    }
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
  console.log(`\n── Generating Bosses (${BOSSES.length}) ──`)
  for (const boss of BOSSES) {
    if (spriteExists(`${boss.name}.png`)) {
      console.log(`  ⏭ ${boss.name} (exists, skipping)`)
      continue
    }
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
  console.log(`\n── Generating Projectiles (${PROJECTILES.length}) ──`)
  for (const proj of PROJECTILES) {
    if (spriteExists(`${proj.name}.png`)) {
      console.log(`  ⏭ ${proj.name} (exists, skipping)`)
      continue
    }
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

async function generateItems() {
  console.log(`\n── Generating Items (${ITEMS.length}) ──`)
  for (const item of ITEMS) {
    if (spriteExists(`${item.name}.png`)) {
      console.log(`  ⏭ ${item.label} (exists, skipping)`)
      continue
    }
    console.log(`  Generating ${item.label}...`)
    const data = await generate('generate-image-pixflux', {
      description: item.desc,
      image_size: { width: 32, height: 32 },
      no_background: true,
      view: 'side',
      shading: 'medium shading',
      detail: 'medium detail',
      outline: 'single color black outline',
    })
    await saveImage(data, `${item.name}.png`)
    await delay(300)
  }
}

async function main() {
  const total = TILES.length + ENEMIES.length + BOSSES.length + PROJECTILES.length + ITEMS.length
  console.log('PixelLab Sprite Generator for Starfall')
  console.log('Output:', OUT_DIR)
  console.log(`Total generations needed: ${total}`)

  await generateTiles()
  await generateEnemies()
  await generateBosses()
  await generateProjectiles()
  await generateItems()

  console.log(`\n✓ All ${total} sprites generated!`)
}

main().catch(err => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})
