export interface ItemStack {
  id: number
  count: number
}

const MAX_STACK = 99
const HOTBAR_SIZE = 10

export class InventoryManager {
  hotbar: (ItemStack | null)[] = new Array(HOTBAR_SIZE).fill(null)
  selectedSlot = 0

  /** Add item to hotbar. Returns true if added, false if full. */
  addItem(id: number, count = 1): boolean {
    // Try stacking with existing matching slots
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = this.hotbar[i]
      if (slot && slot.id === id && slot.count < MAX_STACK) {
        const canAdd = Math.min(count, MAX_STACK - slot.count)
        slot.count += canAdd
        count -= canAdd
        if (count === 0) return true
      }
    }

    // Put remainder in first empty slot
    while (count > 0) {
      const emptyIdx = this.hotbar.indexOf(null)
      if (emptyIdx === -1) return false // full
      const toAdd = Math.min(count, MAX_STACK)
      this.hotbar[emptyIdx] = { id, count: toAdd }
      count -= toAdd
    }

    return true
  }

  getSelectedItem(): ItemStack | null {
    return this.hotbar[this.selectedSlot] ?? null
  }

  /** Consume count items from selected slot. Returns true if successful. */
  consumeSelected(count = 1): boolean {
    const item = this.hotbar[this.selectedSlot]
    if (!item || item.count < count) return false
    item.count -= count
    if (item.count <= 0) this.hotbar[this.selectedSlot] = null
    return true
  }

  getCount(id: number): number {
    let total = 0
    for (const slot of this.hotbar) {
      if (slot && slot.id === id) total += slot.count
    }
    return total
  }
}
