import Phaser from 'phaser'

/**
 * Lightweight particle system using Phaser's built-in particle emitters.
 * All particles share a single 2x2 white pixel texture — GPU-batched,
 * so even hundreds of particles use minimal draw calls.
 *
 * Uses a small set of pre-configured emitters (burst, ambient, exhaust)
 * to avoid per-frame config churn.
 */

const PARTICLE_TEXTURE = '__particle_px'
const MAX_BURST = 120
const MAX_AMBIENT = 60

export class ParticleManager {
  private scene: Phaser.Scene
  /** Fast burst emitter — block break, hit sparks, enemy death */
  private burst_em: Phaser.GameObjects.Particles.ParticleEmitter | null = null
  /** Slow ambient emitter — portals, environmental */
  private ambient_em: Phaser.GameObjects.Particles.ParticleEmitter | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.init()
  }

  private init() {
    // Generate shared white pixel texture (once per game lifetime)
    if (!this.scene.textures.exists(PARTICLE_TEXTURE)) {
      const gfx = this.scene.add.graphics()
      gfx.fillStyle(0xffffff, 1)
      gfx.fillRect(0, 0, 2, 2)
      gfx.generateTexture(PARTICLE_TEXTURE, 2, 2)
      gfx.destroy()
    }

    // Burst emitter: fast, radial, short-lived
    this.burst_em = this.scene.add.particles(0, 0, PARTICLE_TEXTURE, {
      lifespan: 350,
      speed: { min: 30, max: 90 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.85, end: 0 },
      emitting: false,
      maxParticles: MAX_BURST,
    })
    this.burst_em.setDepth(45)

    // Ambient emitter: slow, drifting, longer-lived
    this.ambient_em = this.scene.add.particles(0, 0, PARTICLE_TEXTURE, {
      lifespan: 700,
      speed: { min: 4, max: 20 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.6, end: 0 },
      emitting: false,
      maxParticles: MAX_AMBIENT,
    })
    this.ambient_em.setDepth(6) // just above portal sprites
  }

  // ── Burst effects ──────────────────────────────────────────

  /** Small debris burst (block break) */
  burst(x: number, y: number, color: number, count = 6) {
    if (!this.burst_em) return
    this.burst_em.setParticleTint(color)
    this.burst_em.emitParticleAt(x, y, count)
  }

  /** Radial explosion (enemy death) */
  deathBurst(x: number, y: number, color: number) {
    if (!this.burst_em) return
    this.burst_em.setParticleTint(color)
    this.burst_em.emitParticleAt(x, y, 10)
  }

  /** Tiny impact sparks (weapon hit) */
  hitSparks(x: number, y: number, color: number) {
    if (!this.burst_em) return
    this.burst_em.setParticleTint(color)
    this.burst_em.emitParticleAt(x, y, 4)
  }

  /** Downward thrust particle (jetpack exhaust) — 1 per call */
  jetpackExhaust(x: number, y: number) {
    if (!this.burst_em) return
    this.burst_em.setParticleTint(Math.random() > 0.5 ? 0xff6600 : 0xffaa00)
    this.burst_em.emitParticleAt(x, y, 1)
  }

  // ── Ambient effects ────────────────────────────────────────

  /** Portal swirl — emit 1 particle at random position within radius */
  portalAmbient(cx: number, cy: number, radius: number) {
    if (!this.ambient_em) return
    const angle = Math.random() * Math.PI * 2
    const r = Math.random() * radius
    this.ambient_em.setParticleTint(Math.random() > 0.4 ? 0x9966ff : 0x7744ff)
    this.ambient_em.emitParticleAt(
      cx + Math.cos(angle) * r,
      cy + Math.sin(angle) * r,
      1
    )
  }

  /** Void portal — denser, more intense purple swirl */
  voidPortalAmbient(cx: number, cy: number, radius: number) {
    if (!this.ambient_em) return
    const angle = Math.random() * Math.PI * 2
    const r = Math.random() * radius
    const colors = [0x9900ff, 0x6600cc, 0xcc44ff, 0x330066]
    this.ambient_em.setParticleTint(colors[Math.floor(Math.random() * colors.length)]!)
    this.ambient_em.emitParticleAt(
      cx + Math.cos(angle) * r,
      cy + Math.sin(angle) * r,
      1
    )
  }

  destroy() {
    this.burst_em?.destroy()
    this.ambient_em?.destroy()
    this.burst_em = null
    this.ambient_em = null
  }
}
