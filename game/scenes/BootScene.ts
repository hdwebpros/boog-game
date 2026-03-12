import Phaser from 'phaser'
import { WorldGenerator } from '../world/WorldGenerator'
import { SaveManager, parseSaveTiles } from '../systems/SaveManager'
import { generateAllSprites } from '../assets/SpriteGenerator'
import { AudioManager } from '../systems/AudioManager'
import { WORLD_WIDTH, WORLD_HEIGHT } from '../world/TileRegistry'
import { NetworkManager, type JoinAccepted } from '../multiplayer'

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
    this.load.image('tile_42', '/sprites/tile_42.png')

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

    // Load accessory & coin item PNGs
    const itemPngs = [116, 250, 300, 301, 302, 303, 304, 305]
    for (const id of itemPngs) {
      this.load.image(`item_${id}`, `/sprites/item_${id}.png`)
    }
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
          const worldData = {
            tiles: parseSaveTiles(saveData.tiles),
            width: WORLD_WIDTH,
            height: WORLD_HEIGHT,
            seed: saveData.seed,
            spawnX: Math.floor(saveData.playerX / 16),
            spawnY: Math.floor(saveData.playerY / 16),
            surfaceBiomes: WorldGenerator.computeSurfaceBiomes(saveData.seed),
          }
          this.registry.set('worldData', worldData)
          this.registry.set('saveData', saveData)
          // Pass slot info so WorldScene knows which slot to auto-save to
          this.registry.set('loadSlotId', loadSlotId)
          this.registry.set('loadSlotName', saveData.name)
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
