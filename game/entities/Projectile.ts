import Phaser from 'phaser'
import { ChunkManager } from '../world/ChunkManager'
import { TILE_SIZE } from '../world/TileRegistry'

export interface ProjectileConfig {
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  color: number
  size: number
  fromPlayer: boolean
  lifetime?: number // ms, default 3000
}

export class Projectile {
  sprite: Phaser.GameObjects.Rectangle
  vx: number
  vy: number
  damage: number
  fromPlayer: boolean
  alive = true
  private lifetime: number
  private elapsed = 0

  constructor(scene: Phaser.Scene, config: ProjectileConfig) {
    this.sprite = scene.add.rectangle(
      config.x, config.y,
      config.size, config.size,
      config.color
    )
    this.sprite.setDepth(12)
    this.vx = config.vx
    this.vy = config.vy
    this.damage = config.damage
    this.fromPlayer = config.fromPlayer
    this.lifetime = config.lifetime ?? 3000
  }

  update(dt: number, chunks: ChunkManager) {
    if (!this.alive) return

    this.elapsed += dt * 1000
    if (this.elapsed >= this.lifetime) {
      this.destroy()
      return
    }

    this.sprite.x += this.vx * dt
    this.sprite.y += this.vy * dt

    // Destroy on hitting solid tile
    const tx = Math.floor(this.sprite.x / TILE_SIZE)
    const ty = Math.floor(this.sprite.y / TILE_SIZE)
    if (chunks.isSolid(tx, ty)) {
      this.destroy()
    }
  }

  destroy() {
    this.alive = false
    this.sprite.destroy()
  }

  getBounds(): { x: number; y: number; w: number; h: number } {
    return {
      x: this.sprite.x - this.sprite.width / 2,
      y: this.sprite.y - this.sprite.height / 2,
      w: this.sprite.width,
      h: this.sprite.height,
    }
  }
}
