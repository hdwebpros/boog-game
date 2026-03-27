import Phaser from 'phaser'
import { TileType, TILE_SIZE, WORLD_HEIGHT } from '../world/TileRegistry'
import { TILE_TO_ITEM } from '../world/TileRegistry'
import type { ChunkManager } from '../world/ChunkManager'
import { AudioManager } from '../systems/AudioManager'
import { SoundId } from '../data/sounds'

/** Rows drilled per second */
const DRILL_SPEED = 12
/** Time between each row drill (seconds) */
const ROW_INTERVAL = 1 / DRILL_SPEED

// Tile types that the drill skips (doesn't destroy)
const SKIP_TILES = new Set<TileType>([
  TileType.AIR,
  TileType.WATER,
  TileType.LAVA,
  TileType.PORTAL,
  TileType.VOID_PORTAL_BLOCK,
])

// Crystal shard mapping (same as Player mining logic)
const CRYSTAL_SHARD_MAP: Partial<Record<TileType, number>> = {
  [TileType.CRYSTAL_EMBER]: 230,
  [TileType.CRYSTAL_FROST]: 231,
  [TileType.CRYSTAL_STORM]: 232,
  [TileType.CRYSTAL_VOID]:  233,
  [TileType.CRYSTAL_LIFE]:  234,
}

export class BoringDrill {
  alive = true
  /** World-pixel position of the drill (top-left of the 2x4 structure) */
  x: number
  y: number
  /** Tile coordinates where the drill was placed */
  private startTX: number
  /** Current row being drilled (tile Y) */
  private currentTY: number
  /** Timer for row drilling */
  private rowTimer = 0
  /** Sprite for the drill */
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
  /** Particle trail graphics */
  private trailGfx: Phaser.GameObjects.Graphics
  /** Callback to spawn drops at the top */
  private onDrop: (itemId: number, count: number) => void
  /** Callback when drill explodes (done) */
  private onExplode: () => void
  /** Accumulated drops to spawn (batched for performance) */
  private pendingDrops: { itemId: number; count: number }[] = []
  /** Whether the drill has reached the bottom and is exploding */
  private exploding = false
  private explodeTimer = 0

  constructor(
    scene: Phaser.Scene,
    tx: number,
    ty: number,
    onDrop: (itemId: number, count: number) => void,
    onExplode: () => void,
  ) {
    this.startTX = tx
    this.currentTY = ty + 4 // start drilling below the 4-tall structure
    this.x = tx * TILE_SIZE
    this.y = ty * TILE_SIZE
    this.onDrop = onDrop
    this.onExplode = onExplode

    // Create drill sprite (2 tiles wide = 32px, 4 tiles tall = 64px)
    const key = 'item_420'
    if (scene.textures.exists(key)) {
      this.sprite = scene.add.image(
        this.x + TILE_SIZE, // center of 2-wide
        this.y + TILE_SIZE * 2, // center of 4-tall
        key,
      )
      this.sprite.setDisplaySize(32, 64)
    } else {
      // Fallback: colored rectangle
      this.sprite = scene.add.rectangle(
        this.x + TILE_SIZE,
        this.y + TILE_SIZE * 2,
        32, 64, 0xcc8844,
      )
    }
    this.sprite.setDepth(15)

    // Particle trail
    this.trailGfx = scene.add.graphics()
    this.trailGfx.setDepth(14)
  }

  /** Get the drop item ID for a given tile type */
  private getDropId(tileType: TileType): number {
    const shardId = CRYSTAL_SHARD_MAP[tileType]
    if (shardId !== undefined) return shardId
    const mapped = TILE_TO_ITEM[tileType]
    if (mapped !== undefined) return mapped
    return tileType as number
  }

  update(dt: number, chunks: ChunkManager): void {
    if (!this.alive) return

    if (this.exploding) {
      this.explodeTimer += dt
      // Flash effect
      if (this.sprite instanceof Phaser.GameObjects.Image) {
        this.sprite.setTint(Math.random() > 0.5 ? 0xff4400 : 0xffcc00)
      }
      if (this.explodeTimer > 0.5) {
        this.destroy()
        this.onExplode()
      }
      return
    }

    this.rowTimer += dt

    while (this.rowTimer >= ROW_INTERVAL && !this.exploding) {
      this.rowTimer -= ROW_INTERVAL
      this.drillRow(chunks)
    }

    // Flush pending drops
    for (const drop of this.pendingDrops) {
      this.onDrop(drop.itemId, drop.count)
    }
    this.pendingDrops = []

    // Update drill sprite position (moves down as it drills)
    const drillY = this.currentTY * TILE_SIZE
    this.sprite.setPosition(this.x + TILE_SIZE, drillY - TILE_SIZE * 2)

    // Shake effect on the sprite
    this.sprite.x += (Math.random() - 0.5) * 3
    this.sprite.y += (Math.random() - 0.5) * 1

    // Draw debris particles
    this.trailGfx.clear()
    for (let i = 0; i < 4; i++) {
      const px = this.x + Math.random() * TILE_SIZE * 2
      const py = drillY - Math.random() * TILE_SIZE * 2
      const color = [0x8b5e3c, 0x808080, 0xc19a6b, 0x666666][Math.floor(Math.random() * 4)]!
      this.trailGfx.fillStyle(color, 0.8)
      this.trailGfx.fillRect(px, py, 3, 3)
    }
  }

  private drillRow(chunks: ChunkManager): void {
    if (this.currentTY >= WORLD_HEIGHT) {
      // Reached the bottom — explode!
      this.exploding = true
      AudioManager.get()?.play(SoundId.BOSS_DIE)
      return
    }

    let drilled = false
    for (let dx = 0; dx < 2; dx++) {
      const tx = this.startTX + dx
      const ty = this.currentTY
      const tile = chunks.getTile(tx, ty)

      if (!SKIP_TILES.has(tile)) {
        const dropId = this.getDropId(tile)
        if (dropId > 0) {
          this.pendingDrops.push({ itemId: dropId, count: 1 })

          // Crystal shards also have a 50% chance to drop arcane dust
          if (CRYSTAL_SHARD_MAP[tile] !== undefined && Math.random() < 0.5) {
            this.pendingDrops.push({ itemId: 235, count: 1 })
          }
        }
        chunks.setTile(tx, ty, TileType.AIR)
        drilled = true
      }
    }

    if (drilled) {
      // Play mining sound occasionally
      if (Math.random() < 0.15) {
        AudioManager.get()?.play(SoundId.MINE_BREAK)
      }
    }

    this.currentTY++
  }

  destroy(): void {
    this.alive = false
    this.sprite.destroy()
    this.trailGfx.destroy()
  }
}
