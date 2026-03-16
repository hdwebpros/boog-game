import { createSeededNoise } from '../utils/noise'
import { TileType, TILE_SIZE } from './TileRegistry'

export const VOID_WORLD_WIDTH = 3000
export const VOID_WORLD_HEIGHT = 800

/** Biome zone boundaries (tile X coordinates) */
const ASHEN_WASTES_END = 750
const HELLFIRE_CAVERNS_END = 1500
const VOID_FOREST_END = 2250
// Dark Citadel: 2250-3000

/** Vertical bounds */
const CEILING_BOTTOM = 30
const FLOOR_TOP = 770
const LAVA_ZONE_TOP = 700

export interface VoidWorldData {
  tiles: Uint8Array
  width: number
  height: number
  seed: number
  spawnX: number
  spawnY: number
}

export function generateVoidWorld(seed: number): VoidWorldData {
  const width = VOID_WORLD_WIDTH
  const height = VOID_WORLD_HEIGHT
  const tiles = new Uint8Array(width * height)

  // Noise functions for different features
  const cavernNoise = createSeededNoise(seed)
  const cavernNoise2 = createSeededNoise(seed + 1)
  const oreNoise = createSeededNoise(seed + 2)
  const detailNoise = createSeededNoise(seed + 3)
  const structureNoise = createSeededNoise(seed + 4)
  const treeNoise = createSeededNoise(seed + 5)

  const rng = mulberry32(seed + 100)

  // Pass 1: Fill everything with VOID_STONE
  tiles.fill(TileType.VOID_STONE)

  // Pass 2: Set ceiling (y 0-30) as solid void stone (already filled)
  // Set floor (y 770-800) as brimstone + lava
  fillFloor(tiles, width, height)

  // Pass 3: Carve large caverns
  carveCaverns(tiles, width, height, cavernNoise, cavernNoise2)

  // Pass 4: Add ceiling stalactites
  placeStalactites(tiles, width, height, detailNoise, rng)

  // Pass 5: Place lava lakes at bottom
  placeLavaLakes(tiles, width, height, detailNoise)

  // Pass 6: Add void dirt pockets
  placeVoidDirt(tiles, width, height, detailNoise, cavernNoise2)

  // Pass 7: Scatter ores (hellfire ore, void crystal)
  placeOres(tiles, width, height, oreNoise, detailNoise)

  // Pass 8: Place brimstone near lava
  placeBrimstone(tiles, width, height)

  // Pass 9: Place soul sand and ash on cave floors
  placeCaveFloorMaterials(tiles, width, height)

  // Pass 10: Generate void trees in forest zone
  placeVoidTrees(tiles, width, height, treeNoise, rng)

  // Pass 11: Generate nether brick structures in citadel zone
  placeNetherBrickStructures(tiles, width, height, structureNoise, rng)

  // Pass 12: Scatter starshard crystal deposits across void biomes
  placeVoidCrystals(tiles, width, height, oreNoise, detailNoise)

  // Find spawn point near center
  const { spawnX, spawnY } = findSpawnPoint(tiles, width, height)

  // Clear spawn area
  clearSpawnArea(tiles, width, height, spawnX, spawnY)

  return { tiles, width, height, seed, spawnX, spawnY }
}

// ─── Internal helpers ────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function getBiomeZone(x: number): 'ashen' | 'hellfire' | 'forest' | 'citadel' {
  if (x < ASHEN_WASTES_END) return 'ashen'
  if (x < HELLFIRE_CAVERNS_END) return 'hellfire'
  if (x < VOID_FOREST_END) return 'forest'
  return 'citadel'
}

function fillFloor(tiles: Uint8Array, width: number, height: number) {
  for (let x = 0; x < width; x++) {
    for (let y = FLOOR_TOP; y < height; y++) {
      const idx = y * width + x
      // Bottom few rows are lava, above that brimstone
      if (y >= height - 10) {
        tiles[idx] = TileType.LAVA
      } else {
        tiles[idx] = TileType.BRIMSTONE
      }
    }
  }
}

function carveCaverns(
  tiles: Uint8Array, width: number, height: number,
  cavernNoise: (x: number, y: number) => number,
  cavernNoise2: (x: number, y: number) => number
) {
  for (let x = 0; x < width; x++) {
    for (let y = CEILING_BOTTOM; y < FLOOR_TOP; y++) {
      const idx = y * width + x

      // Large-scale cavern noise (big open areas)
      const c1 = cavernNoise(x * 0.02, y * 0.02)
      const c2 = cavernNoise(x * 0.04, y * 0.04)
      const c3 = cavernNoise2(x * 0.008, y * 0.008)
      const cavernVal = c1 * 0.4 + c2 * 0.3 + c3 * 0.3

      // Biome-specific cavern thresholds
      const biome = getBiomeZone(x)
      let threshold = 0.3

      switch (biome) {
        case 'ashen':
          // More open caverns
          threshold = 0.22
          break
        case 'hellfire':
          // Medium caverns
          threshold = 0.28
          break
        case 'forest':
          // Large open areas for trees
          threshold = 0.18
          break
        case 'citadel':
          // Tighter corridors, structures fill the space
          threshold = 0.32
          break
      }

      // Don't carve too close to ceiling or floor
      const distFromCeiling = y - CEILING_BOTTOM
      const distFromFloor = FLOOR_TOP - y
      const edgeFade = Math.min(distFromCeiling / 20, distFromFloor / 20, 1)
      const adjustedThreshold = threshold + (1 - edgeFade) * 0.3

      if (cavernVal > adjustedThreshold) {
        tiles[idx] = TileType.AIR
      }
    }
  }
}

function placeStalactites(
  tiles: Uint8Array, width: number, _height: number,
  detailNoise: (x: number, y: number) => number,
  rng: () => number
) {
  // Stalactites hanging from the ceiling and cavern ceilings
  for (let x = 2; x < width - 2; x++) {
    // Check for ceiling-to-air transitions
    for (let y = CEILING_BOTTOM; y < FLOOR_TOP - 20; y++) {
      const idx = y * width + x
      const aboveIdx = (y - 1) * width + x
      const belowIdx = (y + 1) * width + x

      // Find solid-to-air transition (bottom of a ceiling)
      if (tiles[aboveIdx] === TileType.VOID_STONE && tiles[idx] === TileType.AIR) {
        const n = detailNoise(x * 0.1, y * 0.1)
        if (n > 0.5 && rng() < 0.08) {
          // Grow stalactite downward
          const stalLen = 3 + Math.floor(rng() * 8)
          for (let dy = 0; dy < stalLen; dy++) {
            const sy = y + dy
            if (sy >= FLOOR_TOP) break
            const sIdx = sy * width + x
            if (tiles[sIdx] !== TileType.AIR) break
            tiles[sIdx] = TileType.VOID_STONE
          }
        }
      }
    }
  }
}

function placeLavaLakes(
  tiles: Uint8Array, width: number, _height: number,
  detailNoise: (x: number, y: number) => number
) {
  // Lava lakes in the lower portions of caverns (y > 700)
  for (let x = 0; x < width; x++) {
    for (let y = LAVA_ZONE_TOP; y < FLOOR_TOP; y++) {
      const idx = y * width + x
      if (tiles[idx] !== TileType.AIR) continue

      // Fill air pockets near the bottom with lava
      const n = detailNoise(x * 0.03, y * 0.03)
      if (n > -0.2) {
        tiles[idx] = TileType.LAVA
      }
    }
  }

  // Scattered lava pools higher up in hellfire zone
  for (let x = ASHEN_WASTES_END; x < HELLFIRE_CAVERNS_END; x++) {
    for (let y = 500; y < LAVA_ZONE_TOP; y++) {
      const idx = y * width + x
      if (tiles[idx] !== TileType.AIR) continue

      const n = detailNoise(x * 0.05, y * 0.05)
      // Only fill if this is at the bottom of a cavern (solid below or lava below)
      const belowIdx = (y + 1) * width + x
      if (y + 1 < FLOOR_TOP) {
        const below = tiles[belowIdx]!
        if ((below !== TileType.AIR) && n > 0.4) {
          tiles[idx] = TileType.LAVA
        }
      }
    }
  }
}

function placeVoidDirt(
  tiles: Uint8Array, width: number, height: number,
  detailNoise: (x: number, y: number) => number,
  cavernNoise2: (x: number, y: number) => number
) {
  for (let x = 0; x < width; x++) {
    for (let y = CEILING_BOTTOM; y < FLOOR_TOP; y++) {
      const idx = y * width + x
      if (tiles[idx] !== TileType.VOID_STONE) continue

      const n1 = detailNoise(x * 0.03, y * 0.03)
      const n2 = cavernNoise2(x * 0.06, y * 0.06)

      // Pockets of void dirt scattered through the stone
      if (n1 * 0.6 + n2 * 0.4 > 0.45) {
        tiles[idx] = TileType.VOID_DIRT
      }
    }
  }
}

function placeOres(
  tiles: Uint8Array, width: number, height: number,
  oreNoise: (x: number, y: number) => number,
  detailNoise: (x: number, y: number) => number
) {
  for (let x = 0; x < width; x++) {
    for (let y = CEILING_BOTTOM; y < FLOOR_TOP; y++) {
      const idx = y * width + x
      const tile = tiles[idx]!
      if (tile !== TileType.VOID_STONE && tile !== TileType.VOID_DIRT) continue

      const biome = getBiomeZone(x)

      // Hellfire ore: 2% in stone (more common in hellfire zone)
      const oreVal = oreNoise(x * 0.08, y * 0.08)
      let hellfireThreshold = 0.58 // ~2% chance
      if (biome === 'hellfire') hellfireThreshold = 0.50 // denser in hellfire zone

      if (oreVal > hellfireThreshold && tile === TileType.VOID_STONE) {
        tiles[idx] = TileType.HELLFIRE_ORE
        continue
      }

      // Void crystal: 0.5% below y > 400 (rare, deep areas)
      if (y > 400) {
        const crystalVal = detailNoise(x * 0.1, y * 0.1)
        let crystalThreshold = 0.72 // ~0.5%
        if (biome === 'forest') crystalThreshold = 0.68 // more in forest zone

        if (crystalVal > crystalThreshold && tile === TileType.VOID_STONE) {
          tiles[idx] = TileType.VOID_CRYSTAL
          continue
        }
      }
    }
  }
}

function placeBrimstone(tiles: Uint8Array, width: number, height: number) {
  // Place brimstone near lava tiles (within 3 tiles of lava)
  const brimstoneMap = new Uint8Array(width * height)

  for (let x = 1; x < width - 1; x++) {
    for (let y = CEILING_BOTTOM; y < FLOOR_TOP; y++) {
      const idx = y * width + x
      if (tiles[idx] !== TileType.LAVA) continue

      // Mark nearby solid tiles for brimstone conversion
      for (let dx = -3; dx <= 3; dx++) {
        for (let dy = -3; dy <= 3; dy++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
          const dist = Math.abs(dx) + Math.abs(dy)
          if (dist <= 3) {
            brimstoneMap[ny * width + nx] = 1
          }
        }
      }
    }
  }

  // Apply brimstone conversion
  for (let x = 0; x < width; x++) {
    for (let y = CEILING_BOTTOM; y < FLOOR_TOP; y++) {
      const idx = y * width + x
      if (brimstoneMap[idx] === 1) {
        const tile = tiles[idx]!
        if (tile === TileType.VOID_STONE || tile === TileType.VOID_DIRT) {
          tiles[idx] = TileType.BRIMSTONE
        }
      }
    }
  }
}

function placeCaveFloorMaterials(tiles: Uint8Array, width: number, _height: number) {
  // Place soul sand and ash block on cave floors (air above, solid below pattern)
  for (let x = 0; x < width; x++) {
    for (let y = CEILING_BOTTOM + 1; y < FLOOR_TOP - 1; y++) {
      const idx = y * width + x
      const tile = tiles[idx]!
      const aboveIdx = (y - 1) * width + x

      // Must be solid with air above (a floor surface)
      if (tile === TileType.AIR || tile === TileType.LAVA) continue
      if (tiles[aboveIdx] !== TileType.AIR) continue

      // Don't replace special tiles
      if (tile !== TileType.VOID_STONE && tile !== TileType.VOID_DIRT) continue

      const biome = getBiomeZone(x)

      switch (biome) {
        case 'ashen':
          // Ash floors with soul sand patches
          if ((x * 7 + y * 13) % 17 < 5) {
            tiles[idx] = TileType.SOUL_SAND
          } else {
            tiles[idx] = TileType.ASH_BLOCK
          }
          break
        case 'hellfire':
          // Mostly ash with some brimstone (brimstone already placed near lava)
          if ((x * 11 + y * 3) % 13 < 4) {
            tiles[idx] = TileType.ASH_BLOCK
          }
          break
        case 'forest':
          // Void grass on floors in the forest zone
          tiles[idx] = TileType.VOID_GRASS
          break
        case 'citadel':
          // Soul sand and ash mix
          if ((x * 5 + y * 9) % 11 < 4) {
            tiles[idx] = TileType.SOUL_SAND
          } else {
            tiles[idx] = TileType.ASH_BLOCK
          }
          break
      }
    }
  }
}

function placeVoidTrees(
  tiles: Uint8Array, width: number, _height: number,
  treeNoise: (x: number, y: number) => number,
  rng: () => number
) {
  // Void trees grow in the forest zone from cave floors AND cave ceilings (stalactite-style)
  const treeRng = mulberry32(Math.floor(rng() * 0xffffffff))

  // Floor trees (growing upward)
  for (let x = HELLFIRE_CAVERNS_END + 10; x < VOID_FOREST_END - 10; x++) {
    if (treeRng() > 0.06) continue // ~6% chance per column

    // Find a floor tile (solid with air above)
    for (let y = FLOOR_TOP - 1; y > CEILING_BOTTOM + 20; y--) {
      const idx = y * width + x
      const aboveIdx = (y - 1) * width + x
      const tile = tiles[idx]!

      if (tile === TileType.AIR || tile === TileType.LAVA) continue
      if (tiles[aboveIdx] !== TileType.AIR) continue

      // Found a floor - grow tree upward
      const treeHeight = 8 + Math.floor(treeRng() * 12)

      // Trunk
      let trunkTop = y - 1
      for (let ty = 1; ty <= treeHeight; ty++) {
        const treeY = y - ty
        if (treeY <= CEILING_BOTTOM) break
        const tIdx = treeY * width + x
        if (tiles[tIdx] !== TileType.AIR) break
        tiles[tIdx] = TileType.VOID_WOOD
        trunkTop = treeY
      }

      // Canopy (void leaves)
      const canopyR = 2 + Math.floor(treeRng() * 3)
      for (let ly = -canopyR; ly <= 1; ly++) {
        for (let lx = -canopyR; lx <= canopyR; lx++) {
          const cx = x + lx
          const cy = trunkTop + ly
          if (cx < 0 || cx >= width || cy <= CEILING_BOTTOM || cy >= FLOOR_TOP) continue
          const cIdx = cy * width + cx
          if (tiles[cIdx] === TileType.AIR) {
            tiles[cIdx] = TileType.VOID_LEAVES
          }
        }
      }
      break // one tree per column
    }
  }

  // Ceiling trees (stalactite-style, growing downward)
  for (let x = HELLFIRE_CAVERNS_END + 10; x < VOID_FOREST_END - 10; x++) {
    if (treeRng() > 0.04) continue // ~4% chance per column

    // Find a ceiling tile (solid with air below)
    for (let y = CEILING_BOTTOM; y < FLOOR_TOP - 20; y++) {
      const idx = y * width + x
      const belowIdx = (y + 1) * width + x
      const tile = tiles[idx]!

      if (tile === TileType.AIR || tile === TileType.LAVA) continue
      if (tiles[belowIdx] !== TileType.AIR) continue

      // Found a ceiling - grow tree downward
      const treeHeight = 5 + Math.floor(treeRng() * 8)

      // Trunk
      let trunkBottom = y + 1
      for (let ty = 1; ty <= treeHeight; ty++) {
        const treeY = y + ty
        if (treeY >= FLOOR_TOP) break
        const tIdx = treeY * width + x
        if (tiles[tIdx] !== TileType.AIR) break
        tiles[tIdx] = TileType.VOID_WOOD
        trunkBottom = treeY
      }

      // Inverted canopy
      const canopyR = 2 + Math.floor(treeRng() * 2)
      for (let ly = -1; ly <= canopyR; ly++) {
        for (let lx = -canopyR; lx <= canopyR; lx++) {
          const cx = x + lx
          const cy = trunkBottom + ly
          if (cx < 0 || cx >= width || cy <= CEILING_BOTTOM || cy >= FLOOR_TOP) continue
          const cIdx = cy * width + cx
          if (tiles[cIdx] === TileType.AIR) {
            tiles[cIdx] = TileType.VOID_LEAVES
          }
        }
      }
      break
    }
  }
}

function placeNetherBrickStructures(
  tiles: Uint8Array, width: number, _height: number,
  structureNoise: (x: number, y: number) => number,
  rng: () => number
) {
  const structRng = mulberry32(Math.floor(rng() * 0xffffffff))

  // Place ruined fortress structures in the Dark Citadel zone
  const structureCount = 8 + Math.floor(structRng() * 6)

  for (let i = 0; i < structureCount; i++) {
    // Random position within citadel zone
    const sx = VOID_FOREST_END + Math.floor(structRng() * (VOID_WORLD_WIDTH - VOID_FOREST_END - 40)) + 20
    const sy = CEILING_BOTTOM + 40 + Math.floor(structRng() * (FLOOR_TOP - CEILING_BOTTOM - 120))

    // Room dimensions
    const roomW = 10 + Math.floor(structRng() * 16) // 10-25 wide
    const roomH = 6 + Math.floor(structRng() * 10)  // 6-15 tall

    // Draw room structure
    placeNetherRoom(tiles, width, sx, sy, roomW, roomH, structRng)

    // Corridors connecting to adjacent rooms
    const corridorCount = 1 + Math.floor(structRng() * 3)
    for (let c = 0; c < corridorCount; c++) {
      const dir = structRng() < 0.5 ? -1 : 1
      const corridorLen = 8 + Math.floor(structRng() * 15)
      const corridorY = sy + Math.floor(structRng() * roomH)
      const corridorStartX = dir > 0 ? sx + roomW : sx
      const corridorH = 4

      for (let cx = 0; cx < corridorLen; cx++) {
        const px = corridorStartX + cx * dir
        if (px < 0 || px >= width) break

        for (let cy = 0; cy < corridorH; cy++) {
          const py = corridorY + cy
          if (py < CEILING_BOTTOM || py >= FLOOR_TOP) continue
          const pIdx = py * width + px

          if (cy === 0 || cy === corridorH - 1) {
            // Floor and ceiling
            tiles[pIdx] = TileType.NETHER_BRICK
          } else {
            // Interior
            tiles[pIdx] = TileType.AIR
          }
        }
      }
    }
  }
}

function placeNetherRoom(
  tiles: Uint8Array, width: number,
  rx: number, ry: number,
  roomW: number, roomH: number,
  rng: () => number
) {
  for (let dx = 0; dx < roomW; dx++) {
    for (let dy = 0; dy < roomH; dy++) {
      const px = rx + dx
      const py = ry + dy
      if (px < 0 || px >= width || py < CEILING_BOTTOM || py >= FLOOR_TOP) continue

      const idx = py * width + px
      const isWall = dx === 0 || dx === roomW - 1 || dy === 0 || dy === roomH - 1

      if (isWall) {
        // Ruined effect: random gaps in walls
        if (rng() < 0.85) {
          tiles[idx] = TileType.NETHER_BRICK
        }
        // else leave as-is (hole in wall)
      } else {
        // Interior is air
        tiles[idx] = TileType.AIR
      }
    }
  }

  // Pillars inside larger rooms
  if (roomW >= 14 && roomH >= 8) {
    const pillarSpacing = 4
    for (let px = 3; px < roomW - 3; px += pillarSpacing) {
      const x = rx + px
      if (x < 0 || x >= width) continue
      for (let dy = 1; dy < roomH - 1; dy++) {
        const y = ry + dy
        if (y < CEILING_BOTTOM || y >= FLOOR_TOP) continue
        tiles[y * width + x] = TileType.NETHER_BRICK
      }
    }
  }
}

function placeVoidCrystals(
  tiles: Uint8Array, width: number, _height: number,
  oreNoise: (x: number, y: number) => number,
  detailNoise: (x: number, y: number) => number
) {
  // Starshard crystals in void — each type concentrated in a biome zone
  // Ember → Hellfire Caverns, Frost → Ashen Wastes, Storm → throughout,
  // Life → Void Forest, Void → Dark Citadel (rarest)
  for (let x = 0; x < width; x++) {
    for (let y = CEILING_BOTTOM; y < FLOOR_TOP; y++) {
      const idx = y * width + x
      const tile = tiles[idx]!
      if (tile !== TileType.VOID_STONE) continue

      // Must be adjacent to air (cave wall placement)
      const hasAirNeighbor =
        (x > 0 && tiles[idx - 1] === TileType.AIR) ||
        (x < width - 1 && tiles[idx + 1] === TileType.AIR) ||
        (y > CEILING_BOTTOM && tiles[(y - 1) * width + x] === TileType.AIR) ||
        (y < FLOOR_TOP - 1 && tiles[(y + 1) * width + x] === TileType.AIR)
      if (!hasAirNeighbor) continue

      const cn = oreNoise(x * 0.07, y * 0.07)
      const detail = detailNoise(x * 0.12, y * 0.12)
      const val = cn * 0.6 + detail * 0.4
      if (val < 0.65) continue // rare clusters only

      const biome = getBiomeZone(x)
      let ct: TileType | null = null

      switch (biome) {
        case 'hellfire':
          ct = TileType.CRYSTAL_EMBER
          break
        case 'ashen':
          ct = TileType.CRYSTAL_FROST
          break
        case 'forest':
          ct = TileType.CRYSTAL_LIFE
          break
        case 'citadel':
          // Void crystals rarest — need higher threshold
          if (val > 0.72) ct = TileType.CRYSTAL_VOID
          break
      }

      // Storm crystals scatter across all biomes at very high threshold
      if (!ct && val > 0.75) {
        ct = TileType.CRYSTAL_STORM
      }

      if (ct) tiles[idx] = ct
    }
  }
}

function findSpawnPoint(tiles: Uint8Array, width: number, _height: number): { spawnX: number; spawnY: number } {
  const centerX = Math.floor(width / 2) // x=1500

  // Search outward from center for a safe spot
  for (let dx = 0; dx < 200; dx++) {
    for (const sign of [0, 1, -1]) {
      const x = centerX + dx * (sign || 1)
      if (x < 0 || x >= width) continue

      // Scan downward for solid ground with air above
      for (let y = CEILING_BOTTOM + 5; y < FLOOR_TOP - 5; y++) {
        const idx = y * width + x
        const tile = tiles[idx]!
        const aboveTile = tiles[(y - 1) * width + x]!
        const above2Tile = tiles[(y - 2) * width + x]!
        const above3Tile = tiles[(y - 3) * width + x]!

        // Need solid ground with at least 3 air tiles above
        if (
          tile !== TileType.AIR && tile !== TileType.LAVA && tile !== TileType.VOID_LEAVES &&
          aboveTile === TileType.AIR &&
          above2Tile === TileType.AIR &&
          above3Tile === TileType.AIR
        ) {
          return { spawnX: x, spawnY: y - 3 }
        }
      }
    }
  }

  // Fallback
  return { spawnX: centerX, spawnY: 400 }
}

function clearSpawnArea(tiles: Uint8Array, width: number, _height: number, spawnX: number, spawnY: number) {
  // Clear a small area around the spawn point
  for (let dx = -3; dx <= 3; dx++) {
    for (let dy = -4; dy <= 0; dy++) {
      const x = spawnX + dx
      const y = spawnY + dy
      if (x < 0 || x >= width || y < CEILING_BOTTOM || y >= FLOOR_TOP) continue
      const idx = y * width + x
      const tile = tiles[idx]!
      if (tile !== TileType.AIR && tile !== TileType.LAVA) {
        tiles[idx] = TileType.AIR
      }
    }
  }
  // Ensure solid ground under spawn
  const groundY = spawnY + 1
  if (groundY < FLOOR_TOP) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = spawnX + dx
      if (x < 0 || x >= width) continue
      const idx = groundY * width + x
      if (tiles[idx] === TileType.AIR) {
        tiles[idx] = TileType.ASH_BLOCK
      }
    }
  }
}
