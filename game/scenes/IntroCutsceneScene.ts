import Phaser from 'phaser'

/**
 * Intro cutscene: shuttle crash-landing, plays between menu and world load.
 * BootScene runs in parallel (loading assets + generating world).
 * ~8.5 seconds total, skippable with any key.
 */
export class IntroCutsceneScene extends Phaser.Scene {
  private stars: Phaser.GameObjects.Rectangle[] = []
  private starScrollSpeed = 0

  private shuttle!: Phaser.GameObjects.Container
  private engineGlow!: Phaser.GameObjects.Graphics

  private astronaut!: Phaser.GameObjects.Container
  private astroFrame = 0
  private astroTimer = 0
  private astroImages: Phaser.GameObjects.Image[] = []

  private flashRect!: Phaser.GameObjects.Rectangle
  private fadeRect!: Phaser.GameObjects.Rectangle

  private cutsceneComplete = false
  private skipLabel!: Phaser.GameObjects.Text
  private loadingLabel: Phaser.GameObjects.Text | null = null
  private loadingDots = 0
  private loadingTimer = 0

  constructor() {
    super({ key: 'IntroCutsceneScene' })
  }

  preload() {
    this.load.image('astro_fall_0', '/sprites/astro_fall_0.png')
    this.load.image('astro_fall_1', '/sprites/astro_fall_1.png')
  }

  create() {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor(0x0a0a1a)
    this.cutsceneComplete = false
    this.starScrollSpeed = 0
    this.loadingLabel = null
    this.loadingDots = 0
    this.loadingTimer = 0

    // ── Starfield ──
    this.stars = []
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      const size = Math.random() < 0.1 ? 3 : Math.random() < 0.3 ? 2 : 1
      const alpha = Math.random() * 0.6 + 0.2
      const star = this.add.rectangle(x, y, size, size, 0xffffff, alpha)
      this.stars.push(star)
      this.tweens.add({
        targets: star,
        alpha: { from: alpha, to: alpha * 0.2 },
        duration: 800 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
      })
    }

    // ── Build shuttle (graphics primitives) ──
    this.buildShuttle(width, height)

    // ── Build astronaut (hidden initially) ──
    this.buildAstronaut()
    this.astronaut.setVisible(false)

    // ── Overlays ──
    this.flashRect = this.add.rectangle(width / 2, height / 2, width, height, 0xff8800, 0).setDepth(90)
    this.fadeRect = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0).setDepth(100)

    // ── Skip hint ──
    this.skipLabel = this.add.text(width - 10, height - 10, 'Press any key to skip', {
      fontSize: '11px', color: '#555555', fontFamily: 'monospace',
    }).setOrigin(1, 1).setDepth(110)

    this.input.keyboard!.on('keydown', () => this.skipCutscene())
    this.input.on('pointerdown', () => this.skipCutscene())

    // ── Launch BootScene in parallel (hidden behind this scene) ──
    this.scene.launch('BootScene')
    this.scene.bringToTop('IntroCutsceneScene')

    // ── Begin animation ──
    this.phaseOneShuttleCruise(width, height)
  }

  override update(_time: number, delta: number) {
    const { width, height } = this.scale

    // Scroll stars downward (falling-through-space effect)
    if (this.starScrollSpeed > 0) {
      for (const star of this.stars) {
        star.y += this.starScrollSpeed * (delta / 16)
        if (star.y > height + 5) {
          star.y = -5
          star.x = Math.random() * width
        }
      }
    }

    // Astronaut 2-frame animation
    if (this.astronaut.visible) {
      this.astroTimer += delta
      if (this.astroTimer > 250) {
        this.astroTimer = 0
        this.astroFrame = (this.astroFrame + 1) % 2
        this.astroImages[0]!.setVisible(this.astroFrame === 0)
        this.astroImages[1]!.setVisible(this.astroFrame === 1)
      }
    }

    // Waiting for BootScene after cutscene ends
    if (this.cutsceneComplete && this.loadingLabel) {
      this.loadingTimer += delta
      if (this.loadingTimer > 400) {
        this.loadingTimer = 0
        this.loadingDots = (this.loadingDots + 1) % 4
        this.loadingLabel.setText('Loading' + '.'.repeat(this.loadingDots))
      }
      if (this.registry.get('bootComplete')) {
        this.transitionToWorld()
      }
    }
  }

  // ── Shuttle construction ──────────────────────────────────────

  private buildShuttle(_width: number, height: number) {
    const hull = this.add.graphics()

    // Main fuselage — light gray
    hull.fillStyle(0xc0c7d1)
    hull.fillRoundedRect(-40, -10, 80, 20, 5)

    // Cockpit window — bright blue
    hull.fillStyle(0x4db3ff)
    hull.fillRoundedRect(28, -6, 14, 12, 3)

    // Top fin — darker gray
    hull.fillStyle(0x8c949e)
    hull.fillTriangle(-15, -10, -28, -28, 8, -10)

    // Bottom fin
    hull.fillStyle(0x8c949e)
    hull.fillTriangle(-15, 10, -28, 28, 8, 10)

    // Engine nozzle
    hull.fillStyle(0x666666)
    hull.fillRect(-44, -7, 8, 14)

    // Engine exhaust glow
    this.engineGlow = this.add.graphics()
    this.engineGlow.fillStyle(0x66b3ff, 0.7)
    this.engineGlow.fillEllipse(-52, 0, 20, 12)

    this.shuttle = this.add.container(-100, height * 0.4, [hull, this.engineGlow])
    this.shuttle.setScale(2)
    this.shuttle.setDepth(10)
  }

  // ── Astronaut (PNG sprites from Godot project) ────────────────

  private buildAstronaut() {
    const f0 = this.add.image(0, 0, 'astro_fall_0').setOrigin(0.5)
    const f1 = this.add.image(0, 0, 'astro_fall_1').setOrigin(0.5)
    f1.setVisible(false)

    this.astroImages = [f0, f1]
    this.astronaut = this.add.container(0, -60, [f0, f1])
    this.astronaut.setScale(4)
    this.astronaut.setDepth(15)
  }

  // ── Phase 1: Shuttle cruises in (0 – 2.5s) ───────────────────

  private phaseOneShuttleCruise(width: number, height: number) {
    // Engine glow pulse
    this.tweens.add({
      targets: this.engineGlow,
      alpha: { from: 0.4, to: 0.8 },
      duration: 300,
      yoyo: true,
      repeat: -1,
    })

    // Fly from left to center-right
    this.tweens.add({
      targets: this.shuttle,
      x: width * 0.55,
      duration: 2500,
      ease: 'Sine.easeOut',
      onComplete: () => this.phaseTwoImpact(width, height),
    })
  }

  // ── Phase 2: Impact & destruction (2.5 – 5.5s) ───────────────

  private phaseTwoImpact(width: number, height: number) {
    // Orange flash
    this.flashRect.setFillStyle(0xff8800, 0)
    this.tweens.add({
      targets: this.flashRect,
      alpha: { from: 0, to: 0.7 },
      duration: 60,
      onComplete: () => {
        this.tweens.add({ targets: this.flashRect, alpha: 0, duration: 500 })
      },
    })

    // Debris burst
    for (let i = 0; i < 16; i++) {
      const angle = (Math.random() - 0.5) * Math.PI * 0.56
      const speed = 30 + Math.random() * 110
      const size = 2 + Math.random() * 4
      const t = Math.random()
      const r = Math.round(255 - t * 155)
      const g = Math.round(140 - t * 120)
      const b = Math.round(t * 0)
      const color = Phaser.Display.Color.GetColor(r, g, b)

      const debris = this.add.rectangle(
        this.shuttle.x, this.shuttle.y,
        size, size, color, 0.9,
      ).setDepth(20)

      const vx = Math.cos(angle + Math.PI) * speed
      const vy = Math.sin(angle + Math.PI) * speed

      this.tweens.add({
        targets: debris,
        x: debris.x + vx * 3,
        y: debris.y + vy * 3 + 60,
        alpha: 0,
        duration: 1500,
        ease: 'Quad.easeOut',
        onComplete: () => debris.destroy(),
      })
    }

    // Engine glow dies
    this.tweens.add({ targets: this.engineGlow, alpha: 0, duration: 300 })

    // Shuttle tumbles & falls off screen
    this.time.delayedCall(300, () => {
      this.tweens.add({
        targets: this.shuttle,
        x: width * 0.3,
        y: height + 120,
        angle: 720,
        alpha: 0,
        duration: 2700,
        ease: 'Quad.easeIn',
      })
    })

    // Start astronaut fall overlapping with shuttle fall
    this.time.delayedCall(1000, () => this.phaseThreeAstronautFall(width, height))
  }

  // ── Phase 3: Astronaut falls (3.5 – 7s) ──────────────────────

  private phaseThreeAstronautFall(width: number, height: number) {
    this.astronaut.setPosition(width * 0.48, -60)
    this.astronaut.setAngle(-17)
    this.astronaut.setVisible(true)
    this.astronaut.setAlpha(1)
    this.astroFrame = 0
    this.astroTimer = 0
    this.astroImages[0]!.setVisible(true)
    this.astroImages[1]!.setVisible(false)

    // Starfield accelerates downward (atmospheric entry feel)
    this.tweens.add({
      targets: this,
      starScrollSpeed: { from: 0.3, to: 4 },
      duration: 3000,
      ease: 'Quad.easeIn',
    })

    // Astronaut falls & tumbles
    this.tweens.add({
      targets: this.astronaut,
      y: height * 0.55,
      angle: 540,
      duration: 3000,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.astronaut.setVisible(false)
        this.phaseFourFade(width, height)
      },
    })
  }

  // ── Phase 4: Ground impact & fade to black (7 – 8.5s) ────────

  private phaseFourFade(_width: number, _height: number) {
    // White flash
    this.flashRect.setFillStyle(0xffffff, 0)
    this.tweens.add({
      targets: this.flashRect,
      alpha: { from: 0, to: 0.7 },
      duration: 80,
      onComplete: () => {
        this.tweens.add({ targets: this.flashRect, alpha: 0, duration: 400 })
      },
    })

    // Fade to black
    this.time.delayedCall(300, () => {
      this.tweens.add({
        targets: this.fadeRect,
        alpha: 1,
        duration: 800,
        onComplete: () => {
          this.time.delayedCall(500, () => this.onCutsceneComplete())
        },
      })
    })
  }

  // ── Skip / completion ─────────────────────────────────────────

  private skipCutscene() {
    if (this.cutsceneComplete) return
    this.tweens.killAll()
    this.fadeRect.setAlpha(1)
    this.shuttle.setVisible(false)
    this.astronaut.setVisible(false)
    this.skipLabel.setVisible(false)
    this.starScrollSpeed = 0
    this.onCutsceneComplete()
  }

  private onCutsceneComplete() {
    if (this.cutsceneComplete) return
    this.cutsceneComplete = true
    this.skipLabel.setVisible(false)

    if (this.registry.get('bootComplete')) {
      this.transitionToWorld()
    } else {
      const { width, height } = this.scale
      this.loadingLabel = this.add.text(width / 2, height / 2, 'Loading...', {
        fontSize: '18px', color: '#888888', fontFamily: 'monospace',
      }).setOrigin(0.5).setDepth(110)
    }
  }

  private transitionToWorld() {
    this.registry.remove('introCutscene')
    this.registry.remove('bootComplete')
    this.scene.stop('BootScene')
    this.scene.start('WorldScene')
  }
}
