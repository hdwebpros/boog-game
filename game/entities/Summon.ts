import Phaser from 'phaser'
import { ChunkManager } from '../world/ChunkManager'
import { TILE_SIZE } from '../world/TileRegistry'

export class Summon {
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
  damage: number
  alive = true
  entityId = 0 // unique ID for multiplayer entity tracking
  private scene: Phaser.Scene
  private lifetime: number
  private elapsed = 0
  private attackCooldown = 0
  private targetX = 0
  private targetY = 0
  private ownerRef: { x: number; y: number }

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    damage: number,
    color: number,
    owner: { x: number; y: number },
    lifetime = 15000
  ) {
    this.scene = scene
    this.damage = damage
    this.ownerRef = owner
    this.lifetime = lifetime

    if (scene.textures.exists('summon_minion')) {
      this.sprite = scene.add.image(x, y, 'summon_minion')
      ;(this.sprite as Phaser.GameObjects.Image).setTint(color)
    } else {
      this.sprite = scene.add.rectangle(x, y, 10, 10, color)
    }
    this.sprite.setDepth(11)
    this.targetX = x
    this.targetY = y - 30
  }

  update(dt: number, chunks: ChunkManager, enemies: { sprite: { x: number; y: number }; alive: boolean }[]) {
    if (!this.alive) return

    this.elapsed += dt * 1000
    if (this.elapsed >= this.lifetime) {
      this.destroy()
      return
    }

    this.attackCooldown -= dt * 1000

    // Find nearest enemy
    let nearestDist = 200 // max chase range px
    let nearestEnemy: { sprite: { x: number; y: number }; alive: boolean } | null = null

    for (const e of enemies) {
      if (!e.alive) continue
      const dx = e.sprite.x - this.sprite.x
      const dy = e.sprite.y - this.sprite.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < nearestDist) {
        nearestDist = dist
        nearestEnemy = e
      }
    }

    if (nearestEnemy) {
      this.targetX = nearestEnemy.sprite.x
      this.targetY = nearestEnemy.sprite.y
    } else {
      // Orbit around owner
      const angle = this.elapsed * 0.003
      this.targetX = this.ownerRef.x + Math.cos(angle) * 40
      this.targetY = this.ownerRef.y - 20 + Math.sin(angle) * 20
    }

    // Move toward target (flying, no collision)
    const dx = this.targetX - this.sprite.x
    const dy = this.targetY - this.sprite.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > 2) {
      const speed = 150
      this.sprite.x += (dx / dist) * speed * dt
      this.sprite.y += (dy / dist) * speed * dt
    }

    // Bobbing animation
    this.sprite.y += Math.sin(this.elapsed * 0.005) * 0.3
  }

  canAttack(): boolean {
    return this.attackCooldown <= 0
  }

  resetAttackCooldown() {
    this.attackCooldown = 500
  }

  destroy() {
    this.alive = false
    this.sprite.destroy()
  }

  getBounds() {
    return {
      x: this.sprite.x - 5,
      y: this.sprite.y - 5,
      w: 10,
      h: 10,
    }
  }
}
