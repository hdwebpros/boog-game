import Phaser from 'phaser'
import { ChunkManager } from '../world/ChunkManager'
import { TileType, TILE_SIZE, TILE_PROPERTIES, WORLD_WIDTH, WORLD_HEIGHT, STATION_TILE_TYPE, ITEM_TO_TILE, TILE_TO_ITEM } from '../world/TileRegistry'
import { InventoryManager } from '../systems/InventoryManager'
import { CombatSystem } from '../systems/CombatSystem'
import { Enemy } from './Enemy'
import { ITEMS, ItemCategory, getItemDef, ENCHANTMENT_NAMES, ENCHANTMENT_COLORS } from '../data/items'
import type { EnchantmentType } from '../data/items'
import { AudioManager } from '../systems/AudioManager'
import { SoundId } from '../data/sounds'
import { SkillTreeManager } from '../systems/SkillTreeManager'
import { resolveX, resolveY } from '../systems/PhysicsResolver'
import { ACCESSORY_EFFECTS } from '../data/accessories'
import type { AccessoryEffect } from '../data/accessories'

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
  entityId = 0 // unique ID for multiplayer entity tracking
  /** When true, skip local respawn timer — host drives respawn via corrections */
  isNetworkClient = false

  /** Callback for tile changes (mining/placement) — used for multiplayer broadcasting */
  onTileChange: ((tx: number, ty: number, newType: number, oldType: number) => void) | null = null
  onChestOpen: ((tx: number, ty: number) => void) | null = null
  onItemDrop: ((itemId: number, count: number) => void) | null = null
  onChestClose: ((tx: number, ty: number, items: any[]) => void) | null = null

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
  shopOpen = false
  chestOpen = false
  portalNamingOpen = false
  mapOpen = false
  openChestPos: { tx: number; ty: number } | null = null
  private lastChunks: ChunkManager | null = null

  // Combat
  private iFrames = 0
  private attackCooldown = 0
  private respawnTimer = 0
  private spawnX: number
  private spawnY: number
  private flashTimer = 0
  private forcefieldTimer = 0 // ms remaining
  private undyingCooldown = 0 // ms remaining for Undying Rage cooldown

  // Double jump tracking
  private hasUsedDoubleJump = false

  // Water / Oxygen
  isInWater = false
  oxygen = MAX_OXYGEN
  maxOxygen = MAX_OXYGEN
  hasRebreather = false
  private drownTimer = 0

  // Climbing
  isClimbing = false

  // Jetpack
  hasJetpack = false
  jetpackFuel = 100
  maxJetpackFuel = 100
  private jetpackFlame: Phaser.GameObjects.Rectangle | null = null

  // Animation
  private animFrame = 'player_idle1'
  private walkTimer = 0
  private walkFrameIndex = 0
  actionAnim = '' // 'mining' | 'attacking' | ''
  actionAnimTimer = 0

  // Equipment overlay visuals
  private equipOverlay: Phaser.GameObjects.Graphics
  private heldItemSprite: Phaser.GameObjects.Image | null = null
  private lastEquipHash = '' // track changes to avoid redrawing every frame

  // Forcefield visual
  private shieldGfx: Phaser.GameObjects.Graphics

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

    // Forcefield bubble visual
    this.shieldGfx = scene.add.graphics()
    this.shieldGfx.setDepth(12)

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
      if (this.inventoryOpen || this.craftingOpen || this.skillTreeOpen || this.chestOpen || this.mapOpen) return
      if (dz > 0) {
        this.inventory.selectedSlot = (this.inventory.selectedSlot + 1) % 10
      } else if (dz < 0) {
        this.inventory.selectedSlot = (this.inventory.selectedSlot + 9) % 10
      }
      AudioManager.get()?.play(SoundId.SLOT_CHANGE)
    })

    // C key toggles crafting UI (skip when world map is open)
    const keyC = kb.addKey(Phaser.Input.Keyboard.KeyCodes.C)
    keyC.on('down', () => {
      if (this.mapOpen) return
      this.craftingOpen = !this.craftingOpen
      if (this.craftingOpen) {
        this.inventoryOpen = false
        this.skillTreeOpen = false
        this.inventory.returnHeldItem()
      }
    })

    // E key toggles inventory (or chest if nearby)
    const keyE = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    keyE.on('down', () => {
      // Close chest if open
      if (this.chestOpen) {
        this.closeChest()
        return
      }

      // Check for nearby chest to open
      if (this.lastChunks) {
        const ptx = Math.floor(this.sprite.x / TILE_SIZE)
        const pty = Math.floor(this.sprite.y / TILE_SIZE)
        for (const station of this.lastChunks.getPlacedStations()) {
          if (station.itemId !== 116) continue
          const dx = Math.abs(station.tx - ptx)
          const dy = Math.abs(station.ty - pty)
          if (dx <= 3 && dy <= 3) {
            this.chestOpen = true
            this.openChestPos = { tx: station.tx, ty: station.ty }
            this.inventoryOpen = false
            this.craftingOpen = false
            this.skillTreeOpen = false
            this.shopOpen = false
            this.onChestOpen?.(station.tx, station.ty)
            return
          }
        }
      }

      // Normal inventory toggle
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

  /** Close the chest UI and fire the onChestClose callback (for multiplayer sync) */
  closeChest() {
    if (!this.chestOpen) return
    const pos = this.openChestPos
    this.chestOpen = false
    this.openChestPos = null
    this.inventory.returnHeldItem()
    if (pos && this.lastChunks) {
      const items = this.lastChunks.getChestInventory(pos.tx, pos.ty)
      this.onChestClose?.(pos.tx, pos.ty, items)
    }
  }

  update(dt: number, chunks: ChunkManager, combat?: CombatSystem, enemies?: Enemy[]) {
    this.lastChunks = chunks

    if (this.dead) {
      // Network clients: host drives respawn via corrections, skip local timer
      if (!this.isNetworkClient) {
        this.respawnTimer -= dt * 1000
        if (this.respawnTimer <= 0) {
          this.respawn()
        }
      }
      return
    }

    // Close chest if player walks away
    if (this.chestOpen && this.openChestPos) {
      const ptx = Math.floor(this.sprite.x / TILE_SIZE)
      const pty = Math.floor(this.sprite.y / TILE_SIZE)
      const dx = Math.abs(this.openChestPos.tx - ptx)
      const dy = Math.abs(this.openChestPos.ty - pty)
      if (dx > 4 || dy > 4) {
        this.closeChest()
      }
    }

    // Apply skill-based max HP/mana bonuses + armor enchantments
    const mods = this.skills.getModifiers()
    const armorEnch = this.getArmorEnchantmentBonuses()
    this.maxHp = MAX_HP + mods.maxHpBonus + armorEnch.maxHpBonus + this.getAccessoryMaxHpBonus()
    this.maxMana = MAX_MANA + mods.maxManaBonus + armorEnch.maxManaBonus + this.getAccessoryMaxManaBonus()

    // Mana regen (with skill multiplier)
    this.mana = Math.min(this.maxMana, this.mana + MANA_REGEN * mods.manaRegenMult * dt)

    // HP regen from skills + life enchantment
    const totalHpRegen = mods.hpRegen + armorEnch.hpRegen
    if (totalHpRegen > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + totalHpRegen * dt)
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

    // Undying Rage cooldown
    this.undyingCooldown = Math.max(0, this.undyingCooldown - dt * 1000)

    // Forcefield countdown & visual
    this.forcefieldTimer = Math.max(0, this.forcefieldTimer - dt * 1000)
    this.shieldGfx.clear()
    if (this.forcefieldTimer > 0) {
      const pulse = 0.25 + 0.15 * Math.sin(Date.now() * 0.006)
      this.shieldGfx.lineStyle(2, 0x44ddff, pulse + 0.3)
      this.shieldGfx.strokeEllipse(this.sprite.x, this.sprite.y, 28, 40)
      this.shieldGfx.fillStyle(0x44ddff, pulse)
      this.shieldGfx.fillEllipse(this.sprite.x, this.sprite.y, 28, 40)
    }

    if (!this.mapOpen) this.handleMovement(dt, chunks)
    if (!this.inventoryOpen && !this.skillTreeOpen && !this.shopOpen && !this.chestOpen && !this.mapOpen) {
      this.handleMining(dt, chunks)
      this.handleCombat(dt, chunks, combat, enemies)
    }
    this.handleEnemyCollision(dt, enemies, combat)
    this.checkEnvironmentDamage(chunks, combat)
    this.drawOverlay(chunks)
  }

  takeDamage(amount: number, kbx: number, kby: number, combat?: CombatSystem) {
    if (this.iFrames > 0 || this.dead || this.forcefieldTimer > 0) return
    const mods = this.skills.getModifiers()
    const armorEnch = this.getArmorEnchantmentBonuses()
    const defense = this.inventory.getTotalDefense() + mods.defenseBonus + armorEnch.defenseBonus
    amount = Math.max(1, amount - defense)

    // Mana shield: redirect portion of damage to mana (skill + void armor enchant)
    const totalManaShield = mods.manaShieldPct + armorEnch.manaShieldPct
    if (totalManaShield > 0 && this.mana > 0) {
      const shielded = Math.floor(amount * totalManaShield)
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
      // Undying Rage: survive lethal hit with 1 HP + 3s invulnerability
      if (mods.undying && this.undyingCooldown <= 0) {
        this.hp = 1
        this.iFrames = 3000 // 3 seconds of invulnerability
        this.undyingCooldown = 60000 // 60 second cooldown
        // Golden flash to signal the proc
        this.sprite.setTint(0xffdd00)
        this.scene.time.delayedCall(500, () => {
          if (this.sprite.active && !this.dead) this.sprite.clearTint()
        })
        if (combat) {
          combat.spawnDamageNumber(this.sprite.x, this.sprite.y - 30, 0, 0xffdd00)
        }
        return
      }
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
    // Clean up jetpack flame so it doesn't linger at death location
    if (this.jetpackFlame) {
      this.jetpackFlame.destroy()
      this.jetpackFlame = null
    }
    this.respawnTimer = RESPAWN_DELAY
    AudioManager.get()?.play(SoundId.PLAYER_DIE)
  }

  /** Force respawn at a specific position (used by network correction from host) */
  forceRespawn(x: number, y: number, hp: number, mana: number) {
    this.dead = false
    this.hp = hp
    this.mana = mana
    this.sprite.x = x
    this.sprite.y = y
    this.sprite.clearTint()
    this.sprite.setAlpha(1)
    this.equipOverlay.setAlpha(1)
    if (this.heldItemSprite) this.heldItemSprite.setAlpha(1)
    this.iFrames = IFRAMES_DURATION * 2
    this.vx = 0
    this.vy = 0
    this.lastEquipHash = ''
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
    if (!def) return

    // Chant Orb usage (IDs 237-241) — enchant first weapon/armor in hotbar
    if (item.id >= 237 && item.id <= 241) {
      this.useChantOrb(item.id)
      return
    }

    if (def.category !== ItemCategory.CONSUMABLE) return

    // Forcefield Potion
    if (item.id === 193) {
      this.forcefieldTimer = 8000
      this.inventory.consumeSelected()
      AudioManager.get()?.play(SoundId.HEAL)
      return
    }

    if (def.healAmount && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + def.healAmount)
      this.inventory.consumeSelected()
      AudioManager.get()?.play(SoundId.HEAL)
    }
  }

  private useChantOrb(orbId: number) {
    const enchantMap: Record<number, EnchantmentType> = {
      237: 'ember', 238: 'frost', 239: 'storm', 240: 'void', 241: 'life',
    }
    const enchType = enchantMap[orbId]
    if (!enchType) return

    // Find first weapon/armor/tool in hotbar (excluding current slot)
    const currentSlot = this.inventory.selectedSlot
    for (let i = 0; i < this.inventory.hotbar.length; i++) {
      if (i === currentSlot) continue
      const slot = this.inventory.hotbar[i]
      if (!slot) continue
      const slotDef = getItemDef(slot.id)
      if (!slotDef) continue
      if (slotDef.category === ItemCategory.WEAPON || slotDef.category === ItemCategory.ARMOR || slotDef.category === ItemCategory.TOOL) {
        slot.enchantment = enchType
        this.inventory.consumeSelected()
        AudioManager.get()?.play(SoundId.CRAFT_SUCCESS)
        const ws = this.scene as any
        if (typeof ws.showNotification === 'function') {
          ws.showNotification(`${ENCHANTMENT_NAMES[enchType]} chant applied to ${slotDef.name}!`, ENCHANTMENT_COLORS[enchType])
        }
        return
      }
    }
    // Also check main inventory
    for (let i = 0; i < this.inventory.mainInventory.length; i++) {
      const slot = this.inventory.mainInventory[i]
      if (!slot) continue
      const slotDef = getItemDef(slot.id)
      if (!slotDef) continue
      if (slotDef.category === ItemCategory.WEAPON || slotDef.category === ItemCategory.ARMOR || slotDef.category === ItemCategory.TOOL) {
        slot.enchantment = enchType
        this.inventory.consumeSelected()
        AudioManager.get()?.play(SoundId.CRAFT_SUCCESS)
        return
      }
    }
    // Also check equipped armor slots
    for (const slotName of ['helmet', 'chestplate', 'leggings', 'boots'] as const) {
      const armorItem = this.inventory.armorSlots[slotName]
      if (!armorItem) continue
      const slotDef = getItemDef(armorItem.id)
      if (!slotDef) continue
      if (slotDef.category === ItemCategory.ARMOR) {
        armorItem.enchantment = enchType
        this.inventory.consumeSelected()
        AudioManager.get()?.play(SoundId.CRAFT_SUCCESS)
        const ws = this.scene as any
        if (typeof ws.showNotification === 'function') {
          ws.showNotification(`${ENCHANTMENT_NAMES[enchType]} chant applied to ${slotDef.name}!`, ENCHANTMENT_COLORS[enchType])
        }
        return
      }
    }
  }

  private dropItem() {
    const item = this.inventory.getSelectedItem()
    if (!item) return
    const id = item.id
    const enchantment = item.enchantment
    if (!this.inventory.consumeSelected()) return

    // In client mode, send drop request to host instead of spawning locally
    if (this.isNetworkClient && this.onItemDrop) {
      this.onItemDrop(id, 1)
      return
    }

    // Spawn a world drop via WorldScene
    const ws = this.scene as any
    if (typeof ws.spawnDrop === 'function') {
      const dir = this.facingRight ? 1 : -1
      ws.spawnDrop(this.sprite.x + dir * 48, this.sprite.y, id, 1, enchantment)
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
    const enchant = item.enchantment as EnchantmentType | undefined

    // Storm enchantment: +25% attack speed
    const stormSpeedMult = enchant === 'storm' ? 0.75 : 1
    this.attackCooldown = (def.attackSpeed ?? 400) * mods.attackSpeedMult * stormSpeedMult

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
    // Void enchantment: +15% crit chance
    const enchantCritBonus = enchant === 'void' ? 0.15 : 0
    const crit = Math.random() < (mods.critChance + enchantCritBonus) ? 2 : 1
    // Ember enchantment: +30% damage
    const emberBonus = enchant === 'ember' ? 1.3 : 1

    // Mana Overload: mana >75% grants +100% damage but drains 15% max mana per hit
    const manaOverloadBonus = (mods.manaOverload && this.mana > this.maxMana * 0.75) ? 2 : 1

    let dmgDealt = 0

    switch (def.weaponStyle) {
      case 'melee': {
        const mult = mods.meleeDamageMult * lowHpBonus * crit * manaOverloadBonus * emberBonus
        dmgDealt = combat.meleeAttack(def, this.sprite.x, this.sprite.y, this.facingRight, enemies, mult)
        // Arcane Strikes: melee hits release a magic shockwave
        if (mods.arcaneStrikes && dmgDealt > 0) {
          const shockDir = this.facingRight ? 1 : -1
          combat.fireProjectile(
            { ...def, damage: Math.round((def.damage ?? 0) * mult * 0.5), projectileSpeed: 300, weaponStyle: 'magic', color: 0xcc44ff } as any,
            this.sprite.x, this.sprite.y,
            this.sprite.x + shockDir * 100, this.sprite.y,
            true, 1
          )
        }
        break
      }
      case 'ranged':
        combat.fireProjectile(def, this.sprite.x, this.sprite.y, worldCursorX, worldCursorY, true,
          mods.rangedDamageMult * lowHpBonus * crit * manaOverloadBonus * emberBonus)
        break
      case 'magic':
        if (this.mana >= (def.manaCost ?? 0)) {
          this.mana -= def.manaCost ?? 0
          combat.fireProjectile(def, this.sprite.x, this.sprite.y, worldCursorX, worldCursorY, true,
            mods.magicDamageMult * lowHpBonus * crit * manaOverloadBonus * emberBonus)
        }
        break
      case 'summon':
        if (this.mana >= (def.manaCost ?? 0)) {
          this.mana -= def.manaCost ?? 0
          combat.spawnSummon(def, this.sprite.x, this.sprite.y, this.sprite)
        }
        break
    }

    // Mana Overload drain
    if (manaOverloadBonus > 1) {
      this.mana -= this.maxMana * 0.15
      if (this.mana < 0) this.mana = 0
    }

    // Enchantment on-hit effects
    if (dmgDealt > 0 && enchant) {
      this.applyEnchantmentOnHit(enchant, dmgDealt, combat, enemies)
    }

    // Lifesteal (skill + void enchantment)
    const voidLifesteal = enchant === 'void' ? 0.15 : 0
    const totalLifesteal = mods.lifeStealPct + voidLifesteal
    if (dmgDealt > 0 && totalLifesteal > 0) {
      const heal = Math.round(dmgDealt * totalLifesteal)
      if (heal > 0) {
        this.hp = Math.min(this.maxHp, this.hp + heal)
        combat.spawnDamageNumber(this.sprite.x, this.sprite.y - 20, heal, 0x44ff44)
      }
    }
  }

  private applyEnchantmentOnHit(enchant: EnchantmentType, dmgDealt: number, combat: CombatSystem, enemies: Enemy[]) {
    switch (enchant) {
      case 'ember':
        // Burn nearby hit enemies (handled via combat system)
        combat.applyBurn(this.sprite.x, this.sprite.y, 4, 3000)
        break
      case 'frost':
        // Slow nearby hit enemies
        combat.applySlow(this.sprite.x, this.sprite.y, 0.4, 2000)
        break
      case 'storm':
        // 20% chance chain lightning to a nearby enemy
        if (Math.random() < 0.2) {
          combat.chainLightning(this.sprite.x, this.sprite.y, Math.round(dmgDealt * 0.5), enemies)
        }
        break
      case 'life':
        // Heal 3 HP per hit
        this.hp = Math.min(this.maxHp, this.hp + 3)
        combat.spawnDamageNumber(this.sprite.x, this.sprite.y - 20, 3, 0x33ff66)
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
      if (!e.alive || e.intangible) continue
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

  // ─── Accessory modifiers ────────────────────────────────────

  getAccessoryEffects(): AccessoryEffect[] {
    const effects: AccessoryEffect[] = []
    for (const id of this.inventory.getEquippedAccessoryIds()) {
      const eff = ACCESSORY_EFFECTS[id]
      if (eff) effects.push(eff)
    }
    return effects
  }

  hasAccessoryEffect(key: keyof AccessoryEffect): boolean {
    return this.getAccessoryEffects().some(e => e[key])
  }

  getAccessoryMoveSpeedMult(): number {
    let mult = 1
    for (const e of this.getAccessoryEffects()) {
      if (e.moveSpeedMult) mult *= e.moveSpeedMult
    }
    return mult
  }

  getAccessoryMineSpeedMult(): number {
    let mult = 1
    for (const e of this.getAccessoryEffects()) {
      if (e.mineSpeedMult) mult *= e.mineSpeedMult
    }
    return mult
  }

  getAccessoryMiningRangeBonus(): number {
    let bonus = 0
    for (const e of this.getAccessoryEffects()) {
      if (e.miningRangeBonus) bonus += e.miningRangeBonus
    }
    return bonus
  }

  getAccessoryMaxHpBonus(): number {
    let bonus = 0
    for (const e of this.getAccessoryEffects()) {
      if (e.maxHpBonus) bonus += e.maxHpBonus
    }
    return bonus
  }

  getAccessoryMaxManaBonus(): number {
    let bonus = 0
    for (const e of this.getAccessoryEffects()) {
      if (e.maxManaBonus) bonus += e.maxManaBonus
    }
    return bonus
  }

  getAccessoryJetpackFuelMult(): number {
    let mult = 1
    for (const e of this.getAccessoryEffects()) {
      if (e.jetpackFuelMult) mult *= e.jetpackFuelMult
    }
    return mult
  }

  getAccessoryDoubleDropChance(): number {
    let chance = 0
    for (const e of this.getAccessoryEffects()) {
      if (e.doubleDropChance) chance += e.doubleDropChance
    }
    return chance
  }

  getAccessoryMagnetRadius(): number {
    let radius = 0
    for (const e of this.getAccessoryEffects()) {
      if (e.magnetRadius) radius = Math.max(radius, e.magnetRadius)
    }
    return radius
  }

  // ─── Movement ───────────────────────────────────────────────

  private handleMovement(dt: number, chunks: ChunkManager) {
    // Detect if player is in water (check center tile)
    const ptx = Math.floor(this.sprite.x / TILE_SIZE)
    const pty = Math.floor(this.sprite.y / TILE_SIZE)
    const tileMid = chunks.getTile(ptx, pty)
    this.isInWater = tileMid === TileType.WATER

    const left = !this.portalNamingOpen && (this.keyA.isDown || this.cursors.left.isDown)
    const right = !this.portalNamingOpen && (this.keyD.isDown || this.cursors.right.isDown)
    const jump = !this.portalNamingOpen && (Phaser.Input.Keyboard.JustDown(this.keySpace) ||
                 Phaser.Input.Keyboard.JustDown(this.keyW) ||
                 Phaser.Input.Keyboard.JustDown(this.cursors.up!))

    // Detect if player overlaps a climbable tile
    const onVine = chunks.isClimbable(ptx, pty) ||
      chunks.isClimbable(ptx, Math.floor((this.sprite.y + COL_H / 2 - 1) / TILE_SIZE))
    const holdUp = this.keySpace.isDown || this.keyW.isDown || this.cursors.up!.isDown
    const holdDown = this.keyS.isDown || this.cursors.down!.isDown

    // Enter climbing when on vine and pressing up or down (or already climbing)
    if (onVine && (holdUp || holdDown)) {
      this.isClimbing = true
    }
    // Leave climbing when jumping off, or when no longer on vine
    if (!onVine) {
      this.isClimbing = false
    }

    const mods = this.skills.getModifiers()
    const armorEnchMoves = this.getArmorEnchantmentBonuses()
    let speed = MOVE_SPEED * mods.moveSpeedMult * armorEnchMoves.moveSpeedMult * this.getAccessoryMoveSpeedMult()

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

    if (this.isClimbing) {
      // ── Vine climbing: move up/down, no gravity ──
      const climbSpeed = MOVE_SPEED * 0.6
      if (holdUp) {
        this.vy = -climbSpeed
      } else if (holdDown) {
        this.vy = climbSpeed
      } else {
        this.vy = 0
      }
      // Jump off vine
      if (jump && !holdUp) {
        this.isClimbing = false
        this.vy = JUMP_VELOCITY
        this.isGrounded = false
        this.hasUsedDoubleJump = false
        AudioManager.get()?.play(SoundId.JUMP)
      }
      this.maxFallVy = 0
      this.isGrounded = false
    } else if (this.isInWater) {
      // ── Water movement: hold up to swim up, hold down to sink, float otherwise ──

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
        const accFlightMult = this.getAccessoryEffects().reduce((m, e) => m * (e.flightSpeedMult ?? 1), 1)
        if (this.vy < -300 * accFlightMult) this.vy = -300 * accFlightMult
        this.jetpackFuel -= 30 * mods.jetpackFuelMult * this.getAccessoryJetpackFuelMult() * dt
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

    const hw = COL_W / 2
    const hh = COL_H / 2
    const rx = resolveX(this.sprite.x, this.sprite.y, this.vx * dt, hw, hh, chunks)
    this.sprite.x = rx.pos
    if (rx.blocked) this.vx = 0

    const ry = resolveY(this.sprite.x, this.sprite.y, this.vy * dt, hw, hh, chunks)
    this.sprite.y = ry.pos
    if (ry.blocked) {
      if (ry.grounded) {
        if (!this.isGrounded) AudioManager.get()?.play(SoundId.LAND)
        this.isGrounded = true
        if (this.maxFallVy > FALL_DMG_THRESHOLD) this.applyFallDamage()
        this.maxFallVy = 0
      }
      this.vy = 0
    } else if (this.vy * dt > 0) {
      this.isGrounded = false
    }

    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, hw, WORLD_WIDTH * TILE_SIZE - hw)
    const clampedY = Phaser.Math.Clamp(this.sprite.y, hh, WORLD_HEIGHT * TILE_SIZE - hh)
    if (clampedY !== this.sprite.y && this.sprite.y > clampedY) {
      // Hit bottom of world — treat as ground
      this.isGrounded = true
      this.vy = 0
    }
    this.sprite.y = clampedY

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
    // Skip cache during attack animation so sword swing updates every frame
    if (hIds === this.lastEquipHash && this.actionAnim !== 'attacking') {
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
        } else {
          this.heldItemSprite.setTexture(texKey)
        }
        this.heldItemSprite.setVisible(true)
        const dir = this.facingRight ? 1 : -1

        const isSwinging = this.actionAnim === 'attacking' && selDef.weaponStyle === 'melee'
        if (isSwinging) {
          // Swing the sword outward — animate from raised to swept down
          // t goes from 1 (windup) to 0 (end of slash)
          const t = this.actionAnimTimer / 300
          // Swing arc: from -60° (raised) to +60° (swept down), relative to facing direction
          const swingAngle = (-60 + 120 * (1 - t)) * (Math.PI / 180)
          const baseAngle = this.facingRight ? 0 : Math.PI
          const worldAngle = baseAngle + swingAngle * dir

          // Position sword tip further out during swing (reach ~3 blocks)
          const reachDist = 20 + 24 * (1 - t) // 20px at start, 44px at full extension
          const offsetX = Math.cos(worldAngle) * reachDist
          const offsetY = Math.sin(worldAngle) * reachDist
          this.heldItemSprite.setPosition(this.sprite.x + offsetX, this.sprite.y + offsetY)

          // Rotate the sprite to match the swing angle
          // Swords point diagonally — add 45° base rotation
          const spriteRot = this.facingRight
            ? swingAngle + Math.PI / 4
            : Math.PI - swingAngle - Math.PI / 4
          this.heldItemSprite.setRotation(spriteRot)
          this.heldItemSprite.setScale(1.1)
          this.heldItemSprite.setFlipX(false) // rotation handles direction
        } else {
          // Idle held position
          this.heldItemSprite.setPosition(this.sprite.x + dir * 8, this.sprite.y + 4)
          this.heldItemSprite.setFlipX(!this.facingRight)
          this.heldItemSprite.setRotation(0)
          this.heldItemSprite.setScale(0.75)
        }
        this.heldItemSprite.setAlpha(this.sprite.alpha)
      }
    } else {
      if (this.heldItemSprite) {
        this.heldItemSprite.setVisible(false)
        this.heldItemSprite.setRotation(0)
      }
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


  private applyFallDamage() {
    if (this.hasAccessoryEffect('noFallDamage')) return
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

    return { tx, ty, inRange: dist <= MINING_RANGE + mods.miningRangeBonus + this.getAccessoryMiningRangeBonus() }
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
          this.miningRequired = (props.hardness * BASE_MINE_TIME) / (toolSpeed * skillMineSpeed * this.getAccessoryMineSpeedMult())
        }

        // Play mining animation while actively mining
        if (this.actionAnim !== 'mining') {
          this.playMineAnim()
          AudioManager.get()?.play(SoundId.MINE_HIT)
        }

        if (this.miningProgress >= this.miningRequired) {
          const miningMods = this.skills.getModifiers()
          const doubleDrop = Math.random() < miningMods.doubleDropChance + this.getAccessoryDoubleDropChance()

          // Determine tiles to break: center tile, plus 3x3 if aoeMining
          const tilesToBreak: { bx: number; by: number }[] = [{ bx: tx, by: ty }]
          if (miningMods.aoeMining) {
            for (let ox = -1; ox <= 1; ox++) {
              for (let oy = -1; oy <= 1; oy++) {
                if (ox === 0 && oy === 0) continue
                tilesToBreak.push({ bx: tx + ox, by: ty + oy })
              }
            }
          }

          for (const { bx, by } of tilesToBreak) {
            const bt = chunks.getTile(bx, by)
            if (bt === TileType.AIR) continue
            const bp = TILE_PROPERTIES[bt]
            if (!bp?.mineable) continue

            // Portal: mine any tile in the 4x4 → remove entire portal
            if (bt === TileType.PORTAL) {
              const portal = chunks.getPortalAt(bx, by)
              if (portal) {
                for (let dx = 0; dx < 4; dx++) {
                  for (let dy = 0; dy < 4; dy++) {
                    this.onTileChange?.(portal.tx + dx, portal.ty + dy, TileType.AIR, TileType.PORTAL)
                    chunks.setTile(portal.tx + dx, portal.ty + dy, TileType.AIR)
                  }
                }
                chunks.removeStation(portal.tx, portal.ty)
                chunks.removePortal(portal.tx, portal.ty)
                this.inventory.addItem(117) // Portal item
              }
              continue
            }

            const bStation = chunks.getPlacedStations().find(s => s.tx === bx && s.ty === by)
            if (bStation) {
              // If it's a chest, retrieve stored items
              if (bStation.itemId === 116) {
                const chestInv = chunks.getChestInventory(bx, by)
                for (const slot of chestInv) {
                  if (slot) this.inventory.addItem(slot.id, slot.count)
                }
                chunks.removeChestInventory(bx, by)
                // Close chest UI if this chest was open
                if (this.chestOpen && this.openChestPos?.tx === bx && this.openChestPos?.ty === by) {
                  // Don't fire onChestClose — chest is destroyed, contents already retrieved
                  this.chestOpen = false
                  this.openChestPos = null
                  this.inventory.returnHeldItem()
                }
              }
              chunks.removeStation(bx, by)
              this.onTileChange?.(bx, by, TileType.AIR, bt)
              chunks.setTile(bx, by, TileType.AIR)
              this.inventory.addItem(bStation.itemId)
            } else {
              this.onTileChange?.(bx, by, TileType.AIR, bt)
              chunks.setTile(bx, by, TileType.AIR)
              // Crystal tiles drop shards + arcane dust instead of the block
              const crystalShardMap: Partial<Record<TileType, number>> = {
                [TileType.CRYSTAL_EMBER]: 230,
                [TileType.CRYSTAL_FROST]: 231,
                [TileType.CRYSTAL_STORM]: 232,
                [TileType.CRYSTAL_VOID]:  233,
                [TileType.CRYSTAL_LIFE]:  234,
              }
              const shardId = crystalShardMap[bt]
              if (shardId) {
                this.inventory.addItem(shardId, doubleDrop ? 2 : 1)
                if (Math.random() < 0.5) this.inventory.addItem(235, 1)
              } else {
                const dropId = TILE_TO_ITEM[bt] ?? bt
                this.inventory.addItem(dropId, doubleDrop ? 2 : 1)
              }
            }
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

    const item = this.inventory.getSelectedItem()
    if (!item) return

    const itemDef = ITEMS[item.id]
    const stationTile = STATION_TILE_TYPE[item.id]

    // Portal: 4x4 multi-tile placement — has its own adjacency check
    if (itemDef && stationTile && stationTile === TileType.PORTAL) {
      // Validate all 16 tiles are AIR and in bounds
      for (let dx = 0; dx < 4; dx++) {
        for (let dy = 0; dy < 4; dy++) {
          const px = tx + dx
          const py = ty + dy
          if (px >= WORLD_WIDTH || py >= WORLD_HEIGHT) return
          if (chunks.getTile(px, py) !== TileType.AIR) return
        }
      }
      // Check adjacency: any tile along the 4x4 border must neighbor a solid block
      let portalAdjacent = false
      for (let dx = 0; dx < 4 && !portalAdjacent; dx++) {
        if (chunks.isSolid(tx + dx, ty - 1)) portalAdjacent = true
        if (chunks.isSolid(tx + dx, ty + 4)) portalAdjacent = true
      }
      for (let dy = 0; dy < 4 && !portalAdjacent; dy++) {
        if (chunks.isSolid(tx - 1, ty + dy)) portalAdjacent = true
        if (chunks.isSolid(tx + 4, ty + dy)) portalAdjacent = true
      }
      if (!portalAdjacent) return
      // Check player doesn't overlap any of the 4x4 tiles
      for (let dx = 0; dx < 4; dx++) {
        for (let dy = 0; dy < 4; dy++) {
          if (this.overlapsPlayer(tx + dx, ty + dy)) return
        }
      }
      // Place all 16 tiles
      for (let dx = 0; dx < 4; dx++) {
        for (let dy = 0; dy < 4; dy++) {
          this.onTileChange?.(tx + dx, ty + dy, TileType.PORTAL, TileType.AIR)
          chunks.setTile(tx + dx, ty + dy, TileType.PORTAL)
        }
      }
      chunks.placeStation(tx, ty, item.id)
      chunks.placePortal(tx, ty)
      this.inventory.consumeSelected()
      AudioManager.get()?.play(SoundId.PLACE_BLOCK)
      return
    }

    // Standard adjacency check for all other placements
    const isVinePlacement = item.id === TileType.VINE
    const adjacent =
      chunks.isSolid(tx - 1, ty) || chunks.isSolid(tx + 1, ty) ||
      chunks.isSolid(tx, ty - 1) || chunks.isSolid(tx, ty + 1)
    const vineAdjacent = isVinePlacement && (
      chunks.isClimbable(tx, ty - 1) || // vine above
      chunks.isClimbable(tx, ty + 1)    // vine below
    )
    if (!adjacent && !vineAdjacent) return

    if (this.overlapsPlayer(tx, ty)) return

    if (itemDef && stationTile) {
      this.onTileChange?.(tx, ty, stationTile, TileType.AIR)
      chunks.setTile(tx, ty, stationTile)
      chunks.placeStation(tx, ty, item.id)
      this.inventory.consumeSelected()
      AudioManager.get()?.play(SoundId.PLACE_BLOCK)
      return
    }

    // Check for item-to-tile mapping (e.g. torch item 106 → TileType.TORCH)
    const mappedTile = ITEM_TO_TILE[item.id]
    if (mappedTile != null) {
      const mProps = TILE_PROPERTIES[mappedTile]
      if (!mProps || !mProps.mineable) return
      this.onTileChange?.(tx, ty, mappedTile, TileType.AIR)
      chunks.setTile(tx, ty, mappedTile)
      this.inventory.consumeSelected()
      AudioManager.get()?.play(SoundId.PLACE_BLOCK)
      return
    }

    const props = TILE_PROPERTIES[item.id as TileType]
    if (!props || !props.mineable) return

    this.onTileChange?.(tx, ty, item.id, TileType.AIR)
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

  /** Get cumulative bonuses from all equipped armor enchantments */
  private getArmorEnchantmentBonuses() {
    const bonuses = { defenseBonus: 0, maxHpBonus: 0, maxManaBonus: 0, hpRegen: 0, moveSpeedMult: 1, manaShieldPct: 0 }
    for (const slotName of ['helmet', 'chestplate', 'leggings', 'boots'] as const) {
      const armorItem = this.inventory.armorSlots[slotName]
      if (!armorItem?.enchantment) continue
      switch (armorItem.enchantment) {
        case 'ember':  bonuses.defenseBonus += 3; break
        case 'frost':  bonuses.maxManaBonus += 20; bonuses.defenseBonus += 4; break
        case 'storm':  bonuses.moveSpeedMult *= 1.15; break
        case 'void':   bonuses.manaShieldPct += 0.05; break
        case 'life':   bonuses.hpRegen += 2; bonuses.maxHpBonus += 15; break
      }
    }
    return bonuses
  }

  /** Total effective defense (base armor + skills + enchantments) */
  getEffectiveDefense(): number {
    const mods = this.skills.getModifiers()
    const armorEnch = this.getArmorEnchantmentBonuses()
    return this.inventory.getTotalDefense() + mods.defenseBonus + armorEnch.defenseBonus
  }

  getPosition() {
    return { x: this.sprite.x, y: this.sprite.y }
  }
}
