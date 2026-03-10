import Phaser from 'phaser'
import { ChunkManager } from '../world/ChunkManager'
import { TileType, TILE_SIZE, TILE_PROPERTIES, WORLD_WIDTH, WORLD_HEIGHT } from '../world/TileRegistry'
import { InventoryManager } from '../systems/InventoryManager'
import { CombatSystem } from '../systems/CombatSystem'
import { Enemy } from './Enemy'
import { ITEMS, ItemCategory, getItemDef } from '../data/items'
import { STATION_ITEM_MAP } from '../data/recipes'
import { AudioManager } from '../systems/AudioManager'
import { SoundId } from '../data/sounds'

// Physics
const MOVE_SPEED = 200
const JUMP_VELOCITY = -380
const GRAVITY = 900
const MAX_FALL_SPEED = 700

// Collision box (smaller than 32×64 visual for forgiving movement)
const COL_W = 20
const COL_H = 56

// Fall damage
const FALL_DMG_THRESHOLD = 450
const FALL_DMG_FACTOR = 0.1

// Mining
const MINING_RANGE = 4.5 // tiles
const BASE_MINE_TIME = 400 // ms per hardness point

// Combat
const MAX_HP = 100
const MAX_MANA = 100
const MANA_REGEN = 8 // per second
const IFRAMES_DURATION = 500 // ms
const RESPAWN_DELAY = 2000 // ms

export class Player {
  sprite: Phaser.GameObjects.Image
  inventory: InventoryManager

  vx = 0
  vy = 0
  isGrounded = false
  facingRight = true

  // Combat stats
  hp = MAX_HP
  maxHp = MAX_HP
  mana = MAX_MANA
  maxMana = MAX_MANA
  dead = false

  private scene: Phaser.Scene
  private maxFallVy = 0

  // Input
  private keyA: Phaser.Input.Keyboard.Key
  private keyD: Phaser.Input.Keyboard.Key
  private keySpace: Phaser.Input.Keyboard.Key
  private keyW: Phaser.Input.Keyboard.Key
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys

  // Mining state
  private miningTX = -1
  private miningTY = -1
  private miningProgress = 0
  private miningRequired = 0

  // Mining/placement overlay
  private overlay: Phaser.GameObjects.Graphics

  // Crafting UI state
  craftingOpen = false

  // Combat
  private iFrames = 0
  private attackCooldown = 0
  private respawnTimer = 0
  private spawnX: number
  private spawnY: number
  private flashTimer = 0

  // Jetpack
  hasJetpack = false
  jetpackFuel = 100
  maxJetpackFuel = 100
  private jetpackFlame: Phaser.GameObjects.Rectangle | null = null

  // Animation
  private animFrame = 'player_idle1'
  private walkTimer = 0
  private walkFrameIndex = 0
  private actionAnim = '' // 'mining' | 'attacking' | ''
  private actionAnimTimer = 0

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.inventory = new InventoryManager()
    this.spawnX = x
    this.spawnY = y

    // Visual: 32×64 sprite (pixel art astronaut)
    const texKey = scene.textures.exists('player_idle1') ? 'player_idle1' : 'player'
    this.sprite = scene.add.image(x, y, texKey)
    this.sprite.setOrigin(0.5, 0.5)
    this.sprite.setDepth(10)

    // Overlay for tile highlights and mining progress
    this.overlay = scene.add.graphics()
    this.overlay.setDepth(15)

    // Movement keys
    const kb = scene.input.keyboard!
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A)
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W)
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.cursors = kb.createCursorKeys()

    // Number keys 1-0 → hotbar slots 0-9
    for (let i = 0; i <= 9; i++) {
      const key = kb.addKey(48 + i) // KeyCodes 48='0', 49='1', ...
      const slot = i === 0 ? 9 : i - 1
      key.on('down', () => { this.inventory.selectedSlot = slot; AudioManager.get()?.play(SoundId.SLOT_CHANGE) })
    }

    // Mouse wheel slot cycling
    scene.input.on('wheel', (_pointer: Phaser.Input.Pointer, _dx: number[], _dy: number[], dz: number) => {
      if (dz > 0) {
        this.inventory.selectedSlot = (this.inventory.selectedSlot + 1) % 10
      } else if (dz < 0) {
        this.inventory.selectedSlot = (this.inventory.selectedSlot + 9) % 10
      }
      AudioManager.get()?.play(SoundId.SLOT_CHANGE)
    })

    // C key toggles crafting UI
    const keyC = kb.addKey(Phaser.Input.Keyboard.KeyCodes.C)
    keyC.on('down', () => { this.craftingOpen = !this.craftingOpen })

    // ESC closes crafting
    const keyEsc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    keyEsc.on('down', () => { this.craftingOpen = false })

    // Q key uses consumable
    const keyQ = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Q)
    keyQ.on('down', () => { this.useConsumable() })
  }

  update(dt: number, chunks: ChunkManager, combat?: CombatSystem, enemies?: Enemy[]) {
    if (this.dead) {
      this.respawnTimer -= dt * 1000
      if (this.respawnTimer <= 0) {
        this.respawn()
      }
      return
    }

    // Mana regen
    this.mana = Math.min(this.maxMana, this.mana + MANA_REGEN * dt)

    // I-frames
    this.iFrames -= dt * 1000
    this.attackCooldown -= dt * 1000

    // Flash during i-frames
    this.flashTimer -= dt * 1000
    if (this.iFrames > 0) {
      this.sprite.setAlpha(Math.sin(this.iFrames * 0.02) > 0 ? 1 : 0.3)
    } else {
      this.sprite.setAlpha(1)
    }

    this.handleMovement(dt, chunks)
    this.handleMining(dt, chunks)
    this.handleCombat(dt, chunks, combat, enemies)
    this.handleEnemyCollision(dt, enemies, combat)
    this.checkEnvironmentDamage(chunks, combat)
    this.drawOverlay(chunks)
  }

  takeDamage(amount: number, kbx: number, kby: number, combat?: CombatSystem) {
    if (this.iFrames > 0 || this.dead) return
    this.hp -= amount
    this.iFrames = IFRAMES_DURATION
    this.vx += kbx
    this.vy += kby
    AudioManager.get()?.play(SoundId.PLAYER_HURT)

    // Flash red
    this.sprite.setTint(0xff0000)
    this.scene.time.delayedCall(150, () => {
      if (this.sprite.active && !this.dead) this.sprite.clearTint()
    })

    if (combat) {
      combat.spawnDamageNumber(this.sprite.x, this.sprite.y - 20, amount, 0xff4444)
    }

    if (this.hp <= 0) {
      this.die()
    }
  }

  private die() {
    this.dead = true
    this.hp = 0
    this.sprite.setAlpha(0.2)
    this.sprite.setTint(0x666666)
    this.respawnTimer = RESPAWN_DELAY
    AudioManager.get()?.play(SoundId.PLAYER_DIE)
  }

  private respawn() {
    this.dead = false
    this.hp = this.maxHp
    this.mana = this.maxMana
    this.sprite.x = this.spawnX
    this.sprite.y = this.spawnY
    this.sprite.clearTint()
    this.sprite.setAlpha(1)
    this.iFrames = IFRAMES_DURATION * 2 // extra i-frames on respawn
    this.vx = 0
    this.vy = 0
  }

  private useConsumable() {
    const item = this.inventory.getSelectedItem()
    if (!item) return
    const def = getItemDef(item.id)
    if (!def || def.category !== ItemCategory.CONSUMABLE) return

    if (def.healAmount && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + def.healAmount)
      this.inventory.consumeSelected()
      AudioManager.get()?.play(SoundId.HEAL)
    }
  }

  // ─── Combat ─────────────────────────────────────────────────

  private handleCombat(dt: number, chunks: ChunkManager, combat?: CombatSystem, enemies?: Enemy[]) {
    if (!combat || !enemies) return

    const pointer = this.scene.input.activePointer
    if (!pointer.leftButtonDown()) return
    if (this.attackCooldown > 0) return
    if (this.craftingOpen) return

    const item = this.inventory.getSelectedItem()
    if (!item) return
    const def = getItemDef(item.id)
    if (!def || def.category !== ItemCategory.WEAPON) return

    // Check the cursor is NOT on a mineable block (mining takes priority)
    const { tx, ty, inRange } = this.getCursorTile()
    const tileType = chunks.getTile(tx, ty)
    if (inRange && tileType !== TileType.AIR && TILE_PROPERTIES[tileType]?.mineable) return

    this.attackCooldown = def.attackSpeed ?? 400

    // Play attack animation for melee/ranged
    this.playAttackAnim()

    const cam = this.scene.cameras.main
    const worldCursorX = pointer.x + cam.scrollX
    const worldCursorY = pointer.y + cam.scrollY

    switch (def.weaponStyle) {
      case 'melee':
        combat.meleeAttack(def, this.sprite.x, this.sprite.y, this.facingRight, enemies)
        break
      case 'ranged':
        combat.fireProjectile(def, this.sprite.x, this.sprite.y, worldCursorX, worldCursorY, true)
        break
      case 'magic':
        if (this.mana >= (def.manaCost ?? 0)) {
          this.mana -= def.manaCost ?? 0
          combat.fireProjectile(def, this.sprite.x, this.sprite.y, worldCursorX, worldCursorY, true)
        }
        break
      case 'summon':
        if (this.mana >= (def.manaCost ?? 0)) {
          this.mana -= def.manaCost ?? 0
          combat.spawnSummon(def, this.sprite.x, this.sprite.y, this.sprite)
        }
        break
    }
  }

  private handleEnemyCollision(dt: number, enemies?: Enemy[], combat?: CombatSystem) {
    if (!enemies || this.iFrames > 0 || this.dead) return

    const pw = COL_W
    const ph = COL_H
    const px = this.sprite.x - pw / 2
    const py = this.sprite.y - ph / 2

    for (const e of enemies) {
      if (!e.alive) continue
      const eb = e.getBounds()

      if (px < eb.x + eb.w && px + pw > eb.x &&
          py < eb.y + eb.h && py + ph > eb.y) {
        const kbx = (this.sprite.x - e.sprite.x) > 0 ? 180 : -180
        this.takeDamage(e.def.damage, kbx, -120, combat)
        break
      }
    }
  }

  private checkEnvironmentDamage(chunks: ChunkManager, combat?: CombatSystem) {
    if (this.iFrames > 0 || this.dead) return

    // Check if player is in lava
    const ptx = Math.floor(this.sprite.x / TILE_SIZE)
    const pty = Math.floor(this.sprite.y / TILE_SIZE)
    const tile = chunks.getTile(ptx, pty)
    if (tile === TileType.LAVA) {
      this.takeDamage(10, 0, -100, combat)
    }
  }

  // ─── Movement ───────────────────────────────────────────────

  private handleMovement(dt: number, chunks: ChunkManager) {
    const left = this.keyA.isDown || this.cursors.left.isDown
    const right = this.keyD.isDown || this.cursors.right.isDown
    const jump = Phaser.Input.Keyboard.JustDown(this.keySpace) ||
                 Phaser.Input.Keyboard.JustDown(this.keyW) ||
                 Phaser.Input.Keyboard.JustDown(this.cursors.up!)

    if (left && !right) {
      this.vx = -MOVE_SPEED
      this.facingRight = false
    } else if (right && !left) {
      this.vx = MOVE_SPEED
      this.facingRight = true
    } else {
      this.vx = 0
    }

    if (jump && this.isGrounded) {
      this.vy = JUMP_VELOCITY
      this.isGrounded = false
      AudioManager.get()?.play(SoundId.JUMP)
    }

    // Jetpack flight — hold Space/W while airborne with jetpack
    const holdJump = this.keySpace.isDown || this.keyW.isDown || this.cursors.up!.isDown
    if (this.hasJetpack && holdJump && !this.isGrounded && this.jetpackFuel > 0) {
      this.vy -= 1200 * dt // strong upward thrust
      if (this.vy < -300) this.vy = -300
      this.jetpackFuel -= 30 * dt
      if (this.jetpackFuel < 0) this.jetpackFuel = 0
      AudioManager.get()?.play(SoundId.JETPACK_THRUST)

      // Show flame
      if (!this.jetpackFlame) {
        this.jetpackFlame = this.scene.add.rectangle(
          this.sprite.x, this.sprite.y + 34, 8, 12, 0xff6600
        ).setDepth(9)
      }
      this.jetpackFlame.setPosition(this.sprite.x, this.sprite.y + 34)
      this.jetpackFlame.fillColor = Math.random() > 0.5 ? 0xff6600 : 0xffaa00
    } else {
      if (this.jetpackFlame) {
        this.jetpackFlame.destroy()
        this.jetpackFlame = null
      }
    }

    // Recharge jetpack fuel on ground
    if (this.isGrounded && this.hasJetpack) {
      this.jetpackFuel = Math.min(this.maxJetpackFuel, this.jetpackFuel + 50 * dt)
    }

    this.vy += GRAVITY * dt
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED
    if (this.vy > this.maxFallVy) this.maxFallVy = this.vy

    this.resolveX(this.vx * dt, chunks)
    this.resolveY(this.vy * dt, chunks)

    const hw = COL_W / 2
    const hh = COL_H / 2
    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, hw, WORLD_WIDTH * TILE_SIZE - hw)
    this.sprite.y = Phaser.Math.Clamp(this.sprite.y, hh, WORLD_HEIGHT * TILE_SIZE - hh)

    // Animation frame selection
    this.updateAnimation(dt)
  }

  private updateAnimation(dt: number) {
    // Tick down action animation
    if (this.actionAnimTimer > 0) {
      this.actionAnimTimer -= dt * 1000
    } else {
      this.actionAnim = ''
    }

    let newFrame: string

    if (this.actionAnim === 'mining') {
      // 2-frame mining swing: windup then strike
      newFrame = this.actionAnimTimer > 150 ? 'player_mine1' : 'player_mine2'
    } else if (this.actionAnim === 'attacking') {
      // 2-frame sword swing: windup then slash
      newFrame = this.actionAnimTimer > 150 ? 'player_attack1' : 'player_attack2'
    } else if (!this.isGrounded && this.vy < -50) {
      newFrame = 'player_jump'
    } else if (!this.isGrounded && this.vy > 50) {
      newFrame = 'player_fall'
    } else if (this.vx !== 0) {
      // Walk cycle
      this.walkTimer += dt * 1000
      if (this.walkTimer > 150) {
        this.walkTimer = 0
        this.walkFrameIndex = (this.walkFrameIndex + 1) % 4
      }
      const walkFrames = ['player_walk1', 'player_walk2', 'player_walk3', 'player_walk4']
      newFrame = walkFrames[this.walkFrameIndex]!
    } else {
      // Idle breathing
      this.walkTimer += dt * 1000
      newFrame = this.walkTimer % 1000 < 500 ? 'player_idle1' : 'player_idle2'
    }

    // Flip sprite based on facing direction
    this.sprite.setFlipX(!this.facingRight)

    if (newFrame !== this.animFrame && this.scene.textures.exists(newFrame)) {
      this.animFrame = newFrame
      this.sprite.setTexture(newFrame)
    }
  }

  /** Trigger a mining animation */
  playMineAnim() {
    this.actionAnim = 'mining'
    this.actionAnimTimer = 300
  }

  /** Trigger an attack animation */
  playAttackAnim() {
    this.actionAnim = 'attacking'
    this.actionAnimTimer = 300
  }

  private resolveX(dx: number, chunks: ChunkManager) {
    if (dx === 0) return
    const hw = COL_W / 2
    const hh = COL_H / 2
    const newX = this.sprite.x + dx
    const y = this.sprite.y

    const tl = Math.floor((newX - hw) / TILE_SIZE)
    const tr = Math.floor((newX + hw - 0.001) / TILE_SIZE)
    const tt = Math.floor((y - hh) / TILE_SIZE)
    const tb = Math.floor((y + hh - 0.001) / TILE_SIZE)

    for (let ty = tt; ty <= tb; ty++) {
      for (let tx = tl; tx <= tr; tx++) {
        if (chunks.isSolid(tx, ty)) {
          this.sprite.x = dx > 0 ? tx * TILE_SIZE - hw : (tx + 1) * TILE_SIZE + hw
          this.vx = 0
          return
        }
      }
    }
    this.sprite.x = newX
  }

  private resolveY(dy: number, chunks: ChunkManager) {
    if (dy === 0) return
    const hw = COL_W / 2
    const hh = COL_H / 2
    const x = this.sprite.x
    const newY = this.sprite.y + dy

    const tl = Math.floor((x - hw) / TILE_SIZE)
    const tr = Math.floor((x + hw - 0.001) / TILE_SIZE)
    const tt = Math.floor((newY - hh) / TILE_SIZE)
    const tb = Math.floor((newY + hh - 0.001) / TILE_SIZE)

    for (let ty = tt; ty <= tb; ty++) {
      for (let tx = tl; tx <= tr; tx++) {
        if (chunks.isSolid(tx, ty)) {
          if (dy > 0) {
            this.sprite.y = ty * TILE_SIZE - hh
            if (!this.isGrounded) AudioManager.get()?.play(SoundId.LAND)
            this.isGrounded = true
            if (this.maxFallVy > FALL_DMG_THRESHOLD) this.applyFallDamage()
            this.maxFallVy = 0
          } else {
            this.sprite.y = (ty + 1) * TILE_SIZE + hh
          }
          this.vy = 0
          return
        }
      }
    }
    this.sprite.y = newY
    if (dy > 0) this.isGrounded = false
  }

  private applyFallDamage() {
    const damage = Math.floor((this.maxFallVy - FALL_DMG_THRESHOLD) * FALL_DMG_FACTOR)
    this.takeDamage(damage, 0, 0)
  }

  // ─── Mining & Placement ─────────────────────────────────────

  getCursorTile(): { tx: number; ty: number; inRange: boolean } {
    const pointer = this.scene.input.activePointer
    const cam = this.scene.cameras.main
    const wx = pointer.x + cam.scrollX
    const wy = pointer.y + cam.scrollY
    const tx = Math.floor(wx / TILE_SIZE)
    const ty = Math.floor(wy / TILE_SIZE)

    // Check range (Chebyshev distance in tiles)
    const ptx = Math.floor(this.sprite.x / TILE_SIZE)
    const pty = Math.floor(this.sprite.y / TILE_SIZE)
    const dist = Math.max(Math.abs(tx - ptx), Math.abs(ty - pty))

    return { tx, ty, inRange: dist <= MINING_RANGE }
  }

  private handleMining(dt: number, chunks: ChunkManager) {
    const pointer = this.scene.input.activePointer
    const { tx, ty, inRange } = this.getCursorTile()

    // Left-click: mine (only if not holding a weapon, or if targeting a block)
    const item = this.inventory.getSelectedItem()
    const def = item ? getItemDef(item.id) : null
    const isWeapon = def?.category === ItemCategory.WEAPON

    if (pointer.leftButtonDown() && inRange) {
      const tileType = chunks.getTile(tx, ty)
      const props = TILE_PROPERTIES[tileType]

      // If weapon is held and tile is air, don't mine (combat handles it)
      if (isWeapon && (tileType === TileType.AIR || !props?.mineable)) return

      if (tileType !== TileType.AIR && props?.mineable) {
        if (tx === this.miningTX && ty === this.miningTY) {
          this.miningProgress += dt * 1000
        } else {
          this.miningTX = tx
          this.miningTY = ty
          this.miningProgress = 0
          this.miningRequired = props.hardness * BASE_MINE_TIME
        }

        // Play mining animation while actively mining
        if (this.actionAnim !== 'mining') {
          this.playMineAnim()
          AudioManager.get()?.play(SoundId.MINE_HIT)
        }

        if (this.miningProgress >= this.miningRequired) {
          const stations = chunks.getPlacedStations()
          const station = stations.find(s => s.tx === tx && s.ty === ty)
          if (station) {
            chunks.removeStation(tx, ty)
            chunks.setTile(tx, ty, TileType.AIR)
            this.inventory.addItem(station.itemId)
          } else {
            chunks.setTile(tx, ty, TileType.AIR)
            this.inventory.addItem(tileType)
          }
          AudioManager.get()?.play(SoundId.MINE_BREAK)
          this.miningTX = -1
          this.miningTY = -1
          this.miningProgress = 0
        }
      } else {
        this.resetMining()
      }
    } else if (pointer.leftButtonDown() && !inRange) {
      this.resetMining()
    } else {
      if (!pointer.leftButtonDown()) this.resetMining()
    }

    // Right-click: place
    if (pointer.rightButtonDown() && inRange) {
      this.handlePlacement(tx, ty, chunks)
    }
  }

  private resetMining() {
    this.miningTX = -1
    this.miningTY = -1
    this.miningProgress = 0
  }

  private lastPlaceTick = 0

  private handlePlacement(tx: number, ty: number, chunks: ChunkManager) {
    const now = this.scene.time.now
    if (now - this.lastPlaceTick < 150) return
    this.lastPlaceTick = now

    if (chunks.getTile(tx, ty) !== TileType.AIR) return

    const adjacent =
      chunks.isSolid(tx - 1, ty) || chunks.isSolid(tx + 1, ty) ||
      chunks.isSolid(tx, ty - 1) || chunks.isSolid(tx, ty + 1)
    if (!adjacent) return

    if (this.overlapsPlayer(tx, ty)) return

    const item = this.inventory.getSelectedItem()
    if (!item) return

    const itemDef = ITEMS[item.id]

    if (itemDef && STATION_ITEM_MAP[item.id]) {
      chunks.setTile(tx, ty, TileType.STONE)
      chunks.placeStation(tx, ty, item.id)
      this.inventory.consumeSelected()
      AudioManager.get()?.play(SoundId.PLACE_BLOCK)
      return
    }

    const props = TILE_PROPERTIES[item.id as TileType]
    if (!props || !props.mineable) return

    chunks.setTile(tx, ty, item.id as TileType)
    this.inventory.consumeSelected()
    AudioManager.get()?.play(SoundId.PLACE_BLOCK)
  }

  private overlapsPlayer(tx: number, ty: number): boolean {
    const hw = COL_W / 2
    const hh = COL_H / 2
    const tileL = tx * TILE_SIZE
    const tileR = (tx + 1) * TILE_SIZE
    const tileT = ty * TILE_SIZE
    const tileB = (ty + 1) * TILE_SIZE

    return (
      this.sprite.x - hw < tileR &&
      this.sprite.x + hw > tileL &&
      this.sprite.y - hh < tileB &&
      this.sprite.y + hh > tileT
    )
  }

  // ─── Overlay rendering ─────────────────────────────────────

  private drawOverlay(chunks: ChunkManager) {
    this.overlay.clear()
    const { tx, ty, inRange } = this.getCursorTile()

    if (tx < 0 || ty < 0 || tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT) return

    const px = tx * TILE_SIZE
    const py = ty * TILE_SIZE

    const tileType = chunks.getTile(tx, ty)
    const isMineable = tileType !== TileType.AIR && TILE_PROPERTIES[tileType]?.mineable
    const isEmpty = tileType === TileType.AIR

    if (inRange && isMineable) {
      this.overlay.lineStyle(1, 0xffff00, 0.8)
    } else if (inRange && isEmpty) {
      this.overlay.lineStyle(1, 0x00ff00, 0.4)
    } else {
      this.overlay.lineStyle(1, 0xff0000, 0.3)
    }
    this.overlay.strokeRect(px, py, TILE_SIZE, TILE_SIZE)

    if (this.miningTX === tx && this.miningTY === ty && this.miningRequired > 0) {
      const pct = Phaser.Math.Clamp(this.miningProgress / this.miningRequired, 0, 1)
      this.overlay.fillStyle(0x000000, 0.6)
      this.overlay.fillRect(px, py - 6, TILE_SIZE, 4)
      this.overlay.fillStyle(0xffff00, 0.9)
      this.overlay.fillRect(px, py - 6, TILE_SIZE * pct, 4)
      this.overlay.fillStyle(0x000000, pct * 0.5)
      this.overlay.fillRect(px, py, TILE_SIZE, TILE_SIZE)
    }
  }

  getPosition() {
    return { x: this.sprite.x, y: this.sprite.y }
  }
}
