import Phaser from 'phaser'
import type { EnemyDef } from '../data/enemies'
import { EnemyAI } from '../data/enemies'
import { ChunkManager } from '../world/ChunkManager'
import { TILE_SIZE } from '../world/TileRegistry'

const GRAVITY = 600
const DESPAWN_DIST = 800 // pixels from camera edge

export class Enemy {
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
  def: EnemyDef
  alive = true
  hp: number
  vx = 0
  vy = 0
  facingRight = true

  private scene: Phaser.Scene
  private iFrames = 0
  private patrolDir = 1
  private patrolTimer = 0
  private aiTimer = 0
  private isGrounded = false
  private charging = false
  private chargeSpeed = 0
  private emerged = false
  private emergeTimer = 0
  private shootCooldown = 0
  private flashTimer = 0

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef) {
    this.scene = scene
    this.def = def
    this.hp = def.hp

    const texKey = `enemy_${def.type}`
    if (scene.textures.exists(texKey)) {
      this.sprite = scene.add.image(x, y, texKey)
    } else {
      this.sprite = scene.add.rectangle(x, y, def.width, def.height, def.color)
    }
    this.sprite.setDepth(9)
    this.patrolDir = Math.random() > 0.5 ? 1 : -1
    this.facingRight = this.patrolDir > 0
  }

  update(dt: number, chunks: ChunkManager, playerX: number, playerY: number): { shootAtPlayer: boolean } {
    if (!this.alive) return { shootAtPlayer: false }

    let result = { shootAtPlayer: false }

    this.iFrames -= dt * 1000
    const wasFlashing = this.flashTimer > 0
    this.flashTimer -= dt * 1000
    if (wasFlashing && this.flashTimer <= 0) {
      if ('clearTint' in this.sprite) (this.sprite as Phaser.GameObjects.Image).clearTint()
      else (this.sprite as Phaser.GameObjects.Rectangle).fillColor = this.def.color
    }

    // Despawn check
    const cam = this.scene.cameras.main
    const view = cam.worldView
    const camL = view.x - DESPAWN_DIST
    const camR = view.x + view.width + DESPAWN_DIST
    const camT = view.y - DESPAWN_DIST
    const camB = view.y + view.height + DESPAWN_DIST
    if (this.sprite.x < camL || this.sprite.x > camR ||
        this.sprite.y < camT || this.sprite.y > camB) {
      this.destroy()
      return result
    }

    const dx = playerX - this.sprite.x
    const dy = playerY - this.sprite.y
    const distToPlayer = Math.sqrt(dx * dx + dy * dy)

    switch (this.def.ai) {
      case EnemyAI.PATROL:
        result = this.aiPatrol(dt, chunks, distToPlayer, dx)
        break
      case EnemyAI.SWOOP:
        result = this.aiSwoop(dt, chunks, playerX, playerY, distToPlayer)
        break
      case EnemyAI.CHARGE:
        result = this.aiCharge(dt, chunks, distToPlayer, dx)
        break
      case EnemyAI.LURE:
        result = this.aiLure(dt, chunks, playerX, playerY, distToPlayer)
        break
      case EnemyAI.EMERGE:
        result = this.aiEmerge(dt, chunks, playerX, playerY, distToPlayer)
        break
      case EnemyAI.RANGED:
        result = this.aiRanged(dt, chunks, playerX, playerY, distToPlayer)
        break
    }

    return result
  }

  takeDamage(amount: number, knockbackX: number, knockbackY: number) {
    if (this.iFrames > 0) return
    this.hp -= amount
    this.iFrames = 200

    // Knockback
    const resist = this.def.knockbackResist
    this.vx += knockbackX * (1 - resist)
    this.vy += knockbackY * (1 - resist)

    // Flash white
    if ('setTint' in this.sprite) (this.sprite as Phaser.GameObjects.Image).setTint(0xffffff)
    else (this.sprite as Phaser.GameObjects.Rectangle).fillColor = 0xffffff
    this.flashTimer = 100

    if (this.hp <= 0) {
      this.alive = false
    }
  }

  getLoot(): { itemId: number; count: number }[] {
    const drops: { itemId: number; count: number }[] = []
    for (const l of this.def.loot) {
      if (Math.random() < l.chance) {
        drops.push({ itemId: l.itemId, count: l.count })
      }
    }
    return drops
  }

  destroy() {
    this.alive = false
    if (this.sprite.active) this.sprite.destroy()
  }

  getBounds() {
    return {
      x: this.sprite.x - this.def.width / 2,
      y: this.sprite.y - this.def.height / 2,
      w: this.def.width,
      h: this.def.height,
    }
  }

  // ── AI behaviors ──────────────────────────────────────────

  private aiPatrol(dt: number, chunks: ChunkManager, distToPlayer: number, dxToPlayer: number) {
    // Apply gravity
    this.vy += GRAVITY * dt
    if (this.vy > 500) this.vy = 500

    // Chase player if close
    if (distToPlayer < 200) {
      this.patrolDir = dxToPlayer > 0 ? 1 : -1
    }

    this.vx = this.patrolDir * this.def.speed
    this.facingRight = this.patrolDir > 0

    // Change direction on wall or edge
    this.patrolTimer -= dt * 1000
    if (this.patrolTimer <= 0) {
      const frontTX = Math.floor((this.sprite.x + this.patrolDir * (this.def.width / 2 + 2)) / TILE_SIZE)
      const feetTY = Math.floor((this.sprite.y + this.def.height / 2) / TILE_SIZE)
      const groundAhead = chunks.isSolid(frontTX, feetTY + 1)
      const wallAhead = chunks.isSolid(frontTX, feetTY) || chunks.isSolid(frontTX, feetTY - 1)

      if (wallAhead || !groundAhead) {
        this.patrolDir *= -1
        this.patrolTimer = 500
      }
    }

    this.resolveMovement(dt, chunks)
    return { shootAtPlayer: false }
  }

  private aiSwoop(dt: number, chunks: ChunkManager, playerX: number, playerY: number, distToPlayer: number) {
    // Flying enemy - no gravity
    this.aiTimer -= dt * 1000

    if (distToPlayer < 250) {
      // Dive at player
      const dx = playerX - this.sprite.x
      const dy = playerY - this.sprite.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      this.vx = (dx / dist) * this.def.speed * 1.5
      this.vy = (dy / dist) * this.def.speed * 1.5
    } else {
      // Wander
      if (this.aiTimer <= 0) {
        this.aiTimer = 1000 + Math.random() * 1500
        this.vx = (Math.random() - 0.5) * this.def.speed
        this.vy = (Math.random() - 0.5) * this.def.speed * 0.5
      }
    }

    this.facingRight = this.vx > 0
    const prevX = this.sprite.x
    const prevY = this.sprite.y
    this.sprite.x += this.vx * dt
    this.sprite.y += this.vy * dt

    // Bounce off solid tiles — check bounding box, not just center
    const hw = this.def.width / 2
    const hh = this.def.height / 2
    const tl = Math.floor((this.sprite.x - hw) / TILE_SIZE)
    const tr = Math.floor((this.sprite.x + hw - 0.001) / TILE_SIZE)
    const tt = Math.floor((this.sprite.y - hh) / TILE_SIZE)
    const tb = Math.floor((this.sprite.y + hh - 0.001) / TILE_SIZE)
    let hitSolid = false
    for (let ty = tt; ty <= tb && !hitSolid; ty++) {
      for (let tx = tl; tx <= tr; tx++) {
        if (chunks.isSolid(tx, ty)) {
          hitSolid = true
          break
        }
      }
    }
    if (hitSolid) {
      // Revert to previous position and reverse velocity
      this.sprite.x = prevX
      this.sprite.y = prevY
      this.vx *= -1
      this.vy *= -1
    }

    return { shootAtPlayer: false }
  }

  private aiCharge(dt: number, chunks: ChunkManager, distToPlayer: number, dxToPlayer: number) {
    this.vy += GRAVITY * dt
    if (this.vy > 500) this.vy = 500

    if (this.charging) {
      this.vx = this.chargeSpeed
      this.aiTimer -= dt * 1000
      if (this.aiTimer <= 0) {
        this.charging = false
        this.aiTimer = 1500
      }
    } else {
      this.aiTimer -= dt * 1000
      if (distToPlayer < 200 && this.aiTimer <= 0) {
        // Start charge
        this.charging = true
        this.chargeSpeed = (dxToPlayer > 0 ? 1 : -1) * this.def.speed * 3
        this.aiTimer = 800
      } else {
        // Slow patrol
        this.vx = this.patrolDir * this.def.speed * 0.5
      }
    }

    this.facingRight = this.vx > 0
    this.resolveMovement(dt, chunks)
    return { shootAtPlayer: false }
  }

  private aiLure(dt: number, chunks: ChunkManager, playerX: number, playerY: number, distToPlayer: number) {
    // Swimming/floating enemy
    this.aiTimer -= dt * 1000

    if (distToPlayer < 150) {
      // Lunge at player
      const dx = playerX - this.sprite.x
      const dy = playerY - this.sprite.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      this.vx = (dx / dist) * this.def.speed * 2
      this.vy = (dy / dist) * this.def.speed * 2
    } else if (distToPlayer < 300) {
      // Slowly approach
      const dx = playerX - this.sprite.x
      const dy = playerY - this.sprite.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      this.vx = (dx / dist) * this.def.speed * 0.3
      this.vy = (dy / dist) * this.def.speed * 0.3
    } else {
      // Drift
      if (this.aiTimer <= 0) {
        this.aiTimer = 2000 + Math.random() * 2000
        this.vx = (Math.random() - 0.5) * this.def.speed * 0.5
        this.vy = (Math.random() - 0.5) * this.def.speed * 0.3
      }
    }

    this.facingRight = this.vx > 0
    if ('setFlipX' in this.sprite) (this.sprite as Phaser.GameObjects.Image).setFlipX(!this.facingRight)
    this.sprite.x += this.vx * dt
    this.sprite.y += this.vy * dt

    // Dampen velocity in water
    this.vx *= 0.95
    this.vy *= 0.95

    return { shootAtPlayer: false }
  }

  private aiEmerge(dt: number, chunks: ChunkManager, playerX: number, playerY: number, distToPlayer: number) {
    if (!this.emerged) {
      this.emergeTimer -= dt * 1000
      // Hide underground, emerge when player is close
      if (distToPlayer < 200) {
        this.emerged = true
        this.vy = -250 // jump out
        this.emergeTimer = 4000
      } else {
        // Stay hidden
        this.sprite.setAlpha(0.3)
        return { shootAtPlayer: false }
      }
    }

    this.sprite.setAlpha(1)
    this.vy += GRAVITY * dt
    if (this.vy > 500) this.vy = 500

    // Chase player
    const dx = playerX - this.sprite.x
    this.vx = dx > 0 ? this.def.speed : -this.def.speed
    this.facingRight = this.vx > 0

    this.resolveMovement(dt, chunks)

    this.emergeTimer -= dt * 1000
    if (this.emergeTimer <= 0) {
      this.emerged = false
      this.emergeTimer = 3000
    }

    return { shootAtPlayer: false }
  }

  private aiRanged(dt: number, chunks: ChunkManager, playerX: number, playerY: number, distToPlayer: number) {
    // Flying enemy that shoots
    this.shootCooldown -= dt * 1000

    // Try to maintain distance
    const preferredDist = 150
    const dx = playerX - this.sprite.x
    const dy = playerY - this.sprite.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < preferredDist - 30) {
      // Too close, back away
      this.vx = -(dx / dist) * this.def.speed
      this.vy = -(dy / dist) * this.def.speed * 0.5
    } else if (dist > preferredDist + 50) {
      // Too far, approach
      this.vx = (dx / dist) * this.def.speed * 0.5
      this.vy = (dy / dist) * this.def.speed * 0.3
    } else {
      // Strafe
      this.vx = (dy / dist) * this.def.speed * 0.3
      this.vy = -(dx / dist) * this.def.speed * 0.2
    }

    this.facingRight = dx > 0
    const prevRX = this.sprite.x
    const prevRY = this.sprite.y
    this.sprite.x += this.vx * dt
    this.sprite.y += this.vy * dt

    // Bounce off walls — check bounding box
    const rhw = this.def.width / 2
    const rhh = this.def.height / 2
    const rtl = Math.floor((this.sprite.x - rhw) / TILE_SIZE)
    const rtr = Math.floor((this.sprite.x + rhw - 0.001) / TILE_SIZE)
    const rtt = Math.floor((this.sprite.y - rhh) / TILE_SIZE)
    const rtb = Math.floor((this.sprite.y + rhh - 0.001) / TILE_SIZE)
    let rHitSolid = false
    for (let ty = rtt; ty <= rtb && !rHitSolid; ty++) {
      for (let tx = rtl; tx <= rtr; tx++) {
        if (chunks.isSolid(tx, ty)) {
          rHitSolid = true
          break
        }
      }
    }
    if (rHitSolid) {
      this.sprite.x = prevRX
      this.sprite.y = prevRY
      this.vx *= -1
      this.vy *= -1
    }

    // Shoot at player
    let shootAtPlayer = false
    if (distToPlayer < 300 && this.shootCooldown <= 0) {
      this.shootCooldown = 1500
      shootAtPlayer = true
    }

    return { shootAtPlayer }
  }

  // ── Physics ───────────────────────────────────────────────

  private resolveMovement(dt: number, chunks: ChunkManager) {
    const hw = this.def.width / 2
    const hh = this.def.height / 2

    // Safety: if already stuck inside a solid tile, push out
    const cx = Math.floor(this.sprite.x / TILE_SIZE)
    const cy = Math.floor(this.sprite.y / TILE_SIZE)
    if (chunks.isSolid(cx, cy)) {
      // Push up to nearest open tile
      for (let tryY = cy - 1; tryY >= cy - 5; tryY--) {
        if (!chunks.isSolid(cx, tryY)) {
          this.sprite.y = tryY * TILE_SIZE + TILE_SIZE - hh
          this.vy = 0
          break
        }
      }
    }

    // X
    const newX = this.sprite.x + this.vx * dt
    const tl = Math.floor((newX - hw) / TILE_SIZE)
    const tr = Math.floor((newX + hw - 0.001) / TILE_SIZE)
    const tt = Math.floor((this.sprite.y - hh) / TILE_SIZE)
    const tb = Math.floor((this.sprite.y + hh - 0.001) / TILE_SIZE)

    let blockedX = false
    for (let ty = tt; ty <= tb && !blockedX; ty++) {
      for (let tx = tl; tx <= tr; tx++) {
        if (chunks.isSolid(tx, ty)) {
          blockedX = true
          if (this.vx > 0) this.sprite.x = tx * TILE_SIZE - hw
          else this.sprite.x = (tx + 1) * TILE_SIZE + hw
          this.vx = 0
          break
        }
      }
    }
    if (!blockedX) this.sprite.x = newX

    // Y
    const newY = this.sprite.y + this.vy * dt
    const tl2 = Math.floor((this.sprite.x - hw) / TILE_SIZE)
    const tr2 = Math.floor((this.sprite.x + hw - 0.001) / TILE_SIZE)
    const tt2 = Math.floor((newY - hh) / TILE_SIZE)
    const tb2 = Math.floor((newY + hh - 0.001) / TILE_SIZE)

    let blockedY = false
    this.isGrounded = false
    for (let ty = tt2; ty <= tb2 && !blockedY; ty++) {
      for (let tx = tl2; tx <= tr2; tx++) {
        if (chunks.isSolid(tx, ty)) {
          blockedY = true
          if (this.vy > 0) {
            this.sprite.y = ty * TILE_SIZE - hh
            this.isGrounded = true
          } else {
            this.sprite.y = (ty + 1) * TILE_SIZE + hh
          }
          this.vy = 0
          break
        }
      }
    }
    if (!blockedY) this.sprite.y = newY

    // Wall bounce for patrol types
    if (blockedX && (this.def.ai === EnemyAI.PATROL || this.def.ai === EnemyAI.CHARGE)) {
      this.patrolDir *= -1
    }
  }
}
