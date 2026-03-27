import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { WorldScene } from './scenes/WorldScene'
import { UIScene } from './scenes/UIScene'
import { MenuScene } from './scenes/MenuScene'
import { EndingScene } from './scenes/EndingScene'
import { IntroCutsceneScene } from './scenes/IntroCutsceneScene'
import { VoidCutsceneScene } from './scenes/VoidCutsceneScene'
import { TrueEndingScene } from './scenes/TrueEndingScene'

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent,
    pixelArt: true,
    backgroundColor: '#1a1a2e',
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 800 },
        debug: false,
      },
    },
    scene: [MenuScene, BootScene, IntroCutsceneScene, WorldScene, UIScene, EndingScene, VoidCutsceneScene, TrueEndingScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: false,
      roundPixels: true,
    },
  }
}
