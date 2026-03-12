import type { ChunkManager } from '../world/ChunkManager'
import { TILE_SIZE } from '../world/TileRegistry'

export interface ResolveResult {
  pos: number
  blocked: boolean
}

export interface ResolveYResult extends ResolveResult {
  grounded: boolean
}

/**
 * Resolve X-axis AABB tile collision.
 * Returns the new X position and whether movement was blocked.
 */
export function resolveX(
  x: number, y: number, dx: number,
  hw: number, hh: number,
  chunks: ChunkManager
): ResolveResult {
  if (dx === 0) return { pos: x, blocked: false }

  const newX = x + dx
  const tl = Math.floor((newX - hw) / TILE_SIZE)
  const tr = Math.floor((newX + hw - 0.001) / TILE_SIZE)
  const tt = Math.floor((y - hh) / TILE_SIZE)
  const tb = Math.floor((y + hh - 0.001) / TILE_SIZE)

  for (let ty = tt; ty <= tb; ty++) {
    for (let tx = tl; tx <= tr; tx++) {
      if (chunks.isSolid(tx, ty)) {
        return {
          pos: dx > 0 ? tx * TILE_SIZE - hw : (tx + 1) * TILE_SIZE + hw,
          blocked: true,
        }
      }
    }
  }
  return { pos: newX, blocked: false }
}

/**
 * Resolve Y-axis AABB tile collision.
 * Returns the new Y position, whether movement was blocked,
 * and whether the entity is grounded (landed on a tile from above).
 */
export function resolveY(
  x: number, y: number, dy: number,
  hw: number, hh: number,
  chunks: ChunkManager
): ResolveYResult {
  if (dy === 0) return { pos: y, blocked: false, grounded: false }

  const newY = y + dy
  const tl = Math.floor((x - hw) / TILE_SIZE)
  const tr = Math.floor((x + hw - 0.001) / TILE_SIZE)
  const tt = Math.floor((newY - hh) / TILE_SIZE)
  const tb = Math.floor((newY + hh - 0.001) / TILE_SIZE)

  for (let ty = tt; ty <= tb; ty++) {
    for (let tx = tl; tx <= tr; tx++) {
      if (chunks.isSolid(tx, ty)) {
        if (dy > 0) {
          return { pos: ty * TILE_SIZE - hh, blocked: true, grounded: true }
        }
        return { pos: (ty + 1) * TILE_SIZE + hh, blocked: true, grounded: false }
      }
    }
  }
  return { pos: newY, blocked: false, grounded: false }
}

/**
 * Push entity out of solid tiles by moving upward.
 * Used as a safety check for entities that might get stuck.
 */
export function unstick(
  x: number, y: number, hh: number,
  chunks: ChunkManager
): { y: number; unstuck: boolean } {
  const cx = Math.floor(x / TILE_SIZE)
  const cy = Math.floor(y / TILE_SIZE)
  if (!chunks.isSolid(cx, cy)) return { y, unstuck: false }

  for (let tryY = cy - 1; tryY >= cy - 5; tryY--) {
    if (!chunks.isSolid(cx, tryY)) {
      return { y: tryY * TILE_SIZE + TILE_SIZE - hh, unstuck: true }
    }
  }
  return { y, unstuck: false }
}
