import Phaser from 'phaser'
import { ChunkManager } from '../world/ChunkManager'
import { Player } from '../entities/Player'
import { Enemy } from '../entities/Enemy'
import { Boss } from '../entities/Boss'
import type { WorldData, AltarPlacement, RunestonePlacement } from '../world/WorldGenerator'
import { TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT } from '../world/TileRegistry'
import { CombatSystem } from '../systems/CombatSystem'
import { EnemySpawner } from '../systems/EnemySpawner'
import { BOSS_DEFS, ALTAR_DEFS, BossType } from '../data/bosses'
import { EnemyType, ENEMY_DEFS } from '../data/enemies'
import { getItemDef, ItemCategory } from '../data/items'
import { DroppedItem } from '../entities/DroppedItem'
import { SaveManager } from '../systems/SaveManager'
import type { SaveData } from '../systems/SaveManager'
import { AudioManager, MusicTrack } from '../systems/AudioManager'
import { SoundId } from '../data/sounds'
import { SurfaceBiome } from '../world/WorldGenerator'
import { DayNightCycle } from '../systems/DayNightCycle'
import { NPC } from '../entities/NPC'

// Y pixel thresholds for music zones
const SKY_Y        = 80  * 16  // above Cloud City
const UNDERGROUND_Y = 130 * 16  // underground layer start
const DEEP_Y        = 640 * 16  // deep underground / core
const OCEAN_EDGE_TILES = 80     // tile columns at each world edge treated as ocean

// Altar interaction range (in tiles)
const ALTAR_INTERACT_RANGE = 3
// Runestone interaction range (in tiles)
const RUNESTONE_INTERACT_RANGE = 2.5

export class WorldScene extends Phaser.Scene {
  private chunkManager!: ChunkManager
  private player!: Player
  private worldData!: WorldData
  private combat!: CombatSystem
  private enemySpawner!: EnemySpawner
  private enemies: Enemy[] = []
  private activeBoss: Boss | null = null
  private droppedItems: DroppedItem[] = []
  private keyF!: Phaser.Input.Keyboard.Key
  private keyESC!: Phaser.Input.Keyboard.Key
  private autoSaveTimer = 0
  private boundBeforeUnload: (() => void) | null = null
  private saveSlotId: string | null = null
  private saveSlotName: string | null = null
  private dayNight = new DayNightCycle()
  private darknessOverlay!: Phaser.GameObjects.Rectangle
  private skyGfx!: Phaser.GameObjects.Graphics
  private wasNight = false
  private endingTriggered = false
  private npc: NPC | null = null
  private npcShopPosition: { tx: number; ty: number } | null = null

  // Boss summoning system
  private discoveredAltars: Set<BossType> = new Set()
  private usedRunestones: Set<string> = new Set() // "tx,ty" keys
  private altarPromptText: Phaser.GameObjects.Text | null = null
  private runestonePromptText: Phaser.GameObjects.Text | null = null

  constructor() {
    super({ key: 'WorldScene' })
  }

  create() {
    this.worldData = this.registry.get('worldData') as WorldData

    // Sky gradient background
    this.createSkyBackground()

    // Darkness overlay for day/night cycle (covers full screen, fixed to camera)
    this.darknessOverlay = this.add.rectangle(400, 300, 800, 600, 0x0a0a2a, 0)
      .setScrollFactor(0)
      .setDepth(50) // above tiles (depth 0-10) but below UI (depth 100+)
    // Reset cycle on new game
    this.dayNight = new DayNightCycle()

    // Chunk-based tile rendering
    this.chunkManager = new ChunkManager(this, this.worldData)

    // World bounds
    const worldPxW = WORLD_WIDTH * TILE_SIZE
    const worldPxH = WORLD_HEIGHT * TILE_SIZE
    this.cameras.main.setBounds(0, 0, worldPxW, worldPxH)

    // Combat system
    this.combat = new CombatSystem(this)

    // Enemy spawner
    this.enemySpawner = new EnemySpawner(this)
    if (this.worldData.surfaceBiomes) {
      this.enemySpawner.setSurfaceBiomes(this.worldData.surfaceBiomes)
    }

    // Spawn player
    const spawnPx = this.worldData.spawnX * TILE_SIZE + TILE_SIZE / 2
    const spawnPy = this.worldData.spawnY * TILE_SIZE + TILE_SIZE / 2
    this.player = new Player(this, spawnPx, spawnPy)

    // Restore save slot info
    this.saveSlotId = (this.registry.get('loadSlotId') as string | undefined) ?? null
    this.saveSlotName = (this.registry.get('loadSlotName') as string | undefined) ?? null
    this.registry.remove('loadSlotId')
    this.registry.remove('loadSlotName')

    // Restore save data if loading
    const saveData = this.registry.get('saveData') as SaveData | undefined
    if (saveData) {
      this.player.sprite.x = saveData.playerX
      this.player.sprite.y = saveData.playerY
      this.player.hp = saveData.hp
      this.player.mana = saveData.mana
      this.player.inventory.hotbar = saveData.hotbar
      if (saveData.mainInventory) {
        this.player.inventory.mainInventory = saveData.mainInventory
      }
      this.player.inventory.selectedSlot = saveData.selectedSlot
      this.player.hasJetpack = saveData.hasJetpack
      this.player.hasRebreather = saveData.hasRebreather ?? false
      if (saveData.armorSlots) {
        this.player.inventory.armorSlots = saveData.armorSlots
      }
      // Restore placed stations
      for (const s of saveData.placedStations) {
        this.chunkManager.placeStation(s.tx, s.ty, s.itemId)
      }
      // Restore skill tree
      if (saveData.skills) {
        this.player.skills.loadSaveData(saveData.skills)
      }
      // Restore day/night cycle time
      if (saveData.dayNightTime != null) {
        this.dayNight.time = saveData.dayNightTime
      }
      // Restore discovered altars and used runestones
      if (saveData.discoveredAltars) {
        for (const bt of saveData.discoveredAltars) this.discoveredAltars.add(bt as BossType)
      }
      if (saveData.usedRunestones) {
        for (const key of saveData.usedRunestones) this.usedRunestones.add(key)
      }
      // Pass explored map to UIScene via registry
      if (saveData.exploredMap) {
        this.registry.set('exploredMap', saveData.exploredMap)
      }
      // Restore accessory slots
      if (saveData.accessorySlots) {
        this.player.inventory.accessorySlots = saveData.accessorySlots
      }
      // Restore NPC shop position
      if (saveData.npcShopPosition) {
        this.npcShopPosition = saveData.npcShopPosition
      }
      // Restore chest inventories
      if (saveData.chestInventories) {
        for (const chest of saveData.chestInventories) {
          this.chunkManager.setChestInventory(chest.tx, chest.ty, chest.items)
        }
      }
      this.registry.remove('saveData')
    }

    // Spawn NPC at cloud city shop position
    const npcPos = this.npcShopPosition ?? this.worldData.npcShopPosition
    if (npcPos) {
      this.npcShopPosition = npcPos
      this.npc = new NPC(this, npcPos.tx, npcPos.ty)
    }

    // Camera follows player — 2x zoom so tiles feel substantial
    this.cameras.main.setZoom(2)
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1)

    // Seed display (fixed to camera)
    this.add.text(8, 8, `Seed: ${this.worldData.seed}`, {
      fontSize: '12px',
      color: '#666666',
      fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(100)

    this.add.text(8, 24, 'WASD:Move LMB:Mine/Attack RMB:Place C:Craft E:Inv K:Skills F:Interact', {
      fontSize: '11px',
      color: '#444444',
      fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(100)

    // Boss summon key & ESC (registered once, checked per-frame via JustDown)
    this.keyF = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F)
    this.keyESC = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)

    // Disable right-click context menu so RMB works for placement
    this.input.mouse!.disableContextMenu()

    // Interaction prompt texts (shown near altars/runestones)
    this.altarPromptText = this.add.text(0, 0, '', {
      fontSize: '11px', color: '#ffdd44', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5, 1).setDepth(100).setVisible(false)

    this.runestonePromptText = this.add.text(0, 0, '', {
      fontSize: '11px', color: '#88ccff', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5, 1).setDepth(100).setVisible(false)

    // M toggles music/sound mute
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => {
      const audio = AudioManager.get()
      if (!audio) return
      const muted = audio.toggleMute()
      const label = this.add.text(400, 300, muted ? 'MUTED' : 'UNMUTED', {
        fontSize: '24px', color: '#ffffff', fontFamily: 'monospace',
        backgroundColor: '#000000aa', padding: { x: 12, y: 6 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(200)
      this.tweens.add({ targets: label, alpha: 0, duration: 1000, delay: 500, onComplete: () => label.destroy() })
    })

    // ESC is checked per-frame in update() via JustDown for reliability

    // Restart music when resuming from ending cutscene
    this.events.on('resume', () => {
      this.updateMusic()
    })

    // Start biome-appropriate music
    this.updateMusic()

    // Launch UI overlay
    this.scene.launch('UIScene')

    // Auto-save: on page unload (refresh/close)
    this.boundBeforeUnload = () => this.performSave()
    window.addEventListener('beforeunload', this.boundBeforeUnload)

    // Clean up beforeunload listener when scene stops
    this.events.on('shutdown', () => {
      if (this.boundBeforeUnload) {
        window.removeEventListener('beforeunload', this.boundBeforeUnload)
        this.boundBeforeUnload = null
      }
    })

    // Reset auto-save timer
    this.autoSaveTimer = 0
  }

  override update(_time: number, delta: number) {
    const dt = delta / 1000

    // ESC: close crafting/inventory/skill tree/shop first, otherwise open pause menu
    if (Phaser.Input.Keyboard.JustDown(this.keyESC)) {
      if (this.player.craftingOpen) {
        this.player.craftingOpen = false
      } else if (this.player.inventoryOpen) {
        this.player.inventoryOpen = false
        this.player.inventory.returnHeldItem()
      } else if (this.player.skillTreeOpen) {
        this.player.skillTreeOpen = false
      } else if (this.player.chestOpen) {
        this.player.chestOpen = false
        this.player.openChestPos = null
        this.player.inventory.returnHeldItem()
      } else if (this.player.shopOpen) {
        this.player.shopOpen = false
      } else {
        this.scene.pause('WorldScene')
        this.scene.pause('UIScene')
        this.scene.launch('MenuScene', { pause: true })
        this.scene.bringToTop('MenuScene')
      }
    }

    // Advance day/night cycle
    this.dayNight.update(dt)

    // Night transition notifications
    const nowNight = this.dayNight.isNight
    if (nowNight && !this.wasNight) {
      const text = this.add.text(
        this.cameras.main.centerX, this.cameras.main.centerY - 100,
        'Night falls... beware!',
        {
          fontSize: '18px', color: '#8888ff', fontFamily: 'monospace',
          stroke: '#000000', strokeThickness: 4,
        }
      ).setOrigin(0.5).setScrollFactor(0).setDepth(500)
      this.tweens.add({ targets: text, alpha: 0, duration: 1500, delay: 2000, onComplete: () => text.destroy() })
    } else if (!nowNight && this.wasNight) {
      const text = this.add.text(
        this.cameras.main.centerX, this.cameras.main.centerY - 100,
        'Dawn breaks...',
        {
          fontSize: '18px', color: '#ffaa44', fontFamily: 'monospace',
          stroke: '#000000', strokeThickness: 4,
        }
      ).setOrigin(0.5).setScrollFactor(0).setDepth(500)
      this.tweens.add({ targets: text, alpha: 0, duration: 1500, delay: 2000, onComplete: () => text.destroy() })
    }
    this.wasNight = nowNight

    // Update sky background gradient for day/night
    this.updateSkyBackground()

    // Apply darkness overlay (only affects surface — fade out when deep underground)
    const playerTY = Math.floor(this.player.sprite.y / TILE_SIZE)
    const undergroundFade = Math.min(1, Math.max(0, (playerTY - 100) / 60)) // fade out 100-160 tiles deep
    const effectiveDarkness = this.dayNight.darkness * (1 - undergroundFade)
    this.darknessOverlay.fillColor = this.dayNight.tintColor
    this.darknessOverlay.fillAlpha = effectiveDarkness

    // Combine enemies + boss for player combat
    const allTargets = this.activeBoss && this.activeBoss.alive
      ? [...this.enemies, this.activeBoss as any]
      : this.enemies

    this.player.update(dt, this.chunkManager, this.combat, allTargets)

    // Check altar/runestone/NPC interactions
    this.checkAltarInteraction()
    this.checkRunestoneInteraction()
    this.checkNPCInteraction()

    // Spawn enemies (not during boss fight)
    if (!this.activeBoss || !this.activeBoss.alive) {
      this.enemySpawner.update(dt, this.chunkManager, this.player.sprite.x, this.player.sprite.y, this.enemies, this.dayNight.isNight)
    }

    // Update enemies
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue
      const result = enemy.update(dt, this.chunkManager, this.player.sprite.x, this.player.sprite.y, this.dayNight.isNight, effectiveDarkness)

      if (result.shootAtPlayer) {
        this.combat.fireEnemyProjectile(
          enemy.sprite.x, enemy.sprite.y,
          this.player.sprite.x, this.player.sprite.y,
          enemy.def.damage, enemy.def.color
        )
      }
    }

    // Update boss
    if (this.activeBoss && this.activeBoss.alive) {
      const result = this.activeBoss.update(dt, this.chunkManager, this.player.sprite.x, this.player.sprite.y)

      // Handle boss projectiles
      for (const proj of result.projectiles) {
        this.combat.fireEnemyProjectile(proj.x, proj.y, proj.tx, proj.ty, proj.damage, this.activeBoss.def.color)
      }

      // Spawn minions from boss
      if (result.spawnMinions) {
        this.spawnBossMinions()
      }

      // Boss collision damage
      if (!this.player.dead) {
        const bb = this.activeBoss.getBounds()
        const px = this.player.sprite.x - 6
        const py = this.player.sprite.y - 14
        if (px < bb.x + bb.w && px + 12 > bb.x && py < bb.y + bb.h && py + 28 > bb.y) {
          const kbx = (this.player.sprite.x - this.activeBoss.sprite.x) > 0 ? 200 : -200
          this.player.takeDamage(this.activeBoss.def.damage, kbx, -150, this.combat)
        }
      }

      // Check boss death
      if (!this.activeBoss.alive) {
        this.onBossDefeated()
      }
    }

    // Update combat (include boss in targets so projectiles can hit it)
    const playerHit = this.combat.update(
      dt, this.chunkManager, allTargets,
      this.player.sprite.x, this.player.sprite.y,
      12, 28
    )

    if (playerHit) {
      this.player.takeDamage(playerHit.damage, playerHit.kbx, playerHit.kby, this.combat)
    }

    // Check boss death after combat (killing blow may come from combat.update)
    if (this.activeBoss && !this.activeBoss.alive) {
      this.onBossDefeated()
    }

    // Kill night-only enemies when day arrives
    if (!this.dayNight.isNight) {
      for (const enemy of this.enemies) {
        if (enemy.alive && enemy.def.nightOnly) {
          enemy.alive = false
          // Burn-up effect
          this.tweens.add({
            targets: enemy.sprite,
            alpha: 0, scaleX: 0.3, scaleY: 0.3,
            duration: 400,
            onComplete: () => { if (enemy.sprite.active) enemy.sprite.destroy() }
          })
        }
      }
    }

    // Clean up dead enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]
      if (enemy && !enemy.alive) {
        const loot = enemy.getLoot()
        for (const drop of loot) {
          this.spawnDrop(enemy.sprite.x, enemy.sprite.y, drop.itemId, drop.count)
        }
        // Grant XP
        this.grantXP(enemy.def.xp, enemy.sprite.x, enemy.sprite.y)
        // Heal on kill (skill)
        const healPct = this.player.skills.getModifiers().healOnKillPct
        if (healPct > 0) {
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * healPct)
        }
        // Split on death quirk: spawn child enemies
        if (enemy.def.splitsInto) {
          const splitDef = ENEMY_DEFS[enemy.def.splitsInto]
          const count = enemy.def.splitCount ?? 2
          for (let s = 0; s < count; s++) {
            const sx = enemy.sprite.x + (Math.random() - 0.5) * 40
            const sy = enemy.sprite.y - 8
            const child = new Enemy(this, sx, sy, splitDef)
            this.enemies.push(child)
          }
        }
        AudioManager.get()?.play(SoundId.ENEMY_DIE)
        if (enemy.sprite.active) enemy.sprite.destroy()
        this.enemies.splice(i, 1)
      }
    }

    // Update NPC
    if (this.npc) {
      this.npc.update(this.player.sprite.x, this.player.sprite.y)
    }

    // Update dropped items & pickup
    this.updateDroppedItems(dt)

    // Check if player has assembled the jetpack
    this.checkJetpack()

    // Check if player has crafted the rebreather
    this.checkRebreather()

    this.chunkManager.update()
    this.updateMusic()

    // Auto-save every 60 seconds
    this.autoSaveTimer += dt
    if (this.autoSaveTimer >= 60) {
      this.autoSaveTimer = 0
      this.performSave()
    }
  }

  private updateMusic() {
    const audio = AudioManager.get()
    if (!audio) return

    // Boss music overrides everything
    if (this.activeBoss && this.activeBoss.alive) {
      audio.playMusic(MusicTrack.BOSS)
      return
    }

    const playerX = this.player.sprite.x
    const playerY = this.player.sprite.y
    const tileX = Math.floor(playerX / TILE_SIZE)

    // Depth-based zones
    if (playerY >= DEEP_Y) {
      audio.playMusic(MusicTrack.DEEP)
      return
    }
    if (playerY >= UNDERGROUND_Y) {
      audio.playMusic(MusicTrack.UNDERGROUND)
      return
    }
    if (playerY < SKY_Y) {
      audio.playMusic(MusicTrack.CLOUDS)
      return
    }

    // Ocean edges
    if (tileX < OCEAN_EDGE_TILES || tileX > WORLD_WIDTH - OCEAN_EDGE_TILES) {
      audio.playMusic(MusicTrack.OCEAN)
      return
    }

    // Surface biome
    const biome = this.worldData.surfaceBiomes?.[tileX] ?? SurfaceBiome.PLAINS
    switch (biome) {
      case SurfaceBiome.FOREST:    audio.playMusic(MusicTrack.FOREST);    break
      case SurfaceBiome.DESERT:    audio.playMusic(MusicTrack.DESERT);    break
      case SurfaceBiome.MOUNTAINS: audio.playMusic(MusicTrack.MOUNTAINS); break
      case SurfaceBiome.LAKE:      audio.playMusic(MusicTrack.LAKE);      break
      case SurfaceBiome.SNOW:      audio.playMusic(MusicTrack.SNOW);      break
      case SurfaceBiome.JUNGLE:    audio.playMusic(MusicTrack.JUNGLE);    break
      case SurfaceBiome.MUSHROOM:  audio.playMusic(MusicTrack.MUSHROOM);  break
      default:                     audio.playMusic(MusicTrack.SURFACE);   break
    }
  }

  private checkJetpack() {
    if (this.player.hasJetpack) {
      // Check if player has reached the sky (top of world)
      if (this.player.sprite.y < 32 && !this.endingTriggered) {
        // Trigger ending cutscene — pause world so player can resume after
        this.endingTriggered = true
        AudioManager.get()?.stopMusic()
        this.scene.pause('WorldScene')
        this.scene.stop('UIScene')
        this.scene.launch('EndingScene')
        return
      }
      return
    }

    // Check if player has jetpack item in inventory
    if (this.player.inventory.getCount(186) > 0) {
      this.player.hasJetpack = true
      AudioManager.get()?.play(SoundId.JETPACK_ASSEMBLED)

      const text = this.add.text(
        this.cameras.main.centerX, this.cameras.main.centerY - 100,
        'JETPACK ASSEMBLED!\nFly to the top of the world to escape!',
        {
          fontSize: '20px', color: '#ffdd00', fontFamily: 'monospace',
          align: 'center', stroke: '#000000', strokeThickness: 4,
        }
      ).setOrigin(0.5).setScrollFactor(0).setDepth(500)

      this.time.delayedCall(5000, () => text.destroy())
    }
  }

  private checkRebreather() {
    if (this.player.hasRebreather) return
    if (this.player.inventory.getCount(192) > 0) {
      this.player.hasRebreather = true

      const text = this.add.text(
        this.cameras.main.centerX, this.cameras.main.centerY - 100,
        'REBREATHER EQUIPPED!\nSwim faster and breathe underwater!',
        {
          fontSize: '18px', color: '#00cccc', fontFamily: 'monospace',
          align: 'center', stroke: '#000000', strokeThickness: 4,
        }
      ).setOrigin(0.5).setScrollFactor(0).setDepth(500)

      this.time.delayedCall(4000, () => text.destroy())
    }
  }

  // ── NPC Shop Interaction ──────────────────────────────────

  private checkNPCInteraction() {
    if (!this.npc || this.player.dead) return
    const near = this.npc.isPlayerNear(this.player.sprite.x, this.player.sprite.y)
    if (near && Phaser.Input.Keyboard.JustDown(this.keyF) && !this.activeBoss?.alive) {
      // Don't open if altar prompt is also visible
      if (this.getNearbyAltar()) return
      this.player.shopOpen = !this.player.shopOpen
      if (this.player.shopOpen) {
        this.player.craftingOpen = false
        this.player.inventoryOpen = false
        this.player.skillTreeOpen = false
      }
    }
    // Close shop if player walks away
    if (this.player.shopOpen && !near) {
      this.player.shopOpen = false
    }
  }

  // ── Boss Summoning (Altar System) ──────────────────────────

  private getNearbyAltar(): AltarPlacement | null {
    const ptx = Math.floor(this.player.sprite.x / TILE_SIZE)
    const pty = Math.floor(this.player.sprite.y / TILE_SIZE)
    for (const altar of this.chunkManager.getAltars()) {
      const dx = Math.abs(altar.tx - ptx)
      const dy = Math.abs(altar.ty - pty)
      if (dx <= ALTAR_INTERACT_RANGE && dy <= ALTAR_INTERACT_RANGE) {
        return altar
      }
    }
    return null
  }

  private getNearbyRunestone(): RunestonePlacement | null {
    const ptx = Math.floor(this.player.sprite.x / TILE_SIZE)
    const pty = Math.floor(this.player.sprite.y / TILE_SIZE)
    for (const rs of this.chunkManager.getRunestones()) {
      const dx = Math.abs(rs.tx - ptx)
      const dy = Math.abs(rs.ty - pty)
      if (dx <= RUNESTONE_INTERACT_RANGE && dy <= RUNESTONE_INTERACT_RANGE) {
        return rs
      }
    }
    return null
  }

  private checkAltarInteraction() {
    if (this.player.dead) return

    const altar = this.getNearbyAltar()

    // Update prompt visibility
    if (altar && (!this.activeBoss || !this.activeBoss.alive)) {
      const altarDef = ALTAR_DEFS[altar.bossType]
      const bossDef = BOSS_DEFS[altar.bossType]
      if (altarDef && bossDef && this.altarPromptText) {
        // Build ingredient status text
        const inv = this.player.inventory
        const lines: string[] = [`-- ${bossDef.name} Altar --`]
        let canSummon = true
        for (const ing of altarDef.ingredients) {
          const have = inv.getCount(ing.itemId)
          const itemDef = getItemDef(ing.itemId)
          const name = itemDef?.name ?? `Item ${ing.itemId}`
          const ok = have >= ing.count
          if (!ok) canSummon = false
          lines.push(`${ok ? '+' : '-'} ${name}: ${have}/${ing.count}`)
        }
        lines.push(canSummon ? '[F] Offer ingredients' : 'Gather ingredients')

        const px = altar.tx * TILE_SIZE + TILE_SIZE / 2
        const py = altar.ty * TILE_SIZE - TILE_SIZE * 3
        this.altarPromptText.setText(lines.join('\n'))
        this.altarPromptText.setPosition(px, py)
        this.altarPromptText.setVisible(true)

        // Handle F key press to summon
        if (canSummon && Phaser.Input.Keyboard.JustDown(this.keyF)) {
          this.summonBossAtAltar(altar, altarDef, bossDef)
          return
        }
      }
    } else if (this.altarPromptText) {
      this.altarPromptText.setVisible(false)
    }
  }

  private summonBossAtAltar(altar: AltarPlacement, altarDef: (typeof ALTAR_DEFS)[BossType], bossDef: (typeof BOSS_DEFS)[BossType]) {
    // Consume ingredients
    const inv = this.player.inventory
    for (const ing of altarDef.ingredients) {
      inv.removeItem(ing.itemId, ing.count)
    }

    // Spawn boss at altar location
    const bx = altar.tx * TILE_SIZE + TILE_SIZE / 2
    const by = altar.ty * TILE_SIZE - TILE_SIZE
    this.activeBoss = new Boss(this, bx, by, bossDef)
    AudioManager.get()?.play(SoundId.BOSS_APPEAR)

    // Hide prompt
    if (this.altarPromptText) this.altarPromptText.setVisible(false)

    // Boss announcement
    const text = this.add.text(
      this.cameras.main.centerX, this.cameras.main.centerY - 100,
      `${bossDef.name} has awakened!`,
      {
        fontSize: '24px', color: '#ff4444', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 4,
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(500)

    this.time.delayedCall(3000, () => text.destroy())
  }

  private checkRunestoneInteraction() {
    if (this.player.dead) return

    const rs = this.getNearbyRunestone()
    const key = rs ? `${rs.tx},${rs.ty}` : null

    if (rs && key && !this.usedRunestones.has(key)) {
      const bossDef = BOSS_DEFS[rs.bossType]
      if (bossDef && this.runestonePromptText) {
        const px = rs.tx * TILE_SIZE + TILE_SIZE / 2
        const py = rs.ty * TILE_SIZE - TILE_SIZE * 2
        this.runestonePromptText.setText(`[F] Read runestone`)
        this.runestonePromptText.setPosition(px, py)
        this.runestonePromptText.setVisible(true)

        if (Phaser.Input.Keyboard.JustDown(this.keyF)) {
          // Discover the altar for this boss
          this.discoveredAltars.add(rs.bossType)
          this.usedRunestones.add(key)

          // Show discovery message
          const text = this.add.text(
            this.cameras.main.centerX, this.cameras.main.centerY - 80,
            `${bossDef.name}'s altar location revealed!\nFollow the arrow to find it.`,
            {
              fontSize: '16px', color: '#88ccff', fontFamily: 'monospace',
              align: 'center', stroke: '#000000', strokeThickness: 4,
            }
          ).setOrigin(0.5).setScrollFactor(0).setDepth(500)

          this.tweens.add({ targets: text, alpha: 0, duration: 1500, delay: 3000, onComplete: () => text.destroy() })
          AudioManager.get()?.play(SoundId.CRAFT_SUCCESS)

          this.runestonePromptText.setVisible(false)
          return
        }
      }
    } else if (rs && key && this.usedRunestones.has(key)) {
      // Already read
      if (this.runestonePromptText) {
        const bossDef = BOSS_DEFS[rs.bossType]
        const px = rs.tx * TILE_SIZE + TILE_SIZE / 2
        const py = rs.ty * TILE_SIZE - TILE_SIZE * 2
        this.runestonePromptText.setText(`${bossDef?.name ?? 'Boss'} altar: discovered`)
        this.runestonePromptText.setPosition(px, py)
        this.runestonePromptText.setVisible(true)
      }
    } else if (this.runestonePromptText) {
      this.runestonePromptText.setVisible(false)
    }
  }

  private onBossDefeated() {
    if (!this.activeBoss) return
    AudioManager.get()?.play(SoundId.BOSS_DIE)

    // Grant boss XP
    this.grantXP(this.activeBoss.def.xp, this.activeBoss.sprite.x, this.activeBoss.sprite.y)

    // Drop jetpack component
    this.player.inventory.addItem(this.activeBoss.def.dropItemId)

    // Victory message
    const name = this.activeBoss.def.name
    const dropDef = getItemDef(this.activeBoss.def.dropItemId)
    const text = this.add.text(
      this.cameras.main.centerX, this.cameras.main.centerY - 100,
      `${name} defeated!\nObtained: ${dropDef?.name ?? 'Unknown'}`,
      {
        fontSize: '20px', color: '#00ff88', fontFamily: 'monospace',
        align: 'center', stroke: '#000000', strokeThickness: 4,
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(500)

    this.time.delayedCall(4000, () => text.destroy())

    this.activeBoss.destroy()
    this.activeBoss = null
  }

  private spawnBossMinions() {
    if (!this.activeBoss) return
    const bx = this.activeBoss.sprite.x
    const by = this.activeBoss.sprite.y

    // Spawn 2-3 Space Slugs near boss
    const count = 2 + Math.floor(Math.random() * 2)
    for (let i = 0; i < count; i++) {
      const def = ENEMY_DEFS[EnemyType.SPACE_SLUG]
      const mx = bx + (Math.random() - 0.5) * 100
      const my = by
      const enemy = new Enemy(this, mx, my, def)
      this.enemies.push(enemy)
    }
  }

  private createSkyBackground() {
    this.skyGfx = this.add.graphics()
    this.skyGfx.setScrollFactor(0)
    this.skyGfx.setDepth(-10)
    this.updateSkyBackground()
  }

  /** Repaints the sky gradient based on dayNight.time */
  private updateSkyBackground() {
    const gfx = this.skyGfx
    gfx.clear()

    const { width, height } = this.scale
    const steps = 20
    const t = this.dayNight.time

    // Blend factor: 0 = night sky, 1 = day sky
    let dayFactor = 0
    if (t >= 0.30 && t < 0.70) {
      dayFactor = 1
    } else if (t >= 0.20 && t < 0.30) {
      dayFactor = (t - 0.20) / 0.10
    } else if (t >= 0.70 && t < 0.80) {
      dayFactor = 1 - (t - 0.70) / 0.10
    }

    // Night gradient: top 0x050515 → bottom 0x1a1a3e
    // Day gradient:   top 0x3388cc → bottom 0x88bbee
    for (let i = 0; i < steps; i++) {
      const s = i / steps
      const nr = Phaser.Math.Linear(0x05, 0x1a, s)
      const ng = Phaser.Math.Linear(0x05, 0x1a, s)
      const nb = Phaser.Math.Linear(0x15, 0x3e, s)
      const dr = Phaser.Math.Linear(0x33, 0x88, s)
      const dg = Phaser.Math.Linear(0x88, 0xbb, s)
      const db = Phaser.Math.Linear(0xcc, 0xee, s)
      const r = Math.floor(Phaser.Math.Linear(nr, dr, dayFactor))
      const g = Math.floor(Phaser.Math.Linear(ng, dg, dayFactor))
      const b = Math.floor(Phaser.Math.Linear(nb, db, dayFactor))
      const color = (r << 16) | (g << 8) | b
      gfx.fillStyle(color)
      gfx.fillRect(0, (i / steps) * height, width, height / steps + 1)
    }
  }

  spawnDrop(x: number, y: number, itemId: number, count: number) {
    const spread = (Math.random() - 0.5) * 120
    const drop = new DroppedItem(this, x, y, itemId, count, spread)
    this.droppedItems.push(drop)
  }

  private updateDroppedItems(dt: number) {
    const px = this.player.sprite.x
    const py = this.player.sprite.y
    const getTile = (tx: number, ty: number) => this.chunkManager.getTile(tx, ty)

    for (let i = this.droppedItems.length - 1; i >= 0; i--) {
      const drop = this.droppedItems[i]!
      drop.update(dt, getTile)

      if (!drop.alive) {
        this.droppedItems.splice(i, 1)
        continue
      }

      // Check pickup (with magnet radius from accessories)
      const magnetR = this.player.getAccessoryMagnetRadius()
      let isNear = drop.isNear(px, py)
      if (!isNear && magnetR > 0 && drop.canPickup()) {
        const dx = drop.x - px
        const dy = drop.y - py
        isNear = dx * dx + dy * dy < magnetR * magnetR
      }
      if (drop.canPickup() && isNear) {
        if (this.player.inventory.addItem(drop.itemId, drop.count)) {
          AudioManager.get()?.play(SoundId.PICKUP)
          drop.destroy()
          this.droppedItems.splice(i, 1)
        }
      }
    }
  }

  private grantXP(amount: number, worldX: number, worldY: number) {
    const levelsGained = this.player.skills.addXP(amount)

    // Show XP number
    this.combat.spawnDamageNumber(worldX, worldY - 20, amount, 0x44ffff)

    if (levelsGained > 0) {
      const text = this.add.text(
        this.cameras.main.centerX, this.cameras.main.centerY - 80,
        `LEVEL UP! (Lv ${this.player.skills.level})\n+${levelsGained} Skill Point${levelsGained > 1 ? 's' : ''}`,
        {
          fontSize: '18px', color: '#ffff00', fontFamily: 'monospace',
          align: 'center', stroke: '#000000', strokeThickness: 4,
        }
      ).setOrigin(0.5).setScrollFactor(0).setDepth(500)

      this.time.delayedCall(3000, () => text.destroy())
      AudioManager.get()?.play(SoundId.LEVEL_UP)
    }
  }

  performSave(overrideSlotId?: string, overrideName?: string): boolean {
    if (this.player.dead) return false
    const worldData = this.registry.get('worldData') as WorldData
    if (!worldData) return false

    const slotId = overrideSlotId ?? this.saveSlotId ?? SaveManager.generateSlotId()
    const slotName = overrideName ?? this.saveSlotName ?? 'World'

    // Remember for future auto-saves
    this.saveSlotId = slotId
    this.saveSlotName = slotName

    // Get explored map from UIScene
    const uiScene = this.scene.get('UIScene') as any
    const exploredMap = uiScene?.getExploredMap?.() as number[] | null ?? undefined

    return SaveManager.save(
      slotId,
      slotName,
      worldData,
      this.player.sprite.x, this.player.sprite.y,
      this.player.hp, this.player.mana,
      this.player.inventory.hotbar,
      this.player.inventory.mainInventory,
      this.player.inventory.selectedSlot,
      this.chunkManager.getPlacedStations(),
      this.player.hasJetpack,
      this.player.hasRebreather,
      this.player.inventory.armorSlots,
      this.player.skills.toSaveData(),
      this.dayNight.time,
      exploredMap,
      Array.from(this.discoveredAltars),
      Array.from(this.usedRunestones),
      this.player.inventory.accessorySlots,
      this.npcShopPosition ?? undefined,
      this.chunkManager.getChestInventories()
    )
  }

  getSaveSlotName(): string | null {
    return this.saveSlotName
  }

  getChunkManager(): ChunkManager {
    return this.chunkManager
  }

  getPlayer(): Player {
    return this.player
  }

  getEnemies(): Enemy[] {
    return this.enemies
  }

  getCombat(): CombatSystem {
    return this.combat
  }

  getActiveBoss(): Boss | null {
    return this.activeBoss
  }

  getDayNight(): DayNightCycle {
    return this.dayNight
  }

  getDiscoveredAltars(): Set<BossType> {
    return this.discoveredAltars
  }

  /** Get altar placement for a discovered boss type (for UI arrow) */
  getDiscoveredAltarPosition(bossType: BossType): { px: number; py: number } | null {
    if (!this.discoveredAltars.has(bossType)) return null
    for (const altar of this.chunkManager.getAltars()) {
      if (altar.bossType === bossType) {
        return { px: altar.tx * TILE_SIZE + TILE_SIZE / 2, py: altar.ty * TILE_SIZE }
      }
    }
    return null
  }

  /** Show a temporary notification message */
  showNotification(message: string, color = 0xffffff) {
    const text = this.add.text(
      this.cameras.main.centerX, this.cameras.main.centerY - 80,
      message,
      {
        fontSize: '16px',
        color: `#${color.toString(16).padStart(6, '0')}`,
        fontFamily: 'monospace',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 4,
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(500)
    this.tweens.add({ targets: text, alpha: 0, duration: 1500, delay: 2000, onComplete: () => text.destroy() })
  }
}
