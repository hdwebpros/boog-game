/**
 * Simple in-game chat overlay for multiplayer.
 * Shows recent messages and an inline text input (Enter to open/send, Escape to cancel).
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
  private lastMessageCount = 0

  // DOM-based chat input
  private inputEl: HTMLInputElement | null = null
  private inputWrapper: HTMLDivElement | null = null
  private inputActive = false

  constructor(scene: Phaser.Scene, mp: MultiplayerManager) {
    this.scene = scene
    this.mp = mp
    this.container = scene.add.container(8, 560)
    this.container.setScrollFactor(0)
    this.container.setDepth(300)

    // Create the hidden chat input (HTML overlay)
    this.createInputElement()

    // Enter key to toggle chat input
    scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER).on('down', () => {
      if (!mp.isOnline) return
      if (this.inputActive) return
      this.showInput()
    })
  }

  private createInputElement() {
    const canvas = this.scene.game.canvas
    const parent = canvas.parentElement ?? document.body

    // Wrapper div to position at bottom of canvas
    this.inputWrapper = document.createElement('div')
    Object.assign(this.inputWrapper.style, {
      position: 'absolute',
      bottom: '8px',
      left: '8px',
      width: '320px',
      display: 'none',
      zIndex: '9998',
    })

    this.inputEl = document.createElement('input')
    this.inputEl.type = 'text'
    this.inputEl.maxLength = 120
    this.inputEl.placeholder = 'Type a message...'
    Object.assign(this.inputEl.style, {
      width: '100%',
      boxSizing: 'border-box',
      background: 'rgba(10, 10, 26, 0.85)',
      border: '1px solid #4444aa',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontSize: '11px',
      padding: '4px 8px',
      borderRadius: '2px',
      outline: 'none',
    })

    this.inputEl.addEventListener('keydown', (e) => {
      e.stopPropagation() // prevent game keys from firing
      if (e.key === 'Enter') {
        const text = this.inputEl!.value.trim()
        if (text) {
          this.mp.sendChat(text)
        }
        this.hideInput()
      } else if (e.key === 'Escape') {
        this.hideInput()
      }
    })
    // Also block keyup so game doesn't see released keys
    this.inputEl.addEventListener('keyup', (e) => e.stopPropagation())

    this.inputWrapper.appendChild(this.inputEl)
    parent.style.position = 'relative'
    parent.appendChild(this.inputWrapper)
  }

  private showInput() {
    if (!this.inputWrapper || !this.inputEl) return
    this.inputActive = true
    this.inputEl.value = ''
    this.inputWrapper.style.display = 'block'
    this.inputEl.focus()
  }

  private hideInput() {
    if (!this.inputWrapper || !this.inputEl) return
    this.inputActive = false
    this.inputWrapper.style.display = 'none'
    // Return focus to the game canvas
    this.scene.game.canvas.focus()
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

    // Show last N messages (positioned above input area)
    const visible = messages.slice(-MAX_VISIBLE)
    for (let i = 0; i < visible.length; i++) {
      const msg = visible[i]!
      const color = msg.senderId === 0 ? '#888888' : '#aaddff'
      const prefix = msg.senderId === 0 ? '' : `${msg.name}: `
      const text = this.scene.add.text(0, i * 16 - visible.length * 16 - 20, `${prefix}${msg.text}`, {
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
    // Clean up DOM elements
    if (this.inputWrapper) {
      this.inputWrapper.remove()
      this.inputWrapper = null
      this.inputEl = null
    }
  }
}
