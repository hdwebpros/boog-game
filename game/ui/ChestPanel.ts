import Phaser from 'phaser'
import type { InventoryManager, ItemStack } from '../systems/InventoryManager'
import { TileType, TILE_PROPERTIES } from '../world/TileRegistry'
import { getItemDef } from '../data/items'
import { AudioManager } from '../systems/AudioManager'
import { SoundId } from '../data/sounds'
import { CHEST_SLOTS } from '../world/ChunkManager'
import { getItemTexKey } from './UIContext'

export class ChestPanel {
  private scene: Phaser.Scene
  private chestGfx!: Phaser.GameObjects.Graphics
  private chestTexts: (Phaser.GameObjects.Text | Phaser.GameObjects.Image)[] = []
  private chestTitle!: Phaser.GameObjects.Text
  private chestVisible = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  setGraphics(gfx: Phaser.GameObjects.Graphics, title: Phaser.GameObjects.Text) {
    this.chestGfx = gfx
    this.chestTitle = title
  }

  update(player: any, inv: InventoryManager, pointerJustDown: boolean) {
    const shouldShow = player.chestOpen === true
    if (shouldShow !== this.chestVisible) {
      this.chestVisible = shouldShow
    }

    this.chestGfx.clear()
    this.chestTitle.setVisible(false)
    for (const t of this.chestTexts) t.destroy()
    this.chestTexts = []

    if (!this.chestVisible) return

    const worldScene = this.scene.scene.get('WorldScene') as any
    const chunks = worldScene?.getChunkManager?.()
    if (!chunks || !player.openChestPos) return

    const chestInv: (ItemStack | null)[] = chunks.getChestInventory(
      player.openChestPos.tx, player.openChestPos.ty
    )

    const { width, height } = this.scene.scale
    const CHEST_COLS = 10
    const CHEST_ROWS = Math.ceil(CHEST_SLOTS / CHEST_COLS)
    const S = 36
    const G = 3
    const PAD = 10
    const COL_W = CHEST_COLS * (S + G) - G
    const PANEL_W = COL_W + PAD * 2

    const TITLE_H = 24
    const SEP = 8
    const chestRowsH = CHEST_ROWS * (S + G) - G
    const invRowsH = 3 * (S + G) - G
    const hotbarH = S
    const PANEL_H = PAD + TITLE_H + chestRowsH + SEP + 18 + invRowsH + SEP + 18 + hotbarH + PAD

    const px = (width - PANEL_W) / 2
    const py = (height - PANEL_H) / 2

    this.chestGfx.fillStyle(0x0a0a1a, 0.95)
    this.chestGfx.fillRect(px, py, PANEL_W, PANEL_H)
    this.chestGfx.lineStyle(2, 0xddaa55)
    this.chestGfx.strokeRect(px, py, PANEL_W, PANEL_H)

    this.chestTitle.setText('Chest')
    this.chestTitle.setPosition(px + PANEL_W / 2, py + PAD)
    this.chestTitle.setVisible(true)

    const pointer = this.scene.input.activePointer
    let curY = py + PAD + TITLE_H

    // Chest slots
    for (let row = 0; row < CHEST_ROWS; row++) {
      for (let col = 0; col < CHEST_COLS; col++) {
        const idx = row * CHEST_COLS + col
        if (idx >= CHEST_SLOTS) break
        const sx = px + PAD + col * (S + G)
        const sy = curY + row * (S + G)
        const slot = chestInv[idx] ?? null
        this.drawChestSlot(sx, sy, S, slot, pointer, pointerJustDown, () => {
          inv.clickExternalSlot(chestInv, idx)
          AudioManager.get()?.play(SoundId.SLOT_CHANGE)
        })
      }
    }

    curY += chestRowsH + SEP

    // Inventory label
    const invLabel = this.scene.add.text(px + PANEL_W / 2, curY, 'Inventory', {
      fontSize: '11px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setDepth(342)
    this.chestTexts.push(invLabel)
    curY += 18

    // Main inventory slots
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 10; col++) {
        const idx = row * 10 + col
        const sx = px + PAD + col * (S + G)
        const sy = curY + row * (S + G)
        const slot = inv.mainInventory[idx] ?? null
        this.drawChestSlot(sx, sy, S, slot, pointer, pointerJustDown, () => {
          inv.clickSlot('main', idx)
          AudioManager.get()?.play(SoundId.SLOT_CHANGE)
        })
      }
    }

    curY += invRowsH + SEP

    // Hotbar label
    const hotLabel = this.scene.add.text(px + PANEL_W / 2, curY, 'Hotbar', {
      fontSize: '11px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setDepth(342)
    this.chestTexts.push(hotLabel)
    curY += 18

    // Hotbar slots
    for (let col = 0; col < 10; col++) {
      const sx = px + PAD + col * (S + G)
      const sy = curY
      const slot = inv.hotbar[col] ?? null
      this.drawChestSlot(sx, sy, S, slot, pointer, pointerJustDown, () => {
        inv.clickSlot('hotbar', col)
        AudioManager.get()?.play(SoundId.SLOT_CHANGE)
      })
    }
  }

  private drawChestSlot(
    x: number, y: number, size: number,
    slot: ItemStack | null,
    pointer: Phaser.Input.Pointer,
    pointerJustDown: boolean,
    onClick: () => void
  ) {
    this.chestGfx.fillStyle(0x111122, 0.85)
    this.chestGfx.fillRect(x, y, size, size)
    this.chestGfx.lineStyle(1, 0x333344)
    this.chestGfx.strokeRect(x, y, size, size)

    const hovered = pointer.x >= x && pointer.x < x + size &&
                    pointer.y >= y && pointer.y < y + size
    if (hovered) {
      this.chestGfx.fillStyle(0xffffff, 0.1)
      this.chestGfx.fillRect(x, y, size, size)
    }

    if (hovered && pointerJustDown) {
      onClick()
    }

    if (!slot) return

    const def = getItemDef(slot.id)
    const texKey = getItemTexKey(slot.id)
    const cx = x + size / 2
    const cy = y + size / 2

    if (this.scene.textures.exists(texKey)) {
      const img = this.scene.add.image(cx, cy, texKey)
        .setDisplaySize(size - 8, size - 8)
        .setDepth(342)
      this.chestTexts.push(img as any)
    } else {
      const color = def?.color ?? TILE_PROPERTIES[slot.id as TileType]?.color ?? 0xffffff
      this.chestGfx.fillStyle(color, 0.9)
      this.chestGfx.fillRect(x + 4, y + 4, size - 8, size - 8)
    }

    if (slot.count > 1) {
      const txt = this.scene.add.text(x + size - 2, y + size - 2, `${slot.count}`, {
        fontSize: '9px', color: '#ffffff', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(1, 1).setDepth(343)
      this.chestTexts.push(txt)
    }

    if (hovered && def) {
      const tip = this.scene.add.text(pointer.x, pointer.y - 16, def.name, {
        fontSize: '10px', color: '#ffffff', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 2,
        backgroundColor: '#000000aa', padding: { x: 4, y: 2 },
      }).setOrigin(0.5, 1).setDepth(350)
      this.chestTexts.push(tip)
    }
  }
}
