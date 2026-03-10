import type { WorldData } from '../world/WorldGenerator'
import type { ItemStack, ArmorSlots } from './InventoryManager'
import type { PlacedStation } from '../world/ChunkManager'

const INDEX_KEY = 'starfall_save_index'
const SLOT_PREFIX = 'starfall_save_'

export interface SkillSaveData {
  xp: number
  level: number
  skillPoints: number
  unlockedSkills: string[]
}

export interface SaveSlotInfo {
  id: string
  name: string
  timestamp: number
}

export interface SaveData {
  version: 1
  name: string
  seed: string
  tiles: number[] // compressed from Uint8Array
  playerX: number
  playerY: number
  hp: number
  mana: number
  hotbar: (ItemStack | null)[]
  mainInventory?: (ItemStack | null)[]
  selectedSlot: number
  placedStations: PlacedStation[]
  hasJetpack: boolean
  hasRebreather?: boolean
  armorSlots?: ArmorSlots
  skills?: SkillSaveData
  dayNightTime?: number
  timestamp: number
}

export class SaveManager {
  static save(
    slotId: string,
    name: string,
    worldData: WorldData,
    playerX: number, playerY: number,
    hp: number, mana: number,
    hotbar: (ItemStack | null)[],
    mainInventory: (ItemStack | null)[],
    selectedSlot: number,
    placedStations: PlacedStation[],
    hasJetpack: boolean,
    hasRebreather?: boolean,
    armorSlots?: ArmorSlots,
    skills?: SkillSaveData,
    dayNightTime?: number
  ): boolean {
    try {
      const timestamp = Date.now()
      const data: SaveData = {
        version: 1,
        name,
        seed: worldData.seed,
        tiles: Array.from(worldData.tiles),
        playerX,
        playerY,
        hp,
        mana,
        hotbar,
        mainInventory,
        selectedSlot,
        placedStations,
        hasJetpack,
        hasRebreather,
        armorSlots,
        skills,
        dayNightTime,
        timestamp,
      }
      localStorage.setItem(SLOT_PREFIX + slotId, JSON.stringify(data))

      // Update index
      const index = this.getIndex()
      const existing = index.findIndex(s => s.id === slotId)
      const info: SaveSlotInfo = { id: slotId, name, timestamp }
      if (existing >= 0) {
        index[existing] = info
      } else {
        index.push(info)
      }
      localStorage.setItem(INDEX_KEY, JSON.stringify(index))
      return true
    } catch {
      console.error('Failed to save game')
      return false
    }
  }

  static load(slotId: string): SaveData | null {
    try {
      const raw = localStorage.getItem(SLOT_PREFIX + slotId)
      if (!raw) return null
      const data = JSON.parse(raw) as SaveData
      if (data.version !== 1) return null
      return data
    } catch {
      return null
    }
  }

  static getIndex(): SaveSlotInfo[] {
    try {
      const raw = localStorage.getItem(INDEX_KEY)
      if (!raw) return []
      return JSON.parse(raw) as SaveSlotInfo[]
    } catch {
      return []
    }
  }

  static hasSaves(): boolean {
    return this.getIndex().length > 0
  }

  static deleteSave(slotId: string) {
    localStorage.removeItem(SLOT_PREFIX + slotId)
    const index = this.getIndex().filter(s => s.id !== slotId)
    localStorage.setItem(INDEX_KEY, JSON.stringify(index))
  }

  static generateSlotId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  }

  // Migrate old single-save format to new multi-slot format
  static migrateOldSave() {
    const OLD_KEY = 'starfall_save'
    const raw = localStorage.getItem(OLD_KEY)
    if (!raw) return
    try {
      const data = JSON.parse(raw) as SaveData
      if (data.version !== 1) return
      const slotId = this.generateSlotId()
      const name = 'Migrated Save'
      data.name = name
      localStorage.setItem(SLOT_PREFIX + slotId, JSON.stringify(data))
      const index = this.getIndex()
      index.push({ id: slotId, name, timestamp: data.timestamp })
      localStorage.setItem(INDEX_KEY, JSON.stringify(index))
      localStorage.removeItem(OLD_KEY)
    } catch {
      // ignore migration errors
    }
  }
}
