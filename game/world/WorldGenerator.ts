import { createSeededNoise, hashSeed } from '../utils/noise'
import { TileType, WORLD_WIDTH, WORLD_HEIGHT } from './TileRegistry'

export interface WorldData {
  tiles: Uint8Array
  width: number
  height: number
  seed: string
  spawnX: number
  spawnY: number
}

// Layer boundaries (absolute y coordinates)
const SURFACE_BASE = 80
const OCEAN_WIDTH = 350
const OCEAN_FLOOR_DEPTH = 60 // how far below SURFACE_BASE the ocean floor drops
const UNDERGROUND_START = 130
const DEEP_UNDERGROUND_START = 480
const CORE_START = 1000

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

    // Pre-compute surface heights
    const surfaceHeights = new Float64Array(width)
    for (let x = 0; x < width; x++) {
      let h = terrainNoise(x * 0.004, 0) * 25   // large rolling hills
      h += terrainNoise(x * 0.015, 0) * 12       // medium variation
      h += terrainNoise(x * 0.04, 0) * 5          // small detail

      // Ocean biomes — depress terrain at world edges
      const distFromEdge = Math.min(x, width - 1 - x)
      if (distFromEdge < OCEAN_WIDTH) {
        const t = 1 - distFromEdge / OCEAN_WIDTH
        h += OCEAN_FLOOR_DEPTH * t * t
      }

      surfaceHeights[x] = Math.floor(SURFACE_BASE + h)
    }

    // Pass 1: Fill base terrain
    this.fillBaseTerrain(tiles, width, height, surfaceHeights)

    // Pass 2: Carve caves
    this.carveCaves(tiles, width, height, surfaceHeights, caveNoise, detailNoise)

    // Pass 3: Place ores
    this.placeOres(tiles, width, height, oreNoise1, oreNoise2, oreNoise3)

    // Pass 4: Ocean coral
    this.placeCoral(tiles, width, surfaceHeights, detailNoise)

    // Pass 5: Trees
    this.placeTrees(tiles, width, surfaceHeights)

    // Find spawn point — center of map, on surface
    const spawnX = Math.floor(width / 2)
    const spawnY = Math.floor(surfaceHeights[spawnX]!) - 3

    // Clear spawn area so player doesn't spawn inside trees
    for (let dx = -4; dx <= 4; dx++) {
      const sx = spawnX + dx
      if (sx < 0 || sx >= width) continue
      const surfY = Math.floor(surfaceHeights[sx]!)
      for (let y = surfY - 10; y < surfY; y++) {
        if (y < 0) continue
        const idx = y * width + sx
        if (tiles[idx] === TileType.WOOD || tiles[idx] === TileType.LEAVES) {
          tiles[idx] = TileType.AIR
        }
      }
    }

    return { tiles, width, height, seed: this.seed, spawnX, spawnY }
  }

  private fillBaseTerrain(
    tiles: Uint8Array, width: number, height: number,
    surfaceHeights: Float64Array
  ) {
    for (let x = 0; x < width; x++) {
      const surfaceY = Math.floor(surfaceHeights[x]!)
      const distFromEdge = Math.min(x, width - 1 - x)
      const isOcean = distFromEdge < OCEAN_WIDTH

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
          // Surface block
          tiles[idx] = isOcean ? TileType.SAND : TileType.GRASS
        } else if (y < surfaceY + 6) {
          // Sub-surface
          tiles[idx] = isOcean ? TileType.SAND : TileType.DIRT
        } else if (y < UNDERGROUND_START) {
          tiles[idx] = TileType.DIRT
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

  private placeOres(
    tiles: Uint8Array, width: number, height: number,
    oreNoise1: (x: number, y: number) => number,
    oreNoise2: (x: number, y: number) => number,
    oreNoise3: (x: number, y: number) => number
  ) {
    for (let x = 0; x < width; x++) {
      for (let y = UNDERGROUND_START; y < height; y++) {
        const idx = y * width + x
        if (tiles[idx] !== TileType.STONE) continue

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

  private placeCoral(
    tiles: Uint8Array, width: number,
    surfaceHeights: Float64Array,
    detailNoise: (x: number, y: number) => number
  ) {
    for (let x = 0; x < width; x++) {
      const distFromEdge = Math.min(x, width - 1 - x)
      if (distFromEdge >= OCEAN_WIDTH) continue

      const surfaceY = Math.floor(surfaceHeights[x]!)
      for (let y = surfaceY; y < surfaceY + 4; y++) {
        const idx = y * width + x
        if (tiles[idx] === TileType.SAND && detailNoise(x * 0.2, y * 0.2) > 0.4) {
          tiles[idx] = TileType.CORAL
        }
      }
    }
  }

  private placeTrees(tiles: Uint8Array, width: number, surfaceHeights: Float64Array) {
    const rng = this.mulberry32(this.seedNum + 100)

    for (let x = 5; x < width - 5; x++) {
      const distFromEdge = Math.min(x, width - 1 - x)
      if (distFromEdge < OCEAN_WIDTH + 20) continue

      const surfaceY = Math.floor(surfaceHeights[x]!)
      if (tiles[surfaceY * width + x] !== TileType.GRASS) continue

      if (rng() < 0.08) {
        const treeHeight = 4 + Math.floor(rng() * 4)

        // Trunk
        for (let ty = 1; ty <= treeHeight; ty++) {
          const y = surfaceY - ty
          if (y < 0) break
          tiles[y * width + x] = TileType.WOOD
        }

        // Canopy
        const topY = surfaceY - treeHeight
        for (let ly = -2; ly <= 0; ly++) {
          for (let lx = -2; lx <= 2; lx++) {
            const lxi = x + lx
            const lyi = topY + ly
            if (lxi < 0 || lxi >= width || lyi < 0) continue
            if (tiles[lyi * width + lxi] === TileType.AIR) {
              tiles[lyi * width + lxi] = TileType.LEAVES
            }
          }
        }

        x += 3 // min spacing
      }
    }
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
