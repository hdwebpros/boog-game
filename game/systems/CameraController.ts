import Phaser from 'phaser'

/**
 * Advanced camera controller with:
 * - Framerate-independent lerp follow
 * - Horizontal & vertical lookahead
 * - Dead zone
 * - Dual-forward focus (snap ahead on direction change)
 * - Trauma-based Perlin noise screen shake
 * - Boss arena camera lock
 * - Landing impact bump
 * - Attack camera nudge
 */

// Perlin-like hash for smooth noise (simple, no dependency)
function smoothNoise(t: number): number {
  const i = Math.floor(t)
  const f = t - i
  // Simple smooth interpolation between pseudo-random values
  const a = Math.sin(i * 127.1 + 311.7) * 43758.5453
  const b = Math.sin((i + 1) * 127.1 + 311.7) * 43758.5453
  const va = a - Math.floor(a)
  const vb = b - Math.floor(b)
  const smooth = f * f * (3 - 2 * f) // smoothstep
  return (va + (vb - va) * smooth) * 2 - 1 // -1 to 1
}

export class CameraController {
  private camera: Phaser.Cameras.Scene2D.Camera

  // Internal tracking
  private targetX = 0
  private targetY = 0
  private currentX = 0
  private currentY = 0
  private initialized = false

  // Lookahead
  private facingDir = 1 // 1 = right, -1 = left
  private lookaheadX = 0
  private lookaheadY = 0
  private dirChangeTimer = 0
  private lastFacingDir = 1

  // Dead zone
  private readonly DEAD_ZONE_W = 16 // pixels in world space
  private readonly DEAD_ZONE_H = 10

  // Lookahead settings
  private readonly LOOKAHEAD_H = 30 // max horizontal lookahead pixels
  private readonly LOOKAHEAD_V_DOWN = 20 // max vertical lookahead when falling
  private readonly LOOKAHEAD_V_UP = 15 // max vertical lookahead when looking up
  private readonly LOOKAHEAD_SPEED = 3 // lerp speed

  // Trauma shake
  private trauma = 0
  private shakeTime = 0
  private readonly MAX_SHAKE_OFFSET = 6 // max pixel offset at trauma=1
  private readonly MAX_SHAKE_ANGLE = 0.01 // max rotation at trauma=1

  // Boss arena lock
  private bossLockActive = false
  private bossLockX = 0
  private bossLockY = 0
  private bossLockZoom = 1.7
  private bossLockLerp = 0

  // Landing bump
  private landingBump = 0

  // Attack nudge
  private nudgeX = 0
  private nudgeY = 0
  private nudgeTimer = 0

  constructor(scene: Phaser.Scene) {
    this.camera = scene.cameras.main
    // Disable Phaser's built-in follow — we'll handle it manually
  }

  /**
   * Call each frame AFTER player position is updated.
   * @param playerX world X of player
   * @param playerY world Y of player
   * @param facingRight player facing direction
   * @param vy player vertical velocity
   * @param isGrounded player grounded state
   * @param dt delta time in seconds
   */
  update(
    playerX: number, playerY: number,
    facingRight: boolean,
    vy: number, isGrounded: boolean,
    dt: number
  ) {
    if (!this.initialized) {
      this.currentX = playerX
      this.currentY = playerY
      this.initialized = true
    }

    const newDir = facingRight ? 1 : -1

    // Dual-forward focus: track direction changes with brief delay
    if (newDir !== this.lastFacingDir) {
      this.dirChangeTimer = 0.15 // 150ms delay before snapping
      this.lastFacingDir = newDir
    }
    if (this.dirChangeTimer > 0) {
      this.dirChangeTimer -= dt
      if (this.dirChangeTimer <= 0) {
        this.facingDir = newDir
      }
    }

    // Horizontal lookahead
    const targetLookaheadX = this.facingDir * this.LOOKAHEAD_H
    this.lookaheadX += (targetLookaheadX - this.lookaheadX) * Math.min(1, dt * this.LOOKAHEAD_SPEED)

    // Vertical lookahead
    let targetLookaheadY = 0
    if (!isGrounded && vy > 100) {
      // Falling: look down
      targetLookaheadY = Math.min(this.LOOKAHEAD_V_DOWN, (vy - 100) * 0.04)
    } else if (!isGrounded && vy < -100) {
      // Jumping up: look up slightly
      targetLookaheadY = Math.max(-this.LOOKAHEAD_V_UP, (vy + 100) * 0.03)
    }
    this.lookaheadY += (targetLookaheadY - this.lookaheadY) * Math.min(1, dt * this.LOOKAHEAD_SPEED)

    // Landing bump decay
    if (this.landingBump !== 0) {
      this.landingBump *= Math.max(0, 1 - dt * 12)
      if (Math.abs(this.landingBump) < 0.2) this.landingBump = 0
    }

    // Attack nudge decay
    if (this.nudgeTimer > 0) {
      this.nudgeTimer -= dt * 1000
      const t = Math.max(0, this.nudgeTimer / 150)
      this.nudgeX *= t > 0 ? 1 : 0
      this.nudgeY *= t > 0 ? 1 : 0
    } else {
      this.nudgeX = 0
      this.nudgeY = 0
    }

    // Target position with lookahead
    this.targetX = playerX + this.lookaheadX
    this.targetY = playerY + this.lookaheadY

    // Dead zone: only move camera if player is outside dead zone
    const dx = this.targetX - this.currentX
    const dy = this.targetY - this.currentY

    let moveX = 0
    let moveY = 0
    if (Math.abs(dx) > this.DEAD_ZONE_W) {
      moveX = dx - Math.sign(dx) * this.DEAD_ZONE_W
    }
    if (Math.abs(dy) > this.DEAD_ZONE_H) {
      moveY = dy - Math.sign(dy) * this.DEAD_ZONE_H
    }

    // Framerate-independent lerp: 1 - e^(-speed * dt) gives smooth follow
    const lerpFactor = 1 - Math.exp(-6 * dt)
    this.currentX += moveX * lerpFactor
    this.currentY += moveY * lerpFactor

    // Boss arena lock blend
    let finalX = this.currentX
    let finalY = this.currentY
    let finalZoom = 2

    if (this.bossLockActive) {
      this.bossLockLerp = Math.min(1, this.bossLockLerp + dt * 2)
      const t = this.bossLockLerp
      // Blend between player follow and boss arena center
      const arenaX = (playerX + this.bossLockX) / 2
      const arenaY = (playerY + this.bossLockY) / 2
      finalX = finalX + (arenaX - finalX) * t * 0.5
      finalY = finalY + (arenaY - finalY) * t * 0.3
      finalZoom = 2 + (this.bossLockZoom - 2) * t
    } else if (this.bossLockLerp > 0) {
      this.bossLockLerp = Math.max(0, this.bossLockLerp - dt * 3)
      finalZoom = 2 + (this.bossLockZoom - 2) * this.bossLockLerp
    }

    // Apply trauma-based shake
    let shakeOffsetX = 0
    let shakeOffsetY = 0
    let shakeAngle = 0

    if (this.trauma > 0) {
      this.shakeTime += dt * 30
      this.trauma = Math.max(0, this.trauma - dt * 2.5) // decay

      const shake = this.trauma * this.trauma // quadratic for nicer feel
      shakeOffsetX = this.MAX_SHAKE_OFFSET * shake * smoothNoise(this.shakeTime)
      shakeOffsetY = this.MAX_SHAKE_OFFSET * shake * smoothNoise(this.shakeTime + 100)
      shakeAngle = this.MAX_SHAKE_ANGLE * shake * smoothNoise(this.shakeTime + 200)
    }

    // Apply landing bump + attack nudge
    finalY += this.landingBump
    finalX += this.nudgeX * Math.max(0, this.nudgeTimer / 150)
    finalY += this.nudgeY * Math.max(0, this.nudgeTimer / 150)

    // Set camera position (centerOn is relative to camera center)
    this.camera.setZoom(finalZoom)
    this.camera.centerOn(
      finalX + shakeOffsetX,
      finalY + shakeOffsetY,
    )
    this.camera.setRotation(shakeAngle)
  }

  // ── Public API ────────────────────────────────────────

  /** Add trauma for screen shake (0-1 scale, additive, capped at 1) */
  addTrauma(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount)
  }

  /** Landing impact: brief downward camera dip */
  triggerLandingBump(fallSpeed: number) {
    // Scale bump by fall speed, cap at reasonable amount
    const magnitude = Math.min(8, (fallSpeed - 200) * 0.015)
    if (magnitude > 1) {
      this.landingBump = magnitude
    }
  }

  /** Attack nudge: subtle push toward target */
  triggerAttackNudge(dirX: number, dirY: number) {
    const mag = Math.sqrt(dirX * dirX + dirY * dirY) || 1
    this.nudgeX = (dirX / mag) * 3
    this.nudgeY = (dirY / mag) * 1.5
    this.nudgeTimer = 150
  }

  /** Lock camera to boss arena (zoom out, center between player & boss) */
  setBossLock(bossX: number, bossY: number) {
    this.bossLockActive = true
    this.bossLockX = bossX
    this.bossLockY = bossY
    this.bossLockZoom = 1.7
  }

  /** Update boss position for arena lock each frame */
  updateBossLockPos(bossX: number, bossY: number) {
    if (this.bossLockActive) {
      this.bossLockX = bossX
      this.bossLockY = bossY
    }
  }

  /** Release boss arena lock */
  releaseBossLock() {
    this.bossLockActive = false
  }

  /** Snap camera instantly to position (for teleports, scene start) */
  snapTo(x: number, y: number) {
    this.currentX = x
    this.currentY = y
    this.camera.centerOn(x, y)
  }
}
