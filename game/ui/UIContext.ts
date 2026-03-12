import type Phaser from 'phaser'
import type { InventoryManager } from '../systems/InventoryManager'

export interface UIContext {
  player: any
  inv: InventoryManager
  pointer: Phaser.Input.Pointer
  pointerJustDown: boolean
}

export const SLOT_SIZE = 40
export const SLOT_GAP = 4

export function getItemTexKey(itemId: number): string {
  return itemId < 100 ? `tile_${itemId}` : `item_${itemId}`
}
