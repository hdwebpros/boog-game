import type { WorldData } from '../world/WorldGenerator'
import type { ItemStack, ArmorSlots } from './InventoryManager'
import type { PlacedStation, ChestData } from '../world/ChunkManager'
import { WORLD_WIDTH, WORLD_HEIGHT } from '../world/TileRegistry'

type NpcPosition = { tx: number; ty: number }

const INDEX_KEY = 'starfall_save_index'
const SLOT_PREFIX = 'starfall_save_'

// ── Tile compression (RLE + base64) ─────────────────────
// Format: [value, countHigh, countLow] triplets, base64-encoded

function compressTiles(tiles: Uint8Array): string {
  const runs: number[] = []
  let i = 0
  while (i < tiles.length) {
    const val = tiles[i]!
    let count = 1
    while (i + count < tiles.length && tiles[i + count] === val && count < 65535) {
      count++
    }
    runs.push(val, (count >> 8) & 0xFF, count & 0xFF)
    i += count
  }
  const bytes = new Uint8Array(runs)
  let binary = ''
  const chunk = 8192
  for (let j = 0; j < bytes.length; j += chunk) {
    binary += String.fromCharCode(...bytes.subarray(j, Math.min(j + chunk, bytes.length)))
  }
  return btoa(binary)
}

function decompressTiles(compressed: string, totalSize: number): Uint8Array {
  const binary = atob(compressed)
  const bytes = new Uint8Array(binary.length)
  for (let k = 0; k < binary.length; k++) {
    bytes[k] = binary.charCodeAt(k)
  }
  const tiles = new Uint8Array(totalSize)
  let pos = 0
  for (let i = 0; i < bytes.length; i += 3) {
    const val = bytes[i]!
    const count = (bytes[i + 1]! << 8) | bytes[i + 2]!
    tiles.fill(val, pos, pos + count)
    pos += count
  }
  return tiles
}

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

/** Parse tiles from save data — handles both compressed (string) and legacy (number[]) formats */
export function parseSaveTiles(tiles: number[] | string): Uint8Array {
  if (typeof tiles === 'string') {
    return decompressTiles(tiles, WORLD_WIDTH * WORLD_HEIGHT)
  }
  return new Uint8Array(tiles)
}

export interface SaveData {
  version: 1
  name: string
  seed: string
  tiles: number[] | string // string = RLE+base64 compressed, number[] = legacy
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
  exploredMap?: number[]
  discoveredAltars?: string[]
  usedRunestones?: string[]
  accessorySlots?: (ItemStack | null)[]
  npcShopPosition?: NpcPosition
  chestInventories?: ChestData[]
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
    dayNightTime?: number,
    exploredMap?: number[],
    discoveredAltars?: string[],
    usedRunestones?: string[],
    accessorySlots?: (ItemStack | null)[],
    npcShopPosition?: NpcPosition,
    chestInventories?: ChestData[]
  ): boolean {
    try {
      const timestamp = Date.now()
      const data: SaveData = {
        version: 1,
        name,
        seed: worldData.seed,
        tiles: compressTiles(worldData.tiles),
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
        exploredMap,
        discoveredAltars,
        usedRunestones,
        accessorySlots,
        npcShopPosition,
        chestInventories,
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
    } catch (e) {
      console.error('Failed to save game:', e)
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
