/**
 * Lightweight state tracker for a remote player on the host.
 *
 * Position is CLIENT-AUTHORITATIVE — snapped from CLIENT_STATUS and input.px/py.
 * The sim still runs basic physics for facingRight, isGrounded, isInWater, etc.
 * which feed the player snapshot broadcast to other clients.
 *
 * HP, mana, death, and damage are all handled on the client side.
 */

import type { InputState } from './protocol'
import type { ChunkManager } from '../world/ChunkManager'
import { TileType, TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT } from '../world/TileRegistry'
import { resolveX as physResolveX, resolveY as physResolveY } from '../systems/PhysicsResolver'

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
  isInWater = false
  actionAnim = '' // 'mining' | 'attacking' | ''
  weaponStyle = '' // 'melee' | 'ranged' | 'magic' | 'summon' | ''

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }

  /** Run basic physics for visual state (facingRight, isGrounded, isInWater). */
  simulate(input: InputState, dt: number, chunks: ChunkManager) {
    // Use client-reported action animation (mining/attacking)
    if (input.actionAnim) {
      this.actionAnim = input.actionAnim
    } else {
      this.actionAnim = ''
      this.weaponStyle = ''
    }

    // Facing direction from input
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

    // Resolve collisions (for isGrounded state)
    const hw = COL_W / 2
    const hh = COL_H / 2

    const rx = physResolveX(this.x, this.y, this.vx * dt, hw, hh, chunks)
    this.x = rx.pos
    if (rx.blocked) this.vx = 0

    const ry = physResolveY(this.x, this.y, this.vy * dt, hw, hh, chunks)
    this.y = ry.pos
    if (ry.blocked) {
      if (ry.grounded) this.isGrounded = true
      this.vy = 0
    } else if (this.vy > 0) {
      this.isGrounded = false
    }

    // Clamp to world bounds
    this.x = Math.max(hw, Math.min(WORLD_WIDTH * TILE_SIZE - hw, this.x))
    this.y = Math.max(hh, Math.min(WORLD_HEIGHT * TILE_SIZE - hh, this.y))

    // Update water state
    const tx = Math.floor(this.x / TILE_SIZE)
    const ty = Math.floor(this.y / TILE_SIZE)
    this.isInWater = chunks.getTile(tx, ty) === TileType.WATER
  }
}
