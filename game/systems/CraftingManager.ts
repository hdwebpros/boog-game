import type { Recipe } from '../data/recipes'
import { RECIPES, StationType, STATION_ITEM_MAP } from '../data/recipes'
import { InventoryManager } from './InventoryManager'
import { ChunkManager } from '../world/ChunkManager'
import { TILE_SIZE } from '../world/TileRegistry'

const STATION_RANGE = 3 // tiles

export class CraftingManager {
  /** Get available recipes based on nearby stations */
  getAvailableRecipes(
    playerX: number, playerY: number,
    chunks: ChunkManager
  ): { recipe: Recipe; canCraft: boolean }[] {
    const nearbyStations = this.findNearbyStations(playerX, playerY, chunks)

    // Always have HAND access
    nearbyStations.add(StationType.HAND)

    const results: { recipe: Recipe; canCraft: boolean }[] = []

    for (const recipe of RECIPES) {
      if (nearbyStations.has(recipe.station)) {
        results.push({ recipe, canCraft: false }) // canCraft set later per inventory
      }
    }

    return results
  }

  /** Check which recipes can be crafted with current inventory */
  checkCraftable(
    recipes: { recipe: Recipe; canCraft: boolean }[],
    inventory: InventoryManager
  ) {
    for (const entry of recipes) {
      entry.canCraft = this.hasIngredients(entry.recipe, inventory)
    }
  }

  /** Craft a recipe: consume inputs, produce output */
  craft(recipe: Recipe, inventory: InventoryManager): boolean {
    if (!this.hasIngredients(recipe, inventory)) return false

    // Consume inputs
    for (const input of recipe.inputs) {
      this.removeFromInventory(inventory, input.itemId, input.count)
    }

    // Add output
    inventory.addItem(recipe.output.itemId, recipe.output.count)
    return true
  }

  private hasIngredients(recipe: Recipe, inventory: InventoryManager): boolean {
    for (const input of recipe.inputs) {
      if (inventory.getCount(input.itemId) < input.count) return false
    }
    return true
  }

  private removeFromInventory(inventory: InventoryManager, itemId: number, count: number) {
    let remaining = count
    for (let i = 0; i < inventory.hotbar.length && remaining > 0; i++) {
      const slot = inventory.hotbar[i]
      if (slot && slot.id === itemId) {
        const take = Math.min(remaining, slot.count)
        slot.count -= take
        remaining -= take
        if (slot.count <= 0) inventory.hotbar[i] = null
      }
    }
    for (let i = 0; i < inventory.mainInventory.length && remaining > 0; i++) {
      const slot = inventory.mainInventory[i]
      if (slot && slot.id === itemId) {
        const take = Math.min(remaining, slot.count)
        slot.count -= take
        remaining -= take
        if (slot.count <= 0) inventory.mainInventory[i] = null
      }
    }
  }

  private findNearbyStations(
    px: number, py: number,
    chunks: ChunkManager
  ): Set<StationType> {
    const stations = new Set<StationType>()
    const ptx = Math.floor(px / TILE_SIZE)
    const pty = Math.floor(py / TILE_SIZE)

    for (let dy = -STATION_RANGE; dy <= STATION_RANGE; dy++) {
      for (let dx = -STATION_RANGE; dx <= STATION_RANGE; dx++) {
        const tile = chunks.getTile(ptx + dx, pty + dy)
        // Check if this tile is a placed station
        // Stations are stored as special tile types (we'll map station item IDs)
      }
    }

    // For now, also check inventory for placed stations nearby
    // We need a way to track placed stations in the world
    // Simple approach: store placed station positions in ChunkManager

    const placedStations = chunks.getPlacedStations?.() || []
    for (const station of placedStations) {
      const dist = Math.max(
        Math.abs(station.tx - ptx),
        Math.abs(station.ty - pty)
      )
      if (dist <= STATION_RANGE) {
        const stationType = STATION_ITEM_MAP[station.itemId]
        if (stationType) stations.add(stationType)
      }
    }

    return stations
  }
}
