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

/**
 * Draw a pulsing diagonal gradient overlay on an enchanted item slot.
 * The gradient sweeps from top-left to bottom-right, shifting over time.
 */
export function drawEnchantGradient(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
) {
  const t = Date.now() * 0.001
  const steps = 8
  const stepH = SLOT_SIZE / steps
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff

  for (let i = 0; i < steps; i++) {
    // Diagonal sweep: each row's phase is offset by position
    const phase = t * 2.5 + (i / steps) * Math.PI
    const alpha = 0.08 + 0.14 * Math.max(0, Math.sin(phase))
    // Slightly shift hue toward white at the bright point
    const bright = Math.max(0, Math.sin(phase))
    const cr = Math.min(255, r + Math.floor(bright * 60))
    const cg = Math.min(255, g + Math.floor(bright * 60))
    const cb = Math.min(255, b + Math.floor(bright * 60))
    gfx.fillStyle((cr << 16) | (cg << 8) | cb, alpha)
    gfx.fillRect(x, y + i * stepH, SLOT_SIZE, stepH)
  }

  // Pulsing border on top
  const borderPulse = 0.4 + 0.35 * Math.sin(t * 3)
  gfx.lineStyle(1, color, borderPulse)
  gfx.strokeRect(x + 1, y + 1, SLOT_SIZE - 2, SLOT_SIZE - 2)
}
