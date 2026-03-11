import Phaser from 'phaser'
import { TILE_SIZE } from '../world/TileRegistry'
import { getItemDef } from '../data/items'

const PICKUP_RADIUS = 24
const PICKUP_DELAY = 500 // ms before item can be picked up (prevents instant re-grab)
const BOB_SPEED = 2.5
const BOB_AMPLITUDE = 3
const GRAVITY = 600
const MAX_FALL = 500
const DESPAWN_TIME = 300_000 // 5 minutes

export class DroppedItem {
  sprite: Phaser.GameObjects.Graphics
  itemId: number
  count: number
  x: number
  y: number
  vx: number
  vy: number
  entityId = 0 // unique ID for multiplayer entity tracking
  alive = true
  private age = 0
  private pickupDelay: number
  private bobOffset: number
  private onGround = false

  constructor(scene: Phaser.Scene, x: number, y: number, itemId: number, count: number, vx = 0, vy = -150) {
    this.itemId = itemId
    this.count = count
    this.x = x
    this.y = y
    this.vx = vx
    this.vy = vy
    this.pickupDelay = PICKUP_DELAY
    this.bobOffset = Math.random() * Math.PI * 2

    // Draw a small item icon (8x8 colored square with border)
    const def = getItemDef(itemId)
    const color = def?.color ?? 0xffffff

    this.sprite = scene.add.graphics()
    this.sprite.setDepth(5)

    // Outer border
    this.sprite.fillStyle(0x000000, 0.5)
    this.sprite.fillRect(-5, -5, 10, 10)
    // Inner colored square
    this.sprite.fillStyle(color, 1)
    this.sprite.fillRect(-4, -4, 8, 8)
    // Highlight
    this.sprite.fillStyle(0xffffff, 0.3)
    this.sprite.fillRect(-4, -4, 3, 2)

    this.sprite.setPosition(x, y)
  }

  update(dt: number, getTile: (tx: number, ty: number) => number): boolean {
    if (!this.alive) return false

    this.age += dt * 1000
    if (this.pickupDelay > 0) this.pickupDelay -= dt * 1000

    // Despawn after time
    if (this.age > DESPAWN_TIME) {
      this.destroy()
      return false
    }

    // Physics — apply gravity, simple tile collision
    if (!this.onGround) {
      this.vy += GRAVITY * dt
      if (this.vy > MAX_FALL) this.vy = MAX_FALL

      this.x += this.vx * dt
      this.y += this.vy * dt

      // Dampen horizontal velocity
      this.vx *= 0.95

      // Check ground collision
      const tx = Math.floor(this.x / TILE_SIZE)
      const ty = Math.floor((this.y + 4) / TILE_SIZE)
      const tile = getTile(tx, ty)
      if (tile > 0) {
        // Snap to top of tile
        this.y = ty * TILE_SIZE - 4
        this.vy = 0
        this.vx = 0
        this.onGround = true
      }
    }

    // Bobbing animation when on ground
    const bobY = this.onGround ? Math.sin((this.age / 1000) * BOB_SPEED + this.bobOffset) * BOB_AMPLITUDE : 0
    this.sprite.setPosition(this.x, this.y + bobY)

    // Blink when about to despawn (last 30 seconds)
    if (this.age > DESPAWN_TIME - 30_000) {
      this.sprite.setAlpha(Math.sin(this.age / 100) > 0 ? 1 : 0.3)
    }

    return true
  }

  canPickup(): boolean {
    return this.pickupDelay <= 0 && this.alive
  }

  isNear(px: number, py: number): boolean {
    const dx = this.x - px
    const dy = this.y - py
    return dx * dx + dy * dy < PICKUP_RADIUS * PICKUP_RADIUS
  }

  destroy() {
    this.alive = false
    if (this.sprite.active) this.sprite.destroy()
  }
}
