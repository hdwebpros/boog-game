/**
 * Simple in-game chat overlay for multiplayer.
 * Shows recent messages and allows typing via Enter key.
 */

import Phaser from 'phaser'
import type { MultiplayerManager } from './MultiplayerManager'

const MAX_VISIBLE = 5
const FADE_AFTER = 8000 // ms before messages start fading

export class ChatOverlay {
  private scene: Phaser.Scene
  private mp: MultiplayerManager
  private container: Phaser.GameObjects.Container
  private messageTexts: { text: Phaser.GameObjects.Text; createdAt: number }[] = []
  private inputActive = false
  private lastMessageCount = 0

  constructor(scene: Phaser.Scene, mp: MultiplayerManager) {
    this.scene = scene
    this.mp = mp
    this.container = scene.add.container(8, 560)
    this.container.setScrollFactor(0)
    this.container.setDepth(300)

    // Enter key to open chat
    scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER).on('down', () => {
      if (!mp.isOnline) return
      if (this.inputActive) return
      this.inputActive = true
      const msg = window.prompt('Chat:')
      this.inputActive = false
      if (msg && msg.trim()) {
        mp.sendChat(msg.trim())
      }
    })
  }

  update() {
    const messages = this.mp.chat

    // Only update if new messages arrived
    if (messages.length === this.lastMessageCount) {
      // Fade old messages
      const now = Date.now()
      for (const mt of this.messageTexts) {
        const age = now - mt.createdAt
        if (age > FADE_AFTER) {
          mt.text.setAlpha(Math.max(0, 1 - (age - FADE_AFTER) / 2000))
        }
      }
      return
    }

    this.lastMessageCount = messages.length

    // Clear old texts
    for (const mt of this.messageTexts) {
      mt.text.destroy()
    }
    this.messageTexts = []

    // Show last N messages
    const visible = messages.slice(-MAX_VISIBLE)
    for (let i = 0; i < visible.length; i++) {
      const msg = visible[i]!
      const color = msg.senderId === 0 ? '#888888' : '#aaddff'
      const prefix = msg.senderId === 0 ? '' : `${msg.name}: `
      const text = this.scene.add.text(0, i * 16 - visible.length * 16, `${prefix}${msg.text}`, {
        fontSize: '10px',
        color,
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 2,
        wordWrap: { width: 300 },
      })
      this.container.add(text)
      this.messageTexts.push({ text, createdAt: msg.time })
    }
  }

  destroy() {
    for (const mt of this.messageTexts) {
      mt.text.destroy()
    }
    this.messageTexts = []
    this.container.destroy()
  }
}
