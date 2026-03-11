/**
 * Collects raw input state each frame and produces InputState snapshots.
 * Replaces direct key polling in Player.ts for multiplayer compatibility.
 *
 * In single-player: input is consumed locally.
 * In multiplayer client: input is sent to host for validation.
 * In multiplayer host: remote inputs arrive as InputState from network.
 */

import Phaser from 'phaser'
import type { InputState } from './protocol'

export class InputCollector {
  private keyA: Phaser.Input.Keyboard.Key
  private keyD: Phaser.Input.Keyboard.Key
  private keyS: Phaser.Input.Keyboard.Key
  private keyW: Phaser.Input.Keyboard.Key
  private keySpace: Phaser.Input.Keyboard.Key
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys
  private scene: Phaser.Scene
  private seq = 0

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    const kb = scene.input.keyboard!
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A, false, false)
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D, false, false)
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S, false, false)
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W, false, false)
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE, false, false)
    this.cursors = kb.createCursorKeys()
  }

  /** Sample current input state. Call once per frame. */
  sample(dt: number): InputState {
    const pointer = this.scene.input.activePointer
    const cam = this.scene.cameras.main
    const wp = cam.getWorldPoint(pointer.x, pointer.y)

    this.seq++

    return {
      left: this.keyA.isDown || this.cursors.left.isDown,
      right: this.keyD.isDown || this.cursors.right.isDown,
      up: this.keyW.isDown || this.cursors.up.isDown,
      down: this.keyS.isDown || this.cursors.down.isDown,
      jump: this.keySpace.isDown || this.keyW.isDown || this.cursors.up.isDown,
      cursorX: wp.x,
      cursorY: wp.y,
      lmb: pointer.leftButtonDown(),
      rmb: pointer.rightButtonDown(),
      seq: this.seq,
      dt,
    }
  }

  /** Create an empty/idle input state (for remote players with no pending input) */
  static idle(seq = 0, dt = 0): InputState {
    return {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      cursorX: 0,
      cursorY: 0,
      lmb: false,
      rmb: false,
      seq,
      dt,
    }
  }
}
