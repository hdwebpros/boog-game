import Phaser from 'phaser'
import type { InventoryManager } from '../systems/InventoryManager'
import { TileType, TILE_PROPERTIES } from '../world/TileRegistry'
import { getItemDef, ENCHANTMENT_NAMES, ENCHANTMENT_COLORS } from '../data/items'
import { AudioManager } from '../systems/AudioManager'
import { SoundId } from '../data/sounds'
import { SLOT_SIZE, SLOT_GAP, getItemTexKey, drawEnchantGradient } from './UIContext'

const HOTBAR_SLOTS = 10
const HOTBAR_WIDTH = HOTBAR_SLOTS * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP

export class HotbarPanel {
  private scene: Phaser.Scene
  private hotbarGfx!: Phaser.GameObjects.Graphics
  private slotTexts: Phaser.GameObjects.Text[] = []
  private slotIcons: Phaser.GameObjects.Rectangle[] = []
  private slotImages: (Phaser.GameObjects.Image | null)[] = []
  private selectorGfx!: Phaser.GameObjects.Graphics
  private tooltipText!: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  create() {
    const { width, height } = this.scene.scale
    const hotbarX = (width - HOTBAR_WIDTH) / 2
    const hotbarY = height - SLOT_SIZE - 12

    this.slotTexts = []
    this.slotIcons = []
    this.slotImages = []

    this.hotbarGfx = this.scene.add.graphics().setDepth(200)
    this.drawHotbarBackground(hotbarX, hotbarY)

    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const sx = hotbarX + i * (SLOT_SIZE + SLOT_GAP)
      const icon = this.scene.add.rectangle(
        sx + SLOT_SIZE / 2, hotbarY + SLOT_SIZE / 2,
        SLOT_SIZE - 12, SLOT_SIZE - 12, 0x000000, 0
      ).setDepth(201)
      this.slotIcons.push(icon)
      this.slotImages.push(null)

      const txt = this.scene.add.text(sx + SLOT_SIZE - 4, hotbarY + SLOT_SIZE - 4, '', {
        fontSize: '10px', color: '#ffffff', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(1, 1).setDepth(202)
      this.slotTexts.push(txt)
    }

    this.selectorGfx = this.scene.add.graphics().setDepth(203)

    this.tooltipText = this.scene.add.text(width / 2, hotbarY - 10, '', {
      fontSize: '12px', color: '#ffffff', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(204)

    // Key hints on slots
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const sx = hotbarX + i * (SLOT_SIZE + SLOT_GAP)
      const label = i === 9 ? '0' : `${i + 1}`
      this.scene.add.text(sx + 3, hotbarY + 2, label, {
        fontSize: '8px', color: '#555555', fontFamily: 'monospace',
      }).setDepth(202)
    }

    // Clickable hotbar zones
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const sx = hotbarX + i * (SLOT_SIZE + SLOT_GAP)
      const zone = this.scene.add.zone(sx + SLOT_SIZE / 2, hotbarY + SLOT_SIZE / 2, SLOT_SIZE, SLOT_SIZE)
        .setInteractive().setDepth(205)
      zone.on('pointerdown', () => {
        const worldScene = this.scene.scene.get('WorldScene') as any
        const player = worldScene?.getPlayer?.()
        if (player) {
          player.inventory.selectedSlot = i
          AudioManager.get()?.play(SoundId.SLOT_CHANGE)
        }
      })
    }
  }

  update(inv: InventoryManager) {
    this.updateSlots(inv)
    this.updateSelector(inv.selectedSlot)
    this.updateTooltip(inv)
  }

  private drawHotbarBackground(x: number, y: number) {
    this.hotbarGfx.clear()
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const sx = x + i * (SLOT_SIZE + SLOT_GAP)
      this.hotbarGfx.fillStyle(0x111111, 0.85)
      this.hotbarGfx.fillRect(sx, y, SLOT_SIZE, SLOT_SIZE)
      this.hotbarGfx.lineStyle(1, 0x444444, 0.9)
      this.hotbarGfx.strokeRect(sx, y, SLOT_SIZE, SLOT_SIZE)
    }
  }

  private updateSlots(inv: InventoryManager) {
    const { width, height } = this.scene.scale
    const hotbarX = (width - HOTBAR_WIDTH) / 2
    const hotbarY = height - SLOT_SIZE - 12

    this.drawHotbarBackground(hotbarX, hotbarY)

    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const item = inv.hotbar[i] ?? null
      const icon = this.slotIcons[i]!
      const txt = this.slotTexts[i]!
      const sx = hotbarX + i * (SLOT_SIZE + SLOT_GAP) + SLOT_SIZE / 2

      if (item) {
        const def = getItemDef(item.id)
        const tileProps = TILE_PROPERTIES[item.id as TileType]
        const texKey = getItemTexKey(item.id)

        if (this.scene.textures.exists(texKey)) {
          icon.fillAlpha = 0
          if (!this.slotImages[i] || this.slotImages[i]!.texture.key !== texKey) {
            if (this.slotImages[i]) this.slotImages[i]!.destroy()
            this.slotImages[i] = this.scene.add.image(sx, hotbarY + SLOT_SIZE / 2, texKey)
              .setDisplaySize(SLOT_SIZE - 12, SLOT_SIZE - 12)
              .setDepth(201)
          }
        } else {
          const color = def?.color ?? tileProps?.color ?? 0xffffff
          icon.fillColor = color
          icon.fillAlpha = 1
          if (this.slotImages[i]) {
            this.slotImages[i]!.destroy()
            this.slotImages[i] = null
          }
        }
        txt.setText(item.count > 1 ? `${item.count}` : '')
        // Enchantment gradient overlay
        if (item.enchantment) {
          const enchColor = ENCHANTMENT_COLORS[item.enchantment] ?? 0xffffff
          drawEnchantGradient(this.hotbarGfx, hotbarX + i * (SLOT_SIZE + SLOT_GAP), hotbarY, enchColor)
        }
      } else {
        icon.fillAlpha = 0
        txt.setText('')
        if (this.slotImages[i]) {
          this.slotImages[i]!.destroy()
          this.slotImages[i] = null
        }
      }
    }
  }

  private updateSelector(slot: number) {
    const { width, height } = this.scene.scale
    const hotbarX = (width - HOTBAR_WIDTH) / 2
    const hotbarY = height - SLOT_SIZE - 12
    const sx = hotbarX + slot * (SLOT_SIZE + SLOT_GAP)

    this.selectorGfx.clear()
    this.selectorGfx.lineStyle(2, 0xffff00, 1)
    this.selectorGfx.strokeRect(sx - 1, hotbarY - 1, SLOT_SIZE + 2, SLOT_SIZE + 2)
  }

  private updateTooltip(inv: InventoryManager) {
    const item = inv.getSelectedItem()
    if (item) {
      const def = getItemDef(item.id)
      const tileProps = TILE_PROPERTIES[item.id as TileType]
      let name = def?.name ?? tileProps?.name ?? `Item ${item.id}`
      if (item.enchantment) {
        const enchName = ENCHANTMENT_NAMES[item.enchantment] ?? item.enchantment
        name = `${enchName} ${name}`
        const color = ENCHANTMENT_COLORS[item.enchantment]
        if (color) this.tooltipText.setColor(`#${color.toString(16).padStart(6, '0')}`)
        else this.tooltipText.setColor('#ffffff')
      } else {
        this.tooltipText.setColor('#ffffff')
      }
      this.tooltipText.setText(name)
      this.tooltipText.setAlpha(1)
    } else {
      this.tooltipText.setAlpha(0)
    }
  }
}
