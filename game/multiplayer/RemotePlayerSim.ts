/**
 * Lightweight physics simulation for a remote player on the host.
 * No sprites, no audio, no inventory — just position, velocity, and AABB collision.
 */

import type { InputState } from './protocol'
import type { ChunkManager } from '../world/ChunkManager'
import { TileType, TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT } from '../world/TileRegistry'
import { resolveX as physResolveX, resolveY as physResolveY } from '../systems/PhysicsResolver'

const MOVE_SPEED = 200
const JUMP_VELOCITY = -380
const GRAVITY = 900
const MAX_FALL_SPEED = 700
export const REMOTE_COL_W = 12
export const REMOTE_COL_H = 28
const FALL_DMG_THRESHOLD = 450
const FALL_DMG_FACTOR = 0.1
const IFRAMES_DURATION = 500
const RESPAWN_DELAY = 3000

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
  iFrames = 0
  isInWater = false
  respawnTimer = 0
  actionAnim = '' // 'mining' | 'attacking' | ''
  weaponStyle = '' // 'melee' | 'ranged' | 'magic' | 'summon' | ''
  private maxFallVy = 0

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }

  /** Apply damage (host-side). Returns true if the hit was valid (not blocked by i-frames). */
  takeDamage(amount: number, kbx: number, kby: number): boolean {
    if (this.iFrames > 0 || this.dead) return false
    this.hp -= amount
    this.iFrames = IFRAMES_DURATION
    this.vx += kbx
    this.vy += kby
    if (this.hp <= 0) {
      this.hp = 0
      this.dead = true
      this.respawnTimer = RESPAWN_DELAY
    }
    return true
  }

  /** Respawn at a given position */
  respawn(spawnX: number, spawnY: number) {
    this.dead = false
    this.hp = this.maxHp
    this.mana = this.maxMana
    this.x = spawnX
    this.y = spawnY
    this.vx = 0
    this.vy = 0
    this.iFrames = IFRAMES_DURATION * 3
  }

  /** Simulate one tick. Returns fall damage dealt (0 if none) so host can broadcast combat event. */
  simulate(input: InputState, dt: number, chunks: ChunkManager): number {
    if (this.dead) return 0

    // Tick down i-frames
    if (this.iFrames > 0) this.iFrames -= dt * 1000

    // Use client-reported action animation (mining/attacking)
    // weaponStyle is set by handleRemoteAttack, clear when actionAnim clears
    if (input.actionAnim) {
      this.actionAnim = input.actionAnim
    } else {
      this.actionAnim = ''
      this.weaponStyle = ''
    }

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
    if (this.vy > this.maxFallVy) this.maxFallVy = this.vy

    // Resolve collisions (returns fall damage if landed hard)
    const fallDmg = this.resolveCollisions(dt, chunks)

    // Clamp to world bounds
    const hw = REMOTE_COL_W / 2
    const hh = REMOTE_COL_H / 2
    this.x = Math.max(hw, Math.min(WORLD_WIDTH * TILE_SIZE - hw, this.x))
    this.y = Math.max(hh, Math.min(WORLD_HEIGHT * TILE_SIZE - hh, this.y))

    // Update water state
    const tx = Math.floor(this.x / TILE_SIZE)
    const ty = Math.floor(this.y / TILE_SIZE)
    this.isInWater = chunks.getTile(tx, ty) === TileType.WATER
    if (this.isInWater) this.maxFallVy = 0

    return fallDmg
  }

  /** Returns fall damage dealt this tick (0 if none). */
  private resolveCollisions(dt: number, chunks: ChunkManager): number {
    const hw = REMOTE_COL_W / 2
    const hh = REMOTE_COL_H / 2
    let fallDamage = 0

    const rx = physResolveX(this.x, this.y, this.vx * dt, hw, hh, chunks)
    this.x = rx.pos
    if (rx.blocked) this.vx = 0

    const ry = physResolveY(this.x, this.y, this.vy * dt, hw, hh, chunks)
    this.y = ry.pos
    if (ry.blocked) {
      if (ry.grounded) {
        this.isGrounded = true
        if (this.maxFallVy > FALL_DMG_THRESHOLD) {
          fallDamage = Math.floor((this.maxFallVy - FALL_DMG_THRESHOLD) * FALL_DMG_FACTOR)
          if (fallDamage > 0) this.takeDamage(fallDamage, 0, 0)
        }
        this.maxFallVy = 0
      }
      this.vy = 0
    } else if (this.vy > 0) {
      this.isGrounded = false
    }
    return fallDamage
  }
}
