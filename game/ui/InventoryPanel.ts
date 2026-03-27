import Phaser from 'phaser'
import { InventoryManager, ARMOR_SLOT_ORDER } from '../systems/InventoryManager'
import type { ItemStack } from '../systems/InventoryManager'
import { TileType, TILE_PROPERTIES } from '../world/TileRegistry'
import { getItemDef, ENCHANTMENT_NAMES, ENCHANTMENT_COLORS } from '../data/items'
import { AudioManager } from '../systems/AudioManager'
import { SoundId } from '../data/sounds'
import { ACCESSORY_EFFECTS } from '../data/accessories'
import { SLOT_SIZE, SLOT_GAP, getItemTexKey, drawEnchantGradient, drawEternalStars } from './UIContext'

const INV_COLS = 10
const INV_PAD = 12
const INV_INNER_W = INV_COLS * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP
const INV_W = INV_INNER_W + INV_PAD * 2
const INV_TITLE_H = 28
const INV_SEP = 10
// Max rows/slots (4 rows = 40 main slots with Explorer's Belt)
const INV_MAX_MAIN_ROWS = 4
const INV_MAX_MAIN_SLOTS = INV_COLS * INV_MAX_MAIN_ROWS
const INV_MAX_TOTAL_SLOTS = INV_MAX_MAIN_SLOTS + 10 // +hotbar

export class InventoryPanel {
  private scene: Phaser.Scene
  private invGfx!: Phaser.GameObjects.Graphics
  private invTitle!: Phaser.GameObjects.Text
  private invSlotIcons: Phaser.GameObjects.Rectangle[] = []
  private invSlotImages: (Phaser.GameObjects.Image | null)[] = []
  private invSlotTexts: Phaser.GameObjects.Text[] = []
  private invSlotZones: Phaser.GameObjects.Zone[] = []
  private invVisible = false
  private invTooltipText!: Phaser.GameObjects.Text

  // Armor panel
  private armorGfx!: Phaser.GameObjects.Graphics
  private armorSlotIcons: Phaser.GameObjects.Rectangle[] = []
  private armorSlotImages: (Phaser.GameObjects.Image | null)[] = []
  private armorSlotLabels: Phaser.GameObjects.Text[] = []
  private armorSlotZones: Phaser.GameObjects.Zone[] = []
  private armorDefenseText!: Phaser.GameObjects.Text
  private accSlotImages: (Phaser.GameObjects.Image | null)[] = [null, null, null]

  // Held item (cursor)
  private heldIcon!: Phaser.GameObjects.Rectangle
  private heldImage: Phaser.GameObjects.Image | null = null
  private heldText!: Phaser.GameObjects.Text

  // Trash slot
  private trashZone!: Phaser.GameObjects.Zone
  private trashLabel!: Phaser.GameObjects.Text

  // Auto-trash filter hint
  private filterHintText!: Phaser.GameObjects.Text

  // Trash filter popup
  private trashFilterOpen = false
  private trashFilterGfx!: Phaser.GameObjects.Graphics
  private trashFilterTexts: Phaser.GameObjects.Text[] = []
  private trashFilterZones: Phaser.GameObjects.Zone[] = []
  private trashFilterTitle!: Phaser.GameObjects.Text

  // Shop panel gfx (created here to share with shop)
  shopGfx!: Phaser.GameObjects.Graphics
  shopTitle!: Phaser.GameObjects.Text

  // Chest panel gfx
  chestGfx!: Phaser.GameObjects.Graphics
  chestTitle!: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  get visible() { return this.invVisible }

  create() {
    this.invSlotIcons = []
    this.invSlotImages = []
    this.invSlotTexts = []
    this.invSlotZones = []
    this.armorSlotIcons = []
    this.armorSlotImages = []
    this.armorSlotLabels = []
    this.armorSlotZones = []
    this.invVisible = false

    const { width, height } = this.scene.scale
    // Use max size for initial layout — positions are updated dynamically in update()
    const mainH = INV_MAX_MAIN_ROWS * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP
    const invH = INV_PAD + INV_TITLE_H + mainH + INV_SEP + SLOT_SIZE + INV_PAD
    const invX = (width - INV_W) / 2
    const invY = (height - invH) / 2

    this.invGfx = this.scene.add.graphics().setDepth(310)
    this.invTitle = this.scene.add.text(width / 2, invY + INV_PAD + 2, 'INVENTORY', {
      fontSize: '14px', color: '#ffff00', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(311).setVisible(false)

    const mainStartY = invY + INV_PAD + INV_TITLE_H
    const hotbarStartY = mainStartY + mainH + INV_SEP

    for (let i = 0; i < INV_MAX_TOTAL_SLOTS; i++) {
      let sx: number, sy: number
      if (i < INV_MAX_MAIN_SLOTS) {
        const row = Math.floor(i / INV_COLS)
        const col = i % INV_COLS
        sx = invX + INV_PAD + col * (SLOT_SIZE + SLOT_GAP)
        sy = mainStartY + row * (SLOT_SIZE + SLOT_GAP)
      } else {
        const col = i - INV_MAX_MAIN_SLOTS
        sx = invX + INV_PAD + col * (SLOT_SIZE + SLOT_GAP)
        sy = hotbarStartY
      }

      const zone = this.scene.add.zone(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2, SLOT_SIZE, SLOT_SIZE)
        .setInteractive().setDepth(313)
      zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onInvSlotClick(i, pointer))
      this.invSlotZones.push(zone)

      const icon = this.scene.add.rectangle(
        sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2,
        SLOT_SIZE - 12, SLOT_SIZE - 12, 0x000000, 0
      ).setDepth(311).setVisible(false)
      this.invSlotIcons.push(icon)
      this.invSlotImages.push(null)

      const txt = this.scene.add.text(sx + SLOT_SIZE - 4, sy + SLOT_SIZE - 4, '', {
        fontSize: '10px', color: '#ffffff', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(1, 1).setDepth(312).setVisible(false)
      this.invSlotTexts.push(txt)
    }

    this.invTooltipText = this.scene.add.text(width / 2, invY - 4, '', {
      fontSize: '11px', color: '#aaaaaa', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(315).setVisible(false)

    // Armor panel
    this.armorGfx = this.scene.add.graphics().setDepth(310)
    const armorLabels = ['H', 'C', 'L', 'B']
    const armorPanelX = invX + INV_W + 6
    const armorPanelY = invY

    for (let i = 0; i < 4; i++) {
      const sy = armorPanelY + INV_PAD + INV_TITLE_H + i * (SLOT_SIZE + SLOT_GAP)
      const sx = armorPanelX + INV_PAD

      const zone = this.scene.add.zone(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2, SLOT_SIZE, SLOT_SIZE)
        .setInteractive().setDepth(313)
      zone.on('pointerdown', () => this.onArmorSlotClick(i))
      this.armorSlotZones.push(zone)

      const icon = this.scene.add.rectangle(
        sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2,
        SLOT_SIZE - 12, SLOT_SIZE - 12, 0x000000, 0
      ).setDepth(311).setVisible(false)
      this.armorSlotIcons.push(icon)
      this.armorSlotImages.push(null)

      const label = this.scene.add.text(sx - 2, sy + SLOT_SIZE / 2, armorLabels[i]!, {
        fontSize: '9px', color: '#555555', fontFamily: 'monospace',
      }).setOrigin(1, 0.5).setDepth(312).setVisible(false)
      this.armorSlotLabels.push(label)
    }

    this.armorDefenseText = this.scene.add.text(
      armorPanelX + INV_PAD + SLOT_SIZE / 2,
      armorPanelY + INV_PAD + INV_TITLE_H + 4 * (SLOT_SIZE + SLOT_GAP) + 4,
      '', { fontSize: '10px', color: '#88aaff', fontFamily: 'monospace', stroke: '#000000', strokeThickness: 2 }
    ).setOrigin(0.5, 0).setDepth(312).setVisible(false)

    // Held item display
    this.heldIcon = this.scene.add.rectangle(0, 0, SLOT_SIZE - 12, SLOT_SIZE - 12, 0x000000, 0)
      .setDepth(420).setVisible(false)
    this.heldText = this.scene.add.text(0, 0, '', {
      fontSize: '10px', color: '#ffffff', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 1).setDepth(421).setVisible(false)

    // Trash slot
    const trashX = invX + INV_W - SLOT_SIZE - INV_PAD
    const trashY = invY + invH + 4
    this.trashZone = this.scene.add.zone(trashX + SLOT_SIZE / 2, trashY + SLOT_SIZE / 2, SLOT_SIZE, SLOT_SIZE)
      .setInteractive().setDepth(313)
    this.trashZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onTrashClick(pointer))
    this.trashLabel = this.scene.add.text(trashX + SLOT_SIZE / 2, trashY + SLOT_SIZE / 2, 'X', {
      fontSize: '16px', color: '#ff4444', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(312).setVisible(false)

    // Auto-trash filter hint text
    this.filterHintText = this.scene.add.text(0, 0, '', {
      fontSize: '9px', color: '#ff6666', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 1,
    }).setDepth(312).setVisible(false)

    // Trash filter popup
    this.trashFilterGfx = this.scene.add.graphics().setDepth(350)
    this.trashFilterTitle = this.scene.add.text(0, 0, 'Auto-Trash Filter', {
      fontSize: '11px', color: '#ff6666', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(352).setVisible(false)

    // Shop panel gfx (shared)
    this.shopGfx = this.scene.add.graphics().setDepth(330)
    this.shopTitle = this.scene.add.text(0, 0, '', {
      fontSize: '14px', color: '#ffdd44', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(332).setVisible(false)

    // Chest panel gfx (shared)
    this.chestGfx = this.scene.add.graphics().setDepth(340)
    this.chestTitle = this.scene.add.text(0, 0, '', {
      fontSize: '14px', color: '#ddaa55', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(342).setVisible(false)
  }

  update(player: any, inv: InventoryManager, pointerJustDown: boolean) {
    const shouldShow = player.inventoryOpen === true
    if (shouldShow !== this.invVisible) {
      this.invVisible = shouldShow
    }

    this.invGfx.clear()
    this.armorGfx.clear()
    this.invTitle.setVisible(this.invVisible)
    this.invTooltipText.setVisible(false)

    // Dynamic row count based on effective inventory size
    const effMainSize = inv.getEffectiveMainSize()
    const mainRows = Math.ceil(effMainSize / INV_COLS)
    const mainH = mainRows * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP
    const invH = INV_PAD + INV_TITLE_H + mainH + INV_SEP + SLOT_SIZE + INV_PAD
    if (!this.invVisible) {
      for (let i = 0; i < INV_MAX_TOTAL_SLOTS; i++) {
        this.invSlotIcons[i]?.setVisible(false)
        this.invSlotTexts[i]?.setVisible(false)
        this.invSlotZones[i]?.disableInteractive()
        if (this.invSlotImages[i]) {
          this.invSlotImages[i]!.setVisible(false)
        }
      }
      for (let i = 0; i < 4; i++) {
        this.armorSlotIcons[i]?.setVisible(false)
        this.armorSlotLabels[i]?.setVisible(false)
        this.armorSlotZones[i]?.disableInteractive()
        if (this.armorSlotImages[i]) {
          this.armorSlotImages[i]!.setVisible(false)
        }
      }
      this.armorDefenseText?.setVisible(false)
      for (let i = 0; i < 3; i++) {
        if (this.accSlotImages[i]) this.accSlotImages[i]!.setVisible(false)
      }
      this.heldIcon?.setVisible(false)
      this.heldText?.setVisible(false)
      if (this.heldImage) this.heldImage.setVisible(false)
      this.trashLabel?.setVisible(false)
      this.trashZone?.disableInteractive()
      this.filterHintText?.setVisible(false)
      this.hideTrashFilterPopup()
      return
    }

    const { width, height } = this.scene.scale
    const invX = (width - INV_W) / 2
    const invY = (height - invH) / 2
    const pointer = this.scene.input.activePointer

    this.invGfx.fillStyle(0x0a0a1a, 0.95)
    this.invGfx.fillRect(invX, invY, INV_W, invH)
    this.invGfx.lineStyle(2, 0x444466)
    this.invGfx.strokeRect(invX, invY, INV_W, invH)
    this.invTitle.setPosition(width / 2, invY + INV_PAD + 2)

    const mainStartY = invY + INV_PAD + INV_TITLE_H
    const hotbarStartY = mainStartY + mainH + INV_SEP

    this.invGfx.lineStyle(1, 0x333355)
    this.invGfx.lineBetween(
      invX + INV_PAD, hotbarStartY - INV_SEP / 2,
      invX + INV_W - INV_PAD, hotbarStartY - INV_SEP / 2
    )

    let hoveredItem: ItemStack | null = null

    for (let i = 0; i < INV_MAX_TOTAL_SLOTS; i++) {
      // Hide inactive extra main slots (30-39 when belt not equipped)
      if (i >= effMainSize && i < INV_MAX_MAIN_SLOTS) {
        this.invSlotIcons[i]?.setVisible(false)
        this.invSlotTexts[i]?.setVisible(false)
        this.invSlotZones[i]?.disableInteractive()
        if (this.invSlotImages[i]) this.invSlotImages[i]!.setVisible(false)
        continue
      }

      let sx: number, sy: number
      let item: ItemStack | null
      if (i < INV_MAX_MAIN_SLOTS) {
        const row = Math.floor(i / INV_COLS)
        const col = i % INV_COLS
        sx = invX + INV_PAD + col * (SLOT_SIZE + SLOT_GAP)
        sy = mainStartY + row * (SLOT_SIZE + SLOT_GAP)
        item = inv.mainInventory[i] ?? null
      } else {
        const col = i - INV_MAX_MAIN_SLOTS
        sx = invX + INV_PAD + col * (SLOT_SIZE + SLOT_GAP)
        sy = hotbarStartY
        item = inv.hotbar[col] ?? null
      }

      this.invGfx.fillStyle(0x111111, 0.85)
      this.invGfx.fillRect(sx, sy, SLOT_SIZE, SLOT_SIZE)
      this.invGfx.lineStyle(1, 0x444444, 0.9)
      this.invGfx.strokeRect(sx, sy, SLOT_SIZE, SLOT_SIZE)

      if (i >= INV_MAX_MAIN_SLOTS && i - INV_MAX_MAIN_SLOTS === inv.selectedSlot) {
        this.invGfx.lineStyle(2, 0xffff00, 1)
        this.invGfx.strokeRect(sx - 1, sy - 1, SLOT_SIZE + 2, SLOT_SIZE + 2)
      }

      if (pointer.x >= sx && pointer.x < sx + SLOT_SIZE &&
          pointer.y >= sy && pointer.y < sy + SLOT_SIZE && item) {
        hoveredItem = item
        this.invGfx.fillStyle(0xffffff, 0.1)
        this.invGfx.fillRect(sx, sy, SLOT_SIZE, SLOT_SIZE)
      }

      this.invSlotZones[i]!.setPosition(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2)
      this.invSlotZones[i]!.setInteractive()

      const icon = this.invSlotIcons[i]!
      const txt = this.invSlotTexts[i]!
      icon.setPosition(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2)
      txt.setPosition(sx + SLOT_SIZE - 4, sy + SLOT_SIZE - 4)

      if (item) {
        const def = getItemDef(item.id)
        const tileProps = TILE_PROPERTIES[item.id as TileType]
        const texKey = getItemTexKey(item.id)

        if (this.scene.textures.exists(texKey)) {
          icon.fillAlpha = 0
          icon.setVisible(true)
          const existingImg = this.invSlotImages[i]
          if (!existingImg || existingImg.texture.key !== texKey) {
            if (existingImg) existingImg.destroy()
            this.invSlotImages[i] = this.scene.add.image(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2, texKey)
              .setDisplaySize(SLOT_SIZE - 12, SLOT_SIZE - 12)
              .setDepth(311)
          } else {
            existingImg.setPosition(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2)
            existingImg.setVisible(true)
          }
        } else {
          const color = def?.color ?? tileProps?.color ?? 0xffffff
          icon.fillColor = color
          icon.fillAlpha = 1
          icon.setVisible(true)
          if (this.invSlotImages[i]) {
            this.invSlotImages[i]!.destroy()
            this.invSlotImages[i] = null
          }
        }
        txt.setText(item.count > 1 ? `${item.count}` : '')
        txt.setVisible(true)
        if (item.enchantment) {
          const enchColor = ENCHANTMENT_COLORS[item.enchantment] ?? 0xffffff
          drawEnchantGradient(this.invGfx, sx, sy, enchColor)
          if (item.enchantment === 'eternal') {
            drawEternalStars(this.invGfx, sx, sy)
          }
        }
        // Auto-trash filter overlay
        if (inv.trashFilter.has(item.id)) {
          this.invGfx.fillStyle(0xff0000, 0.15)
          this.invGfx.fillRect(sx, sy, SLOT_SIZE, SLOT_SIZE)
          this.invGfx.lineStyle(2, 0xff4444, 0.7)
          const m = 8
          this.invGfx.lineBetween(sx + m, sy + m, sx + SLOT_SIZE - m, sy + SLOT_SIZE - m)
          this.invGfx.lineBetween(sx + SLOT_SIZE - m, sy + m, sx + m, sy + SLOT_SIZE - m)
        }
      } else {
        icon.fillAlpha = 0
        icon.setVisible(false)
        txt.setText('')
        txt.setVisible(false)
        if (this.invSlotImages[i]) {
          this.invSlotImages[i]!.destroy()
          this.invSlotImages[i] = null
        }
      }
    }

    // Tooltip with stat comparison
    if (hoveredItem) {
      const def = getItemDef(hoveredItem.id)
      const tileProps = TILE_PROPERTIES[hoveredItem.id as TileType]
      let name = def?.name ?? tileProps?.name ?? `Item ${hoveredItem.id}`
      if (hoveredItem.enchantment) {
        const enchName = ENCHANTMENT_NAMES[hoveredItem.enchantment] ?? hoveredItem.enchantment
        name = `${enchName} ${name}`
        const eColor = ENCHANTMENT_COLORS[hoveredItem.enchantment]
        if (eColor) this.invTooltipText.setColor(`#${eColor.toString(16).padStart(6, '0')}`)
        else this.invTooltipText.setColor('#ffffff')
      } else {
        this.invTooltipText.setColor('#ffffff')
      }
      if (def?.defense) name += ` (+${def.defense} def)`
      // Stat comparison arrows vs equipped
      if (def) {
        const equipped = inv.getSelectedItem()
        const equippedDef = equipped ? getItemDef(equipped.id) : null
        if (def.damage && equippedDef?.damage) {
          const diff = def.damage - equippedDef.damage
          if (diff > 0) name += ` \u2191${diff}`
          else if (diff < 0) name += ` \u2193${Math.abs(diff)}`
        }
        if (def.defense && def.armorSlot) {
          const currentArmor = inv.armorSlots[def.armorSlot]
          const currentDef = currentArmor ? getItemDef(currentArmor.id) : null
          const diff = def.defense - (currentDef?.defense ?? 0)
          if (diff > 0) name += ` \u2191${diff}def`
          else if (diff < 0) name += ` \u2193${Math.abs(diff)}def`
        }
      }
      if (inv.trashFilter.has(hoveredItem.id)) name += ' [AUTO-TRASH]'
      this.invTooltipText.setText(name)
      this.invTooltipText.setPosition(width / 2, invY - 4)
      this.invTooltipText.setVisible(true)
    }

    // Auto-trash hint
    this.filterHintText.setVisible(true)
    if (inv.trashFilter.size > 0) {
      this.filterHintText.setText(`Auto-trash: ${inv.trashFilter.size} item(s) | Shift+Click to toggle`)
    } else {
      this.filterHintText.setText('Shift+Click to auto-trash items')
    }
    this.filterHintText.setPosition(invX + INV_PAD, invY + invH + 8)

    this.updateArmorPanel(player, inv, invX, invY, invH, pointer, pointerJustDown)
    this.updateHeldItem(inv)
  }

  private updateArmorPanel(player: any, inv: InventoryManager, invX: number, invY: number, invH: number, pointer: Phaser.Input.Pointer, pointerJustDown: boolean) {
    const armorPanelX = invX + INV_W + 6
    const armorPanelW = SLOT_SIZE + INV_PAD * 2
    const armorPanelH = INV_PAD + INV_TITLE_H + 4 * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP + INV_PAD + 16

    this.armorGfx.fillStyle(0x0a0a1a, 0.95)
    this.armorGfx.fillRect(armorPanelX, invY, armorPanelW, armorPanelH)
    this.armorGfx.lineStyle(2, 0x444466)
    this.armorGfx.strokeRect(armorPanelX, invY, armorPanelW, armorPanelH)

    for (let i = 0; i < 4; i++) {
      const slot = ARMOR_SLOT_ORDER[i]!
      const item = inv.armorSlots[slot]
      const sy = invY + INV_PAD + INV_TITLE_H + i * (SLOT_SIZE + SLOT_GAP)
      const sx = armorPanelX + INV_PAD

      this.armorGfx.fillStyle(0x1a1a2e, 0.85)
      this.armorGfx.fillRect(sx, sy, SLOT_SIZE, SLOT_SIZE)
      this.armorGfx.lineStyle(1, 0x555577, 0.9)
      this.armorGfx.strokeRect(sx, sy, SLOT_SIZE, SLOT_SIZE)

      if (pointer.x >= sx && pointer.x < sx + SLOT_SIZE &&
          pointer.y >= sy && pointer.y < sy + SLOT_SIZE) {
        this.armorGfx.fillStyle(0xffffff, 0.1)
        this.armorGfx.fillRect(sx, sy, SLOT_SIZE, SLOT_SIZE)

        if (item) {
          const def = getItemDef(item.id)
          if (def) {
            this.invTooltipText.setText(`${def.name} (+${def.defense} def)`)
            this.invTooltipText.setVisible(true)
          }
        }
      }

      this.armorSlotZones[i]!.setInteractive()
      this.armorSlotZones[i]!.setPosition(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2)
      this.armorSlotLabels[i]!.setPosition(sx - 2, sy + SLOT_SIZE / 2)
      this.armorSlotLabels[i]!.setVisible(true)

      const icon = this.armorSlotIcons[i]!
      icon.setPosition(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2)

      if (item) {
        const def = getItemDef(item.id)
        const texKey = getItemTexKey(item.id)

        if (this.scene.textures.exists(texKey)) {
          icon.fillAlpha = 0
          icon.setVisible(true)
          const existing = this.armorSlotImages[i]
          if (!existing || existing.texture.key !== texKey) {
            if (existing) existing.destroy()
            this.armorSlotImages[i] = this.scene.add.image(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2, texKey)
              .setDisplaySize(SLOT_SIZE - 12, SLOT_SIZE - 12).setDepth(311)
          } else {
            existing.setPosition(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2)
            existing.setVisible(true)
          }
        } else {
          const color = def?.color ?? 0xffffff
          icon.fillColor = color
          icon.fillAlpha = 1
          icon.setVisible(true)
          if (this.armorSlotImages[i]) {
            this.armorSlotImages[i]!.destroy()
            this.armorSlotImages[i] = null
          }
        }
      } else {
        icon.fillAlpha = 0
        icon.setVisible(false)
        if (this.armorSlotImages[i]) {
          this.armorSlotImages[i]!.destroy()
          this.armorSlotImages[i] = null
        }
      }
    }

    const totalDef = typeof player.getEffectiveDefense === 'function' ? player.getEffectiveDefense() : inv.getTotalDefense()
    this.armorDefenseText.setText(`DEF ${totalDef}`)
    this.armorDefenseText.setPosition(
      armorPanelX + armorPanelW / 2,
      invY + INV_PAD + INV_TITLE_H + 4 * (SLOT_SIZE + SLOT_GAP) + 2
    )
    this.armorDefenseText.setVisible(true)

    // Accessory slots
    const accStartY = invY + INV_PAD + INV_TITLE_H + 4 * (SLOT_SIZE + SLOT_GAP) + 20
    for (let i = 0; i < 3; i++) {
      const sx = armorPanelX + INV_PAD
      const sy = accStartY + i * (SLOT_SIZE + SLOT_GAP)
      const accItem = inv.accessorySlots[i] ?? null

      this.armorGfx.fillStyle(0x1a1a2e, 0.85)
      this.armorGfx.fillRect(sx, sy, SLOT_SIZE, SLOT_SIZE)
      this.armorGfx.lineStyle(1, 0x6688aa, 0.9)
      this.armorGfx.strokeRect(sx, sy, SLOT_SIZE, SLOT_SIZE)

      if (pointer.x >= sx && pointer.x < sx + SLOT_SIZE &&
          pointer.y >= sy && pointer.y < sy + SLOT_SIZE) {
        this.armorGfx.fillStyle(0xffffff, 0.1)
        this.armorGfx.fillRect(sx, sy, SLOT_SIZE, SLOT_SIZE)

        if (accItem) {
          const aDef = getItemDef(accItem.id)
          const aEff = ACCESSORY_EFFECTS[accItem.id]
          if (aDef && aEff) {
            this.invTooltipText.setText(`${aDef.name}: ${aEff.description}`)
            this.invTooltipText.setVisible(true)
          }
        }

        if (pointerJustDown) {
          inv.clickAccessorySlot(i)
          AudioManager.get()?.play(SoundId.SLOT_CHANGE)
        }
      }

      if (accItem) {
        const accDef = getItemDef(accItem.id)
        const texKey = getItemTexKey(accItem.id)

        if (this.scene.textures.exists(texKey)) {
          const existing = this.accSlotImages[i]
          if (!existing || existing.texture.key !== texKey) {
            if (existing) existing.destroy()
            this.accSlotImages[i] = this.scene.add.image(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2, texKey)
              .setDisplaySize(SLOT_SIZE - 12, SLOT_SIZE - 12).setDepth(311)
          } else {
            existing.setPosition(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2)
            existing.setVisible(true)
          }
        } else if (accDef) {
          this.armorGfx.fillStyle(accDef.color, 0.9)
          this.armorGfx.fillRect(sx + 6, sy + 6, SLOT_SIZE - 12, SLOT_SIZE - 12)
          if (this.accSlotImages[i]) {
            this.accSlotImages[i]!.destroy()
            this.accSlotImages[i] = null
          }
        }
      } else {
        if (this.accSlotImages[i]) {
          this.accSlotImages[i]!.destroy()
          this.accSlotImages[i] = null
        }
      }
    }

    // Extend armor panel
    const extendedH = armorPanelH + 3 * (SLOT_SIZE + SLOT_GAP) + 10
    this.armorGfx.fillStyle(0x0a0a1a, 0.95)
    this.armorGfx.fillRect(armorPanelX, invY + armorPanelH, armorPanelW, extendedH - armorPanelH)
    this.armorGfx.lineStyle(2, 0x444466)
    this.armorGfx.strokeRect(armorPanelX, invY, armorPanelW, extendedH)

    // Trash slot
    const trashX = invX + INV_W - SLOT_SIZE - INV_PAD
    const trashY = invY + invH + 4
    this.invGfx.fillStyle(0x1a0a0a, 0.95)
    this.invGfx.fillRect(trashX, trashY, SLOT_SIZE, SLOT_SIZE)
    this.invGfx.lineStyle(1, 0x884444, 0.9)
    this.invGfx.strokeRect(trashX, trashY, SLOT_SIZE, SLOT_SIZE)
    if (pointer.x >= trashX && pointer.x < trashX + SLOT_SIZE &&
        pointer.y >= trashY && pointer.y < trashY + SLOT_SIZE) {
      this.invGfx.fillStyle(0xff4444, 0.15)
      this.invGfx.fillRect(trashX, trashY, SLOT_SIZE, SLOT_SIZE)
      if (inv.heldItem) {
        this.invTooltipText.setText('Trash item')
        this.invTooltipText.setVisible(true)
      } else if (inv.trashFilter.size > 0) {
        this.invTooltipText.setText('Right-click to manage filter')
        this.invTooltipText.setVisible(true)
      }
    }
    this.trashZone.setPosition(trashX + SLOT_SIZE / 2, trashY + SLOT_SIZE / 2)
    this.trashZone.setInteractive()
    this.trashLabel.setPosition(trashX + SLOT_SIZE / 2, trashY + SLOT_SIZE / 2)
    this.trashLabel.setVisible(true)

    // Trash filter popup
    this.updateTrashFilterPopup(inv, trashX, trashY)
  }

  updateHeldItem(inv: InventoryManager) {
    const held = inv.heldItem
    if (!held) {
      this.heldIcon.setVisible(false)
      this.heldText.setVisible(false)
      if (this.heldImage) this.heldImage.setVisible(false)
      return
    }

    const pointer = this.scene.input.activePointer
    const cx = pointer.x
    const cy = pointer.y

    const def = getItemDef(held.id)
    const tileProps = TILE_PROPERTIES[held.id as TileType]
    const texKey = getItemTexKey(held.id)

    if (this.scene.textures.exists(texKey)) {
      this.heldIcon.setVisible(false)
      if (!this.heldImage || this.heldImage.texture.key !== texKey) {
        if (this.heldImage) this.heldImage.destroy()
        this.heldImage = this.scene.add.image(cx, cy, texKey)
          .setDisplaySize(SLOT_SIZE - 12, SLOT_SIZE - 12)
          .setDepth(420)
      }
      this.heldImage.setPosition(cx, cy)
      this.heldImage.setVisible(true)
    } else {
      const color = def?.color ?? tileProps?.color ?? 0xffffff
      this.heldIcon.fillColor = color
      this.heldIcon.fillAlpha = 0.9
      this.heldIcon.setPosition(cx, cy)
      this.heldIcon.setVisible(true)
      if (this.heldImage) this.heldImage.setVisible(false)
    }

    this.heldText.setText(held.count > 1 ? `${held.count}` : '')
    this.heldText.setPosition(cx + SLOT_SIZE / 2 - 6, cy + SLOT_SIZE / 2 - 6)
    this.heldText.setVisible(held.count > 1)
  }

  private onInvSlotClick(slotIndex: number, pointer: Phaser.Input.Pointer) {
    if (!this.invVisible) return
    const worldScene = this.scene.scene.get('WorldScene') as any
    const player = worldScene?.getPlayer()
    if (!player) return

    const inv: InventoryManager = player.inventory
    const area: 'hotbar' | 'main' = slotIndex >= INV_MAX_MAIN_SLOTS ? 'hotbar' : 'main'
    const idx = slotIndex >= INV_MAX_MAIN_SLOTS ? slotIndex - INV_MAX_MAIN_SLOTS : slotIndex

    // Shift+click toggles auto-trash filter for that item
    if (pointer.event?.shiftKey) {
      const slots = area === 'hotbar' ? inv.hotbar : inv.mainInventory
      const slot = slots[idx]
      if (slot) {
        if (inv.trashFilter.has(slot.id)) {
          inv.trashFilter.delete(slot.id)
        } else {
          inv.trashFilter.add(slot.id)
        }
        AudioManager.get()?.play(SoundId.SLOT_CHANGE)
      }
      return
    }

    if (pointer.button === 2) {
      inv.rightClickSlot(area, idx)
    } else {
      inv.clickSlot(area, idx)
    }

    AudioManager.get()?.play(SoundId.SLOT_CHANGE)
  }

  private onArmorSlotClick(index: number) {
    if (!this.invVisible) return
    const worldScene = this.scene.scene.get('WorldScene') as any
    const player = worldScene?.getPlayer()
    if (!player) return

    const inv: InventoryManager = player.inventory
    const slot = ARMOR_SLOT_ORDER[index]!
    inv.clickArmorSlot(slot)
    AudioManager.get()?.play(SoundId.SLOT_CHANGE)
  }

  private updateTrashFilterPopup(inv: InventoryManager, trashX: number, trashY: number) {
    this.trashFilterGfx.clear()

    if (!this.trashFilterOpen || inv.trashFilter.size === 0) {
      this.trashFilterOpen = false
      this.hideTrashFilterPopup()
      return
    }

    const items = Array.from(inv.trashFilter)
    const ROW_H = 22
    const POPUP_W = 180
    const POPUP_PAD = 8
    const TITLE_H = 22
    const popupH = POPUP_PAD + TITLE_H + items.length * ROW_H + POPUP_PAD
    const popupX = trashX - POPUP_W + SLOT_SIZE
    const popupY = trashY - popupH - 4

    // Background
    this.trashFilterGfx.fillStyle(0x0a0a1a, 0.95)
    this.trashFilterGfx.fillRect(popupX, popupY, POPUP_W, popupH)
    this.trashFilterGfx.lineStyle(2, 0x884444)
    this.trashFilterGfx.strokeRect(popupX, popupY, POPUP_W, popupH)

    // Title
    this.trashFilterTitle.setPosition(popupX + POPUP_W / 2, popupY + POPUP_PAD)
    this.trashFilterTitle.setVisible(true)

    const pointer = this.scene.input.activePointer

    // Ensure enough text/zone objects
    while (this.trashFilterTexts.length < items.length) {
      const txt = this.scene.add.text(0, 0, '', {
        fontSize: '10px', color: '#cccccc', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 1,
      }).setDepth(352).setVisible(false)
      this.trashFilterTexts.push(txt)

      const zone = this.scene.add.zone(0, 0, POPUP_W - POPUP_PAD * 2, ROW_H)
        .setInteractive().setDepth(353)
      const idx = this.trashFilterZones.length
      zone.on('pointerdown', () => this.onTrashFilterItemClick(idx))
      this.trashFilterZones.push(zone)
    }

    for (let i = 0; i < this.trashFilterTexts.length; i++) {
      if (i >= items.length) {
        this.trashFilterTexts[i]!.setVisible(false)
        this.trashFilterZones[i]!.disableInteractive()
        continue
      }

      const itemId = items[i]!
      const def = getItemDef(itemId)
      const tileProps = TILE_PROPERTIES[itemId as TileType]
      const name = def?.name ?? tileProps?.name ?? `Item ${itemId}`

      const rowY = popupY + POPUP_PAD + TITLE_H + i * ROW_H
      const txt = this.trashFilterTexts[i]!
      txt.setText(`  ${name}`)
      txt.setPosition(popupX + POPUP_PAD, rowY + 3)
      txt.setVisible(true)

      const zone = this.trashFilterZones[i]!
      zone.setPosition(popupX + POPUP_W / 2, rowY + ROW_H / 2)
      zone.setSize(POPUP_W - POPUP_PAD * 2, ROW_H)
      zone.setInteractive()

      // Hover highlight
      const zx = popupX + POPUP_PAD
      const zy = rowY
      const zw = POPUP_W - POPUP_PAD * 2
      if (pointer.x >= zx && pointer.x < zx + zw &&
          pointer.y >= zy && pointer.y < zy + ROW_H) {
        this.trashFilterGfx.fillStyle(0xff4444, 0.15)
        this.trashFilterGfx.fillRect(zx, zy, zw, ROW_H)
        txt.setColor('#ff8888')
      } else {
        txt.setColor('#cccccc')
      }

      // Red X icon
      this.trashFilterGfx.lineStyle(1, 0xff4444, 0.7)
      const iconX = popupX + POPUP_PAD + 4
      const iconY = rowY + ROW_H / 2
      this.trashFilterGfx.lineBetween(iconX - 3, iconY - 3, iconX + 3, iconY + 3)
      this.trashFilterGfx.lineBetween(iconX + 3, iconY - 3, iconX - 3, iconY + 3)
    }
  }

  private hideTrashFilterPopup() {
    this.trashFilterGfx.clear()
    this.trashFilterTitle.setVisible(false)
    for (const txt of this.trashFilterTexts) txt.setVisible(false)
    for (const zone of this.trashFilterZones) zone.disableInteractive()
  }

  private onTrashFilterItemClick(index: number) {
    if (!this.trashFilterOpen) return
    const worldScene = this.scene.scene.get('WorldScene') as any
    const player = worldScene?.getPlayer()
    if (!player) return
    const inv: InventoryManager = player.inventory
    const items = Array.from(inv.trashFilter)
    const itemId = items[index]
    if (itemId !== undefined) {
      inv.trashFilter.delete(itemId)
      AudioManager.get()?.play(SoundId.SLOT_CHANGE)
    }
  }

  private onTrashClick(pointer: Phaser.Input.Pointer) {
    if (!this.invVisible) return
    const worldScene = this.scene.scene.get('WorldScene') as any
    const player = worldScene?.getPlayer()
    if (!player) return
    const inv: InventoryManager = player.inventory

    // Right-click opens/closes filter popup
    if (pointer.button === 2) {
      this.trashFilterOpen = !this.trashFilterOpen
      AudioManager.get()?.play(SoundId.SLOT_CHANGE)
      return
    }

    if (inv.heldItem) {
      inv.heldItem = null
      AudioManager.get()?.play(SoundId.SLOT_CHANGE)
    }
  }
}
