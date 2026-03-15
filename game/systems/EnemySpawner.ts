import Phaser from 'phaser'
import { Enemy } from '../entities/Enemy'
import type { EnemyDef } from '../data/enemies'
import { ENEMY_DEFS } from '../data/enemies'
import { ChunkManager } from '../world/ChunkManager'
import { TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT, TileType } from '../world/TileRegistry'

const MAX_ENEMIES_DAY = 15
const MAX_ENEMIES_NIGHT = 22
const SPAWN_INTERVAL_DAY = 2000 // ms
const SPAWN_INTERVAL_NIGHT = 1200 // ms — faster spawns at night
const SPAWN_RANGE_MIN = 400 // min px from player
const SPAWN_RANGE_MAX = 700 // max px from player
const OCEAN_WIDTH = 500

/** Max enemies scales with player count so each player's area feels populated */
const ENEMIES_PER_EXTRA_PLAYER_DAY = 10
const ENEMIES_PER_EXTRA_PLAYER_NIGHT = 14

// Void dimension spawn parameters
const VOID_MAX_ENEMIES_DAY = 18
const VOID_MAX_ENEMIES_NIGHT = 24
const VOID_SPAWN_INTERVAL_DAY = 2150
const VOID_SPAWN_INTERVAL_NIGHT = 1150

// Post-portal spawn parameters (20x normal — world becomes insanely dangerous)
const POST_PORTAL_MAX_ENEMIES_DAY = 300
const POST_PORTAL_MAX_ENEMIES_NIGHT = 440
const POST_PORTAL_SPAWN_INTERVAL_DAY = 100
const POST_PORTAL_SPAWN_INTERVAL_NIGHT = 60

export class EnemySpawner {
  private scene: Phaser.Scene
  private timer = 0
  private enemyTypes: EnemyDef[]
  private surfaceBiomes: Uint8Array | null = null
  voidDimension: boolean = false
  postPortal: boolean = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.enemyTypes = Object.values(ENEMY_DEFS).filter(def => !def.noNaturalSpawn)
  }

  /** Set the surface biome map from world data for biome-specific spawning */
  setSurfaceBiomes(biomes: Uint8Array) {
    this.surfaceBiomes = biomes
  }

  setVoidDimension(val: boolean) {
    this.voidDimension = val
  }

  setPostPortal(val: boolean) {
    this.postPortal = val
  }

  update(
    dt: number,
    chunks: ChunkManager,
    playerPositions: { x: number; y: number }[],
    enemies: Enemy[],
    isNight = false
  ) {
    if (playerPositions.length === 0) return

    let spawnInterval: number
    let baseMax: number
    if (this.postPortal) {
      spawnInterval = isNight ? POST_PORTAL_SPAWN_INTERVAL_NIGHT : POST_PORTAL_SPAWN_INTERVAL_DAY
      baseMax = isNight ? POST_PORTAL_MAX_ENEMIES_NIGHT : POST_PORTAL_MAX_ENEMIES_DAY
    } else if (this.voidDimension) {
      spawnInterval = isNight ? VOID_SPAWN_INTERVAL_NIGHT : VOID_SPAWN_INTERVAL_DAY
      baseMax = isNight ? VOID_MAX_ENEMIES_NIGHT : VOID_MAX_ENEMIES_DAY
    } else {
      spawnInterval = isNight ? SPAWN_INTERVAL_NIGHT : SPAWN_INTERVAL_DAY
      baseMax = isNight ? MAX_ENEMIES_NIGHT : MAX_ENEMIES_DAY
    }
    const extraPlayers = Math.max(0, playerPositions.length - 1)
    const maxEnemies = baseMax + extraPlayers * (isNight ? ENEMIES_PER_EXTRA_PLAYER_NIGHT : ENEMIES_PER_EXTRA_PLAYER_DAY)

    this.timer -= dt * 1000
    if (this.timer > 0) return
    this.timer = spawnInterval

    // Don't exceed max
    const aliveCount = enemies.filter(e => e.alive).length
    if (aliveCount >= maxEnemies) return

    // Pick a random player to spawn near
    const target = playerPositions[Math.floor(Math.random() * playerPositions.length)]!
    const playerX = target.x
    const playerY = target.y

    // Pick a spawn position near the chosen player but off-screen
    const cam = this.scene.cameras.main
    const view = cam.worldView
    let spawnX = 0
    let spawnY = 0
    let attempts = 0
    do {
      const angle = Math.random() * Math.PI * 2
      const dist = SPAWN_RANGE_MIN + Math.random() * (SPAWN_RANGE_MAX - SPAWN_RANGE_MIN)
      spawnX = playerX + Math.cos(angle) * dist
      spawnY = playerY + Math.sin(angle) * dist
      attempts++
    } while (
      attempts < 8 &&
      spawnX > view.x - 32 && spawnX < view.x + view.width + 32 &&
      spawnY > view.y - 32 && spawnY < view.y + view.height + 32
    )
    // If still on-screen after 8 attempts, skip this spawn cycle
    if (spawnX > view.x - 32 && spawnX < view.x + view.width + 32 &&
        spawnY > view.y - 32 && spawnY < view.y + view.height + 32) return

    const spawnTX = Math.floor(spawnX / TILE_SIZE)
    const spawnTY = Math.floor(spawnY / TILE_SIZE)

    // Must be in world bounds
    if (spawnTX < 0 || spawnTX >= WORLD_WIDTH || spawnTY < 0 || spawnTY >= WORLD_HEIGHT) return

    // Determine biome info
    const isOcean = spawnTX < OCEAN_WIDTH || spawnTX >= WORLD_WIDTH - OCEAN_WIDTH
    const surfBiome = this.surfaceBiomes && spawnTX >= 0 && spawnTX < this.surfaceBiomes.length
      ? this.surfaceBiomes[spawnTX]!
      : -1

    // Find valid enemy types for this position
    const valid = this.enemyTypes.filter(def => {
      // Void dimension filter: only spawn void enemies in void, and non-void in normal world
      if (this.voidDimension) {
        if (!def.voidDimension) return false
      } else {
        if (def.voidDimension) return false
      }
      if (spawnTY < def.biomeYMin || spawnTY > def.biomeYMax) return false
      if (def.oceanOnly && !isOcean) return false
      if (!def.oceanOnly && isOcean) return false
      if (def.nightOnly && !isNight) return false
      // Surface biome restriction
      if (def.surfaceBiome != null && surfBiome !== def.surfaceBiome) return false
      return true
    })

    if (valid.length === 0) return

    const def = valid[Math.floor(Math.random() * valid.length)]!

    // Check spawn tile is passable for the enemy
    const isFlying = def.ai === 'swoop' || def.ai === 'ranged' || def.ai === 'phase'
    const isAquatic = def.ai === 'lure'

    if (isAquatic) {
      // Aquatic enemy: must spawn in a water tile
      if (chunks.getTile(spawnTX, spawnTY) !== TileType.WATER) return
      const enemy = new Enemy(this.scene, spawnX, spawnY, def)
      enemies.push(enemy)
    } else if (!isFlying) {
      // Ground enemy: need air above solid ground
      if (chunks.isSolid(spawnTX, spawnTY)) return
      // Find ground below
      let groundY = spawnTY
      for (let y = spawnTY; y < spawnTY + 10; y++) {
        if (chunks.isSolid(spawnTX, y)) {
          groundY = y
          break
        }
      }
      if (groundY === spawnTY) return // no ground found

      const finalY = groundY * TILE_SIZE - def.height / 2
      // Validate the full bounding box is clear of solid tiles
      const halfW = def.width / 2
      const halfH = def.height / 2
      const checkL = Math.floor((spawnX - halfW) / TILE_SIZE)
      const checkR = Math.floor((spawnX + halfW - 0.001) / TILE_SIZE)
      const checkT = Math.floor((finalY - halfH) / TILE_SIZE)
      const checkB = Math.floor((finalY + halfH - 0.001) / TILE_SIZE)
      let spawnBlocked = false
      for (let cy = checkT; cy <= checkB && !spawnBlocked; cy++) {
        for (let cx = checkL; cx <= checkR; cx++) {
          if (chunks.isSolid(cx, cy)) { spawnBlocked = true; break }
        }
      }
      if (spawnBlocked) return

      const enemy = new Enemy(this.scene, spawnX, finalY, def)
      enemies.push(enemy)
    } else {
      // Flying enemy: just needs non-solid spawn point
      if (chunks.isSolid(spawnTX, spawnTY)) return
      const enemy = new Enemy(this.scene, spawnX, spawnY, def)
      enemies.push(enemy)
    }
  }
}
