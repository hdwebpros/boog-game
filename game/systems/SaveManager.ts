import type { WorldData } from '../world/WorldGenerator'
import type { ItemStack, ArmorSlots } from './InventoryManager'
import type { PlacedStation, ChestData, PortalData } from '../world/ChunkManager'
import type { Waypoint } from '../ui/WorldMapPanel'
import { WORLD_WIDTH, WORLD_HEIGHT } from '../world/TileRegistry'

type NpcPosition = { tx: number; ty: number }

const INDEX_KEY = 'starfall_save_index'
const DB_NAME = 'starfall'
const DB_STORE = 'saves'
const DB_VERSION = 1

// ── IndexedDB helper ─────────────────────────────────────
let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(DB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function idbGet<T>(key: string): Promise<T | undefined> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly')
    const req = tx.objectStore(DB_STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  }))
}

function idbPut(key: string, value: unknown): Promise<void> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite')
    const req = tx.objectStore(DB_STORE).put(value, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  }))
}

function idbDelete(key: string): Promise<void> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite')
    const req = tx.objectStore(DB_STORE).delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  }))
}

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
  paragonPoints?: Record<string, number>
  paragonLevel?: number
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
  discoveredItems?: number[]
  waypoints?: Waypoint[]
  portals?: PortalData[]
  discoveredPOIs?: string[]
  activeBuffs?: { type: string; remaining: number; duration: number }[]
  hasVisitedVoid?: boolean
  hasCompletedGame?: boolean
  timestamp: number
}

export class SaveManager {
  static async save(
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
    chestInventories?: ChestData[],
    discoveredItems?: number[],
    waypoints?: Waypoint[],
    portals?: PortalData[],
    discoveredPOIs?: string[],
    activeBuffs?: { type: string; remaining: number; duration: number }[],
    hasVisitedVoid?: boolean,
    hasCompletedGame?: boolean
  ): Promise<boolean> {
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
        discoveredItems,
        waypoints,
        portals,
        discoveredPOIs,
        activeBuffs,
        hasVisitedVoid,
        hasCompletedGame,
        timestamp,
      }
      await idbPut(slotId, data)

      // Update index (small — stays in localStorage)
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

  static async load(slotId: string): Promise<SaveData | null> {
    try {
      // Try IndexedDB first, fall back to localStorage for old saves
      const data = await idbGet<SaveData>(slotId)
      if (data && data.version === 1) return data

      const raw = localStorage.getItem('starfall_save_' + slotId)
      if (!raw) return null
      const parsed = JSON.parse(raw) as SaveData
      if (parsed.version !== 1) return null
      return parsed
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

  static async deleteSave(slotId: string) {
    await idbDelete(slotId).catch(() => {})
    localStorage.removeItem('starfall_save_' + slotId)
    const index = this.getIndex().filter(s => s.id !== slotId)
    localStorage.setItem(INDEX_KEY, JSON.stringify(index))
  }

  static generateSlotId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  }

  /** Download a save slot as a JSON file */
  static async exportSave(slotId: string) {
    const data = await this.load(slotId)
    if (!data) return
    const json = JSON.stringify(data)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `starfall_${data.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  /** Import a save from a JSON file, returns the new slot info or null */
  static async importSave(): Promise<SaveSlotInfo | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) { resolve(null); return }
        try {
          const text = await file.text()
          const data = JSON.parse(text) as SaveData
          if (data.version !== 1) { resolve(null); return }
          const slotId = this.generateSlotId()
          const name = data.name || 'Imported Save'
          data.name = name
          data.timestamp = Date.now()
          await idbPut(slotId, data)
          const index = this.getIndex()
          const info: SaveSlotInfo = { id: slotId, name, timestamp: data.timestamp }
          index.push(info)
          localStorage.setItem(INDEX_KEY, JSON.stringify(index))
          resolve(info)
        } catch {
          resolve(null)
        }
      }
      input.click()
    })
  }

  // Migrate old saves (localStorage → IndexedDB)
  static async migrateOldSave() {
    // Migrate single-slot legacy save
    const OLD_KEY = 'starfall_save'
    const raw = localStorage.getItem(OLD_KEY)
    if (raw) {
      try {
        const data = JSON.parse(raw) as SaveData
        if (data.version === 1) {
          const slotId = this.generateSlotId()
          const name = 'Migrated Save'
          data.name = name
          await idbPut(slotId, data)
          const index = this.getIndex()
          index.push({ id: slotId, name, timestamp: data.timestamp })
          localStorage.setItem(INDEX_KEY, JSON.stringify(index))
          localStorage.removeItem(OLD_KEY)
        }
      } catch {
        // ignore migration errors
      }
    }

    // Migrate multi-slot localStorage saves to IndexedDB
    const index = this.getIndex()
    for (const slot of index) {
      const key = 'starfall_save_' + slot.id
      const slotRaw = localStorage.getItem(key)
      if (slotRaw) {
        try {
          const data = JSON.parse(slotRaw) as SaveData
          await idbPut(slot.id, data)
          localStorage.removeItem(key)
        } catch {
          // ignore per-slot migration errors
        }
      }
    }
  }
}
