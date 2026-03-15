import Phaser from 'phaser'
import type { WorldData } from '../world/WorldGenerator'
import { TileType, TILE_PROPERTIES, TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT } from '../world/TileRegistry'

export interface BossMarker {
  bossType: string
  worldX: number // pixel coords
  worldY: number
}

export interface POIMarker {
  type: 'runestone' | 'altar'
  bossType: string
  worldX: number // pixel coords
  worldY: number
}

const MAP_W = 240
const MAP_H = 64
const CELL_W = Math.ceil(WORLD_WIDTH / MAP_W)
const CELL_H = Math.ceil(WORLD_HEIGHT / MAP_H)
const REVEAL_R = 4

const SCALES = [1, 2, 4]
const MAX_DISPLAY_W = MAP_W // 240
const MAX_DISPLAY_H = 128
const MARGIN = 8

export class MiniMap {
  private scene: Phaser.Scene
  private explored: Uint8Array
  private canvasTex!: Phaser.Textures.CanvasTexture
  private mapImage!: Phaser.GameObjects.Image
  private gfx!: Phaser.GameObjects.Graphics
  private bgGfx!: Phaser.GameObjects.Graphics
  private label!: Phaser.GameObjects.Text
  private tiles: Uint8Array
  private worldW: number
  private worldH: number
  private lastCellX = -1
  private lastCellY = -1
  private _visible = false
  private zoomIdx = 0
  private playerMapX = 0
  private playerMapY = 0
  private bossIcons: Map<string, Phaser.GameObjects.Image> = new Map()
  private poiGfx!: Phaser.GameObjects.Graphics
  private _poiMarkers: POIMarker[] = []
  // Current view state
  private cropX = 0
  private cropY = 0
  private cropW = MAP_W
  private cropH = MAP_H
  private imgX = 0
  private imgY = 0
  private currentScale = 1

  constructor(scene: Phaser.Scene, worldData: WorldData) {
    this.scene = scene
    this.tiles = worldData.tiles
    this.worldW = worldData.width
    this.worldH = worldData.height
    this.explored = new Uint8Array(MAP_W * MAP_H)

    if (scene.textures.exists('_minimap')) {
      scene.textures.remove('_minimap')
    }
    this.canvasTex = scene.textures.createCanvas('_minimap', MAP_W, MAP_H)!
    const ctx = this.canvasTex.context
    ctx.fillStyle = '#0a0a15'
    ctx.fillRect(0, 0, MAP_W, MAP_H)
    this.canvasTex.refresh()

    // Background behind the map
    this.bgGfx = scene.add.graphics().setDepth(194).setVisible(false)

    // Map image
    this.mapImage = scene.add.image(0, 0, '_minimap')
      .setOrigin(0, 0).setDepth(195).setAlpha(0.85).setVisible(false)

    // Overlay (border, player dot, viewport rect)
    this.gfx = scene.add.graphics().setDepth(196).setVisible(false)

    // POI markers (runestones, altars)
    this.poiGfx = scene.add.graphics().setDepth(196).setVisible(false)

    // Zoom label
    this.label = scene.add.text(0, 0, '', {
      fontFamily: 'monospace', fontSize: '10px', color: '#8899bb',
    }).setOrigin(0, 1).setDepth(197).setVisible(false)
  }

  get visible() { return this._visible }

  /** Expose raw explored array for the full-screen world map */
  getExploredArray(): Uint8Array { return this.explored }

  /** Get player position in map coordinates */
  getPlayerMapPos(): { x: number; y: number } {
    return { x: this.playerMapX, y: this.playerMapY }
  }

  toggle() {
    this._visible = !this._visible
    this.mapImage.setVisible(this._visible)
    this.gfx.setVisible(this._visible)
    this.bgGfx.setVisible(this._visible)
    this.poiGfx.setVisible(this._visible)
    this.label.setVisible(this._visible)
    for (const icon of this.bossIcons.values()) icon.setVisible(this._visible)
    if (this._visible) this.applyZoom()
    else this.gfx.clear(), this.bgGfx.clear(), this.poiGfx.clear()
  }

  zoomIn() {
    if (!this._visible || this.zoomIdx >= SCALES.length - 1) return
    this.zoomIdx++
    this.applyZoom()
  }

  zoomOut() {
    if (!this._visible || this.zoomIdx <= 0) return
    this.zoomIdx--
    this.applyZoom()
  }

  private applyZoom() {
    const s = SCALES[this.zoomIdx]!
    this.currentScale = s
    this.mapImage.setScale(s)

    if (s === 1) {
      // Full overview
      this.cropX = 0
      this.cropY = 0
      this.cropW = MAP_W
      this.cropH = MAP_H
      this.mapImage.setCrop(0, 0, MAP_W, MAP_H)
      const screenH = this.scene.cameras.main.height
      this.imgX = MARGIN
      this.imgY = screenH - MARGIN - MAP_H
      this.mapImage.setPosition(this.imgX, this.imgY)
    } else {
      this.updateCrop()
    }
    this.updateLabel()
    this.drawBackground()
  }

  private updateCrop() {
    const s = this.currentScale
    const cw = Math.min(Math.floor(MAX_DISPLAY_W / s), MAP_W)
    const ch = Math.min(Math.floor(MAX_DISPLAY_H / s), MAP_H)

    let cx = Math.round(this.playerMapX - cw / 2)
    let cy = Math.round(this.playerMapY - ch / 2)
    cx = Math.max(0, Math.min(MAP_W - cw, cx))
    cy = Math.max(0, Math.min(MAP_H - ch, cy))

    this.cropX = cx
    this.cropY = cy
    this.cropW = cw
    this.cropH = ch
    this.mapImage.setCrop(cx, cy, cw, ch)

    const screenH = this.scene.cameras.main.height
    this.imgX = MARGIN
    this.imgY = screenH - MARGIN - ch * s
    this.mapImage.setPosition(this.imgX, this.imgY)
  }

  private drawBackground() {
    this.bgGfx.clear()
    const displayW = this.cropW * this.currentScale
    const displayH = this.cropH * this.currentScale
    this.bgGfx.fillStyle(0x000000, 0.5)
    this.bgGfx.fillRect(this.imgX - 2, this.imgY - 2, displayW + 4, displayH + 4)
  }

  private updateLabel() {
    const displayH = this.cropH * this.currentScale
    const screenH = this.scene.cameras.main.height
    const topY = screenH - MARGIN - displayH
    this.label.setPosition(MARGIN + 2, topY - 3)
    this.label.setText(`MAP ${SCALES[this.zoomIdx]}x`)
  }

  update(playerWorldX: number, playerWorldY: number) {
    const worldPxW = WORLD_WIDTH * TILE_SIZE
    const worldPxH = WORLD_HEIGHT * TILE_SIZE
    this.playerMapX = (playerWorldX / worldPxW) * MAP_W
    this.playerMapY = (playerWorldY / worldPxH) * MAP_H

    const cellX = Math.floor(playerWorldX / (CELL_W * TILE_SIZE))
    const cellY = Math.floor(playerWorldY / (CELL_H * TILE_SIZE))

    // Reveal cells around player
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

    if (!this._visible) return

    // Update crop for zoomed views
    if (this.currentScale > 1) {
      this.updateCrop()
      this.drawBackground()
      this.updateLabel()
    }

    // Draw overlay
    this.gfx.clear()

    // Border
    const displayW = this.cropW * this.currentScale
    const displayH = this.cropH * this.currentScale
    this.gfx.lineStyle(1, 0x334466, 0.8)
    this.gfx.strokeRect(this.imgX - 1, this.imgY - 1, displayW + 2, displayH + 2)

    // Viewport rectangle
    const worldScene = this.scene.scene.get('WorldScene')
    const cam = worldScene?.cameras?.main
    if (cam) {
      const vx1 = (cam.worldView.x / worldPxW) * MAP_W
      const vy1 = (cam.worldView.y / worldPxH) * MAP_H
      const vw = (cam.worldView.width / worldPxW) * MAP_W
      const vh = (cam.worldView.height / worldPxH) * MAP_H

      const sx = this.imgX + (vx1 - this.cropX) * this.currentScale
      const sy = this.imgY + (vy1 - this.cropY) * this.currentScale
      const sw = vw * this.currentScale
      const sh = vh * this.currentScale

      // Clip to display area
      const clipX = Math.max(this.imgX, sx)
      const clipY = Math.max(this.imgY, sy)
      const clipR = Math.min(this.imgX + displayW, sx + sw)
      const clipB = Math.min(this.imgY + displayH, sy + sh)
      if (clipR > clipX && clipB > clipY) {
        this.gfx.lineStyle(1, 0xffffff, 0.3)
        this.gfx.strokeRect(clipX, clipY, clipR - clipX, clipB - clipY)
      }
    }

    // Player dot (pulsing)
    const px = this.imgX + (this.playerMapX - this.cropX) * this.currentScale
    const py = this.imgY + (this.playerMapY - this.cropY) * this.currentScale
    // Only draw if within display bounds
    if (px >= this.imgX && px <= this.imgX + displayW &&
        py >= this.imgY && py <= this.imgY + displayH) {
      const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.005)
      const dotSize = Math.max(2, Math.round(this.currentScale))
      this.gfx.fillStyle(0xffffff, pulse)
      this.gfx.fillRect(
        Math.round(px) - Math.floor(dotSize / 2),
        Math.round(py) - Math.floor(dotSize / 2),
        dotSize, dotSize,
      )
    }

    // Update boss icon positions
    this.updateBossIconPositions(displayW, displayH)

    // Draw POI markers (runestones, altars)
    this.drawPOIMarkers(displayW, displayH)
  }

  updateBossMarkers(markers: BossMarker[]) {
    const worldPxW = WORLD_WIDTH * TILE_SIZE
    const worldPxH = WORLD_HEIGHT * TILE_SIZE

    // Remove icons for bosses no longer in the list
    for (const [key, img] of this.bossIcons) {
      if (!markers.some(m => m.bossType === key)) {
        img.destroy()
        this.bossIcons.delete(key)
      }
    }

    // Create icons for new bosses
    for (const marker of markers) {
      if (this.bossIcons.has(marker.bossType)) continue

      const texKey = `boss_${marker.bossType}`
      if (!this.scene.textures.exists(texKey)) continue

      const icon = this.scene.add.image(0, 0, texKey)
        .setDepth(197)
        .setVisible(this._visible)

      // Scale icon to fit nicely on the minimap (roughly 12x12 display pixels)
      const frame = this.scene.textures.getFrame(texKey)
      const iconSize = 12
      const scaleX = iconSize / frame.width
      const scaleY = iconSize / frame.height
      const s = Math.min(scaleX, scaleY)
      icon.setScale(s)

      this.bossIcons.set(marker.bossType, icon)
    }

    // Store marker world positions for use in updateBossIconPositions
    this._bossMarkers = markers
  }

  private _bossMarkers: BossMarker[] = []

  private updateBossIconPositions(displayW: number, displayH: number) {
    const worldPxW = WORLD_WIDTH * TILE_SIZE
    const worldPxH = WORLD_HEIGHT * TILE_SIZE

    for (const marker of this._bossMarkers) {
      const icon = this.bossIcons.get(marker.bossType)
      if (!icon) continue

      const mapX = (marker.worldX / worldPxW) * MAP_W
      const mapY = (marker.worldY / worldPxH) * MAP_H

      const sx = this.imgX + (mapX - this.cropX) * this.currentScale
      const sy = this.imgY + (mapY - this.cropY) * this.currentScale

      // Only show if within minimap display bounds
      const inBounds = sx >= this.imgX && sx <= this.imgX + displayW &&
                       sy >= this.imgY && sy <= this.imgY + displayH
      icon.setVisible(this._visible && inBounds)

      if (inBounds) {
        // Pulse effect
        const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.003 + marker.bossType.length)
        icon.setPosition(Math.round(sx), Math.round(sy))
        icon.setAlpha(pulse)
      }
    }
  }

  updatePOIMarkers(markers: POIMarker[]) {
    this._poiMarkers = markers
  }

  private drawPOIMarkers(displayW: number, displayH: number) {
    this.poiGfx.clear()
    if (!this._visible || this._poiMarkers.length === 0) return

    const worldPxW = WORLD_WIDTH * TILE_SIZE
    const worldPxH = WORLD_HEIGHT * TILE_SIZE

    for (const marker of this._poiMarkers) {
      const mapX = (marker.worldX / worldPxW) * MAP_W
      const mapY = (marker.worldY / worldPxH) * MAP_H

      const sx = this.imgX + (mapX - this.cropX) * this.currentScale
      const sy = this.imgY + (mapY - this.cropY) * this.currentScale

      const inBounds = sx >= this.imgX && sx <= this.imgX + displayW &&
                       sy >= this.imgY && sy <= this.imgY + displayH
      if (!inBounds) continue

      const pulse = 0.6 + 0.4 * Math.sin(Date.now() * 0.004 + mapX + mapY)
      const size = Math.max(2, Math.round(this.currentScale * 1.5))

      if (marker.type === 'altar') {
        // Red diamond for altars
        this.poiGfx.fillStyle(0xff4444, pulse)
        this.poiGfx.fillPoint(Math.round(sx), Math.round(sy), size + 1)
      } else {
        // Cyan dot for runestones
        this.poiGfx.fillStyle(0x44ccff, pulse)
        this.poiGfx.fillPoint(Math.round(sx), Math.round(sy), size)
      }
    }
  }

  private drawCell(cx: number, cy: number) {
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

  /** Check if screen coordinates are within the minimap display area */
  hitTest(sx: number, sy: number): boolean {
    if (!this._visible) return false
    const displayW = this.cropW * this.currentScale
    const displayH = this.cropH * this.currentScale
    return sx >= this.imgX && sx <= this.imgX + displayW &&
           sy >= this.imgY && sy <= this.imgY + displayH
  }

  /** Cycle zoom: 1x → 2x → 4x → 1x */
  cycleZoom() {
    if (!this._visible) return
    this.zoomIdx = (this.zoomIdx + 1) % SCALES.length
    this.applyZoom()
  }

  getExplored(): number[] {
    return Array.from(this.explored)
  }

  loadExplored(data: number[]) {
    if (data.length !== MAP_W * MAP_H) return
    this.explored = new Uint8Array(data)

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
    this.gfx.destroy()
    this.bgGfx.destroy()
    this.poiGfx.destroy()
    this.label.destroy()
    for (const icon of this.bossIcons.values()) icon.destroy()
    this.bossIcons.clear()
    if (this.scene.textures.exists('_minimap')) {
      this.scene.textures.remove('_minimap')
    }
  }
}
