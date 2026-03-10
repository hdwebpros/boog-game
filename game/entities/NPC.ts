import Phaser from 'phaser'
import { TILE_SIZE } from '../world/TileRegistry'

const INTERACT_RANGE = 3 // tiles

export class NPC {
  sprite: Phaser.GameObjects.Image
  private scene: Phaser.Scene
  private promptText: Phaser.GameObjects.Text
  private baseY: number
  private bobTimer = 0

  constructor(scene: Phaser.Scene, tx: number, ty: number) {
    this.scene = scene
    const px = tx * TILE_SIZE + TILE_SIZE / 2
    const py = ty * TILE_SIZE + TILE_SIZE / 2
    this.baseY = py

    const texKey = scene.textures.exists('npc_shopkeeper') ? 'npc_shopkeeper' : 'player'
    this.sprite = scene.add.image(px, py, texKey)
    this.sprite.setOrigin(0.5, 0.5)
    this.sprite.setDepth(10)
    // Scale to 16x32 world pixels (same as player)
    this.sprite.setDisplaySize(16, 32)

    this.promptText = scene.add.text(px, py - 24, '[F] Shop', {
      fontSize: '11px',
      color: '#ffdd44',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5, 1).setDepth(100).setVisible(false)
  }

  update(playerX: number, playerY: number): boolean {
    // Gentle bob
    this.bobTimer += 0.02
    this.sprite.y = this.baseY + Math.sin(this.bobTimer) * 2

    // Update prompt position
    this.promptText.setPosition(this.sprite.x, this.sprite.y - 20)

    const near = this.isPlayerNear(playerX, playerY)
    this.promptText.setVisible(near)
    return near
  }

  isPlayerNear(playerX: number, playerY: number): boolean {
    const dx = Math.abs(this.sprite.x - playerX) / TILE_SIZE
    const dy = Math.abs(this.sprite.y - playerY) / TILE_SIZE
    return dx <= INTERACT_RANGE && dy <= INTERACT_RANGE
  }

  destroy() {
    this.sprite.destroy()
    this.promptText.destroy()
  }
}
