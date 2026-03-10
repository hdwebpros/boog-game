import Phaser from 'phaser'

export class EndingScene extends Phaser.Scene {
  constructor() {
    super({ key: 'EndingScene' })
  }

  create() {
    const { width, height } = this.scale

    // Dark background
    this.cameras.main.setBackgroundColor(0x000000)

    // Cutscene: player flies away
    const player = this.add.rectangle(width / 2, height - 100, 32, 64, 0x00ffff)
    const flame = this.add.rectangle(width / 2, height - 64, 10, 14, 0xff6600)

    // Fly upward animation
    this.tweens.add({
      targets: [player, flame],
      y: -50,
      duration: 4000,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        player.destroy()
        flame.destroy()
        this.showCredits()
      }
    })

    // Stars in the background
    for (let i = 0; i < 100; i++) {
      const sx = Math.random() * width
      const sy = Math.random() * height
      const star = this.add.rectangle(sx, sy, 2, 2, 0xffffff, Math.random() * 0.5 + 0.3)
      this.tweens.add({
        targets: star,
        alpha: { from: star.alpha, to: star.alpha * 0.3 },
        duration: 1000 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
      })
    }

    // Title
    this.add.text(width / 2, 30, 'ESCAPE', {
      fontSize: '32px', color: '#ffdd00', fontFamily: 'monospace',
    }).setOrigin(0.5)

    this.add.text(width / 2, 65, 'The jetpack roars to life...', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5)
  }

  private showCredits() {
    const { width, height } = this.scale

    const lines = [
      'STARFALL',
      '',
      'You escaped the alien planet!',
      '',
      'All 6 jetpack components assembled.',
      'The journey home begins...',
      '',
      '──────────────────',
      '',
      'Thanks for playing!',
      '',
      'Built with Phaser 3 + Nuxt 4',
      '',
      '──────────────────',
      '',
      'Press R to play again',
    ]

    const text = this.add.text(width / 2, height + 50, lines.join('\n'), {
      fontSize: '14px',
      color: '#cccccc',
      fontFamily: 'monospace',
      align: 'center',
      lineSpacing: 6,
    }).setOrigin(0.5, 0)

    // Scroll credits up
    this.tweens.add({
      targets: text,
      y: height / 2 - 100,
      duration: 6000,
      ease: 'Linear',
    })

    // R to restart
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R).on('down', () => {
      this.scene.stop('EndingScene')
      this.scene.start('BootScene')
    })
  }
}
