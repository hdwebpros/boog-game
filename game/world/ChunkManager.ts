import Phaser from 'phaser'
import type { WorldData } from './WorldGenerator'
import { TileType, TILE_PROPERTIES, TILE_SIZE } from './TileRegistry'

const CHUNK_SIZE = 32 // tiles per chunk edge
const CHUNK_PX = CHUNK_SIZE * TILE_SIZE // 512 pixels
const VIEW_BUFFER = 1 // extra chunks beyond viewport
const MAX_CHUNKS_PER_FRAME = 6 // limit chunk creation to avoid stalls

interface Chunk {
  rt: Phaser.GameObjects.RenderTexture
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
  private stamp: Phaser.GameObjects.Image | null = null
  private eraser: Phaser.GameObjects.Image | null = null

  constructor(scene: Phaser.Scene, worldData: WorldData) {
    this.scene = scene
    this.worldData = worldData
    this.chunksX = Math.ceil(worldData.width / CHUNK_SIZE)
    this.chunksY = Math.ceil(worldData.height / CHUNK_SIZE)

    // Create reusable stamp for drawing tile textures onto RenderTextures
    // Use tile_1 (GRASS) as initial texture — it will be swapped per tile
    if (scene.textures.exists('tile_1')) {
      this.stamp = scene.make.image({ key: 'tile_1', x: 0, y: 0, add: false })
      this.stamp.setOrigin(0, 0)
    }

    // Reusable eraser for incremental tile updates
    const eraserGfx = scene.add.graphics()
    eraserGfx.setVisible(false)
    eraserGfx.fillStyle(0xffffff)
    eraserGfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
    eraserGfx.generateTexture('_eraser', TILE_SIZE, TILE_SIZE)
    eraserGfx.destroy()
    this.eraser = scene.make.image({ key: '_eraser', x: 0, y: 0, add: false })
    this.eraser.setOrigin(0, 0)
  }

  update() {
    const cam = this.scene.cameras.main
    const camCX = cam.scrollX + cam.width / 2
    const camCY = cam.scrollY + cam.height / 2

    // Visible chunk range (with buffer)
    const cx0 = Math.max(0, Math.floor(cam.scrollX / CHUNK_PX) - VIEW_BUFFER)
    const cy0 = Math.max(0, Math.floor(cam.scrollY / CHUNK_PX) - VIEW_BUFFER)
    const cx1 = Math.min(this.chunksX - 1, Math.ceil((cam.scrollX + cam.width) / CHUNK_PX) + VIEW_BUFFER)
    const cy1 = Math.min(this.chunksY - 1, Math.ceil((cam.scrollY + cam.height) / CHUNK_PX) + VIEW_BUFFER)

    const needed = new Set<string>()
    const toCreate: { cx: number; cy: number; dist: number }[] = []

    // Find which chunks are needed
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const key = `${cx},${cy}`
        needed.add(key)
        if (!this.activeChunks.has(key)) {
          const dx = (cx + 0.5) * CHUNK_PX - camCX
          const dy = (cy + 0.5) * CHUNK_PX - camCY
          toCreate.push({ cx, cy, dist: dx * dx + dy * dy })
        }
      }
    }

    // Create chunks closest to camera first, limited per frame
    if (toCreate.length > 0) {
      toCreate.sort((a, b) => a.dist - b.dist)
      const limit = Math.min(toCreate.length, MAX_CHUNKS_PER_FRAME)
      for (let i = 0; i < limit; i++) {
        const c = toCreate[i]!
        this.createChunk(c.cx, c.cy)
      }
    }

    // Remove off-screen chunks
    for (const [key, chunk] of this.activeChunks) {
      if (!needed.has(key)) {
        chunk.rt.destroy()
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

  /** Set tile and incrementally update just the affected tile (not the whole chunk) */
  setTile(tx: number, ty: number, type: TileType) {
    if (tx < 0 || tx >= this.worldData.width || ty < 0 || ty >= this.worldData.height) return
    this.worldData.tiles[ty * this.worldData.width + tx] = type

    const cx = Math.floor(tx / CHUNK_SIZE)
    const cy = Math.floor(ty / CHUNK_SIZE)
    const key = `${cx},${cy}`
    const chunk = this.activeChunks.get(key)
    if (!chunk) return

    const localX = (tx - cx * CHUNK_SIZE) * TILE_SIZE
    const localY = (ty - cy * CHUNK_SIZE) * TILE_SIZE

    // Erase old tile
    if (this.eraser) {
      chunk.rt.erase(this.eraser, localX, localY)
    }

    // Draw new tile (if not air)
    if (type !== TileType.AIR) {
      const texKey = `tile_${type}`
      if (this.stamp && this.scene.textures.exists(texKey)) {
        this.stamp.setTexture(texKey)
        this.stamp.setPosition(localX, localY)
        chunk.rt.draw(this.stamp)
      } else {
        const props = TILE_PROPERTIES[type]
        chunk.rt.fill(props.color, 1, localX, localY, TILE_SIZE, TILE_SIZE)
      }
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
    const rt = this.scene.add.renderTexture(
      cx * CHUNK_PX, cy * CHUNK_PX,
      CHUNK_PX, CHUNK_PX
    )
    rt.setOrigin(0, 0)
    this.renderChunk(rt, cx, cy)
    this.activeChunks.set(`${cx},${cy}`, { rt, dirty: false })
  }

  private renderChunk(rt: Phaser.GameObjects.RenderTexture, cx: number, cy: number) {
    rt.clear()

    const { tiles, width, height } = this.worldData
    const startTX = cx * CHUNK_SIZE
    const startTY = cy * CHUNK_SIZE

    if (this.stamp) {
      // Batch all tile draws into a single GPU pass
      rt.beginDraw()
      for (let ty = 0; ty < CHUNK_SIZE; ty++) {
        for (let tx = 0; tx < CHUNK_SIZE; tx++) {
          const wtx = startTX + tx
          const wty = startTY + ty
          if (wtx >= width || wty >= height) continue

          const tileType = tiles[wty * width + wtx] as TileType
          if (tileType === TileType.AIR) continue

          const texKey = `tile_${tileType}`
          if (this.scene.textures.exists(texKey)) {
            this.stamp.setTexture(texKey)
            this.stamp.setPosition(tx * TILE_SIZE, ty * TILE_SIZE)
            rt.batchDraw(this.stamp)
          }
        }
      }
      rt.endDraw()

      // Fallback fills for any tiles missing textures (outside batch)
      for (let ty = 0; ty < CHUNK_SIZE; ty++) {
        for (let tx = 0; tx < CHUNK_SIZE; tx++) {
          const wtx = startTX + tx
          const wty = startTY + ty
          if (wtx >= width || wty >= height) continue

          const tileType = tiles[wty * width + wtx] as TileType
          if (tileType === TileType.AIR) continue

          const texKey = `tile_${tileType}`
          if (!this.scene.textures.exists(texKey)) {
            const props = TILE_PROPERTIES[tileType]
            rt.fill(props.color, 1, tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE)
          }
        }
      }
    } else {
      // Fallback: no sprite textures, use colored fills
      for (let ty = 0; ty < CHUNK_SIZE; ty++) {
        for (let tx = 0; tx < CHUNK_SIZE; tx++) {
          const wtx = startTX + tx
          const wty = startTY + ty
          if (wtx >= width || wty >= height) continue

          const tileType = tiles[wty * width + wtx] as TileType
          if (tileType === TileType.AIR) continue

          const props = TILE_PROPERTIES[tileType]
          rt.fill(props.color, 1, tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE)
        }
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
      chunk.rt.destroy()
    }
    this.activeChunks.clear()
    if (this.stamp) {
      this.stamp.destroy()
      this.stamp = null
    }
    if (this.eraser) {
      this.eraser.destroy()
      this.eraser = null
    }
  }
}
