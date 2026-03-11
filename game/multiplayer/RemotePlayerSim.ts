/**
 * Lightweight physics simulation for a remote player on the host.
 * No sprites, no audio, no inventory — just position, velocity, and AABB collision.
 */

import type { InputState } from './protocol'
import type { ChunkManager } from '../world/ChunkManager'
import { TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT } from '../world/TileRegistry'

const MOVE_SPEED = 200
const JUMP_VELOCITY = -380
const GRAVITY = 900
const MAX_FALL_SPEED = 700
const COL_W = 12
const COL_H = 28

export class RemotePlayerSim {
  x: number
  y: number
  vx = 0
  vy = 0
  isGrounded = false
  facingRight = true
  hp = 100
  maxHp = 100
  mana = 100
  maxMana = 100
  dead = false

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }

  simulate(input: InputState, dt: number, chunks: ChunkManager) {
    if (this.dead) return

    // Horizontal movement
    if (input.left && !input.right) {
      this.vx = -MOVE_SPEED
      this.facingRight = false
    } else if (input.right && !input.left) {
      this.vx = MOVE_SPEED
      this.facingRight = true
    } else {
      this.vx = 0
    }

    // Jump
    if (input.jump && this.isGrounded) {
      this.vy = JUMP_VELOCITY
      this.isGrounded = false
    }

    // Gravity
    this.vy += GRAVITY * dt
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED

    // Resolve collisions
    this.resolveX(this.vx * dt, chunks)
    this.resolveY(this.vy * dt, chunks)

    // Clamp to world bounds
    const hw = COL_W / 2
    const hh = COL_H / 2
    this.x = Math.max(hw, Math.min(WORLD_WIDTH * TILE_SIZE - hw, this.x))
    this.y = Math.max(hh, Math.min(WORLD_HEIGHT * TILE_SIZE - hh, this.y))
  }

  private resolveX(dx: number, chunks: ChunkManager) {
    if (dx === 0) return
    const hw = COL_W / 2
    const hh = COL_H / 2
    const newX = this.x + dx

    const tl = Math.floor((newX - hw) / TILE_SIZE)
    const tr = Math.floor((newX + hw - 0.001) / TILE_SIZE)
    const tt = Math.floor((this.y - hh) / TILE_SIZE)
    const tb = Math.floor((this.y + hh - 0.001) / TILE_SIZE)

    for (let ty = tt; ty <= tb; ty++) {
      for (let tx = tl; tx <= tr; tx++) {
        if (chunks.isSolid(tx, ty)) {
          this.x = dx > 0 ? tx * TILE_SIZE - hw : (tx + 1) * TILE_SIZE + hw
          this.vx = 0
          return
        }
      }
    }
    this.x = newX
  }

  private resolveY(dy: number, chunks: ChunkManager) {
    if (dy === 0) return
    const hw = COL_W / 2
    const hh = COL_H / 2
    const newY = this.y + dy

    const tl = Math.floor((this.x - hw) / TILE_SIZE)
    const tr = Math.floor((this.x + hw - 0.001) / TILE_SIZE)
    const tt = Math.floor((newY - hh) / TILE_SIZE)
    const tb = Math.floor((newY + hh - 0.001) / TILE_SIZE)

    for (let ty = tt; ty <= tb; ty++) {
      for (let tx = tl; tx <= tr; tx++) {
        if (chunks.isSolid(tx, ty)) {
          if (dy > 0) {
            this.y = ty * TILE_SIZE - hh
            this.isGrounded = true
          } else {
            this.y = (ty + 1) * TILE_SIZE + hh
          }
          this.vy = 0
          return
        }
      }
    }
    this.y = newY
    if (dy > 0) this.isGrounded = false
  }
}
