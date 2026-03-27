import Phaser from 'phaser'

/**
 * Screen-space visual effects: vignette, damage flash, chromatic aberration,
 * desaturation, health bar shake, weapon trails, hit sparks direction.
 */

export class VFXManager {
  private scene: Phaser.Scene

  // ── Vignette (low HP) ──
  private vignetteGfx: Phaser.GameObjects.Graphics
  private vignetteAlpha = 0

  // ── Damage flash ──
  private flashOverlay: Phaser.GameObjects.Rectangle
  private flashTimer = 0

  // ── Chromatic aberration ──
  private aberrationTimer = 0
  private aberrationR: Phaser.GameObjects.Rectangle | null = null
  private aberrationB: Phaser.GameObjects.Rectangle | null = null

  // ── Desaturation (critical HP) ──
  private desatOverlay: Phaser.GameObjects.Rectangle
  private desatAmount = 0

  // ── HP bar shake ──
  hpBarShakeX = 0
  hpBarShakeY = 0
  private hpBarShakeTimer = 0
  private hpBarShakeMagnitude = 0

  // ── Weapon trail ──
  private trailPoints: { x: number; y: number; alpha: number; color: number }[] = []
  private trailGfx: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    // Vignette: drawn as a radial gradient from transparent center to dark red edges
    this.vignetteGfx = scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(49) // just below damage numbers/darkness
      .setAlpha(0)

    // Damage flash: full-screen overlay
    this.flashOverlay = scene.add.rectangle(400, 300, 800, 600, 0xff0000, 0)
      .setScrollFactor(0)
      .setDepth(48)
      .setAlpha(0)

    // Desaturation overlay: gray with blendMode
    this.desatOverlay = scene.add.rectangle(400, 300, 800, 600, 0x222222, 0)
      .setScrollFactor(0)
      .setDepth(47)
      .setAlpha(0)

    // Weapon trail graphics
    this.trailGfx = scene.add.graphics()
      .setDepth(12) // between player and shield
  }

  update(dt: number, hpPct: number) {
    this.updateVignette(dt, hpPct)
    this.updateFlash(dt)
    this.updateAberration(dt)
    this.updateDesaturation(dt, hpPct)
    this.updateHpBarShake(dt)
    this.updateTrail(dt)
  }

  // ── Vignette ──────────────────────────────────────────

  private updateVignette(dt: number, hpPct: number) {
    if (hpPct < 0.25 && hpPct > 0) {
      // Pulse with heartbeat — faster as HP drops
      const heartRate = 2.5 + (1 - hpPct / 0.25) * 4 // 2.5-6.5 Hz
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.001 * heartRate * Math.PI * 2)
      const intensity = (1 - hpPct / 0.25) // 0 at 25%, 1 at 0%
      this.vignetteAlpha = intensity * (0.15 + 0.2 * pulse)
    } else {
      this.vignetteAlpha = Math.max(0, this.vignetteAlpha - dt * 2)
    }

    if (this.vignetteAlpha > 0.001) {
      this.vignetteGfx.setAlpha(1)
      this.drawVignette(this.vignetteAlpha)
    } else {
      this.vignetteGfx.setAlpha(0)
    }
  }

  private drawVignette(alpha: number) {
    this.vignetteGfx.clear()
    // Draw concentric rings from edge inward with decreasing opacity
    const w = 800
    const h = 600
    const cx = w / 2
    const cy = h / 2

    const steps = 6
    for (let i = steps; i >= 1; i--) {
      const outerPct = i / steps
      const a = alpha * outerPct * outerPct // quadratic falloff
      this.vignetteGfx.fillStyle(0x880000, a)
      const outerInset = (1 - outerPct) * Math.min(cx, cy) * 1.2
      this.vignetteGfx.fillRect(outerInset, outerInset, w - outerInset * 2, h - outerInset * 2)
    }
  }

  // ── Damage Flash ──────────────────────────────────────

  triggerDamageFlash(heavy = false) {
    this.flashTimer = heavy ? 100 : 60
    this.flashOverlay.setFillStyle(heavy ? 0xff2222 : 0xffffff, heavy ? 0.25 : 0.15)
    this.flashOverlay.setAlpha(1)
  }

  private updateFlash(dt: number) {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt * 1000
      const t = Math.max(0, this.flashTimer / 100)
      this.flashOverlay.setAlpha(t)
    } else {
      this.flashOverlay.setAlpha(0)
    }
  }

  // ── Chromatic Aberration ──────────────────────────────

  triggerAberration(magnitude = 2) {
    this.aberrationTimer = 100

    // Create offset colored overlays
    if (this.aberrationR) { this.aberrationR.destroy(); this.aberrationR = null }
    if (this.aberrationB) { this.aberrationB.destroy(); this.aberrationB = null }

    this.aberrationR = this.scene.add.rectangle(400 + magnitude, 300, 800, 600, 0xff0000, 0.06)
      .setScrollFactor(0).setDepth(46).setBlendMode(Phaser.BlendModes.ADD)
    this.aberrationB = this.scene.add.rectangle(400 - magnitude, 300, 800, 600, 0x0000ff, 0.06)
      .setScrollFactor(0).setDepth(46).setBlendMode(Phaser.BlendModes.ADD)
  }

  private updateAberration(dt: number) {
    if (this.aberrationTimer > 0) {
      this.aberrationTimer -= dt * 1000
      const t = Math.max(0, this.aberrationTimer / 100)
      this.aberrationR?.setAlpha(0.06 * t)
      this.aberrationB?.setAlpha(0.06 * t)
    } else if (this.aberrationR) {
      this.aberrationR.destroy()
      this.aberrationR = null
      this.aberrationB?.destroy()
      this.aberrationB = null
    }
  }

  // ── Desaturation ──────────────────────────────────────

  private updateDesaturation(dt: number, hpPct: number) {
    const target = hpPct < 0.2 ? (1 - hpPct / 0.2) * 0.35 : 0
    this.desatAmount += (target - this.desatAmount) * Math.min(1, dt * 4)
    this.desatOverlay.setAlpha(this.desatAmount)
  }

  // ── HP Bar Shake ──────────────────────────────────────

  triggerHpBarShake(magnitude = 3) {
    this.hpBarShakeMagnitude = magnitude
    this.hpBarShakeTimer = 200
  }

  private updateHpBarShake(dt: number) {
    if (this.hpBarShakeTimer > 0) {
      this.hpBarShakeTimer -= dt * 1000
      const t = this.hpBarShakeTimer / 200
      const m = this.hpBarShakeMagnitude * t
      this.hpBarShakeX = (Math.random() - 0.5) * 2 * m
      this.hpBarShakeY = (Math.random() - 0.5) * 2 * m
    } else {
      this.hpBarShakeX = 0
      this.hpBarShakeY = 0
    }
  }

  // ── Weapon Trail ──────────────────────────────────────

  addTrailPoint(x: number, y: number, color: number) {
    this.trailPoints.push({ x, y, alpha: 0.6, color })
    if (this.trailPoints.length > 8) this.trailPoints.shift()
  }

  private updateTrail(dt: number) {
    this.trailGfx.clear()
    for (let i = this.trailPoints.length - 1; i >= 0; i--) {
      const p = this.trailPoints[i]!
      p.alpha -= dt * 4
      if (p.alpha <= 0) {
        this.trailPoints.splice(i, 1)
        continue
      }
      this.trailGfx.fillStyle(p.color, p.alpha * 0.4)
      this.trailGfx.fillCircle(p.x, p.y, 2 + p.alpha * 2)
    }
  }

  // ── Directional Hit Sparks ────────────────────────────

  spawnDirectionalSparks(scene: Phaser.Scene, x: number, y: number, fromX: number, fromY: number, color: number) {
    // Direction from attacker to impact
    const dx = x - fromX
    const dy = y - fromY
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const nx = dx / dist
    const ny = dy / dist

    const count = 4 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 1.2
      const speed = 40 + Math.random() * 60
      const vx = (nx * Math.cos(spread) - ny * Math.sin(spread)) * speed
      const vy = (nx * Math.sin(spread) + ny * Math.cos(spread)) * speed

      const spark = scene.add.rectangle(x, y, 2, 2, color)
        .setDepth(45)
      scene.tweens.add({
        targets: spark,
        x: x + vx * 0.3,
        y: y + vy * 0.3,
        alpha: 0,
        scaleX: 0,
        scaleY: 0,
        duration: 150 + Math.random() * 100,
        ease: 'Power2',
        onComplete: () => spark.destroy(),
      })
    }
  }

  destroy() {
    this.vignetteGfx.destroy()
    this.flashOverlay.destroy()
    this.desatOverlay.destroy()
    this.trailGfx.destroy()
    this.aberrationR?.destroy()
    this.aberrationB?.destroy()
  }
}
