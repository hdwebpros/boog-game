import Phaser from 'phaser'
import { WorldGenerator } from '../world/WorldGenerator'
import { SaveManager } from '../systems/SaveManager'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {
    const { width, height } = this.scale
    this.add.text(width / 2, height / 2, 'Generating world...', {
      fontSize: '24px',
      color: '#00ffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5)

    const barBg = this.add.rectangle(width / 2, height / 2 + 50, 300, 20, 0x333333).setOrigin(0.5)
    const barFill = this.add.rectangle(width / 2 - 148, height / 2 + 50, 0, 16, 0x00ffff).setOrigin(0, 0.5)

    this.load.on('progress', (value: number) => {
      barFill.width = 296 * value
    })
  }

  create() {
    this.createPlaceholderTextures()

    // Check if loading from save
    const loadSave = this.registry.get('loadSave') as boolean | undefined
    this.registry.remove('loadSave')

    if (loadSave) {
      const saveData = SaveManager.load()
      if (saveData) {
        // Reconstruct world from save
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
        this.scene.start('WorldScene')
        return
      }
    }

    // Generate new world
    const seed = this.registry.get('worldSeed') as string | undefined
    const generator = new WorldGenerator(seed)
    const worldData = generator.generate()
    this.registry.set('worldData', worldData)
    this.registry.remove('saveData')

    this.scene.start('WorldScene')
  }

  private createPlaceholderTextures() {
    const playerGfx = this.add.graphics()
    playerGfx.fillStyle(0x00ffff)
    playerGfx.fillRect(0, 0, 16, 32)
    playerGfx.generateTexture('player', 16, 32)
    playerGfx.destroy()
  }
}
