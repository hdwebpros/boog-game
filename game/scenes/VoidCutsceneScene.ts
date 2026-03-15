import Phaser from 'phaser'

/** Dramatic cutscene when the player activates the Super Portal */
export class VoidCutsceneScene extends Phaser.Scene {
  private phase = 0
  private allObjects: Phaser.GameObjects.GameObject[] = []
  private seed = ''
  private saveData: unknown = null
  private playerState: unknown = null

  constructor() {
    super({ key: 'VoidCutsceneScene' })
  }

  init(data: { seed?: string; saveData?: unknown; playerState?: unknown }) {
    this.seed = data?.seed ?? ''
    this.saveData = data?.saveData ?? null
    this.playerState = data?.playerState ?? null
  }

  create() {
    this.phase = 0
    this.allObjects = []

    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor(0x000000)

    // Start the cutscene
    this.phaseOnePortalActivation(width, height)
  }

  // ── Phase 1: Portal Activation (0-7s) ──────────────────────────

  private phaseOnePortalActivation(width: number, height: number) {
    this.phase = 0
    const cx = width / 2
    const cy = height / 2

    // Purple particle effects swirling in center
    const particles: Phaser.GameObjects.Rectangle[] = []
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2
      const dist = 100 + Math.random() * 200
      const px = cx + Math.cos(angle) * dist
      const py = cy + Math.sin(angle) * dist
      const size = 2 + Math.random() * 4
      const color = Math.random() < 0.5 ? 0xaa44ff : 0x8822cc
      const p = this.add.rectangle(px, py, size, size, color, 0.6 + Math.random() * 0.4)
      particles.push(p)
      this.allObjects.push(p)

      // Swirl toward center
      this.tweens.add({
        targets: p,
        x: cx + (Math.random() - 0.5) * 20,
        y: cy + (Math.random() - 0.5) * 20,
        alpha: 0,
        duration: 3000 + Math.random() * 3000,
        ease: 'Quad.easeIn',
      })
    }

    // Portal — expanding purple circle
    const portal = this.add.graphics()
    this.allObjects.push(portal)
    const portalScale = { value: 0 }

    this.tweens.add({
      targets: portalScale,
      value: 1,
      duration: 6000,
      ease: 'Cubic.easeInOut',
      onUpdate: () => {
        portal.clear()
        const r = portalScale.value * 120
        // Outer glow
        portal.fillStyle(0x6622aa, 0.2 * portalScale.value)
        portal.fillEllipse(cx, cy, r * 2.4, r * 1.8)
        // Inner portal
        portal.fillStyle(0x9944ff, 0.5 * portalScale.value)
        portal.fillEllipse(cx, cy, r * 2, r * 1.4)
        // Core
        portal.fillStyle(0xcc88ff, 0.7 * portalScale.value)
        portal.fillEllipse(cx, cy, r * 1.2, r * 0.8)
      },
    })

    // Purple lightning bolts
    this.time.addEvent({
      delay: 800,
      repeat: 7,
      callback: () => {
        this.drawLightning(width, height)
      },
    })

    // Screen shake (rumbling)
    this.cameras.main.shake(6500, 0.005)

    // Narrative text
    const text1 = this.showNarration(
      'The Super Portal tears open a rift between dimensions...',
      cx, 60, 500, 1500
    )

    // Transition to phase 2
    this.time.delayedCall(6500, () => {
      this.fadeOutText(text1, 500)
      this.tweens.add({
        targets: [...this.allObjects],
        alpha: 0,
        duration: 1000,
        onComplete: () => {
          this.allObjects.forEach(o => o.destroy())
          this.allObjects = []
          this.phaseTwoThePull(width, height)
        },
      })
    })
  }

  // ── Phase 2: The Pull (7-14s) ──────────────────────────────────

  private phaseTwoThePull(width: number, height: number) {
    this.phase = 1
    const cx = width / 2
    const cy = height / 2

    // Vortex spiral background
    const vortex = this.add.graphics()
    this.allObjects.push(vortex)
    const vortexAngle = { value: 0 }

    this.tweens.add({
      targets: vortexAngle,
      value: Math.PI * 6,
      duration: 7000,
      ease: 'Linear',
      onUpdate: () => {
        vortex.clear()
        const arms = 5
        for (let a = 0; a < arms; a++) {
          const baseAngle = (a / arms) * Math.PI * 2 + vortexAngle.value
          for (let j = 0; j < 20; j++) {
            const dist = 20 + j * 14
            const angle = baseAngle + j * 0.3
            const px = cx + Math.cos(angle) * dist
            const py = cy + Math.sin(angle) * dist
            const alpha = Math.max(0, 0.6 - j * 0.03)
            const color = j % 2 === 0 ? 0x8833cc : 0x6622aa
            vortex.fillStyle(color, alpha)
            vortex.fillCircle(px, py, 3 + j * 0.3)
          }
        }
      },
    })

    // Debris particles being pulled toward center
    for (let i = 0; i < 25; i++) {
      const edge = Math.random() < 0.5
      const startX = edge ? (Math.random() < 0.5 ? -20 : width + 20) : Math.random() * width
      const startY = edge ? Math.random() * height : (Math.random() < 0.5 ? -20 : height + 20)
      const size = 2 + Math.random() * 6
      const color = Phaser.Display.Color.GetColor(
        100 + Math.floor(Math.random() * 80),
        40 + Math.floor(Math.random() * 40),
        150 + Math.floor(Math.random() * 100)
      )
      const debris = this.add.rectangle(startX, startY, size, size, color, 0.7)
      this.allObjects.push(debris)

      this.tweens.add({
        targets: debris,
        x: cx + (Math.random() - 0.5) * 30,
        y: cy + (Math.random() - 0.5) * 30,
        alpha: 0,
        duration: 2000 + Math.random() * 4000,
        delay: Math.random() * 2000,
        ease: 'Quad.easeIn',
      })
    }

    // Player silhouette getting dragged toward portal
    let playerSil: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
    if (this.textures.exists('player_idle1')) {
      playerSil = this.add.image(width - 150, cy + 40, 'player_idle1').setScale(2).setTint(0x000000).setAlpha(0.8)
    } else {
      playerSil = this.add.rectangle(width - 150, cy + 40, 32, 64, 0x111111, 0.8)
    }
    this.allObjects.push(playerSil)

    this.tweens.add({
      targets: playerSil,
      x: cx,
      y: cy,
      scaleX: 0.5,
      scaleY: 0.5,
      alpha: 0,
      duration: 5500,
      ease: 'Quad.easeIn',
    })

    // Color shift overlay (normal -> deep purple/red)
    const colorOverlay = this.add.rectangle(cx, cy, width, height, 0x330022, 0)
    this.allObjects.push(colorOverlay)

    this.tweens.add({
      targets: colorOverlay,
      alpha: 0.5,
      duration: 6000,
      ease: 'Sine.easeIn',
    })

    // Narrative text
    const text1 = this.showNarration(
      'You feel reality bending around you...',
      cx, 60, 500, 1200
    )

    this.time.delayedCall(3500, () => {
      this.fadeOutText(text1, 600)
      this.showNarration(
        'A world of darkness and fire awaits...',
        cx, 60, 0, 1200
      )
    })

    // Screen shake intensifies
    this.cameras.main.shake(6000, 0.01)

    // Transition to phase 3
    this.time.delayedCall(6500, () => {
      // Flash white
      this.cameras.main.flash(1500, 255, 255, 255)
      this.tweens.add({
        targets: [...this.allObjects],
        alpha: 0,
        duration: 500,
        onComplete: () => {
          this.allObjects.forEach(o => o.destroy())
          this.allObjects = []
          this.time.delayedCall(800, () => {
            this.phaseThreeArrival(width, height)
          })
        },
      })
    })
  }

  // ── Phase 3: Arrival (14-20s) ──────────────────────────────────

  private phaseThreeArrival(width: number, height: number) {
    this.phase = 2
    const cx = width / 2

    // Void dimension landscape
    // Dark purple sky
    this.cameras.main.setBackgroundColor(0x110022)

    // Parallax layer: dark mountains (background)
    const mountains = this.add.graphics()
    this.allObjects.push(mountains)
    mountains.fillStyle(0x1a0033, 1)
    const peaks = [0, 100, 200, 300, 400, 500, 600, 700, 800]
    mountains.beginPath()
    mountains.moveTo(0, height)
    for (const px of peaks) {
      const peakH = 280 + Math.sin(px * 0.02) * 80 + Math.cos(px * 0.01) * 40
      mountains.lineTo(px, peakH)
    }
    mountains.lineTo(width, height)
    mountains.closePath()
    mountains.fillPath()
    mountains.setAlpha(0)

    // Lava glow at bottom
    const lavaGlow = this.add.rectangle(cx, height - 30, width, 60, 0xff2200, 0)
    this.allObjects.push(lavaGlow)

    const lavaPulse = this.add.rectangle(cx, height - 15, width, 30, 0xff4400, 0)
    this.allObjects.push(lavaPulse)

    // Glowing red ground line
    const ground = this.add.rectangle(cx, height - 60, width, 4, 0xff3300, 0)
    this.allObjects.push(ground)

    // Floating embers
    const embers: Phaser.GameObjects.Rectangle[] = []
    for (let i = 0; i < 30; i++) {
      const ex = Math.random() * width
      const ey = height - 60 - Math.random() * 200
      const size = 1 + Math.random() * 3
      const ember = this.add.rectangle(ex, ey, size, size, 0xff6622, 0)
      embers.push(ember)
      this.allObjects.push(ember)
    }

    // Fade in the landscape
    this.tweens.add({
      targets: [mountains, lavaGlow, ground, ...embers],
      alpha: { from: 0, to: 0.8 },
      duration: 2000,
      delay: 200,
    })

    this.tweens.add({
      targets: lavaPulse,
      alpha: { from: 0, to: 0.4 },
      duration: 2000,
      delay: 200,
    })

    // Animate embers floating upward
    for (const ember of embers) {
      this.tweens.add({
        targets: ember,
        y: ember.y - 100 - Math.random() * 200,
        x: ember.x + (Math.random() - 0.5) * 60,
        alpha: 0,
        duration: 3000 + Math.random() * 3000,
        delay: 500 + Math.random() * 2000,
        ease: 'Sine.easeOut',
      })
    }

    // Lava pulse animation
    this.tweens.add({
      targets: lavaPulse,
      alpha: { from: 0.2, to: 0.5 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      delay: 2500,
    })

    // Narrative text
    const text1 = this.showNarration(
      'Welcome to the Void Dimension',
      cx, 80, 1500, 1500
    )

    this.time.delayedCall(4000, () => {
      this.fadeOutText(text1, 600)
      this.showNarration(
        'There are no objectives here. Only power.',
        cx, 80, 0, 1200
      )
    })

    // Final transition — fade to black, then go to BootScene with voidDimension flag
    this.time.delayedCall(6000, () => {
      this.cameras.main.fadeOut(1500, 0, 0, 0)
      this.cameras.main.once('camerafadeoutcomplete', () => {
        // Store data in registry so BootScene can pick it up
        this.registry.set('voidDimension', true)
        this.registry.set('worldSeed', this.seed)
        if (this.playerState) {
          this.registry.set('voidPlayerState', this.playerState)
        }
        if (this.saveData) {
          this.registry.set('returnSaveData', this.saveData)
        }
        this.scene.start('BootScene', { voidDimension: true, seed: this.seed, returnSaveData: this.saveData })
      })
    })
  }

  // ── Helpers ────────────────────────────────────────────────────

  /** Draw a random lightning bolt across the screen */
  private drawLightning(width: number, height: number) {
    const gfx = this.add.graphics()
    this.allObjects.push(gfx)

    const startX = Math.random() * width
    const startY = 0
    const endX = width / 2 + (Math.random() - 0.5) * 200
    const endY = height / 2 + (Math.random() - 0.5) * 100

    const segments = 8 + Math.floor(Math.random() * 6)
    const points: { x: number; y: number }[] = [{ x: startX, y: startY }]

    for (let i = 1; i < segments; i++) {
      const t = i / segments
      const lx = Phaser.Math.Linear(startX, endX, t) + (Math.random() - 0.5) * 60
      const ly = Phaser.Math.Linear(startY, endY, t) + (Math.random() - 0.5) * 30
      points.push({ x: lx, y: ly })
    }
    points.push({ x: endX, y: endY })

    // Draw bolt
    gfx.lineStyle(3, 0xcc88ff, 0.8)
    gfx.beginPath()
    gfx.moveTo(points[0]!.x, points[0]!.y)
    for (let i = 1; i < points.length; i++) {
      gfx.lineTo(points[i]!.x, points[i]!.y)
    }
    gfx.strokePath()

    // Bright core
    gfx.lineStyle(1, 0xeeddff, 1)
    gfx.beginPath()
    gfx.moveTo(points[0]!.x, points[0]!.y)
    for (let i = 1; i < points.length; i++) {
      gfx.lineTo(points[i]!.x, points[i]!.y)
    }
    gfx.strokePath()

    // Fade out quickly
    this.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: 300 + Math.random() * 200,
      onComplete: () => gfx.destroy(),
    })
  }

  /** Fade in a narration text and return it */
  private showNarration(
    text: string, x: number, y: number,
    delay: number, fadeDuration: number
  ): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, text, {
      fontSize: '16px', color: '#cccccc', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setAlpha(0)

    this.tweens.add({
      targets: t,
      alpha: 1,
      duration: fadeDuration,
      delay,
    })

    return t
  }

  /** Fade out and destroy a text object */
  private fadeOutText(text: Phaser.GameObjects.Text, duration: number) {
    this.tweens.add({
      targets: text,
      alpha: 0,
      duration,
      onComplete: () => text.destroy(),
    })
  }
}
