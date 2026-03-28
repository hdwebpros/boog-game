import Phaser from 'phaser'
import { SaveManager } from '../systems/SaveManager'
import type { SaveSlotInfo } from '../systems/SaveManager'
import { AudioManager, MusicTrack } from '../systems/AudioManager'
import { SoundId } from '../data/sounds'
import { gamePrompt } from '../ui/GameDialog'
import { Difficulty, DifficultyManager } from '../systems/DifficultyManager'

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
      this.showDifficultySelect(width, height, false)
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
      this.showDifficultySelect(width, height, true)
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

    // Controls
    this.add.text(width / 2, height - 60, 'WASD/Arrows: Move | Space: Jump | Shift: Dash | LMB: Mine/Attack\nRMB: Place | C: Craft | Q: Use Item | F: Boss Summon | M: Map', {
      fontSize: '10px', color: '#555555', fontFamily: 'monospace', align: 'center',
    }).setOrigin(0.5)

    // Wiki link
    const wikiLink = this.add.text(width / 2, height - 30, '[ WIKI ]', {
      fontSize: '12px', color: '#555555', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    wikiLink.on('pointerover', () => wikiLink.setColor('#00ffff'))
    wikiLink.on('pointerout', () => wikiLink.setColor('#555555'))
    wikiLink.on('pointerdown', () => {
      window.open('/wiki', '_blank')
    })
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

    // Import Save button
    const importBtn = this.add.text(width / 2 + 80, height - 40, '[ IMPORT ]', {
      fontSize: '18px', color: '#44aa44', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    importBtn.on('pointerover', () => importBtn.setColor('#66ff66'))
    importBtn.on('pointerout', () => importBtn.setColor('#44aa44'))
    importBtn.on('pointerdown', () => {
      SaveManager.importSave().then((info) => {
        if (info) {
          AudioManager.get()?.play(SoundId.MENU_SELECT)
          const { width: w, height: h } = this.scale
          this.showLoadScreen(w, h)
        }
      })
    })

    // Back button
    const backBtn = this.add.text(width / 2 - 80, height - 40, '[ BACK ]', {
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
    const nameText = this.add.text(50, y + 10, save.name, {
      fontSize: '16px', color: '#ffffff', fontFamily: 'monospace',
    })

    // Difficulty tag next to name
    const diff = save.difficulty ?? 'normal'
    DifficultyManager.set(diff)
    const diffLabel = DifficultyManager.getLabel()
    const diffColor = DifficultyManager.getColor()
    this.add.text(nameText.x + nameText.width + 10, y + 12, `[${diffLabel}]`, {
      fontSize: '12px', color: diffColor, fontFamily: 'monospace',
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

    // Download button
    const dlBtn = this.add.text(width - 90, y + 20, 'DL', {
      fontSize: '14px', color: '#4488ff', fontFamily: 'monospace',
      backgroundColor: '#001133', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    dlBtn.on('pointerover', () => dlBtn.setColor('#88bbff'))
    dlBtn.on('pointerout', () => dlBtn.setColor('#4488ff'))
    dlBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation()
      SaveManager.exportSave(save.id)
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
      // Host: start hosting immediately
      const startBtn = this.add.text(width / 2, height / 2, '[ START HOSTING ]', {
        fontSize: '20px', color: '#8888ff', fontFamily: 'monospace',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })

      startBtn.on('pointerover', () => startBtn.setColor('#ffffff'))
      startBtn.on('pointerout', () => startBtn.setColor('#8888ff'))
      startBtn.on('pointerdown', () => {
        statusText.setText('Creating room...')
        this.registry.set('mpMode', 'host')
        this.registry.set('mpPlayerName', 'Host')
        AudioManager.get()?.stopMusic()
        this.scene.start('BootScene')
      })

      this.add.text(width / 2, height / 2 + 70, 'Other players will join using your room code.\nThe code appears after the world loads.', {
        fontSize: '11px', color: '#666666', fontFamily: 'monospace', align: 'center',
      }).setOrigin(0.5)
    } else {
      // Join: prompt for room code only
      this.add.text(width / 2, height / 2 - 40, 'Enter room code:', {
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
          statusText.setText('Connecting...')
          this.registry.set('mpMode', 'client')
          this.registry.set('mpRoomCode', code.trim().toUpperCase())
          this.registry.set('mpPlayerName', 'Player')
          AudioManager.get()?.stopMusic()
          this.scene.start('BootScene')
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

  private showDifficultySelect(width: number, height: number, isHost: boolean) {
    this.children.removeAll(true)
    this.cameras.main.setBackgroundColor(0x0a0a1a)

    // Stars
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      const alpha = Math.random() * 0.3 + 0.1
      this.add.rectangle(x, y, Math.random() < 0.3 ? 2 : 1, Math.random() < 0.3 ? 2 : 1, 0xffffff, alpha)
    }

    this.add.text(width / 2, 40, 'SELECT DIFFICULTY', {
      fontSize: '24px', color: '#00ffff', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#003333', strokeThickness: 3,
    }).setOrigin(0.5)

    const options: { difficulty: Difficulty; label: string; color: string; subtitle: string }[] = [
      { difficulty: Difficulty.EASY, label: 'EASY', color: '#44ff44', subtitle: 'More HP, weaker enemies, better loot' },
      { difficulty: Difficulty.NORMAL, label: 'NORMAL', color: '#ffffff', subtitle: 'The intended experience' },
      { difficulty: Difficulty.HARD, label: 'HARD', color: '#ff8800', subtitle: 'Less HP, tougher enemies, fewer drops' },
      { difficulty: Difficulty.HARDCORE, label: 'HARDCORE', color: '#ff2222', subtitle: 'Hard + permadeath — one life only' },
    ]

    const startY = 110
    const rowH = 70

    for (let i = 0; i < options.length; i++) {
      const opt = options[i]!
      const y = startY + i * rowH

      const bg = this.add.rectangle(width / 2, y + 20, width - 80, 55, 0x111133, 0.6)
        .setInteractive({ useHandCursor: true })

      const label = this.add.text(width / 2, y + 12, `[ ${opt.label} ]`, {
        fontSize: '20px', color: opt.color, fontFamily: 'monospace',
      }).setOrigin(0.5)

      this.add.text(width / 2, y + 34, opt.subtitle, {
        fontSize: '11px', color: '#888888', fontFamily: 'monospace',
      }).setOrigin(0.5)

      bg.on('pointerover', () => {
        bg.setFillStyle(0x223355, 0.8)
        label.setColor('#ffffff')
      })
      bg.on('pointerout', () => {
        bg.setFillStyle(0x111133, 0.6)
        label.setColor(opt.color)
      })
      bg.on('pointerdown', () => {
        AudioManager.get()?.play(SoundId.MENU_SELECT)
        this.registry.set('difficulty', opt.difficulty)
        if (isHost) {
          this.showMultiplayerLobby(width, height, true)
        } else {
          AudioManager.get()?.stopMusic()
          this.registry.set('introCutscene', true)
          this.scene.start('IntroCutsceneScene')
        }
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

    // Difficulty label below pause title
    this.add.text(width / 2, height / 3 + 30, DifficultyManager.getLabel(), {
      fontSize: '14px', color: DifficultyManager.getColor(), fontFamily: 'monospace',
    }).setOrigin(0.5)

    // Show room code if hosting multiplayer
    const mpMode = this.registry.get('mpMode') as string | undefined
    const roomCode = this.registry.get('mpRoomCode') as string | undefined
    if (mpMode === 'host' && roomCode) {
      this.add.text(width / 2, height / 3 + 50, `Room Code: ${roomCode}`, {
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

    // Sound settings
    const soundBtn = this.add.text(width / 2, nextY, '[ SOUND ]', {
      fontSize: '18px', color: '#88ccff', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    soundBtn.on('pointerover', () => soundBtn.setColor('#ffffff'))
    soundBtn.on('pointerout', () => soundBtn.setColor('#88ccff'))
    soundBtn.on('pointerdown', () => {
      AudioManager.get()?.play(SoundId.MENU_SELECT)
      this.showSoundSettings(width, height)
    })
    nextY += 40

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
      ['Shift', 'Dash'],
      ['LMB', 'Mine/Attack'],
      ['RMB', 'Place Block'],
      ['1-9', 'Hotbar Slot'],
      ['C', 'Crafting'],
      ['Tab', 'Inventory'],
    ]
    const rightCol = [
      ['Q', 'Drop Item'],
      ['I', 'Use Item'],
      ['F', 'Boss/NPC'],
      ['N', 'Minimap'],
      ['[ / ]', 'Map Zoom'],
      ['M', 'World Map'],
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

    // ESC to resume — reset WorldScene's ESC key so its update() won't immediately reopen
    this.input.keyboard!.on('keydown-ESC', () => {
      const ws = this.scene.get('WorldScene')
      if (ws?.input?.keyboard) {
        ws.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC, false, false).reset()
      }
      this.resumeGame()
    })
  }

  private showSoundSettings(width: number, height: number) {
    this.children.removeAll(true)
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)

    this.add.text(width / 2, height / 4 - 20, 'SOUND SETTINGS', {
      fontSize: '24px', color: '#88ccff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5)

    const audio = AudioManager.get()
    const sliderW = 200
    const sliderH = 12
    const sliderX = width / 2 - sliderW / 2
    let nextY = height / 4 + 40

    // --- Music Volume ---
    this.add.text(width / 2, nextY, 'Music Volume', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5)
    nextY += 24
    this.createVolumeSlider(sliderX, nextY, sliderW, sliderH, audio?.getMusicVolume() ?? 0.35, (val) => {
      audio?.setMusicVolume(val)
      if (audio?.isMuted() && val > 0) audio.setMuted(false)
    })
    nextY += 40

    // --- SFX Volume ---
    this.add.text(width / 2, nextY, 'SFX Volume', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5)
    nextY += 24
    this.createVolumeSlider(sliderX, nextY, sliderW, sliderH, audio?.getVolume() ?? 1.0, (val) => {
      audio?.setVolume(val)
    })
    nextY += 40

    // --- Mute Music Toggle ---
    const muted = audio?.isMuted() ?? false
    const muteBtn = this.add.text(width / 2, nextY, muted ? '[ MUSIC: OFF ]' : '[ MUSIC: ON ]', {
      fontSize: '16px', color: muted ? '#ff4444' : '#00ff88', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    muteBtn.on('pointerover', () => muteBtn.setColor('#ffffff'))
    muteBtn.on('pointerout', () => muteBtn.setColor(audio?.isMuted() ? '#ff4444' : '#00ff88'))
    muteBtn.on('pointerdown', () => {
      if (!audio) return
      const nowMuted = audio.toggleMute()
      muteBtn.setText(nowMuted ? '[ MUSIC: OFF ]' : '[ MUSIC: ON ]')
      muteBtn.setColor(nowMuted ? '#ff4444' : '#00ff88')
    })
    nextY += 50

    // --- Back ---
    const backBtn = this.add.text(width / 2, nextY, '[ BACK ]', {
      fontSize: '18px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    backBtn.on('pointerover', () => backBtn.setColor('#ffffff'))
    backBtn.on('pointerout', () => backBtn.setColor('#888888'))
    backBtn.on('pointerdown', () => {
      AudioManager.get()?.play(SoundId.MENU_SELECT)
      this.children.removeAll(true)
      this.createPauseMenu(width, height)
    })

    // ESC goes back to pause menu
    this.input.keyboard!.removeAllListeners('keydown-ESC')
    this.input.keyboard!.on('keydown-ESC', () => {
      this.children.removeAll(true)
      this.createPauseMenu(width, height)
    })
  }

  private createVolumeSlider(x: number, y: number, w: number, h: number, initial: number, onChange: (val: number) => void) {
    // Background track
    this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x333333).setOrigin(0.5)

    // Fill bar
    const fill = this.add.rectangle(x, y, w * initial, h, 0x00aaff).setOrigin(0, 0)

    // Percentage label
    const pctLabel = this.add.text(x + w + 10, y + h / 2, `${Math.round(initial * 100)}%`, {
      fontSize: '12px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0, 0.5)

    // Invisible interactive zone over the track
    const hitZone = this.add.rectangle(x + w / 2, y + h / 2, w, h + 16, 0x000000, 0)
      .setOrigin(0.5).setInteractive({ useHandCursor: true })

    const updateFromPointer = (px: number) => {
      const val = Phaser.Math.Clamp((px - x) / w, 0, 1)
      fill.setSize(w * val, h)
      pctLabel.setText(`${Math.round(val * 100)}%`)
      onChange(val)
    }

    hitZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      updateFromPointer(pointer.x)
    })

    hitZone.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        updateFromPointer(pointer.x)
      }
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
