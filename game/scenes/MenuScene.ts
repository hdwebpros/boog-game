import Phaser from 'phaser'
import { SaveManager } from '../systems/SaveManager'
import type { SaveSlotInfo } from '../systems/SaveManager'
import { AudioManager, MusicTrack } from '../systems/AudioManager'
import { SoundId } from '../data/sounds'

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

    // Migrate old single-slot save on first visit
    SaveManager.migrateOldSave()

    if (this.isPause) {
      this.createPauseMenu(width, height)
    } else {
      this.createTitleScreen(width, height)
    }
  }

  private createTitleScreen(width: number, height: number) {
    AudioManager.init().playMusic(MusicTrack.TITLE)
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
      AudioManager.get()?.play(SoundId.MENU_SELECT)
      AudioManager.get()?.stopMusic()
      this.scene.start('BootScene')
    })

    // Load Game button (if saves exist)
    if (SaveManager.hasSaves()) {
      const loadBtn = this.add.text(width / 2, height / 2 + 70, '[ LOAD GAME ]', {
        fontSize: '20px', color: '#ffff00', fontFamily: 'monospace',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })

      loadBtn.on('pointerover', () => loadBtn.setColor('#ffffff'))
      loadBtn.on('pointerout', () => loadBtn.setColor('#ffff00'))
      loadBtn.on('pointerdown', () => {
        AudioManager.get()?.play(SoundId.MENU_SELECT)
        this.showLoadScreen(width, height)
      })
    }

    // M to mute on title screen
    this.addMuteToggle(width)

    // Controls
    this.add.text(width / 2, height - 60, 'WASD/Arrows: Move | Space: Jump | LMB: Mine/Attack\nRMB: Place | C: Craft | Q: Use Item | F: Boss Summon | M: Mute', {
      fontSize: '10px', color: '#555555', fontFamily: 'monospace', align: 'center',
    }).setOrigin(0.5)
  }

  private showLoadScreen(width: number, height: number) {
    this.children.removeAll(true)
    this.cameras.main.setBackgroundColor(0x0a0a1a)

    // Stars
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      this.add.rectangle(x, y, 2, 2, 0xffffff, Math.random() * 0.3 + 0.1)
    }

    this.add.text(width / 2, 40, 'LOAD GAME', {
      fontSize: '28px', color: '#00ffff', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#003333', strokeThickness: 3,
    }).setOrigin(0.5)

    const saves = SaveManager.getIndex().sort((a, b) => b.timestamp - a.timestamp)

    if (saves.length === 0) {
      this.add.text(width / 2, height / 2, 'No saved games found.', {
        fontSize: '16px', color: '#666666', fontFamily: 'monospace',
      }).setOrigin(0.5)
    } else {
      const startY = 90
      const rowHeight = 60
      const maxVisible = Math.min(saves.length, 7)

      for (let i = 0; i < maxVisible; i++) {
        const save = saves[i]!
        const y = startY + i * rowHeight
        this.createSaveSlotRow(save, width, y)
      }

      if (saves.length > 7) {
        this.add.text(width / 2, startY + 7 * rowHeight, `... and ${saves.length - 7} more`, {
          fontSize: '12px', color: '#555555', fontFamily: 'monospace',
        }).setOrigin(0.5)
      }
    }

    // Back button
    const backBtn = this.add.text(width / 2, height - 40, '[ BACK ]', {
      fontSize: '18px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    backBtn.on('pointerover', () => backBtn.setColor('#ffffff'))
    backBtn.on('pointerout', () => backBtn.setColor('#888888'))
    backBtn.on('pointerdown', () => {
      AudioManager.get()?.play(SoundId.MENU_SELECT)
      this.scene.restart({ pause: false })
    })
  }

  private createSaveSlotRow(save: SaveSlotInfo, width: number, y: number) {
    const date = new Date(save.timestamp)
    const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    // Row background
    const bg = this.add.rectangle(width / 2, y + 20, width - 60, 50, 0x111133, 0.6)
      .setInteractive({ useHandCursor: true })

    // Save name
    this.add.text(50, y + 10, save.name, {
      fontSize: '16px', color: '#ffffff', fontFamily: 'monospace',
    })

    // Timestamp
    this.add.text(50, y + 30, dateStr, {
      fontSize: '11px', color: '#666666', fontFamily: 'monospace',
    })

    // Load on row click
    bg.on('pointerover', () => bg.setFillStyle(0x223355, 0.8))
    bg.on('pointerout', () => bg.setFillStyle(0x111133, 0.6))
    bg.on('pointerdown', () => {
      AudioManager.get()?.play(SoundId.MENU_SELECT)
      AudioManager.get()?.stopMusic()
      this.registry.set('loadSlotId', save.id)
      this.scene.start('BootScene')
    })

    // Delete button
    const delBtn = this.add.text(width - 50, y + 20, 'X', {
      fontSize: '16px', color: '#ff4444', fontFamily: 'monospace',
      backgroundColor: '#330000', padding: { x: 6, y: 2 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    delBtn.on('pointerover', () => delBtn.setColor('#ff8888'))
    delBtn.on('pointerout', () => delBtn.setColor('#ff4444'))
    delBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation()
      SaveManager.deleteSave(save.id)
      AudioManager.get()?.play(SoundId.MENU_SELECT)
      const { width: w, height: h } = this.scale
      this.showLoadScreen(w, h)
    })
  }

  private createPauseMenu(width: number, height: number) {
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)

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
      const currentName = worldScene?.getSaveSlotName?.() as string | null

      const name = window.prompt('Save name:', currentName ?? 'My World')
      if (name === null) return // cancelled

      const trimmed = name.trim() || 'My World'
      const success = worldScene?.performSave?.(undefined, trimmed) ?? false
      saveStatus.setText(success ? `Saved as "${trimmed}"!` : 'Save failed!')
      saveStatus.setColor(success ? '#00ff88' : '#ff4444')
    })

    // Quit to menu
    const quitBtn = this.add.text(width / 2, height / 2 + 100, '[ QUIT TO MENU ]', {
      fontSize: '18px', color: '#ff4444', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    quitBtn.on('pointerover', () => quitBtn.setColor('#ffffff'))
    quitBtn.on('pointerout', () => quitBtn.setColor('#ff4444'))
    quitBtn.on('pointerdown', () => {
      AudioManager.get()?.stopMusic()
      this.scene.stop('WorldScene')
      this.scene.stop('UIScene')
      this.scene.start('MenuScene', { pause: false })
    })

    // M to mute in pause menu
    this.addMuteToggle(width)

    // ESC to resume
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => {
      this.resumeGame()
    })
  }

  private addMuteToggle(width: number) {
    const audio = AudioManager.get()
    const muteLabel = this.add.text(width - 10, 10, audio?.isMuted() ? '[M] MUTED' : '[M] MUSIC ON', {
      fontSize: '12px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(1, 0)

    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => {
      const a = AudioManager.get()
      if (!a) return
      const muted = a.toggleMute()
      muteLabel.setText(muted ? '[M] MUTED' : '[M] MUSIC ON')
    })
  }

  private resumeGame() {
    this.scene.resume('WorldScene')
    this.scene.resume('UIScene')
    this.scene.stop('MenuScene')
  }
}
