import Phaser from 'phaser'
import type { BossDef, BossPhase } from '../data/bosses'
import { BossAI } from '../data/bosses'
import { ChunkManager } from '../world/ChunkManager'
import { TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT } from '../world/TileRegistry'
import { resolveX, resolveY } from '../systems/PhysicsResolver'

const MAX_BOSS_SPEED = 400

export class Boss {
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
  def: BossDef
  alive = true
  hp: number
  vx = 0
  vy = 0
  entityId = 0 // unique ID for multiplayer entity tracking

  private scene: Phaser.Scene
  private phase: BossPhase
  private phaseIndex = 0
  private attackTimer = 0
  private iFrames = 0
  private flashTimer = 0
  private aiTimer = 0
  private patrolDir = 1
  private isGrounded = false
  private shieldActive = false
  private shieldTimer = 0

  // Boss HP bar (drawn in world space above boss)
  private hpBarGfx: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene, x: number, y: number, def: BossDef) {
    this.scene = scene
    this.def = def
    this.hp = def.maxHp
    this.phase = def.phases[0]!

    const texKey = `boss_${def.type}`
    if (scene.textures.exists(texKey)) {
      this.sprite = scene.add.image(x, y, texKey)
    } else {
      this.sprite = scene.add.rectangle(x, y, def.width, def.height, def.color)
    }
    this.sprite.setDepth(9)

    this.hpBarGfx = scene.add.graphics().setDepth(20)
  }

  update(dt: number, chunks: ChunkManager, playerX: number, playerY: number): {
    shootAtPlayer: boolean
    spawnMinions: boolean
    projectiles: { x: number; y: number; tx: number; ty: number; damage: number }[]
  } {
    if (!this.alive) return { shootAtPlayer: false, spawnMinions: false, projectiles: [] }

    this.iFrames -= dt * 1000
    this.attackTimer -= dt * 1000

    const wasFlashing = this.flashTimer > 0
    this.flashTimer -= dt * 1000
    if (wasFlashing && this.flashTimer <= 0) {
      if ('clearTint' in this.sprite) (this.sprite as Phaser.GameObjects.Image).clearTint()
      else (this.sprite as Phaser.GameObjects.Rectangle).fillColor = this.def.color
    }

    // Update phase based on HP
    this.updatePhase()

    const dx = playerX - this.sprite.x
    const dy = playerY - this.sprite.y
    const distToPlayer = Math.sqrt(dx * dx + dy * dy)

    let result = { shootAtPlayer: false, spawnMinions: false, projectiles: [] as { x: number; y: number; tx: number; ty: number; damage: number }[] }

    switch (this.def.ai) {
      case BossAI.VINE:
        result = this.aiVine(dt, chunks, playerX, playerY, dx, distToPlayer)
        break
      case BossAI.LEVIATHAN:
        result = this.aiLeviathan(dt, chunks, playerX, playerY, dx, dy, distToPlayer)
        break
      case BossAI.GOLEM:
        result = this.aiGolem(dt, chunks, playerX, playerY, dx, distToPlayer)
        break
      case BossAI.WYRM:
        result = this.aiWyrm(dt, chunks, playerX, playerY, dx, dy, distToPlayer)
        break
      case BossAI.SENTINEL:
        result = this.aiSentinel(dt, chunks, playerX, playerY, dx, dy, distToPlayer)
        break
      case BossAI.MOTHERSHIP:
        result = this.aiMothership(dt, chunks, playerX, playerY, dx, dy, distToPlayer)
        break
    }

    this.drawHpBar()
    return result
  }

  takeDamage(amount: number, knockbackX: number, knockbackY: number) {
    if (this.iFrames > 0 || this.shieldActive) return
    this.hp -= amount
    this.iFrames = 150

    // Set knockback velocity (don't accumulate — prevents launch glitch)
    this.vx = knockbackX * 0.3
    this.vy = knockbackY * 0.3

    if ('setTint' in this.sprite) (this.sprite as Phaser.GameObjects.Image).setTint(0xffffff)
    else (this.sprite as Phaser.GameObjects.Rectangle).fillColor = 0xffffff
    this.flashTimer = 80

    if (this.hp <= 0) {
      this.alive = false
    }
  }

  destroy() {
    this.alive = false
    if (this.sprite.active) this.sprite.destroy()
    if (this.hpBarGfx.active) this.hpBarGfx.destroy()
  }

  getPhaseIndex(): number { return this.phaseIndex }
  getShieldActive(): boolean { return this.shieldActive }

  getBounds() {
    return {
      x: this.sprite.x - this.def.width / 2,
      y: this.sprite.y - this.def.height / 2,
      w: this.def.width,
      h: this.def.height,
    }
  }

  private updatePhase() {
    const hpPct = this.hp / this.def.maxHp
    for (let i = this.def.phases.length - 1; i >= 0; i--) {
      const p = this.def.phases[i]!
      if (hpPct <= p.hpThreshold) {
        this.phase = p
        if (i > this.phaseIndex) {
          this.phaseIndex = i
          // Phase transition flash
          if ('setTint' in this.sprite) (this.sprite as Phaser.GameObjects.Image).setTint(0xff0000)
          else (this.sprite as Phaser.GameObjects.Rectangle).fillColor = 0xff0000
          this.flashTimer = 300
        }
        break
      }
    }
  }

  private drawHpBar() {
    this.hpBarGfx.clear()
    if (!this.alive) return

    const barW = this.def.width + 20
    const barH = 4
    const x = this.sprite.x - barW / 2
    const y = this.sprite.y - this.def.height / 2 - 10

    // Background
    this.hpBarGfx.fillStyle(0x330000, 0.8)
    this.hpBarGfx.fillRect(x, y, barW, barH)
    // Fill
    const pct = Math.max(0, this.hp / this.def.maxHp)
    const fillColor = pct > 0.5 ? 0xff2222 : pct > 0.25 ? 0xff8800 : 0xff0000
    this.hpBarGfx.fillStyle(fillColor, 0.9)
    this.hpBarGfx.fillRect(x, y, barW * pct, barH)
    // Border
    this.hpBarGfx.lineStyle(1, 0x882222)
    this.hpBarGfx.strokeRect(x, y, barW, barH)
  }

  // ── AI Behaviors ──────────────────────────────────────────

  private aiVine(dt: number, chunks: ChunkManager, playerX: number, playerY: number, dxToPlayer: number, distToPlayer: number) {
    this.vy += 600 * dt
    if (this.vy > 500) this.vy = 500

    // Chase player
    this.vx = dxToPlayer > 0 ? this.phase.speed : -this.phase.speed
    this.resolveMovement(dt, chunks)

    let spawnMinions = false
    const projectiles: { x: number; y: number; tx: number; ty: number; damage: number }[] = []

    if (this.attackTimer <= 0) {
      this.attackTimer = this.phase.attackInterval

      if (distToPlayer < 200) {
        // Vine whip — spread projectiles
        for (let i = -2; i <= 2; i++) {
          projectiles.push({
            x: this.sprite.x,
            y: this.sprite.y,
            tx: playerX + i * 40,
            ty: playerY,
            damage: this.phase.damage,
          })
        }
      }

      // Spawn minions every other attack in phase 2
      if (this.phaseIndex >= 1 && Math.random() < 0.4) {
        spawnMinions = true
      }
    }

    return { shootAtPlayer: false, spawnMinions, projectiles }
  }

  private aiLeviathan(dt: number, chunks: ChunkManager, playerX: number, playerY: number, dx: number, dy: number, distToPlayer: number) {
    // Swimming — no gravity, but collide with tiles
    const dist = Math.max(1, distToPlayer)
    this.vx = (dx / dist) * this.phase.speed
    this.vy = (dy / dist) * this.phase.speed

    this.resolveMovement(dt, chunks)
    this.clampBoss()

    const projectiles: { x: number; y: number; tx: number; ty: number; damage: number }[] = []

    if (this.attackTimer <= 0) {
      this.attackTimer = this.phase.attackInterval

      // Bubble burst — ring of projectiles
      const count = this.phaseIndex >= 1 ? 8 : 5
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2
        projectiles.push({
          x: this.sprite.x,
          y: this.sprite.y,
          tx: this.sprite.x + Math.cos(angle) * 200,
          ty: this.sprite.y + Math.sin(angle) * 200,
          damage: this.phase.damage,
        })
      }
    }

    return { shootAtPlayer: false, spawnMinions: false, projectiles }
  }

  private aiGolem(dt: number, chunks: ChunkManager, playerX: number, playerY: number, dxToPlayer: number, distToPlayer: number) {
    this.vy += 600 * dt
    if (this.vy > 500) this.vy = 500

    this.vx = dxToPlayer > 0 ? this.phase.speed : -this.phase.speed
    this.resolveMovement(dt, chunks)

    const projectiles: { x: number; y: number; tx: number; ty: number; damage: number }[] = []

    if (this.attackTimer <= 0) {
      this.attackTimer = this.phase.attackInterval

      // Crystal rain from above
      const count = 3 + this.phaseIndex * 2
      for (let i = 0; i < count; i++) {
        const offsetX = (Math.random() - 0.5) * 300
        projectiles.push({
          x: playerX + offsetX,
          y: playerY - 300,
          tx: playerX + offsetX,
          ty: playerY + 50,
          damage: this.phase.damage,
        })
      }

      // Ground slam if close
      if (distToPlayer < 80 && this.isGrounded) {
        this.vy = -200
        projectiles.push(
          { x: this.sprite.x - 60, y: this.sprite.y, tx: this.sprite.x - 60, ty: this.sprite.y - 100, damage: this.phase.damage },
          { x: this.sprite.x + 60, y: this.sprite.y, tx: this.sprite.x + 60, ty: this.sprite.y - 100, damage: this.phase.damage }
        )
      }
    }

    return { shootAtPlayer: false, spawnMinions: false, projectiles }
  }

  private aiWyrm(dt: number, chunks: ChunkManager, playerX: number, playerY: number, dx: number, dy: number, distToPlayer: number) {
    // Flying serpent
    const dist = Math.max(1, distToPlayer)
    const targetDist = 120

    this.aiTimer -= dt * 1000

    if (distToPlayer > targetDist) {
      this.vx += (dx / dist) * this.phase.speed * dt * 3
      this.vy += (dy / dist) * this.phase.speed * dt * 3
    } else {
      // Circle around player
      this.vx += (dy / dist) * this.phase.speed * dt * 2
      this.vy += -(dx / dist) * this.phase.speed * dt * 2
    }

    // Dampen velocity
    this.vx *= 0.93
    this.vy *= 0.93

    this.sprite.x += this.vx * dt
    this.sprite.y += this.vy * dt
    this.clampBoss()

    // Bounce off walls
    const tx = Math.floor(this.sprite.x / TILE_SIZE)
    const ty = Math.floor(this.sprite.y / TILE_SIZE)
    if (chunks.isSolid(tx, ty)) {
      this.vx *= -0.8
      this.vy *= -0.8
      this.sprite.x += this.vx * dt * 3
      this.sprite.y += this.vy * dt * 3
    }

    const projectiles: { x: number; y: number; tx: number; ty: number; damage: number }[] = []

    if (this.attackTimer <= 0) {
      this.attackTimer = this.phase.attackInterval

      // Fire breath — cone of projectiles toward player
      const count = 3 + this.phaseIndex
      for (let i = 0; i < count; i++) {
        const spread = ((i - (count - 1) / 2) / count) * 0.6
        const baseAngle = Math.atan2(dy, dx)
        const angle = baseAngle + spread
        projectiles.push({
          x: this.sprite.x,
          y: this.sprite.y,
          tx: this.sprite.x + Math.cos(angle) * 300,
          ty: this.sprite.y + Math.sin(angle) * 300,
          damage: this.phase.damage,
        })
      }
    }

    return { shootAtPlayer: false, spawnMinions: false, projectiles }
  }

  private aiSentinel(dt: number, chunks: ChunkManager, playerX: number, playerY: number, dx: number, dy: number, distToPlayer: number) {
    // Flying, with shield phases
    const dist = Math.max(1, distToPlayer)

    this.shieldTimer -= dt * 1000
    if (this.shieldTimer <= 0 && this.shieldActive) {
      this.shieldActive = false
    }

    // Maintain distance
    const preferredDist = 150
    if (distToPlayer < preferredDist - 30) {
      this.vx = -(dx / dist) * this.phase.speed
      this.vy = -(dy / dist) * this.phase.speed * 0.5
    } else if (distToPlayer > preferredDist + 50) {
      this.vx = (dx / dist) * this.phase.speed * 0.5
      this.vy = (dy / dist) * this.phase.speed * 0.3
    } else {
      this.vx = (dy / dist) * this.phase.speed * 0.3
      this.vy = -(dx / dist) * this.phase.speed * 0.2
    }

    this.sprite.x += this.vx * dt
    this.sprite.y += this.vy * dt
    this.clampBoss()

    const tx = Math.floor(this.sprite.x / TILE_SIZE)
    const ty = Math.floor(this.sprite.y / TILE_SIZE)
    if (chunks.isSolid(tx, ty)) {
      this.vx *= -1
      this.vy *= -1
      this.sprite.x += this.vx * dt * 2
      this.sprite.y += this.vy * dt * 2
    }

    const projectiles: { x: number; y: number; tx: number; ty: number; damage: number }[] = []

    if (this.attackTimer <= 0) {
      this.attackTimer = this.phase.attackInterval

      // Laser cross pattern
      const count = 4 + this.phaseIndex * 2
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + this.aiTimer * 0.001
        projectiles.push({
          x: this.sprite.x,
          y: this.sprite.y,
          tx: this.sprite.x + Math.cos(angle) * 250,
          ty: this.sprite.y + Math.sin(angle) * 250,
          damage: this.phase.damage,
        })
      }

      // Shield up after attack in later phases
      if (this.phaseIndex >= 1 && Math.random() < 0.3) {
        this.shieldActive = true
        this.shieldTimer = 2000
        if ('setTint' in this.sprite) (this.sprite as Phaser.GameObjects.Image).setTint(0x8888ff)
        else (this.sprite as Phaser.GameObjects.Rectangle).fillColor = 0x8888ff
      }
    }

    this.aiTimer += dt * 1000
    return { shootAtPlayer: false, spawnMinions: false, projectiles }
  }

  private aiMothership(dt: number, chunks: ChunkManager, playerX: number, playerY: number, dx: number, dy: number, distToPlayer: number) {
    // Hover above player
    const targetX = playerX
    const targetY = playerY - 200

    const tdx = targetX - this.sprite.x
    const tdy = targetY - this.sprite.y
    const tdist = Math.sqrt(tdx * tdx + tdy * tdy)

    if (tdist > 10) {
      this.vx = (tdx / tdist) * this.phase.speed
      this.vy = (tdy / tdist) * this.phase.speed
    } else {
      this.vx *= 0.9
      this.vy *= 0.9
    }

    this.sprite.x += this.vx * dt
    this.sprite.y += this.vy * dt
    this.clampBoss()

    const projectiles: { x: number; y: number; tx: number; ty: number; damage: number }[] = []
    let spawnMinions = false

    if (this.attackTimer <= 0) {
      this.attackTimer = this.phase.attackInterval

      // Alternate between beam attacks and drone spawns
      if (Math.random() < 0.6) {
        // Beam attack downward
        const count = 2 + this.phaseIndex
        for (let i = 0; i < count; i++) {
          const offsetX = (i - (count - 1) / 2) * 50
          projectiles.push({
            x: this.sprite.x + offsetX,
            y: this.sprite.y + this.def.height / 2,
            tx: this.sprite.x + offsetX,
            ty: playerY + 50,
            damage: this.phase.damage,
          })
        }
      } else {
        spawnMinions = true
      }
    }

    return { shootAtPlayer: false, spawnMinions, projectiles }
  }

  /** Clamp velocity and keep sprite inside world bounds */
  private clampBoss() {
    this.vx = Phaser.Math.Clamp(this.vx, -MAX_BOSS_SPEED, MAX_BOSS_SPEED)
    this.vy = Phaser.Math.Clamp(this.vy, -MAX_BOSS_SPEED, MAX_BOSS_SPEED)

    const hw = this.def.width / 2
    const hh = this.def.height / 2
    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, hw, WORLD_WIDTH * TILE_SIZE - hw)
    this.sprite.y = Phaser.Math.Clamp(this.sprite.y, hh, WORLD_HEIGHT * TILE_SIZE - hh)
  }

  // ── Physics ───────────────────────────────────────────────

  private resolveMovement(dt: number, chunks: ChunkManager) {
    const hw = this.def.width / 2
    const hh = this.def.height / 2

    const rx = resolveX(this.sprite.x, this.sprite.y, this.vx * dt, hw, hh, chunks)
    this.sprite.x = rx.pos
    if (rx.blocked) this.vx = 0

    const ry = resolveY(this.sprite.x, this.sprite.y, this.vy * dt, hw, hh, chunks)
    this.sprite.y = ry.pos
    this.isGrounded = ry.grounded
    if (ry.blocked) this.vy = 0
  }
}
