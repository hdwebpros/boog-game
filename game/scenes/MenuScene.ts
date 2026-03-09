import Phaser from 'phaser'
import { SaveManager } from '../systems/SaveManager'

export class MenuScene extends Phaser.Scene {
  private isPause = false

  constructor() {
    super({ key: 'MenuScene' })
  }

  init(data: { pause?: boolean }) {
    this.isPause = data?.pause === true
  }

  create() {
    const { width, height } = this.scale

    if (this.isPause) {
      this.createPauseMenu(width, height)
    } else {
      this.createTitleScreen(width, height)
    }
  }

  private createTitleScreen(width: number, height: number) {
    // Dark background
    this.cameras.main.setBackgroundColor(0x0a0a1a)

    // Stars
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      this.add.rectangle(x, y, 2, 2, 0xffffff, Math.random() * 0.5 + 0.2)
    }

    // Title
    this.add.text(width / 2, height / 3 - 30, 'STARFALL', {
      fontSize: '48px', color: '#00ffff', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#003333', strokeThickness: 4,
    }).setOrigin(0.5)

    this.add.text(width / 2, height / 3 + 20, 'Crash-landed. Build. Fight. Escape.', {
      fontSize: '14px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5)

    // New Game button
    const newGameBtn = this.add.text(width / 2, height / 2 + 30, '[ NEW GAME ]', {
      fontSize: '20px', color: '#00ff88', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    newGameBtn.on('pointerover', () => newGameBtn.setColor('#ffffff'))
    newGameBtn.on('pointerout', () => newGameBtn.setColor('#00ff88'))
    newGameBtn.on('pointerdown', () => {
      SaveManager.deleteSave()
      this.scene.start('BootScene')
    })

    // Continue button (if save exists)
    if (SaveManager.hasSave()) {
      const continueBtn = this.add.text(width / 2, height / 2 + 70, '[ CONTINUE ]', {
        fontSize: '20px', color: '#ffff00', fontFamily: 'monospace',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })

      continueBtn.on('pointerover', () => continueBtn.setColor('#ffffff'))
      continueBtn.on('pointerout', () => continueBtn.setColor('#ffff00'))
      continueBtn.on('pointerdown', () => {
        this.registry.set('loadSave', true)
        this.scene.start('BootScene')
      })
    }

    // Controls
    this.add.text(width / 2, height - 60, 'WASD/Arrows: Move | Space: Jump | LMB: Mine/Attack\nRMB: Place | C: Craft | Q: Use Item | F: Boss Summon', {
      fontSize: '10px', color: '#555555', fontFamily: 'monospace', align: 'center',
    }).setOrigin(0.5)
  }

  private createPauseMenu(width: number, height: number) {
    // Semi-transparent overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)

    this.add.text(width / 2, height / 3, 'PAUSED', {
      fontSize: '32px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5)

    // Resume
    const resumeBtn = this.add.text(width / 2, height / 2, '[ RESUME ]', {
      fontSize: '18px', color: '#00ff88', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    resumeBtn.on('pointerover', () => resumeBtn.setColor('#ffffff'))
    resumeBtn.on('pointerout', () => resumeBtn.setColor('#00ff88'))
    resumeBtn.on('pointerdown', () => this.resumeGame())

    // Save
    const saveBtn = this.add.text(width / 2, height / 2 + 40, '[ SAVE GAME ]', {
      fontSize: '18px', color: '#ffff00', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    const saveStatus = this.add.text(width / 2, height / 2 + 65, '', {
      fontSize: '12px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5)

    saveBtn.on('pointerover', () => saveBtn.setColor('#ffffff'))
    saveBtn.on('pointerout', () => saveBtn.setColor('#ffff00'))
    saveBtn.on('pointerdown', () => {
      const worldScene = this.scene.get('WorldScene') as any
      const player = worldScene?.getPlayer()
      const chunks = worldScene?.getChunkManager()
      if (!player || !chunks) return

      const worldData = this.registry.get('worldData')
      const success = SaveManager.save(
        worldData,
        player.sprite.x, player.sprite.y,
        player.hp, player.mana,
        player.inventory.hotbar,
        player.inventory.selectedSlot,
        chunks.getPlacedStations(),
        player.hasJetpack
      )
      saveStatus.setText(success ? 'Game saved!' : 'Save failed!')
      saveStatus.setColor(success ? '#00ff88' : '#ff4444')
    })

    // Quit to menu
    const quitBtn = this.add.text(width / 2, height / 2 + 100, '[ QUIT TO MENU ]', {
      fontSize: '18px', color: '#ff4444', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    quitBtn.on('pointerover', () => quitBtn.setColor('#ffffff'))
    quitBtn.on('pointerout', () => quitBtn.setColor('#ff4444'))
    quitBtn.on('pointerdown', () => {
      this.scene.stop('WorldScene')
      this.scene.stop('UIScene')
      this.scene.start('MenuScene', { pause: false })
    })

    // ESC to resume
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => {
      this.resumeGame()
    })
  }

  private resumeGame() {
    this.scene.resume('WorldScene')
    this.scene.resume('UIScene')
    this.scene.stop('MenuScene')
  }
}
