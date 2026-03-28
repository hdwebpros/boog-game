import Phaser from 'phaser'
import type { WorldData, AltarPlacement, RunestonePlacement } from './WorldGenerator'
import { TileType, TILE_PROPERTIES, TILE_SIZE } from './TileRegistry'
import { ALTAR_DEFS, BOSS_DEFS } from '../data/bosses'
import type { BossType } from '../data/bosses'
import type { ItemStack } from '../systems/InventoryManager'

const CHUNK_SIZE = 32 // tiles per chunk edge
const CHUNK_PX = CHUNK_SIZE * TILE_SIZE // 512 pixels
const VIEW_BUFFER = 1 // extra chunks beyond viewport
const MAX_CHUNKS_PER_FRAME = 6 // limit chunk creation to avoid stalls

interface Chunk {
  rt: Phaser.GameObjects.RenderTexture
  dirty: boolean
}

export const CHEST_SLOTS = 20

export interface PlacedStation {
  tx: number
  ty: number
  itemId: number
}

export interface ChestData {
  tx: number
  ty: number
  items: (ItemStack | null)[]
}

export interface PortalData {
  tx: number  // top-left tile x of the 4x4 portal
  ty: number  // top-left tile y of the 4x4 portal
  name: string // empty string = unnamed
}

export class ChunkManager {
  private scene: Phaser.Scene
  private worldData: WorldData
  private activeChunks = new Map<string, Chunk>()
  private chunksX: number
  private chunksY: number
  private placedStations: PlacedStation[] = []
  private chestInventories = new Map<string, (ItemStack | null)[]>()
  private portals: PortalData[] = []
  private portalSprites = new Map<string, Phaser.GameObjects.Graphics>()
  private stamp: Phaser.GameObjects.Image | null = null
  private eraser: Phaser.GameObjects.Image | null = null

  // Altar & runestone sprites (drawn as game objects, not baked into chunks)
  private altarSprites: Phaser.GameObjects.Graphics[] = []
  private runestoneSprites: Phaser.GameObjects.Graphics[] = []
  private loreRunestoneSprite: Phaser.GameObjects.Graphics | null = null

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

    // Create altar sprites
    this.createAltarSprites()
    this.createRunestoneSprites()
    this.createLoreRunestoneSprite()
  }

  private createAltarSprites() {
    for (const altar of this.worldData.altars ?? []) {
      const altarDef = ALTAR_DEFS[altar.bossType]
      if (!altarDef) continue

      // ty is the ground tile; graphics origin at top-left of ground tile
      // y=0 is the ground surface, negative y goes upward into air
      const px = altar.tx * TILE_SIZE
      const py = altar.ty * TILE_SIZE

      const gfx = this.scene.add.graphics()
      gfx.setPosition(px, py)
      gfx.setDepth(5)

      // Stone base platform flush with ground surface (3 tiles wide)
      gfx.fillStyle(0x555566)
      gfx.fillRect(-TILE_SIZE, -4, TILE_SIZE * 3, 4)

      // Central pedestal rising from ground
      gfx.fillStyle(0x444455)
      gfx.fillRect(0, -TILE_SIZE * 2, TILE_SIZE, TILE_SIZE * 2)

      // Colored top gem/flame
      gfx.fillStyle(altarDef.color, 0.9)
      gfx.fillRect(2, -TILE_SIZE * 2 - 4, TILE_SIZE - 4, 6)

      // Side pillars
      gfx.fillStyle(0x666677)
      gfx.fillRect(-TILE_SIZE + 2, -TILE_SIZE - 4, 6, TILE_SIZE)
      gfx.fillRect(TILE_SIZE + 8, -TILE_SIZE - 4, 6, TILE_SIZE)

      // Glowing rune marks on pillars
      gfx.fillStyle(altarDef.color, 0.5)
      gfx.fillRect(-TILE_SIZE + 3, -TILE_SIZE + 4, 4, 4)
      gfx.fillRect(TILE_SIZE + 9, -TILE_SIZE + 4, 4, 4)

      this.altarSprites.push(gfx)
    }
  }

  private createRunestoneSprites() {
    for (const rs of this.worldData.runestones ?? []) {
      const altarDef = ALTAR_DEFS[rs.bossType]
      if (!altarDef) continue

      // ty is the ground tile; graphics origin at top-left of ground tile
      // y=0 is the ground surface, negative y goes upward into air
      const px = rs.tx * TILE_SIZE
      const py = rs.ty * TILE_SIZE

      const gfx = this.scene.add.graphics()
      gfx.setPosition(px, py)
      gfx.setDepth(5)

      // Stone tablet sitting on ground surface, rising upward
      gfx.fillStyle(0x556655)
      gfx.fillRect(2, -TILE_SIZE, TILE_SIZE - 4, TILE_SIZE)

      // Pointed top
      gfx.fillStyle(0x556655)
      gfx.fillTriangle(
        TILE_SIZE / 2, -TILE_SIZE - 6,
        2, -TILE_SIZE,
        TILE_SIZE - 2, -TILE_SIZE
      )

      // Glowing rune symbol
      gfx.fillStyle(altarDef.color, 0.7)
      gfx.fillRect(5, -TILE_SIZE + 5, TILE_SIZE - 10, 2)
      gfx.fillRect(TILE_SIZE / 2 - 1, -TILE_SIZE + 3, 2, 8)

      this.runestoneSprites.push(gfx)
    }
  }

  private createLoreRunestoneSprite() {
    const pos = this.worldData.loreRunestonePos
    if (!pos) return

    const px = pos.tx * TILE_SIZE
    const py = pos.ty * TILE_SIZE

    const gfx = this.scene.add.graphics()
    gfx.setPosition(px, py)
    gfx.setDepth(5)

    // Larger stone tablet (2 tiles tall) with a wider base
    const w = TILE_SIZE + 4
    const h = TILE_SIZE * 2

    // Stone body
    gfx.fillStyle(0x5a5a6a)
    gfx.fillRect(-2, -h, w, h)

    // Rounded top accent
    gfx.fillStyle(0x5a5a6a)
    gfx.fillTriangle(w / 2 - 2, -h - 8, -2, -h, w - 2, -h)

    // Dark border edges
    gfx.fillStyle(0x3a3a4a)
    gfx.fillRect(-2, -h, 2, h)
    gfx.fillRect(w - 4, -h, 2, h)

    // Carved line decorations
    gfx.fillStyle(0x8888aa, 0.6)
    gfx.fillRect(3, -h + 6, w - 10, 1)
    gfx.fillRect(3, -h + 10, w - 10, 1)
    gfx.fillRect(3, -h + 14, w - 10, 1)
    gfx.fillRect(3, -h + 18, w - 10, 1)
    gfx.fillRect(3, -h + 22, w - 10, 1)

    // Glowing amber center rune
    gfx.fillStyle(0xddaa44, 0.8)
    gfx.fillRect(w / 2 - 3, -TILE_SIZE - 2, 6, 6)
    gfx.fillStyle(0xffcc66, 0.5)
    gfx.fillRect(w / 2 - 2, -TILE_SIZE - 1, 4, 4)

    this.loreRunestoneSprite = gfx
  }

  getLoreRunestonePos(): { tx: number; ty: number } | null {
    return this.worldData.loreRunestonePos ?? null
  }

  update() {
    const cam = this.scene.cameras.main
    const view = cam.worldView
    const camCX = view.centerX
    const camCY = view.centerY

    // Visible chunk range (with buffer) — uses worldView for zoom correctness
    const cx0 = Math.max(0, Math.floor(view.x / CHUNK_PX) - VIEW_BUFFER)
    const cy0 = Math.max(0, Math.floor(view.y / CHUNK_PX) - VIEW_BUFFER)
    const cx1 = Math.min(this.chunksX - 1, Math.ceil((view.x + view.width) / CHUNK_PX) + VIEW_BUFFER)
    const cy1 = Math.min(this.chunksY - 1, Math.ceil((view.y + view.height) / CHUNK_PX) + VIEW_BUFFER)

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
      const hasTex = this.stamp && this.scene.textures.exists(texKey)
      const src = hasTex ? this.scene.textures.get(texKey).source[0] : null
      if (hasTex && src && src.image) {
        this.stamp!.setTexture(texKey)
        this.stamp!.setPosition(localX, localY)
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

  /** Check if a tile position is climbable (vine rope) */
  isClimbable(tx: number, ty: number): boolean {
    const type = this.getTile(tx, ty)
    return TILE_PROPERTIES[type]?.climbable ?? false
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
            const tex = this.scene.textures.get(texKey)
            const src = tex.source[0]
            // Skip if the texture source image is missing (failed PNG load)
            if (src && src.image) {
              this.stamp.setTexture(texKey)
              this.stamp.setPosition(tx * TILE_SIZE, ty * TILE_SIZE)
              rt.batchDraw(this.stamp)
            }
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

  /** Get chest inventory at tile coords (creates if missing) */
  getChestInventory(tx: number, ty: number): (ItemStack | null)[] {
    const key = `${tx},${ty}`
    let inv = this.chestInventories.get(key)
    if (!inv) {
      inv = new Array(CHEST_SLOTS).fill(null)
      this.chestInventories.set(key, inv)
    }
    return inv
  }

  /** Remove chest inventory when chest is mined */
  removeChestInventory(tx: number, ty: number) {
    this.chestInventories.delete(`${tx},${ty}`)
  }

  /** Get all chest inventories for save */
  getChestInventories(): ChestData[] {
    const result: ChestData[] = []
    for (const [key, items] of this.chestInventories) {
      // Only save non-empty chests
      if (items.some(s => s !== null)) {
        const [txStr, tyStr] = key.split(',')
        result.push({ tx: Number(txStr), ty: Number(tyStr), items })
      }
    }
    return result
  }

  /** Restore chest inventories from save */
  setChestInventory(tx: number, ty: number, items: (ItemStack | null)[]) {
    this.chestInventories.set(`${tx},${ty}`, items)
  }

  /** Place a portal (4x4 tiles starting at tx,ty as top-left) */
  placePortal(tx: number, ty: number) {
    this.portals.push({ tx, ty, name: '' })
    this.createPortalSprite(this.portals[this.portals.length - 1]!)
  }

  /** Remove portal at any tile within its 4x4 area */
  removePortal(tx: number, ty: number): PortalData | null {
    const idx = this.portals.findIndex(p =>
      tx >= p.tx && tx < p.tx + 4 && ty >= p.ty && ty < p.ty + 4
    )
    if (idx < 0) return null
    const portal = this.portals.splice(idx, 1)[0]!
    const key = `${portal.tx},${portal.ty}`
    const sprite = this.portalSprites.get(key)
    if (sprite) {
      const label = (sprite as any)._portalLabel as Phaser.GameObjects.Text | undefined
      if (label) label.destroy()
      sprite.destroy()
      this.portalSprites.delete(key)
    }
    return portal
  }

  /** Get portal at tile coords (checks within 4x4 area) */
  getPortalAt(tx: number, ty: number): PortalData | null {
    return this.portals.find(p =>
      tx >= p.tx && tx < p.tx + 4 && ty >= p.ty && ty < p.ty + 4
    ) ?? null
  }

  /** Get all portals */
  getPortals(): PortalData[] {
    return this.portals
  }

  /** Find the matching portal (same name, different location) */
  getLinkedPortal(portal: PortalData): PortalData | null {
    if (!portal.name) return null
    return this.portals.find(p =>
      p.name === portal.name && (p.tx !== portal.tx || p.ty !== portal.ty)
    ) ?? null
  }

  /** Set portal name */
  setPortalName(portal: PortalData, name: string) {
    portal.name = name
    // Update sprite label
    const key = `${portal.tx},${portal.ty}`
    const sprite = this.portalSprites.get(key)
    if (sprite) {
      sprite.destroy()
      this.portalSprites.delete(key)
    }
    this.createPortalSprite(portal)
  }

  /** Get portal save data */
  getPortalData(): PortalData[] {
    return [...this.portals]
  }

  /** Restore portals from save */
  restorePortals(data: PortalData[]) {
    for (const p of data) {
      this.portals.push({ tx: p.tx, ty: p.ty, name: p.name })
      this.createPortalSprite(this.portals[this.portals.length - 1]!)
    }
  }

  /** Create a visual portal sprite (animated swirling effect) */
  private createPortalSprite(portal: PortalData) {
    const key = `${portal.tx},${portal.ty}`
    const gfx = this.scene.add.graphics()
    gfx.setDepth(5) // above tiles, below entities

    // Draw portal frame (4x4 tiles = 64x64 pixels)
    const px = portal.tx * TILE_SIZE
    const py = portal.ty * TILE_SIZE
    const w = 4 * TILE_SIZE
    const h = 4 * TILE_SIZE

    // Outer frame
    gfx.lineStyle(2, 0x7744ff, 1)
    gfx.strokeRect(px, py, w, h)

    // Inner glow
    gfx.fillStyle(0x5522cc, 0.3)
    gfx.fillRect(px + 2, py + 2, w - 4, h - 4)

    // Inner swirl pattern
    gfx.fillStyle(0x9966ff, 0.4)
    gfx.fillCircle(px + w / 2, py + h / 2, 20)
    gfx.fillStyle(0xbb88ff, 0.3)
    gfx.fillCircle(px + w / 2 - 6, py + h / 2 + 4, 10)
    gfx.fillCircle(px + w / 2 + 8, py + h / 2 - 6, 8)

    // Name label above
    if (portal.name) {
      const label = this.scene.add.text(
        px + w / 2, py - 6, portal.name,
        {
          fontSize: '10px', color: '#bb88ff', fontFamily: 'monospace',
          stroke: '#000000', strokeThickness: 2, align: 'center',
        }
      ).setOrigin(0.5, 1).setDepth(6)
      // Store label reference on graphics for cleanup
      ;(gfx as any)._portalLabel = label
    }

    this.portalSprites.set(key, gfx)
  }

  /** Get altars from world data */
  getAltars(): AltarPlacement[] {
    return this.worldData.altars ?? []
  }

  /** Get runestones from world data */
  getRunestones(): RunestonePlacement[] {
    return this.worldData.runestones ?? []
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
    for (const s of this.altarSprites) s.destroy()
    this.altarSprites = []
    for (const s of this.runestoneSprites) s.destroy()
    this.runestoneSprites = []
    if (this.loreRunestoneSprite) { this.loreRunestoneSprite.destroy(); this.loreRunestoneSprite = null }
    for (const [, gfx] of this.portalSprites) {
      const label = (gfx as any)._portalLabel as Phaser.GameObjects.Text | undefined
      if (label) label.destroy()
      gfx.destroy()
    }
    this.portalSprites.clear()
  }
}
