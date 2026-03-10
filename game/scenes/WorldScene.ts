import Phaser from 'phaser'
import { ChunkManager } from '../world/ChunkManager'
import { Player } from '../entities/Player'
import { Enemy } from '../entities/Enemy'
import { Boss } from '../entities/Boss'
import type { WorldData } from '../world/WorldGenerator'
import { TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT } from '../world/TileRegistry'
import { CombatSystem } from '../systems/CombatSystem'
import { EnemySpawner } from '../systems/EnemySpawner'
import { BOSS_DEFS, BossType } from '../data/bosses'
import { EnemyType, ENEMY_DEFS } from '../data/enemies'
import { getItemDef, ItemCategory } from '../data/items'
import { DroppedItem } from '../entities/DroppedItem'
import type { SaveData } from '../systems/SaveManager'
import { AudioManager, MusicTrack } from '../systems/AudioManager'
import { SoundId } from '../data/sounds'

// Y pixel threshold for underground music (UNDERGROUND_START=130 tiles * 16px)
const UNDERGROUND_Y = 130 * 16

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

  constructor() {
    super({ key: 'WorldScene' })
  }

  create() {
    this.worldData = this.registry.get('worldData') as WorldData

    // Sky gradient background
    this.createSkyBackground()

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

    // Spawn player
    const spawnPx = this.worldData.spawnX * TILE_SIZE + TILE_SIZE / 2
    const spawnPy = this.worldData.spawnY * TILE_SIZE + TILE_SIZE / 2
    this.player = new Player(this, spawnPx, spawnPy)

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
      this.registry.remove('saveData')
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

    this.add.text(8, 24, 'WASD:Move LMB:Mine/Attack RMB:Place C:Craft E:Inv K:Skills F:Summon', {
      fontSize: '11px',
      color: '#444444',
      fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(100)

    // Boss summon key (registered once, not per-frame)
    this.keyF = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F)

    // Disable right-click context menu so RMB works for placement
    this.input.mouse!.disableContextMenu()

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

    // ESC: close crafting/inventory/skill tree first, otherwise open pause menu
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => {
      if (this.player.craftingOpen) {
        this.player.craftingOpen = false
        return
      }
      if (this.player.inventoryOpen) {
        this.player.inventoryOpen = false
        this.player.inventory.returnHeldItem()
        return
      }
      if (this.player.skillTreeOpen) {
        this.player.skillTreeOpen = false
        return
      }
      this.scene.pause('WorldScene')
      this.scene.pause('UIScene')
      this.scene.launch('MenuScene', { pause: true })
    })

    // Start biome-appropriate music
    this.updateMusic()

    // Launch UI overlay
    this.scene.launch('UIScene')
  }

  override update(_time: number, delta: number) {
    const dt = delta / 1000

    // Combine enemies + boss for player combat
    const allTargets = this.activeBoss && this.activeBoss.alive
      ? [...this.enemies, this.activeBoss as any]
      : this.enemies

    this.player.update(dt, this.chunkManager, this.combat, allTargets)

    // Check boss summon item usage
    this.checkBossSummon()

    // Spawn enemies (not during boss fight)
    if (!this.activeBoss || !this.activeBoss.alive) {
      this.enemySpawner.update(dt, this.chunkManager, this.player.sprite.x, this.player.sprite.y, this.enemies)
    }

    // Update enemies
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue
      const result = enemy.update(dt, this.chunkManager, this.player.sprite.x, this.player.sprite.y)

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
        AudioManager.get()?.play(SoundId.ENEMY_DIE)
        if (enemy.sprite.active) enemy.sprite.destroy()
        this.enemies.splice(i, 1)
      }
    }

    // Update dropped items & pickup
    this.updateDroppedItems(dt)

    // Check if player has assembled the jetpack
    this.checkJetpack()

    this.chunkManager.update()
    this.updateMusic()
  }

  private updateMusic() {
    const audio = AudioManager.get()
    if (!audio) return

    // Boss music overrides biome music
    if (this.activeBoss && this.activeBoss.alive) {
      audio.playMusic(MusicTrack.BOSS)
      return
    }

    // Biome-based music
    const playerY = this.player.sprite.y
    if (playerY >= UNDERGROUND_Y) {
      audio.playMusic(MusicTrack.UNDERGROUND)
    } else {
      audio.playMusic(MusicTrack.SURFACE)
    }
  }

  private checkJetpack() {
    if (this.player.hasJetpack) {
      // Check if player has reached the sky (top of world)
      if (this.player.sprite.y < 32) {
        // Trigger ending!
        AudioManager.get()?.stopMusic()
        this.scene.stop('UIScene')
        this.scene.start('EndingScene')
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

  // ── Boss Summoning ────────────────────────────────────────

  private checkBossSummon() {
    if (this.activeBoss && this.activeBoss.alive) return
    if (this.player.dead) return

    const item = this.player.inventory.getSelectedItem()
    if (!item) return
    const def = getItemDef(item.id)
    if (!def || def.category !== ItemCategory.SPECIAL) return

    // F key to summon boss
    if (!Phaser.Input.Keyboard.JustDown(this.keyF)) return

    let bossDef = null
    for (const bd of Object.values(BOSS_DEFS)) {
      if (bd.summonItemId === item.id) {
        bossDef = bd
        break
      }
    }
    if (!bossDef) return

    // Consume summon item
    this.player.inventory.consumeSelected()

    // Spawn boss near player
    const bx = this.player.sprite.x + (Math.random() > 0.5 ? 150 : -150)
    const by = this.player.sprite.y - 50
    this.activeBoss = new Boss(this, bx, by, bossDef)
    AudioManager.get()?.play(SoundId.BOSS_APPEAR)

    // Boss announcement
    const text = this.add.text(
      this.cameras.main.centerX, this.cameras.main.centerY - 100,
      `${bossDef.name} has appeared!`,
      {
        fontSize: '24px', color: '#ff4444', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 4,
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(500)

    this.time.delayedCall(3000, () => text.destroy())
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
    const gfx = this.add.graphics()
    gfx.setScrollFactor(0)
    gfx.setDepth(-10)

    const { width, height } = this.scale
    const steps = 20
    for (let i = 0; i < steps; i++) {
      const t = i / steps
      const r = Math.floor(Phaser.Math.Linear(0x05, 0x1a, t))
      const g = Math.floor(Phaser.Math.Linear(0x05, 0x1a, t))
      const b = Math.floor(Phaser.Math.Linear(0x15, 0x3e, t))
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

      // Check pickup
      if (drop.canPickup() && drop.isNear(px, py)) {
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
      AudioManager.get()?.play(SoundId.CRAFT_SUCCESS) // reuse jingle
    }
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
}
