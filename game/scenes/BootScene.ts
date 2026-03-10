import Phaser from 'phaser'
import { WorldGenerator } from '../world/WorldGenerator'
import { SaveManager } from '../systems/SaveManager'
import { generateAllSprites } from '../assets/SpriteGenerator'
import { AudioManager } from '../systems/AudioManager'

export class BootScene extends Phaser.Scene {
  private barFill!: Phaser.GameObjects.Rectangle
  private statusText!: Phaser.GameObjects.Text
  private progressLabel!: Phaser.GameObjects.Text

  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {
    // Load PixelLab-generated tile PNGs (take priority over procedural sprites)
    for (let i = 1; i <= 13; i++) {
      this.load.image(`tile_${i}`, `/sprites/tile_${i}.png`)
    }

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
    const enemies = ['space_slug', 'cave_bat', 'rock_golem', 'anglerfish', 'lava_serpent', 'corrupted_drone']
    for (const e of enemies) {
      this.load.image(`enemy_${e}`, `/sprites/enemy_${e}.png`)
    }

    // Load boss PNGs
    const bosses = ['vine_guardian', 'deep_sea_leviathan', 'crystal_golem', 'magma_wyrm', 'core_sentinel', 'mothership']
    for (const b of bosses) {
      this.load.image(`boss_${b}`, `/sprites/boss_${b}.png`)
    }

    // Load projectile & summon PNGs
    this.load.image('proj_arrow', '/sprites/proj_arrow.png')
    this.load.image('proj_magic', '/sprites/proj_magic.png')
    this.load.image('proj_enemy', '/sprites/proj_enemy.png')
    this.load.image('summon_minion', '/sprites/summon_minion.png')
  }

  create() {
    const { width, height } = this.scale

    // Background
    this.cameras.main.setBackgroundColor(0x0a0a1a)

    // Stars
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      this.add.rectangle(x, y, 2, 2, 0xffffff, Math.random() * 0.4 + 0.1)
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
    const steps: { label: string; weight: number; fn: () => void }[] = []

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
      fn: () => AudioManager.init(),
    })

    // Step 3: Create fallback placeholder if PNGs failed to load
    steps.push({
      label: 'Creating textures...',
      weight: 5,
      fn: () => this.createPlaceholderTextures(),
    })

    // Step 3: Load or generate world (the heavy part)
    const loadSave = this.registry.get('loadSave') as boolean | undefined
    this.registry.remove('loadSave')

    if (loadSave) {
      const saveData = SaveManager.load()
      if (saveData) {
        steps.push({
          label: 'Loading saved world...',
          weight: 60,
          fn: () => {
            const worldData = {
              tiles: new Uint8Array(saveData.tiles),
              width: 4000,
              height: 1200,
              seed: saveData.seed,
              spawnX: Math.floor(saveData.playerX / 16),
              spawnY: Math.floor(saveData.playerY / 16),
            }
            this.registry.set('worldData', worldData)
            this.registry.set('saveData', saveData)
          },
        })
      }
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

    for (const step of steps) {
      this.statusText.setText(step.label)
      // Let the UI repaint before doing work
      await this.yieldFrame()
      step.fn()
      completedWeight += step.weight
      this.setProgress(completedWeight / totalWeight)
      await this.yieldFrame()
    }

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
