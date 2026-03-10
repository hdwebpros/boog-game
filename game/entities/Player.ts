import Phaser from 'phaser'
import { ChunkManager } from '../world/ChunkManager'
import { TileType, TILE_SIZE, TILE_PROPERTIES, WORLD_WIDTH, WORLD_HEIGHT, STATION_TILE_TYPE } from '../world/TileRegistry'
import { InventoryManager } from '../systems/InventoryManager'
import { CombatSystem } from '../systems/CombatSystem'
import { Enemy } from './Enemy'
import { ITEMS, ItemCategory, getItemDef } from '../data/items'
import { AudioManager } from '../systems/AudioManager'
import { SoundId } from '../data/sounds'
import { SkillTreeManager } from '../systems/SkillTreeManager'

// Physics
const MOVE_SPEED = 200
const JUMP_VELOCITY = -380
const GRAVITY = 900
const MAX_FALL_SPEED = 700

// Water physics
const WATER_MOVE_MULT = 0.55       // horizontal speed multiplier in water
const WATER_REBREATHER_MULT = 0.8  // horizontal speed with rebreather
const WATER_GRAVITY = 180          // reduced gravity (buoyancy)
const WATER_MAX_FALL = 120         // max sink speed
const WATER_SWIM_UP = -140         // swim upward velocity
const WATER_SWIM_DOWN = 160        // swim downward velocity
const MAX_OXYGEN = 100
const OXYGEN_DEPLETE_RATE = 10     // per second
const OXYGEN_REFILL_RATE = 40      // per second (fast refill on surface)
const DROWN_DAMAGE = 8             // damage per tick when oxygen is 0
const DROWN_INTERVAL = 800         // ms between drown ticks

// Collision box — player displays at 16×32 (1 tile wide, 2 tiles tall)
const COL_W = 12
const COL_H = 28

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
  skills: SkillTreeManager

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
  private keyS: Phaser.Input.Keyboard.Key
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

  // UI state
  craftingOpen = false
  inventoryOpen = false
  skillTreeOpen = false

  // Combat
  private iFrames = 0
  private attackCooldown = 0
  private respawnTimer = 0
  private spawnX: number
  private spawnY: number
  private flashTimer = 0

  // Double jump tracking
  private hasUsedDoubleJump = false

  // Water / Oxygen
  isInWater = false
  oxygen = MAX_OXYGEN
  maxOxygen = MAX_OXYGEN
  hasRebreather = false
  private drownTimer = 0

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

  // Equipment overlay visuals
  private equipOverlay: Phaser.GameObjects.Graphics
  private heldItemSprite: Phaser.GameObjects.Image | null = null
  private lastEquipHash = '' // track changes to avoid redrawing every frame

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.inventory = new InventoryManager()
    this.skills = new SkillTreeManager()
    this.spawnX = x
    this.spawnY = y

    // Visual: sprite scaled to 16×32 world px (1 tile wide, 2 tiles tall)
    const texKey = scene.textures.exists('player_idle1') ? 'player_idle1' : 'player'
    this.sprite = scene.add.image(x, y, texKey)
    this.sprite.setOrigin(0.5, 0.5)
    this.sprite.setDepth(10)
    this.applySpriteScale()

    // Equipment overlay (armor tint drawn on top of player)
    this.equipOverlay = scene.add.graphics()
    this.equipOverlay.setDepth(11)

    // Overlay for tile highlights and mining progress
    this.overlay = scene.add.graphics()
    this.overlay.setDepth(15)

    // Movement keys
    const kb = scene.input.keyboard!
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A)
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S)
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W)
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.cursors = kb.createCursorKeys()

    // Number keys 1-0 → hotbar slots 0-9
    for (let i = 0; i <= 9; i++) {
      const key = kb.addKey(48 + i) // KeyCodes 48='0', 49='1', ...
      const slot = i === 0 ? 9 : i - 1
      key.on('down', () => {
        if (this.inventoryOpen) return
        this.inventory.selectedSlot = slot
        AudioManager.get()?.play(SoundId.SLOT_CHANGE)
      })
    }

    // Mouse wheel slot cycling
    scene.input.on('wheel', (_pointer: Phaser.Input.Pointer, _dx: number[], _dy: number[], dz: number) => {
      if (this.inventoryOpen || this.craftingOpen || this.skillTreeOpen) return
      if (dz > 0) {
        this.inventory.selectedSlot = (this.inventory.selectedSlot + 1) % 10
      } else if (dz < 0) {
        this.inventory.selectedSlot = (this.inventory.selectedSlot + 9) % 10
      }
      AudioManager.get()?.play(SoundId.SLOT_CHANGE)
    })

    // C key toggles crafting UI
    const keyC = kb.addKey(Phaser.Input.Keyboard.KeyCodes.C)
    keyC.on('down', () => {
      this.craftingOpen = !this.craftingOpen
      if (this.craftingOpen) {
        this.inventoryOpen = false
        this.skillTreeOpen = false
        this.inventory.returnHeldItem()
      }
    })

    // E key toggles inventory
    const keyE = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    keyE.on('down', () => {
      if (this.inventoryOpen) {
        this.inventoryOpen = false
        this.inventory.returnHeldItem()
      } else {
        this.inventoryOpen = true
        this.craftingOpen = false
        this.skillTreeOpen = false
      }
    })

    // K key toggles skill tree
    const keyK = kb.addKey(Phaser.Input.Keyboard.KeyCodes.K)
    keyK.on('down', () => {
      this.skillTreeOpen = !this.skillTreeOpen
      if (this.skillTreeOpen) {
        this.craftingOpen = false
        this.inventoryOpen = false
        this.inventory.returnHeldItem()
      }
    })

    // ESC handled by WorldScene to coordinate with pause menu

    // Q key drops selected item
    const keyQ = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Q)
    keyQ.on('down', () => { this.dropItem() })

    // I key uses consumable
    const keyI = kb.addKey(Phaser.Input.Keyboard.KeyCodes.I)
    keyI.on('down', () => { this.useConsumable() })
  }

  update(dt: number, chunks: ChunkManager, combat?: CombatSystem, enemies?: Enemy[]) {
    if (this.dead) {
      this.respawnTimer -= dt * 1000
      if (this.respawnTimer <= 0) {
        this.respawn()
      }
      return
    }

    // Apply skill-based max HP/mana bonuses
    const mods = this.skills.getModifiers()
    this.maxHp = MAX_HP + mods.maxHpBonus
    this.maxMana = MAX_MANA + mods.maxManaBonus

    // Mana regen (with skill multiplier)
    this.mana = Math.min(this.maxMana, this.mana + MANA_REGEN * mods.manaRegenMult * dt)

    // HP regen from skills
    if (mods.hpRegen > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + mods.hpRegen * dt)
    }

    // I-frames
    this.iFrames -= dt * 1000
    this.attackCooldown -= dt * 1000

    // Flash during i-frames
    this.flashTimer -= dt * 1000
    if (this.iFrames > 0) {
      const a = Math.sin(this.iFrames * 0.02) > 0 ? 1 : 0.3
      this.sprite.setAlpha(a)
      this.equipOverlay.setAlpha(a)
      if (this.heldItemSprite) this.heldItemSprite.setAlpha(a)
    } else {
      this.sprite.setAlpha(1)
      this.equipOverlay.setAlpha(1)
      if (this.heldItemSprite) this.heldItemSprite.setAlpha(1)
    }

    this.handleMovement(dt, chunks)
    if (!this.inventoryOpen && !this.skillTreeOpen) {
      this.handleMining(dt, chunks)
      this.handleCombat(dt, chunks, combat, enemies)
    }
    this.handleEnemyCollision(dt, enemies, combat)
    this.checkEnvironmentDamage(chunks, combat)
    this.drawOverlay(chunks)
  }

  takeDamage(amount: number, kbx: number, kby: number, combat?: CombatSystem) {
    if (this.iFrames > 0 || this.dead) return
    const mods = this.skills.getModifiers()
    const defense = this.inventory.getTotalDefense() + mods.defenseBonus
    amount = Math.max(1, amount - defense)

    // Mana shield: redirect portion of damage to mana
    if (mods.manaShieldPct > 0 && this.mana > 0) {
      const shielded = Math.floor(amount * mods.manaShieldPct)
      const manaCost = shielded * 2 // each point of shielded damage costs 2 mana
      const actualShield = Math.min(shielded, Math.floor(this.mana / 2))
      this.mana -= actualShield * 2
      amount -= actualShield
    }

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
      combat.spawnDamageNumber(this.sprite.x, this.sprite.y - 10, amount, 0xff4444)
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
    this.equipOverlay.setAlpha(0.2)
    if (this.heldItemSprite) this.heldItemSprite.setAlpha(0.2)
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
    this.equipOverlay.setAlpha(1)
    if (this.heldItemSprite) this.heldItemSprite.setAlpha(1)
    this.iFrames = IFRAMES_DURATION * 2 // extra i-frames on respawn
    this.vx = 0
    this.vy = 0
    this.lastEquipHash = '' // force redraw
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

  private dropItem() {
    const item = this.inventory.getSelectedItem()
    if (!item) return
    const id = item.id
    if (!this.inventory.consumeSelected()) return
    // Spawn a world drop via WorldScene
    const ws = this.scene as any
    if (typeof ws.spawnDrop === 'function') {
      const dir = this.facingRight ? 1 : -1
      ws.spawnDrop(this.sprite.x + dir * 48, this.sprite.y, id, 1)
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

    const mods = this.skills.getModifiers()
    this.attackCooldown = (def.attackSpeed ?? 400) * mods.attackSpeedMult

    const cam = this.scene.cameras.main
    const wp = cam.getWorldPoint(pointer.x, pointer.y)
    const worldCursorX = wp.x
    const worldCursorY = wp.y

    // Face the direction of the cursor when attacking
    this.facingRight = worldCursorX >= this.sprite.x

    // Play attack animation for melee/ranged
    this.playAttackAnim()

    // Calculate damage multiplier from skills
    const lowHpBonus = (this.hp / this.maxHp <= 0.3) ? mods.lowHpDamageMult : 1
    const crit = Math.random() < mods.critChance ? 2 : 1

    switch (def.weaponStyle) {
      case 'melee':
        combat.meleeAttack(def, this.sprite.x, this.sprite.y, this.facingRight, enemies,
          mods.meleeDamageMult * lowHpBonus * crit)
        break
      case 'ranged':
        combat.fireProjectile(def, this.sprite.x, this.sprite.y, worldCursorX, worldCursorY, true,
          mods.rangedDamageMult * lowHpBonus * crit)
        break
      case 'magic':
        if (this.mana >= (def.manaCost ?? 0)) {
          this.mana -= def.manaCost ?? 0
          combat.fireProjectile(def, this.sprite.x, this.sprite.y, worldCursorX, worldCursorY, true,
            mods.magicDamageMult * lowHpBonus * crit)
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
    // Check if player is in lava
    if (this.iFrames <= 0 && !this.dead) {
      const ptx = Math.floor(this.sprite.x / TILE_SIZE)
      const pty = Math.floor(this.sprite.y / TILE_SIZE)
      const tile = chunks.getTile(ptx, pty)
      if (tile === TileType.LAVA) {
        this.takeDamage(10, 0, -100, combat)
      }
    }

    // Oxygen / drowning (runs every frame, independent of i-frames)
    if (this.dead) return

    if (this.isInWater) {
      if (this.hasRebreather) {
        // Rebreather prevents oxygen loss
        this.oxygen = this.maxOxygen
      } else {
        // Deplete oxygen
        this.oxygen -= OXYGEN_DEPLETE_RATE * (this.scene.game.loop.delta / 1000)
        if (this.oxygen < 0) this.oxygen = 0
      }

      // Drowning damage when out of oxygen
      if (this.oxygen <= 0 && !this.hasRebreather) {
        this.drownTimer -= this.scene.game.loop.delta
        if (this.drownTimer <= 0) {
          this.drownTimer = DROWN_INTERVAL
          this.takeDamage(DROWN_DAMAGE, 0, 0, combat)
        }
      }
    } else {
      // Refill oxygen when out of water
      this.oxygen = Math.min(this.maxOxygen, this.oxygen + OXYGEN_REFILL_RATE * (this.scene.game.loop.delta / 1000))
      this.drownTimer = 0
    }
  }

  // ─── Movement ───────────────────────────────────────────────

  private handleMovement(dt: number, chunks: ChunkManager) {
    // Detect if player is in water (check center tile)
    const ptx = Math.floor(this.sprite.x / TILE_SIZE)
    const pty = Math.floor(this.sprite.y / TILE_SIZE)
    const tileMid = chunks.getTile(ptx, pty)
    this.isInWater = tileMid === TileType.WATER

    const left = this.keyA.isDown || this.cursors.left.isDown
    const right = this.keyD.isDown || this.cursors.right.isDown
    const jump = Phaser.Input.Keyboard.JustDown(this.keySpace) ||
                 Phaser.Input.Keyboard.JustDown(this.keyW) ||
                 Phaser.Input.Keyboard.JustDown(this.cursors.up!)

    const mods = this.skills.getModifiers()
    let speed = MOVE_SPEED * mods.moveSpeedMult

    // Slow horizontal movement in water
    if (this.isInWater) {
      speed *= this.hasRebreather ? WATER_REBREATHER_MULT : WATER_MOVE_MULT
    }

    if (left && !right) {
      this.vx = -speed
      this.facingRight = false
    } else if (right && !left) {
      this.vx = speed
      this.facingRight = true
    } else {
      this.vx = 0
    }

    if (this.isInWater) {
      // ── Water movement: hold up to swim up, hold down to sink, float otherwise ──
      const holdUp = this.keySpace.isDown || this.keyW.isDown || this.cursors.up!.isDown
      const holdDown = this.keyS.isDown || this.cursors.down!.isDown

      if (holdUp) {
        this.vy = WATER_SWIM_UP * (this.hasRebreather ? 1.4 : 1)
      } else if (holdDown) {
        this.vy = WATER_SWIM_DOWN
      } else {
        // Gentle buoyancy — slow drift upward if sinking, else hold position
        this.vy += WATER_GRAVITY * dt
        if (this.vy > WATER_MAX_FALL) this.vy = WATER_MAX_FALL
        if (this.vy < -WATER_MAX_FALL) this.vy = -WATER_MAX_FALL
      }

      // Cancel fall damage tracking in water
      this.maxFallVy = 0
      this.isGrounded = false
    } else {
      // ── Normal land movement ──
      if (jump && this.isGrounded) {
        this.vy = JUMP_VELOCITY
        this.isGrounded = false
        this.hasUsedDoubleJump = false
        AudioManager.get()?.play(SoundId.JUMP)
      } else if (jump && !this.isGrounded && mods.doubleJump && !this.hasUsedDoubleJump) {
        this.vy = JUMP_VELOCITY * 0.85
        this.hasUsedDoubleJump = true
        AudioManager.get()?.play(SoundId.JUMP)
      }

      // Jetpack flight — hold Space/W while airborne with jetpack
      const holdJump = this.keySpace.isDown || this.keyW.isDown || this.cursors.up!.isDown
      if (this.hasJetpack && holdJump && !this.isGrounded && this.jetpackFuel > 0) {
        this.vy -= 1200 * dt
        if (this.vy < -300) this.vy = -300
        this.jetpackFuel -= 30 * mods.jetpackFuelMult * dt
        if (this.jetpackFuel < 0) this.jetpackFuel = 0
        AudioManager.get()?.play(SoundId.JETPACK_THRUST)

        if (!this.jetpackFlame) {
          this.jetpackFlame = this.scene.add.rectangle(
            this.sprite.x, this.sprite.y + 17, 4, 6, 0xff6600
          ).setDepth(9)
        }
        this.jetpackFlame.setPosition(this.sprite.x, this.sprite.y + 17)
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
    }

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
      this.applySpriteScale()
    }

    this.updateEquipmentOverlay()
  }

  /** Scale sprite so it displays at 16×32 world px regardless of source texture size */
  private applySpriteScale() {
    const h = this.sprite.frame.height
    this.sprite.setScale(h > 32 ? 0.5 : 1)
  }

  /** Draw armor tint overlays and held item sprite on the player */
  private updateEquipmentOverlay() {
    const armor = this.inventory.armorSlots
    const selected = this.inventory.getSelectedItem()
    const selectedId = selected ? selected.id : -1

    // Build a hash to skip redraw when nothing changed
    const hIds = `${armor.helmet?.id ?? ''}:${armor.chestplate?.id ?? ''}:${armor.leggings?.id ?? ''}:${armor.boots?.id ?? ''}:${selectedId}:${this.facingRight ? 'R' : 'L'}`
    if (hIds === this.lastEquipHash) {
      // Just update position
      this.equipOverlay.setPosition(this.sprite.x, this.sprite.y)
      if (this.heldItemSprite) {
        const dir = this.facingRight ? 1 : -1
        this.heldItemSprite.setPosition(this.sprite.x + dir * 8, this.sprite.y + 4)
        this.heldItemSprite.setFlipX(!this.facingRight)
      }
      return
    }
    this.lastEquipHash = hIds

    // Redraw armor overlay
    this.equipOverlay.clear()
    this.equipOverlay.setPosition(this.sprite.x, this.sprite.y)
    // Origin is center of 16x32, so offset from -8,-16

    // Helmet overlay (rows 2-9 → y -14 to -7 from center)
    if (armor.helmet) {
      const def = getItemDef(armor.helmet.id)
      if (def) {
        this.equipOverlay.fillStyle(def.color, 0.55)
        this.equipOverlay.fillRect(-6, -14, 12, 8) // helmet dome
        // Visor accent
        this.equipOverlay.fillStyle(def.color, 0.3)
        this.equipOverlay.fillRect(-4, -12, 8, 4)
      }
    }

    // Chestplate overlay (rows 11-19 → y -5 to +3)
    if (armor.chestplate) {
      const def = getItemDef(armor.chestplate.id)
      if (def) {
        this.equipOverlay.fillStyle(def.color, 0.5)
        this.equipOverlay.fillRect(-6, -5, 12, 9) // torso
        // Shoulder pads
        this.equipOverlay.fillRect(-7, -5, 2, 3)
        this.equipOverlay.fillRect(5, -5, 2, 3)
      }
    }

    // Leggings overlay (rows 20-27 → y +4 to +11)
    if (armor.leggings) {
      const def = getItemDef(armor.leggings.id)
      if (def) {
        this.equipOverlay.fillStyle(def.color, 0.5)
        // Left leg
        this.equipOverlay.fillRect(-4, 4, 4, 8)
        // Right leg
        this.equipOverlay.fillRect(0, 4, 4, 8)
      }
    }

    // Boots overlay (rows 28-31 → y +12 to +15)
    if (armor.boots) {
      const def = getItemDef(armor.boots.id)
      if (def) {
        this.equipOverlay.fillStyle(def.color, 0.55)
        this.equipOverlay.fillRect(-5, 12, 5, 4) // left boot
        this.equipOverlay.fillRect(0, 12, 5, 4) // right boot
      }
    }

    // Held item sprite
    const selDef = selectedId >= 0 ? getItemDef(selectedId) : undefined
    const showHeld = selDef && (selDef.category === ItemCategory.WEAPON || selDef.category === ItemCategory.TOOL)
    if (showHeld) {
      const texKey = `item_${selectedId}`
      if (this.scene.textures.exists(texKey)) {
        if (!this.heldItemSprite) {
          this.heldItemSprite = this.scene.add.image(0, 0, texKey)
          this.heldItemSprite.setDepth(12)
          this.heldItemSprite.setScale(0.75)
        } else {
          this.heldItemSprite.setTexture(texKey)
        }
        this.heldItemSprite.setVisible(true)
        const dir = this.facingRight ? 1 : -1
        this.heldItemSprite.setPosition(this.sprite.x + dir * 8, this.sprite.y + 4)
        this.heldItemSprite.setFlipX(!this.facingRight)
        this.heldItemSprite.setAlpha(this.sprite.alpha)
      }
    } else {
      if (this.heldItemSprite) this.heldItemSprite.setVisible(false)
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
    const mods = this.skills.getModifiers()
    const damage = Math.floor((this.maxFallVy - FALL_DMG_THRESHOLD) * FALL_DMG_FACTOR * mods.fallDamageMult)
    if (damage > 0) this.takeDamage(damage, 0, 0)
  }

  // ─── Mining & Placement ─────────────────────────────────────

  getCursorTile(): { tx: number; ty: number; inRange: boolean } {
    const pointer = this.scene.input.activePointer
    const cam = this.scene.cameras.main
    const wp = cam.getWorldPoint(pointer.x, pointer.y)
    const tx = Math.floor(wp.x / TILE_SIZE)
    const ty = Math.floor(wp.y / TILE_SIZE)

    // Check range (Chebyshev distance in tiles) with skill bonus
    const mods = this.skills.getModifiers()
    const ptx = Math.floor(this.sprite.x / TILE_SIZE)
    const pty = Math.floor(this.sprite.y / TILE_SIZE)
    const dist = Math.max(Math.abs(tx - ptx), Math.abs(ty - pty))

    return { tx, ty, inRange: dist <= MINING_RANGE + mods.miningRangeBonus }
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
        // Get mining speed multiplier from held tool + skills
        const toolSpeed = (def?.category === ItemCategory.TOOL && def.miningSpeed) ? def.miningSpeed : 1
        const skillMineSpeed = this.skills.getModifiers().mineSpeedMult

        if (tx === this.miningTX && ty === this.miningTY) {
          this.miningProgress += dt * 1000
        } else {
          this.miningTX = tx
          this.miningTY = ty
          this.miningProgress = 0
          this.miningRequired = (props.hardness * BASE_MINE_TIME) / (toolSpeed * skillMineSpeed)
        }

        // Play mining animation while actively mining
        if (this.actionAnim !== 'mining') {
          this.playMineAnim()
          AudioManager.get()?.play(SoundId.MINE_HIT)
        }

        if (this.miningProgress >= this.miningRequired) {
          const stations = chunks.getPlacedStations()
          const station = stations.find(s => s.tx === tx && s.ty === ty)
          const doubleDrop = Math.random() < this.skills.getModifiers().doubleDropChance
          if (station) {
            chunks.removeStation(tx, ty)
            chunks.setTile(tx, ty, TileType.AIR)
            this.inventory.addItem(station.itemId)
          } else {
            chunks.setTile(tx, ty, TileType.AIR)
            this.inventory.addItem(tileType, doubleDrop ? 2 : 1)
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

    const stationTile = STATION_TILE_TYPE[item.id]
    if (itemDef && stationTile) {
      chunks.setTile(tx, ty, stationTile)
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
