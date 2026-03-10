import Phaser from 'phaser'
import type { WorldData } from '../world/WorldGenerator'
import { TileType, TILE_PROPERTIES, TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT } from '../world/TileRegistry'

const MAP_W = 160
const MAP_H = 48
const CELL_W = Math.ceil(WORLD_WIDTH / MAP_W)  // 25 tiles per pixel
const CELL_H = Math.ceil(WORLD_HEIGHT / MAP_H) // 25 tiles per pixel
const REVEAL_R = 3 // cells around player to reveal

export class MiniMap {
  private scene: Phaser.Scene
  private explored: Uint8Array
  private canvasTex!: Phaser.Textures.CanvasTexture
  private mapImage!: Phaser.GameObjects.Image
  private overlay: Phaser.GameObjects.Graphics
  private tiles: Uint8Array
  private worldW: number
  private worldH: number
  private lastCellX = -1
  private lastCellY = -1
  private mapX: number
  private mapY: number

  constructor(scene: Phaser.Scene, x: number, y: number, worldData: WorldData) {
    this.scene = scene
    this.tiles = worldData.tiles
    this.worldW = worldData.width
    this.worldH = worldData.height
    this.mapX = x
    this.mapY = y
    this.explored = new Uint8Array(MAP_W * MAP_H)

    // Remove old texture if scene restarted
    if (scene.textures.exists('_minimap')) {
      scene.textures.remove('_minimap')
    }

    this.canvasTex = scene.textures.createCanvas('_minimap', MAP_W, MAP_H)!
    const ctx = this.canvasTex.context
    ctx.fillStyle = '#0a0a15'
    ctx.fillRect(0, 0, MAP_W, MAP_H)
    this.canvasTex.refresh()

    this.mapImage = scene.add.image(x, y, '_minimap')
      .setOrigin(0, 0)
      .setDepth(195)
      .setAlpha(0.9)

    this.overlay = scene.add.graphics().setDepth(196)
  }

  update(playerWorldX: number, playerWorldY: number) {
    const cellX = Math.floor(playerWorldX / (CELL_W * TILE_SIZE))
    const cellY = Math.floor(playerWorldY / (CELL_H * TILE_SIZE))

    // Reveal cells around player when they move to a new cell
    if (cellX !== this.lastCellX || cellY !== this.lastCellY) {
      this.lastCellX = cellX
      this.lastCellY = cellY
      let dirty = false

      for (let dy = -REVEAL_R; dy <= REVEAL_R; dy++) {
        for (let dx = -REVEAL_R; dx <= REVEAL_R; dx++) {
          const cx = cellX + dx
          const cy = cellY + dy
          if (cx < 0 || cx >= MAP_W || cy < 0 || cy >= MAP_H) continue
          const idx = cy * MAP_W + cx
          if (!this.explored[idx]) {
            this.explored[idx] = 1
            dirty = true
            this.drawCell(cx, cy)
          }
        }
      }

      if (dirty) this.canvasTex.refresh()
    }

    // Draw overlay: border, viewport rect, player dot
    this.overlay.clear()

    // Border
    this.overlay.lineStyle(1, 0x334466, 0.8)
    this.overlay.strokeRect(this.mapX - 1, this.mapY - 1, MAP_W + 2, MAP_H + 2)

    // Viewport rectangle
    const worldScene = this.scene.scene.get('WorldScene')
    const cam = worldScene?.cameras?.main
    if (cam) {
      const worldPxW = WORLD_WIDTH * TILE_SIZE
      const worldPxH = WORLD_HEIGHT * TILE_SIZE
      const vx = this.mapX + (cam.worldView.x / worldPxW) * MAP_W
      const vy = this.mapY + (cam.worldView.y / worldPxH) * MAP_H
      const vw = (cam.worldView.width / worldPxW) * MAP_W
      const vh = (cam.worldView.height / worldPxH) * MAP_H
      this.overlay.lineStyle(1, 0xffffff, 0.3)
      this.overlay.strokeRect(vx, vy, vw, vh)
    }

    // Player dot (pulsing)
    const worldPxW = WORLD_WIDTH * TILE_SIZE
    const worldPxH = WORLD_HEIGHT * TILE_SIZE
    const px = this.mapX + (playerWorldX / worldPxW) * MAP_W
    const py = this.mapY + (playerWorldY / worldPxH) * MAP_H
    const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.005)
    this.overlay.fillStyle(0xffffff, pulse)
    this.overlay.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 3)
  }

  private drawCell(cx: number, cy: number) {
    // Sample center tile of this cell
    const tileX = Math.min(cx * CELL_W + Math.floor(CELL_W / 2), this.worldW - 1)
    const tileY = Math.min(cy * CELL_H + Math.floor(CELL_H / 2), this.worldH - 1)

    let tileType = this.tiles[tileY * this.worldW + tileX]! as TileType

    // If center is AIR, try corner samples
    if (tileType === TileType.AIR) {
      const offsets = [[0, 0], [CELL_W - 1, 0], [0, CELL_H - 1], [CELL_W - 1, CELL_H - 1]]
      for (const [ox, oy] of offsets) {
        const sx = Math.min(cx * CELL_W + ox!, this.worldW - 1)
        const sy = Math.min(cy * CELL_H + oy!, this.worldH - 1)
        const st = this.tiles[sy * this.worldW + sx]! as TileType
        if (st !== TileType.AIR) {
          tileType = st
          break
        }
      }
    }

    let color: number
    if (tileType === TileType.AIR) {
      // Sky gradient based on depth
      const t = cy / MAP_H
      if (t < 0.1) color = 0x050520
      else if (t < 0.2) color = 0x0a0a30
      else color = 0x111140
    } else {
      color = TILE_PROPERTIES[tileType]?.color ?? 0x333333
    }

    const r = (color >> 16) & 0xff
    const g = (color >> 8) & 0xff
    const b = color & 0xff
    this.canvasTex.setPixel(cx, cy, r, g, b)
  }

  getExplored(): number[] {
    return Array.from(this.explored)
  }

  loadExplored(data: number[]) {
    if (data.length !== MAP_W * MAP_H) return
    this.explored = new Uint8Array(data)

    // Redraw all explored cells
    const ctx = this.canvasTex.context
    ctx.fillStyle = '#0a0a15'
    ctx.fillRect(0, 0, MAP_W, MAP_H)
    for (let cy = 0; cy < MAP_H; cy++) {
      for (let cx = 0; cx < MAP_W; cx++) {
        if (this.explored[cy * MAP_W + cx]) {
          this.drawCell(cx, cy)
        }
      }
    }
    this.canvasTex.refresh()
  }

  destroy() {
    this.mapImage.destroy()
    this.overlay.destroy()
    if (this.scene.textures.exists('_minimap')) {
      this.scene.textures.remove('_minimap')
    }
  }
}
