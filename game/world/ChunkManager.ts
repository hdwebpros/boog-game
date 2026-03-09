import Phaser from 'phaser'
import type { WorldData } from './WorldGenerator'
import { TileType, TILE_PROPERTIES, TILE_SIZE } from './TileRegistry'

const CHUNK_SIZE = 32 // tiles per chunk edge
const CHUNK_PX = CHUNK_SIZE * TILE_SIZE // 512 pixels
const VIEW_BUFFER = 2 // extra chunks beyond viewport

interface Chunk {
  graphics: Phaser.GameObjects.Graphics
  dirty: boolean
}

export interface PlacedStation {
  tx: number
  ty: number
  itemId: number
}

export class ChunkManager {
  private scene: Phaser.Scene
  private worldData: WorldData
  private activeChunks = new Map<string, Chunk>()
  private chunksX: number
  private chunksY: number
  private placedStations: PlacedStation[] = []

  constructor(scene: Phaser.Scene, worldData: WorldData) {
    this.scene = scene
    this.worldData = worldData
    this.chunksX = Math.ceil(worldData.width / CHUNK_SIZE)
    this.chunksY = Math.ceil(worldData.height / CHUNK_SIZE)
  }

  update() {
    const cam = this.scene.cameras.main

    // Visible chunk range (with buffer)
    const cx0 = Math.max(0, Math.floor(cam.scrollX / CHUNK_PX) - VIEW_BUFFER)
    const cy0 = Math.max(0, Math.floor(cam.scrollY / CHUNK_PX) - VIEW_BUFFER)
    const cx1 = Math.min(this.chunksX - 1, Math.ceil((cam.scrollX + cam.width) / CHUNK_PX) + VIEW_BUFFER)
    const cy1 = Math.min(this.chunksY - 1, Math.ceil((cam.scrollY + cam.height) / CHUNK_PX) + VIEW_BUFFER)

    const needed = new Set<string>()

    // Activate visible chunks
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const key = `${cx},${cy}`
        needed.add(key)
        if (!this.activeChunks.has(key)) {
          this.createChunk(cx, cy)
        }
      }
    }

    // Remove off-screen chunks
    for (const [key, chunk] of this.activeChunks) {
      if (!needed.has(key)) {
        chunk.graphics.destroy()
        this.activeChunks.delete(key)
      }
    }
  }

  /** Get tile type at tile coordinates */
  getTile(tx: number, ty: number): TileType {
    if (tx < 0 || tx >= this.worldData.width || ty < 0 || ty >= this.worldData.height) {
      return TileType.AIR
    }
    return this.worldData.tiles[ty * this.worldData.width + tx] as TileType
  }

  /** Set tile and redraw the affected chunk */
  setTile(tx: number, ty: number, type: TileType) {
    if (tx < 0 || tx >= this.worldData.width || ty < 0 || ty >= this.worldData.height) return
    this.worldData.tiles[ty * this.worldData.width + tx] = type

    const cx = Math.floor(tx / CHUNK_SIZE)
    const cy = Math.floor(ty / CHUNK_SIZE)
    const key = `${cx},${cy}`
    const chunk = this.activeChunks.get(key)
    if (chunk) {
      chunk.dirty = true
      this.renderChunk(chunk.graphics, cx, cy)
      chunk.dirty = false
    }
  }

  /** Check if a tile position is solid */
  isSolid(tx: number, ty: number): boolean {
    const type = this.getTile(tx, ty)
    return TILE_PROPERTIES[type]?.solid ?? false
  }

  /** World pixel coords → tile coords */
  worldToTile(px: number, py: number): { tx: number; ty: number } {
    return {
      tx: Math.floor(px / TILE_SIZE),
      ty: Math.floor(py / TILE_SIZE),
    }
  }

  /** Tile coords → world pixel coords (top-left of tile) */
  tileToWorld(tx: number, ty: number): { px: number; py: number } {
    return {
      px: tx * TILE_SIZE,
      py: ty * TILE_SIZE,
    }
  }

  private createChunk(cx: number, cy: number) {
    const gfx = this.scene.add.graphics()
    this.renderChunk(gfx, cx, cy)
    this.activeChunks.set(`${cx},${cy}`, { graphics: gfx, dirty: false })
  }

  private renderChunk(gfx: Phaser.GameObjects.Graphics, cx: number, cy: number) {
    gfx.clear()

    const { tiles, width, height } = this.worldData
    const startTX = cx * CHUNK_SIZE
    const startTY = cy * CHUNK_SIZE

    // Batch by color to reduce state changes
    const colorBatches = new Map<number, { x: number; y: number }[]>()

    for (let ty = 0; ty < CHUNK_SIZE; ty++) {
      for (let tx = 0; tx < CHUNK_SIZE; tx++) {
        const wtx = startTX + tx
        const wty = startTY + ty
        if (wtx >= width || wty >= height) continue

        const tileType = tiles[wty * width + wtx] as TileType
        if (tileType === TileType.AIR) continue

        const props = TILE_PROPERTIES[tileType]
        const color = props.color

        let batch = colorBatches.get(color)
        if (!batch) {
          batch = []
          colorBatches.set(color, batch)
        }
        batch.push({
          x: wtx * TILE_SIZE,
          y: wty * TILE_SIZE,
        })
      }
    }

    // Draw all tiles of each color in one batch
    for (const [color, positions] of colorBatches) {
      gfx.fillStyle(color)
      for (const pos of positions) {
        gfx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE)
      }
    }
  }

  /** Place a crafting station in the world */
  placeStation(tx: number, ty: number, itemId: number) {
    this.placedStations.push({ tx, ty, itemId })
  }

  /** Remove a station at tile coords */
  removeStation(tx: number, ty: number) {
    this.placedStations = this.placedStations.filter(s => s.tx !== tx || s.ty !== ty)
  }

  /** Get all placed stations */
  getPlacedStations(): PlacedStation[] {
    return this.placedStations
  }

  destroy() {
    for (const [, chunk] of this.activeChunks) {
      chunk.graphics.destroy()
    }
    this.activeChunks.clear()
  }
}
