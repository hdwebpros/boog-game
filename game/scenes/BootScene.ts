import Phaser from 'phaser'
import { WorldGenerator } from '../world/WorldGenerator'
import { SaveManager, parseSaveTiles } from '../systems/SaveManager'
import { generateAllSprites } from '../assets/SpriteGenerator'
import { AudioManager } from '../systems/AudioManager'
import { WORLD_WIDTH, WORLD_HEIGHT } from '../world/TileRegistry'
import { NetworkManager, type JoinAccepted } from '../multiplayer'
import { generateVoidWorld } from '../world/VoidWorldGenerator'

export class BootScene extends Phaser.Scene {
  private barFill!: Phaser.GameObjects.Rectangle
  private statusText!: Phaser.GameObjects.Text
  private progressLabel!: Phaser.GameObjects.Text

  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {
    // Load PixelLab-generated tile PNGs (take priority over procedural sprites)
    for (let i = 1; i <= 19; i++) {
      this.load.image(`tile_${i}`, `/sprites/tile_${i}.png`)
    }
    this.load.image('tile_36', '/sprites/tile_36.png')
    this.load.image('tile_42', '/sprites/tile_42.png')
    this.load.image('tile_48', '/sprites/tile_48.png')

    // Load player frame PNGs directly (all 32x64 or 48x64)
    const playerFrames = ['idle1', 'idle2', 'walk1', 'walk2', 'walk3', 'walk4']
    for (const f of playerFrames) {
      this.load.image(`player_${f}`, `/sprites/player_${f}.png`)
    }
    // Action frames (48x64)
    this.load.image('player_mine1', '/sprites/player_mine1.png')
    this.load.image('player_mine2', '/sprites/player_mine2.png')
    this.load.image('player_attack1', '/sprites/player_attack1.png')
    this.load.image('player_attack2', '/sprites/player_attack2.png')

    // Load enemy PNGs
    const enemies = ['space_slug', 'cave_bat', 'rock_golem', 'anglerfish', 'lava_serpent', 'corrupted_drone', 'vampire']
    for (const e of enemies) {
      this.load.image(`enemy_${e}`, `/sprites/enemy_${e}.png`)
    }

    // Load boss PNGs
    const bosses = ['vine_guardian', 'deep_sea_leviathan', 'crystal_golem', 'magma_wyrm', 'core_sentinel', 'mothership']
    for (const b of bosses) {
      this.load.image(`boss_${b}`, `/sprites/boss_${b}.png`)
    }

    // Load projectile & summon PNGs (proj_arrow skipped — PNG is too dark, use procedural)
    this.load.image('proj_magic', '/sprites/proj_magic.png')
    this.load.image('proj_enemy', '/sprites/proj_enemy.png')
    this.load.image('summon_minion', '/sprites/summon_minion.png')

    // Load all item PNGs (materials, tools, weapons, armor, accessories, potions, etc.)
    const itemPngs = [
      // Stations, materials, misc
      100, 101, 102, 103, 104, 105, 106,
      110, 111, 112, 113, 114, 115, 116, 117, 118,
      // Tools
      120, 121, 122, 123, 124,
      // Weapons
      130, 131, 132, 133, 134,
      140, 141, 142,
      150, 151,
      160, 161,
      // Boss summons & jetpack components
      170, 171, 172, 173, 174, 175,
      180, 181, 182, 183, 184, 185, 186,
      // Consumables
      190, 191, 192, 193,
      // Armor
      200, 201, 202, 203, 204, 205, 206, 207,
      208, 209, 210, 211, 212, 213, 214, 215,
      216, 217, 218, 219,
      // Shards & enchanting
      230, 231, 232, 233, 234, 235, 236,
      237, 238, 239, 240, 241, 242, 243,
      // Currency & accessories
      250, 300, 301, 302, 303, 304, 305, 306,
      // Decorations
      310, 311, 312, 313,
      // Void items
      320, 321,
      330, 331, 332, 333, 334, 335, 336, 337,
      340, 341, 342, 343,
      350, 351, 352, 353, 354, 355,
      360, 361, 362, 363, 364, 365,
      370, 380,
      385, 386, 387, 388, 389,
      // Potions
      400, 401, 402, 403, 404, 405, 406, 407,
      408, 409, 410, 411, 412, 413, 414, 415,
    ]
    for (const id of itemPngs) {
      this.load.image(`item_${id}`, `/sprites/item_${id}.png`)
    }

    // Load void dimension tile PNGs (49-60)
    for (let i = 49; i <= 60; i++) {
      this.load.image(`tile_${i}`, `/sprites/tile_${i}.png`)
    }

    // Load void dimension enemy PNGs
    const voidEnemies = [
      'void_wraith', 'shadow_stalker', 'hellfire_imp', 'nether_golem',
      'soul_eater', 'void_serpent', 'chaos_elemental', 'dark_knight',
    ]
    for (const e of voidEnemies) {
      this.load.image(`enemy_${e}`, `/sprites/enemy_${e}.png`)
    }

    // Load Void Lord boss PNG
    this.load.image('boss_void_lord', '/sprites/boss_void_lord.png')
  }

  create() {
    const { width, height } = this.scale

    // Background
    this.cameras.main.setBackgroundColor(0x0a0a1a)

    // Stars (twinkling)
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      const size = Math.random() < 0.1 ? 3 : Math.random() < 0.3 ? 2 : 1
      const alpha = Math.random() * 0.4 + 0.1
      const star = this.add.rectangle(x, y, size, size, 0xffffff, alpha)
      this.tweens.add({
        targets: star,
        alpha: { from: alpha, to: alpha * 0.2 },
        duration: 800 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
      })
    }

    // Title
    this.add.text(width / 2, height / 2 - 60, 'STARFALL', {
      fontSize: '28px',
      color: '#00ffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#003333',
      strokeThickness: 3,
    }).setOrigin(0.5)

    // Status text
    this.statusText = this.add.text(width / 2, height / 2 - 10, 'Initializing...', {
      fontSize: '14px',
      color: '#888888',
      fontFamily: 'monospace',
    }).setOrigin(0.5)

    // Progress bar background
    this.add.rectangle(width / 2, height / 2 + 25, 304, 24, 0x222233).setOrigin(0.5)
    this.add.rectangle(width / 2, height / 2 + 25, 300, 20, 0x111122).setOrigin(0.5)

    // Progress bar fill
    this.barFill = this.add.rectangle(
      width / 2 - 148, height / 2 + 25, 0, 16, 0x00ffff
    ).setOrigin(0, 0.5)

    // Percentage label
    this.progressLabel = this.add.text(width / 2, height / 2 + 25, '0%', {
      fontSize: '11px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5)

    // Start async loading pipeline
    this.time.delayedCall(50, () => this.runLoadingPipeline())
  }

  private async runLoadingPipeline() {
    const steps: { label: string; weight: number; fn: () => void | Promise<void> }[] = []

    // Step 1: Generate tile/enemy/boss sprites
    steps.push({
      label: 'Generating sprites...',
      weight: 15,
      fn: () => generateAllSprites(this),
    })

    // Step 2: Generate sound effects
    steps.push({
      label: 'Generating sounds...',
      weight: 5,
      fn: () => { AudioManager.init() },
    })

    // Step 3: Create fallback placeholder if PNGs failed to load
    steps.push({
      label: 'Creating textures...',
      weight: 5,
      fn: () => this.createPlaceholderTextures(),
    })

    // Step 4: Load/generate world (or connect as client)
    const mpMode = this.registry.get('mpMode') as string | undefined
    const loadSlotId = this.registry.get('loadSlotId') as string | undefined

    if (mpMode === 'client') {
      // Client path: connect to host, receive world seed, generate terrain, apply deltas
      steps.push({
        label: 'Connecting to host...',
        weight: 60,
        fn: async () => {
          const roomCode = this.registry.get('mpRoomCode') as string
          const playerName = (this.registry.get('mpPlayerName') as string | undefined) ?? 'Player'
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
          const url = `${protocol}//${window.location.host}/_ws`

          const network = new NetworkManager()
          let joinData: JoinAccepted
          try {
            joinData = await network.connect(url, playerName, roomCode)
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Connection failed'
            this.statusText.setText(`Error: ${msg}`)
            this.statusText.setColor('#ff4444')
            // Wait a moment so the user can read the error, then return to menu
            await new Promise<void>(resolve => this.time.delayedCall(2500, resolve))
            this.registry.remove('mpMode')
            this.registry.remove('mpRoomCode')
            this.registry.remove('mpPlayerName')
            this.scene.start('MenuScene', { pause: false })
            return
          }

          // Generate world from the host's seed
          const generator = new WorldGenerator(joinData.seed)
          const worldData = generator.generate()

          // Apply tile deltas from host
          for (const tc of joinData.tileChanges) {
            worldData.tiles[tc.ty * worldData.width + tc.tx] = tc.newType
          }

          this.registry.set('worldData', worldData)
          this.registry.set('mpNetwork', network)
          this.registry.set('mpJoinData', joinData)
          this.registry.remove('saveData')
        },
      })
    } else if (loadSlotId) {
      steps.push({
        label: 'Loading saved world...',
        weight: 60,
        fn: async () => {
          const saveData = await SaveManager.load(loadSlotId)
          if (!saveData) return
          const tiles = parseSaveTiles(saveData.tiles)
          const { altars, runestones } = WorldGenerator.computeAltarsAndRunestones(saveData.seed, tiles)
          const worldData = {
            tiles,
            width: WORLD_WIDTH,
            height: WORLD_HEIGHT,
            seed: saveData.seed,
            spawnX: Math.floor(saveData.playerX / 16),
            spawnY: Math.floor(saveData.playerY / 16),
            surfaceBiomes: WorldGenerator.computeSurfaceBiomes(saveData.seed),
            altars,
            runestones,
          }
          this.registry.set('worldData', worldData)
          this.registry.set('saveData', saveData)
          // Pass slot info so WorldScene knows which slot to auto-save to
          this.registry.set('loadSlotId', loadSlotId)
          this.registry.set('loadSlotName', saveData.name)
        },
      })
    } else if (this.registry.get('voidDimension')) {
      steps.push({
        label: 'Generating void dimension...',
        weight: 60,
        fn: () => {
          const seedStr = this.registry.get('worldSeed') as string | undefined
          // Convert string seed to number for void world generator
          const numSeed = seedStr ? parseInt(seedStr, 36) || Date.now() : Date.now()
          const voidData = generateVoidWorld(numSeed)
          // Wrap as WorldData-compatible format
          const worldData = {
            tiles: voidData.tiles,
            width: voidData.width,
            height: voidData.height,
            seed: seedStr ?? String(numSeed),
            spawnX: voidData.spawnX,
            spawnY: voidData.spawnY,
            altars: [] as any[],
            runestones: [] as any[],
          }
          this.registry.set('worldData', worldData)
          this.registry.set('voidDimension', true)
          this.registry.remove('saveData')
          // Clear loadSlotId so void dimension doesn't auto-save over the original world
          this.registry.remove('loadSlotId')
          this.registry.remove('loadSlotName')
        },
      })
    } else {
      steps.push({
        label: 'Generating terrain...',
        weight: 60,
        fn: () => {
          const seed = this.registry.get('worldSeed') as string | undefined
          const generator = new WorldGenerator(seed)
          const worldData = generator.generate()
          this.registry.set('worldData', worldData)
          this.registry.remove('saveData')
        },
      })
    }

    // Execute steps with yields between each
    const totalWeight = steps.reduce((s, st) => s + st.weight, 0)
    let completedWeight = 0
    let aborted = false

    for (const step of steps) {
      this.statusText.setText(step.label)
      // Let the UI repaint before doing work
      await this.yieldFrame()
      await step.fn()
      // If the step navigated away (e.g. connection error), stop processing
      if (!this.scene.isActive()) { aborted = true; break }
      completedWeight += step.weight
      this.setProgress(completedWeight / totalWeight)
      await this.yieldFrame()
    }

    if (aborted) return

    // Transition immediately — WorldScene chunks load progressively
    this.statusText.setText('Ready!')
    this.setProgress(1)
    this.scene.start('WorldScene')
  }

  private setProgress(value: number) {
    const clamped = Math.min(1, Math.max(0, value))
    this.barFill.width = 296 * clamped
    this.progressLabel.setText(`${Math.round(clamped * 100)}%`)
  }

  private yieldFrame(): Promise<void> {
    return new Promise((resolve) => {
      this.time.delayedCall(16, resolve)
    })
  }

  private createPlaceholderTextures() {
    // Fallback texture if PNGs failed to load
    if (!this.textures.exists('player')) {
      const playerGfx = this.add.graphics()
      playerGfx.fillStyle(0x00ffff)
      playerGfx.fillRect(0, 0, 32, 64)
      playerGfx.generateTexture('player', 32, 64)
      playerGfx.destroy()
    }
  }
}
