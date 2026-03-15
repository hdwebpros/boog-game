import Phaser from 'phaser'
import { ChunkManager } from '../world/ChunkManager'
import { Player } from '../entities/Player'
import { Enemy } from '../entities/Enemy'
import { Boss } from '../entities/Boss'
import type { WorldData, AltarPlacement, RunestonePlacement } from '../world/WorldGenerator'
import { TileType, TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT, UNDERGROUND_Y as UNDERGROUND_TILE_Y, DEEP_UNDERGROUND_Y, STATION_TILE_TYPE } from '../world/TileRegistry'
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
import { MultiplayerManager, RoomConnector, RemotePlayerSim, REMOTE_COL_W, REMOTE_COL_H, encodeMessage, MessageType } from '../multiplayer'
import type { NetworkManager } from '../multiplayer'
import type { PlayerSnapshot, EnemySnapshot, BossSnapshot, DroppedItemSnapshot, ProjectileSnapshot, JoinAccepted, TileChangeRequest, NetworkMessage, AttackRequest, CombatEvent, BossSummonRequest } from '../multiplayer'

// Y pixel thresholds for music zones (start music slightly before layer boundary)
const SKY_Y         = 80 * TILE_SIZE                       // above Cloud City
const UNDERGROUND_Y = (UNDERGROUND_TILE_Y - 50) * TILE_SIZE // music starts 50 tiles above underground
const DEEP_Y        = DEEP_UNDERGROUND_Y * TILE_SIZE        // deep underground / core
const OCEAN_EDGE_TILES = 80                                 // tile columns at each world edge treated as ocean

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
  private keyG!: Phaser.Input.Keyboard.Key
  private keyESC!: Phaser.Input.Keyboard.Key
  private autoSaveTimer = 0
  private saveFailed = false
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

  // POI discovery (runestones/altars visible on minimap when nearby)
  private discoveredPOIs: Set<string> = new Set() // "type:tx,ty" keys

  // Mystical Compass — rendering moved to UIScene, data provided via getCompassTarget()

  // Portal system
  private portalPromptText: Phaser.GameObjects.Text | null = null
  private portalNamingActive = false
  private portalNamingInput = ''
  private portalNamingTarget: import('../world/ChunkManager').PortalData | null = null

  // Multiplayer
  mp = new MultiplayerManager()
  private roomConnector: RoomConnector | null = null
  private remotePlayerSims = new Map<number, RemotePlayerSim>()
  /** Client-side enemy sprites (rendered from host sync data) */
  private clientEnemySprites = new Map<number, Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle>()
  /** Client-side boss sprite */
  private clientBossSprite: Phaser.GameObjects.Image | null = null
  private clientBossId = 0
  private clientAttackCooldown = 0
  /** Client-side dropped item sprites (rendered from host sync data) */
  private clientDroppedItemSprites = new Map<number, Phaser.GameObjects.Graphics>()
  /** Client-side projectile sprites (rendered from host sync data) */
  private clientProjectileSprites = new Map<number, Phaser.GameObjects.Rectangle>()

  constructor() {
    super({ key: 'WorldScene' })
  }

  create() {
    this.worldData = this.registry.get('worldData') as WorldData

    // Sky gradient background
    this.createSkyBackground()

    // Simple darkness overlay — just a tinted rectangle, no per-tile RT work
    this.darknessOverlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0)
      .setScrollFactor(0)
      .setDepth(50)
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
      // Pass explored map and waypoints to UIScene via registry
      if (saveData.exploredMap) {
        this.registry.set('exploredMap', saveData.exploredMap)
      }
      if (saveData.waypoints) {
        this.registry.set('waypoints', saveData.waypoints)
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
      // Restore discovered items
      if (saveData.discoveredItems) {
        for (const id of saveData.discoveredItems) this.player.inventory.discoveredItems.add(id)
      }
      // Restore portals
      if (saveData.portals) {
        this.chunkManager.restorePortals(saveData.portals)
      }
      // Restore discovered POIs (minimap markers for runestones/altars)
      if (saveData.discoveredPOIs) {
        for (const key of saveData.discoveredPOIs) this.discoveredPOIs.add(key)
      }
      this.registry.remove('saveData')
    }

    // Flash notification when obtaining a new item type for the first time
    this.player.inventory.onNewItemDiscovered = (id: number) => {
      const def = getItemDef(id)
      if (!def) return
      this.showNewItemFlash(def.name)
    }

    // Spawn NPC at cloud city shop position
    const npcPos = this.npcShopPosition ?? this.worldData.npcShopPosition
    if (npcPos) {
      this.npcShopPosition = npcPos
      this.npc = new NPC(this, npcPos.tx, npcPos.ty)
    }

    // Initialize multiplayer (default: offline/single-player)
    const mpMode = this.registry.get('mpMode') as string | undefined
    if (mpMode === 'host') {
      this.mp.initHost(this, this.worldData.seed, this.worldData.width, this.worldData.height)
    } else if (mpMode === 'client') {
      const network = this.registry.get('mpNetwork') as NetworkManager
      const joinData = this.registry.get('mpJoinData') as JoinAccepted
      this.mp.initClientFromExisting(this, network, joinData)
      this.registry.remove('mpNetwork')
      this.registry.remove('mpJoinData')
      this.player.isNetworkClient = true // host drives respawn

      // Apply stations from host
      for (const s of joinData.stations) {
        this.chunkManager.placeStation(s.tx, s.ty, s.itemId)
      }
      // Sync day/night time
      this.dayNight.time = joinData.dayNightTime
    } else {
      this.mp.initOffline()
    }
    // Register player entity
    this.player.entityId = this.mp.entities.register('player', this.player)

    // Camera follows player — 2x zoom so tiles feel substantial
    this.cameras.main.setZoom(2)
    this.cameras.main.startFollow(this.player.sprite, false, 0.25, 0.25)

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
    this.keyG = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.G)
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

    this.portalPromptText = this.add.text(0, 0, '', {
      fontSize: '11px', color: '#bb88ff', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5, 1).setDepth(100).setVisible(false)

    // Mystical Compass now rendered in UIScene (so it's above all overlays)

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

    // Multiplayer HUD (room code, player count)
    if (this.mp.isHost) {
      this.createMultiplayerHUD()
      // Wire up tile change broadcasting from host player
      this.player.onTileChange = (tx, ty, newType, oldType) => {
        const change: TileChangeRequest = { tx, ty, newType, oldType }
        this.mp.getHostSession()!.recordLocalTileChange(change)
        this.mp.sendTileChange(change)
      }
      // Connect to relay server and create room
      const hostSession = this.mp.getHostSession()!
      this.roomConnector = new RoomConnector(hostSession)
      this.roomConnector.onGameMessage = (msg) => this.handleHostMessage(msg)
      this.roomConnector.createRoom().then((code) => {
        this.registry.set('mpRoomCode', code)
        this.showNotification(`Room created: ${code}\nShare this code with friends!`, 0x8888ff)
      }).catch((err) => {
        this.showNotification(`Failed to create room: ${err.message}`, 0xff4444)
      })
    }

    // Client-mode HUD, chat, and disconnect handling
    if (this.mp.isClient) {
      this.createMultiplayerHUD()
      // Wire up tile change requests from client player → host
      this.player.onTileChange = (tx, ty, newType, oldType) => {
        this.mp.sendTileChange({ tx, ty, newType, oldType })
      }
      // Wire up chest sync: request on open, send state on close
      this.player.onChestOpen = (tx, ty) => {
        this.mp.sendChestRequest(tx, ty, 'open')
      }
      this.player.onChestClose = (tx, ty, items) => {
        this.mp.sendChestRequest(tx, ty, 'close', items)
      }
      // Wire up item drop requests from client player → host
      this.player.onItemDrop = (itemId, count) => {
        this.mp.sendItemDrop(itemId, count)
      }
      this.mp.onDisconnected = (reason) => {
        this.showNotification(`Disconnected: ${reason}`, 0xff4444)
        // Return to menu after a short delay
        this.time.delayedCall(2000, () => {
          AudioManager.get()?.stopMusic()
          this.registry.remove('mpMode')
          this.registry.remove('mpRoomCode')
          this.registry.remove('mpPlayerName')
          this.scene.stop('UIScene')
          this.scene.start('MenuScene', { pause: false })
        })
      }
    }

    // Auto-save: on page unload (refresh/close)
    this.boundBeforeUnload = () => this.performSave()
    window.addEventListener('beforeunload', this.boundBeforeUnload)

    // Clean up beforeunload listener when scene stops
    this.events.on('shutdown', () => {
      if (this.boundBeforeUnload) {
        window.removeEventListener('beforeunload', this.boundBeforeUnload)
        this.boundBeforeUnload = null
      }
      // Clean up multiplayer
      if (this.roomConnector) {
        this.roomConnector.disconnect()
        this.roomConnector = null
      }
      // Clean up client-side sprites
      for (const [, sprite] of this.clientEnemySprites) sprite.destroy()
      this.clientEnemySprites.clear()
      for (const [, sprite] of this.clientDroppedItemSprites) sprite.destroy()
      this.clientDroppedItemSprites.clear()
      for (const [, sprite] of this.clientProjectileSprites) sprite.destroy()
      this.clientProjectileSprites.clear()
      if (this.clientBossSprite) { this.clientBossSprite.destroy(); this.clientBossSprite = null }
      this.remotePlayerSims.clear()
      this.mp.destroy()
    })

    // Reset auto-save timer
    this.autoSaveTimer = 0
  }

  override update(_time: number, delta: number) {
    const dt = delta / 1000

    // ESC: close crafting/inventory/skill tree/shop first, otherwise open pause menu
    // Skip if MenuScene is already active (multiplayer overlay)
    if (Phaser.Input.Keyboard.JustDown(this.keyESC) && !this.scene.isActive('MenuScene')) {
      const uiScene = this.scene.get('UIScene') as any
      if (uiScene?.isWorldMapOpen?.()) {
        uiScene.closeWorldMap()
      } else if (this.player.craftingOpen) {
        this.player.craftingOpen = false
      } else if (this.player.inventoryOpen) {
        this.player.inventoryOpen = false
        this.player.inventory.returnHeldItem()
      } else if (this.player.skillTreeOpen) {
        this.player.skillTreeOpen = false
      } else if (this.player.chestOpen) {
        this.player.closeChest()
      } else if (this.player.shopOpen) {
        this.player.shopOpen = false
      } else if (!this.mp.isOnline) {
        this.scene.pause('WorldScene')
        this.scene.pause('UIScene')
        this.scene.launch('MenuScene', { pause: true })
        this.scene.bringToTop('MenuScene')
      } else {
        // Multiplayer: show menu overlay without pausing the game
        this.scene.launch('MenuScene', { pause: true, multiplayer: true })
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

    // Simple darkness overlay — single rectangle, no per-tile work
    const playerTY = Math.floor(this.player.sprite.y / TILE_SIZE)
    const undergroundDarkness = playerTY > 100
      ? Math.min(0.55, (playerTY - 100) / 200 * 0.55)
      : 0
    const surfaceDarkness = this.dayNight.darkness
    const effectiveDarkness = Math.max(surfaceDarkness, undergroundDarkness)
    this.darknessOverlay.setAlpha(effectiveDarkness)
    this.darknessOverlay.setFillStyle(this.dayNight.tintColor || 0x000000, 1)

    // Local player always updates (client-predicted movement)
    if (!this.mp.isClient) {
      // Host/offline: full authoritative update
      const allTargets = this.activeBoss && this.activeBoss.alive
        ? [...this.enemies, this.activeBoss as any]
        : this.enemies

      this.player.update(dt, this.chunkManager, this.combat, allTargets)

      // Check altar/runestone/NPC/portal interactions
      this.checkAltarInteraction()
      this.checkRunestoneInteraction()
      this.checkPOIDiscovery()
      this.updateMysticalCompass()
      this.checkNPCInteraction()
      this.checkPortalInteraction()

      // Build list of all player positions for spawning, enemy AI, and despawn checks
      const allPlayerPositions: { x: number; y: number; id: number }[] = [
        { x: this.player.sprite.x, y: this.player.sprite.y, id: this.mp.localPlayerId },
      ]
      for (const [id, sim] of this.remotePlayerSims) {
        if (!sim.dead) {
          allPlayerPositions.push({ x: sim.x, y: sim.y, id })
        }
      }

      // Spawn enemies near all players (not during boss fight)
      if (!this.activeBoss || !this.activeBoss.alive) {
        const prevCount = this.enemies.length
        this.enemySpawner.update(dt, this.chunkManager, allPlayerPositions, this.enemies, this.dayNight.isNight)
        // Register any newly spawned enemies
        for (let i = prevCount; i < this.enemies.length; i++) {
          this.registerEnemy(this.enemies[i]!)
        }
      }

      // Update enemies — target nearest player (host + all remotes)
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue

        // Set player positions for despawn check (enemies near any player stay alive)
        enemy.allPlayerPositions = allPlayerPositions

        // Find the nearest player to this enemy
        let nearestX = this.player.sprite.x
        let nearestY = this.player.sprite.y
        let nearestDistSq = Infinity
        for (const p of allPlayerPositions) {
          const edx = p.x - enemy.sprite.x
          const edy = p.y - enemy.sprite.y
          const distSq = edx * edx + edy * edy
          if (distSq < nearestDistSq) {
            nearestDistSq = distSq
            nearestX = p.x
            nearestY = p.y
          }
        }

        const result = enemy.update(dt, this.chunkManager, nearestX, nearestY, this.dayNight.isNight, effectiveDarkness)

        if (result.shootAtPlayer) {
          this.combat.fireEnemyProjectile(
            enemy.sprite.x, enemy.sprite.y,
            nearestX, nearestY,
            enemy.def.damage, enemy.def.color
          )
        }
      }

      // Check enemy contact damage against remote players (host side)
      for (const [rpId, sim] of this.remotePlayerSims) {
        if (sim.dead || sim.iFrames > 0) continue
        for (const enemy of this.enemies) {
          if (!enemy.alive || enemy.intangible) continue
          const eb = enemy.getBounds()
          const rpHW = REMOTE_COL_W / 2
          const rpHH = REMOTE_COL_H / 2
          const rpLeft = sim.x - rpHW
          const rpTop = sim.y - rpHH
          if (rpLeft < eb.x + eb.w && rpLeft + REMOTE_COL_W > eb.x &&
              rpTop < eb.y + eb.h && rpTop + REMOTE_COL_H > eb.y) {
            const kbx = (sim.x - enemy.sprite.x) > 0 ? 180 : -180
            const kby = -120
            if (sim.takeDamage(enemy.def.damage, kbx, kby)) {
              this.mp.broadcastCombatEvent({
                type: 'damage',
                targetType: 'player',
                targetId: rpId,
                sourceId: enemy.entityId,
                amount: enemy.def.damage,
                x: sim.x,
                y: sim.y,
                kbx,
                kby,
                color: 0xff4444,
              })
            }
            break
          }
        }
      }

      // Update boss — target nearest player
      if (this.activeBoss && this.activeBoss.alive) {
        let bossTargetX = this.player.sprite.x
        let bossTargetY = this.player.sprite.y
        let bossDistSq = Infinity
        for (const p of allPlayerPositions) {
          const bdx = p.x - this.activeBoss.sprite.x
          const bdy = p.y - this.activeBoss.sprite.y
          const distSq = bdx * bdx + bdy * bdy
          if (distSq < bossDistSq) {
            bossDistSq = distSq
            bossTargetX = p.x
            bossTargetY = p.y
          }
        }

        const result = this.activeBoss.update(dt, this.chunkManager, bossTargetX, bossTargetY)

        // Handle boss projectiles — fire at nearest player
        for (const proj of result.projectiles) {
          this.combat.fireEnemyProjectile(proj.x, proj.y, proj.tx, proj.ty, proj.damage, this.activeBoss.def.color)
        }

        // Spawn minions from boss
        if (result.spawnMinions) {
          this.spawnBossMinions()
        }

        // Boss collision damage — host player
        if (!this.player.dead) {
          const bb = this.activeBoss.getBounds()
          const px = this.player.sprite.x - 6
          const py = this.player.sprite.y - 14
          if (px < bb.x + bb.w && px + 12 > bb.x && py < bb.y + bb.h && py + 28 > bb.y) {
            const kbx = (this.player.sprite.x - this.activeBoss.sprite.x) > 0 ? 200 : -200
            this.player.takeDamage(this.activeBoss.def.damage, kbx, -150, this.combat)
          }
        }

        // Boss collision damage — remote players
        {
          const bb = this.activeBoss.getBounds()
          for (const [rpId, sim] of this.remotePlayerSims) {
            if (sim.dead || sim.iFrames > 0) continue
            const rpLeft = sim.x - REMOTE_COL_W / 2
            const rpTop = sim.y - REMOTE_COL_H / 2
            if (rpLeft < bb.x + bb.w && rpLeft + REMOTE_COL_W > bb.x &&
                rpTop < bb.y + bb.h && rpTop + REMOTE_COL_H > bb.y) {
              const kbx = (sim.x - this.activeBoss.sprite.x) > 0 ? 200 : -200
              const kby = -150
              if (sim.takeDamage(this.activeBoss.def.damage, kbx, kby)) {
                this.mp.broadcastCombatEvent({
                  type: 'damage',
                  targetType: 'player',
                  targetId: rpId,
                  sourceId: 0,
                  amount: this.activeBoss.def.damage,
                  x: sim.x,
                  y: sim.y,
                  kbx,
                  kby,
                  color: 0xff4444,
                })
              }
            }
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

      // Check enemy projectile hits against remote players
      for (const [rpId, sim] of this.remotePlayerSims) {
        if (sim.dead || sim.iFrames > 0) continue
        const rpBounds = {
          x: sim.x - REMOTE_COL_W / 2,
          y: sim.y - REMOTE_COL_H / 2,
          w: REMOTE_COL_W,
          h: REMOTE_COL_H,
        }
        for (const p of this.combat.projectiles) {
          if (p.fromPlayer || !p.alive) continue
          const pb = p.getBounds()
          if (pb.x < rpBounds.x + rpBounds.w && pb.x + pb.w > rpBounds.x &&
              pb.y < rpBounds.y + rpBounds.h && pb.y + pb.h > rpBounds.y) {
            const kbx = p.vx > 0 ? 100 : -100
            const kby = -80
            if (sim.takeDamage(p.damage, kbx, kby)) {
              this.mp.broadcastCombatEvent({
                type: 'damage',
                targetType: 'player',
                targetId: rpId,
                sourceId: 0,
                amount: p.damage,
                x: sim.x,
                y: sim.y,
                kbx,
                kby,
                color: 0xff4444,
              })
            }
            p.destroy()
            break
          }
        }
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
          // Grant XP to host
          this.grantXP(enemy.def.xp, enemy.sprite.x, enemy.sprite.y)
          // Broadcast XP to clients (Fix #4)
          if (this.mp.isHost) {
            this.mp.broadcastCombatEvent({
              type: 'xp',
              targetType: 'player',
              targetId: 0,
              sourceId: enemy.entityId,
              amount: enemy.def.xp,
              x: enemy.sprite.x,
              y: enemy.sprite.y,
            })
          }
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
              this.registerEnemy(child)
              this.enemies.push(child)
            }
          }
          AudioManager.get()?.play(SoundId.ENEMY_DIE)
          // Broadcast despawn to clients (Fix #10)
          if (this.mp.isHost) {
            this.mp.getHostSession()!.broadcast({
              type: MessageType.ENTITY_DESPAWN,
              senderId: 0,
              data: { id: enemy.entityId },
            })
          }
          this.mp.entities.unregister(enemy.entityId)
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
    } else {
      // Client mode: local player moves with client-side prediction
      this.player.update(dt, this.chunkManager)

      // Send input to host (skip while dead to prevent stale input on respawn)
      if (!this.player.dead) {
        const input = this.mp.collectInput(dt)
        if (input) {
          input.actionAnim = this.player.actionAnim
          this.mp.sendInput(input)
        }
      }

      // NPC interaction works locally for clients (shop is UI-only)
      if (this.npc) {
        this.npc.update(this.player.sprite.x, this.player.sprite.y)
      }
      this.checkNPCInteraction()

      // Runestone interaction is purely local (altar discovery on minimap)
      this.checkRunestoneInteraction()
      this.checkPOIDiscovery()

      // Altar prompt — client sends BOSS_SUMMON request to host
      this.checkAltarInteraction()

      // Portal interaction (works locally for clients)
      this.checkPortalInteraction()

      // Client-side attack detection — send attack requests to host
      this.checkClientAttack(dt)

      // Apply pending state from host
      this.applyClientSync()
    }

    // Clients skip combat.update() — still need to animate damage numbers
    if (this.mp.isClient) {
      this.combat.updateDamageNumbers(dt)
    }

    this.chunkManager.update()
    this.updateMusic()

    // Host: simulate remote players and broadcast state
    if (this.mp.isHost) {
      this.updateHostRemotePlayers(dt)
      this.broadcastMultiplayerState(dt)
    }
    if (this.mp.isOnline) {
      this.mp.update(dt)
      this.updateMultiplayerHUD()
    }

    // Auto-save every 60 seconds (host and offline only, stop retrying after quota failure)
    if (!this.mp.isClient && !this.saveFailed) {
      this.autoSaveTimer += dt
      if (this.autoSaveTimer >= 60) {
        this.autoSaveTimer = 0
        this.performSave().then(ok => {
          if (!ok) this.saveFailed = true
        })
      }
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

  // ── Client: Attack Detection ─────────────────────────────

  private checkClientAttack(dt: number) {
    this.clientAttackCooldown = Math.max(0, this.clientAttackCooldown - dt * 1000)
    if (this.clientAttackCooldown > 0) return

    if (this.player.inventoryOpen || this.player.skillTreeOpen || this.player.shopOpen || this.player.craftingOpen) return

    const pointer = this.input.activePointer
    if (!pointer.leftButtonDown()) return

    const item = this.player.inventory.getSelectedItem()
    if (!item) return
    const def = getItemDef(item.id)
    if (!def || def.category !== ItemCategory.WEAPON) return

    // Check cursor is not on a mineable block (mining takes priority)
    const cam = this.cameras.main
    const wp = cam.getWorldPoint(pointer.x, pointer.y)
    const tx = Math.floor(wp.x / 16)
    const ty = Math.floor(wp.y / 16)
    const tileType = this.chunkManager.getTile(tx, ty)
    if (tileType !== TileType.AIR) return // let mining handle it

    this.clientAttackCooldown = def.attackSpeed ?? 400
    const facingRight = wp.x >= this.player.sprite.x
    const style = def.weaponStyle as 'melee' | 'ranged' | 'magic' | 'summon'

    this.mp.sendAttack({
      x: this.player.sprite.x,
      y: this.player.sprite.y,
      cursorX: wp.x,
      cursorY: wp.y,
      weaponStyle: style,
      damage: def.damage ?? 0,
      color: def.color ?? 0xffffff,
      projectileSpeed: def.projectileSpeed,
      manaCost: def.manaCost,
      attackSpeed: def.attackSpeed,
      facingRight,
    })

    // Show local visual feedback (no damage — host is authoritative)
    this.player.facingRight = facingRight
    this.player.actionAnim = 'attacking'
    this.player.actionAnimTimer = 300

    if (style === 'melee') {
      // Draw swing arc visually (empty enemies = visual only, no damage)
      this.combat.meleeAttack(
        { damage: 0, color: def.color ?? 0xffffff } as any,
        this.player.sprite.x, this.player.sprite.y,
        facingRight, []
      )
    } else if (style === 'magic' && def.manaCost) {
      // Deduct mana locally for responsiveness (host will correct if wrong)
      this.player.mana = Math.max(0, this.player.mana - def.manaCost)
    }
  }

  // ── Host: Process remote player attacks ──────────────────

  private handleRemoteAttack(senderId: number, attack: AttackRequest) {
    const sim = this.remotePlayerSims.get(senderId)
    if (!sim) return

    // Set attack animation + weapon style so it broadcasts to clients
    sim.actionAnim = 'attacking'
    sim.weaponStyle = attack.weaponStyle

    // Use the sim's authoritative position, not the client-reported one
    const px = sim.x
    const py = sim.y

    const allTargets = this.activeBoss && this.activeBoss.alive
      ? [...this.enemies, this.activeBoss as any]
      : this.enemies

    const hostSession = this.mp.getHostSession()

    switch (attack.weaponStyle) {
      case 'melee': {
        const weaponDef = { damage: attack.damage, color: attack.color } as any
        const dmg = this.combat.meleeAttack(weaponDef, px, py, attack.facingRight, allTargets)
        if (dmg > 0 && hostSession) {
          hostSession.broadcast({
            type: MessageType.COMBAT_EVENT,
            senderId: 0,
            data: { type: 'damage', targetId: 0, sourceId: senderId, amount: dmg, x: px, y: py, color: 0xffff00 } as CombatEvent,
          })
        }
        break
      }
      case 'ranged':
      case 'magic': {
        const weaponDef = {
          damage: attack.damage,
          color: attack.color,
          projectileSpeed: attack.projectileSpeed ?? 400,
          weaponStyle: attack.weaponStyle,
        } as any
        this.combat.fireProjectile(weaponDef, px, py, attack.cursorX, attack.cursorY, true)
        break
      }
      case 'summon': {
        // Fix #14: Handle summon weapon for remote players
        this.combat.spawnSummon(
          { damage: attack.damage, color: attack.color, id: 0, weaponStyle: 'summon' as const } as any,
          px, py,
          sim!
        )
        break
      }
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
    if (this.mp.isClient) {
      // Client: send summon request to host (host validates; ingredients consumed on boss appear)
      this.mp.sendBossSummon(altar.bossType, altar.tx, altar.ty)
      if (this.altarPromptText) this.altarPromptText.setVisible(false)
      return
    }

    // Host/offline: consume ingredients and spawn boss
    const inv = this.player.inventory
    for (const ing of altarDef.ingredients) {
      inv.removeItem(ing.itemId, ing.count)
    }

    this.spawnBossAtAltar(altar, bossDef)
  }

  /** Actually spawn the boss at an altar (host/offline only) */
  private spawnBossAtAltar(altar: AltarPlacement, bossDef: (typeof BOSS_DEFS)[BossType]) {
    // Spawn boss at altar location
    const bx = altar.tx * TILE_SIZE + TILE_SIZE / 2
    const by = altar.ty * TILE_SIZE - TILE_SIZE
    this.activeBoss = new Boss(this, bx, by, bossDef)
    this.registerBoss(this.activeBoss)
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
            `${bossDef.name}'s altar location revealed!\nOpen the minimap (N) to see it.`,
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

  // ── POI Discovery (show on minimap when nearby) ──────

  private static readonly POI_DISCOVER_RANGE = 12 // tiles

  private checkPOIDiscovery() {
    const ptx = Math.floor(this.player.sprite.x / TILE_SIZE)
    const pty = Math.floor(this.player.sprite.y / TILE_SIZE)
    const range = WorldScene.POI_DISCOVER_RANGE

    for (const altar of this.chunkManager.getAltars()) {
      const key = `altar:${altar.tx},${altar.ty}`
      if (this.discoveredPOIs.has(key)) continue
      if (Math.abs(altar.tx - ptx) <= range && Math.abs(altar.ty - pty) <= range) {
        this.discoveredPOIs.add(key)
      }
    }

    for (const rs of this.chunkManager.getRunestones()) {
      const key = `runestone:${rs.tx},${rs.ty}`
      if (this.discoveredPOIs.has(key)) continue
      if (Math.abs(rs.tx - ptx) <= range && Math.abs(rs.ty - pty) <= range) {
        this.discoveredPOIs.add(key)
      }
    }
  }

  getDiscoveredPOIs(): { type: 'runestone' | 'altar'; bossType: string; worldX: number; worldY: number }[] {
    const result: { type: 'runestone' | 'altar'; bossType: string; worldX: number; worldY: number }[] = []

    for (const altar of this.chunkManager.getAltars()) {
      if (this.discoveredPOIs.has(`altar:${altar.tx},${altar.ty}`)) {
        result.push({ type: 'altar', bossType: altar.bossType, worldX: altar.tx * TILE_SIZE, worldY: altar.ty * TILE_SIZE })
      }
    }

    for (const rs of this.chunkManager.getRunestones()) {
      if (this.discoveredPOIs.has(`runestone:${rs.tx},${rs.ty}`)) {
        result.push({ type: 'runestone', bossType: rs.bossType, worldX: rs.tx * TILE_SIZE, worldY: rs.ty * TILE_SIZE })
      }
    }

    return result
  }

  // ── Mystical Compass ──────────────────────────────────

  // Compass rendering moved to UIScene; updateMysticalCompass is now a no-op
  private updateMysticalCompass() {}

  // ── Portal Interaction ──────────────────────────────────

  private getNearbyPortal(): import('../world/ChunkManager').PortalData | null {
    const ptx = Math.floor(this.player.sprite.x / TILE_SIZE)
    const pty = Math.floor(this.player.sprite.y / TILE_SIZE)
    for (const portal of this.chunkManager.getPortals()) {
      // Check if player is within or adjacent to the 4x4 portal area
      const cx = portal.tx + 2 // center x
      const cy = portal.ty + 2 // center y
      if (Math.abs(ptx - cx) <= 3 && Math.abs(pty - cy) <= 3) {
        return portal
      }
    }
    return null
  }

  private checkPortalInteraction() {
    if (this.player.dead) return

    // If naming UI is active, handle text input
    if (this.portalNamingActive) {
      this.updatePortalNaming()
      return
    }

    const portal = this.getNearbyPortal()

    if (portal && this.portalPromptText) {
      const px = portal.tx * TILE_SIZE + 2 * TILE_SIZE
      const py = portal.ty * TILE_SIZE - TILE_SIZE

      const linked = this.chunkManager.getLinkedPortal(portal)
      const lines: string[] = []

      if (portal.name) {
        lines.push(`Portal: "${portal.name}"`)
        if (linked) {
          lines.push('[F] Teleport  [G] Rename')
        } else {
          lines.push('No matching portal found')
          lines.push('[G] Rename')
        }
      } else {
        lines.push('Unnamed Portal')
        lines.push('[F] Set name')
      }

      this.portalPromptText.setText(lines.join('\n'))
      this.portalPromptText.setPosition(px, py)
      this.portalPromptText.setVisible(true)

      // F key: teleport (if named+linked) or start naming (if unnamed)
      if (Phaser.Input.Keyboard.JustDown(this.keyF)) {
        if (portal.name && linked) {
          this.teleportToPortal(linked)
        } else if (!portal.name) {
          this.startPortalNaming(portal)
        }
      }

      // G key: rename an already-named portal
      if (portal.name && Phaser.Input.Keyboard.JustDown(this.keyG)) {
        this.startPortalNaming(portal)
      }
    } else if (this.portalPromptText) {
      this.portalPromptText.setVisible(false)
    }
  }

  private startPortalNaming(portal: import('../world/ChunkManager').PortalData) {
    this.portalNamingActive = true
    this.portalNamingInput = portal.name || ''
    this.portalNamingTarget = portal
    this.player.portalNamingOpen = true

    if (this.portalPromptText) {
      const px = portal.tx * TILE_SIZE + 2 * TILE_SIZE
      const py = portal.ty * TILE_SIZE - TILE_SIZE
      this.portalPromptText.setText(`Name: ${this.portalNamingInput}_\n[Enter] confirm  [Esc] cancel`)
      this.portalPromptText.setPosition(px, py)
      this.portalPromptText.setVisible(true)
    }

    // Capture keyboard input for naming
    this.input.keyboard!.on('keydown', this.handlePortalKeyInput, this)
  }

  private handlePortalKeyInput = (event: KeyboardEvent) => {
    if (!this.portalNamingActive) return

    if (event.key === 'Enter') {
      // Confirm name
      if (this.portalNamingInput.trim() && this.portalNamingTarget) {
        this.chunkManager.setPortalName(this.portalNamingTarget, this.portalNamingInput.trim())
        AudioManager.get()?.play(SoundId.CRAFT_SUCCESS)
      }
      this.stopPortalNaming()
    } else if (event.key === 'Escape') {
      this.stopPortalNaming()
    } else if (event.key === 'Backspace') {
      this.portalNamingInput = this.portalNamingInput.slice(0, -1)
    } else if (event.key.length === 1 && this.portalNamingInput.length < 16) {
      this.portalNamingInput += event.key
    }

    event.preventDefault()
    event.stopPropagation()
  }

  private updatePortalNaming() {
    if (!this.portalNamingTarget || !this.portalPromptText) return
    const px = this.portalNamingTarget.tx * TILE_SIZE + 2 * TILE_SIZE
    const py = this.portalNamingTarget.ty * TILE_SIZE - TILE_SIZE
    this.portalPromptText.setText(`Name: ${this.portalNamingInput}_\n[Enter] confirm  [Esc] cancel`)
    this.portalPromptText.setPosition(px, py)
    this.portalPromptText.setVisible(true)
  }

  private stopPortalNaming() {
    this.portalNamingActive = false
    this.portalNamingInput = ''
    this.portalNamingTarget = null
    this.player.portalNamingOpen = false
    this.input.keyboard!.off('keydown', this.handlePortalKeyInput, this)
    if (this.portalPromptText) this.portalPromptText.setVisible(false)
  }

  private teleportToPortal(target: import('../world/ChunkManager').PortalData) {
    // Teleport player to center of the target portal
    const destX = (target.tx + 2) * TILE_SIZE
    const destY = (target.ty + 2) * TILE_SIZE
    this.player.sprite.x = destX
    this.player.sprite.y = destY
    this.player.vy = 0

    // Visual/audio feedback
    AudioManager.get()?.play(SoundId.CRAFT_SUCCESS)

    const text = this.add.text(
      this.cameras.main.centerX, this.cameras.main.centerY - 60,
      'Teleported!',
      {
        fontSize: '18px', color: '#bb88ff', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 4,
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(500)

    this.tweens.add({ targets: text, alpha: 0, duration: 1000, delay: 1000, onComplete: () => text.destroy() })
  }

  /** Host: handle a remote client's boss summon request */
  private handleRemoteBossSummon(req: BossSummonRequest) {
    if (this.activeBoss?.alive) return // already fighting a boss

    // Find the altar at the requested location
    const altar = this.chunkManager.getAltars().find(
      a => a.tx === req.altarTx && a.ty === req.altarTy && a.bossType === req.bossType
    )
    if (!altar) return

    const bossDef = BOSS_DEFS[altar.bossType]
    if (!bossDef) return

    this.spawnBossAtAltar(altar, bossDef)
  }

  private onBossDefeated() {
    if (!this.activeBoss) return
    AudioManager.get()?.play(SoundId.BOSS_DIE)

    // Grant boss XP to host
    this.grantXP(this.activeBoss.def.xp, this.activeBoss.sprite.x, this.activeBoss.sprite.y)

    // Broadcast XP to clients (Fix #4)
    if (this.mp.isHost) {
      this.mp.broadcastCombatEvent({
        type: 'xp',
        targetType: 'player',
        targetId: 0,
        sourceId: 0,
        amount: this.activeBoss.def.xp,
        x: this.activeBoss.sprite.x,
        y: this.activeBoss.sprite.y,
      })
    }

    // Drop jetpack component as world drop instead of direct inventory (Fix #3)
    this.spawnDrop(this.activeBoss.sprite.x, this.activeBoss.sprite.y, this.activeBoss.def.dropItemId, 1)

    // Victory message
    const name = this.activeBoss.def.name
    const dropDef = getItemDef(this.activeBoss.def.dropItemId)
    const text = this.add.text(
      this.cameras.main.centerX, this.cameras.main.centerY - 100,
      `${name} defeated!\nDropped: ${dropDef?.name ?? 'Unknown'}`,
      {
        fontSize: '20px', color: '#00ff88', fontFamily: 'monospace',
        align: 'center', stroke: '#000000', strokeThickness: 4,
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(500)

    this.time.delayedCall(4000, () => text.destroy())

    this.mp.entities.unregister(this.activeBoss.entityId)
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
      this.registerEnemy(enemy)
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

  spawnDrop(x: number, y: number, itemId: number, count: number, enchantment?: string) {
    const spread = (Math.random() - 0.5) * 120
    const drop = new DroppedItem(this, x, y, itemId, count, spread, -150, enchantment as any)
    drop.entityId = this.mp.entities.register('droppedItem', drop)
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
        this.mp.entities.unregister(drop.entityId)
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
        if (this.player.inventory.addItem(drop.itemId, drop.count, drop.enchantment)) {
          AudioManager.get()?.play(SoundId.PICKUP)
          this.mp.entities.unregister(drop.entityId)
          drop.destroy()
          this.droppedItems.splice(i, 1)
          continue
        }
      }

      // Host: check remote player pickups
      if (this.mp.isHost && drop.canPickup()) {
        for (const [rpId, sim] of this.remotePlayerSims) {
          if (sim.dead) continue
          if (drop.isNear(sim.x, sim.y)) {
            // Notify the client that they picked up this item
            this.mp.getHostSession()!.broadcast({
              type: MessageType.ITEM_PICKUP,
              senderId: 0,
              data: { playerId: rpId, itemId: drop.itemId, count: drop.count, enchantment: drop.enchantment },
            })
            this.mp.entities.unregister(drop.entityId)
            drop.destroy()
            this.droppedItems.splice(i, 1)
            break
          }
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

  // ── Multiplayer ──────────────────────────────────────────

  private broadcastMultiplayerState(dt: number) {
    const hostSession = this.mp.getHostSession()!
    const hostName = (this.registry.get('mpPlayerName') as string | undefined) ?? 'Host'

    // Build player snapshots (host + all remote players)
    const playerSnapshots: PlayerSnapshot[] = [{
      id: this.player.entityId,
      name: hostName,
      x: this.player.sprite.x,
      y: this.player.sprite.y,
      vx: this.player.vx,
      vy: this.player.vy,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      mana: this.player.mana,
      maxMana: this.player.maxMana,
      facingRight: this.player.facingRight,
      dead: this.player.dead,
      isInWater: this.player.isInWater,
      hasJetpack: this.player.hasJetpack,
      actionAnim: this.player.actionAnim,
      weaponStyle: '',
      lastInputSeq: 0,
    }]
    // Add remote player snapshots
    for (const rp of hostSession.remotePlayers) {
      playerSnapshots.push(rp.snapshot)
    }

    // Build enemy snapshots
    const enemySnapshots: EnemySnapshot[] = this.enemies
      .filter(e => e.alive)
      .map(e => ({
        id: e.entityId,
        type: e.def.type,
        x: e.sprite.x,
        y: e.sprite.y,
        vx: e.vx,
        vy: e.vy,
        hp: e.hp,
        alive: e.alive,
        facingRight: e.facingRight,
        intangible: e.intangible,
      }))

    // Build boss snapshot
    let bossSnapshot: BossSnapshot | null = null
    if (this.activeBoss && this.activeBoss.alive) {
      bossSnapshot = {
        id: this.activeBoss.entityId,
        type: this.activeBoss.def.type,
        x: this.activeBoss.sprite.x,
        y: this.activeBoss.sprite.y,
        vx: this.activeBoss.vx,
        vy: this.activeBoss.vy,
        hp: this.activeBoss.hp,
        maxHp: this.activeBoss.def.maxHp,
        alive: this.activeBoss.alive,
        phaseIndex: this.activeBoss.getPhaseIndex(),
        shieldActive: this.activeBoss.getShieldActive(),
      }
    }

    // Build dropped item snapshots
    const droppedItems: DroppedItemSnapshot[] = this.droppedItems.map(d => ({
      id: d.entityId,
      x: d.x,
      y: d.y,
      itemId: d.itemId,
      count: d.count,
      enchantment: d.enchantment,
    }))

    // Build projectile snapshots (Fix #2)
    const projectileSnapshots: ProjectileSnapshot[] = this.combat.projectiles
      .filter(p => p.alive)
      .map(p => ({
        id: p.entityId,
        x: p.sprite.x,
        y: p.sprite.y,
        vx: p.vx,
        vy: p.vy,
        damage: p.damage,
        color: 0xffffff,
        fromPlayer: p.fromPlayer,
        ownerId: 0,
      }))

    this.mp.broadcastState(dt, playerSnapshots, enemySnapshots, bossSnapshot, droppedItems, projectileSnapshots, this.dayNight.time)
  }

  /** Register a newly spawned enemy with the entity system */
  private registerEnemy(enemy: Enemy) {
    enemy.entityId = this.mp.entities.register('enemy', enemy)
    // Broadcast spawn to clients (Fix #10)
    if (this.mp.isHost) {
      this.mp.getHostSession()!.broadcast({
        type: MessageType.ENTITY_SPAWN,
        senderId: 0,
        data: { entityType: 'enemy', id: enemy.entityId, type: enemy.def.type, x: enemy.sprite.x, y: enemy.sprite.y },
      })
    }
  }

  /** Register a newly spawned boss with the entity system */
  private registerBoss(boss: Boss) {
    boss.entityId = this.mp.entities.register('boss', boss)
    // Broadcast spawn to clients (Fix #10)
    if (this.mp.isHost) {
      this.mp.getHostSession()!.broadcast({
        type: MessageType.ENTITY_SPAWN,
        senderId: 0,
        data: { entityType: 'boss', id: boss.entityId, type: boss.def.type, x: boss.sprite.x, y: boss.sprite.y },
      })
    }
  }

  private mpHudText: Phaser.GameObjects.Text | null = null

  private createMultiplayerHUD() {
    this.mpHudText = this.add.text(790, 8, '', {
      fontSize: '11px',
      color: '#8888ff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'right',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(200)
  }

  private updateMultiplayerHUD() {
    if (!this.mpHudText) return
    const roomCode = this.registry.get('mpRoomCode') as string | undefined
    const lines: string[] = []
    if (roomCode) lines.push(`Room: ${roomCode}`)
    lines.push(`Players: ${this.mp.playerCount}`)
    if (this.mp.isClient) lines.push(`Ping: ${this.mp.ping}ms`)
    this.mpHudText.setText(lines.join('\n'))
  }

  getMultiplayer(): MultiplayerManager {
    return this.mp
  }

  performSave(overrideSlotId?: string, overrideName?: string): Promise<boolean> {
    if (this.player.dead) return Promise.resolve(false)
    const worldData = this.registry.get('worldData') as WorldData
    if (!worldData) return Promise.resolve(false)

    const slotId = overrideSlotId ?? this.saveSlotId ?? SaveManager.generateSlotId()
    const slotName = overrideName ?? this.saveSlotName ?? 'World'

    // Remember for future auto-saves
    this.saveSlotId = slotId
    this.saveSlotName = slotName

    // Get explored map and waypoints from UIScene
    const uiScene = this.scene.get('UIScene') as any
    const exploredMap = uiScene?.getExploredMap?.() as number[] | null ?? undefined
    const waypoints = uiScene?.getWaypoints?.() ?? undefined

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
      this.chunkManager.getChestInventories(),
      Array.from(this.player.inventory.discoveredItems),
      waypoints,
      this.chunkManager.getPortalData(),
      Array.from(this.discoveredPOIs)
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

  /** Get nearest unread runestone direction for compass HUD */
  getCompassTarget(): { angle: number; dist: number } | null {
    const hasCompass = this.player.inventory.getCount(242) > 0
    if (!hasCompass) return null

    const runestones = this.chunkManager.getRunestones()
    const px = this.player.sprite.x
    const py = this.player.sprite.y
    let nearest: { rx: number; ry: number; dist: number } | null = null

    for (const rs of runestones) {
      const key = `${rs.tx},${rs.ty}`
      if (this.usedRunestones.has(key)) continue
      const rx = rs.tx * TILE_SIZE + TILE_SIZE / 2
      const ry = rs.ty * TILE_SIZE + TILE_SIZE / 2
      const dist = Math.sqrt((rx - px) ** 2 + (ry - py) ** 2)
      if (!nearest || dist < nearest.dist) {
        nearest = { rx, ry, dist }
      }
    }

    if (!nearest) return null
    return { angle: Math.atan2(nearest.ry - py, nearest.rx - px), dist: nearest.dist }
  }

  // ── Host: Handle messages from remote players ──────────

  private handleHostMessage(msg: NetworkMessage) {
    if (msg.type === MessageType.JOIN_REQUEST) {
      const sendFn = msg.data._sendFn as (data: string) => void
      const playerId = msg.data._playerId as number
      const playerName = msg.data.playerName as string

      const hostSession = this.mp.getHostSession()!
      const hostName = (this.registry.get('mpPlayerName') as string | undefined) ?? 'Host'

      // Spawn position near the host's spawn
      const spawnX = this.worldData.spawnX * TILE_SIZE + TILE_SIZE / 2
      const spawnY = this.worldData.spawnY * TILE_SIZE + TILE_SIZE / 2

      // Update remote player snapshot BEFORE building JoinAccepted
      hostSession.updatePlayerSnapshot(playerId, {
        x: spawnX,
        y: spawnY,
        name: playerName,
      })

      // Build JoinAccepted with full world state
      const joinAccepted: JoinAccepted = {
        playerId,
        hostName,
        seed: this.worldData.seed,
        worldWidth: this.worldData.width,
        worldHeight: this.worldData.height,
        dayNightTime: this.dayNight.time,
        tileChanges: hostSession.getAllTileChanges(),
        players: this.buildPlayerSnapshots(),
        enemies: this.buildEnemySnapshots(),
        boss: this.buildBossSnapshot(),
        stations: this.chunkManager.getPlacedStations().map(s => ({ tx: s.tx, ty: s.ty, itemId: s.itemId })),
      }

      sendFn(encodeMessage({
        type: MessageType.JOIN_ACCEPTED,
        senderId: 0,
        data: joinAccepted,
      }))

      // Create physics simulation for remote player
      const sim = new RemotePlayerSim(spawnX, spawnY)
      this.remotePlayerSims.set(playerId, sim)

      // Create visual sprite for remote player on host's screen
      this.mp.remotePlayers.set(playerId, {
        id: playerId,
        name: playerName,
        x: spawnX, y: spawnY,
        prevX: spawnX, prevY: spawnY,
        targetX: spawnX, targetY: spawnY,
        vx: 0, vy: 0,
        hp: 100, maxHp: 100,
        facingRight: true,
        dead: false,
        actionAnim: '',
        weaponStyle: '',
        interpT: 1,
        sprite: null,
        nameText: null,
      })
      this.mp.createRemotePlayerSprite(playerId, this)

      // Broadcast join to other clients
      hostSession.broadcast({
        type: MessageType.PLAYER_JOINED,
        senderId: 0,
        data: { id: playerId, name: playerName, x: spawnX, y: spawnY },
      })

      this.showNotification(`${playerName} joined!`, 0x88ff88)
      return
    }

    if (msg.type === MessageType.TILE_CHANGE) {
      const change = msg.data as TileChangeRequest
      const hostSession = this.mp.getHostSession()!
      const actualTile = this.chunkManager.getTile(change.tx, change.ty)
      // Validate: tile matches what client expects
      if (actualTile === change.oldType) {
        this.chunkManager.setTile(change.tx, change.ty, change.newType as TileType)
        hostSession.recordLocalTileChange(change)
        hostSession.broadcast({
          type: MessageType.TILE_UPDATE,
          senderId: 0,
          data: change,
        })
      } else {
        // Fix #7: Send correction — broadcast actual tile state to fix desynced client
        hostSession.broadcast({
          type: MessageType.TILE_UPDATE,
          senderId: 0,
          data: { tx: change.tx, ty: change.ty, newType: actualTile, oldType: change.newType },
        })
      }
      return
    }

    if (msg.type === MessageType.PLAYER_LEFT) {
      const playerId = msg.data?.playerId as number | undefined
      if (playerId) {
        this.remotePlayerSims.delete(playerId)
        this.mp.removeRemotePlayerSprite(playerId)
        this.mp.remotePlayers.delete(playerId)
        const rp = this.mp.getHostSession()?.remotePlayers.find(p => p.id === playerId)
        if (rp) {
          this.showNotification(`${rp.name} left`, 0xff8888)
        }
        this.mp.getHostSession()?.removePlayer(playerId)
      }
      return
    }

    if (msg.type === MessageType.CHAT_MESSAGE) {
      const rp = this.mp.remotePlayers.get(msg.senderId)
      const name = rp?.name ?? 'Unknown'
      this.mp.addChatMessage(msg.senderId, name, (msg.data as { text: string }).text)
      return
    }

    if (msg.type === MessageType.ATTACK_REQUEST) {
      this.handleRemoteAttack(msg.senderId, msg.data as AttackRequest)
      return
    }

    if (msg.type === MessageType.BOSS_SUMMON) {
      this.handleRemoteBossSummon(msg.data as BossSummonRequest)
      return
    }

    // Fix #9: Handle item drop from client — spawn as world drop at player's sim position
    if (msg.type === MessageType.ITEM_DROP) {
      const sim = this.remotePlayerSims.get(msg.senderId)
      if (sim) {
        const dropData = msg.data as { itemId: number; count: number }
        if (dropData.itemId > 0 && dropData.count > 0) {
          this.spawnDrop(sim.x, sim.y, dropData.itemId, dropData.count)
        }
      }
      return
    }

    // Handle chest request from client
    if (msg.type === MessageType.CHEST_REQUEST) {
      const data = msg.data as { tx: number; ty: number; action: string; items?: any[] }
      if (data.action === 'open') {
        // Send chest contents to requesting client
        const items = this.chunkManager.getChestInventory(data.tx, data.ty)
        this.mp.getHostSession()!.broadcast({
          type: MessageType.CHEST_CONTENTS,
          senderId: 0,
          data: { playerId: msg.senderId, tx: data.tx, ty: data.ty, items },
        })
      } else if (data.action === 'close' && data.items) {
        // Client closed chest — update authoritative chest state
        this.chunkManager.setChestInventory(data.tx, data.ty, data.items)
      }
      return
    }

    // PLAYER_INPUT is already stored by HostSession.handleMessage()
    // Other messages forwarded to WorldScene via onHostMessage
  }

  /** Build player snapshots for JoinAccepted */
  private buildPlayerSnapshots(): PlayerSnapshot[] {
    const hostName = (this.registry.get('mpPlayerName') as string | undefined) ?? 'Host'
    const snaps: PlayerSnapshot[] = [{
      id: this.player.entityId,
      name: hostName,
      x: this.player.sprite.x,
      y: this.player.sprite.y,
      vx: this.player.vx,
      vy: this.player.vy,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      mana: this.player.mana,
      maxMana: this.player.maxMana,
      facingRight: this.player.facingRight,
      dead: this.player.dead,
      isInWater: this.player.isInWater,
      hasJetpack: this.player.hasJetpack,
      actionAnim: this.player.actionAnim,
      weaponStyle: '',
      lastInputSeq: 0,
    }]
    const hostSession = this.mp.getHostSession()
    if (hostSession) {
      for (const rp of hostSession.remotePlayers) {
        snaps.push(rp.snapshot)
      }
    }
    return snaps
  }

  private buildEnemySnapshots(): EnemySnapshot[] {
    return this.enemies
      .filter(e => e.alive)
      .map(e => ({
        id: e.entityId,
        type: e.def.type,
        x: e.sprite.x,
        y: e.sprite.y,
        vx: e.vx,
        vy: e.vy,
        hp: e.hp,
        alive: e.alive,
        facingRight: e.facingRight,
        intangible: e.intangible,
      }))
  }

  private buildBossSnapshot(): BossSnapshot | null {
    if (!this.activeBoss || !this.activeBoss.alive) return null
    return {
      id: this.activeBoss.entityId,
      type: this.activeBoss.def.type,
      x: this.activeBoss.sprite.x,
      y: this.activeBoss.sprite.y,
      vx: this.activeBoss.vx,
      vy: this.activeBoss.vy,
      hp: this.activeBoss.hp,
      maxHp: this.activeBoss.def.maxHp,
      alive: this.activeBoss.alive,
      phaseIndex: this.activeBoss.getPhaseIndex(),
      shieldActive: this.activeBoss.getShieldActive(),
    }
  }

  // ── Host: Simulate remote player physics ──────────────

  private updateHostRemotePlayers(dt: number) {
    const hostSession = this.mp.getHostSession()
    if (!hostSession) return

    for (const rp of hostSession.remotePlayers) {
      const sim = this.remotePlayerSims.get(rp.id)
      if (!sim) continue

      // Respawn dead remote players after delay (Fix #12)
      if (sim.dead) {
        sim.respawnTimer -= dt * 1000
        if (sim.respawnTimer <= 0) {
          const spawnX = this.worldData.spawnX * TILE_SIZE + TILE_SIZE / 2
          const spawnY = this.worldData.spawnY * TILE_SIZE + TILE_SIZE / 2
          sim.respawn(spawnX, spawnY)
        }
      }

      // Apply latest input from this player
      const input = rp.lastInput
      if (input) {
        const fallDmg = sim.simulate(input, dt, this.chunkManager)
        if (fallDmg > 0) {
          this.mp.broadcastCombatEvent({
            type: 'damage',
            targetType: 'player',
            targetId: rp.id,
            sourceId: 0,
            amount: fallDmg,
            x: sim.x,
            y: sim.y,
            color: 0xff4444,
          })
        }
      }

      // Update the snapshot that gets broadcast (Fix #5 — include all fields)
      hostSession.updatePlayerSnapshot(rp.id, {
        x: sim.x,
        y: sim.y,
        vx: sim.vx,
        vy: sim.vy,
        facingRight: sim.facingRight,
        hp: sim.hp,
        maxHp: sim.maxHp,
        mana: sim.mana,
        maxMana: sim.maxMana,
        dead: sim.dead,
        isInWater: sim.isInWater,
        actionAnim: sim.actionAnim,
        weaponStyle: sim.weaponStyle,
        lastInputSeq: rp.lastInput?.seq ?? 0,
      })

      // Update the visual sprite on host's screen
      const rpState = this.mp.remotePlayers.get(rp.id)
      if (rpState) {
        rpState.x = sim.x
        rpState.y = sim.y
        rpState.prevX = sim.x
        rpState.prevY = sim.y
        rpState.targetX = sim.x
        rpState.targetY = sim.y
        rpState.facingRight = sim.facingRight
        rpState.hp = sim.hp
        rpState.maxHp = sim.maxHp
        rpState.dead = sim.dead
        rpState.actionAnim = sim.actionAnim
        rpState.weaponStyle = sim.weaponStyle
        rpState.interpT = 1 // no interpolation needed for host
        if (rpState.sprite) {
          rpState.sprite.setPosition(sim.x, sim.y)
          rpState.sprite.setFlipX(!sim.facingRight)
        }
        if (rpState.nameText) {
          rpState.nameText.setPosition(sim.x, sim.y - 24)
        }
      }
    }
  }

  // ── Client: Apply state synced from host ──────────────

  private applyClientSync() {
    // Apply pending tile changes
    for (const tc of this.mp.consumeTileChanges()) {
      this.chunkManager.setTile(tc.tx, tc.ty, tc.newType as TileType)
      // Track station placement/removal for crafting
      if (tc.newType !== TileType.AIR) {
        // Check if the placed tile is a station by finding its item ID
        for (const [itemId, tileType] of Object.entries(STATION_TILE_TYPE)) {
          if (tileType === tc.newType) {
            this.chunkManager.placeStation(tc.tx, tc.ty, Number(itemId))
            break
          }
        }
      } else {
        // Tile removed — unregister station if it was one
        this.chunkManager.removeStation(tc.tx, tc.ty)
      }
    }

    // Apply enemy sync
    const enemySync = this.mp.consumeEnemySync()
    if (enemySync) {
      this.applyClientEnemySync(enemySync)
    }

    // Apply boss sync (null = no new data received)
    const bossSync = this.mp.consumeBossSync()
    if (bossSync) {
      this.applyClientBossSync(bossSync)
    }

    // Apply dropped item sync (Fix #1)
    const droppedItemSync = this.mp.consumeDroppedItemSync()
    if (droppedItemSync) {
      this.applyClientDroppedItemSync(droppedItemSync)
    }

    // Apply projectile sync (Fix #2)
    const projectileSync = this.mp.consumeProjectileSync()
    if (projectileSync) {
      this.applyClientProjectileSync(projectileSync)
    }

    // Apply day/night sync (Fix #6)
    const dayNightTime = this.mp.consumeDayNightTime()
    if (dayNightTime !== null) {
      this.dayNight.time = dayNightTime
    }

    // Apply host-authoritative state to local player (HP, mana, death/respawn only).
    // The client is authoritative for its own movement — position is NOT corrected
    // from the host's RemotePlayerSim, since they run identical physics on different
    // clocks and will always diverge slightly, causing jitter if corrected.
    const correction = this.mp.consumeLocalPlayerCorrection()
    if (correction) {
      if (correction.dead && !this.player.dead) {
        // Host says dead → kill client
        this.player.hp = 0
        this.player.takeDamage(0, 0, 0, this.combat)
      } else if (!correction.dead && this.player.dead) {
        // Host says alive → respawn at host position
        this.player.forceRespawn(correction.x, correction.y, correction.hp, correction.mana)
        this.mp.consumeCombatEvents()
      } else {
        // Normal: sync server-authoritative stats only
        this.player.hp = correction.hp
        this.player.maxHp = correction.maxHp
        this.player.mana = correction.mana
        this.player.maxMana = correction.maxMana
      }
    }

    // Apply item pickups from host
    for (const pickup of this.mp.consumeItemPickups()) {
      if (this.player.inventory.addItem(pickup.itemId, pickup.count, pickup.enchantment as any)) {
        AudioManager.get()?.play(SoundId.PICKUP)
      }
    }

    // Apply chest contents from host
    const chestContents = this.mp.consumeChestContents()
    if (chestContents) {
      this.chunkManager.setChestInventory(chestContents.tx, chestContents.ty, chestContents.items)
    }

    // Apply combat events
    for (const evt of this.mp.consumeCombatEvents()) {
      if (evt.type === 'xp') {
        // Fix #4: XP granted to all clients
        this.grantXP(evt.amount, evt.x, evt.y)
      } else if (evt.targetType === 'player' && evt.targetId === this.mp.localPlayerId) {
        // Host detected a hit on this player via RemotePlayerSim.
        // Validate against client's local position — the sim can be desynced,
        // causing phantom hits when the client player isn't actually near the enemy.
        let kbx = evt.kbx ?? 0
        const kby = evt.kby ?? 0

        // Check if the client player is actually near the hit source
        const enemySprite = evt.sourceId ? this.clientEnemySprites.get(evt.sourceId) : null
        const sourceX = enemySprite?.x ?? this.clientBossSprite?.x
        const sourceY = enemySprite?.y ?? this.clientBossSprite?.y
        if (sourceX !== undefined && sourceY !== undefined) {
          const ddx = this.player.sprite.x - sourceX
          const ddy = this.player.sprite.y - sourceY
          const distSq = ddx * ddx + ddy * ddy
          // Skip if client player is far from the enemy (phantom hit from desync)
          if (distSq > 80 * 80) continue
          // Recalculate knockback direction from client's local position
          if (kbx !== 0) {
            const kbMag = Math.abs(kbx)
            kbx = ddx >= 0 ? kbMag : -kbMag
          }
        }
        this.player.takeDamage(evt.amount, kbx, kby, this.combat)
      } else {
        // Visual-only damage number (enemy hit or other player hit)
        this.combat.spawnDamageNumber(evt.x, evt.y, evt.amount, evt.color ?? 0xff4444)
      }
    }
  }

  private applyClientEnemySync(snapshots: EnemySnapshot[]) {
    const seen = new Set<number>()
    for (const snap of snapshots) {
      seen.add(snap.id)
      let sprite = this.clientEnemySprites.get(snap.id)
      if (!sprite) {
        // Create sprite from enemy type
        const texKey = `enemy_${snap.type}`
        if (this.textures.exists(texKey)) {
          sprite = this.add.image(snap.x, snap.y, texKey).setDepth(9)
        } else {
          sprite = this.add.rectangle(snap.x, snap.y, 20, 16, 0xff0000).setDepth(9) as any
        }
        this.clientEnemySprites.set(snap.id, sprite!)
      }
      sprite!.setPosition(snap.x, snap.y)
      if ('setFlipX' in sprite!) {
        (sprite as Phaser.GameObjects.Image).setFlipX(!snap.facingRight)
      }
      sprite!.setAlpha(snap.alive ? 1 : 0.3)
    }
    // Remove sprites for enemies no longer present
    for (const [id, sprite] of this.clientEnemySprites) {
      if (!seen.has(id)) {
        sprite.destroy()
        this.clientEnemySprites.delete(id)
      }
    }
  }

  private applyClientBossSync(snap: BossSnapshot) {
    if (snap.alive) {
      if (!this.clientBossSprite || this.clientBossId !== snap.id) {
        // Create boss sprite
        if (this.clientBossSprite) this.clientBossSprite.destroy()
        const texKey = `boss_${snap.type}`
        if (this.textures.exists(texKey)) {
          this.clientBossSprite = this.add.image(snap.x, snap.y, texKey).setDepth(9)
        } else {
          const gfx = this.add.graphics()
          gfx.fillStyle(0xff0000)
          gfx.fillRect(0, 0, 40, 40)
          gfx.generateTexture(`boss_fallback_${snap.id}`, 40, 40)
          gfx.destroy()
          this.clientBossSprite = this.add.image(snap.x, snap.y, `boss_fallback_${snap.id}`).setDepth(9)
        }
        this.clientBossId = snap.id
      }
      this.clientBossSprite.setPosition(snap.x, snap.y)
    } else {
      // Boss died
      if (this.clientBossSprite) {
        this.clientBossSprite.destroy()
        this.clientBossSprite = null
        this.clientBossId = 0
      }
    }
  }

  /** Client: render dropped items from host sync (Fix #1) */
  private applyClientDroppedItemSync(snapshots: DroppedItemSnapshot[]) {
    const seen = new Set<number>()
    for (const snap of snapshots) {
      seen.add(snap.id)
      let gfx = this.clientDroppedItemSprites.get(snap.id)
      if (!gfx) {
        gfx = this.add.graphics().setDepth(8)
        const itemDef = getItemDef(snap.itemId)
        const color = itemDef?.color ?? 0xffffff
        gfx.fillStyle(color, 1)
        gfx.fillRect(-4, -4, 8, 8)
        gfx.lineStyle(1, 0x000000, 0.5)
        gfx.strokeRect(-4, -4, 8, 8)
        this.clientDroppedItemSprites.set(snap.id, gfx)
      }
      gfx.setPosition(snap.x, snap.y)
    }
    // Remove sprites for items no longer present
    for (const [id, gfx] of this.clientDroppedItemSprites) {
      if (!seen.has(id)) {
        gfx.destroy()
        this.clientDroppedItemSprites.delete(id)
      }
    }
  }

  /** Client: render projectiles from host sync (Fix #2) */
  private applyClientProjectileSync(snapshots: ProjectileSnapshot[]) {
    const seen = new Set<number>()
    for (const snap of snapshots) {
      seen.add(snap.id)
      let rect = this.clientProjectileSprites.get(snap.id)
      if (!rect) {
        const size = snap.fromPlayer ? 5 : 4
        const color = snap.color ?? (snap.fromPlayer ? 0xffff00 : 0xff4444)
        rect = this.add.rectangle(snap.x, snap.y, size, size, color).setDepth(55) as Phaser.GameObjects.Rectangle
        this.clientProjectileSprites.set(snap.id, rect)
      }
      rect.setPosition(snap.x, snap.y)
    }
    // Remove sprites for projectiles no longer present
    for (const [id, rect] of this.clientProjectileSprites) {
      if (!seen.has(id)) {
        rect.destroy()
        this.clientProjectileSprites.delete(id)
      }
    }
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

  /** Flash the name of a newly discovered item on screen */
  private showNewItemFlash(name: string) {
    const text = this.add.text(
      this.cameras.main.centerX, this.cameras.main.centerY + 60,
      `New item: ${name}`,
      {
        fontSize: '18px',
        color: '#ffdd44',
        fontFamily: 'monospace',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 4,
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(500).setAlpha(0)
    // Flash in, hold, then fade out
    this.tweens.add({
      targets: text,
      alpha: 1,
      duration: 200,
      yoyo: false,
      onComplete: () => {
        this.tweens.add({
          targets: text,
          alpha: 0,
          y: text.y - 20,
          duration: 1200,
          delay: 1500,
          onComplete: () => text.destroy()
        })
      }
    })
  }
}
