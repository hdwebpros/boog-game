import { createSeededNoise, hashSeed } from '../utils/noise'
import { TileType, WORLD_WIDTH, WORLD_HEIGHT } from './TileRegistry'
import { ALTAR_DEFS, BossType } from '../data/bosses'
import type { AltarDef } from '../data/bosses'

export interface AltarPlacement {
  tx: number
  ty: number
  bossType: BossType
}

export interface RunestonePlacement {
  tx: number
  ty: number
  bossType: BossType
}

export interface WorldData {
  tiles: Uint8Array
  width: number
  height: number
  seed: string
  spawnX: number
  spawnY: number
  altars: AltarPlacement[]
  runestones: RunestonePlacement[]
  surfaceBiomes?: Uint8Array
  npcShopPosition?: { tx: number; ty: number }
}

// Layer boundaries (absolute y coordinates) — scaled for 1600-tall world
const SURFACE_BASE = 100
const OCEAN_WIDTH = 500
const OCEAN_FLOOR_DEPTH = 80
const UNDERGROUND_START = 180
const DEEP_UNDERGROUND_START = 640
const CORE_START = 1320

// Surface biome types
export enum SurfaceBiome {
  PLAINS = 0,
  FOREST = 1,
  DESERT = 2,
  MOUNTAINS = 3,
  LAKE = 4,
  SNOW = 5,
  JUNGLE = 6,
  MUSHROOM = 7,
}

export class WorldGenerator {
  private seed: string
  private seedNum: number

  constructor(seed?: string) {
    this.seed = seed || Math.random().toString(36).substring(2, 10)
    this.seedNum = hashSeed(this.seed)
  }

  generate(): WorldData {
    const width = WORLD_WIDTH
    const height = WORLD_HEIGHT
    const tiles = new Uint8Array(width * height)

    // Noise functions for different features
    const terrainNoise = createSeededNoise(this.seedNum)
    const caveNoise = createSeededNoise(this.seedNum + 1)
    const oreNoise1 = createSeededNoise(this.seedNum + 2)
    const oreNoise2 = createSeededNoise(this.seedNum + 3)
    const oreNoise3 = createSeededNoise(this.seedNum + 4)
    const detailNoise = createSeededNoise(this.seedNum + 5)
    const biomeNoise = createSeededNoise(this.seedNum + 6)
    const undergroundNoise = createSeededNoise(this.seedNum + 7)

    // Pre-compute surface biomes
    const surfaceBiomes = new Uint8Array(width)
    const spawnCenter = Math.floor(width / 2)
    const SPAWN_BIOME_RADIUS = 80 // Force Plains biome around spawn
    for (let x = 0; x < width; x++) {
      const distFromEdge = Math.min(x, width - 1 - x)
      if (distFromEdge < OCEAN_WIDTH) {
        surfaceBiomes[x] = SurfaceBiome.PLAINS // ocean edges handled separately
        continue
      }
      // Force Plains around spawn so player starts in a safe area
      if (Math.abs(x - spawnCenter) < SPAWN_BIOME_RADIUS) {
        surfaceBiomes[x] = SurfaceBiome.PLAINS
        continue
      }
      // Two noise octaves for biome selection — slow variation
      const b1 = biomeNoise(x * 0.001, 0.5)
      const b2 = biomeNoise(x * 0.003, 1.5)
      const b3 = biomeNoise(x * 0.0008, 2.5) // very slow variation for temperature
      const bVal = b1 * 0.5 + b2 * 0.3 + b3 * 0.2

      if (bVal < -0.45) surfaceBiomes[x] = SurfaceBiome.SNOW
      else if (bVal < -0.25) surfaceBiomes[x] = SurfaceBiome.DESERT
      else if (bVal < -0.05) surfaceBiomes[x] = SurfaceBiome.PLAINS
      else if (bVal < 0.12) surfaceBiomes[x] = SurfaceBiome.FOREST
      else if (bVal < 0.25) surfaceBiomes[x] = SurfaceBiome.JUNGLE
      else if (bVal < 0.38) surfaceBiomes[x] = SurfaceBiome.MOUNTAINS
      else if (bVal < 0.48) surfaceBiomes[x] = SurfaceBiome.MUSHROOM
      else surfaceBiomes[x] = SurfaceBiome.LAKE
    }

    // Pre-compute surface heights (shaped by biome)
    const surfaceHeights = new Float64Array(width)
    for (let x = 0; x < width; x++) {
      const biome = surfaceBiomes[x]!

      // Base terrain noise
      const n1 = terrainNoise(x * 0.004, 0)
      const n2 = terrainNoise(x * 0.015, 0)
      const n3 = terrainNoise(x * 0.04, 0)

      let h: number
      switch (biome) {
        case SurfaceBiome.PLAINS:
          h = n1 * 8 + n3 * 2
          break
        case SurfaceBiome.FOREST:
          h = n1 * 20 + n2 * 10 + n3 * 4
          break
        case SurfaceBiome.DESERT:
          // Gently rolling dunes, slightly lower
          h = n1 * 6 + n2 * 4 + 5
          break
        case SurfaceBiome.MOUNTAINS:
          // Tall, steep peaks
          h = n1 * 45 + n2 * 18 + n3 * 8 - 18
          break
        case SurfaceBiome.LAKE:
          // Depression that fills with water
          h = n1 * 6 + 14 + n3 * 2
          break
        case SurfaceBiome.SNOW:
          // Rolling tundra, moderate elevation
          h = n1 * 15 + n2 * 6 + n3 * 3 - 5
          break
        case SurfaceBiome.JUNGLE:
          // Dense, hilly terrain
          h = n1 * 18 + n2 * 12 + n3 * 5
          break
        case SurfaceBiome.MUSHROOM:
          // Flat, slightly depressed terrain
          h = n1 * 8 + n2 * 3 + 8
          break
        default:
          h = n1 * 25 + n2 * 12 + n3 * 5
      }

      // Ocean biomes — depress terrain at world edges
      const distFromEdge = Math.min(x, width - 1 - x)
      if (distFromEdge < OCEAN_WIDTH) {
        const t = 1 - distFromEdge / OCEAN_WIDTH
        h += OCEAN_FLOOR_DEPTH * t * t
      }

      surfaceHeights[x] = Math.floor(SURFACE_BASE + h)
    }

    // Pass 1: Fill base terrain
    this.fillBaseTerrain(tiles, width, height, surfaceHeights, surfaceBiomes)

    // Pass 2: Carve caves
    this.carveCaves(tiles, width, height, surfaceHeights, caveNoise, detailNoise)

    // Pass 3: Underground biome variety (crystal, clay, moss, obsidian)
    this.placeUndergroundVariety(tiles, width, height, undergroundNoise, detailNoise)

    // Pass 4: Place ores
    this.placeOres(tiles, width, height, oreNoise1, oreNoise2, oreNoise3)

    // Pass 4.5: Starshard crystal caves
    const crystalNoise = createSeededNoise(this.seedNum + 8)
    this.placeCrystalCaves(tiles, width, height, surfaceHeights, crystalNoise, detailNoise)

    // Pass 5: Ocean coral
    this.placeCoral(tiles, width, surfaceHeights, detailNoise)

    // Pass 6: Trees (biome-aware)
    this.placeTrees(tiles, width, surfaceHeights, surfaceBiomes)

    // Pass 7: Surface lakes
    this.placeSurfaceLakes(tiles, width, surfaceHeights, surfaceBiomes)

    // Pass 8: Desert cacti
    this.placeCacti(tiles, width, surfaceHeights, surfaceBiomes)

    // Pass 9: Mushroom biome structures
    this.placeMushroomStructures(tiles, width, surfaceHeights, surfaceBiomes)

    // Find spawn point — center of map, on surface
    const spawnX = Math.floor(width / 2)
    const spawnY = Math.floor(surfaceHeights[spawnX]!) - 3

    // Clear spawn area so player doesn't spawn inside trees or water
    for (let dx = -4; dx <= 4; dx++) {
      const sx = spawnX + dx
      if (sx < 0 || sx >= width) continue
      const surfY = Math.floor(surfaceHeights[sx]!)
      for (let y = surfY - 10; y < surfY; y++) {
        if (y < 0) continue
        const idx = y * width + sx
        const t = tiles[idx]!
        if (t === TileType.WOOD || t === TileType.LEAVES || t === TileType.CACTUS || t === TileType.MUSHROOM_BLOCK || t === TileType.WATER) {
          tiles[idx] = TileType.AIR
        }
      }
    }

    // Pass 10: Place boss altars and runestones
    const { altars, runestones } = this.placeAltarsAndRunestones(tiles, width, height, surfaceHeights)

    // Pass 11: Cloud City in the sky
    const npcShopPosition = this.placeCloudCity(tiles, width, detailNoise)

    return { tiles, width, height, seed: this.seed, spawnX, spawnY, altars, runestones, surfaceBiomes, npcShopPosition }
  }

  private fillBaseTerrain(
    tiles: Uint8Array, width: number, height: number,
    surfaceHeights: Float64Array, surfaceBiomes: Uint8Array
  ) {
    for (let x = 0; x < width; x++) {
      const surfaceY = Math.floor(surfaceHeights[x]!)
      const distFromEdge = Math.min(x, width - 1 - x)
      const isOcean = distFromEdge < OCEAN_WIDTH
      const biome = surfaceBiomes[x]!

      for (let y = 0; y < height; y++) {
        const idx = y * width + x

        if (y < surfaceY) {
          // Above surface
          if (isOcean && y >= SURFACE_BASE - 3) {
            tiles[idx] = TileType.WATER
          } else {
            tiles[idx] = TileType.AIR
          }
        } else if (y === surfaceY) {
          // Surface block — varies by biome
          if (isOcean) {
            tiles[idx] = TileType.SAND
          } else if (biome === SurfaceBiome.DESERT) {
            tiles[idx] = TileType.SAND
          } else if (biome === SurfaceBiome.MOUNTAINS) {
            tiles[idx] = TileType.STONE
          } else if (biome === SurfaceBiome.SNOW) {
            tiles[idx] = TileType.SNOW
          } else if (biome === SurfaceBiome.JUNGLE) {
            tiles[idx] = TileType.JUNGLE_GRASS
          } else if (biome === SurfaceBiome.MUSHROOM) {
            tiles[idx] = TileType.MOSS
          } else {
            tiles[idx] = TileType.GRASS
          }
        } else if (y < surfaceY + 4) {
          // Sub-surface layer 1 — biome-specific
          if (isOcean || biome === SurfaceBiome.DESERT) {
            tiles[idx] = TileType.SAND
          } else if (biome === SurfaceBiome.MOUNTAINS) {
            tiles[idx] = TileType.STONE
          } else if (biome === SurfaceBiome.SNOW) {
            tiles[idx] = TileType.SNOW
          } else if (biome === SurfaceBiome.JUNGLE) {
            tiles[idx] = TileType.CLAY
          } else if (biome === SurfaceBiome.MUSHROOM) {
            tiles[idx] = TileType.MOSS
          } else {
            tiles[idx] = TileType.DIRT
          }
        } else if (y < surfaceY + 8) {
          // Sub-surface layer 2 — transition
          if (isOcean || biome === SurfaceBiome.DESERT) {
            tiles[idx] = TileType.SANDSTONE
          } else if (biome === SurfaceBiome.SNOW) {
            tiles[idx] = TileType.FROZEN_STONE
          } else if (biome === SurfaceBiome.JUNGLE) {
            tiles[idx] = TileType.CLAY
          } else if (biome === SurfaceBiome.MOUNTAINS) {
            tiles[idx] = TileType.STONE
          } else {
            tiles[idx] = TileType.DIRT
          }
        } else if (y < UNDERGROUND_START) {
          // Upper underground — biome influence fades
          if (biome === SurfaceBiome.DESERT) {
            tiles[idx] = TileType.SANDSTONE
          } else if (biome === SurfaceBiome.SNOW) {
            tiles[idx] = TileType.FROZEN_STONE
          } else {
            tiles[idx] = TileType.DIRT
          }
        } else if (y < DEEP_UNDERGROUND_START) {
          tiles[idx] = TileType.STONE
        } else if (y < CORE_START) {
          tiles[idx] = TileType.STONE
        } else {
          tiles[idx] = TileType.STONE
        }
      }
    }
  }

  private carveCaves(
    tiles: Uint8Array, width: number, height: number,
    surfaceHeights: Float64Array,
    caveNoise: (x: number, y: number) => number,
    detailNoise: (x: number, y: number) => number
  ) {
    for (let x = 0; x < width; x++) {
      const surfaceY = Math.floor(surfaceHeights[x]!)

      for (let y = surfaceY + 10; y < height; y++) {
        const idx = y * width + x
        if (tiles[idx] === TileType.AIR || tiles[idx] === TileType.WATER) continue

        // Multi-scale cave noise
        const c1 = caveNoise(x * 0.015, y * 0.015)
        const c2 = caveNoise(x * 0.04, y * 0.04)
        const c3 = caveNoise(x * 0.08, y * 0.08)
        const caveVal = c1 * 0.5 + c2 * 0.35 + c3 * 0.15

        // Deeper = more caves
        let threshold = 0.35
        if (y > DEEP_UNDERGROUND_START) threshold = 0.30
        if (y > CORE_START) threshold = 0.27

        if (caveVal > threshold) {
          // Lava in deep caves
          if (y > CORE_START && detailNoise(x * 0.03, y * 0.03) > 0.1) {
            tiles[idx] = TileType.LAVA
          } else if (y > DEEP_UNDERGROUND_START && detailNoise(x * 0.04, y * 0.04) > 0.55) {
            tiles[idx] = TileType.LAVA
          } else {
            tiles[idx] = TileType.AIR
          }
        }
      }
    }
  }

  private placeUndergroundVariety(
    tiles: Uint8Array, width: number, height: number,
    undergroundNoise: (x: number, y: number) => number,
    detailNoise: (x: number, y: number) => number
  ) {
    for (let x = 0; x < width; x++) {
      for (let y = UNDERGROUND_START; y < height; y++) {
        const idx = y * width + x
        const tile = tiles[idx]!
        if (tile !== TileType.STONE && tile !== TileType.DIRT) continue

        const n1 = undergroundNoise(x * 0.02, y * 0.02)
        const n2 = detailNoise(x * 0.05, y * 0.05)

        // Clay pockets in upper underground
        if (y < DEEP_UNDERGROUND_START && tile === TileType.DIRT) {
          if (n1 > 0.4 && n2 > 0.3) {
            tiles[idx] = TileType.CLAY
            continue
          }
        }

        // Moss near cave edges (stone next to air)
        if (y < DEEP_UNDERGROUND_START && tile === TileType.STONE) {
          let nearAir = false
          if (x > 0 && tiles[idx - 1] === TileType.AIR) nearAir = true
          if (x < width - 1 && tiles[idx + 1] === TileType.AIR) nearAir = true
          if (y > 0 && tiles[(y - 1) * width + x] === TileType.AIR) nearAir = true
          if (y < height - 1 && tiles[(y + 1) * width + x] === TileType.AIR) nearAir = true
          if (nearAir && n2 > 0.2) {
            tiles[idx] = TileType.MOSS
            continue
          }
        }

        // Crystal caverns in deep underground
        if (y >= DEEP_UNDERGROUND_START && y < CORE_START && tile === TileType.STONE) {
          if (n1 > 0.55 && n2 > 0.4) {
            tiles[idx] = TileType.CRYSTAL
            continue
          }
        }

        // Obsidian near core (where lava meets stone)
        if (y >= CORE_START - 40 && tile === TileType.STONE) {
          let nearLava = false
          if (x > 0 && tiles[idx - 1] === TileType.LAVA) nearLava = true
          if (x < width - 1 && tiles[idx + 1] === TileType.LAVA) nearLava = true
          if (y > 0 && tiles[(y - 1) * width + x] === TileType.LAVA) nearLava = true
          if (y < height - 1 && tiles[(y + 1) * width + x] === TileType.LAVA) nearLava = true
          if (nearLava) {
            tiles[idx] = TileType.OBSIDIAN
            continue
          }
          // Scattered obsidian in core
          if (y >= CORE_START && n1 > 0.5) {
            tiles[idx] = TileType.OBSIDIAN
            continue
          }
        }
      }
    }
  }

  private placeOres(
    tiles: Uint8Array, width: number, height: number,
    oreNoise1: (x: number, y: number) => number,
    oreNoise2: (x: number, y: number) => number,
    oreNoise3: (x: number, y: number) => number
  ) {
    for (let x = 0; x < width; x++) {
      for (let y = UNDERGROUND_START; y < height; y++) {
        const idx = y * width + x
        if (tiles[idx] !== TileType.STONE && tiles[idx] !== TileType.FROZEN_STONE && tiles[idx] !== TileType.SANDSTONE) continue

        // Iron ore: underground to deep
        if (y >= UNDERGROUND_START && y < CORE_START) {
          if (oreNoise1(x * 0.08, y * 0.08) > 0.6) {
            tiles[idx] = TileType.IRON_ORE
            continue
          }
        }

        // Diamond ore: deep underground+
        if (y >= DEEP_UNDERGROUND_START) {
          if (oreNoise2(x * 0.1, y * 0.1) > 0.72) {
            tiles[idx] = TileType.DIAMOND_ORE
            continue
          }
        }

        // Titanium ore: deep underground, rarer
        if (y >= DEEP_UNDERGROUND_START + 100) {
          if (oreNoise3(x * 0.12, y * 0.12) > 0.78) {
            tiles[idx] = TileType.TITANIUM_ORE
            continue
          }
        }

        // Carbon fiber: core zone
        if (y >= CORE_START) {
          if (oreNoise1(x * 0.15, y * 0.15) > 0.65) {
            tiles[idx] = TileType.CARBON_FIBER
            continue
          }
        }
      }
    }
  }

  private placeCrystalCaves(
    tiles: Uint8Array, width: number, height: number,
    surfaceHeights: Float64Array,
    crystalNoise: (x: number, y: number) => number,
    detailNoise: (x: number, y: number) => number
  ) {
    // Starshard Caverns: crystalline clusters along cave walls underground.
    // Different depths yield different crystal types:
    //   Life (green): 130-300, Frost (blue): 200-400, Storm (yellow): 350-600
    //   Ember (red): 500-900, Void (purple): 800+ (rarest)
    for (let x = 1; x < width - 1; x++) {
      const surfaceY = Math.floor(surfaceHeights[x]!)
      for (let y = surfaceY + 20; y < height - 1; y++) {
        const idx = y * width + x
        if (tiles[idx] !== TileType.STONE && tiles[idx] !== TileType.DIRT) continue

        // Must be adjacent to air (cave wall)
        if (tiles[idx - 1] !== TileType.AIR && tiles[idx + 1] !== TileType.AIR &&
            tiles[(y - 1) * width + x] !== TileType.AIR && tiles[(y + 1) * width + x] !== TileType.AIR) continue

        // Crystal pocket noise — rare clusters
        const cn = crystalNoise(x * 0.06, y * 0.06)
        const detail = detailNoise(x * 0.15, y * 0.15)
        if (cn * 0.7 + detail * 0.3 < 0.62) continue

        // Determine crystal type by depth
        let ct: TileType | null = null
        if (y >= CORE_START - 200 && crystalNoise(x * 0.03, y * 0.03) > 0.3) {
          ct = TileType.CRYSTAL_VOID
        } else if (y >= DEEP_UNDERGROUND_START + 20 && y < CORE_START) {
          ct = TileType.CRYSTAL_EMBER
        } else if (y >= 350 && y < DEEP_UNDERGROUND_START + 120) {
          ct = TileType.CRYSTAL_STORM
        } else if (y >= 200 && y < 450) {
          ct = TileType.CRYSTAL_FROST
        } else if (y >= UNDERGROUND_START && y < 300) {
          ct = TileType.CRYSTAL_LIFE
        }
        if (ct) tiles[idx] = ct
      }
    }
  }

  private placeCoral(
    tiles: Uint8Array, width: number,
    surfaceHeights: Float64Array,
    detailNoise: (x: number, y: number) => number
  ) {
    const rng = this.mulberry32(this.seedNum + 600)

    for (let x = 0; x < width; x++) {
      const distFromEdge = Math.min(x, width - 1 - x)
      if (distFromEdge >= OCEAN_WIDTH) continue

      const surfaceY = Math.floor(surfaceHeights[x]!)

      // Coral on the ocean floor (replaces sand)
      for (let y = surfaceY; y < surfaceY + 4; y++) {
        const idx = y * width + x
        if (tiles[idx] === TileType.SAND && detailNoise(x * 0.2, y * 0.2) > 0.4) {
          tiles[idx] = TileType.CORAL
        }
      }

      // Seaweed growing upward from the ocean floor into the water
      const floorTile = tiles[surfaceY * width + x]!
      if ((floorTile === TileType.SAND || floorTile === TileType.CORAL) && rng() < 0.25) {
        const weedHeight = 1 + Math.floor(rng() * 3) // 1–3 tiles tall
        for (let wy = 1; wy <= weedHeight; wy++) {
          const wy2 = surfaceY - wy
          if (wy2 < 0) break
          const widx = wy2 * width + x
          if (tiles[widx] === TileType.WATER) {
            tiles[widx] = TileType.SEAWEED
          } else {
            break // stop if not water
          }
        }
      }
    }
  }

  private placeTrees(tiles: Uint8Array, width: number, surfaceHeights: Float64Array, surfaceBiomes: Uint8Array) {
    const rng = this.mulberry32(this.seedNum + 100)

    for (let x = 5; x < width - 5; x++) {
      const distFromEdge = Math.min(x, width - 1 - x)
      if (distFromEdge < OCEAN_WIDTH + 20) continue

      const surfaceY = Math.floor(surfaceHeights[x]!)
      const surfTile = tiles[surfaceY * width + x]!
      const biome = surfaceBiomes[x]!

      // Only place trees on grass-like surfaces
      const isTreeSurface = surfTile === TileType.GRASS || surfTile === TileType.JUNGLE_GRASS || surfTile === TileType.SNOW
      if (!isTreeSurface) {
        rng() // consume RNG to keep stream consistent
        continue
      }

      // Tree probability and style varies by biome
      let treeChance: number
      let minSpacing: number
      switch (biome) {
        case SurfaceBiome.FOREST:
          treeChance = 0.18
          minSpacing = 2
          break
        case SurfaceBiome.JUNGLE:
          treeChance = 0.25
          minSpacing = 1
          break
        case SurfaceBiome.PLAINS:
          treeChance = 0.03
          minSpacing = 6
          break
        case SurfaceBiome.LAKE:
          treeChance = 0  // no trees — water fills in after trees pass
          minSpacing = 4
          break
        case SurfaceBiome.SNOW:
          treeChance = 0.07
          minSpacing = 4
          break
        case SurfaceBiome.DESERT:
        case SurfaceBiome.MOUNTAINS:
        case SurfaceBiome.MUSHROOM:
          treeChance = 0
          minSpacing = 3
          break
        default:
          treeChance = 0.08
          minSpacing = 3
      }

      if (rng() < treeChance) {
        const isJungle = biome === SurfaceBiome.JUNGLE
        const isSnowy = biome === SurfaceBiome.SNOW
        const treeHeight = isJungle ? 6 + Math.floor(rng() * 6) : 4 + Math.floor(rng() * 4)

        // Trunk
        for (let ty = 1; ty <= treeHeight; ty++) {
          const y = surfaceY - ty
          if (y < 0) break
          tiles[y * width + x] = TileType.WOOD
        }

        // Canopy
        const topY = surfaceY - treeHeight
        const canopyR = isJungle ? 3 : 2
        for (let ly = -canopyR; ly <= 0; ly++) {
          for (let lx = -canopyR; lx <= canopyR; lx++) {
            const lxi = x + lx
            const lyi = topY + ly
            if (lxi < 0 || lxi >= width || lyi < 0) continue
            if (tiles[lyi * width + lxi] === TileType.AIR) {
              tiles[lyi * width + lxi] = isSnowy ? TileType.SNOW : TileType.LEAVES
            }
          }
        }

        x += minSpacing
      }
    }
  }

  private placeSurfaceLakes(
    tiles: Uint8Array, width: number,
    surfaceHeights: Float64Array, surfaceBiomes: Uint8Array
  ) {
    // Fill lake biome depressions with water
    for (let x = 0; x < width; x++) {
      if (surfaceBiomes[x] !== SurfaceBiome.LAKE) continue
      const distFromEdge = Math.min(x, width - 1 - x)
      if (distFromEdge < OCEAN_WIDTH) continue

      const surfaceY = Math.floor(surfaceHeights[x]!)
      const waterLevel = SURFACE_BASE + 10
      if (surfaceY > waterLevel) {
        for (let y = surfaceY - 1; y >= waterLevel; y--) {
          const idx = y * width + x
          if (tiles[idx] === TileType.AIR) {
            tiles[idx] = TileType.WATER
          }
        }
        if (tiles[surfaceY * width + x] === TileType.GRASS) {
          tiles[surfaceY * width + x] = TileType.SAND
        }
      }
    }

    // Frozen lakes in snow biome depressions
    for (let x = 0; x < width; x++) {
      if (surfaceBiomes[x] !== SurfaceBiome.SNOW) continue
      const distFromEdge = Math.min(x, width - 1 - x)
      if (distFromEdge < OCEAN_WIDTH) continue

      const surfaceY = Math.floor(surfaceHeights[x]!)
      // Check if surface is depressed enough for a frozen lake
      const localAvg = SURFACE_BASE - 5
      if (surfaceY > localAvg + 4) {
        // Ice on top, water below
        const iceLevel = localAvg + 4
        for (let y = surfaceY - 1; y >= iceLevel; y--) {
          const idx = y * width + x
          if (tiles[idx] === TileType.AIR || tiles[idx] === TileType.SNOW) {
            tiles[idx] = y === iceLevel ? TileType.ICE : TileType.WATER
          }
        }
      }
    }
  }

  private placeCacti(
    tiles: Uint8Array, width: number,
    surfaceHeights: Float64Array, surfaceBiomes: Uint8Array
  ) {
    const rng = this.mulberry32(this.seedNum + 300)

    for (let x = 5; x < width - 5; x++) {
      if (surfaceBiomes[x] !== SurfaceBiome.DESERT) {
        rng()
        continue
      }
      const distFromEdge = Math.min(x, width - 1 - x)
      if (distFromEdge < OCEAN_WIDTH + 20) continue

      const surfaceY = Math.floor(surfaceHeights[x]!)
      if (tiles[surfaceY * width + x] !== TileType.SAND) {
        rng()
        continue
      }

      if (rng() < 0.04) {
        const cactusHeight = 2 + Math.floor(rng() * 3)
        for (let cy = 1; cy <= cactusHeight; cy++) {
          const y = surfaceY - cy
          if (y < 0) break
          tiles[y * width + x] = TileType.CACTUS
        }
        x += 4 // spacing
      }
    }
  }

  private placeMushroomStructures(
    tiles: Uint8Array, width: number,
    surfaceHeights: Float64Array, surfaceBiomes: Uint8Array
  ) {
    const rng = this.mulberry32(this.seedNum + 400)

    for (let x = 5; x < width - 5; x++) {
      if (surfaceBiomes[x] !== SurfaceBiome.MUSHROOM) {
        rng()
        continue
      }
      const distFromEdge = Math.min(x, width - 1 - x)
      if (distFromEdge < OCEAN_WIDTH + 20) continue

      const surfaceY = Math.floor(surfaceHeights[x]!)
      if (tiles[surfaceY * width + x] !== TileType.MOSS) {
        rng()
        continue
      }

      if (rng() < 0.08) {
        // Giant mushroom: stem + cap
        const stemHeight = 3 + Math.floor(rng() * 4)

        // Stem
        for (let sy = 1; sy <= stemHeight; sy++) {
          const y = surfaceY - sy
          if (y < 0) break
          tiles[y * width + x] = TileType.WOOD
        }

        // Cap (wide mushroom top)
        const topY = surfaceY - stemHeight
        const capR = 2 + Math.floor(rng() * 2)
        for (let ly = -1; ly <= 0; ly++) {
          for (let lx = -capR; lx <= capR; lx++) {
            const cx = x + lx
            const cy = topY + ly
            if (cx < 0 || cx >= width || cy < 0) continue
            if (tiles[cy * width + cx] === TileType.AIR) {
              tiles[cy * width + cx] = TileType.MUSHROOM_BLOCK
            }
          }
        }

        x += 4
      }
    }
  }

  private placeAltarsAndRunestones(
    tiles: Uint8Array, width: number, height: number,
    surfaceHeights: Float64Array
  ): { altars: AltarPlacement[]; runestones: RunestonePlacement[] } {
    const altars: AltarPlacement[] = []
    const runestones: RunestonePlacement[] = []
    const rng = this.mulberry32(this.seedNum + 200)
    const bossTypes = Object.values(BossType)

    // Divide the world horizontally into zones for altar spread
    const zoneWidth = Math.floor(width / (bossTypes.length + 1))
    const MIN_EDGE_DIST = 600 // keep away from ocean edges

    for (let i = 0; i < bossTypes.length; i++) {
      const bt = bossTypes[i]!
      const altarDef = ALTAR_DEFS[bt]
      if (!altarDef) continue

      // Try to place the altar in a zone spread across the world
      const zoneStart = Math.max(MIN_EDGE_DIST, zoneWidth * (i + 0.5) - zoneWidth / 2)
      const zoneEnd = Math.min(width - MIN_EDGE_DIST, zoneWidth * (i + 0.5) + zoneWidth / 2)

      const spawnX = Math.floor(width / 2)
      const MIN_SPAWN_DIST = 200 // tiles away from player spawn

      let placed = false
      for (let attempt = 0; attempt < 100; attempt++) {
        const tx = Math.floor(zoneStart + rng() * (zoneEnd - zoneStart))
        if (tx < 2 || tx >= width - 2) continue

        // Find valid Y position — place ON the ground (solid tile), graphics draw upward
        let ty = -1
        if (altarDef.biomeYMin < surfaceHeights[tx]!) {
          // Surface altar: place on the surface tile itself
          ty = Math.floor(surfaceHeights[tx]!)
        } else {
          // Underground altar: find air with solid below, place on the solid tile
          for (let scanY = altarDef.biomeYMin; scanY < Math.min(altarDef.biomeYMax, height - 2); scanY++) {
            const idx = scanY * width + tx
            if (tiles[idx] === TileType.AIR && scanY + 1 < height && tiles[(scanY + 1) * width + tx] !== TileType.AIR && tiles[(scanY + 1) * width + tx] !== TileType.LAVA && tiles[(scanY + 1) * width + tx] !== TileType.WATER) {
              ty = scanY + 1 // the solid tile below the air
              break
            }
          }
        }

        if (ty < 1 || ty >= height) continue
        // Verify this tile is solid ground
        const groundTile = tiles[ty * width + tx]!
        if (groundTile === TileType.AIR || groundTile === TileType.WATER || groundTile === TileType.LAVA) continue

        // Clear air space above for the altar (3 wide, 4 tall above ground)
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -4; dy <= -1; dy++) {
            const ax = tx + dx
            const ay = ty + dy
            if (ax >= 0 && ax < width && ay >= 0 && ay < height) {
              tiles[ay * width + ax] = TileType.AIR
            }
          }
        }

        altars.push({ tx, ty, bossType: bt })
        placed = true
        break
      }

      // Fallback: force place at zone center if nothing found
      if (!placed) {
        const tx = Math.floor((zoneStart + zoneEnd) / 2)
        const ty = Math.min(altarDef.biomeYMax - 1, Math.max(altarDef.biomeYMin + 1, Math.floor(surfaceHeights[tx]!)))
        altars.push({ tx, ty: Math.min(ty, height - 1), bossType: bt })
      }

      // Place runestones for this boss — scattered randomly, biased toward appropriate depths
      for (let r = 0; r < altarDef.runestonesPerWorld; r++) {
        for (let attempt = 0; attempt < 80; attempt++) {
          const rx = Math.floor(MIN_EDGE_DIST + rng() * (width - MIN_EDGE_DIST * 2))
          if (rx < 2 || rx >= width - 2) continue

          // Don't place runestones near player spawn
          if (Math.abs(rx - spawnX) < MIN_SPAWN_DIST) continue

          // Runestones placed at slightly shallower depth than the boss
          const minY = Math.max(0, altarDef.biomeYMin - 40)
          const maxY = altarDef.biomeYMax

          let ry = -1
          // Surface runestones: place ON the surface tile (solid ground)
          if (minY < surfaceHeights[rx]!) {
            ry = Math.floor(surfaceHeights[rx]!)
          } else {
            // Underground: scan for air above solid, place on the solid tile
            const scanStart = minY + Math.floor(rng() * Math.max(1, maxY - minY))
            for (let scanY = scanStart; scanY < Math.min(maxY, height - 1); scanY++) {
              if (tiles[scanY * width + rx] === TileType.AIR && tiles[(scanY + 1) * width + rx] !== TileType.AIR && tiles[(scanY + 1) * width + rx] !== TileType.LAVA && tiles[(scanY + 1) * width + rx] !== TileType.WATER) {
                ry = scanY + 1 // the solid tile below the air
                break
              }
            }
          }

          if (ry < 1 || ry >= height) continue
          // Verify this tile is solid ground
          const groundTile = tiles[ry * width + rx]!
          if (groundTile === TileType.AIR || groundTile === TileType.WATER || groundTile === TileType.LAVA) continue

          // Keep minimum distance from spawn, other runestones, and altars
          let tooClose = false
          for (const a of altars) {
            if (Math.abs(a.tx - rx) < 30 && Math.abs(a.ty - ry) < 20) { tooClose = true; break }
          }
          for (const rs of runestones) {
            if (Math.abs(rs.tx - rx) < 50 && Math.abs(rs.ty - ry) < 30) { tooClose = true; break }
          }
          if (tooClose) continue

          // Clear 1-tile-wide, 2-tile-tall air space above ground for runestone visibility
          for (let dy = -2; dy <= -1; dy++) {
            const ay = ry + dy
            if (ay >= 0 && ay < height) {
              tiles[ay * width + rx] = TileType.AIR
            }
          }

          runestones.push({ tx: rx, ty: ry, bossType: bt })
          break
        }
      }
    }

    return { altars, runestones }
  }

  private placeCloudCity(
    tiles: Uint8Array, width: number,
    detailNoise: (x: number, y: number) => number
  ): { tx: number; ty: number } {
    const cx = Math.floor(width / 2) // center near spawn
    const mainY = 60 // main platform Y (well above y=2 ending trigger)
    const rng = this.mulberry32(this.seedNum + 500)

    // Main floating island: ~120 tiles wide, 4 tiles thick
    const halfW = 60
    for (let dx = -halfW; dx <= halfW; dx++) {
      const x = cx + dx
      if (x < 0 || x >= width) continue

      // Use noise to create irregular edges
      const edgeDist = Math.abs(dx) / halfW
      const noiseVal = detailNoise(x * 0.05, mainY * 0.05) * 0.3
      if (edgeDist + noiseVal > 0.95) continue

      // Platform thickness varies
      const thick = edgeDist > 0.7 ? 2 : 4
      for (let dy = 0; dy < thick; dy++) {
        const y = mainY + dy
        if (y >= 0 && y < 1600) {
          tiles[y * width + x] = TileType.CLOUD_BLOCK
        }
      }
    }

    // Smaller satellite platforms above and below
    const satellites = [
      { ox: -40, oy: 48, w: 25 },
      { ox: 45, oy: 50, w: 20 },
      { ox: -20, oy: 72, w: 30 },
      { ox: 30, oy: 75, w: 22 },
      { ox: 0, oy: 45, w: 18 },
    ]
    for (const sat of satellites) {
      for (let dx = -sat.w; dx <= sat.w; dx++) {
        const x = cx + sat.ox + dx
        if (x < 0 || x >= width) continue
        const edgeDist = Math.abs(dx) / sat.w
        if (edgeDist > 0.9 + rng() * 0.1) continue
        for (let dy = 0; dy < 2; dy++) {
          const y = sat.oy + dy
          if (y >= 0 && y < 1600) {
            tiles[y * width + x] = TileType.CLOUD_BLOCK
          }
        }
      }
    }

    // NPC shop building on main platform: 12 wide, 8 tall
    const shopX = cx
    const shopW = 6 // half-width
    const shopH = 7
    const shopFloorY = mainY // top of main platform
    const shopTopY = shopFloorY - shopH

    // Walls
    for (let dy = 0; dy <= shopH; dy++) {
      const y = shopTopY + dy
      if (y < 0) continue
      // Left wall
      if (cx - shopW >= 0) tiles[y * width + (cx - shopW)] = TileType.CLOUD_BRICK
      // Right wall
      if (cx + shopW < width) tiles[y * width + (cx + shopW)] = TileType.CLOUD_BRICK
    }
    // Roof
    for (let dx = -shopW; dx <= shopW; dx++) {
      const x = cx + dx
      if (x >= 0 && x < width && shopTopY >= 0) {
        tiles[shopTopY * width + x] = TileType.CLOUD_BRICK
      }
    }
    // Pillars at corners
    const pillarPositions = [cx - shopW, cx + shopW]
    for (const px of pillarPositions) {
      if (px < 0 || px >= width) continue
      for (let dy = 0; dy <= shopH; dy++) {
        const y = shopTopY + dy
        if (y >= 0) tiles[y * width + px] = TileType.CLOUD_PILLAR
      }
    }
    // Clear interior
    for (let dx = -shopW + 1; dx < shopW; dx++) {
      const x = cx + dx
      if (x < 0 || x >= width) continue
      for (let dy = 1; dy <= shopH; dy++) {
        const y = shopTopY + dy
        if (y >= 0) tiles[y * width + x] = TileType.AIR
      }
    }
    // Door opening (clear 2 tiles on each side at ground level)
    for (let dy = shopH - 2; dy <= shopH; dy++) {
      const y = shopTopY + dy
      if (y < 0) continue
      if (cx - shopW >= 0) tiles[y * width + (cx - shopW)] = TileType.AIR
      if (cx + shopW < width) tiles[y * width + (cx + shopW)] = TileType.AIR
    }

    // NPC spawns inside building, standing on the floor
    const npcTX = cx
    const npcTY = shopFloorY - 1

    return { tx: npcTX, ty: npcTY }
  }

  private mulberry32(seed: number): () => number {
    let s = seed
    return () => {
      s |= 0
      s = (s + 0x6d2b79f5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
}
