import Phaser from 'phaser'
import { AudioManager, MusicTrack } from '../systems/AudioManager'

/** Multi-phase cinematic ending cutscene */
export class EndingScene extends Phaser.Scene {
  private phase = 0
  private skipReady = false
  private stars: Phaser.GameObjects.Rectangle[] = []
  private allObjects: Phaser.GameObjects.GameObject[] = []

  constructor() {
    super({ key: 'EndingScene' })
  }

  create() {
    this.phase = 0
    this.skipReady = false
    this.stars = []
    this.allObjects = []

    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor(0x000000)

    // Create starfield
    this.createStarfield(width, height)

    // Start the cutscene sequence
    AudioManager.get()?.playMusic(MusicTrack.ENDING)
    this.phaseOneAscent(width, height)
  }

  /** Starfield background — twinkling stars */
  private createStarfield(width: number, height: number) {
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
  }

  /** Phase 1: Player ascends from planet surface */
  private phaseOneAscent(width: number, height: number) {
    // Planet surface at bottom
    const planet = this.add.ellipse(width / 2, height + 80, width * 1.6, 240, 0x224422)
    this.allObjects.push(planet)
    const planetGlow = this.add.ellipse(width / 2, height + 78, width * 1.6, 244, 0x88cc88, 0.15)
    this.allObjects.push(planetGlow)

    // Atmosphere gradient
    const atmo = this.add.rectangle(width / 2, height - 100, width, 80, 0x4488aa, 0.2)
    this.allObjects.push(atmo)

    // Player sprite (use loaded texture if available, else rectangle)
    let playerObj: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
    if (this.textures.exists('player_idle1')) {
      playerObj = this.add.image(width / 2, height - 140, 'player_idle1').setScale(2)
    } else {
      playerObj = this.add.rectangle(width / 2, height - 140, 32, 64, 0x00ccff)
    }
    this.allObjects.push(playerObj)

    // Jetpack flame
    const flame = this.add.ellipse(width / 2, height - 100, 12, 20, 0xff6600, 0.9)
    this.allObjects.push(flame)

    // Flame flicker
    this.tweens.add({
      targets: flame,
      scaleX: { from: 1, to: 1.3 },
      scaleY: { from: 1, to: 1.4 },
      alpha: { from: 0.9, to: 0.5 },
      duration: 100,
      yoyo: true,
      repeat: -1,
    })

    // Fly upward — planet recedes
    this.tweens.add({
      targets: [planet, planetGlow, atmo],
      y: '+=400',
      duration: 5000,
      ease: 'Quad.easeIn',
    })

    this.tweens.add({
      targets: [playerObj, flame],
      y: height / 2 - 40,
      duration: 2500,
      ease: 'Quad.easeOut',
    })

    // Narrative text
    const text1 = this.showNarration(
      'The jetpack roars to life...',
      width / 2, 60, 0, 1500
    )

    this.time.delayedCall(2500, () => {
      this.fadeOutText(text1, 800)
      this.showNarration(
        'Leaving the alien world behind.',
        width / 2, 60, 0, 1500
      )
    })

    // Phase 2 transition
    this.time.delayedCall(5500, () => {
      // Fade everything out
      this.tweens.add({
        targets: [...this.allObjects],
        alpha: 0,
        duration: 1500,
        onComplete: () => {
          this.allObjects.forEach(o => o.destroy())
          this.allObjects = []
          this.phaseTwoSpace(width, height)
        }
      })
    })
  }

  /** Phase 2: Drifting through space, story recap */
  private phaseTwoSpace(width: number, height: number) {
    this.phase = 1

    // Star streak effect — stars fly past
    const streakStars: Phaser.GameObjects.Rectangle[] = []
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      const streak = this.add.rectangle(x, y, 1, 8 + Math.random() * 16, 0xaaccff, 0.4 + Math.random() * 0.4)
      streakStars.push(streak)
      this.allObjects.push(streak)
      this.tweens.add({
        targets: streak,
        y: height + 50,
        duration: 600 + Math.random() * 800,
        repeat: -1,
        onRepeat: () => {
          streak.x = Math.random() * width
          streak.y = -20
        }
      })
    }

    // Small player silhouette in center
    let playerSil: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
    if (this.textures.exists('player_idle1')) {
      playerSil = this.add.image(width / 2, height / 2, 'player_idle1').setScale(1.5).setAlpha(0.7)
    } else {
      playerSil = this.add.rectangle(width / 2, height / 2, 24, 48, 0x00ccff, 0.7)
    }
    this.allObjects.push(playerSil)

    // Gentle sway
    this.tweens.add({
      targets: playerSil,
      x: width / 2 + 10,
      y: height / 2 - 5,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Story beats
    const storyLines = [
      'Crash-landed on an alien world...',
      'You mined, you built, you survived.',
      'Six bosses fell before you.',
      'Six jetpack parts, assembled into one.',
      'Now the stars welcome you home.',
    ]

    let delay = 500
    const storyTexts: Phaser.GameObjects.Text[] = []
    for (const line of storyLines) {
      const t = this.showNarration(line, width / 2, height - 100, delay, 1500)
      storyTexts.push(t)
      this.time.delayedCall(delay + 2800, () => this.fadeOutText(t, 600))
      delay += 3500
    }

    // Phase 3 transition
    this.time.delayedCall(delay + 500, () => {
      this.tweens.add({
        targets: [...this.allObjects, ...streakStars],
        alpha: 0,
        duration: 1500,
        onComplete: () => {
          this.allObjects.forEach(o => o.destroy())
          streakStars.forEach(s => s.destroy())
          this.allObjects = []
          this.phaseThreeCredits(width, height)
        }
      })
    })
  }

  /** Phase 3: Credits + final options */
  private phaseThreeCredits(width: number, height: number) {
    this.phase = 2

    // Big title
    const title = this.add.text(width / 2, -40, 'STARFALL', {
      fontSize: '48px', color: '#00ffff', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#003333', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0)

    this.tweens.add({
      targets: title,
      y: height / 4,
      alpha: 1,
      duration: 2000,
      ease: 'Quad.easeOut',
    })

    // Subtitle
    const subtitle = this.add.text(width / 2, height / 4 + 50, 'You escaped.', {
      fontSize: '20px', color: '#ffdd00', fontFamily: 'monospace',
    }).setOrigin(0.5).setAlpha(0)

    this.tweens.add({
      targets: subtitle,
      alpha: 1,
      duration: 1500,
      delay: 2200,
    })

    // Credits block
    const creditLines = [
      '──────────────────',
      '',
      'All 6 jetpack components assembled.',
      'The journey home begins...',
      '',
      'Built with Phaser 3 + Nuxt 4',
      '',
      'Thanks for playing!',
      '',
      '──────────────────',
    ]

    const credits = this.add.text(width / 2, height / 2 + 20, creditLines.join('\n'), {
      fontSize: '13px', color: '#aaaaaa', fontFamily: 'monospace',
      align: 'center', lineSpacing: 6,
    }).setOrigin(0.5, 0).setAlpha(0)

    this.tweens.add({
      targets: credits,
      alpha: 1,
      duration: 1500,
      delay: 4000,
    })

    // Show buttons after credits appear
    this.time.delayedCall(6000, () => {
      this.showEndButtons(width, height)
    })
  }

  /** Post-credits menu buttons */
  private showEndButtons(width: number, height: number) {
    this.skipReady = true

    // Continue Playing
    const continueBtn = this.add.text(width / 2, height - 100, '[ CONTINUE PLAYING ]', {
      fontSize: '18px', color: '#00ff88', fontFamily: 'monospace',
    }).setOrigin(0.5).setAlpha(0).setInteractive({ useHandCursor: true })

    continueBtn.on('pointerover', () => continueBtn.setColor('#ffffff'))
    continueBtn.on('pointerout', () => continueBtn.setColor('#00ff88'))
    continueBtn.on('pointerdown', () => this.continuePlaying())

    // New Game
    const newGameBtn = this.add.text(width / 2, height - 60, '[ NEW GAME ]', {
      fontSize: '18px', color: '#ffff00', fontFamily: 'monospace',
    }).setOrigin(0.5).setAlpha(0).setInteractive({ useHandCursor: true })

    newGameBtn.on('pointerover', () => newGameBtn.setColor('#ffffff'))
    newGameBtn.on('pointerout', () => newGameBtn.setColor('#ffff00'))
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

  /** Resume the game world — player keeps jetpack and can fly around */
  private continuePlaying() {
    this.scene.stop('EndingScene')
    this.scene.resume('WorldScene')
    this.scene.launch('UIScene')
  }

  /** Start fresh from the title screen */
  private newGame() {
    this.scene.stop('WorldScene')
    this.scene.stop('EndingScene')
    this.scene.start('MenuScene', { pause: false })
  }

  // ── Helpers ──────────────────────────────────────────────────

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
