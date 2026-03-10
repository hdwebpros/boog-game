import Phaser from 'phaser'
import { Enemy } from '../entities/Enemy'
import { Projectile } from '../entities/Projectile'
import type { ProjectileConfig } from '../entities/Projectile'
import { Summon } from '../entities/Summon'
import { ChunkManager } from '../world/ChunkManager'
import type { ItemDef } from '../data/items'
import { AudioManager } from './AudioManager'
import { SoundId } from '../data/sounds'

const MELEE_RANGE = 72 // px (~4.5 tiles, Minecraft-style reach)
const MELEE_ARC = Math.PI * 0.7 // swing arc width (126°)

interface DamageNumber {
  text: Phaser.GameObjects.Text
  vy: number
  lifetime: number
}

interface BurnEffect {
  enemy: Enemy
  dps: number
  remaining: number
  tickTimer: number
}

interface SlowEffect {
  enemy: Enemy
  factor: number
  remaining: number
}

export class CombatSystem {
  private scene: Phaser.Scene
  projectiles: Projectile[] = []
  summons: Summon[] = []
  private damageNumbers: DamageNumber[] = []
  private meleeGfx: Phaser.GameObjects.Graphics
  private burns: BurnEffect[] = []
  private slows: SlowEffect[] = []
  private lastHitEnemies: Enemy[] = [] // enemies hit by last melee/projectile

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.meleeGfx = scene.add.graphics().setDepth(13)
  }

  update(
    dt: number,
    chunks: ChunkManager,
    enemies: Enemy[],
    playerX: number,
    playerY: number,
    playerW: number,
    playerH: number
  ) {
    this.meleeGfx.clear()

    // Update projectiles
    for (const p of this.projectiles) {
      p.update(dt, chunks)
    }
    this.projectiles = this.projectiles.filter(p => p.alive)

    // Update summons
    for (const s of this.summons) {
      s.update(dt, chunks, enemies)
    }
    this.summons = this.summons.filter(s => s.alive)

    // Check player projectile → enemy hits
    for (const p of this.projectiles) {
      if (!p.fromPlayer || !p.alive) continue
      const pb = p.getBounds()
      for (const e of enemies) {
        if (!e.alive || e.intangible) continue
        const eb = e.getBounds()
        if (this.aabbOverlap(pb, eb)) {
          const kbx = (e.sprite.x - playerX) > 0 ? 150 : -150
          e.takeDamage(p.damage, kbx, -80)
          this.spawnDamageNumber(e.sprite.x, e.sprite.y - e.def.height / 2, p.damage, 0xffff00)
          p.destroy()
          break
        }
      }
    }

    // Check enemy projectile → player hits (returned as collision info)
    const playerBounds = {
      x: playerX - playerW / 2,
      y: playerY - playerH / 2,
      w: playerW,
      h: playerH,
    }

    let playerHit: { damage: number; kbx: number; kby: number } | null = null

    for (const p of this.projectiles) {
      if (p.fromPlayer || !p.alive) continue
      if (this.aabbOverlap(p.getBounds(), playerBounds)) {
        playerHit = {
          damage: p.damage,
          kbx: p.vx > 0 ? 100 : -100,
          kby: -80,
        }
        p.destroy()
        break
      }
    }

    // Check summon → enemy hits
    for (const s of this.summons) {
      if (!s.alive || !s.canAttack()) continue
      const sb = s.getBounds()
      for (const e of enemies) {
        if (!e.alive || e.intangible) continue
        const eb = e.getBounds()
        if (this.aabbOverlap(sb, eb)) {
          const kbx = (e.sprite.x - s.sprite.x) > 0 ? 100 : -100
          e.takeDamage(s.damage, kbx, -60)
          this.spawnDamageNumber(e.sprite.x, e.sprite.y - e.def.height / 2, s.damage, 0x44ffaa)
          s.resetAttackCooldown()
          break
        }
      }
    }

    // Update burn effects (Ember enchantment)
    for (const burn of this.burns) {
      if (!burn.enemy.alive) { burn.remaining = 0; continue }
      burn.remaining -= dt * 1000
      burn.tickTimer -= dt * 1000
      if (burn.tickTimer <= 0) {
        burn.tickTimer = 500
        burn.enemy.takeDamage(burn.dps, 0, 0)
        this.spawnDamageNumber(burn.enemy.sprite.x, burn.enemy.sprite.y - burn.enemy.def.height / 2, burn.dps, 0xff6633)
      }
      if (burn.enemy.sprite.active) burn.enemy.sprite.setTint(0xff6633)
      if (burn.remaining <= 0 && burn.enemy.sprite.active) burn.enemy.sprite.clearTint()
    }
    this.burns = this.burns.filter(b => b.remaining > 0)

    // Update slow effects (Frost enchantment)
    for (const slow of this.slows) {
      if (!slow.enemy.alive) { slow.remaining = 0; continue }
      slow.remaining -= dt * 1000
      slow.enemy.speedMult = 1 - slow.factor
      if (slow.enemy.sprite.active) slow.enemy.sprite.setTint(0x6688ff)
      if (slow.remaining <= 0) {
        slow.enemy.speedMult = 1
        if (slow.enemy.sprite.active) slow.enemy.sprite.clearTint()
      }
    }
    this.slows = this.slows.filter(s => s.remaining > 0)

    // Update damage numbers
    for (const dn of this.damageNumbers) {
      dn.text.y += dn.vy * dt
      dn.vy -= 100 * dt
      dn.lifetime -= dt * 1000
      dn.text.setAlpha(Math.max(0, dn.lifetime / 500))
      if (dn.lifetime <= 0) {
        dn.text.destroy()
      }
    }
    this.damageNumbers = this.damageNumbers.filter(d => d.lifetime > 0)

    return playerHit
  }

  /** Apply burn effect to enemies near a point (Ember enchantment) */
  applyBurn(x: number, y: number, dps: number, duration: number) {
    for (const e of this.lastHitEnemies) {
      if (!e.alive) continue
      const existing = this.burns.find(b => b.enemy === e)
      if (existing) {
        existing.remaining = duration
      } else {
        this.burns.push({ enemy: e, dps, remaining: duration, tickTimer: 500 })
      }
    }
  }

  /** Apply slow to enemies near a point (Frost enchantment) */
  applySlow(x: number, y: number, factor: number, duration: number) {
    for (const e of this.lastHitEnemies) {
      if (!e.alive) continue
      const existing = this.slows.find(s => s.enemy === e)
      if (existing) {
        existing.remaining = duration
      } else {
        this.slows.push({ enemy: e, factor, remaining: duration })
      }
    }
  }

  /** Check if an enemy is currently slowed */
  isSlowed(enemy: Enemy): number {
    const slow = this.slows.find(s => s.enemy === enemy && s.remaining > 0)
    return slow ? slow.factor : 0
  }

  /** Chain lightning to a nearby enemy (Storm enchantment) */
  chainLightning(x: number, y: number, damage: number, enemies: Enemy[]) {
    let closest: Enemy | null = null
    let closestDist = 150 // max chain range in pixels
    for (const e of enemies) {
      if (!e.alive || e.intangible) continue
      const dx = e.sprite.x - x
      const dy = e.sprite.y - y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < closestDist && dist > 20) {
        closestDist = dist
        closest = e
      }
    }
    if (closest) {
      closest.takeDamage(damage, 0, -30)
      this.spawnDamageNumber(closest.sprite.x, closest.sprite.y - closest.def.height / 2, damage, 0xffee44)
      // Visual: lightning line
      const gfx = this.scene.add.graphics().setDepth(14)
      gfx.lineStyle(2, 0xffee44, 0.8)
      gfx.beginPath()
      gfx.moveTo(x, y)
      // Jagged line
      const dx = closest.sprite.x - x
      const dy = closest.sprite.y - y
      const steps = 4
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        const jx = x + dx * t + (Math.random() - 0.5) * 20
        const jy = y + dy * t + (Math.random() - 0.5) * 20
        gfx.lineTo(jx, jy)
      }
      gfx.strokePath()
      this.scene.time.delayedCall(150, () => gfx.destroy())
    }
  }

  /** Melee attack: check enemies in arc in front of player. Returns total damage dealt. */
  meleeAttack(
    weapon: ItemDef,
    playerX: number,
    playerY: number,
    facingRight: boolean,
    enemies: Enemy[],
    damageMult = 1
  ): number {
    const angle = facingRight ? 0 : Math.PI
    let totalDamage = 0
    this.lastHitEnemies = []

    // Draw swing arc visual — filled wedge with outline
    const startAngle = angle - MELEE_ARC / 2
    const endAngle = angle + MELEE_ARC / 2
    this.meleeGfx.fillStyle(weapon.color, 0.15)
    this.meleeGfx.beginPath()
    this.meleeGfx.moveTo(playerX, playerY)
    this.meleeGfx.arc(playerX, playerY, MELEE_RANGE, startAngle, endAngle)
    this.meleeGfx.closePath()
    this.meleeGfx.fillPath()
    this.meleeGfx.lineStyle(3, weapon.color, 0.6)
    this.meleeGfx.beginPath()
    this.meleeGfx.arc(playerX, playerY, MELEE_RANGE, startAngle, endAngle)
    this.meleeGfx.strokePath()

    // Fade out after a short time
    this.scene.time.delayedCall(120, () => {
      this.meleeGfx.clear()
    })

    const baseDmg = weapon.damage ?? 0
    const finalDmg = Math.round(baseDmg * damageMult)

    for (const e of enemies) {
      if (!e.alive || e.intangible) continue
      const dx = e.sprite.x - playerX
      const dy = e.sprite.y - playerY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > MELEE_RANGE + e.def.width / 2) continue

      // Check angle
      const enemyAngle = Math.atan2(dy, dx)
      let angleDiff = enemyAngle - angle
      // Normalize
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2

      if (Math.abs(angleDiff) <= MELEE_ARC / 2) {
        const kbx = dx > 0 ? 200 : -200
        e.takeDamage(finalDmg, kbx, -100)
        const dmgColor = damageMult >= 2 ? 0xff4444 : 0xffff00 // red for crits
        this.spawnDamageNumber(e.sprite.x, e.sprite.y - e.def.height / 2, finalDmg, dmgColor)
        totalDamage += finalDmg
        this.lastHitEnemies.push(e)
      }
    }

    AudioManager.get()?.play(totalDamage > 0 ? SoundId.ENEMY_HIT : SoundId.MELEE_SWING)
    return totalDamage
  }

  /** Fire a projectile toward cursor */
  fireProjectile(
    weapon: ItemDef,
    playerX: number,
    playerY: number,
    targetX: number,
    targetY: number,
    fromPlayer: boolean,
    damageMult = 1
  ) {
    const dx = targetX - playerX
    const dy = targetY - playerY
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 1) return

    const speed = weapon.projectileSpeed ?? 400
    const config: ProjectileConfig = {
      x: playerX,
      y: playerY,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      damage: Math.round((weapon.damage ?? 0) * damageMult),
      color: weapon.color,
      size: weapon.weaponStyle === 'magic' ? 8 : 5,
      fromPlayer,
    }

    this.projectiles.push(new Projectile(this.scene, config))
    AudioManager.get()?.play(
      weapon.weaponStyle === 'magic' ? SoundId.MAGIC_CAST : SoundId.RANGED_SHOOT
    )
  }

  /** Fire an enemy projectile */
  fireEnemyProjectile(
    x: number, y: number,
    targetX: number, targetY: number,
    damage: number, color: number
  ) {
    const dx = targetX - x
    const dy = targetY - y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 1) return

    const speed = 250
    const config: ProjectileConfig = {
      x, y,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      damage,
      color,
      size: 4,
      fromPlayer: false,
      lifetime: 2000,
    }

    this.projectiles.push(new Projectile(this.scene, config))
  }

  /** Spawn a summon minion */
  spawnSummon(weapon: ItemDef, playerX: number, playerY: number, owner: { x: number; y: number }) {
    // Limit summons per weapon
    const maxSummons = weapon.id === 161 ? 3 : 1
    const currentCount = this.summons.filter(s => s.alive).length
    if (currentCount >= maxSummons) {
      // Remove oldest
      const oldest = this.summons.find(s => s.alive)
      if (oldest) oldest.destroy()
    }

    const summon = new Summon(
      this.scene,
      playerX + (Math.random() - 0.5) * 30,
      playerY - 30,
      weapon.damage ?? 10,
      weapon.color,
      owner
    )
    this.summons.push(summon)
    AudioManager.get()?.play(SoundId.SUMMON_SPAWN)
  }

  spawnDamageNumber(x: number, y: number, amount: number, color: number) {
    const text = this.scene.add.text(x, y, `${amount}`, {
      fontSize: '14px',
      color: `#${color.toString(16).padStart(6, '0')}`,
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(50)

    this.damageNumbers.push({
      text,
      vy: -60,
      lifetime: 800,
    })
  }

  private aabbOverlap(
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number }
  ): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y
  }

  destroy() {
    for (const p of this.projectiles) p.destroy()
    for (const s of this.summons) s.destroy()
    for (const d of this.damageNumbers) d.text.destroy()
    this.meleeGfx.destroy()
  }
}
