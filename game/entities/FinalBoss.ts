import Phaser from 'phaser'
import type { BossDef, BossPhase } from '../data/bosses'
import { BossAI } from '../data/bosses'
import type { ChunkManager } from '../world/ChunkManager'
import { TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT } from '../world/TileRegistry'
import { EnemyType } from '../data/enemies'
import { resolveX, resolveY } from '../systems/PhysicsResolver'
import { DifficultyManager } from '../systems/DifficultyManager'

const MAX_BOSS_SPEED = 500

/** Projectile spawn request returned from update(). */
export interface FinalBossProjectile {
  x: number
  y: number
  tx: number
  ty: number
  damage: number
}

/** Dimensional rift hazard zone returned from update(). */
export interface DimensionalRift {
  x: number
  y: number
  width: number
  height: number
  damage: number
  duration: number
}

/** Minion spawn request returned from update(). */
export interface MinionSpawn {
  type: EnemyType
  x: number
  y: number
}

/** Result of a FinalBoss update tick. */
export interface FinalBossUpdateResult {
  shootAtPlayer: boolean
  projectiles: FinalBossProjectile[]
  spawnMinions: MinionSpawn[]
  createRifts: DimensionalRift[]
}

/**
 * The Void Lord — true final boss of Starfall.
 *
 * A massive 128x192 entity with 4 distinct combat phases,
 * minion summoning, dimensional rifts, teleportation, and
 * screen-shake effects.
 */
export class FinalBoss {
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
  def: BossDef
  alive = true
  hp: number
  scaledMaxHp: number
  damageMult: number
  vx = 0
  vy = 0
  entityId = 0

  private scene: Phaser.Scene
  private phase: BossPhase
  private phaseIndex = 0
  private attackTimer = 0
  private iFrames = 0
  private flashTimer = 0
  private aiTimer = 0
  private patrolDir = 1

  // Phase-specific timers
  private minionTimer = 0
  private riftTimer = 0
  private shieldActive = false
  private shieldTimer = 0
  private shieldCooldown = 0
  private teleportTimer = 0

  // Visual effects
  private hpBarGfx: Phaser.GameObjects.Graphics
  private auraGfx: Phaser.GameObjects.Graphics
  private eyeGfx: Phaser.GameObjects.Graphics
  private eyeGlowTimer = 0

  // Animation state
  private hasAnimFrames = false
  private idleFrameTimer = 0
  private idleFrameIndex = 0
  private readonly idleFrames: string[] = []
  private currentAnim: 'idle' | 'attack' | 'cast' = 'idle'
  private animLockTimer = 0
  private baseY = 0 // for hover bob
  private teleportFadeTimer = 0 // fade in/out on teleport

  constructor(scene: Phaser.Scene, x: number, y: number, def: BossDef) {
    this.scene = scene
    this.def = def
    const dm = DifficultyManager.get()
    this.scaledMaxHp = Math.round(def.maxHp * dm.bossHp)
    this.hp = this.scaledMaxHp
    this.damageMult = dm.bossDamage
    this.phase = def.phases[0]!

    // Try loading a sprite, fall back to a rectangle
    const texKey = `boss_${def.type}`
    if (scene.textures.exists(texKey)) {
      this.sprite = scene.add.image(x, y, texKey)
    } else {
      this.sprite = scene.add.rectangle(x, y, def.width, def.height, def.color)
    }
    this.sprite.setDepth(9)

    // Check for animation frames
    const idle2Key = `${texKey}_idle2`
    const attackKey = `${texKey}_attack`
    const castKey = `${texKey}_cast`
    if (scene.textures.exists(idle2Key)) {
      this.hasAnimFrames = true
      this.idleFrames.push(texKey, idle2Key)
    } else {
      this.idleFrames.push(texKey)
    }
    if (!scene.textures.exists(attackKey)) this.hasAnimFrames = false
    if (!scene.textures.exists(castKey)) this.hasAnimFrames = false

    this.baseY = y

    // Void energy aura (drawn behind sprite)
    this.auraGfx = scene.add.graphics().setDepth(8)
    // Glowing eyes (drawn above sprite)
    this.eyeGfx = scene.add.graphics().setDepth(10)
    // HP bar
    this.hpBarGfx = scene.add.graphics().setDepth(20)

    // Initialize phase timers
    this.minionTimer = 15000
    this.riftTimer = 12000
    this.shieldCooldown = 20000
    this.teleportTimer = 10000
  }

  update(
    dt: number,
    chunks: ChunkManager,
    playerX: number,
    playerY: number,
  ): FinalBossUpdateResult {
    if (!this.alive) return { shootAtPlayer: false, projectiles: [], spawnMinions: [], createRifts: [] }

    const dtMs = dt * 1000
    this.iFrames -= dtMs
    this.attackTimer -= dtMs
    this.aiTimer += dtMs
    this.minionTimer -= dtMs
    this.riftTimer -= dtMs
    this.shieldCooldown -= dtMs
    this.teleportTimer -= dtMs
    this.eyeGlowTimer += dtMs

    // Flash recovery
    const wasFlashing = this.flashTimer > 0
    this.flashTimer -= dtMs
    if (wasFlashing && this.flashTimer <= 0) {
      if ('clearTint' in this.sprite) (this.sprite as Phaser.GameObjects.Image).clearTint()
      else (this.sprite as Phaser.GameObjects.Rectangle).fillColor = this.def.color
    }

    // Shield timer
    if (this.shieldActive) {
      this.shieldTimer -= dtMs
      if (this.shieldTimer <= 0) {
        this.shieldActive = false
        if ('clearTint' in this.sprite) (this.sprite as Phaser.GameObjects.Image).clearTint()
        else (this.sprite as Phaser.GameObjects.Rectangle).fillColor = this.def.color
      }
    }

    this.updatePhase()

    const dx = playerX - this.sprite.x
    const dy = playerY - this.sprite.y
    const distToPlayer = Math.sqrt(dx * dx + dy * dy)

    let result: FinalBossUpdateResult

    switch (this.phaseIndex) {
      case 0:
        result = this.aiPhase1(dt, chunks, playerX, playerY, dx, dy, distToPlayer)
        break
      case 1:
        result = this.aiPhase2(dt, chunks, playerX, playerY, dx, dy, distToPlayer)
        break
      case 2:
        result = this.aiPhase3(dt, chunks, playerX, playerY, dx, dy, distToPlayer)
        break
      case 3:
        result = this.aiPhase4(dt, chunks, playerX, playerY, dx, dy, distToPlayer)
        break
      default:
        result = { shootAtPlayer: false, projectiles: [], spawnMinions: [], createRifts: [] }
    }

    this.updateAnimation(dt, playerX)
    this.drawBoss()
    this.drawHpBar()
    return result
  }

  takeDamage(amount: number, knockbackDir: number) {
    if (this.iFrames > 0 || this.shieldActive) return
    this.hp -= amount
    this.iFrames = 150

    // Reduced knockback for the massive boss
    this.vx = knockbackDir * 0.15

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
    if (this.auraGfx.active) this.auraGfx.destroy()
    if (this.eyeGfx.active) this.eyeGfx.destroy()
  }

  getPhaseIndex(): number { return this.phaseIndex }
  getShieldActive(): boolean { return this.shieldActive }
  getContactDamage(): number { return Math.round(this.def.damage * this.damageMult) }

  getBounds() {
    return {
      x: this.sprite.x - this.def.width / 2,
      y: this.sprite.y - this.def.height / 2,
      w: this.def.width,
      h: this.def.height,
    }
  }

  // ── Phase AI ────────────────────────────────────────────

  /**
   * Phase 1 (100-75% HP): Slow patrol, void beams, ground slam,
   * summons 2 void wraiths every 15 seconds.
   */
  private aiPhase1(
    dt: number, chunks: ChunkManager,
    playerX: number, playerY: number,
    dx: number, dy: number, distToPlayer: number,
  ): FinalBossUpdateResult {
    const projectiles: FinalBossProjectile[] = []
    const spawnMinions: MinionSpawn[] = []
    const createRifts: DimensionalRift[] = []

    // Slow patrol toward player
    this.vx = dx > 0 ? this.phase.speed : -this.phase.speed
    this.vy += 600 * dt
    if (this.vy > 500) this.vy = 500
    this.resolveMovement(dt, chunks)

    // Void beam at player
    if (this.attackTimer <= 0) {
      this.attackTimer = this.phase.attackInterval
      this.playAttackAnim()
      projectiles.push({
        x: this.sprite.x,
        y: this.sprite.y - this.def.height * 0.25,
        tx: playerX,
        ty: playerY,
        damage: Math.round(this.phase.damage * this.damageMult),
      })

      // Ground slam when player is close
      if (distToPlayer < 150) {
        for (let i = -3; i <= 3; i++) {
          projectiles.push({
            x: this.sprite.x + i * 40,
            y: this.sprite.y + this.def.height * 0.4,
            tx: this.sprite.x + i * 40,
            ty: this.sprite.y + this.def.height * 0.4 - 120,
            damage: Math.round(this.phase.damage * 0.8 * this.damageMult),
          })
        }
      }
    }

    // Summon 2 void wraiths every 15s
    if (this.minionTimer <= 0) {
      this.minionTimer = 15000
      this.playCastAnim()
      for (let i = 0; i < 2; i++) {
        spawnMinions.push({
          type: EnemyType.VOID_WRAITH,
          x: this.sprite.x + (i === 0 ? -80 : 80),
          y: this.sprite.y,
        })
      }
    }

    return { shootAtPlayer: false, projectiles, spawnMinions, createRifts }
  }

  /**
   * Phase 2 (75-50% HP): Faster, more frequent beams,
   * dimensional rifts, periodic shield.
   */
  private aiPhase2(
    dt: number, chunks: ChunkManager,
    playerX: number, playerY: number,
    dx: number, dy: number, distToPlayer: number,
  ): FinalBossUpdateResult {
    const projectiles: FinalBossProjectile[] = []
    const spawnMinions: MinionSpawn[] = []
    const createRifts: DimensionalRift[] = []

    // Chase player more aggressively
    this.vx = dx > 0 ? this.phase.speed : -this.phase.speed
    this.vy += 600 * dt
    if (this.vy > 500) this.vy = 500
    this.resolveMovement(dt, chunks)

    // Void beams — more frequent, dual shot
    if (this.attackTimer <= 0) {
      this.attackTimer = this.phase.attackInterval
      this.playAttackAnim()
      projectiles.push(
        {
          x: this.sprite.x - 30,
          y: this.sprite.y - this.def.height * 0.25,
          tx: playerX,
          ty: playerY,
          damage: Math.round(this.phase.damage * this.damageMult),
        },
        {
          x: this.sprite.x + 30,
          y: this.sprite.y - this.def.height * 0.25,
          tx: playerX,
          ty: playerY,
          damage: Math.round(this.phase.damage * this.damageMult),
        },
      )
    }

    // Dimensional rifts on the ground
    if (this.riftTimer <= 0) {
      this.riftTimer = 8000
      createRifts.push({
        x: playerX + (Math.random() - 0.5) * 200,
        y: playerY + 20,
        width: 64,
        height: 16,
        damage: Math.round(this.phase.damage * 0.5 * this.damageMult),
        duration: 5000,
      })
    }

    // Shield every 20s for 3 seconds
    if (this.shieldCooldown <= 0 && !this.shieldActive) {
      this.shieldActive = true
      this.shieldTimer = 3000
      this.shieldCooldown = 20000
      if ('setTint' in this.sprite) (this.sprite as Phaser.GameObjects.Image).setTint(0x8888ff)
      else (this.sprite as Phaser.GameObjects.Rectangle).fillColor = 0x8888ff
    }

    // Continue summoning wraiths
    if (this.minionTimer <= 0) {
      this.minionTimer = 15000
      this.playCastAnim()
      for (let i = 0; i < 2; i++) {
        spawnMinions.push({
          type: EnemyType.VOID_WRAITH,
          x: this.sprite.x + (i === 0 ? -80 : 80),
          y: this.sprite.y,
        })
      }
    }

    return { shootAtPlayer: false, projectiles, spawnMinions, createRifts }
  }

  /**
   * Phase 3 (50-25% HP): Teleports near player, spread of 5 void
   * projectiles, summons 4 void wraiths, rifts last longer.
   */
  private aiPhase3(
    dt: number, chunks: ChunkManager,
    playerX: number, playerY: number,
    dx: number, dy: number, distToPlayer: number,
  ): FinalBossUpdateResult {
    const projectiles: FinalBossProjectile[] = []
    const spawnMinions: MinionSpawn[] = []
    const createRifts: DimensionalRift[] = []

    // Teleport near player periodically
    if (this.teleportTimer <= 0) {
      this.teleportTimer = 8000
      const side = Math.random() < 0.5 ? -1 : 1
      this.sprite.x = playerX + side * 200
      this.sprite.y = playerY - 50
      this.vx = 0
      this.vy = 0
      this.triggerTeleportFade()

      // Flash effect on teleport
      if ('setTint' in this.sprite) (this.sprite as Phaser.GameObjects.Image).setTint(0xcc00ff)
      else (this.sprite as Phaser.GameObjects.Rectangle).fillColor = 0xcc00ff
      this.flashTimer = 200
    }

    // Float toward player
    const dist = Math.max(1, distToPlayer)
    this.vx += (dx / dist) * this.phase.speed * dt * 2
    this.vy += (dy / dist) * this.phase.speed * dt * 2
    this.vx *= 0.95
    this.vy *= 0.95
    this.sprite.x += this.vx * dt
    this.sprite.y += this.vy * dt
    this.clampBoss()

    // Spread of 5 void projectiles
    if (this.attackTimer <= 0) {
      this.attackTimer = this.phase.attackInterval
      this.playAttackAnim()
      const baseAngle = Math.atan2(dy, dx)
      for (let i = -2; i <= 2; i++) {
        const angle = baseAngle + i * 0.25
        projectiles.push({
          x: this.sprite.x,
          y: this.sprite.y - this.def.height * 0.25,
          tx: this.sprite.x + Math.cos(angle) * 350,
          ty: this.sprite.y + Math.sin(angle) * 350,
          damage: Math.round(this.phase.damage * this.damageMult),
        })
      }
    }

    // Dimensional rifts — longer duration
    if (this.riftTimer <= 0) {
      this.riftTimer = 6000
      for (let i = 0; i < 2; i++) {
        createRifts.push({
          x: playerX + (Math.random() - 0.5) * 300,
          y: playerY + 20,
          width: 80,
          height: 16,
          damage: Math.round(this.phase.damage * 0.5 * this.damageMult),
          duration: 8000,
        })
      }
    }

    // Summon 4 void wraiths
    if (this.minionTimer <= 0) {
      this.minionTimer = 12000
      this.playCastAnim()
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2
        spawnMinions.push({
          type: EnemyType.VOID_WRAITH,
          x: this.sprite.x + Math.cos(angle) * 100,
          y: this.sprite.y + Math.sin(angle) * 100,
        })
      }
    }

    // Shield
    if (this.shieldCooldown <= 0 && !this.shieldActive) {
      this.shieldActive = true
      this.shieldTimer = 3000
      this.shieldCooldown = 20000
      if ('setTint' in this.sprite) (this.sprite as Phaser.GameObjects.Image).setTint(0x8888ff)
      else (this.sprite as Phaser.GameObjects.Rectangle).fillColor = 0x8888ff
    }

    return { shootAtPlayer: false, projectiles, spawnMinions, createRifts }
  }

  /**
   * Phase 4 (25-0% HP — Enrage): Very fast, constant barrage,
   * summons dark knights, screen shake, rifts everywhere.
   */
  private aiPhase4(
    dt: number, chunks: ChunkManager,
    playerX: number, playerY: number,
    dx: number, dy: number, distToPlayer: number,
  ): FinalBossUpdateResult {
    const projectiles: FinalBossProjectile[] = []
    const spawnMinions: MinionSpawn[] = []
    const createRifts: DimensionalRift[] = []

    // Screen shake effect
    if (this.scene.cameras.main) {
      this.scene.cameras.main.shake(100, 0.003)
    }

    // Aggressive chase with teleports
    if (this.teleportTimer <= 0) {
      this.teleportTimer = 5000
      const side = Math.random() < 0.5 ? -1 : 1
      this.sprite.x = playerX + side * 150
      this.sprite.y = playerY - 40
      this.vx = 0
      this.vy = 0
      this.triggerTeleportFade()

      if ('setTint' in this.sprite) (this.sprite as Phaser.GameObjects.Image).setTint(0xff0000)
      else (this.sprite as Phaser.GameObjects.Rectangle).fillColor = 0xff0000
      this.flashTimer = 150
    }

    // Fast floating pursuit
    const dist = Math.max(1, distToPlayer)
    this.vx += (dx / dist) * this.phase.speed * dt * 3
    this.vy += (dy / dist) * this.phase.speed * dt * 3
    this.vx *= 0.93
    this.vy *= 0.93
    this.sprite.x += this.vx * dt
    this.sprite.y += this.vy * dt
    this.clampBoss()

    // Constant void beam barrage
    if (this.attackTimer <= 0) {
      this.attackTimer = this.phase.attackInterval
      this.playAttackAnim()
      // Ring of projectiles + aimed shots
      const ringCount = 8
      for (let i = 0; i < ringCount; i++) {
        const angle = (i / ringCount) * Math.PI * 2 + this.aiTimer * 0.002
        projectiles.push({
          x: this.sprite.x,
          y: this.sprite.y,
          tx: this.sprite.x + Math.cos(angle) * 300,
          ty: this.sprite.y + Math.sin(angle) * 300,
          damage: Math.round(this.phase.damage * this.damageMult),
        })
      }
      // Direct aimed shots
      projectiles.push(
        {
          x: this.sprite.x - 40,
          y: this.sprite.y - this.def.height * 0.3,
          tx: playerX,
          ty: playerY,
          damage: Math.round(this.phase.damage * 1.2 * this.damageMult),
        },
        {
          x: this.sprite.x + 40,
          y: this.sprite.y - this.def.height * 0.3,
          tx: playerX,
          ty: playerY,
          damage: Math.round(this.phase.damage * 1.2 * this.damageMult),
        },
      )
    }

    // Rifts everywhere
    if (this.riftTimer <= 0) {
      this.riftTimer = 4000
      for (let i = 0; i < 3; i++) {
        createRifts.push({
          x: playerX + (Math.random() - 0.5) * 400,
          y: playerY + (Math.random() - 0.5) * 100,
          width: 96,
          height: 16,
          damage: Math.round(this.phase.damage * 0.6 * this.damageMult),
          duration: 10000,
        })
      }
    }

    // Summon dark knights
    if (this.minionTimer <= 0) {
      this.minionTimer = 10000
      this.playCastAnim()
      for (let i = 0; i < 2; i++) {
        spawnMinions.push({
          type: EnemyType.DARK_KNIGHT,
          x: this.sprite.x + (i === 0 ? -120 : 120),
          y: this.sprite.y,
        })
      }
      // Also summon void wraiths
      for (let i = 0; i < 2; i++) {
        spawnMinions.push({
          type: EnemyType.VOID_WRAITH,
          x: this.sprite.x + (Math.random() - 0.5) * 200,
          y: this.sprite.y - 60,
        })
      }
    }

    return { shootAtPlayer: false, projectiles, spawnMinions, createRifts }
  }

  // ── Phase Management ────────────────────────────────────

  private updatePhase() {
    const hpPct = this.hp / this.scaledMaxHp
    for (let i = this.def.phases.length - 1; i >= 0; i--) {
      const p = this.def.phases[i]!
      if (hpPct <= p.hpThreshold) {
        this.phase = p
        if (i > this.phaseIndex) {
          this.phaseIndex = i
          // Phase transition flash + screen shake
          if ('setTint' in this.sprite) (this.sprite as Phaser.GameObjects.Image).setTint(0xff0000)
          else (this.sprite as Phaser.GameObjects.Rectangle).fillColor = 0xff0000
          this.flashTimer = 500
          if (this.scene.cameras.main) {
            this.scene.cameras.main.shake(500, 0.01)
          }
          // Reset phase-specific timers on transition
          this.minionTimer = 2000
          this.riftTimer = 3000
          this.teleportTimer = 3000
        }
        break
      }
    }
  }

  // ── Animation ──────────────────────────────────────────

  /** Update sprite animation frames, hover bob, facing, and fade effects. */
  private updateAnimation(dt: number, playerX: number) {
    if (!this.alive) return
    const dtMs = dt * 1000
    const isImage = 'setTexture' in this.sprite

    // Facing direction — flip sprite to face player
    if (isImage) {
      (this.sprite as Phaser.GameObjects.Image).setFlipX(playerX < this.sprite.x)
    }

    // Animation lock countdown (for attack/cast hold)
    if (this.animLockTimer > 0) {
      this.animLockTimer -= dtMs
      if (this.animLockTimer <= 0) {
        this.currentAnim = 'idle'
      }
    }

    // Frame cycling for idle animation
    if (this.currentAnim === 'idle' && isImage && this.idleFrames.length > 1) {
      this.idleFrameTimer += dtMs
      // Faster cycle in later phases
      const cycleSpeed = this.phaseIndex >= 3 ? 400 : this.phaseIndex >= 2 ? 600 : 800
      if (this.idleFrameTimer >= cycleSpeed) {
        this.idleFrameTimer = 0
        this.idleFrameIndex = (this.idleFrameIndex + 1) % this.idleFrames.length
        ;(this.sprite as Phaser.GameObjects.Image).setTexture(this.idleFrames[this.idleFrameIndex]!)
      }
    }

    // Hover bob — sinusoidal vertical offset
    const bobSpeed = this.phaseIndex >= 3 ? 0.004 : 0.002
    const bobAmp = this.phaseIndex >= 3 ? 8 : 5
    const bobOffset = Math.sin(this.eyeGlowTimer * bobSpeed) * bobAmp
    // Apply bob only in floating phases (2+), ground phases use resolved Y
    if (this.phaseIndex >= 2) {
      this.sprite.y += bobOffset * dt * 10
    }

    // Teleport fade effect
    if (this.teleportFadeTimer > 0) {
      this.teleportFadeTimer -= dtMs
      const fadeProgress = this.teleportFadeTimer / 300
      if (isImage) {
        (this.sprite as Phaser.GameObjects.Image).setAlpha(1 - fadeProgress * 0.7)
      }
    } else if (isImage) {
      (this.sprite as Phaser.GameObjects.Image).setAlpha(1)
    }

    // Scale pulse in enrage phase
    if (this.phaseIndex >= 3 && isImage) {
      const scalePulse = 1 + Math.sin(this.eyeGlowTimer * 0.006) * 0.03
      ;(this.sprite as Phaser.GameObjects.Image).setScale(scalePulse)
    }
  }

  /** Switch to attack animation frame (held briefly). */
  private playAttackAnim() {
    if (!this.hasAnimFrames || !('setTexture' in this.sprite)) return
    this.currentAnim = 'attack';
    (this.sprite as Phaser.GameObjects.Image).setTexture(`boss_${this.def.type}_attack`)
    this.animLockTimer = 400
  }

  /** Switch to cast/summon animation frame (held briefly). */
  private playCastAnim() {
    if (!this.hasAnimFrames || !('setTexture' in this.sprite)) return
    this.currentAnim = 'cast';
    (this.sprite as Phaser.GameObjects.Image).setTexture(`boss_${this.def.type}_cast`)
    this.animLockTimer = 600
  }

  /** Trigger teleport fade-in effect. */
  private triggerTeleportFade() {
    this.teleportFadeTimer = 300
  }

  // ── Rendering ───────────────────────────────────────────

  /** Draw the void energy aura and glowing eyes. */
  private drawBoss() {
    this.auraGfx.clear()
    this.eyeGfx.clear()
    if (!this.alive) return

    const bx = this.sprite.x
    const by = this.sprite.y
    const hw = this.def.width / 2
    const hh = this.def.height / 2

    // Phase-scaled aura intensity
    const phaseIntensity = 1 + this.phaseIndex * 0.3

    // Void energy aura — pulsing dark purple glow
    const pulse = Math.sin(this.eyeGlowTimer * 0.003) * 0.3 + 0.5
    const auraSize = (12 + pulse * 8) * phaseIntensity

    this.auraGfx.fillStyle(0x4400aa, (0.15 + pulse * 0.1) * phaseIntensity)
    this.auraGfx.fillEllipse(bx, by, this.def.width + auraSize * 2, this.def.height + auraSize * 2)

    // Inner void swirl — more swirl particles in later phases
    const swirlCount = 4 + this.phaseIndex * 2
    this.auraGfx.fillStyle(0x220066, 0.2 * phaseIntensity)
    const swirlAngle = this.eyeGlowTimer * 0.002
    for (let i = 0; i < swirlCount; i++) {
      const angle = swirlAngle + (i / swirlCount) * Math.PI * 2
      const sx = bx + Math.cos(angle) * hw * 0.6
      const sy = by + Math.sin(angle) * hh * 0.5
      this.auraGfx.fillCircle(sx, sy, 8 + pulse * 4)
    }

    // Rising void wisps — energy particles floating upward from the body
    const wispCount = 3 + this.phaseIndex * 2
    for (let i = 0; i < wispCount; i++) {
      const wispPhase = (this.eyeGlowTimer * 0.001 + i * 1.7) % 3
      const wispX = bx + Math.sin(i * 2.3 + this.eyeGlowTimer * 0.003) * hw * 0.8
      const wispY = by + hh * 0.3 - wispPhase * hh * 0.5
      const wispAlpha = (1 - wispPhase / 3) * 0.4
      const wispColor = this.phaseIndex >= 3 ? 0xff00ff : 0x8800cc
      this.auraGfx.fillStyle(wispColor, wispAlpha)
      this.auraGfx.fillCircle(wispX, wispY, 2 + (1 - wispPhase / 3) * 3)
    }

    // Attack glow — brief flash when in attack anim
    if (this.currentAnim === 'attack') {
      this.eyeGfx.fillStyle(0xcc00ff, 0.25)
      this.eyeGfx.fillEllipse(bx, by - hh * 0.2, hw * 1.5, hh * 0.6)
    }

    // Cast glow — portal ring when summoning
    if (this.currentAnim === 'cast') {
      const castPulse = Math.sin(this.eyeGlowTimer * 0.01) * 0.3 + 0.5
      this.eyeGfx.lineStyle(2, 0xcc00ff, castPulse)
      this.eyeGfx.strokeEllipse(bx, by + hh * 0.3, hw * 1.8, 20)
      this.eyeGfx.lineStyle(1, 0x8800ff, castPulse * 0.6)
      this.eyeGfx.strokeEllipse(bx, by + hh * 0.3, hw * 2.2, 28)
    }

    // Shield visual
    if (this.shieldActive) {
      const shieldPulse = Math.sin(this.eyeGlowTimer * 0.008) * 0.2 + 0.6
      this.auraGfx.lineStyle(3, 0x6666ff, shieldPulse)
      this.auraGfx.strokeEllipse(bx, by, this.def.width + 24, this.def.height + 24)
      this.auraGfx.lineStyle(1, 0xaaaaff, shieldPulse * 0.5)
      this.auraGfx.strokeEllipse(bx, by, this.def.width + 32, this.def.height + 32)
    }

    // Glowing purple eyes (4 eyes — outer pair + inner pair)
    const eyeY = by - hh * 0.45
    const outerSpacing = hw * 0.35
    const innerSpacing = hw * 0.15
    const eyeGlow = Math.sin(this.eyeGlowTimer * 0.005) * 0.3 + 0.7
    const eyeRadius = 5 + (this.phaseIndex >= 3 ? 2 : 0)

    // Eye glow halo — outer pair
    this.eyeGfx.fillStyle(0xcc44ff, eyeGlow * 0.4)
    this.eyeGfx.fillCircle(bx - outerSpacing, eyeY, eyeRadius + 4)
    this.eyeGfx.fillCircle(bx + outerSpacing, eyeY, eyeRadius + 4)

    // Eye core — outer pair
    const eyeColor = this.phaseIndex >= 3 ? 0xff0000 : 0xcc00ff
    this.eyeGfx.fillStyle(eyeColor, eyeGlow)
    this.eyeGfx.fillCircle(bx - outerSpacing, eyeY, eyeRadius)
    this.eyeGfx.fillCircle(bx + outerSpacing, eyeY, eyeRadius)

    // Inner pair (smaller, slightly below)
    const innerEyeY = eyeY + 6
    const innerRadius = eyeRadius * 0.7
    this.eyeGfx.fillStyle(0xcc44ff, eyeGlow * 0.3)
    this.eyeGfx.fillCircle(bx - innerSpacing, innerEyeY, innerRadius + 3)
    this.eyeGfx.fillCircle(bx + innerSpacing, innerEyeY, innerRadius + 3)
    this.eyeGfx.fillStyle(eyeColor, eyeGlow * 0.9)
    this.eyeGfx.fillCircle(bx - innerSpacing, innerEyeY, innerRadius)
    this.eyeGfx.fillCircle(bx + innerSpacing, innerEyeY, innerRadius)

    // Eye pupils — all 4 eyes
    this.eyeGfx.fillStyle(0xffffff, 0.9)
    this.eyeGfx.fillCircle(bx - outerSpacing, eyeY, 2)
    this.eyeGfx.fillCircle(bx + outerSpacing, eyeY, 2)
    this.eyeGfx.fillCircle(bx - innerSpacing, innerEyeY, 1.5)
    this.eyeGfx.fillCircle(bx + innerSpacing, innerEyeY, 1.5)

    // Phase 2+ — void energy tendrils
    if (this.phaseIndex >= 1) {
      const tendrilCount = 2 + this.phaseIndex
      for (let i = 0; i < tendrilCount; i++) {
        const tAngle = (i / tendrilCount) * Math.PI + Math.sin(this.eyeGlowTimer * 0.002 + i) * 0.3
        const tLen = hh * 0.4 + Math.sin(this.eyeGlowTimer * 0.004 + i * 2) * 15
        const tx = bx + Math.cos(tAngle) * hw * 0.7
        const ty = by + hh * 0.3
        const tex = tx + Math.cos(tAngle + 0.5) * tLen
        const tey = ty + Math.sin(tAngle) * tLen
        this.auraGfx.lineStyle(2, 0x6600cc, 0.3 + pulse * 0.2)
        this.auraGfx.lineBetween(tx, ty, tex, tey)
        this.auraGfx.fillStyle(0xaa00ff, 0.5)
        this.auraGfx.fillCircle(tex, tey, 3)
      }
    }

    // Enrage visual — more particles orbiting faster in phase 4
    if (this.phaseIndex >= 3) {
      for (let i = 0; i < 10; i++) {
        const pAngle = this.eyeGlowTimer * 0.006 + (i / 10) * Math.PI * 2
        const pDist = hw * 0.9 + Math.sin(this.eyeGlowTimer * 0.008 + i) * 25
        const px = bx + Math.cos(pAngle) * pDist
        const py = by + Math.sin(pAngle) * (hh * 0.8)
        const pColor = i % 2 === 0 ? 0xff00ff : 0xff4400
        this.eyeGfx.fillStyle(pColor, 0.6)
        this.eyeGfx.fillCircle(px, py, 2 + Math.sin(this.eyeGlowTimer * 0.01 + i) * 2)
      }
    } else if (this.phaseIndex >= 2) {
      // Phase 3 — fewer orbiting particles
      for (let i = 0; i < 6; i++) {
        const pAngle = this.eyeGlowTimer * 0.004 + (i / 6) * Math.PI * 2
        const pDist = hw * 0.8 + Math.sin(this.eyeGlowTimer * 0.006 + i) * 20
        const px = bx + Math.cos(pAngle) * pDist
        const py = by + Math.sin(pAngle) * (hh * 0.7)
        this.eyeGfx.fillStyle(0xff00ff, 0.5)
        this.eyeGfx.fillCircle(px, py, 3)
      }
    }
  }

  /** Draw the boss HP bar above the entity. */
  private drawHpBar() {
    this.hpBarGfx.clear()
    if (!this.alive) return

    const barW = this.def.width + 40
    const barH = 6
    const x = this.sprite.x - barW / 2
    const y = this.sprite.y - this.def.height / 2 - 16

    // Background
    this.hpBarGfx.fillStyle(0x330000, 0.8)
    this.hpBarGfx.fillRect(x, y, barW, barH)

    // Fill
    const pct = Math.max(0, this.hp / this.scaledMaxHp)
    const fillColor = pct > 0.5 ? 0x9900ff : pct > 0.25 ? 0xff4400 : 0xff0000
    this.hpBarGfx.fillStyle(fillColor, 0.9)
    this.hpBarGfx.fillRect(x, y, barW * pct, barH)

    // Border
    this.hpBarGfx.lineStyle(1, 0x660088)
    this.hpBarGfx.strokeRect(x, y, barW, barH)

    // Boss name above HP bar
    // (Name is rendered in a persistent text object if needed by the scene)
  }

  // ── Physics ─────────────────────────────────────────────

  /** Clamp velocity and keep sprite inside world bounds. */
  private clampBoss() {
    this.vx = Phaser.Math.Clamp(this.vx, -MAX_BOSS_SPEED, MAX_BOSS_SPEED)
    this.vy = Phaser.Math.Clamp(this.vy, -MAX_BOSS_SPEED, MAX_BOSS_SPEED)

    const hw = this.def.width / 2
    const hh = this.def.height / 2
    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, hw, WORLD_WIDTH * TILE_SIZE - hw)
    this.sprite.y = Phaser.Math.Clamp(this.sprite.y, hh, WORLD_HEIGHT * TILE_SIZE - hh)
  }

  /** Resolve ground-based movement with AABB tile collision. */
  private resolveMovement(dt: number, chunks: ChunkManager) {
    const hw = this.def.width / 2
    const hh = this.def.height / 2

    const rx = resolveX(this.sprite.x, this.sprite.y, this.vx * dt, hw, hh, chunks)
    this.sprite.x = rx.pos
    if (rx.blocked) this.vx = 0

    const ry = resolveY(this.sprite.x, this.sprite.y, this.vy * dt, hw, hh, chunks)
    this.sprite.y = ry.pos
    if (ry.blocked) this.vy = 0
  }
}
