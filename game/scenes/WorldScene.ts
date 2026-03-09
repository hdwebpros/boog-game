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
import type { SaveData } from '../systems/SaveManager'

export class WorldScene extends Phaser.Scene {
  private chunkManager!: ChunkManager
  private player!: Player
  private worldData!: WorldData
  private combat!: CombatSystem
  private enemySpawner!: EnemySpawner
  private enemies: Enemy[] = []
  private activeBoss: Boss | null = null

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
      this.player.inventory.selectedSlot = saveData.selectedSlot
      this.player.hasJetpack = saveData.hasJetpack
      // Restore placed stations
      for (const s of saveData.placedStations) {
        this.chunkManager.placeStation(s.tx, s.ty, s.itemId)
      }
      this.registry.remove('saveData')
    }

    // Camera follows player
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1)

    // Seed display (fixed to camera)
    this.add.text(8, 8, `Seed: ${this.worldData.seed}`, {
      fontSize: '12px',
      color: '#666666',
      fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(100)

    this.add.text(8, 24, 'WASD:Move Space:Jump LMB:Mine/Attack RMB:Place C:Craft Q:Use F:Summon ESC:Pause', {
      fontSize: '11px',
      color: '#444444',
      fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(100)

    // Disable right-click context menu so RMB works for placement
    this.input.mouse!.disableContextMenu()

    // ESC opens pause menu (when crafting is not open)
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => {
      if (this.player.craftingOpen) return // ESC closes crafting first
      this.scene.pause('WorldScene')
      this.scene.pause('UIScene')
      this.scene.launch('MenuScene', { pause: true })
    })

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

    // Update combat
    const playerHit = this.combat.update(
      dt, this.chunkManager, this.enemies,
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
          this.player.inventory.addItem(drop.itemId, drop.count)
        }
        if (enemy.sprite.active) enemy.sprite.destroy()
        this.enemies.splice(i, 1)
      }
    }

    // Check if player has assembled the jetpack
    this.checkJetpack()

    this.chunkManager.update()
  }

  private checkJetpack() {
    if (this.player.hasJetpack) {
      // Check if player has reached the sky (top of world)
      if (this.player.sprite.y < 32) {
        // Trigger ending!
        this.scene.stop('UIScene')
        this.scene.start('EndingScene')
        return
      }
      return
    }

    // Check if player has jetpack item in inventory
    if (this.player.inventory.getCount(186) > 0) {
      this.player.hasJetpack = true

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

    // Check if this item summons a boss
    // F key to summon boss
    const keyF = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F)
    if (!Phaser.Input.Keyboard.JustDown(keyF)) return

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
