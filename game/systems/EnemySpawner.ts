import Phaser from 'phaser'
import { Enemy } from '../entities/Enemy'
import type { EnemyDef } from '../data/enemies'
import { ENEMY_DEFS } from '../data/enemies'
import { ChunkManager } from '../world/ChunkManager'
import { TILE_SIZE, WORLD_WIDTH } from '../world/TileRegistry'

const MAX_ENEMIES = 15
const SPAWN_INTERVAL = 2000 // ms
const SPAWN_RANGE_MIN = 400 // min px from player
const SPAWN_RANGE_MAX = 700 // max px from player
const OCEAN_WIDTH = 350

export class EnemySpawner {
  private scene: Phaser.Scene
  private timer = 0
  private enemyTypes: EnemyDef[]

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.enemyTypes = Object.values(ENEMY_DEFS)
  }

  update(
    dt: number,
    chunks: ChunkManager,
    playerX: number,
    playerY: number,
    enemies: Enemy[]
  ) {
    this.timer -= dt * 1000
    if (this.timer > 0) return
    this.timer = SPAWN_INTERVAL

    // Don't exceed max
    const aliveCount = enemies.filter(e => e.alive).length
    if (aliveCount >= MAX_ENEMIES) return

    // Pick a spawn position near the player
    const angle = Math.random() * Math.PI * 2
    const dist = SPAWN_RANGE_MIN + Math.random() * (SPAWN_RANGE_MAX - SPAWN_RANGE_MIN)
    const spawnX = playerX + Math.cos(angle) * dist
    const spawnY = playerY + Math.sin(angle) * dist

    const spawnTX = Math.floor(spawnX / TILE_SIZE)
    const spawnTY = Math.floor(spawnY / TILE_SIZE)

    // Must be in world bounds
    if (spawnTX < 0 || spawnTX >= WORLD_WIDTH || spawnTY < 0 || spawnTY >= 1200) return

    // Determine biome info
    const isOcean = spawnTX < OCEAN_WIDTH || spawnTX >= WORLD_WIDTH - OCEAN_WIDTH

    // Find valid enemy types for this position
    const valid = this.enemyTypes.filter(def => {
      if (spawnTY < def.biomeYMin || spawnTY > def.biomeYMax) return false
      if (def.oceanOnly && !isOcean) return false
      if (!def.oceanOnly && isOcean) return false
      return true
    })

    if (valid.length === 0) return

    const def = valid[Math.floor(Math.random() * valid.length)]!

    // Check spawn tile is passable for the enemy
    const isFlying = def.ai === 'swoop' || def.ai === 'ranged' || def.ai === 'lure'

    if (!isFlying) {
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
