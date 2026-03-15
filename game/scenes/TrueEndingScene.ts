import Phaser from 'phaser'

/** Epic true ending cutscene after defeating the Void Lord */
export class TrueEndingScene extends Phaser.Scene {
  private phase = 0
  private skipReady = false
  private allObjects: Phaser.GameObjects.GameObject[] = []
  private stats: { voidLordDefeated?: boolean; dimensionConquered?: boolean } = {}

  constructor() {
    super({ key: 'TrueEndingScene' })
  }

  init(data: { stats?: { voidLordDefeated?: boolean; dimensionConquered?: boolean } }) {
    this.stats = data?.stats ?? {}
  }

  create() {
    this.phase = 0
    this.skipReady = false
    this.allObjects = []

    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor(0x000000)

    // Start the cutscene
    this.phaseOneVictory(width, height)
  }

  // ── Phase 1: Victory (0-8s) ────────────────────────────────────

  private phaseOneVictory(width: number, height: number) {
    this.phase = 0
    const cx = width / 2
    const cy = height / 2

    // Dark background that slowly brightens
    const bgOverlay = this.add.rectangle(cx, cy, width, height, 0x110022, 1)
    this.allObjects.push(bgOverlay)

    this.tweens.add({
      targets: bgOverlay,
      alpha: 0.3,
      duration: 7000,
      ease: 'Sine.easeOut',
    })

    // Void Lord silhouette (large dark shape in center)
    const bossShape = this.add.graphics()
    this.allObjects.push(bossShape)
    bossShape.fillStyle(0x220044, 0.9)
    bossShape.fillEllipse(cx, cy - 20, 120, 160)
    bossShape.fillStyle(0x330055, 0.7)
    bossShape.fillEllipse(cx, cy - 60, 80, 80)

    // Shatter the boss silhouette into fragments
    this.time.delayedCall(1500, () => {
      bossShape.setAlpha(0)

      // Create shatter fragments
      const fragments: Phaser.GameObjects.Rectangle[] = []
      for (let i = 0; i < 30; i++) {
        const fx = cx + (Math.random() - 0.5) * 100
        const fy = cy - 20 + (Math.random() - 0.5) * 140
        const size = 4 + Math.random() * 12
        const color = Math.random() < 0.5 ? 0x330055 : 0x220044
        const frag = this.add.rectangle(fx, fy, size, size, color, 0.8)
        fragments.push(frag)
        this.allObjects.push(frag)

        // Explode outward
        const angle = Math.random() * Math.PI * 2
        const dist = 200 + Math.random() * 300
        this.tweens.add({
          targets: frag,
          x: fx + Math.cos(angle) * dist,
          y: fy + Math.sin(angle) * dist,
          alpha: 0,
          angle: Math.random() * 360,
          duration: 2000 + Math.random() * 1500,
          ease: 'Quad.easeOut',
          onComplete: () => frag.destroy(),
        })
      }

      // Purple/gold particle explosion
      for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2
        const dist = 50 + Math.random() * 250
        const tx = cx + Math.cos(angle) * dist
        const ty = cy + Math.sin(angle) * dist
        const size = 2 + Math.random() * 4
        const color = Math.random() < 0.4 ? 0xffdd44 : 0xaa44ff
        const particle = this.add.rectangle(cx, cy, size, size, color, 0.9)
        this.allObjects.push(particle)

        this.tweens.add({
          targets: particle,
          x: tx,
          y: ty,
          alpha: 0,
          duration: 1500 + Math.random() * 2000,
          ease: 'Quad.easeOut',
          onComplete: () => particle.destroy(),
        })
      }

      // Camera shake on shatter
      this.cameras.main.shake(1000, 0.015)
    })

    // Narrative text
    const text1 = this.showNarration(
      'The Void Lord has been vanquished.',
      cx, 60, 2000, 1500
    )

    this.time.delayedCall(5000, () => {
      this.fadeOutText(text1, 600)
      this.showNarration(
        'The dimensional rift begins to collapse...',
        cx, 60, 0, 1200
      )
    })

    // Transition to phase 2
    this.time.delayedCall(7500, () => {
      this.tweens.add({
        targets: [...this.allObjects],
        alpha: 0,
        duration: 1000,
        onComplete: () => {
          this.allObjects.forEach(o => o.destroy())
          this.allObjects = []
          this.phaseTwoEscape(width, height)
        },
      })
    })
  }

  // ── Phase 2: Escape (8-18s) ────────────────────────────────────

  private phaseTwoEscape(width: number, height: number) {
    this.phase = 1
    const cy = height / 2

    // Void dimension crumbling background
    this.cameras.main.setBackgroundColor(0x0a0011)

    // Crumbling void chunks behind the player
    const crumbleTimer = this.time.addEvent({
      delay: 300,
      repeat: 30,
      callback: () => {
        const chunkX = Math.random() * width * 0.6
        const chunkY = Math.random() * height
        const size = 10 + Math.random() * 30
        const color = Math.random() < 0.5 ? 0x1a0033 : 0x220044
        const chunk = this.add.rectangle(chunkX, chunkY, size, size, color, 0.7)
        this.allObjects.push(chunk)

        this.tweens.add({
          targets: chunk,
          y: height + 50,
          x: chunkX - 50 - Math.random() * 100,
          angle: Math.random() * 180,
          alpha: 0,
          duration: 2000 + Math.random() * 1500,
          ease: 'Quad.easeIn',
          onComplete: () => chunk.destroy(),
        })
      },
    })
    this.allObjects.push(crumbleTimer as unknown as Phaser.GameObjects.GameObject)

    // Player silhouette running/flying to the right
    let playerSil: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
    if (this.textures.exists('player_walk1')) {
      playerSil = this.add.image(100, cy, 'player_walk1').setScale(2).setAlpha(0.9)
    } else {
      playerSil = this.add.rectangle(100, cy, 32, 64, 0x00ccff, 0.9)
    }
    this.allObjects.push(playerSil)

    // Jetpack flame
    const flame = this.add.ellipse(85, cy + 24, 10, 18, 0xff6600, 0.8)
    this.allObjects.push(flame)

    this.tweens.add({
      targets: flame,
      scaleX: { from: 1, to: 1.3 },
      scaleY: { from: 1, to: 1.4 },
      alpha: { from: 0.8, to: 0.4 },
      duration: 80,
      yoyo: true,
      repeat: -1,
    })

    // Player moves to center-right
    this.tweens.add({
      targets: [playerSil, flame],
      x: '+=300',
      duration: 8000,
      ease: 'Sine.easeInOut',
    })

    // Bob the player slightly
    this.tweens.add({
      targets: [playerSil, flame],
      y: cy - 8,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Portal appearing ahead (right side), growing brighter
    const portal = this.add.graphics()
    this.allObjects.push(portal)
    const portalGrow = { value: 0 }

    this.tweens.add({
      targets: portalGrow,
      value: 1,
      duration: 7000,
      delay: 2000,
      ease: 'Quad.easeIn',
      onUpdate: () => {
        portal.clear()
        const px = width - 100
        const r = portalGrow.value * 80
        // White glow
        portal.fillStyle(0xffffff, 0.15 * portalGrow.value)
        portal.fillEllipse(px, cy, r * 3, r * 2.2)
        // Bright core
        portal.fillStyle(0xffffff, 0.5 * portalGrow.value)
        portal.fillEllipse(px, cy, r * 2, r * 1.4)
        portal.fillStyle(0xeeeeff, 0.8 * portalGrow.value)
        portal.fillEllipse(px, cy, r * 1.2, r * 0.8)
      },
    })

    // Narrative text
    const text1 = this.showNarration(
      'You race toward the closing portal...',
      width / 2, 60, 1000, 1200
    )

    this.time.delayedCall(5000, () => {
      this.fadeOutText(text1, 600)
      this.showNarration(
        'Behind you, an entire dimension folds in on itself.',
        width / 2, 60, 0, 1200
      )
    })

    // Intensifying screen shake
    this.cameras.main.shake(9000, 0.008)

    // Transition to phase 3
    this.time.delayedCall(9500, () => {
      // Bright flash as player enters portal
      this.cameras.main.flash(2000, 255, 255, 255)
      this.tweens.add({
        targets: [...this.allObjects],
        alpha: 0,
        duration: 500,
        onComplete: () => {
          this.allObjects.forEach(o => {
            if (o && typeof (o as Phaser.GameObjects.GameObject).destroy === 'function') {
              (o as Phaser.GameObjects.GameObject).destroy()
            }
          })
          this.allObjects = []
          crumbleTimer.destroy()
          this.time.delayedCall(1000, () => {
            this.phaseThreeReturn(width, height)
          })
        },
      })
    })
  }

  // ── Phase 3: Return (18-26s) ───────────────────────────────────

  private phaseThreeReturn(width: number, height: number) {
    this.phase = 2
    const cx = width / 2

    // Peaceful scene: blue sky, green ground, sun rising
    this.cameras.main.setBackgroundColor(0x4488cc)

    // Sky gradient (lighter at top)
    const skyTop = this.add.rectangle(cx, 0, width, height / 2, 0x6699dd, 0.5).setOrigin(0.5, 0)
    this.allObjects.push(skyTop)
    skyTop.setAlpha(0)

    // Sun rising
    const sun = this.add.ellipse(width - 120, 80, 60, 60, 0xffdd44, 0)
    this.allObjects.push(sun)

    const sunGlow = this.add.ellipse(width - 120, 80, 100, 100, 0xffee88, 0)
    this.allObjects.push(sunGlow)

    // Green ground
    const ground = this.add.rectangle(cx, height - 50, width, 100, 0x338833, 0)
    this.allObjects.push(ground)

    const groundHighlight = this.add.rectangle(cx, height - 98, width, 4, 0x44aa44, 0)
    this.allObjects.push(groundHighlight)

    // Fade in peaceful scene
    this.tweens.add({
      targets: [skyTop, ground, groundHighlight],
      alpha: 1,
      duration: 2500,
      ease: 'Sine.easeOut',
    })

    this.tweens.add({
      targets: sun,
      alpha: 0.9,
      y: 60,
      duration: 3000,
      ease: 'Sine.easeOut',
    })

    this.tweens.add({
      targets: sunGlow,
      alpha: 0.3,
      y: 60,
      duration: 3000,
      ease: 'Sine.easeOut',
    })

    // Peaceful floating particles (birds/pollen)
    for (let i = 0; i < 15; i++) {
      const bx = Math.random() * width
      const by = 80 + Math.random() * (height - 200)
      const bird = this.add.rectangle(bx, by, 3, 2, 0x222222, 0)
      this.allObjects.push(bird)

      this.tweens.add({
        targets: bird,
        alpha: 0.6,
        duration: 1500,
        delay: 2000 + Math.random() * 1500,
      })

      this.tweens.add({
        targets: bird,
        x: bx + 100 + Math.random() * 200,
        y: by + (Math.random() - 0.5) * 40,
        duration: 5000 + Math.random() * 3000,
        delay: 2000,
        ease: 'Sine.easeInOut',
      })
    }

    // Narrative text sequence
    const text1 = this.showNarration(
      'You emerge back into your world.',
      cx, 140, 1500, 1500
    )

    this.time.delayedCall(4000, () => {
      this.fadeOutText(text1, 600)
      const text2 = this.showNarration(
        'The rift seals forever behind you.',
        cx, 140, 0, 1200
      )

      this.time.delayedCall(3000, () => {
        this.fadeOutText(text2, 600)
        this.showNarration(
          'You have conquered the void itself.',
          cx, 140, 0, 1200
        )
      })
    })

    // Transition to phase 4
    this.time.delayedCall(7500, () => {
      this.tweens.add({
        targets: [...this.allObjects],
        alpha: 0,
        duration: 1500,
        onComplete: () => {
          this.allObjects.forEach(o => o.destroy())
          this.allObjects = []
          this.phaseFourTrueCredits(width, height)
        },
      })
    })
  }

  // ── Phase 4: True Credits (26-35s) ─────────────────────────────

  private phaseFourTrueCredits(width: number, height: number) {
    this.phase = 3
    this.cameras.main.setBackgroundColor(0x000000)

    // Create starfield background
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      const size = Math.random() < 0.1 ? 3 : Math.random() < 0.3 ? 2 : 1
      const alpha = Math.random() * 0.5 + 0.2
      const star = this.add.rectangle(x, y, size, size, 0xffffff, alpha)
      this.tweens.add({
        targets: star,
        alpha: { from: alpha, to: alpha * 0.2 },
        duration: 800 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
      })
    }

    // Gold title
    const title = this.add.text(width / 2, -40, 'STARFALL', {
      fontSize: '48px', color: '#ffdd44', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#553300', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0)

    this.tweens.add({
      targets: title,
      y: height / 5,
      alpha: 1,
      duration: 2000,
      ease: 'Quad.easeOut',
    })

    // Subtitle
    const subtitle = this.add.text(width / 2, height / 5 + 50, 'TRUE ENDING - Master of the Void', {
      fontSize: '18px', color: '#ffaa22', fontFamily: 'monospace',
    }).setOrigin(0.5).setAlpha(0)

    this.tweens.add({
      targets: subtitle,
      alpha: 1,
      duration: 1500,
      delay: 2200,
    })

    // Stats display
    const statsLines: string[] = []
    if (this.stats.voidLordDefeated) statsLines.push('Void Lord defeated')
    if (this.stats.dimensionConquered) statsLines.push('Dimension conquered')
    if (statsLines.length === 0) {
      statsLines.push('Void Lord defeated')
      statsLines.push('Dimension conquered')
    }

    const statsText = this.add.text(width / 2, height / 5 + 90, statsLines.join('\n'), {
      fontSize: '14px', color: '#ddbb44', fontFamily: 'monospace',
      align: 'center', lineSpacing: 6,
    }).setOrigin(0.5, 0).setAlpha(0)

    this.tweens.add({
      targets: statsText,
      alpha: 1,
      duration: 1500,
      delay: 3500,
    })

    // Credits block (gold-tinted)
    const creditLines = [
      '──────────────────',
      '',
      'You journeyed beyond the stars.',
      'You conquered the void itself.',
      '',
      'Built with Phaser 3 + Nuxt 4',
      '',
      'Thanks for playing!',
      '',
      '──────────────────',
    ]

    const credits = this.add.text(width / 2, height / 2 + 20, creditLines.join('\n'), {
      fontSize: '13px', color: '#bb9944', fontFamily: 'monospace',
      align: 'center', lineSpacing: 6,
    }).setOrigin(0.5, 0).setAlpha(0)

    this.tweens.add({
      targets: credits,
      alpha: 1,
      duration: 1500,
      delay: 5000,
    })

    // Show buttons after credits
    this.time.delayedCall(7000, () => {
      this.showEndButtons(width, height)
    })
  }

  /** Post-credits menu buttons */
  private showEndButtons(width: number, height: number) {
    this.skipReady = true

    // Continue Playing
    const continueBtn = this.add.text(width / 2, height - 100, '[ CONTINUE PLAYING ]', {
      fontSize: '18px', color: '#ffdd44', fontFamily: 'monospace',
    }).setOrigin(0.5).setAlpha(0).setInteractive({ useHandCursor: true })

    continueBtn.on('pointerover', () => continueBtn.setColor('#ffffff'))
    continueBtn.on('pointerout', () => continueBtn.setColor('#ffdd44'))
    continueBtn.on('pointerdown', () => this.continuePlaying())

    // New Game
    const newGameBtn = this.add.text(width / 2, height - 60, '[ NEW GAME ]', {
      fontSize: '18px', color: '#ffaa22', fontFamily: 'monospace',
    }).setOrigin(0.5).setAlpha(0).setInteractive({ useHandCursor: true })

    newGameBtn.on('pointerover', () => newGameBtn.setColor('#ffffff'))
    newGameBtn.on('pointerout', () => newGameBtn.setColor('#ffaa22'))
    newGameBtn.on('pointerdown', () => this.newGame())

    // Fade buttons in
    this.tweens.add({
      targets: [continueBtn, newGameBtn],
      alpha: 1,
      duration: 800,
    })

    // Keyboard shortcuts
    const hint = this.add.text(width / 2, height - 28, 'C - Continue  |  N - New Game', {
      fontSize: '11px', color: '#555555', fontFamily: 'monospace',
    }).setOrigin(0.5).setAlpha(0)

    this.tweens.add({ targets: hint, alpha: 1, duration: 800 })

    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C).on('down', () => {
      if (this.skipReady) this.continuePlaying()
    })
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.N).on('down', () => {
      if (this.skipReady) this.newGame()
    })
  }

  /** Resume the game world with registry data preserved */
  private continuePlaying() {
    this.scene.stop('TrueEndingScene')
    this.scene.resume('WorldScene')
    this.scene.launch('UIScene')
  }

  /** Start fresh from the title screen */
  private newGame() {
    this.scene.stop('WorldScene')
    this.scene.stop('TrueEndingScene')
    this.scene.start('MenuScene', { pause: false })
  }

  // ── Helpers ────────────────────────────────────────────────────

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
