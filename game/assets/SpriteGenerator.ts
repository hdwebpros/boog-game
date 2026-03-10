import Phaser from 'phaser'
import { TileType } from '../world/TileRegistry'

// Simple seeded random for consistent tile detail
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

type PixelGrid = (number | null)[][]

function makeGrid(w: number, h: number): PixelGrid {
  return Array.from({ length: h }, () => Array(w).fill(null))
}

function fillGrid(g: PixelGrid, color: number) {
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[0]!.length; x++)
      g[y]![x] = color
}

function drawToTexture(scene: Phaser.Scene, key: string, grid: PixelGrid) {
  // Skip if a PNG texture was already loaded (e.g. from PixelLab)
  if (scene.textures.exists(key)) return

  const h = grid.length
  const w = grid[0]!.length
  const gfx = scene.add.graphics()
  gfx.setVisible(false)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = grid[y]![x]
      if (c != null) {
        gfx.fillStyle(c)
        gfx.fillRect(x, y, 1, 1)
      }
    }
  }
  gfx.generateTexture(key, w, h)
  gfx.destroy()
}

// Color helpers
function darken(c: number, f: number): number {
  const r = Math.max(0, Math.floor(((c >> 16) & 0xff) * (1 - f)))
  const g = Math.max(0, Math.floor(((c >> 8) & 0xff) * (1 - f)))
  const b = Math.max(0, Math.floor((c & 0xff) * (1 - f)))
  return (r << 16) | (g << 8) | b
}

function lighten(c: number, f: number): number {
  const r = Math.min(255, Math.floor(((c >> 16) & 0xff) * (1 + f)))
  const g = Math.min(255, Math.floor(((c >> 8) & 0xff) * (1 + f)))
  const b = Math.min(255, Math.floor((c & 0xff) * (1 + f)))
  return (r << 16) | (g << 8) | b
}

function speckle(g: PixelGrid, base: number, density: number, variance: number, rng: () => number) {
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[0]!.length; x++)
      if (rng() < density)
        g[y]![x] = rng() > 0.5 ? darken(base, variance * rng()) : lighten(base, variance * rng())
}

// ─── TILE TEXTURES ─────────────────────────────────────────

function makeTileGrass(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(101)
  const dirt = 0x8b5e3c
  const grass = 0x4a8c2a
  fillGrid(g, dirt)
  speckle(g, dirt, 0.3, 0.15, rng)
  // Grass top layer
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 4; y++) g[y]![x] = grass
  }
  // Grass blades
  const bladePositions = [1, 3, 5, 7, 9, 11, 13, 14]
  for (const bx of bladePositions) {
    const h = rng() > 0.5 ? 5 : 6
    for (let y = 0; y < h; y++) g[y]![bx] = lighten(grass, 0.05 + rng() * 0.1)
  }
  // Darker edge at grass/dirt transition
  for (let x = 0; x < 16; x++) g[4]![x] = darken(grass, 0.2)
  // Highlights on grass
  g[0]![2] = lighten(grass, 0.3)
  g[0]![8] = lighten(grass, 0.25)
  g[1]![12] = lighten(grass, 0.2)
  return g
}

function makeTileDirt(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(102)
  const base = 0x8b5e3c
  fillGrid(g, base)
  speckle(g, base, 0.4, 0.2, rng)
  // Pebbles
  g[3]![5] = darken(base, 0.3)
  g[3]![6] = darken(base, 0.25)
  g[8]![11] = darken(base, 0.3)
  g[12]![3] = darken(base, 0.28)
  g[12]![4] = darken(base, 0.22)
  // Roots
  g[7]![2] = 0x5a3a20
  g[7]![3] = 0x5a3a20
  return g
}

function makeTileStone(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(103)
  const base = 0x808080
  fillGrid(g, base)
  speckle(g, base, 0.35, 0.15, rng)
  // Crack pattern
  for (let x = 4; x < 12; x++) g[7]![x] = darken(base, 0.25)
  g[6]![4] = darken(base, 0.2)
  g[8]![11] = darken(base, 0.2)
  g[5]![8] = darken(base, 0.15)
  // Highlight
  g[2]![3] = lighten(base, 0.2)
  g[2]![4] = lighten(base, 0.15)
  g[13]![10] = lighten(base, 0.18)
  return g
}

function makeTileWood(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(104)
  const base = 0x6b4226
  fillGrid(g, base)
  // Wood grain - horizontal lines with slight variation
  for (let y = 0; y < 16; y++) {
    if (y % 3 === 0) {
      for (let x = 0; x < 16; x++) g[y]![x] = darken(base, 0.15 + rng() * 0.1)
    }
    if (y % 5 === 2) {
      for (let x = 0; x < 16; x++) g[y]![x] = lighten(base, 0.1 + rng() * 0.05)
    }
  }
  // Knot
  g[5]![8] = darken(base, 0.35)
  g[5]![9] = darken(base, 0.3)
  g[6]![8] = darken(base, 0.3)
  g[6]![9] = darken(base, 0.25)
  // Bark edge
  for (let y = 0; y < 16; y++) {
    g[y]![0] = darken(base, 0.2)
    g[y]![15] = darken(base, 0.2)
  }
  return g
}

function makeTileLeaves(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(105)
  const base = 0x2d6b1e
  fillGrid(g, base)
  // Leaf cluster pattern
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const v = rng()
      if (v < 0.25) g[y]![x] = lighten(base, 0.2 + rng() * 0.15)
      else if (v < 0.4) g[y]![x] = darken(base, 0.15 + rng() * 0.1)
    }
  }
  // Light gaps
  g[3]![7] = lighten(base, 0.4)
  g[10]![4] = lighten(base, 0.35)
  return g
}

function makeTileIronOre(): PixelGrid {
  const g = makeTileStone()
  const rng = mulberry32(106)
  const ore = 0xc19a6b
  // Ore deposits - clusters
  const spots = [[3,3],[4,3],[3,4],[4,4], [10,8],[11,8],[10,9],[11,9],[10,10], [6,13],[7,13],[7,12]]
  for (const [x, y] of spots) {
    g[y!]![x!] = rng() > 0.3 ? ore : lighten(ore, 0.15)
  }
  return g
}

function makeTileDiamondOre(): PixelGrid {
  const g = makeTileStone()
  const rng = mulberry32(107)
  const gem = 0x4af0e0
  // Diamond sparkles in stone
  const spots = [[4,2],[5,3],[4,3], [11,7],[12,7],[11,8], [7,12],[8,12],[7,13]]
  for (const [x, y] of spots) {
    g[y!]![x!] = rng() > 0.4 ? gem : lighten(gem, 0.3)
  }
  // Sparkle highlights
  g[2]![4] = 0xffffff
  g[7]![12] = 0xeeffff
  return g
}

function makeTileTitaniumOre(): PixelGrid {
  const g = makeTileStone()
  const rng = mulberry32(108)
  const metal = 0xd4d4d4
  const spots = [[2,4],[3,4],[2,5],[3,5],[4,5], [9,10],[10,10],[11,10],[10,11],[11,11], [6,1],[7,1]]
  for (const [x, y] of spots) {
    g[y!]![x!] = rng() > 0.3 ? metal : lighten(metal, 0.15)
  }
  g[4]![2] = 0xeeeeee // shine
  g[10]![10] = 0xeeeeee
  return g
}

function makeTileSand(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(109)
  const base = 0xe6d5a8
  fillGrid(g, base)
  speckle(g, base, 0.5, 0.1, rng)
  // Tiny shells/pebbles
  g[5]![3] = 0xf0e8d0
  g[5]![4] = 0xf0e8d0
  g[11]![9] = 0xd0c098
  g[11]![10] = 0xd0c098
  return g
}

function makeTileCoral(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(110)
  const base = 0xff6b9d
  fillGrid(g, base)
  // Coral branches/texture
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const v = rng()
      if (v < 0.2) g[y]![x] = lighten(base, 0.25)
      else if (v < 0.35) g[y]![x] = darken(base, 0.2)
    }
  }
  // Branch pattern
  for (let y = 2; y < 14; y++) {
    g[y]![4] = lighten(base, 0.15)
    g[y]![10] = lighten(base, 0.15)
  }
  g[2]![3] = lighten(base, 0.15)
  g[2]![5] = lighten(base, 0.15)
  g[2]![9] = lighten(base, 0.15)
  g[2]![11] = lighten(base, 0.15)
  return g
}

function makeTileCarbonFiber(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(111)
  const base = 0x2a2a4e
  fillGrid(g, base)
  // Woven crosshatch pattern
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if ((x + y) % 4 === 0) g[y]![x] = lighten(base, 0.2)
      else if ((x + y) % 4 === 2) g[y]![x] = darken(base, 0.15)
    }
  }
  // Slight shine
  g[1]![1] = lighten(base, 0.35)
  g[1]![2] = lighten(base, 0.25)
  return g
}

function makeTileLava(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(112)
  const base = 0xff4400
  fillGrid(g, base)
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const v = rng()
      if (v < 0.2) g[y]![x] = 0xff6600
      else if (v < 0.35) g[y]![x] = 0xff8800
      else if (v < 0.45) g[y]![x] = 0xffaa00
      else if (v < 0.5) g[y]![x] = darken(base, 0.3)
    }
  }
  // Bright hot spots
  g[4]![7] = 0xffcc44
  g[4]![8] = 0xffcc44
  g[11]![3] = 0xffcc44
  return g
}

function makeTileWater(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(113)
  const base = 0x2266cc
  fillGrid(g, base)
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const v = rng()
      if (v < 0.15) g[y]![x] = lighten(base, 0.2)
      else if (v < 0.25) g[y]![x] = lighten(base, 0.35)
      else if (v < 0.35) g[y]![x] = darken(base, 0.15)
    }
  }
  // Surface highlights
  g[1]![3] = 0x4488ee
  g[1]![4] = 0x4488ee
  g[1]![5] = 0x4488ee
  g[2]![9] = 0x4488ee
  g[2]![10] = 0x4488ee
  return g
}

function makeTileSnow(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(120)
  const base = 0xeeeeff
  fillGrid(g, base)
  speckle(g, base, 0.3, 0.05, rng)
  // Sparkle highlights
  for (let i = 0; i < 5; i++) {
    const sx = Math.floor(rng() * 16)
    const sy = Math.floor(rng() * 16)
    g[sy]![sx] = 0xffffff
  }
  return g
}

function makeTileIce(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(121)
  const base = 0x88ccee
  fillGrid(g, base)
  speckle(g, base, 0.2, 0.1, rng)
  // Translucent streaks
  for (let y = 0; y < 16; y++) {
    if (rng() < 0.3) {
      const x1 = Math.floor(rng() * 8)
      const len = 3 + Math.floor(rng() * 5)
      for (let x = x1; x < Math.min(16, x1 + len); x++) g[y]![x] = lighten(base, 0.25)
    }
  }
  return g
}

function makeTileClay(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(122)
  const base = 0xb07050
  fillGrid(g, base)
  speckle(g, base, 0.35, 0.12, rng)
  return g
}

function makeTileObsidian(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(123)
  const base = 0x1a1a2e
  fillGrid(g, base)
  speckle(g, base, 0.2, 0.15, rng)
  // Glass-like reflections
  for (let i = 0; i < 4; i++) {
    const sx = Math.floor(rng() * 14) + 1
    const sy = Math.floor(rng() * 14) + 1
    g[sy]![sx] = 0x3333555
  }
  return g
}

function makeTileCrystal(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(124)
  const base = 0xaa55ff
  fillGrid(g, base)
  speckle(g, base, 0.3, 0.2, rng)
  // Crystal facets
  for (let i = 0; i < 6; i++) {
    const sx = Math.floor(rng() * 16)
    const sy = Math.floor(rng() * 16)
    g[sy]![sx] = lighten(base, 0.4)
  }
  return g
}

function makeTileMoss(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(125)
  const base = 0x3d7a3d
  fillGrid(g, base)
  speckle(g, base, 0.4, 0.15, rng)
  // Darker patches
  for (let i = 0; i < 6; i++) {
    const px = Math.floor(rng() * 14)
    const py = Math.floor(rng() * 14)
    g[py]![px] = darken(base, 0.2)
    g[py]![px + 1] = darken(base, 0.15)
  }
  return g
}

function makeTileMushroomBlock(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(126)
  const base = 0xcc6644
  fillGrid(g, base)
  speckle(g, base, 0.3, 0.12, rng)
  // Spots
  for (let i = 0; i < 4; i++) {
    const cx = 2 + Math.floor(rng() * 12)
    const cy = 2 + Math.floor(rng() * 12)
    g[cy]![cx] = 0xffcc88
    if (cx + 1 < 16) g[cy]![cx + 1] = 0xffcc88
  }
  return g
}

function makeTileSandstone(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(127)
  const base = 0xd4b483
  fillGrid(g, base)
  speckle(g, base, 0.3, 0.1, rng)
  // Horizontal layers
  for (let y = 4; y < 16; y += 5) {
    for (let x = 0; x < 16; x++) {
      if (rng() < 0.7) g[y]![x] = darken(base, 0.08)
    }
  }
  return g
}

function makeTileCactus(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(128)
  const base = 0x2d8a2d
  fillGrid(g, base)
  speckle(g, base, 0.25, 0.12, rng)
  // Vertical ribs
  for (let y = 0; y < 16; y++) {
    g[y]![3] = darken(base, 0.15)
    g[y]![7] = darken(base, 0.1)
    g[y]![11] = darken(base, 0.15)
  }
  // Spines
  for (let i = 0; i < 5; i++) {
    const sx = Math.floor(rng() * 16)
    const sy = Math.floor(rng() * 16)
    g[sy]![sx] = 0xccddaa
  }
  return g
}

function makeTileJungleGrass(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(129)
  const dirt = 0x6b4e30
  const grass = 0x2a6e1e
  fillGrid(g, dirt)
  speckle(g, dirt, 0.3, 0.15, rng)
  // Lush grass top
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 5; y++) g[y]![x] = grass
    g[0]![x] = lighten(grass, 0.15)
  }
  speckle(g, grass, 0.2, 0.15, rng)
  return g
}

function makeTileFrozenStone(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(130)
  const base = 0x7799aa
  fillGrid(g, base)
  speckle(g, base, 0.3, 0.12, rng)
  // Ice veins
  for (let i = 0; i < 3; i++) {
    const sx = Math.floor(rng() * 12)
    const sy = Math.floor(rng() * 16)
    for (let dx = 0; dx < 3; dx++) {
      if (sx + dx < 16) g[sy]![sx + dx] = 0x88ccee
    }
  }
  return g
}

function makeTileCrystalEmber(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(131)
  const base = 0xff6633
  fillGrid(g, base)
  speckle(g, base, 0.3, 0.2, rng)
  for (let i = 0; i < 5; i++) { const x = Math.floor(rng() * 16); const y = Math.floor(rng() * 16); g[y]![x] = 0xffaa44 }
  return g
}

function makeTileCrystalFrost(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(132)
  const base = 0x66ccff
  fillGrid(g, base)
  speckle(g, base, 0.3, 0.2, rng)
  for (let i = 0; i < 5; i++) { const x = Math.floor(rng() * 16); const y = Math.floor(rng() * 16); g[y]![x] = 0xccffff }
  return g
}

function makeTileCrystalStorm(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(133)
  const base = 0xffee44
  fillGrid(g, base)
  speckle(g, base, 0.3, 0.2, rng)
  for (let i = 0; i < 5; i++) { const x = Math.floor(rng() * 16); const y = Math.floor(rng() * 16); g[y]![x] = 0xffffaa }
  return g
}

function makeTileCrystalVoid(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(134)
  const base = 0x9933ff
  fillGrid(g, base)
  speckle(g, base, 0.3, 0.2, rng)
  for (let i = 0; i < 5; i++) { const x = Math.floor(rng() * 16); const y = Math.floor(rng() * 16); g[y]![x] = 0xcc77ff }
  return g
}

function makeTileCrystalLife(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(135)
  const base = 0x33ff66
  fillGrid(g, base)
  speckle(g, base, 0.3, 0.2, rng)
  for (let i = 0; i < 5; i++) { const x = Math.floor(rng() * 16); const y = Math.floor(rng() * 16); g[y]![x] = 0x88ffaa }
  return g
}

function makeTileSeaweed(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(142)
  const base = 0x1a7a30
  const light = lighten(base, 0.3)
  const dark = darken(base, 0.2)

  // Wavy central stalk (2px wide, slightly offset per row)
  const offsets = [7,7,8,8,7,7,6,7,8,8,7,7,8,7,7,8]
  for (let y = 0; y < 16; y++) {
    const cx = offsets[y]!
    g[y]![cx] = y % 4 === 0 ? dark : base
    g[y]![cx + 1] = y % 4 === 2 ? light : base
  }

  // Small fronds branching off alternating sides
  const fronds = [
    { x: 4, y: 3 }, { x: 5, y: 3 },
    { x: 9, y: 6 }, { x: 10, y: 6 },
    { x: 4, y: 9 }, { x: 5, y: 9 }, { x: 6, y: 9 },
    { x: 9, y: 12 }, { x: 10, y: 12 },
    { x: 5, y: 15 }, { x: 6, y: 15 },
  ]
  for (const f of fronds) {
    g[f.y]![f.x] = rng() > 0.4 ? light : base
  }

  return g
}

function makeTileVine(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(137)
  // Vine rope: vertical rope with leaves branching off
  const ropeColor = 0x5a7a2a
  const ropeDark = darken(ropeColor, 0.2)
  const leafColor = 0x33aa22
  const leafLight = lighten(leafColor, 0.3)

  // Draw central rope (2px wide)
  for (let y = 0; y < 16; y++) {
    g[y]![7] = y % 3 === 0 ? ropeDark : ropeColor
    g[y]![8] = y % 3 === 1 ? ropeDark : ropeColor
  }

  // Add small leaves branching from rope
  const leafPositions = [
    { x: 5, y: 2 }, { x: 6, y: 2 },   // left leaf top
    { x: 9, y: 5 }, { x: 10, y: 5 },   // right leaf
    { x: 4, y: 8 }, { x: 5, y: 8 }, { x: 6, y: 8 }, // left leaf mid
    { x: 9, y: 11 }, { x: 10, y: 11 }, // right leaf
    { x: 5, y: 14 }, { x: 6, y: 14 },  // left leaf bottom
  ]
  for (const lp of leafPositions) {
    g[lp.y]![lp.x] = rng() > 0.3 ? leafColor : leafLight
  }

  return g
}

function makeTileCloudBlock(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(200)
  const base = 0xddddff
  fillGrid(g, base)
  speckle(g, base, 0.4, 0.08, rng)
  // Soft highlights
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 16; x++)
      if (rng() < 0.3) g[y]![x] = lighten(base, 0.06)
  return g
}

function makeTileCloudBrick(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(201)
  const base = 0x8899bb
  fillGrid(g, base)
  // Brick pattern
  for (let x = 0; x < 16; x++) {
    g[0]![x] = darken(base, 0.2)
    g[7]![x] = darken(base, 0.2)
    g[15]![x] = darken(base, 0.2)
  }
  for (let y = 0; y < 8; y++) g[y]![0] = darken(base, 0.15)
  for (let y = 8; y < 16; y++) g[y]![8] = darken(base, 0.15)
  speckle(g, base, 0.2, 0.1, rng)
  return g
}

function makeTileCloudPillar(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(202)
  const gold = 0xddaa44
  const goldLight = lighten(gold, 0.2)
  const goldDark = darken(gold, 0.2)
  fillGrid(g, gold)
  // Vertical column shading
  for (let y = 0; y < 16; y++) {
    g[y]![0] = goldDark; g[y]![1] = goldDark
    g[y]![14] = goldDark; g[y]![15] = goldDark
    g[y]![7] = goldLight; g[y]![8] = goldLight
  }
  speckle(g, gold, 0.15, 0.1, rng)
  return g
}

function makeNPCShopkeeper(): PixelGrid {
  const g = makeGrid(16, 32)
  const rng = mulberry32(300)
  const robe = 0x3344aa
  const robeDark = darken(robe, 0.2)
  const skin = 0xeebb88
  const gold = 0xddaa44

  // Body (robe)
  for (let y = 10; y < 30; y++)
    for (let x = 4; x < 12; x++)
      g[y]![x] = y % 4 === 0 ? robeDark : robe

  // Head
  for (let y = 4; y < 10; y++)
    for (let x = 5; x < 11; x++)
      g[y]![x] = skin

  // Eyes
  g[6]![6] = 0x222222; g[6]![9] = 0x222222

  // Hat
  for (let x = 4; x < 12; x++) { g[3]![x] = gold; g[4]![x] = gold }
  for (let x = 6; x < 10; x++) { g[2]![x] = gold; g[1]![x] = gold }

  // Feet
  g[30]![5] = robeDark; g[30]![6] = robeDark
  g[30]![9] = robeDark; g[30]![10] = robeDark

  speckle(g, robe, 0.1, 0.1, rng)
  return g
}

// ─── PLAYER TEXTURES ───────────────────────────────────────

function makePlayerFrame(frameType: 'idle1' | 'idle2' | 'walk1' | 'walk2' | 'walk3' | 'walk4' | 'jump' | 'fall'): PixelGrid {
  const g = makeGrid(16, 32)
  // Astronaut design: white suit, cyan visor, dark boots

  const suit = 0xdddddd
  const suitDark = 0xbbbbbb
  const suitShadow = 0x999999
  const visor = 0x00ffff
  const visorDark = 0x00bbcc
  const boot = 0x444444
  const bootLight = 0x555555
  const belt = 0x666688
  const backpack = 0xaaaaaa

  // Helmet (rows 2-9, cols 3-12)
  for (let y = 2; y <= 9; y++)
    for (let x = 4; x <= 11; x++)
      g[y]![x] = suit
  // Helmet top curve
  g[2]![4] = null; g[2]![11] = null
  g[2]![5] = suitDark; g[2]![10] = suitDark
  // Helmet outline
  for (let y = 3; y <= 8; y++) { g[y]![3] = suitDark; g[y]![12] = suitShadow }
  // Visor (rows 4-7, cols 5-10)
  for (let y = 4; y <= 7; y++)
    for (let x = 5; x <= 10; x++)
      g[y]![x] = visor
  g[4]![5] = visorDark; g[7]![5] = visorDark
  g[4]![10] = visorDark; g[7]![10] = visorDark
  // Visor shine
  g[4]![6] = 0x88ffff
  g[5]![6] = 0x66ffff

  // Neck (row 10)
  for (let x = 5; x <= 10; x++) g[10]![x] = suitDark

  // Torso (rows 11-19, cols 3-12)
  for (let y = 11; y <= 19; y++)
    for (let x = 3; x <= 12; x++)
      g[y]![x] = suit
  // Torso shading
  for (let y = 11; y <= 19; y++) {
    g[y]![3] = suitShadow
    g[y]![12] = suitShadow
  }
  // Backpack bump on left side
  for (let y = 12; y <= 17; y++) {
    g[y]![2] = backpack
    g[y]![3] = suitDark
  }
  // Belt
  for (let x = 3; x <= 12; x++) g[18]![x] = belt
  g[18]![7] = 0x8888aa // buckle

  // Arms (rows 12-18)
  for (let y = 12; y <= 18; y++) {
    g[y]![1] = suitShadow  // left arm
    g[y]![13] = suitShadow  // right arm
  }

  // Legs (rows 20-27)
  // Left leg
  for (let y = 20; y <= 27; y++)
    for (let x = 4; x <= 7; x++)
      g[y]![x] = suit
  // Right leg
  for (let y = 20; y <= 27; y++)
    for (let x = 8; x <= 11; x++)
      g[y]![x] = suit
  // Leg shading
  for (let y = 20; y <= 27; y++) {
    g[y]![4] = suitShadow
    g[y]![11] = suitShadow
  }
  // Gap between legs
  for (let y = 22; y <= 27; y++) g[y]![7] = suitDark;
  for (let y = 22; y <= 27; y++) g[y]![8] = suitDark;

  // Boots (rows 28-31)
  for (let y = 28; y <= 31; y++) {
    for (let x = 3; x <= 7; x++) g[y]![x] = boot
    for (let x = 8; x <= 12; x++) g[y]![x] = boot
  }
  g[28]![4] = bootLight; g[28]![5] = bootLight
  g[28]![9] = bootLight; g[28]![10] = bootLight

  // Frame-specific modifications
  switch (frameType) {
    case 'idle2':
      // Slight visor flicker
      g[5]![7] = 0x88ffff
      break
    case 'walk1':
      // Left leg forward, right back
      for (let y = 24; y <= 27; y++) { g[y]![4] = null; g[y]![5] = null }
      for (let x = 2; x <= 5; x++) { g[26]![x] = suit; g[27]![x] = suit }
      for (let x = 2; x <= 5; x++) { g[28]![x] = boot; g[29]![x] = boot }
      for (let y = 24; y <= 27; y++) { g[y]![11] = null; g[y]![12] = null }
      for (let x = 10; x <= 13; x++) { g[22]![x] = suit; g[23]![x] = suit }
      for (let x = 10; x <= 13; x++) { g[24]![x] = boot; g[25]![x] = boot }
      break
    case 'walk2':
      // Legs neutral (same as idle)
      break
    case 'walk3':
      // Right leg forward, left back
      for (let y = 24; y <= 27; y++) { g[y]![11] = null; g[y]![12] = null }
      for (let x = 10; x <= 13; x++) { g[26]![x] = suit; g[27]![x] = suit }
      for (let x = 10; x <= 13; x++) { g[28]![x] = boot; g[29]![x] = boot }
      for (let y = 24; y <= 27; y++) { g[y]![4] = null; g[y]![5] = null }
      for (let x = 2; x <= 5; x++) { g[22]![x] = suit; g[23]![x] = suit }
      for (let x = 2; x <= 5; x++) { g[24]![x] = boot; g[25]![x] = boot }
      break
    case 'walk4':
      // Same as walk2 (neutral)
      break
    case 'jump':
      // Arms up
      for (let y = 12; y <= 14; y++) { g[y]![1] = null; g[y]![13] = null }
      g[9]![1] = suitShadow; g[10]![1] = suitShadow; g[11]![1] = suitShadow
      g[9]![14] = suitShadow; g[10]![14] = suitShadow; g[11]![14] = suitShadow
      // Legs tucked
      for (let y = 26; y <= 27; y++) {
        for (let x = 4; x <= 7; x++) g[y]![x] = null
        for (let x = 8; x <= 11; x++) g[y]![x] = null
      }
      for (let x = 3; x <= 7; x++) g[28]![x] = null
      for (let x = 8; x <= 12; x++) g[28]![x] = null
      break
    case 'fall':
      // Arms out wide
      g[14]![0] = suitShadow; g[14]![15] = suitShadow
      g[15]![0] = suitShadow; g[15]![15] = suitShadow
      // Legs spread
      for (let y = 26; y <= 27; y++) {
        g[y]![3] = suit; g[y]![12] = suit
      }
      break
  }

  return g
}

// ─── ENEMY TEXTURES ────────────────────────────────────────

function makeEnemySlug(): PixelGrid {
  const g = makeGrid(20, 12)
  const body = 0x88cc44
  const dark = darken(body, 0.2)
  const light = lighten(body, 0.2)
  // Body oval
  for (let y = 3; y <= 9; y++)
    for (let x = 2; x <= 17; x++)
      g[y]![x] = body
  // Round ends
  for (let y = 4; y <= 8; y++) { g[y]![1] = body; g[y]![18] = body }
  // Top curve
  for (let x = 4; x <= 15; x++) g[2]![x] = body
  for (let x = 4; x <= 15; x++) g[10]![x] = dark
  // Eyes
  g[4]![15] = 0x000000; g[4]![16] = 0x000000
  g[5]![15] = 0xffffff; g[5]![16] = 0xffffff
  // Spots on back
  g[4]![5] = light; g[4]![6] = light
  g[5]![9] = light; g[5]![10] = light
  g[6]![13] = light
  // Slime trail
  g[10]![3] = 0xaaddaa; g[10]![7] = 0xaaddaa; g[10]![11] = 0xaaddaa
  // Antennae
  g[1]![16] = 0xaadd66; g[0]![17] = 0xaadd66
  g[1]![14] = 0xaadd66; g[0]![13] = 0xaadd66
  return g
}

function makeEnemyBat(): PixelGrid {
  const g = makeGrid(14, 10)
  const body = 0x664488
  const wing = darken(body, 0.15)
  const wingLight = lighten(body, 0.1)
  // Body center
  for (let y = 2; y <= 7; y++)
    for (let x = 5; x <= 8; x++)
      g[y]![x] = body
  // Wings spread
  for (let y = 3; y <= 5; y++) {
    for (let x = 0; x <= 4; x++) g[y]![x] = wing
    for (let x = 9; x <= 13; x++) g[y]![x] = wing
  }
  // Wing tips
  g[2]![0] = wing; g[2]![1] = wing; g[2]![12] = wing; g[2]![13] = wing
  g[6]![1] = wing; g[6]![2] = wing; g[6]![11] = wing; g[6]![12] = wing
  // Wing membrane detail
  g[4]![1] = wingLight; g[4]![12] = wingLight
  // Eyes - red
  g[3]![5] = 0xff0000; g[3]![8] = 0xff0000
  // Ears
  g[1]![5] = body; g[0]![5] = darken(body, 0.1)
  g[1]![8] = body; g[0]![8] = darken(body, 0.1)
  // Fangs
  g[7]![6] = 0xffffff; g[7]![7] = 0xffffff
  return g
}

function makeEnemyGolem(): PixelGrid {
  const g = makeGrid(22, 28)
  const body = 0x887766
  const dark = darken(body, 0.2)
  const light = lighten(body, 0.15)
  // Blocky body
  for (let y = 0; y <= 27; y++)
    for (let x = 3; x <= 18; x++)
      g[y]![x] = body
  // Head wider
  for (let y = 0; y <= 8; y++)
    for (let x = 2; x <= 19; x++)
      g[y]![x] = body
  // Arms
  for (let y = 9; y <= 20; y++) {
    g[y]![0] = body; g[y]![1] = body; g[y]![2] = body
    g[y]![19] = body; g[y]![20] = body; g[y]![21] = body
  }
  // Fists
  for (let x = 0; x <= 3; x++) { g[20]![x] = dark; g[21]![x] = dark }
  for (let x = 18; x <= 21; x++) { g[20]![x] = dark; g[21]![x] = dark }
  // Eyes - glowing
  g[3]![6] = 0xffaa00; g[3]![7] = 0xffaa00; g[4]![6] = 0xffaa00; g[4]![7] = 0xffaa00
  g[3]![14] = 0xffaa00; g[3]![15] = 0xffaa00; g[4]![14] = 0xffaa00; g[4]![15] = 0xffaa00
  // Mouth crack
  for (let x = 8; x <= 13; x++) g[7]![x] = dark
  // Rock texture
  g[12]![5] = dark; g[12]![6] = dark; g[13]![6] = dark
  g[15]![14] = light; g[15]![15] = light
  g[20]![8] = dark; g[20]![9] = dark
  // Cracks
  g[10]![10] = dark; g[11]![11] = dark; g[12]![12] = dark
  return g
}

function makeEnemyAnglerfish(): PixelGrid {
  const g = makeGrid(18, 14)
  const body = 0x2288aa
  const dark = darken(body, 0.25)
  const belly = lighten(body, 0.2)
  // Body oval
  for (let y = 4; y <= 11; y++)
    for (let x = 2; x <= 14; x++)
      g[y]![x] = body
  for (let y = 5; y <= 10; y++) { g[y]![1] = body; g[y]![15] = body }
  for (let x = 4; x <= 12; x++) { g[3]![x] = body; g[12]![x] = body }
  // Lighter belly
  for (let y = 8; y <= 11; y++)
    for (let x = 4; x <= 12; x++)
      g[y]![x] = belly
  // Big mouth
  for (let x = 13; x <= 17; x++) g[6]![x] = dark
  for (let x = 13; x <= 17; x++) g[9]![x] = dark
  for (let y = 6; y <= 9; y++) g[y]![17] = dark
  // Teeth
  g[7]![14] = 0xffffff; g[7]![16] = 0xffffff
  g[8]![15] = 0xffffff; g[8]![17] = 0xffffff
  // Eye (big)
  g[4]![10] = 0xffffff; g[4]![11] = 0xffffff
  g[5]![10] = 0xffffff; g[5]![11] = 0x000000
  // Lure
  g[1]![6] = 0xffff00; g[0]![5] = 0xffff00; g[0]![6] = 0xffff88
  g[2]![7] = dark; g[1]![7] = dark
  // Tail fin
  g[6]![0] = dark; g[7]![0] = dark; g[5]![0] = dark
  g[8]![0] = dark; g[9]![0] = dark
  return g
}

function makeEnemyFish(): PixelGrid {
  const g = makeGrid(14, 8)
  const body = 0xff8844
  const dark = darken(body, 0.25)
  const belly = lighten(body, 0.3)
  const stripe = 0xffdd44

  // Body — compact oval
  for (let y = 1; y <= 6; y++)
    for (let x = 2; x <= 10; x++)
      g[y]![x] = body
  for (let y = 2; y <= 5; y++) { g[y]![1] = body; g[y]![11] = body }
  // Lighter belly
  for (let y = 4; y <= 6; y++)
    for (let x = 3; x <= 9; x++)
      g[y]![x] = belly
  // Stripe along mid
  for (let x = 3; x <= 9; x++) g[3]![x] = stripe
  // Eye
  g[2]![9] = 0xffffff; g[2]![10] = 0xffffff
  g[3]![9] = 0x111111
  // Tail fin
  g[2]![0] = dark; g[3]![0] = dark; g[4]![0] = dark; g[5]![0] = dark
  g[1]![1] = dark; g[6]![1] = dark
  // Dorsal fin
  g[0]![5] = dark; g[0]![6] = dark; g[0]![7] = dark
  g[1]![4] = dark; g[1]![8] = dark
  // Mouth
  g[3]![12] = dark; g[4]![12] = dark
  return g
}

function makeEnemySerpent(): PixelGrid {
  const g = makeGrid(16, 24)
  const body = 0xff6622
  const dark = darken(body, 0.25)
  const light = lighten(body, 0.2)
  const belly = 0xffaa44
  // Serpentine body
  for (let y = 0; y <= 23; y++)
    for (let x = 4; x <= 11; x++)
      g[y]![x] = body
  // Wider head
  for (let y = 0; y <= 5; y++) {
    g[y]![2] = body; g[y]![3] = body
    g[y]![12] = body; g[y]![13] = body
  }
  // Head top
  for (let x = 3; x <= 12; x++) g[0]![x] = dark
  // Eyes
  g[2]![4] = 0xffff00; g[2]![5] = 0xffff00
  g[2]![10] = 0xffff00; g[2]![11] = 0xffff00
  g[3]![5] = 0xff0000; g[3]![10] = 0xff0000
  // Belly stripe
  for (let y = 6; y <= 22; y++) { g[y]![7] = belly; g[y]![8] = belly }
  // Scale pattern
  for (let y = 6; y < 22; y += 3) {
    g[y]![5] = dark; g[y]![10] = dark
  }
  // Tail taper
  for (let y = 20; y <= 23; y++) {
    g[y]![4] = null; g[y]![11] = null
  }
  g[22]![5] = null; g[22]![10] = null
  g[23]![5] = null; g[23]![6] = null; g[23]![9] = null; g[23]![10] = null
  // Flame particles near mouth
  g[4]![14] = 0xffaa00; g[3]![15] = 0xff6600
  return g
}

function makeEnemyDrone(): PixelGrid {
  const g = makeGrid(14, 14)
  const body = 0xcc2244
  const dark = darken(body, 0.2)
  const metal = 0x888888
  // Central body
  for (let y = 3; y <= 10; y++)
    for (let x = 3; x <= 10; x++)
      g[y]![x] = body
  // Wider middle
  for (let y = 5; y <= 8; y++) {
    g[y]![2] = body; g[y]![11] = body
  }
  // Top/bottom trim
  for (let x = 4; x <= 9; x++) { g[2]![x] = metal; g[11]![x] = metal }
  // Propellers/wings
  g[4]![0] = metal; g[4]![1] = metal; g[4]![12] = metal; g[4]![13] = metal
  g[9]![0] = metal; g[9]![1] = metal; g[9]![12] = metal; g[9]![13] = metal
  // Eye/sensor
  g[5]![5] = 0xff0000; g[5]![6] = 0xff0000; g[5]![7] = 0xff0000; g[5]![8] = 0xff0000
  g[6]![5] = 0xff0000; g[6]![6] = 0xff4444; g[6]![7] = 0xff4444; g[6]![8] = 0xff0000
  // Gun barrel
  g[8]![6] = dark; g[8]![7] = dark
  g[12]![6] = metal; g[12]![7] = metal; g[13]![6] = metal; g[13]![7] = metal
  return g
}

function makeEnemyVampire(): PixelGrid {
  const g = makeGrid(16, 22)
  const body = 0x440044
  const dark = darken(body, 0.3)
  const skin = 0x998877
  const cape = 0x220022
  const eye = 0xff0000
  const fang = 0xffffff
  // Head
  for (let y = 0; y <= 4; y++)
    for (let x = 5; x <= 10; x++)
      g[y]![x] = skin
  // Eyes (red, glowing)
  g[2]![6] = eye; g[2]![9] = eye
  g[3]![6] = 0xcc0000; g[3]![9] = 0xcc0000
  // Fangs
  g[4]![7] = fang; g[4]![8] = fang
  // Body / torso
  for (let y = 5; y <= 14; y++)
    for (let x = 4; x <= 11; x++)
      g[y]![x] = body
  // Cape / wings spread
  for (let y = 5; y <= 16; y++) {
    g[y]![0] = cape; g[y]![1] = cape; g[y]![2] = dark; g[y]![3] = dark
    g[y]![12] = dark; g[y]![13] = dark; g[y]![14] = cape; g[y]![15] = cape
  }
  // Wing tips (pointed)
  g[4]![0] = cape; g[4]![15] = cape
  g[3]![0] = cape; g[3]![15] = cape
  // Legs
  for (let y = 15; y <= 19; y++) {
    g[y]![5] = dark; g[y]![6] = dark
    g[y]![9] = dark; g[y]![10] = dark
  }
  // Feet
  g[20]![4] = dark; g[20]![5] = dark; g[20]![6] = dark
  g[20]![9] = dark; g[20]![10] = dark; g[20]![11] = dark
  g[21]![4] = dark; g[21]![11] = dark
  // Collar detail
  g[5]![5] = 0x660066; g[5]![10] = 0x660066
  return g
}

function makeEnemyFungalShambler(): PixelGrid {
  const g = makeGrid(18, 20)
  const body = 0x779944
  const dark = darken(body, 0.25)
  const cap = 0xaa7733
  const capHi = lighten(cap, 0.2)
  const spot = 0xddcc66
  // Stalk body
  for (let y = 8; y <= 19; y++)
    for (let x = 5; x <= 12; x++)
      g[y]![x] = body
  // Feet
  for (let x = 3; x <= 6; x++) g[19]![x] = dark
  for (let x = 11; x <= 14; x++) g[19]![x] = dark
  // Mushroom cap (dome)
  for (let y = 0; y <= 4; y++)
    for (let x = 1; x <= 16; x++)
      g[y]![x] = cap
  for (let x = 3; x <= 14; x++) { g[5]![x] = cap; g[6]![x] = cap }
  for (let x = 5; x <= 12; x++) g[7]![x] = cap
  // Cap highlight
  g[1]![4] = capHi; g[1]![5] = capHi; g[2]![6] = capHi
  // Spots on cap
  g[2]![10] = spot; g[2]![11] = spot; g[3]![4] = spot; g[1]![13] = spot
  // Eyes (sleepy)
  g[9]![6] = 0x000000; g[9]![7] = 0x000000
  g[9]![10] = 0x000000; g[9]![11] = 0x000000
  // Bark texture
  g[12]![6] = dark; g[14]![9] = dark; g[16]![7] = dark
  return g
}

function makeEnemySporeling(): PixelGrid {
  const g = makeGrid(10, 8)
  const body = 0xaacc55
  const dark = darken(body, 0.2)
  // Tiny round body
  for (let y = 2; y <= 6; y++)
    for (let x = 2; x <= 7; x++)
      g[y]![x] = body
  for (let x = 3; x <= 6; x++) { g[1]![x] = body; g[7]![x] = body }
  // Eyes (dots)
  g[3]![3] = 0x000000; g[3]![6] = 0x000000
  // Bottom shade
  for (let x = 3; x <= 6; x++) g[6]![x] = dark
  // Spore puff on top
  g[0]![4] = 0xddee88; g[0]![5] = 0xddee88
  return g
}

function makeEnemyPhantomWraith(): PixelGrid {
  const g = makeGrid(16, 20)
  const body = 0x5544aa
  const dark = darken(body, 0.3)
  const glow = 0x8877cc
  const eye = 0xff44ff
  // Ethereal body (widest at head, tapering down)
  for (let y = 0; y <= 6; y++)
    for (let x = 2; x <= 13; x++)
      g[y]![x] = body
  for (let y = 7; y <= 12; y++)
    for (let x = 3; x <= 12; x++)
      g[y]![x] = dark
  // Wispy tail
  for (let y = 13; y <= 16; y++)
    for (let x = 4; x <= 11; x++)
      g[y]![x] = dark
  for (let x = 5; x <= 10; x++) g[17]![x] = dark
  for (let x = 6; x <= 9; x++) g[18]![x] = dark
  g[19]![7] = dark; g[19]![8] = dark
  // Glowing eyes
  g[3]![4] = eye; g[3]![5] = eye; g[3]![10] = eye; g[3]![11] = eye
  g[4]![5] = 0xffffff; g[4]![10] = 0xffffff
  // Aura glow along edges
  g[2]![1] = glow; g[5]![1] = glow; g[2]![14] = glow; g[5]![14] = glow
  g[8]![2] = glow; g[8]![13] = glow
  return g
}

function makeEnemyMimic(): PixelGrid {
  const g = makeGrid(16, 16)
  const body = 0xaa8833
  const dark = darken(body, 0.25)
  const light = lighten(body, 0.15)
  const metal = 0xccaa44
  // Chest shape
  for (let y = 4; y <= 14; y++)
    for (let x = 1; x <= 14; x++)
      g[y]![x] = body
  // Lid (top part, slightly open)
  for (let y = 0; y <= 4; y++)
    for (let x = 1; x <= 14; x++)
      g[y]![x] = light
  // Metal trim
  for (let x = 1; x <= 14; x++) { g[4]![x] = metal; g[0]![x] = dark }
  // Lock
  g[6]![7] = metal; g[6]![8] = metal; g[7]![7] = metal; g[7]![8] = metal
  // Teeth (jagged opening)
  g[4]![3] = 0xffffff; g[4]![5] = 0xffffff; g[4]![9] = 0xffffff; g[4]![11] = 0xffffff
  g[5]![4] = 0xffffff; g[5]![8] = 0xffffff; g[5]![10] = 0xffffff
  // Evil eye inside
  g[3]![7] = 0xff0000; g[3]![8] = 0xff0000
  // Side detail
  for (let y = 6; y <= 12; y++) { g[y]![1] = dark; g[y]![14] = dark }
  // Feet (stubby)
  g[15]![2] = dark; g[15]![3] = dark; g[15]![12] = dark; g[15]![13] = dark
  return g
}

function makeEnemyGloomMoth(): PixelGrid {
  const g = makeGrid(14, 12)
  const body = 0x334466
  const wing = darken(body, 0.1)
  const wingHi = lighten(body, 0.2)
  const eye = 0x88aaff
  // Body center (thin)
  for (let y = 3; y <= 8; y++)
    for (let x = 5; x <= 8; x++)
      g[y]![x] = body
  // Wings
  for (let y = 2; y <= 7; y++) {
    for (let x = 0; x <= 4; x++) g[y]![x] = wing
    for (let x = 9; x <= 13; x++) g[y]![x] = wing
  }
  // Wing pattern (eye-spots)
  g[4]![2] = wingHi; g[4]![3] = 0x5566aa; g[5]![2] = 0x5566aa
  g[4]![10] = wingHi; g[4]![11] = 0x5566aa; g[5]![11] = 0x5566aa
  // Wing tips
  g[1]![0] = wing; g[1]![13] = wing; g[8]![1] = wing; g[8]![12] = wing
  // Eyes
  g[4]![6] = eye; g[4]![7] = eye
  // Antennae
  g[1]![5] = body; g[0]![4] = body; g[1]![8] = body; g[0]![9] = body
  // Dust trail
  g[9]![3] = 0x556688; g[10]![6] = 0x445577; g[9]![10] = 0x556688
  return g
}

function makeEnemyShockBeetle(): PixelGrid {
  const g = makeGrid(14, 12)
  const body = 0xccaa22
  const dark = darken(body, 0.25)
  const shell = lighten(body, 0.1)
  const spark = 0xffff88
  // Rounded beetle body
  for (let y = 2; y <= 9; y++)
    for (let x = 2; x <= 11; x++)
      g[y]![x] = body
  for (let x = 3; x <= 10; x++) { g[1]![x] = body; g[10]![x] = body }
  // Shell line down center
  for (let y = 1; y <= 10; y++) g[y]![6] = dark
  // Shell highlight
  g[3]![4] = shell; g[3]![8] = shell; g[5]![3] = shell; g[5]![9] = shell
  // Head
  for (let x = 4; x <= 9; x++) g[0]![x] = dark
  // Eyes
  g[2]![3] = 0xffff00; g[2]![10] = 0xffff00
  // Mandibles
  g[1]![2] = dark; g[1]![11] = dark; g[0]![1] = dark; g[0]![12] = dark
  // Legs
  g[11]![3] = dark; g[11]![5] = dark; g[11]![8] = dark; g[11]![10] = dark
  // Electric sparks
  g[0]![6] = spark; g[2]![0] = spark; g[2]![13] = spark; g[7]![0] = spark; g[7]![13] = spark
  return g
}

function makeEnemyFrostWolf(): PixelGrid {
  const g = makeGrid(22, 16)
  const body = 0xaabbcc
  const dark = darken(body, 0.2)
  const belly = lighten(body, 0.15)
  const nose = 0x222222
  // Body
  for (let y = 4; y <= 12; y++)
    for (let x = 4; x <= 18; x++)
      g[y]![x] = body
  // Head
  for (let y = 2; y <= 8; y++)
    for (let x = 15; x <= 21; x++)
      g[y]![x] = body
  for (let x = 16; x <= 20; x++) g[1]![x] = body
  // Snout
  g[6]![21] = dark; g[7]![21] = dark; g[7]![20] = nose
  // Ears
  g[0]![16] = dark; g[0]![19] = dark; g[1]![16] = body; g[1]![19] = body
  // Eyes
  g[3]![17] = 0x44ccff; g[3]![19] = 0x44ccff
  // Belly
  for (let y = 9; y <= 12; y++)
    for (let x = 6; x <= 16; x++)
      g[y]![x] = belly
  // Legs
  for (let y = 12; y <= 15; y++) {
    g[y]![5] = dark; g[y]![6] = dark
    g[y]![10] = dark; g[y]![11] = dark
    g[y]![14] = dark; g[y]![15] = dark
  }
  // Tail
  g[5]![3] = body; g[4]![2] = body; g[3]![1] = body; g[2]![0] = body
  // Frost particles
  g[1]![10] = 0xccddff; g[0]![13] = 0xeeeeff
  return g
}

function makeEnemyIceWisp(): PixelGrid {
  const g = makeGrid(12, 12)
  const body = 0x88ddff
  const core = 0xccffff
  const glow = lighten(body, 0.3)
  const trail = darken(body, 0.15)
  // Ethereal round body
  for (let y = 1; y <= 7; y++)
    for (let x = 2; x <= 9; x++)
      g[y]![x] = body
  for (let x = 3; x <= 8; x++) { g[0]![x] = body; g[8]![x] = body }
  // Bright core
  for (let y = 3; y <= 5; y++)
    for (let x = 4; x <= 7; x++)
      g[y]![x] = core
  g[4]![5] = glow; g[4]![6] = glow
  // Eyes
  g[3]![4] = 0xffffff; g[3]![7] = 0xffffff
  // Ice trail below
  g[9]![4] = trail; g[9]![7] = trail; g[10]![3] = trail; g[10]![8] = trail
  g[11]![5] = trail; g[11]![6] = trail
  // Sparkle
  g[0]![5] = 0xffffff; g[1]![9] = 0xffffff; g[6]![1] = 0xffffff
  return g
}

function makeEnemySandScorpion(): PixelGrid {
  const g = makeGrid(20, 12)
  const body = 0xcc9944
  const dark = darken(body, 0.2)
  const claw = darken(body, 0.15)
  // Body segments
  for (let y = 4; y <= 9; y++)
    for (let x = 5; x <= 14; x++)
      g[y]![x] = body
  // Head
  for (let y = 5; y <= 8; y++)
    for (let x = 14; x <= 17; x++)
      g[y]![x] = body
  // Claws
  g[3]![17] = claw; g[3]![18] = claw; g[2]![18] = claw; g[2]![19] = claw
  g[10]![17] = claw; g[10]![18] = claw; g[11]![18] = claw; g[11]![19] = claw
  // Tail (curving up)
  g[5]![4] = body; g[4]![3] = body; g[3]![2] = body; g[2]![2] = body
  g[1]![3] = body; g[0]![4] = dark // stinger
  g[0]![3] = 0xff4444 // poison tip
  // Eyes
  g[5]![15] = 0x000000; g[5]![16] = 0x000000
  // Legs
  for (let i = 0; i < 4; i++) {
    const lx = 7 + i * 2
    g[10]![lx] = dark; g[11]![lx] = dark
  }
  // Segment lines
  g[6]![8] = dark; g[6]![11] = dark
  return g
}

function makeEnemyDustDevil(): PixelGrid {
  const g = makeGrid(14, 18)
  const body = 0xddbb88
  const dark = darken(body, 0.15)
  const sand = 0xeedd99
  // Spinning tornado shape (wide top, narrow bottom)
  for (let y = 0; y <= 4; y++)
    for (let x = 1; x <= 12; x++)
      g[y]![x] = body
  for (let y = 5; y <= 8; y++)
    for (let x = 2; x <= 11; x++)
      g[y]![x] = body
  for (let y = 9; y <= 12; y++)
    for (let x = 3; x <= 10; x++)
      g[y]![x] = dark
  for (let y = 13; y <= 15; y++)
    for (let x = 4; x <= 9; x++)
      g[y]![x] = dark
  for (let x = 5; x <= 8; x++) g[16]![x] = dark
  g[17]![6] = dark; g[17]![7] = dark
  // Swirl lines
  g[2]![3] = sand; g[3]![6] = sand; g[4]![9] = sand
  g[6]![4] = sand; g[7]![7] = sand; g[8]![10] = sand
  g[10]![5] = sand; g[12]![7] = sand
  // Eyes in the storm
  g[3]![5] = 0xff8800; g[3]![8] = 0xff8800
  // Sand particles flying off
  g[1]![0] = sand; g[0]![13] = sand; g[4]![13] = sand; g[7]![1] = sand
  return g
}

function makeEnemyJungleSpider(): PixelGrid {
  const g = makeGrid(18, 12)
  const body = 0x336622
  const dark = darken(body, 0.3)
  const leg = 0x224411
  const eye = 0xff0000
  // Abdomen (back, larger)
  for (let y = 3; y <= 9; y++)
    for (let x = 1; x <= 8; x++)
      g[y]![x] = body
  for (let x = 2; x <= 7; x++) { g[2]![x] = body; g[10]![x] = body }
  // Head (front, smaller)
  for (let y = 4; y <= 8; y++)
    for (let x = 9; x <= 13; x++)
      g[y]![x] = dark
  // Fangs
  g[8]![12] = 0xcccccc; g[8]![13] = 0xcccccc; g[9]![13] = 0xcccccc
  // Eyes (cluster)
  g[4]![10] = eye; g[4]![12] = eye; g[5]![11] = eye; g[5]![10] = 0xcc0000
  // Legs (4 on each side)
  g[3]![0] = leg; g[2]![0] = leg // back-left
  g[5]![0] = leg; g[5]![1] = leg // mid-left upper
  g[7]![0] = leg; g[7]![1] = leg // mid-left lower
  g[10]![0] = leg; g[11]![1] = leg // front-left
  g[3]![14] = leg; g[2]![15] = leg // back-right
  g[5]![14] = leg; g[4]![15] = leg
  g[7]![15] = leg; g[8]![16] = leg
  g[10]![14] = leg; g[11]![15] = leg
  // Abdomen pattern
  g[5]![4] = 0x448833; g[6]![3] = 0x448833; g[7]![5] = 0x448833
  return g
}

function makeEnemyVineStrangler(): PixelGrid {
  const g = makeGrid(16, 24)
  const body = 0x225511
  const dark = darken(body, 0.25)
  const vine = 0x337722
  const leaf = 0x44aa33
  // Tall plant-like body
  for (let y = 2; y <= 21; y++)
    for (let x = 4; x <= 11; x++)
      g[y]![x] = body
  // Bulb head
  for (let y = 0; y <= 4; y++)
    for (let x = 2; x <= 13; x++)
      g[y]![x] = vine
  for (let x = 4; x <= 11; x++) g[0]![x] = leaf // top leaves
  // Eyes (menacing)
  g[2]![5] = 0xffff00; g[2]![6] = 0xffff00
  g[2]![9] = 0xffff00; g[2]![10] = 0xffff00
  g[3]![6] = 0xff0000; g[3]![9] = 0xff0000
  // Vine tendrils (reaching out)
  g[8]![2] = vine; g[8]![3] = vine; g[9]![1] = vine; g[10]![0] = vine
  g[12]![12] = vine; g[12]![13] = vine; g[13]![14] = vine; g[14]![15] = vine
  g[16]![2] = vine; g[16]![3] = vine; g[17]![1] = vine
  // Thorns
  g[7]![3] = 0xaacc66; g[11]![12] = 0xaacc66; g[15]![3] = 0xaacc66
  // Root base
  for (let x = 2; x <= 13; x++) g[22]![x] = dark
  for (let x = 3; x <= 12; x++) g[23]![x] = dark
  return g
}

function makeEnemyMountainHawk(): PixelGrid {
  const g = makeGrid(16, 12)
  const body = 0x886644
  const dark = darken(body, 0.2)
  const wing = darken(body, 0.1)
  const beak = 0xffaa22
  const belly = lighten(body, 0.2)
  // Body center
  for (let y = 3; y <= 8; y++)
    for (let x = 5; x <= 10; x++)
      g[y]![x] = body
  // Head
  for (let y = 2; y <= 5; y++)
    for (let x = 11; x <= 14; x++)
      g[y]![x] = body
  // Beak
  g[4]![15] = beak; g[5]![14] = beak; g[5]![15] = beak
  // Eye
  g[3]![12] = 0xffff00; g[3]![13] = 0x000000
  // Wings spread wide
  for (let y = 3; y <= 6; y++) {
    for (let x = 0; x <= 4; x++) g[y]![x] = wing
  }
  g[2]![0] = wing; g[2]![1] = wing; g[7]![1] = wing; g[7]![2] = wing
  // Wing feather detail
  g[4]![1] = dark; g[5]![3] = dark
  // Belly
  for (let y = 6; y <= 8; y++)
    for (let x = 6; x <= 9; x++)
      g[y]![x] = belly
  // Tail
  g[6]![3] = dark; g[7]![2] = dark; g[8]![1] = dark
  // Talons
  g[9]![6] = dark; g[10]![5] = dark; g[9]![9] = dark; g[10]![10] = dark
  g[11]![5] = 0xffaa22; g[11]![10] = 0xffaa22
  return g
}

// ─── STATION TILE TEXTURES ────────────────────────────────────

function makeTileStationWorkbench(): PixelGrid {
  const g = makeGrid(16, 16)
  const wood = 0x8b6b3a
  const dark = darken(wood, 0.2)
  const top = lighten(wood, 0.1)
  // Table top
  for (let x = 0; x <= 15; x++) { g[3]![x] = top; g[4]![x] = top; g[5]![x] = dark }
  // Legs
  for (let y = 6; y <= 15; y++) {
    g[y]![1] = wood; g[y]![2] = wood
    g[y]![13] = wood; g[y]![14] = wood
  }
  // Cross brace
  for (let x = 2; x <= 13; x++) g[10]![x] = dark
  // Tool on top
  g[2]![6] = 0x888888; g[2]![7] = 0x888888; g[1]![8] = 0x888888
  return g
}

function makeTileStationFurnace(): PixelGrid {
  const g = makeGrid(16, 16)
  const brick = 0xaa4422
  const dark = darken(brick, 0.25)
  const mortar = darken(brick, 0.15)
  fillGrid(g, brick)
  // Brick pattern
  for (let y = 0; y < 16; y += 4) {
    for (let x = 0; x < 16; x++) g[y]![x] = mortar
    const offset = (y / 4) % 2 === 0 ? 0 : 8
    for (let yy = y; yy < Math.min(y + 4, 16); yy++) {
      g[yy]![offset] = mortar
      if (offset + 8 < 16) g[yy]![offset + 8] = mortar
    }
  }
  // Fire opening
  for (let y = 9; y <= 14; y++)
    for (let x = 5; x <= 10; x++)
      g[y]![x] = dark
  // Flames
  g[10]![6] = 0xff6600; g[10]![8] = 0xff6600; g[9]![7] = 0xffaa00
  g[11]![7] = 0xff4400; g[10]![9] = 0xff8800
  // Chimney top
  for (let x = 6; x <= 9; x++) g[0]![x] = dark
  for (let x = 6; x <= 9; x++) g[1]![x] = dark
  return g
}

function makeTileStationAnvil(): PixelGrid {
  const g = makeGrid(16, 16)
  const metal = 0x666688
  const dark = darken(metal, 0.25)
  const hi = lighten(metal, 0.2)
  // Anvil top (wide)
  for (let x = 1; x <= 14; x++) { g[4]![x] = metal; g[5]![x] = metal }
  for (let x = 0; x <= 15; x++) g[3]![x] = hi
  // Horn (left extension)
  g[4]![0] = metal; g[5]![0] = dark; g[3]![0] = hi
  // Anvil waist (narrow)
  for (let y = 6; y <= 9; y++)
    for (let x = 4; x <= 11; x++)
      g[y]![x] = metal
  // Base (wide again)
  for (let y = 10; y <= 13; y++)
    for (let x = 2; x <= 13; x++)
      g[y]![x] = dark
  for (let x = 1; x <= 14; x++) { g[14]![x] = dark; g[15]![x] = darken(metal, 0.3) }
  // Highlight on top
  g[3]![5] = 0xaaaacc; g[3]![6] = 0xaaaacc
  return g
}

function makeTileStationTechBench(): PixelGrid {
  const g = makeGrid(16, 16)
  const body = 0x4488aa
  const dark = darken(body, 0.2)
  const screen = 0x22ff88
  const metal = 0x888899
  // Main body
  for (let y = 2; y <= 14; y++)
    for (let x = 1; x <= 14; x++)
      g[y]![x] = body
  for (let x = 1; x <= 14; x++) { g[1]![x] = metal; g[15]![x] = metal }
  // Screen
  for (let y = 3; y <= 7; y++)
    for (let x = 3; x <= 8; x++)
      g[y]![x] = 0x112233
  // Screen glow
  g[4]![4] = screen; g[4]![5] = screen; g[5]![4] = screen; g[6]![6] = screen; g[5]![7] = screen
  // Buttons/knobs
  g[10]![3] = 0xff4444; g[10]![5] = 0x44ff44; g[10]![7] = 0x4444ff
  g[12]![4] = metal; g[12]![6] = metal
  // Side panel
  for (let y = 3; y <= 12; y++) { g[y]![1] = dark; g[y]![14] = dark }
  // Antenna
  g[0]![11] = metal; g[1]![11] = metal; g[0]![12] = 0xff4444
  return g
}

function makeTileStationFusion(): PixelGrid {
  const g = makeGrid(16, 16)
  const body = 0x8844cc
  const dark = darken(body, 0.25)
  const glow = 0xcc88ff
  const core = 0xffffff
  // Cylindrical body
  for (let y = 2; y <= 13; y++)
    for (let x = 2; x <= 13; x++)
      g[y]![x] = body
  for (let x = 3; x <= 12; x++) { g[1]![x] = dark; g[14]![x] = dark }
  for (let x = 4; x <= 11; x++) { g[0]![x] = dark; g[15]![x] = dark }
  // Central fusion core
  for (let y = 5; y <= 10; y++)
    for (let x = 5; x <= 10; x++)
      g[y]![x] = glow
  g[7]![7] = core; g[7]![8] = core; g[8]![7] = core; g[8]![8] = core
  // Energy rings
  for (let x = 3; x <= 12; x++) { g[4]![x] = glow; g[11]![x] = glow }
  // Side pipes
  for (let y = 5; y <= 10; y++) { g[y]![1] = dark; g[y]![14] = dark }
  g[6]![0] = dark; g[9]![0] = dark; g[6]![15] = dark; g[9]![15] = dark
  return g
}

function makeTileStationWorkbenchMk2(): PixelGrid {
  const g = makeGrid(16, 16)
  const wood = 0xa0824a
  const dark = darken(wood, 0.2)
  const top = lighten(wood, 0.1)
  const metal = 0x888899
  // Table top (with metal trim)
  for (let x = 0; x <= 15; x++) { g[2]![x] = metal; g[3]![x] = top; g[4]![x] = top; g[5]![x] = dark }
  // Legs (reinforced)
  for (let y = 6; y <= 15; y++) {
    g[y]![1] = wood; g[y]![2] = metal
    g[y]![13] = metal; g[y]![14] = wood
  }
  // Shelf
  for (let x = 2; x <= 13; x++) g[10]![x] = dark
  // Tools on top
  g[1]![5] = metal; g[1]![6] = metal; g[0]![7] = metal
  g[1]![10] = 0xffaa00; g[1]![11] = 0xffaa00 // glowing tool
  return g
}

function makeTileStationArcaneAnvil(): PixelGrid {
  const g = makeGrid(16, 16)
  const body = 0x7744cc
  const dark = darken(body, 0.25)
  const glow = 0xcc99ff
  const rune = 0xff88ff
  // Anvil top
  for (let x = 0; x <= 15; x++) { g[3]![x] = glow; g[4]![x] = body; g[5]![x] = body }
  // Horn
  g[3]![0] = glow; g[4]![0] = body
  // Waist
  for (let y = 6; y <= 9; y++)
    for (let x = 4; x <= 11; x++)
      g[y]![x] = body
  // Base
  for (let y = 10; y <= 14; y++)
    for (let x = 2; x <= 13; x++)
      g[y]![x] = dark
  for (let x = 1; x <= 14; x++) g[15]![x] = darken(body, 0.35)
  // Glowing runes on surface
  g[4]![4] = rune; g[4]![7] = rune; g[4]![10] = rune; g[4]![13] = rune
  // Arcane glow underneath
  g[7]![6] = glow; g[7]![9] = glow; g[8]![7] = glow; g[8]![8] = glow
  // Floating particles
  g[1]![6] = rune; g[0]![9] = rune; g[2]![12] = rune
  return g
}

// ─── BOSS TEXTURES ─────────────────────────────────────────

function makeBossVineGuardian(): PixelGrid {
  const g = makeGrid(32, 40)
  const body = 0x33aa33
  const dark = darken(body, 0.25)
  const light = lighten(body, 0.2)
  const vine = 0x227722
  const eye = 0xffff00
  // Main body - tree trunk shape
  for (let y = 5; y <= 35; y++)
    for (let x = 8; x <= 23; x++)
      g[y]![x] = body
  // Wider base
  for (let y = 30; y <= 39; y++)
    for (let x = 5; x <= 26; x++)
      g[y]![x] = body
  // Crown/top
  for (let y = 0; y <= 8; y++)
    for (let x = 4; x <= 27; x++)
      g[y]![x] = light
  for (let y = 0; y <= 4; y++) {
    for (let x = 2; x <= 3; x++) g[y]![x] = light
    for (let x = 28; x <= 29; x++) g[y]![x] = light
  }
  // Eyes
  for (let y = 12; y <= 15; y++) {
    g[y]![11] = eye; g[y]![12] = eye; g[y]![13] = eye
    g[y]![18] = eye; g[y]![19] = eye; g[y]![20] = eye
  }
  g[13]![12] = 0x000000; g[13]![19] = 0x000000
  g[14]![12] = 0x000000; g[14]![19] = 0x000000
  // Mouth
  for (let x = 12; x <= 19; x++) g[20]![x] = dark
  for (let x = 13; x <= 18; x++) g[21]![x] = dark
  // Vine arms
  for (let y = 15; y <= 30; y++) {
    g[y]![3] = vine; g[y]![4] = vine; g[y]![5] = vine
    g[y]![26] = vine; g[y]![27] = vine; g[y]![28] = vine
  }
  // Root feet
  for (let x = 3; x <= 8; x++) { g[38]![x] = dark; g[39]![x] = dark }
  for (let x = 23; x <= 28; x++) { g[38]![x] = dark; g[39]![x] = dark }
  // Bark texture
  for (let y = 10; y < 35; y += 4) {
    for (let x = 9; x <= 22; x++) if ((x + y) % 5 === 0) g[y]![x] = dark
  }
  return g
}

function makeBossLeviathan(): PixelGrid {
  const g = makeGrid(40, 20)
  const body = 0x1155aa
  const dark = darken(body, 0.2)
  const belly = lighten(body, 0.3)
  // Long body
  for (let y = 4; y <= 15; y++)
    for (let x = 4; x <= 35; x++)
      g[y]![x] = body
  // Head (wider)
  for (let y = 2; y <= 17; y++)
    for (let x = 28; x <= 39; x++)
      g[y]![x] = body
  // Tail taper
  for (let y = 6; y <= 13; y++) { g[y]![2] = body; g[y]![3] = body }
  for (let y = 7; y <= 12; y++) { g[y]![0] = dark; g[y]![1] = dark }
  // Tail fin
  g[4]![0] = dark; g[5]![0] = dark; g[5]![1] = dark
  g[14]![0] = dark; g[15]![0] = dark; g[14]![1] = dark
  // Belly
  for (let y = 12; y <= 15; y++)
    for (let x = 6; x <= 33; x++)
      g[y]![x] = belly
  // Eye
  g[6]![34] = 0xffffff; g[6]![35] = 0xffffff; g[7]![34] = 0xffffff; g[7]![35] = 0x000000
  // Teeth
  for (let x = 36; x <= 39; x++) { g[10]![x] = 0xffffff; g[11]![x] = dark }
  g[9]![37] = 0xffffff; g[9]![39] = 0xffffff
  // Dorsal fin
  for (let x = 15; x <= 22; x++) g[3]![x] = dark
  for (let x = 17; x <= 20; x++) g[2]![x] = dark
  g[1]![18] = dark; g[1]![19] = dark
  // Scale pattern
  for (let y = 5; y < 12; y += 2)
    for (let x = 6; x < 30; x += 3)
      g[y]![x] = lighten(body, 0.1)
  return g
}

function makeBossCrystalGolem(): PixelGrid {
  const g = makeGrid(36, 44)
  const body = 0x66ddff
  const dark = darken(body, 0.2)
  const crystal = 0xaaeeff
  const glow = 0xffffff
  // Massive body
  for (let y = 8; y <= 38; y++)
    for (let x = 6; x <= 29; x++)
      g[y]![x] = body
  // Head
  for (let y = 0; y <= 12; y++)
    for (let x = 8; x <= 27; x++)
      g[y]![x] = body
  // Crystal spikes on head
  g[0]![10] = crystal; g[0]![11] = crystal
  g[0]![24] = crystal; g[0]![25] = crystal
  for (let x = 12; x <= 15; x++) { g[0]![x] = crystal; g[1]![x] = crystal }
  for (let x = 20; x <= 23; x++) { g[0]![x] = crystal; g[1]![x] = crystal }
  // Shoulders wide
  for (let y = 12; y <= 20; y++) {
    for (let x = 2; x <= 5; x++) g[y]![x] = body
    for (let x = 30; x <= 33; x++) g[y]![x] = body
  }
  // Arms
  for (let y = 14; y <= 32; y++) {
    g[y]![0] = dark; g[y]![1] = dark; g[y]![2] = body; g[y]![3] = body
    g[y]![32] = body; g[y]![33] = body; g[y]![34] = dark; g[y]![35] = dark
  }
  // Eyes - glowing white
  g[5]![12] = glow; g[5]![13] = glow; g[6]![12] = glow; g[6]![13] = glow
  g[5]![22] = glow; g[5]![23] = glow; g[6]![22] = glow; g[6]![23] = glow
  // Legs
  for (let y = 38; y <= 43; y++) {
    for (let x = 8; x <= 15; x++) g[y]![x] = dark
    for (let x = 20; x <= 27; x++) g[y]![x] = dark
  }
  // Crystal facets
  for (let y = 15; y < 36; y += 5)
    for (let x = 8; x < 28; x += 4)
      g[y]![x] = crystal
  return g
}

function makeBossMagmaWyrm(): PixelGrid {
  const g = makeGrid(30, 30)
  const body = 0xff4400
  const dark = darken(body, 0.3)
  const hot = 0xffaa00
  const glow = 0xffcc44
  // Coiled serpent body
  for (let y = 4; y <= 25; y++)
    for (let x = 5; x <= 24; x++)
      g[y]![x] = body
  // Head top
  for (let y = 0; y <= 6; y++)
    for (let x = 8; x <= 21; x++)
      g[y]![x] = body
  // Horns
  g[0]![6] = dark; g[0]![7] = dark; g[1]![7] = dark
  g[0]![22] = dark; g[0]![23] = dark; g[1]![22] = dark
  // Eyes
  g[3]![10] = 0xffffff; g[3]![11] = 0xffff00
  g[3]![18] = 0xffffff; g[3]![19] = 0xffff00
  // Mouth - fire
  for (let x = 12; x <= 17; x++) { g[7]![x] = glow; g[8]![x] = hot }
  // Wings
  for (let y = 10; y <= 18; y++) {
    g[y]![0] = dark; g[y]![1] = dark; g[y]![2] = body; g[y]![3] = body
    g[y]![26] = body; g[y]![27] = body; g[y]![28] = dark; g[y]![29] = dark
  }
  g[9]![0] = dark; g[9]![1] = dark; g[9]![28] = dark; g[9]![29] = dark
  // Tail
  for (let y = 26; y <= 29; y++)
    for (let x = 10; x <= 19; x++)
      g[y]![x] = dark
  g[28]![12] = body; g[28]![13] = body; g[28]![16] = body; g[28]![17] = body
  // Lava glow lines
  for (let y = 12; y < 24; y += 3)
    for (let x = 7; x < 22; x += 2) {
      if (g[y]![x] === body) g[y]![x] = hot
    }
  return g
}

function makeBossCoreSentinel(): PixelGrid {
  const g = makeGrid(28, 28)
  const body = 0xaa22ff
  const dark = darken(body, 0.2)
  const light = lighten(body, 0.25)
  const energy = 0xff44ff
  const core = 0xffffff
  // Diamond/octagonal shape
  for (let y = 4; y <= 23; y++) {
    const indent = Math.max(0, Math.abs(13 - y) - 5)
    for (let x = indent + 2; x <= 25 - indent; x++)
      g[y]![x] = body
  }
  // Central core
  for (let y = 10; y <= 17; y++)
    for (let x = 10; x <= 17; x++)
      g[y]![x] = energy
  g[12]![13] = core; g[12]![14] = core
  g[13]![13] = core; g[13]![14] = core
  g[15]![13] = core; g[15]![14] = core
  // Eye/sensor
  g[8]![13] = core; g[8]![14] = core
  g[9]![12] = core; g[9]![13] = 0x000000; g[9]![14] = 0x000000; g[9]![15] = core
  // Orbiting rings
  for (let x = 0; x <= 27; x++) { if (x % 3 === 0) { g[2]![x] = light; g[25]![x] = light } }
  for (let y = 0; y <= 27; y++) { if (y % 3 === 0) { g[y]![1] = light; g[y]![26] = light } }
  // Energy veins
  for (let y = 5; y < 23; y += 4) { g[y]![6] = energy; g[y]![21] = energy }
  return g
}

function makeBossMothership(): PixelGrid {
  const g = makeGrid(48, 32)
  const hull = 0xff44ff
  const dark = darken(hull, 0.25)
  const metal = 0xaaaacc
  const light = 0xff88ff
  const window = 0x00ffff
  // Main hull - saucer shape
  for (let y = 8; y <= 23; y++) {
    const w = y <= 15 ? 2 + (y - 8) * 2 : 2 + (23 - y) * 2
    const x0 = 24 - w
    const x1 = 24 + w - 1
    for (let x = Math.max(0, x0); x <= Math.min(47, x1); x++)
      g[y]![x] = hull
  }
  // Wider center band
  for (let y = 12; y <= 19; y++)
    for (let x = 4; x <= 43; x++)
      g[y]![x] = hull
  // Metal trim
  for (let x = 6; x <= 41; x++) { g[12]![x] = metal; g[19]![x] = metal }
  // Windows
  for (let x = 10; x <= 38; x += 4) { g[14]![x] = window; g[14]![x+1] = window }
  // Bridge dome on top
  for (let y = 5; y <= 8; y++)
    for (let x = 18; x <= 29; x++)
      g[y]![x] = light
  for (let x = 20; x <= 27; x++) g[4]![x] = light
  for (let x = 22; x <= 25; x++) g[3]![x] = light
  // Bridge window
  g[6]![22] = window; g[6]![23] = window; g[6]![24] = window; g[6]![25] = window
  // Underside beam emitter
  for (let x = 20; x <= 27; x++) { g[24]![x] = dark; g[25]![x] = dark }
  for (let x = 22; x <= 25; x++) { g[26]![x] = 0xffaaff; g[27]![x] = 0xff88ff }
  // Engine pods
  for (let y = 20; y <= 25; y++) {
    g[y]![2] = metal; g[y]![3] = metal; g[y]![4] = dark
    g[y]![43] = dark; g[y]![44] = metal; g[y]![45] = metal
  }
  // Engine glow
  g[26]![2] = 0xff66ff; g[26]![3] = 0xff66ff
  g[26]![44] = 0xff66ff; g[26]![45] = 0xff66ff
  // Detail lines
  for (let x = 8; x <= 39; x += 5) { g[16]![x] = dark; g[17]![x] = dark }
  return g
}

// ─── PROJECTILE TEXTURES ───────────────────────────────────

function makeProjectileArrow(): PixelGrid {
  const g = makeGrid(5, 5)
  g[0]![2] = 0xffffff
  g[1]![1] = 0xeeeeee; g[1]![2] = 0xffffff; g[1]![3] = 0xeeeeee
  g[2]![2] = 0xffffff
  g[3]![2] = 0xddccaa
  g[4]![2] = 0xddccaa
  return g
}

function makeProjectileMagic(): PixelGrid {
  const g = makeGrid(8, 8)
  const core = 0xffffff
  const mid = 0xaa66ff
  const outer = 0x6644cc
  // Glowing orb
  for (let y = 1; y <= 6; y++)
    for (let x = 1; x <= 6; x++)
      g[y]![x] = outer
  for (let y = 2; y <= 5; y++)
    for (let x = 2; x <= 5; x++)
      g[y]![x] = mid
  g[3]![3] = core; g[3]![4] = core; g[4]![3] = core; g[4]![4] = core
  return g
}

function makeProjectileEnemy(): PixelGrid {
  const g = makeGrid(5, 5)
  g[1]![2] = 0xff4444
  g[2]![1] = 0xff4444; g[2]![2] = 0xff6666; g[2]![3] = 0xff4444
  g[3]![2] = 0xff4444
  g[0]![2] = 0xff2222; g[4]![2] = 0xff2222; g[2]![0] = 0xff2222; g[2]![4] = 0xff2222
  return g
}

function makeSummonMinion(): PixelGrid {
  const g = makeGrid(10, 10)
  const body = 0x44aa88
  const light = lighten(body, 0.3)
  // Small floating companion
  for (let y = 2; y <= 7; y++)
    for (let x = 2; x <= 7; x++)
      g[y]![x] = body
  for (let x = 3; x <= 6; x++) { g[1]![x] = body; g[8]![x] = body }
  // Eyes
  g[3]![3] = 0xffffff; g[3]![6] = 0xffffff
  g[4]![3] = 0x000000; g[4]![6] = 0x000000
  // Glow
  g[0]![4] = light; g[0]![5] = light
  g[9]![4] = light; g[9]![5] = light
  g[4]![0] = light; g[5]![0] = light
  g[4]![9] = light; g[5]![9] = light
  return g
}

// ─── ITEM TEXTURES (16×16 icons for hotbar/inventory) ─────

function makeItemIronBar(): PixelGrid {
  const g = makeGrid(16, 16)
  const base = 0xc9a96e
  const hi = lighten(base, 0.25)
  const sh = darken(base, 0.25)
  // Ingot shape
  for (let y = 5; y <= 11; y++)
    for (let x = 2; x <= 13; x++)
      g[y]![x] = base
  // Top bevel
  for (let x = 3; x <= 12; x++) g[4]![x] = hi
  // Bottom shadow
  for (let x = 2; x <= 13; x++) g[12]![x] = sh
  // Side shading
  for (let y = 5; y <= 11; y++) { g[y]![2] = sh; g[y]![13] = sh }
  // Highlight
  g[5]![4] = hi; g[5]![5] = hi; g[6]![4] = hi
  return g
}

function makeItemDiamond(): PixelGrid {
  const g = makeGrid(16, 16)
  const base = 0x7fffff
  const hi = lighten(base, 0.3)
  const sh = darken(base, 0.25)
  // Diamond gem shape
  for (let y = 2; y <= 8; y++) {
    const w = y <= 5 ? y - 1 : 9 - y
    for (let x = 7 - w; x <= 8 + w; x++)
      g[y]![x] = base
  }
  // Lower facet
  for (let y = 9; y <= 13; y++) {
    const w = 13 - y
    for (let x = 7 - w; x <= 8 + w; x++)
      g[y]![x] = sh
  }
  // Sparkle
  g[3]![7] = hi; g[4]![6] = hi; g[4]![9] = 0xffffff
  g[5]![8] = hi
  return g
}

function makeItemTitaniumBar(): PixelGrid {
  const g = makeGrid(16, 16)
  const base = 0xe8e8e8
  const hi = 0xffffff
  const sh = darken(base, 0.2)
  for (let y = 5; y <= 11; y++)
    for (let x = 2; x <= 13; x++)
      g[y]![x] = base
  for (let x = 3; x <= 12; x++) g[4]![x] = hi
  for (let x = 2; x <= 13; x++) g[12]![x] = sh
  for (let y = 5; y <= 11; y++) { g[y]![2] = sh; g[y]![13] = sh }
  g[5]![4] = hi; g[5]![5] = hi; g[6]![5] = hi
  // Subtle blue tint streak
  g[7]![6] = 0xccddff; g[7]![7] = 0xccddff; g[7]![8] = 0xccddff
  return g
}

function makeItemCarbonPlate(): PixelGrid {
  const g = makeGrid(16, 16)
  const base = 0x3a3a5e
  const hi = lighten(base, 0.2)
  const sh = darken(base, 0.2)
  // Plate shape
  for (let y = 3; y <= 12; y++)
    for (let x = 2; x <= 13; x++)
      g[y]![x] = base
  // Crosshatch pattern
  for (let y = 3; y <= 12; y++)
    for (let x = 2; x <= 13; x++)
      if ((x + y) % 3 === 0) g[y]![x] = hi
  // Edges
  for (let x = 2; x <= 13; x++) { g[3]![x] = hi; g[12]![x] = sh }
  for (let y = 3; y <= 12; y++) { g[y]![2] = sh; g[y]![13] = sh }
  return g
}

function makeItemGlass(): PixelGrid {
  const g = makeGrid(16, 16)
  const base = 0xccddee
  const hi = 0xeeffff
  const sh = darken(base, 0.15)
  // Glass pane
  for (let y = 2; y <= 13; y++)
    for (let x = 3; x <= 12; x++)
      g[y]![x] = base
  // Frame edges
  for (let x = 3; x <= 12; x++) { g[2]![x] = sh; g[13]![x] = sh }
  for (let y = 2; y <= 13; y++) { g[y]![3] = sh; g[y]![12] = sh }
  // Reflection shine
  g[4]![5] = hi; g[4]![6] = hi; g[5]![5] = hi
  g[5]![6] = 0xffffff; g[6]![6] = hi
  return g
}

function makeItemPlantFiber(): PixelGrid {
  const g = makeGrid(16, 16)
  const rng = mulberry32(200)
  const base = 0x66aa44
  const hi = lighten(base, 0.2)
  const sh = darken(base, 0.2)
  // Bundle of fibers
  for (let strand = 0; strand < 5; strand++) {
    const sx = 3 + strand * 2
    for (let y = 2; y <= 13; y++) {
      const c = rng() > 0.5 ? base : (rng() > 0.5 ? hi : sh)
      g[y]![sx] = c
      if (rng() > 0.6) g[y]![sx + 1] = c
    }
  }
  // Tie in middle
  for (let x = 3; x <= 12; x++) { g[7]![x] = 0x997744; g[8]![x] = 0x886633 }
  return g
}

function makeItemTorch(): PixelGrid {
  const g = makeGrid(16, 16)
  // Stick
  for (let y = 6; y <= 14; y++) { g[y]![7] = 0x8b6b3a; g[y]![8] = 0x7a5a2a }
  // Flame base
  g[5]![7] = 0xff6600; g[5]![8] = 0xff6600
  g[4]![7] = 0xff8800; g[4]![8] = 0xff8800
  g[3]![6] = 0xffaa00; g[3]![7] = 0xffcc00; g[3]![8] = 0xffcc00; g[3]![9] = 0xffaa00
  g[2]![7] = 0xffdd44; g[2]![8] = 0xffdd44
  g[1]![7] = 0xffee88; g[1]![8] = 0xffee88
  g[0]![7] = 0xffff88
  // Glow
  g[4]![6] = 0xff8800; g[4]![9] = 0xff8800
  return g
}

function makeItemWorkbench(): PixelGrid {
  const g = makeGrid(16, 16)
  const wood = 0x8b6b3a
  const dark = darken(wood, 0.25)
  const darker = darken(wood, 0.4)
  const hi = lighten(wood, 0.2)
  const light = lighten(wood, 0.35)
  const metal = 0x888899
  const metalHi = 0xaaaabb
  const metalDk = 0x555566
  const handle = 0x6b4b2a

  // ── Thick tabletop (rows 5-8) with front edge highlight ──
  for (let x = 1; x <= 14; x++) {
    g[5]![x] = light    // top surface highlight
    g[6]![x] = hi       // main surface
    g[7]![x] = wood     // surface body
    g[8]![x] = dark     // front edge / underside shadow
  }
  // Wood grain on surface
  g[6]![3] = light; g[6]![7] = light; g[6]![11] = light
  g[7]![5] = dark; g[7]![9] = dark; g[7]![13] = dark
  // Edge caps
  g[5]![0] = dark; g[6]![0] = dark; g[7]![0] = darker; g[8]![0] = darker
  g[5]![15] = dark; g[6]![15] = dark; g[7]![15] = darker; g[8]![15] = darker

  // ── Sturdy legs (rows 9-14) — 3px wide with shading ──
  for (let y = 9; y <= 14; y++) {
    // Left leg
    g[y]![1] = hi; g[y]![2] = wood; g[y]![3] = dark
    // Right leg
    g[y]![12] = hi; g[y]![13] = wood; g[y]![14] = dark
  }
  // Feet
  g[14]![0] = darker; g[14]![4] = darker
  g[14]![11] = darker; g[14]![15] = darker

  // ── Crossbar/shelf (row 11-12) ──
  for (let x = 3; x <= 12; x++) {
    g[11]![x] = wood
    g[12]![x] = dark
  }

  // ── Vice/clamp on left edge ──
  g[4]![1] = metal; g[4]![2] = metalDk
  g[3]![1] = metalHi; g[3]![2] = metal

  // ── Hammer on tabletop ──
  // Handle (diagonal)
  g[4]![6] = handle; g[3]![7] = handle; g[2]![8] = handle
  // Head
  g[1]![8] = metalDk; g[1]![9] = metal; g[1]![10] = metalHi
  g[2]![9] = metalDk

  // ── Saw leaning on right side ──
  g[4]![12] = metal; g[3]![12] = metalHi; g[2]![12] = metal; g[1]![12] = metalDk
  g[4]![13] = handle  // saw handle
  g[3]![13] = handle
  // Saw teeth
  g[2]![11] = metalDk; g[1]![11] = metalDk

  return g
}

function makeItemWorkbenchMk2(): PixelGrid {
  const g = makeGrid(16, 16)
  const wood = 0xa0824a
  const dark = darken(wood, 0.25)
  const darker = darken(wood, 0.4)
  const hi = lighten(wood, 0.2)
  const light = lighten(wood, 0.35)
  const metal = 0x9999aa
  const metalHi = 0xbbbbcc
  const metalDk = 0x666677
  const accent = 0xccaa44

  // ── Reinforced tabletop (rows 5-8) with metal trim ──
  for (let x = 1; x <= 14; x++) {
    g[5]![x] = metalHi   // metal top trim
    g[6]![x] = light      // main surface
    g[7]![x] = wood       // surface body
    g[8]![x] = dark       // front edge shadow
  }
  // Wood grain
  g[6]![3] = hi; g[6]![7] = hi; g[6]![11] = hi
  g[7]![5] = dark; g[7]![9] = dark; g[7]![13] = dark
  // Metal edge caps
  g[5]![0] = metalDk; g[6]![0] = metalDk; g[7]![0] = darker; g[8]![0] = darker
  g[5]![15] = metalDk; g[6]![15] = metalDk; g[7]![15] = darker; g[8]![15] = darker

  // ── Reinforced legs (rows 9-14) ──
  for (let y = 9; y <= 14; y++) {
    g[y]![1] = hi; g[y]![2] = wood; g[y]![3] = dark
    g[y]![12] = hi; g[y]![13] = wood; g[y]![14] = dark
  }
  // Metal feet
  g[14]![0] = metalDk; g[14]![4] = metalDk
  g[14]![11] = metalDk; g[14]![15] = metalDk

  // ── Crossbar with metal reinforcement (row 11-12) ──
  for (let x = 3; x <= 12; x++) {
    g[11]![x] = metal
    g[12]![x] = dark
  }

  // ── Star/upgrade emblem on front ──
  g[3]![7] = accent; g[3]![8] = accent
  g[2]![7] = accent; g[2]![8] = accent
  g[1]![7] = accent; g[4]![8] = accent

  // ── Gear on tabletop ──
  g[4]![12] = metal; g[3]![12] = metalHi; g[3]![11] = metal; g[4]![11] = metalDk

  return g
}

function makeItemFurnace(): PixelGrid {
  const g = makeGrid(16, 16)
  const brick = 0xaa4422
  const dark = darken(brick, 0.25)
  const mortar = darken(brick, 0.1)
  // Brick body
  for (let y = 3; y <= 13; y++)
    for (let x = 2; x <= 13; x++)
      g[y]![x] = brick
  // Brick lines
  for (let x = 2; x <= 13; x++) { g[5]![x] = mortar; g[8]![x] = mortar; g[11]![x] = mortar }
  for (let y = 3; y <= 13; y++) if (y % 3 === 0) { g[y]![7] = mortar }
  // Fire opening
  for (let y = 9; y <= 12; y++)
    for (let x = 5; x <= 10; x++)
      g[y]![x] = 0x111111
  // Fire inside
  g[11]![6] = 0xff6600; g[11]![7] = 0xffaa00; g[11]![8] = 0xff8800; g[11]![9] = 0xff6600
  g[10]![7] = 0xffcc00; g[10]![8] = 0xffaa00
  // Chimney
  g[2]![6] = dark; g[2]![7] = dark; g[1]![6] = dark; g[1]![7] = dark
  // Smoke
  g[0]![6] = 0x888888; g[0]![5] = 0x777777
  return g
}

function makeItemAnvil(): PixelGrid {
  const g = makeGrid(16, 16)
  const metal = 0x666688
  const hi = lighten(metal, 0.2)
  const sh = darken(metal, 0.25)
  // Top flat surface
  for (let x = 1; x <= 14; x++) g[5]![x] = hi
  for (let x = 1; x <= 14; x++) g[6]![x] = metal
  // Horn (left protrusion)
  for (let x = 0; x <= 3; x++) { g[5]![x] = hi; g[6]![x] = metal; g[7]![x] = sh }
  g[6]![0] = sh
  // Body
  for (let y = 7; y <= 9; y++)
    for (let x = 3; x <= 12; x++)
      g[y]![x] = metal
  // Base wider
  for (let y = 10; y <= 12; y++)
    for (let x = 2; x <= 13; x++)
      g[y]![x] = sh
  // Highlight on top
  g[5]![6] = 0xffffff; g[5]![7] = hi
  return g
}

function makeItemTechBench(): PixelGrid {
  const g = makeGrid(16, 16)
  const metal = 0x4488aa
  const dark = darken(metal, 0.25)
  const hi = lighten(metal, 0.2)
  // Table surface
  for (let x = 1; x <= 14; x++) { g[6]![x] = hi; g[7]![x] = metal }
  // Legs
  for (let y = 8; y <= 13; y++) { g[y]![2] = dark; g[y]![13] = dark }
  // Screen on top
  for (let y = 2; y <= 5; y++)
    for (let x = 4; x <= 11; x++)
      g[y]![x] = 0x113344
  // Screen content
  g[3]![5] = 0x00ff88; g[3]![6] = 0x00ff88; g[3]![7] = 0x00ff88
  g[4]![5] = 0x00ff88; g[4]![8] = 0x00ff88
  // Screen frame
  for (let x = 4; x <= 11; x++) { g[1]![x] = dark; g[5]![x] = dark }
  g[2]![4] = dark; g[2]![11] = dark; g[3]![4] = dark; g[3]![11] = dark; g[4]![4] = dark; g[4]![11] = dark
  return g
}

function makeItemFusionStation(): PixelGrid {
  const g = makeGrid(16, 16)
  const base = 0x8844cc
  const hi = lighten(base, 0.3)
  const sh = darken(base, 0.2)
  // Platform
  for (let x = 1; x <= 14; x++) { g[8]![x] = base; g[9]![x] = sh }
  // Legs
  for (let y = 10; y <= 13; y++) { g[y]![2] = sh; g[y]![3] = sh; g[y]![12] = sh; g[y]![13] = sh }
  // Energy ring on top
  for (let x = 4; x <= 11; x++) { g[4]![x] = hi; g[7]![x] = hi }
  for (let y = 4; y <= 7; y++) { g[y]![4] = hi; g[y]![11] = hi }
  // Core glow
  g[5]![7] = 0xffffff; g[5]![8] = 0xffffff
  g[6]![7] = 0xffffff; g[6]![8] = 0xffffff
  // Energy particles
  g[2]![7] = 0xff88ff; g[3]![6] = 0xaa66ff; g[3]![9] = 0xaa66ff
  return g
}

function makePickaxe(headColor: number, handleColor: number): PixelGrid {
  const g = makeGrid(16, 16)
  const hi = lighten(headColor, 0.2)
  const sh = darken(headColor, 0.2)
  // Handle (diagonal from bottom-left to upper-center)
  for (let i = 0; i < 8; i++) {
    const x = 3 + i
    const y = 14 - i
    g[y]![x] = handleColor
    if (y + 1 < 16) g[y + 1]![x] = darken(handleColor, 0.15)
  }
  // Curved pick head going right and down from top of handle
  // Upper curve (right side)
  g[5]![11] = headColor; g[4]![12] = headColor; g[3]![13] = hi
  g[3]![14] = hi; g[4]![14] = headColor; g[5]![14] = sh
  // Pick point (sharp tip going down-right)
  g[5]![15] = headColor; g[6]![15] = sh
  // Left curve (shorter claw side)
  g[7]![9] = headColor; g[8]![8] = headColor; g[9]![7] = sh
  // Connection at handle top
  g[6]![10] = headColor; g[6]![11] = headColor
  g[5]![10] = hi; g[7]![10] = sh
  return g
}

function makeItemWoodPickaxe(): PixelGrid { return makePickaxe(0x8b6b3a, 0x6b4226) }
function makeItemStonePickaxe(): PixelGrid { return makePickaxe(0x999999, 0x6b4226) }
function makeItemIronPickaxe(): PixelGrid { return makePickaxe(0xc9a96e, 0x6b4226) }
function makeItemDiamondPickaxe(): PixelGrid { return makePickaxe(0x7fffff, 0x6b4226) }
function makeItemTitaniumPickaxe(): PixelGrid { return makePickaxe(0xe8e8e8, 0x6b4226) }

function makeSword(bladeColor: number, handleColor: number): PixelGrid {
  const g = makeGrid(16, 16)
  const hi = lighten(bladeColor, 0.25)
  const sh = darken(bladeColor, 0.2)
  // Blade (diagonal from top-right to center)
  for (let i = 0; i < 9; i++) {
    const x = 12 - i
    const y = 1 + i
    g[y]![x] = bladeColor
    if (x + 1 < 16) g[y]![x + 1] = hi
    if (x - 1 >= 0) g[y + 1]![x] = sh
  }
  // Tip
  g[0]![13] = hi; g[0]![12] = bladeColor
  // Guard (crossbar)
  for (let x = 2; x <= 8; x++) g[10]![x] = 0x888888
  g[10]![5] = 0xaaaa44
  // Handle
  for (let i = 0; i < 4; i++) {
    g[11 + i]![3 - i] = handleColor
    if (3 - i + 1 < 16) g[11 + i]![4 - i] = darken(handleColor, 0.15)
  }
  // Pommel
  g[14]![0] = 0xaaaa44
  return g
}

function makeItemWoodSword(): PixelGrid { return makeSword(0x8b6b3a, 0x5a3a20) }
function makeItemStoneSword(): PixelGrid { return makeSword(0x999999, 0x6b4226) }
function makeItemIronSword(): PixelGrid { return makeSword(0xc9a96e, 0x6b4226) }
function makeItemDiamondSword(): PixelGrid { return makeSword(0x7fffff, 0x6b4226) }
function makeItemTitaniumSword(): PixelGrid { return makeSword(0xe8e8e8, 0x6b4226) }

function makeBow(bodyColor: number): PixelGrid {
  const g = makeGrid(16, 16)
  const sh = darken(bodyColor, 0.2)
  // Bow arc (curved left side)
  g[1]![4] = bodyColor; g[2]![3] = bodyColor; g[3]![2] = bodyColor
  g[4]![2] = bodyColor; g[5]![2] = bodyColor; g[6]![2] = bodyColor
  g[7]![2] = bodyColor; g[8]![3] = sh
  g[9]![3] = sh; g[10]![3] = sh; g[11]![4] = sh
  g[12]![4] = sh; g[13]![5] = sh; g[14]![6] = sh
  // String (straight right side)
  for (let y = 1; y <= 14; y++) g[y]![9] = 0xcccccc
  // Arrow
  g[7]![9] = 0x8b6b3a; g[7]![10] = 0x8b6b3a; g[7]![11] = 0x8b6b3a
  g[7]![12] = 0x8b6b3a; g[7]![13] = 0xcccccc
  // Arrow tip
  g[6]![14] = 0xaaaaaa; g[7]![14] = 0xaaaaaa; g[7]![15] = 0xcccccc; g[8]![14] = 0xaaaaaa
  // Arrow fletching
  g[6]![9] = 0xff4444; g[8]![9] = 0xff4444
  return g
}

function makeItemWoodBow(): PixelGrid { return makeBow(0x8b6b3a) }
function makeItemIronBow(): PixelGrid { return makeBow(0xc9a96e) }

function makeItemLaserGun(): PixelGrid {
  const g = makeGrid(16, 16)
  const body = 0xaa2222
  const metal = 0x888888
  const hi = lighten(body, 0.2)
  const sh = darken(body, 0.25)
  // Gun body
  for (let y = 5; y <= 9; y++)
    for (let x = 2; x <= 13; x++)
      g[y]![x] = body
  // Barrel
  for (let x = 12; x <= 15; x++) { g[6]![x] = metal; g[7]![x] = metal; g[8]![x] = metal }
  // Barrel opening glow
  g[7]![15] = 0xff4444
  // Handle/grip
  for (let y = 10; y <= 14; y++) { g[y]![4] = sh; g[y]![5] = body; g[y]![6] = sh }
  // Trigger
  g[10]![7] = metal; g[11]![7] = metal
  // Top detail
  g[4]![5] = metal; g[4]![6] = metal; g[4]![7] = metal
  // Highlight
  g[5]![4] = hi; g[5]![5] = hi
  // Scope
  g[3]![8] = metal; g[3]![9] = metal; g[4]![8] = 0xff0000; g[4]![9] = metal
  return g
}

function makeStaff(orbColor: number, shaftColor: number): PixelGrid {
  const g = makeGrid(16, 16)
  const orbHi = lighten(orbColor, 0.3)
  // Shaft (diagonal)
  for (let i = 0; i < 12; i++) {
    const x = 4 + Math.floor(i * 0.5)
    const y = 3 + i
    if (y < 16 && x < 16) g[y]![x] = shaftColor
  }
  // Orb at top
  for (let y = 0; y <= 4; y++)
    for (let x = 5; x <= 9; x++) {
      const dx = x - 7, dy = y - 2
      if (dx * dx + dy * dy <= 5) g[y]![x] = orbColor
    }
  // Orb highlight
  g[1]![6] = orbHi; g[1]![7] = 0xffffff; g[2]![6] = orbHi
  // Orb glow
  g[0]![7] = lighten(orbColor, 0.15); g[2]![9] = lighten(orbColor, 0.15)
  return g
}

function makeItemApprenticeStaff(): PixelGrid { return makeStaff(0x6644cc, 0x8b6b3a) }
function makeItemCrystalStaff(): PixelGrid { return makeStaff(0xaa66ff, 0x666688) }

function makeItemDroneTotem(): PixelGrid {
  const g = makeGrid(16, 16)
  const base = 0x44aa88
  const hi = lighten(base, 0.25)
  const sh = darken(base, 0.2)
  // Totem pole
  for (let y = 2; y <= 14; y++)
    for (let x = 5; x <= 10; x++)
      g[y]![x] = base
  // Face segments
  for (let x = 5; x <= 10; x++) { g[4]![x] = sh; g[8]![x] = sh; g[12]![x] = sh }
  // Eyes
  g[3]![6] = 0xffffff; g[3]![9] = 0xffffff
  g[6]![6] = 0x00ffaa; g[6]![9] = 0x00ffaa
  g[10]![6] = 0xffffff; g[10]![9] = 0xffffff
  // Wings/arms
  g[5]![3] = sh; g[5]![4] = sh; g[5]![11] = sh; g[5]![12] = sh
  g[9]![3] = sh; g[9]![4] = sh; g[9]![11] = sh; g[9]![12] = sh
  // Top
  g[1]![7] = hi; g[1]![8] = hi; g[0]![7] = 0x00ffaa
  return g
}

function makeItemSwarmBeacon(): PixelGrid {
  const g = makeGrid(16, 16)
  const base = 0x88ffcc
  const sh = darken(base, 0.2)
  // Beacon body
  for (let y = 5; y <= 13; y++)
    for (let x = 5; x <= 10; x++)
      g[y]![x] = base
  // Tapered top
  for (let x = 6; x <= 9; x++) g[4]![x] = base
  for (let x = 7; x <= 8; x++) g[3]![x] = base
  // Base wider
  for (let x = 3; x <= 12; x++) { g[13]![x] = sh; g[14]![x] = sh }
  // Glow on top
  g[2]![7] = 0xffffff; g[2]![8] = 0xffffff
  g[1]![7] = 0xaaffdd; g[1]![8] = 0xaaffdd
  g[0]![7] = 0x88ffcc
  // Energy lines
  g[7]![5] = 0xffffff; g[9]![10] = 0xffffff; g[11]![6] = 0xffffff
  return g
}

function makeItemVineBeacon(): PixelGrid {
  const g = makeGrid(16, 16)
  const base = 0x44cc44
  const dark = darken(base, 0.25)
  const hi = lighten(base, 0.2)
  // Beacon body
  for (let y = 5; y <= 13; y++)
    for (let x = 5; x <= 10; x++)
      g[y]![x] = base
  for (let x = 6; x <= 9; x++) g[4]![x] = base
  for (let x = 7; x <= 8; x++) g[3]![x] = hi
  // Base
  for (let x = 4; x <= 11; x++) { g[13]![x] = dark; g[14]![x] = dark }
  // Vine wrapping around
  g[6]![4] = dark; g[7]![4] = dark; g[8]![5] = dark
  g[9]![11] = dark; g[10]![11] = dark; g[11]![10] = dark
  // Top glow
  g[2]![7] = 0x88ff88; g[2]![8] = 0x88ff88
  g[1]![7] = 0xaaffaa; g[1]![8] = 0xaaffaa
  return g
}

function makeItemSignalBeacon(): PixelGrid {
  const g = makeGrid(16, 16)
  const base = 0xff44ff
  const sh = darken(base, 0.2)
  const hi = lighten(base, 0.3)
  // Beacon body
  for (let y = 5; y <= 13; y++)
    for (let x = 5; x <= 10; x++)
      g[y]![x] = base
  for (let x = 6; x <= 9; x++) g[4]![x] = base
  for (let x = 7; x <= 8; x++) g[3]![x] = hi
  // Base
  for (let x = 3; x <= 12; x++) { g[13]![x] = sh; g[14]![x] = sh }
  // Signal waves
  g[1]![5] = 0xff88ff; g[1]![10] = 0xff88ff
  g[0]![4] = 0xffaaff; g[0]![11] = 0xffaaff
  g[2]![7] = 0xffffff; g[2]![8] = 0xffffff
  // Antenna
  g[2]![7] = hi; g[1]![7] = 0xffffff; g[0]![7] = 0xffffff
  return g
}

function makeItemTidalPearl(): PixelGrid {
  const g = makeGrid(16, 16)
  const base = 0x2288cc
  const hi = lighten(base, 0.35)
  const sh = darken(base, 0.2)
  // Pearl sphere
  for (let y = 3; y <= 12; y++)
    for (let x = 4; x <= 11; x++) {
      const dx = x - 7.5, dy = y - 7.5
      if (dx * dx + dy * dy <= 18) g[y]![x] = base
    }
  // Highlight
  g[4]![6] = hi; g[4]![7] = hi; g[5]![5] = hi; g[5]![6] = 0xffffff
  // Shadow bottom
  g[11]![7] = sh; g[11]![8] = sh; g[10]![9] = sh
  // Water droplets
  g[1]![5] = 0x44aaee; g[2]![10] = 0x44aaee; g[13]![7] = 0x44aaee
  // Inner glow
  g[7]![7] = 0x66ccff; g[7]![8] = 0x66ccff
  return g
}

function makeItemCrystalLens(): PixelGrid {
  const g = makeGrid(16, 16)
  const base = 0x66ddff
  const hi = lighten(base, 0.3)
  const sh = darken(base, 0.25)
  // Hexagonal lens shape
  for (let x = 5; x <= 10; x++) g[3]![x] = base
  for (let x = 4; x <= 11; x++) g[4]![x] = base
  for (let y = 5; y <= 10; y++)
    for (let x = 3; x <= 12; x++)
      g[y]![x] = base
  for (let x = 4; x <= 11; x++) g[11]![x] = base
  for (let x = 5; x <= 10; x++) g[12]![x] = base
  // Facets
  g[5]![5] = hi; g[6]![6] = hi; g[5]![6] = 0xffffff
  g[9]![9] = sh; g[10]![10] = sh
  // Light refraction lines
  g[7]![4] = 0xffffff; g[7]![11] = 0xaaeeff
  g[8]![5] = 0xeeffff; g[6]![10] = 0xeeffff
  return g
}

function makeItemMagmaCore(): PixelGrid {
  const g = makeGrid(16, 16)
  const base = 0xff4400
  const hot = 0xffaa00
  const sh = darken(base, 0.3)
  // Core sphere
  for (let y = 3; y <= 12; y++)
    for (let x = 4; x <= 11; x++) {
      const dx = x - 7.5, dy = y - 7.5
      if (dx * dx + dy * dy <= 18) g[y]![x] = base
    }
  // Molten center
  for (let y = 6; y <= 9; y++)
    for (let x = 6; x <= 9; x++)
      g[y]![x] = hot
  g[7]![7] = 0xffff44; g[7]![8] = 0xffff44; g[8]![7] = 0xffdd22
  // Cracks
  g[4]![6] = hot; g[5]![5] = hot; g[10]![9] = hot; g[11]![10] = hot
  g[5]![10] = hot; g[9]![5] = hot
  // Outer glow
  g[2]![7] = 0xff6622; g[13]![8] = 0xff6622; g[7]![3] = 0xff6622; g[7]![12] = 0xff6622
  // Dark edges
  g[3]![5] = sh; g[12]![10] = sh
  return g
}

function makeItemVoidSigil(): PixelGrid {
  const g = makeGrid(16, 16)
  const base = 0xaa22ff
  const hi = lighten(base, 0.3)
  const sh = darken(base, 0.3)
  // Diamond/rhombus sigil shape
  for (let i = 0; i <= 6; i++) {
    g[1 + i]![7 - i] = base; g[1 + i]![8 + i] = base
    g[14 - i]![7 - i] = base; g[14 - i]![8 + i] = base
  }
  // Fill inner
  for (let y = 4; y <= 11; y++)
    for (let x = 5; x <= 10; x++)
      g[y]![x] = sh
  // Center eye
  g[7]![7] = 0xff44ff; g[7]![8] = 0xff44ff
  g[6]![7] = hi; g[8]![8] = hi
  g[7]![6] = 0x6600aa; g[7]![9] = 0x6600aa
  // Corner runes
  g[3]![5] = 0xcc88ff; g[3]![10] = 0xcc88ff
  g[12]![5] = 0xcc88ff; g[12]![10] = 0xcc88ff
  // Void particles
  g[1]![7] = 0xdd66ff; g[14]![8] = 0xdd66ff
  g[7]![2] = 0xdd66ff; g[8]![13] = 0xdd66ff
  return g
}

function makeItemFuelCellCasing(): PixelGrid {
  const g = makeGrid(16, 16)
  const base = 0xddaa33
  const sh = darken(base, 0.2)
  const hi = lighten(base, 0.2)
  // Cylinder shape
  for (let y = 3; y <= 12; y++)
    for (let x = 4; x <= 11; x++)
      g[y]![x] = base
  // Top cap
  for (let x = 5; x <= 10; x++) g[2]![x] = hi
  // Bottom cap
  for (let x = 4; x <= 11; x++) g[13]![x] = sh
  // Side shading
  for (let y = 3; y <= 12; y++) { g[y]![4] = sh; g[y]![11] = sh }
  // Highlight stripe
  for (let y = 4; y <= 11; y++) g[y]![6] = hi
  // Label/detail
  g[7]![7] = 0xff8800; g[7]![8] = 0xff8800; g[8]![7] = 0xff8800; g[8]![8] = 0xff8800
  return g
}

function makeItemThrustRegulator(): PixelGrid {
  const g = makeGrid(16, 16)
  const metal = 0xbbbbbb
  const dark = darken(metal, 0.25)
  const hi = lighten(metal, 0.15)
  // Main body (box shape)
  for (let y = 4; y <= 11; y++)
    for (let x = 3; x <= 12; x++)
      g[y]![x] = metal
  // Edges
  for (let x = 3; x <= 12; x++) { g[3]![x] = hi; g[12]![x] = dark }
  for (let y = 4; y <= 11; y++) { g[y]![3] = dark; g[y]![12] = dark }
  // Vents/fins
  for (let x = 4; x <= 11; x += 2) { g[5]![x] = dark; g[9]![x] = dark }
  // Center dial
  g[7]![7] = 0xff4444; g[7]![8] = 0xff4444
  g[6]![7] = hi; g[6]![8] = hi
  return g
}

function makeItemPressureValve(): PixelGrid {
  const g = makeGrid(16, 16)
  const base = 0x5599cc
  const sh = darken(base, 0.2)
  const hi = lighten(base, 0.2)
  // Valve body (circular)
  for (let y = 4; y <= 11; y++)
    for (let x = 4; x <= 11; x++) {
      const dx = x - 7.5, dy = y - 7.5
      if (dx * dx + dy * dy <= 16) g[y]![x] = base
    }
  // Handle on top
  for (let x = 6; x <= 9; x++) g[2]![x] = 0x888888
  g[3]![6] = 0x888888; g[3]![9] = 0x888888
  g[3]![7] = sh; g[3]![8] = sh
  // Pipe connections
  for (let x = 1; x <= 3; x++) { g[7]![x] = sh; g[8]![x] = sh }
  for (let x = 12; x <= 14; x++) { g[7]![x] = sh; g[8]![x] = sh }
  // Center bolt
  g[7]![7] = hi; g[7]![8] = hi; g[8]![7] = hi; g[8]![8] = 0xffffff
  return g
}

function makeItemEnergyCapacitor(): PixelGrid {
  const g = makeGrid(16, 16)
  const base = 0xcc66ff
  const sh = darken(base, 0.25)
  const hi = lighten(base, 0.25)
  // Capacitor body
  for (let y = 4; y <= 12; y++)
    for (let x = 4; x <= 11; x++)
      g[y]![x] = base
  // Top terminals
  g[2]![5] = 0x888888; g[2]![6] = 0x888888; g[3]![5] = 0x888888; g[3]![6] = 0x888888
  g[2]![9] = 0x888888; g[2]![10] = 0x888888; g[3]![9] = 0x888888; g[3]![10] = 0x888888
  // Energy glow inside
  for (let y = 6; y <= 10; y++) { g[y]![6] = hi; g[y]![9] = hi }
  g[8]![7] = 0xffffff; g[8]![8] = 0xffffff
  // Edges
  for (let y = 4; y <= 12; y++) { g[y]![4] = sh; g[y]![11] = sh }
  for (let x = 4; x <= 11; x++) g[12]![x] = sh
  // Lightning bolt symbol
  g[6]![7] = 0xffffff; g[7]![8] = 0xffffff; g[7]![7] = 0xffffff; g[8]![7] = hi
  return g
}

function makeItemIgnitionCore(): PixelGrid {
  const g = makeGrid(16, 16)
  const base = 0xff6600
  const hi = 0xffaa00
  const sh = darken(base, 0.25)
  // Spherical core
  for (let y = 3; y <= 12; y++)
    for (let x = 3; x <= 12; x++) {
      const dx = x - 7.5, dy = y - 7.5
      if (dx * dx + dy * dy <= 20) g[y]![x] = base
    }
  // Inner glow
  for (let y = 5; y <= 10; y++)
    for (let x = 5; x <= 10; x++) {
      const dx = x - 7.5, dy = y - 7.5
      if (dx * dx + dy * dy <= 8) g[y]![x] = hi
    }
  // Core center
  g[7]![7] = 0xffffff; g[7]![8] = 0xffffff; g[8]![7] = 0xffffff; g[8]![8] = 0xffdd44
  // Heat radiation
  g[1]![7] = 0xff8800; g[14]![7] = 0xff4400; g[7]![1] = 0xff8800; g[7]![14] = 0xff4400
  g[2]![4] = 0xff6600; g[2]![11] = 0xff6600; g[13]![4] = 0xff4400; g[13]![11] = 0xff4400
  return g
}

function makeItemNavigationModule(): PixelGrid {
  const g = makeGrid(16, 16)
  const board = 0x115533
  const trace = 0x00ffaa
  const chip = 0x333333
  // Circuit board
  for (let y = 3; y <= 12; y++)
    for (let x = 2; x <= 13; x++)
      g[y]![x] = board
  // Frame
  for (let x = 2; x <= 13; x++) { g[3]![x] = 0x228855; g[12]![x] = 0x228855 }
  for (let y = 3; y <= 12; y++) { g[y]![2] = 0x228855; g[y]![13] = 0x228855 }
  // Traces
  for (let x = 4; x <= 11; x++) g[5]![x] = trace
  for (let x = 4; x <= 11; x++) g[9]![x] = trace
  for (let y = 5; y <= 9; y++) { g[y]![4] = trace; g[y]![11] = trace }
  // Central chip
  for (let y = 6; y <= 8; y++)
    for (let x = 6; x <= 9; x++)
      g[y]![x] = chip
  // Chip detail
  g[7]![7] = trace; g[7]![8] = trace
  // Pin connectors
  g[6]![5] = trace; g[8]![5] = trace; g[6]![10] = trace; g[8]![10] = trace
  return g
}

function makeItemJetpack(): PixelGrid {
  const g = makeGrid(16, 16)
  const body = 0xddaa00
  const dark = darken(body, 0.25)
  const hi = lighten(body, 0.2)
  const metal = 0x888888
  // Main body (two tanks)
  for (let y = 2; y <= 10; y++) {
    for (let x = 2; x <= 6; x++) g[y]![x] = body
    for (let x = 9; x <= 13; x++) g[y]![x] = body
  }
  // Strap bridge
  for (let x = 6; x <= 9; x++) { g[4]![x] = metal; g[5]![x] = metal }
  // Tank highlights
  for (let y = 3; y <= 9; y++) { g[y]![3] = hi; g[y]![10] = hi }
  // Tank shadows
  for (let y = 2; y <= 10; y++) { g[y]![6] = dark; g[y]![13] = dark }
  // Nozzles
  for (let x = 3; x <= 5; x++) { g[11]![x] = metal; g[12]![x] = dark }
  for (let x = 10; x <= 12; x++) { g[11]![x] = metal; g[12]![x] = dark }
  // Flame
  g[13]![4] = 0xff6600; g[14]![4] = 0xffaa00; g[15]![4] = 0xffcc44
  g[13]![11] = 0xff6600; g[14]![11] = 0xffaa00; g[15]![11] = 0xffcc44
  // Caps
  for (let x = 3; x <= 5; x++) g[1]![x] = hi
  for (let x = 10; x <= 12; x++) g[1]![x] = hi
  return g
}

function makeItemHealingHerb(): PixelGrid {
  const g = makeGrid(16, 16)
  const leaf = 0x33cc33
  const hi = lighten(leaf, 0.25)
  const stem = 0x227722
  // Stem
  for (let y = 7; y <= 14; y++) g[y]![7] = stem
  g[14]![8] = stem
  // Leaves
  g[5]![6] = leaf; g[5]![7] = leaf; g[5]![8] = leaf
  g[4]![5] = leaf; g[4]![6] = hi; g[4]![7] = leaf; g[4]![8] = leaf; g[4]![9] = leaf
  g[3]![5] = leaf; g[3]![6] = hi; g[3]![7] = hi; g[3]![8] = leaf; g[3]![9] = leaf
  g[2]![6] = leaf; g[2]![7] = hi; g[2]![8] = leaf
  // Side leaves
  g[7]![5] = leaf; g[7]![4] = leaf; g[6]![4] = hi
  g[9]![8] = leaf; g[9]![9] = leaf; g[8]![9] = hi
  // Sparkle (healing)
  g[1]![7] = 0xaaffaa; g[3]![10] = 0x88ff88
  return g
}

function makeItemCookedMeat(): PixelGrid {
  const g = makeGrid(16, 16)
  const meat = 0xcc6633
  const hi = lighten(meat, 0.2)
  const sh = darken(meat, 0.25)
  const bone = 0xeeeecc
  // Drumstick meat (oval)
  for (let y = 3; y <= 10; y++)
    for (let x = 3; x <= 12; x++) {
      const dx = (x - 7.5) / 5, dy = (y - 6.5) / 4
      if (dx * dx + dy * dy <= 1) g[y]![x] = meat
    }
  // Shading
  for (let y = 3; y <= 10; y++) {
    if (g[y]![3]) g[y]![3] = sh
    if (g[y]![12]) g[y]![12] = sh
  }
  for (let x = 3; x <= 12; x++) { if (g[10]![x]) g[10]![x] = sh }
  // Highlight (grilled marks)
  g[5]![5] = hi; g[5]![8] = hi; g[7]![6] = hi; g[7]![9] = hi
  // Bone sticking out
  g[9]![11] = bone; g[10]![12] = bone; g[11]![13] = bone; g[12]![14] = bone; g[13]![14] = bone
  g[11]![14] = bone; g[12]![13] = darken(0xeeeecc, 0.1)
  return g
}

// ─── ARMOR ────────────────────────────────────────────────

function makeHelmet(color: number): PixelGrid {
  const g = makeGrid(16, 16)
  const sh = darken(color, 0.2)
  const hi = lighten(color, 0.2)
  // Dome shape
  for (let x = 4; x <= 11; x++) g[4]![x] = color
  for (let x = 3; x <= 12; x++) g[5]![x] = color
  for (let y = 6; y <= 11; y++)
    for (let x = 3; x <= 12; x++)
      g[y]![x] = color
  // Top curve
  for (let x = 5; x <= 10; x++) g[3]![x] = color
  for (let x = 6; x <= 9; x++) g[2]![x] = color
  // Visor
  for (let x = 4; x <= 11; x++) g[9]![x] = sh
  for (let x = 5; x <= 10; x++) g[10]![x] = sh
  // Brim
  for (let x = 2; x <= 13; x++) g[12]![x] = sh
  // Highlight
  g[3]![6] = hi; g[3]![7] = hi; g[4]![5] = hi
  // Side shading
  for (let y = 5; y <= 11; y++) { g[y]![3] = sh; g[y]![12] = sh }
  return g
}

function makeChestplate(color: number): PixelGrid {
  const g = makeGrid(16, 16)
  const sh = darken(color, 0.2)
  const hi = lighten(color, 0.2)
  // Body
  for (let y = 2; y <= 12; y++)
    for (let x = 3; x <= 12; x++)
      g[y]![x] = color
  // Shoulders
  for (let x = 1; x <= 3; x++) { g[2]![x] = color; g[3]![x] = color }
  for (let x = 12; x <= 14; x++) { g[2]![x] = color; g[3]![x] = color }
  // Neckline
  for (let x = 6; x <= 9; x++) g[1]![x] = color
  g[2]![5] = sh; g[2]![10] = sh
  // Center line
  for (let y = 3; y <= 12; y++) g[y]![7] = sh
  // Highlight
  g[4]![5] = hi; g[5]![5] = hi; g[4]![6] = hi
  // Bottom edge
  for (let x = 4; x <= 11; x++) g[13]![x] = sh
  // Side shading
  for (let y = 2; y <= 12; y++) { g[y]![3] = sh; g[y]![12] = sh }
  return g
}

function makeLeggings(color: number): PixelGrid {
  const g = makeGrid(16, 16)
  const sh = darken(color, 0.2)
  const hi = lighten(color, 0.15)
  // Waistband
  for (let x = 3; x <= 12; x++) { g[1]![x] = sh; g[2]![x] = color }
  // Left leg
  for (let y = 3; y <= 13; y++)
    for (let x = 3; x <= 7; x++)
      g[y]![x] = color
  // Right leg
  for (let y = 3; y <= 13; y++)
    for (let x = 8; x <= 12; x++)
      g[y]![x] = color
  // Gap between legs
  for (let y = 7; y <= 13; y++) g[y]![7] = null
  for (let y = 8; y <= 13; y++) g[y]![8] = null
  // Cuffs
  for (let x = 3; x <= 6; x++) g[14]![x] = sh
  for (let x = 9; x <= 12; x++) g[14]![x] = sh
  // Highlight
  g[4]![5] = hi; g[4]![10] = hi
  // Side shading
  for (let y = 3; y <= 13; y++) { g[y]![3] = sh; g[y]![12] = sh }
  return g
}

function makeBoots(color: number): PixelGrid {
  const g = makeGrid(16, 16)
  const sh = darken(color, 0.25)
  const hi = lighten(color, 0.2)
  const sole = darken(color, 0.4)
  // Left boot shaft
  for (let y = 3; y <= 10; y++)
    for (let x = 1; x <= 5; x++)
      g[y]![x] = color
  // Left boot toe
  for (let x = 1; x <= 6; x++) g[11]![x] = color
  for (let x = 1; x <= 6; x++) g[12]![x] = sh
  // Left sole
  for (let x = 0; x <= 7; x++) g[13]![x] = sole
  // Right boot shaft
  for (let y = 3; y <= 10; y++)
    for (let x = 10; x <= 14; x++)
      g[y]![x] = color
  // Right boot toe
  for (let x = 9; x <= 14; x++) g[11]![x] = color
  for (let x = 9; x <= 14; x++) g[12]![x] = sh
  // Right sole
  for (let x = 8; x <= 15; x++) g[13]![x] = sole
  // Cuff tops
  for (let x = 1; x <= 5; x++) g[3]![x] = hi
  for (let x = 10; x <= 14; x++) g[3]![x] = hi
  // Highlights
  g[5]![2] = hi; g[5]![11] = hi
  return g
}

// ─── PUBLIC API ────────────────────────────────────────────

export function generateAllSprites(scene: Phaser.Scene) {
  // Tiles
  const tileMakers: Record<number, () => PixelGrid> = {
    [TileType.GRASS]: makeTileGrass,
    [TileType.DIRT]: makeTileDirt,
    [TileType.STONE]: makeTileStone,
    [TileType.WOOD]: makeTileWood,
    [TileType.LEAVES]: makeTileLeaves,
    [TileType.IRON_ORE]: makeTileIronOre,
    [TileType.DIAMOND_ORE]: makeTileDiamondOre,
    [TileType.TITANIUM_ORE]: makeTileTitaniumOre,
    [TileType.SAND]: makeTileSand,
    [TileType.CORAL]: makeTileCoral,
    [TileType.CARBON_FIBER]: makeTileCarbonFiber,
    [TileType.LAVA]: makeTileLava,
    [TileType.WATER]: makeTileWater,
    [TileType.SNOW]: makeTileSnow,
    [TileType.ICE]: makeTileIce,
    [TileType.CLAY]: makeTileClay,
    [TileType.OBSIDIAN]: makeTileObsidian,
    [TileType.CRYSTAL]: makeTileCrystal,
    [TileType.MOSS]: makeTileMoss,
    [TileType.MUSHROOM_BLOCK]: makeTileMushroomBlock,
    [TileType.SANDSTONE]: makeTileSandstone,
    [TileType.CACTUS]: makeTileCactus,
    [TileType.JUNGLE_GRASS]: makeTileJungleGrass,
    [TileType.FROZEN_STONE]: makeTileFrozenStone,
    [TileType.CRYSTAL_EMBER]: makeTileCrystalEmber,
    [TileType.CRYSTAL_FROST]: makeTileCrystalFrost,
    [TileType.CRYSTAL_STORM]: makeTileCrystalStorm,
    [TileType.CRYSTAL_VOID]: makeTileCrystalVoid,
    [TileType.CRYSTAL_LIFE]: makeTileCrystalLife,
    [TileType.VINE]: makeTileVine,
    [TileType.SEAWEED]: makeTileSeaweed,
    [TileType.CLOUD_BLOCK]: makeTileCloudBlock,
    [TileType.CLOUD_BRICK]: makeTileCloudBrick,
    [TileType.CLOUD_PILLAR]: makeTileCloudPillar,
    [TileType.STATION_WORKBENCH]: makeTileStationWorkbench,
    [TileType.STATION_FURNACE]: makeTileStationFurnace,
    [TileType.STATION_ANVIL]: makeTileStationAnvil,
    [TileType.STATION_TECH_BENCH]: makeTileStationTechBench,
    [TileType.STATION_FUSION]: makeTileStationFusion,
    [TileType.STATION_WORKBENCH_MK2]: makeTileStationWorkbenchMk2,
    [TileType.STATION_ARCANE_ANVIL]: makeTileStationArcaneAnvil,
  }

  for (const [type, maker] of Object.entries(tileMakers)) {
    drawToTexture(scene, `tile_${type}`, maker())
  }

  // Player frames
  const playerFrames: [string, Parameters<typeof makePlayerFrame>[0]][] = [
    ['player_idle1', 'idle1'],
    ['player_idle2', 'idle2'],
    ['player_walk1', 'walk1'],
    ['player_walk2', 'walk2'],
    ['player_walk3', 'walk3'],
    ['player_walk4', 'walk4'],
  ]
  for (const [key, frame] of playerFrames) {
    drawToTexture(scene, key, makePlayerFrame(frame))
  }

  // Enemies
  drawToTexture(scene, 'enemy_space_slug', makeEnemySlug())
  drawToTexture(scene, 'enemy_cave_bat', makeEnemyBat())
  drawToTexture(scene, 'enemy_rock_golem', makeEnemyGolem())
  drawToTexture(scene, 'enemy_anglerfish', makeEnemyAnglerfish())
  drawToTexture(scene, 'enemy_fish', makeEnemyFish())
  drawToTexture(scene, 'enemy_lava_serpent', makeEnemySerpent())
  drawToTexture(scene, 'enemy_corrupted_drone', makeEnemyDrone())
  drawToTexture(scene, 'enemy_vampire', makeEnemyVampire())
  drawToTexture(scene, 'enemy_fungal_shambler', makeEnemyFungalShambler())
  drawToTexture(scene, 'enemy_sporeling', makeEnemySporeling())
  drawToTexture(scene, 'enemy_phantom_wraith', makeEnemyPhantomWraith())
  drawToTexture(scene, 'enemy_mimic', makeEnemyMimic())
  drawToTexture(scene, 'enemy_gloom_moth', makeEnemyGloomMoth())
  drawToTexture(scene, 'enemy_shock_beetle', makeEnemyShockBeetle())
  drawToTexture(scene, 'enemy_frost_wolf', makeEnemyFrostWolf())
  drawToTexture(scene, 'enemy_ice_wisp', makeEnemyIceWisp())
  drawToTexture(scene, 'enemy_sand_scorpion', makeEnemySandScorpion())
  drawToTexture(scene, 'enemy_dust_devil', makeEnemyDustDevil())
  drawToTexture(scene, 'enemy_jungle_spider', makeEnemyJungleSpider())
  drawToTexture(scene, 'enemy_vine_strangler', makeEnemyVineStrangler())
  drawToTexture(scene, 'enemy_mountain_hawk', makeEnemyMountainHawk())

  // Bosses
  drawToTexture(scene, 'boss_vine_guardian', makeBossVineGuardian())
  drawToTexture(scene, 'boss_deep_sea_leviathan', makeBossLeviathan())
  drawToTexture(scene, 'boss_crystal_golem', makeBossCrystalGolem())
  drawToTexture(scene, 'boss_magma_wyrm', makeBossMagmaWyrm())
  drawToTexture(scene, 'boss_core_sentinel', makeBossCoreSentinel())
  drawToTexture(scene, 'boss_mothership', makeBossMothership())

  // Projectiles
  drawToTexture(scene, 'proj_arrow', makeProjectileArrow())
  drawToTexture(scene, 'proj_magic', makeProjectileMagic())
  drawToTexture(scene, 'proj_enemy', makeProjectileEnemy())
  drawToTexture(scene, 'summon_minion', makeSummonMinion())

  // NPC
  drawToTexture(scene, 'npc_shopkeeper', makeNPCShopkeeper())

  // Item icons (for hotbar/inventory display)
  const itemMakers: Record<number, () => PixelGrid> = {
    100: makeItemIronBar,
    101: makeItemDiamond,
    102: makeItemTitaniumBar,
    103: makeItemCarbonPlate,
    104: makeItemGlass,
    105: makeItemPlantFiber,
    106: makeItemTorch,
    110: makeItemWorkbench,
    111: makeItemFurnace,
    112: makeItemAnvil,
    113: makeItemTechBench,
    114: makeItemFusionStation,
    115: makeItemWorkbenchMk2,
    120: makeItemWoodPickaxe,
    121: makeItemStonePickaxe,
    122: makeItemIronPickaxe,
    123: makeItemDiamondPickaxe,
    124: makeItemTitaniumPickaxe,
    130: makeItemWoodSword,
    131: makeItemStoneSword,
    132: makeItemIronSword,
    133: makeItemDiamondSword,
    134: makeItemTitaniumSword,
    140: makeItemWoodBow,
    141: makeItemIronBow,
    142: makeItemLaserGun,
    150: makeItemApprenticeStaff,
    151: makeItemCrystalStaff,
    160: makeItemDroneTotem,
    161: makeItemSwarmBeacon,
    170: makeItemVineBeacon,
    171: makeItemTidalPearl,
    172: makeItemCrystalLens,
    173: makeItemMagmaCore,
    174: makeItemVoidSigil,
    175: makeItemSignalBeacon,
    180: makeItemFuelCellCasing,
    181: makeItemThrustRegulator,
    182: makeItemPressureValve,
    183: makeItemEnergyCapacitor,
    184: makeItemIgnitionCore,
    185: makeItemNavigationModule,
    186: makeItemJetpack,
    190: makeItemHealingHerb,
    191: makeItemCookedMeat,
    // Armor: Wood (Tier 0)
    200: () => makeHelmet(0x8b6b3a),
    201: () => makeChestplate(0x8b6b3a),
    202: () => makeLeggings(0x8b6b3a),
    203: () => makeBoots(0x8b6b3a),
    // Armor: Stone (Tier 1)
    204: () => makeHelmet(0x999999),
    205: () => makeChestplate(0x999999),
    206: () => makeLeggings(0x999999),
    207: () => makeBoots(0x999999),
    // Armor: Iron (Tier 2)
    208: () => makeHelmet(0xc9a96e),
    209: () => makeChestplate(0xc9a96e),
    210: () => makeLeggings(0xc9a96e),
    211: () => makeBoots(0xc9a96e),
    // Armor: Diamond (Tier 3)
    212: () => makeHelmet(0x7fffff),
    213: () => makeChestplate(0x7fffff),
    214: () => makeLeggings(0x7fffff),
    215: () => makeBoots(0x7fffff),
    // Armor: Titanium (Tier 4)
    216: () => makeHelmet(0xe8e8e8),
    217: () => makeChestplate(0xe8e8e8),
    218: () => makeLeggings(0xe8e8e8),
    219: () => makeBoots(0xe8e8e8),
  }

  for (const [id, maker] of Object.entries(itemMakers)) {
    drawToTexture(scene, `item_${id}`, maker())
  }

  // Station tile textures (reuse item sprites so placed stations look correct)
  const stationTileMakers: Record<number, () => PixelGrid> = {
    14: makeItemWorkbench,
    15: makeItemFurnace,
    16: makeItemAnvil,
    17: makeItemTechBench,
    18: makeItemFusionStation,
    19: makeItemWorkbenchMk2,
  }
  for (const [tileId, maker] of Object.entries(stationTileMakers)) {
    drawToTexture(scene, `tile_${tileId}`, maker())
  }
}
