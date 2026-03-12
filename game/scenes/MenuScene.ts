import Phaser from 'phaser'
import { SaveManager } from '../systems/SaveManager'
import type { SaveSlotInfo } from '../systems/SaveManager'
import { AudioManager, MusicTrack } from '../systems/AudioManager'
import { SoundId } from '../data/sounds'
import { gamePrompt } from '../ui/GameDialog'

export class MenuScene extends Phaser.Scene {
  private isPause = false
  private isMultiplayer = false

  constructor() {
    super({ key: 'MenuScene' })
  }

  init(data: { pause?: boolean; multiplayer?: boolean }) {
    this.isPause = data?.pause === true
    this.isMultiplayer = data?.multiplayer === true
  }

  create() {
    const { width, height } = this.scale

    if (this.isPause) {
      this.createPauseMenu(width, height)
    } else {
      // Migrate old saves to IndexedDB before showing title
      SaveManager.migrateOldSave().then(() => {
        this.createTitleScreen(width, height)
      })
    }
  }

  private createTitleScreen(width: number, height: number) {
    AudioManager.init().playMusic(MusicTrack.TITLE)
    this.cameras.main.setBackgroundColor(0x0a0a1a)

    // Stars (twinkling)
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

    // Multiplayer buttons
    const hostBtn = this.add.text(width / 2, height / 2 + 120, '[ HOST GAME ]', {
      fontSize: '18px', color: '#8888ff', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    hostBtn.on('pointerover', () => hostBtn.setColor('#ffffff'))
    hostBtn.on('pointerout', () => hostBtn.setColor('#8888ff'))
    hostBtn.on('pointerdown', () => {
      AudioManager.get()?.play(SoundId.MENU_SELECT)
      this.showMultiplayerLobby(width, height, true)
    })

    const joinBtn = this.add.text(width / 2, height / 2 + 155, '[ JOIN GAME ]', {
      fontSize: '18px', color: '#88ff88', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    joinBtn.on('pointerover', () => joinBtn.setColor('#ffffff'))
    joinBtn.on('pointerout', () => joinBtn.setColor('#88ff88'))
    joinBtn.on('pointerdown', () => {
      AudioManager.get()?.play(SoundId.MENU_SELECT)
      this.showMultiplayerLobby(width, height, false)
    })

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

    // Stars (twinkling)
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      const size = Math.random() < 0.1 ? 3 : Math.random() < 0.3 ? 2 : 1
      const alpha = Math.random() * 0.3 + 0.1
      const star = this.add.rectangle(x, y, size, size, 0xffffff, alpha)
      this.tweens.add({
        targets: star,
        alpha: { from: alpha, to: alpha * 0.2 },
        duration: 800 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
      })
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
      SaveManager.deleteSave(save.id).then(() => {
        AudioManager.get()?.play(SoundId.MENU_SELECT)
        const { width: w, height: h } = this.scale
        this.showLoadScreen(w, h)
      })
    })
  }

  private showMultiplayerLobby(width: number, height: number, isHost: boolean) {
    this.children.removeAll(true)
    this.cameras.main.setBackgroundColor(0x0a0a1a)

    // Stars
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      const alpha = Math.random() * 0.3 + 0.1
      this.add.rectangle(x, y, Math.random() < 0.3 ? 2 : 1, Math.random() < 0.3 ? 2 : 1, 0xffffff, alpha)
    }

    this.add.text(width / 2, 30, isHost ? 'HOST GAME' : 'JOIN GAME', {
      fontSize: '24px', color: '#00ffff', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#003333', strokeThickness: 3,
    }).setOrigin(0.5)

    const statusText = this.add.text(width / 2, height - 80, '', {
      fontSize: '14px', color: '#888888', fontFamily: 'monospace', align: 'center',
    }).setOrigin(0.5)

    if (isHost) {
      // Host: prompt for player name, then create room
      this.add.text(width / 2, height / 2 - 40, 'Your name:', {
        fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
      }).setOrigin(0.5)

      const startBtn = this.add.text(width / 2, height / 2 + 20, '[ START HOSTING ]', {
        fontSize: '20px', color: '#8888ff', fontFamily: 'monospace',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })

      startBtn.on('pointerover', () => startBtn.setColor('#ffffff'))
      startBtn.on('pointerout', () => startBtn.setColor('#8888ff'))
      startBtn.on('pointerdown', () => {
        gamePrompt('Enter your name:', 'Host').then((raw) => {
          const name = (raw ?? 'Host').trim().slice(0, 16) || 'Host'
          statusText.setText('Creating room...')
          this.registry.set('mpMode', 'host')
          this.registry.set('mpPlayerName', name)
          AudioManager.get()?.stopMusic()
          this.scene.start('BootScene')
        })
      })

      this.add.text(width / 2, height / 2 + 70, 'Other players will join using your room code.\nThe code appears after the world loads.', {
        fontSize: '11px', color: '#666666', fontFamily: 'monospace', align: 'center',
      }).setOrigin(0.5)
    } else {
      // Join: prompt for room code and name
      this.add.text(width / 2, height / 2 - 40, 'Enter room code and your name:', {
        fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
      }).setOrigin(0.5)

      const joinGameBtn = this.add.text(width / 2, height / 2 + 20, '[ CONNECT ]', {
        fontSize: '20px', color: '#88ff88', fontFamily: 'monospace',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })

      joinGameBtn.on('pointerover', () => joinGameBtn.setColor('#ffffff'))
      joinGameBtn.on('pointerout', () => joinGameBtn.setColor('#88ff88'))
      joinGameBtn.on('pointerdown', () => {
        gamePrompt('Room code:').then((code) => {
          if (!code) return
          gamePrompt('Your name:', 'Player').then((raw) => {
            const name = (raw ?? 'Player').trim().slice(0, 16) || 'Player'
            statusText.setText('Connecting...')
            this.registry.set('mpMode', 'client')
            this.registry.set('mpRoomCode', code.trim().toUpperCase())
            this.registry.set('mpPlayerName', name)
            AudioManager.get()?.stopMusic()
            this.scene.start('BootScene')
          })
        })
      })
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

  private createPauseMenu(width: number, height: number) {
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)

    this.add.text(width / 2, height / 3, this.isMultiplayer ? 'MENU' : 'PAUSED', {
      fontSize: '32px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5)

    // Show room code if hosting multiplayer
    const mpMode = this.registry.get('mpMode') as string | undefined
    const roomCode = this.registry.get('mpRoomCode') as string | undefined
    if (mpMode === 'host' && roomCode) {
      this.add.text(width / 2, height / 3 + 35, `Room Code: ${roomCode}`, {
        fontSize: '16px', color: '#8888ff', fontFamily: 'monospace',
      }).setOrigin(0.5)
    }

    let nextY = height / 2

    // Resume
    const resumeBtn = this.add.text(width / 2, nextY, '[ RESUME ]', {
      fontSize: '18px', color: '#00ff88', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    resumeBtn.on('pointerover', () => resumeBtn.setColor('#ffffff'))
    resumeBtn.on('pointerout', () => resumeBtn.setColor('#00ff88'))
    resumeBtn.on('pointerdown', () => this.resumeGame())
    nextY += 40

    // Save (only in single-player or host mode)
    if (!this.isMultiplayer || mpMode === 'host') {
      const saveBtn = this.add.text(width / 2, nextY, '[ SAVE GAME ]', {
        fontSize: '18px', color: '#ffff00', fontFamily: 'monospace',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })

      const saveStatus = this.add.text(width / 2, nextY + 25, '', {
        fontSize: '12px', color: '#888888', fontFamily: 'monospace',
      }).setOrigin(0.5)

      saveBtn.on('pointerover', () => saveBtn.setColor('#ffffff'))
      saveBtn.on('pointerout', () => saveBtn.setColor('#ffff00'))
      saveBtn.on('pointerdown', () => {
        const worldScene = this.scene.get('WorldScene') as any
        const currentName = worldScene?.getSaveSlotName?.() as string | null

        gamePrompt('Save name:', currentName ?? 'My World').then((name) => {
          if (name === null) return
          const trimmed = name.trim() || 'My World'
          saveStatus.setText('Saving...')
          saveStatus.setColor('#888888')
          const result = worldScene?.performSave?.(undefined, trimmed) as Promise<boolean> | undefined
          ;(result ?? Promise.resolve(false)).then((success: boolean) => {
            saveStatus.setText(success ? `Saved as "${trimmed}"!` : 'Save failed!')
            saveStatus.setColor(success ? '#00ff88' : '#ff4444')
          })
        })
      })
      nextY += 40
    }

    // Quit to menu / Leave game
    const quitLabel = this.isMultiplayer ? '[ LEAVE GAME ]' : '[ QUIT TO MENU ]'
    const quitBtn = this.add.text(width / 2, nextY, quitLabel, {
      fontSize: '18px', color: '#ff4444', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    quitBtn.on('pointerover', () => quitBtn.setColor('#ffffff'))
    quitBtn.on('pointerout', () => quitBtn.setColor('#ff4444'))
    quitBtn.on('pointerdown', () => {
      AudioManager.get()?.stopMusic()
      // Clean up multiplayer mode flag
      this.registry.remove('mpMode')
      this.registry.remove('mpRoomCode')
      this.registry.remove('mpPlayerName')
      this.scene.stop('WorldScene')
      this.scene.stop('UIScene')
      this.scene.start('MenuScene', { pause: false })
    })

    // Controls guide — two side-by-side columns
    const controlsY = nextY + 30
    this.add.text(width / 2, controlsY, '--- CONTROLS ---', {
      fontSize: '11px', color: '#00cccc', fontFamily: 'monospace',
    }).setOrigin(0.5)

    const leftCol = [
      ['WASD/Arrows', 'Move'],
      ['Space/W', 'Jump'],
      ['LMB', 'Mine/Attack'],
      ['RMB', 'Place Block'],
      ['1-9', 'Hotbar Slot'],
      ['C', 'Crafting'],
      ['Tab', 'Inventory'],
    ]
    const rightCol = [
      ['Q', 'Use Item'],
      ['F', 'Boss/NPC'],
      ['N', 'Minimap'],
      ['[ / ]', 'Map Zoom'],
      ['M', 'Music'],
      ['ESC', 'Pause/Close'],
    ]

    const rowH = 13
    const lx = 30
    const rx = width / 2 + 20
    const startY = controlsY + 16
    for (const [col, ox] of [[leftCol, lx], [rightCol, rx]] as const) {
      col.forEach(([key, action], i) => {
        const y = startY + i * rowH
        this.add.text(ox, y, key, {
          fontSize: '10px', color: '#aaaaaa', fontFamily: 'monospace',
        })
        this.add.text(ox + 95, y, action, {
          fontSize: '10px', color: '#666666', fontFamily: 'monospace',
        })
      })
    }

    // M to mute in pause menu
    this.addMuteToggle(width)

    // ESC to resume — reset WorldScene's ESC key so its update() won't immediately reopen
    this.input.keyboard!.on('keydown-ESC', () => {
      const ws = this.scene.get('WorldScene')
      if (ws?.input?.keyboard) {
        ws.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC, false, false).reset()
      }
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
    if (!this.isMultiplayer) {
      // Single-player: resume paused scenes
      this.scene.resume('WorldScene')
      this.scene.resume('UIScene')
    }
    // In multiplayer, scenes were never paused — just stop the menu overlay
    this.scene.stop('MenuScene')
  }
}
