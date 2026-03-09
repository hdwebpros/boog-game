import type { WorldData } from '../world/WorldGenerator'
import type { ItemStack } from './InventoryManager'
import type { PlacedStation } from '../world/ChunkManager'

const SAVE_KEY = 'starfall_save'

export interface SaveData {
  version: 1
  seed: string
  tiles: number[] // compressed from Uint8Array
  playerX: number
  playerY: number
  hp: number
  mana: number
  hotbar: (ItemStack | null)[]
  selectedSlot: number
  placedStations: PlacedStation[]
  hasJetpack: boolean
  timestamp: number
}

export class SaveManager {
  static save(
    worldData: WorldData,
    playerX: number, playerY: number,
    hp: number, mana: number,
    hotbar: (ItemStack | null)[],
    selectedSlot: number,
    placedStations: PlacedStation[],
    hasJetpack: boolean
  ): boolean {
    try {
      const data: SaveData = {
        version: 1,
        seed: worldData.seed,
        tiles: Array.from(worldData.tiles),
        playerX,
        playerY,
        hp,
        mana,
        hotbar,
        selectedSlot,
        placedStations,
        hasJetpack,
        timestamp: Date.now(),
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify(data))
      return true
    } catch {
      console.error('Failed to save game')
      return false
    }
  }

  static load(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return null
      const data = JSON.parse(raw) as SaveData
      if (data.version !== 1) return null
      return data
    } catch {
      return null
    }
  }

  static hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null
  }

  static deleteSave() {
    localStorage.removeItem(SAVE_KEY)
  }
}
