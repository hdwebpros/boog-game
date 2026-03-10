import { getItemDef, ItemCategory } from '../data/items'
import type { ArmorSlot, EnchantmentType } from '../data/items'

export interface ItemStack {
  id: number
  count: number
  enchantment?: EnchantmentType
}

export interface ArmorSlots {
  helmet: ItemStack | null
  chestplate: ItemStack | null
  leggings: ItemStack | null
  boots: ItemStack | null
}

const DEFAULT_MAX_STACK = 99
const HOTBAR_SIZE = 10
const MAIN_INV_SIZE = 30

function maxStackFor(id: number): number {
  const def = getItemDef(id)
  return def?.stackSize ?? DEFAULT_MAX_STACK
}

export const ARMOR_SLOT_ORDER: ArmorSlot[] = ['helmet', 'chestplate', 'leggings', 'boots']

export class InventoryManager {
  hotbar: (ItemStack | null)[] = new Array(HOTBAR_SIZE).fill(null)
  mainInventory: (ItemStack | null)[] = new Array(MAIN_INV_SIZE).fill(null)
  armorSlots: ArmorSlots = { helmet: null, chestplate: null, leggings: null, boots: null }
  accessorySlots: (ItemStack | null)[] = [null, null, null]
  selectedSlot = 0
  heldItem: ItemStack | null = null

  /** Add item — tries hotbar first, then main inventory. Returns true if added. */
  addItem(id: number, count = 1): boolean {
    const cap = maxStackFor(id)
    // Try stacking with existing matching slots in hotbar
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = this.hotbar[i]
      if (slot && slot.id === id && slot.count < cap) {
        const canAdd = Math.min(count, cap - slot.count)
        slot.count += canAdd
        count -= canAdd
        if (count === 0) return true
      }
    }

    // Try stacking in main inventory
    for (let i = 0; i < MAIN_INV_SIZE; i++) {
      const slot = this.mainInventory[i]
      if (slot && slot.id === id && slot.count < cap) {
        const canAdd = Math.min(count, cap - slot.count)
        slot.count += canAdd
        count -= canAdd
        if (count === 0) return true
      }
    }

    // Put remainder in first empty slot (hotbar first, then main)
    while (count > 0) {
      const hotbarEmpty = this.hotbar.indexOf(null)
      if (hotbarEmpty !== -1) {
        const toAdd = Math.min(count, cap)
        this.hotbar[hotbarEmpty] = { id, count: toAdd }
        count -= toAdd
        continue
      }
      const mainEmpty = this.mainInventory.indexOf(null)
      if (mainEmpty !== -1) {
        const toAdd = Math.min(count, cap)
        this.mainInventory[mainEmpty] = { id, count: toAdd }
        count -= toAdd
        continue
      }
      return false // completely full
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
    for (const slot of this.mainInventory) {
      if (slot && slot.id === id) total += slot.count
    }
    return total
  }

  /** Remove a specific count of an item from inventory (hotbar first, then main). Returns true if fully removed. */
  removeItem(id: number, count: number): boolean {
    if (this.getCount(id) < count) return false
    let remaining = count
    // Remove from hotbar first
    for (let i = 0; i < this.hotbar.length && remaining > 0; i++) {
      const slot = this.hotbar[i]
      if (slot && slot.id === id) {
        const take = Math.min(remaining, slot.count)
        slot.count -= take
        remaining -= take
        if (slot.count <= 0) this.hotbar[i] = null
      }
    }
    // Then main inventory
    for (let i = 0; i < this.mainInventory.length && remaining > 0; i++) {
      const slot = this.mainInventory[i]
      if (slot && slot.id === id) {
        const take = Math.min(remaining, slot.count)
        slot.count -= take
        remaining -= take
        if (slot.count <= 0) this.mainInventory[i] = null
      }
    }
    return remaining === 0
  }

  /** Return held item to inventory when closing */
  returnHeldItem(): void {
    if (this.heldItem) {
      this.addItem(this.heldItem.id, this.heldItem.count)
      this.heldItem = null
    }
  }

  /** Left-click a slot: pick up / place / swap / stack */
  clickSlot(area: 'hotbar' | 'main', idx: number): void {
    const slots = area === 'hotbar' ? this.hotbar : this.mainInventory
    const slot = slots[idx]

    if (!this.heldItem) {
      if (slot) {
        this.heldItem = { id: slot.id, count: slot.count }
        slots[idx] = null
      }
    } else {
      if (!slot) {
        slots[idx] = { id: this.heldItem.id, count: this.heldItem.count }
        this.heldItem = null
      } else if (slot.id === this.heldItem.id) {
        const cap = maxStackFor(slot.id)
        const canAdd = Math.min(this.heldItem.count, cap - slot.count)
        slot.count += canAdd
        this.heldItem.count -= canAdd
        if (this.heldItem.count <= 0) this.heldItem = null
      } else {
        const temp = { id: slot.id, count: slot.count }
        slots[idx] = { id: this.heldItem.id, count: this.heldItem.count }
        this.heldItem = temp
      }
    }
  }

  /** Click an armor slot: equip held item or swap/unequip */
  clickArmorSlot(slot: ArmorSlot): void {
    const current = this.armorSlots[slot]

    if (!this.heldItem) {
      // Pick up equipped armor
      if (current) {
        this.heldItem = { id: current.id, count: current.count }
        this.armorSlots[slot] = null
      }
    } else {
      // Check if held item is valid armor for this slot
      const def = getItemDef(this.heldItem.id)
      if (def?.category === ItemCategory.ARMOR && def.armorSlot === slot) {
        // Swap: equip held, pick up current
        const temp = current ? { id: current.id, count: current.count } : null
        this.armorSlots[slot] = { id: this.heldItem.id, count: this.heldItem.count }
        this.heldItem = temp
      } else if (!current) {
        // Wrong armor type for this slot — do nothing
      } else {
        // Slot has armor, held item isn't valid — pick up current armor, keep held
        // (swap held with current)
        const temp = { id: current.id, count: current.count }
        this.armorSlots[slot] = null
        this.addItem(temp.id, temp.count)
      }
    }
  }

  /** Click an accessory slot: equip/swap */
  clickAccessorySlot(idx: number): void {
    const current = this.accessorySlots[idx] ?? null

    if (!this.heldItem) {
      if (current) {
        this.heldItem = { id: current.id, count: current.count }
        this.accessorySlots[idx] = null
      }
    } else {
      const def = getItemDef(this.heldItem.id)
      if (def?.category === ItemCategory.ACCESSORY) {
        const temp = current ? { id: current.id, count: current.count } : null
        this.accessorySlots[idx] = { id: this.heldItem.id, count: this.heldItem.count }
        this.heldItem = temp
      }
    }
  }

  /** Get all equipped accessory item IDs */
  getEquippedAccessoryIds(): number[] {
    const ids: number[] = []
    for (const slot of this.accessorySlots) {
      if (slot) ids.push(slot.id)
    }
    return ids
  }

  /** Get total defense from all equipped armor */
  getTotalDefense(): number {
    let total = 0
    for (const slot of ARMOR_SLOT_ORDER) {
      const item = this.armorSlots[slot]
      if (item) {
        const def = getItemDef(item.id)
        if (def?.defense) total += def.defense
      }
    }
    return total
  }

  /** Right-click a slot: pick up half / place one */
  rightClickSlot(area: 'hotbar' | 'main', idx: number): void {
    const slots = area === 'hotbar' ? this.hotbar : this.mainInventory
    const slot = slots[idx]

    if (!this.heldItem) {
      if (slot && slot.count > 0) {
        const half = Math.ceil(slot.count / 2)
        this.heldItem = { id: slot.id, count: half }
        slot.count -= half
        if (slot.count <= 0) slots[idx] = null
      }
    } else {
      if (!slot) {
        slots[idx] = { id: this.heldItem.id, count: 1 }
        this.heldItem.count--
        if (this.heldItem.count <= 0) this.heldItem = null
      } else if (slot.id === this.heldItem.id && slot.count < maxStackFor(slot.id)) {
        slot.count++
        this.heldItem.count--
        if (this.heldItem.count <= 0) this.heldItem = null
      }
    }
  }
}
