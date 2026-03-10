import Phaser from 'phaser'
import { TileType, TILE_PROPERTIES } from '../world/TileRegistry'
import { InventoryManager, ARMOR_SLOT_ORDER } from '../systems/InventoryManager'
import type { ItemStack } from '../systems/InventoryManager'
import type { ArmorSlot } from '../data/items'
import { CraftingManager } from '../systems/CraftingManager'
import type { Recipe } from '../data/recipes'
import { ITEMS, getItemDef, ItemCategory } from '../data/items'
import { AudioManager } from '../systems/AudioManager'
import { SoundId } from '../data/sounds'

const SLOT_SIZE = 40
const SLOT_GAP = 4
const HOTBAR_SLOTS = 10
const HOTBAR_WIDTH = HOTBAR_SLOTS * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP

// Crafting panel
const CRAFT_W = 320
const CRAFT_H = 400
const CRAFT_ROW_H = 32

// Inventory panel
const INV_COLS = 10
const INV_MAIN_ROWS = 3
const INV_PAD = 12
const INV_INNER_W = INV_COLS * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP // 436
const INV_W = INV_INNER_W + INV_PAD * 2 // 460
const INV_TITLE_H = 28
const INV_MAIN_H = INV_MAIN_ROWS * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP // 128
const INV_SEP = 10
const INV_H = INV_PAD + INV_TITLE_H + INV_MAIN_H + INV_SEP + SLOT_SIZE + INV_PAD // 232
const INV_TOTAL_SLOTS = INV_COLS * INV_MAIN_ROWS + HOTBAR_SLOTS // 40

export class UIScene extends Phaser.Scene {
  private hotbarGfx!: Phaser.GameObjects.Graphics
  private slotTexts: Phaser.GameObjects.Text[] = []
  private slotIcons: Phaser.GameObjects.Rectangle[] = []
  private slotImages: (Phaser.GameObjects.Image | null)[] = []
  private selectorGfx!: Phaser.GameObjects.Graphics
  private tooltipText!: Phaser.GameObjects.Text

  // HP/Mana bars
  private statsGfx!: Phaser.GameObjects.Graphics
  private hpText!: Phaser.GameObjects.Text
  private manaText!: Phaser.GameObjects.Text
  private deathText!: Phaser.GameObjects.Text

  // Crafting
  private craftingManager = new CraftingManager()
  private craftGfx!: Phaser.GameObjects.Graphics
  private craftTexts: Phaser.GameObjects.Text[] = []
  private craftTitle!: Phaser.GameObjects.Text
  private craftVisible = false
  private craftScroll = 0
  private craftRecipes: { recipe: Recipe; canCraft: boolean }[] = []

  // Inventory panel
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

  // Held item (cursor)
  private heldIcon!: Phaser.GameObjects.Rectangle
  private heldImage: Phaser.GameObjects.Image | null = null
  private heldText!: Phaser.GameObjects.Text

  constructor() {
    super({ key: 'UIScene' })
  }

  create() {
    const { width, height } = this.scale
    const hotbarX = (width - HOTBAR_WIDTH) / 2
    const hotbarY = height - SLOT_SIZE - 12

    // ── Hotbar ────────────────────────────────────────────
    this.hotbarGfx = this.add.graphics().setDepth(200)
    this.drawHotbarBackground(hotbarX, hotbarY)

    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const sx = hotbarX + i * (SLOT_SIZE + SLOT_GAP)
      const icon = this.add.rectangle(
        sx + SLOT_SIZE / 2, hotbarY + SLOT_SIZE / 2,
        SLOT_SIZE - 12, SLOT_SIZE - 12, 0x000000, 0
      ).setDepth(201)
      this.slotIcons.push(icon)
      this.slotImages.push(null)

      const txt = this.add.text(sx + SLOT_SIZE - 4, hotbarY + SLOT_SIZE - 4, '', {
        fontSize: '10px', color: '#ffffff', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(1, 1).setDepth(202)
      this.slotTexts.push(txt)
    }

    this.selectorGfx = this.add.graphics().setDepth(203)

    this.tooltipText = this.add.text(width / 2, hotbarY - 10, '', {
      fontSize: '12px', color: '#ffffff', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(204)

    // Key hints on slots
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const sx = hotbarX + i * (SLOT_SIZE + SLOT_GAP)
      const label = i === 9 ? '0' : `${i + 1}`
      this.add.text(sx + 3, hotbarY + 2, label, {
        fontSize: '8px', color: '#555555', fontFamily: 'monospace',
      }).setDepth(202)
    }

    // Clickable hotbar zones
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const sx = hotbarX + i * (SLOT_SIZE + SLOT_GAP)
      const zone = this.add.zone(sx + SLOT_SIZE / 2, hotbarY + SLOT_SIZE / 2, SLOT_SIZE, SLOT_SIZE)
        .setInteractive().setDepth(205)
      zone.on('pointerdown', () => {
        const worldScene = this.scene.get('WorldScene') as any
        const player = worldScene?.getPlayer?.()
        if (player) {
          player.inventory.selectedSlot = i
          AudioManager.get()?.play(SoundId.SLOT_CHANGE)
        }
      })
    }

    // ── HP/Mana bars ─────────────────────────────────────
    this.statsGfx = this.add.graphics().setDepth(200)
    this.hpText = this.add.text(12, 48, '', {
      fontSize: '10px', color: '#ffffff', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setDepth(201)
    this.manaText = this.add.text(12, 64, '', {
      fontSize: '10px', color: '#ffffff', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setDepth(201)

    // Death overlay text
    this.deathText = this.add.text(width / 2, height / 2, 'YOU DIED\nRespawning...', {
      fontSize: '28px', color: '#ff4444', fontFamily: 'monospace',
      align: 'center', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(400).setVisible(false)

    // ── Crafting panel ────────────────────────────────────
    const craftX = (width - CRAFT_W) / 2
    const craftY = (height - CRAFT_H) / 2 - 20

    this.craftGfx = this.add.graphics().setDepth(300)
    this.craftTitle = this.add.text(width / 2, craftY + 12, 'CRAFTING', {
      fontSize: '16px', color: '#ffff00', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(301).setVisible(false)

    // Pre-create recipe text rows (pool)
    const maxVisible = Math.floor((CRAFT_H - 40) / CRAFT_ROW_H)
    for (let i = 0; i < maxVisible; i++) {
      const t = this.add.text(craftX + 10, craftY + 38 + i * CRAFT_ROW_H, '', {
        fontSize: '11px', color: '#cccccc', fontFamily: 'monospace',
      }).setDepth(301).setVisible(false)
        .setInteractive(
          new Phaser.Geom.Rectangle(-8, -2, CRAFT_W - 4, CRAFT_ROW_H),
          Phaser.Geom.Rectangle.Contains
        )
      t.on('pointerdown', () => this.onCraftClick(i))
      t.on('pointerover', () => t.setColor('#ffffff'))
      t.on('pointerout', () => this.refreshCraftRowColor(t, i))
      this.craftTexts.push(t)
    }

    // Scroll crafting with wheel
    this.input.on('wheel', (_p: any, _gx: any, _gy: any, _gz: any, _delta: number, deltaY: number) => {
      if (this.invVisible) return
      if (!this.craftVisible) return
      this.craftScroll += deltaY > 0 ? 1 : -1
      this.craftScroll = Math.max(0, this.craftScroll)
    })

    // ── Inventory panel ──────────────────────────────────
    this.createInventoryPanel()
  }

  private createInventoryPanel() {
    const { width, height } = this.scale
    const invX = (width - INV_W) / 2
    const invY = (height - INV_H) / 2

    this.invGfx = this.add.graphics().setDepth(310)

    this.invTitle = this.add.text(width / 2, invY + INV_PAD + 2, 'INVENTORY', {
      fontSize: '14px', color: '#ffff00', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(311).setVisible(false)

    const mainStartY = invY + INV_PAD + INV_TITLE_H
    const hotbarStartY = mainStartY + INV_MAIN_H + INV_SEP

    // Create slots: 0-29 = main inventory, 30-39 = hotbar
    for (let i = 0; i < INV_TOTAL_SLOTS; i++) {
      let sx: number, sy: number
      if (i < 30) {
        const row = Math.floor(i / INV_COLS)
        const col = i % INV_COLS
        sx = invX + INV_PAD + col * (SLOT_SIZE + SLOT_GAP)
        sy = mainStartY + row * (SLOT_SIZE + SLOT_GAP)
      } else {
        const col = i - 30
        sx = invX + INV_PAD + col * (SLOT_SIZE + SLOT_GAP)
        sy = hotbarStartY
      }

      // Interactive zone
      const zone = this.add.zone(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2, SLOT_SIZE, SLOT_SIZE)
        .setInteractive()
        .setDepth(313)
      zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onInvSlotClick(i, pointer))
      this.invSlotZones.push(zone)

      // Item icon (colored rectangle fallback)
      const icon = this.add.rectangle(
        sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2,
        SLOT_SIZE - 12, SLOT_SIZE - 12, 0x000000, 0
      ).setDepth(311).setVisible(false)
      this.invSlotIcons.push(icon)
      this.invSlotImages.push(null)

      // Count text
      const txt = this.add.text(sx + SLOT_SIZE - 4, sy + SLOT_SIZE - 4, '', {
        fontSize: '10px', color: '#ffffff', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(1, 1).setDepth(312).setVisible(false)
      this.invSlotTexts.push(txt)
    }

    // Tooltip for hovered slot
    this.invTooltipText = this.add.text(width / 2, invY - 4, '', {
      fontSize: '11px', color: '#aaaaaa', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(315).setVisible(false)

    // ── Armor panel (right of inventory) ──────────────
    this.armorGfx = this.add.graphics().setDepth(310)
    const armorLabels = ['H', 'C', 'L', 'B']
    const armorPanelX = invX + INV_W + 6
    const armorPanelY = invY

    for (let i = 0; i < 4; i++) {
      const sy = armorPanelY + INV_PAD + INV_TITLE_H + i * (SLOT_SIZE + SLOT_GAP)
      const sx = armorPanelX + INV_PAD

      const zone = this.add.zone(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2, SLOT_SIZE, SLOT_SIZE)
        .setInteractive().setDepth(313)
      zone.on('pointerdown', () => this.onArmorSlotClick(i))
      this.armorSlotZones.push(zone)

      const icon = this.add.rectangle(
        sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2,
        SLOT_SIZE - 12, SLOT_SIZE - 12, 0x000000, 0
      ).setDepth(311).setVisible(false)
      this.armorSlotIcons.push(icon)
      this.armorSlotImages.push(null)

      const label = this.add.text(sx - 2, sy + SLOT_SIZE / 2, armorLabels[i]!, {
        fontSize: '9px', color: '#555555', fontFamily: 'monospace',
      }).setOrigin(1, 0.5).setDepth(312).setVisible(false)
      this.armorSlotLabels.push(label)
    }

    this.armorDefenseText = this.add.text(
      armorPanelX + INV_PAD + SLOT_SIZE / 2,
      armorPanelY + INV_PAD + INV_TITLE_H + 4 * (SLOT_SIZE + SLOT_GAP) + 4,
      '', { fontSize: '10px', color: '#88aaff', fontFamily: 'monospace', stroke: '#000000', strokeThickness: 2 }
    ).setOrigin(0.5, 0).setDepth(312).setVisible(false)

    // Held item display (follows cursor)
    this.heldIcon = this.add.rectangle(0, 0, SLOT_SIZE - 12, SLOT_SIZE - 12, 0x000000, 0)
      .setDepth(420).setVisible(false)
    this.heldText = this.add.text(0, 0, '', {
      fontSize: '10px', color: '#ffffff', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 1).setDepth(421).setVisible(false)
  }

  override update() {
    const worldScene = this.scene.get('WorldScene') as any
    if (!worldScene?.getPlayer) return
    const player = worldScene.getPlayer()
    if (!player) return
    const chunks = worldScene.getChunkManager()

    const inv: InventoryManager = player.inventory
    this.updateSlots(inv)
    this.updateSelector(inv.selectedSlot)
    this.updateTooltip(inv)
    this.updateStatsBars(player)
    this.updateCrafting(player, inv, chunks)
    this.updateInventoryPanel(player, inv)
  }

  // ── Hotbar ──────────────────────────────────────────────

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

  /** Get the appropriate texture key for an item */
  private getItemTexKey(itemId: number): string {
    return itemId < 100 ? `tile_${itemId}` : `item_${itemId}`
  }

  private updateSlots(inv: InventoryManager) {
    const { width, height } = this.scale
    const hotbarX = (width - HOTBAR_WIDTH) / 2
    const hotbarY = height - SLOT_SIZE - 12

    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const item = inv.hotbar[i] ?? null
      const icon = this.slotIcons[i]!
      const txt = this.slotTexts[i]!
      const sx = hotbarX + i * (SLOT_SIZE + SLOT_GAP) + SLOT_SIZE / 2

      if (item) {
        const def = getItemDef(item.id)
        const tileProps = TILE_PROPERTIES[item.id as TileType]
        const texKey = this.getItemTexKey(item.id)

        if (this.textures.exists(texKey)) {
          icon.fillAlpha = 0
          if (!this.slotImages[i] || this.slotImages[i]!.texture.key !== texKey) {
            if (this.slotImages[i]) this.slotImages[i]!.destroy()
            this.slotImages[i] = this.add.image(sx, hotbarY + SLOT_SIZE / 2, texKey)
              .setDisplaySize(SLOT_SIZE - 12, SLOT_SIZE - 12)
              .setDepth(201)
          }
        } else {
          // Colored rectangle fallback
          const color = def?.color ?? tileProps?.color ?? 0xffffff
          icon.fillColor = color
          icon.fillAlpha = 1
          if (this.slotImages[i]) {
            this.slotImages[i]!.destroy()
            this.slotImages[i] = null
          }
        }
        txt.setText(item.count > 1 ? `${item.count}` : '')
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
    const { width, height } = this.scale
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
      this.tooltipText.setText(def?.name ?? tileProps?.name ?? `Item ${item.id}`)
      this.tooltipText.setAlpha(1)
    } else {
      this.tooltipText.setAlpha(0)
    }
  }

  // ── HP/Mana bars ───────────────────────────────────────

  private updateStatsBars(player: any) {
    this.statsGfx.clear()

    const barW = 120
    const barH = 10
    const x = 10
    const hpY = 46
    const manaY = 62

    // HP bar background
    this.statsGfx.fillStyle(0x330000, 0.8)
    this.statsGfx.fillRect(x, hpY, barW, barH)
    // HP fill
    const hpPct = Math.max(0, player.hp / player.maxHp)
    this.statsGfx.fillStyle(0xff2222, 0.9)
    this.statsGfx.fillRect(x, hpY, barW * hpPct, barH)
    // HP border
    this.statsGfx.lineStyle(1, 0x882222)
    this.statsGfx.strokeRect(x, hpY, barW, barH)
    const totalDef = player.inventory.getTotalDefense()
    const defStr = totalDef > 0 ? ` [${totalDef}DEF]` : ''
    this.hpText.setText(`HP ${Math.ceil(player.hp)}/${player.maxHp}${defStr}`)

    // Mana bar background
    this.statsGfx.fillStyle(0x000033, 0.8)
    this.statsGfx.fillRect(x, manaY, barW, barH)
    // Mana fill
    const manaPct = Math.max(0, player.mana / player.maxMana)
    this.statsGfx.fillStyle(0x2244ff, 0.9)
    this.statsGfx.fillRect(x, manaY, barW * manaPct, barH)
    // Mana border
    this.statsGfx.lineStyle(1, 0x222288)
    this.statsGfx.strokeRect(x, manaY, barW, barH)
    this.manaText.setText(`MP ${Math.ceil(player.mana)}/${player.maxMana}`)

    // Jetpack fuel bar (only if player has jetpack)
    if (player.hasJetpack) {
      const fuelY = 78
      this.statsGfx.fillStyle(0x333300, 0.8)
      this.statsGfx.fillRect(x, fuelY, barW, barH)
      const fuelPct = Math.max(0, player.jetpackFuel / player.maxJetpackFuel)
      this.statsGfx.fillStyle(0xffaa00, 0.9)
      this.statsGfx.fillRect(x, fuelY, barW * fuelPct, barH)
      this.statsGfx.lineStyle(1, 0x886622)
      this.statsGfx.strokeRect(x, fuelY, barW, barH)
    }

    // Death overlay
    this.deathText.setVisible(player.dead === true)

    // Boss HP bar (top center)
    const worldScene = this.scene.get('WorldScene') as any
    const boss = worldScene?.getActiveBoss?.()
    if (boss && boss.alive) {
      const { width } = this.scale
      const bossBarW = 300
      const bossBarH = 12
      const bossX = (width - bossBarW) / 2
      const bossY = 10

      this.statsGfx.fillStyle(0x330000, 0.9)
      this.statsGfx.fillRect(bossX, bossY, bossBarW, bossBarH)

      const bossPct = Math.max(0, boss.hp / boss.def.maxHp)
      this.statsGfx.fillStyle(0xff2222, 0.9)
      this.statsGfx.fillRect(bossX, bossY, bossBarW * bossPct, bossBarH)

      this.statsGfx.lineStyle(2, 0xff4444)
      this.statsGfx.strokeRect(bossX, bossY, bossBarW, bossBarH)
    }
  }

  // ── Crafting ────────────────────────────────────────────

  private updateCrafting(player: any, inv: InventoryManager, chunks: any) {
    const shouldShow = player.craftingOpen === true
    if (shouldShow !== this.craftVisible) {
      this.craftVisible = shouldShow
      this.craftScroll = 0
    }

    this.craftGfx.clear()
    this.craftTitle.setVisible(this.craftVisible)

    if (!this.craftVisible) {
      for (const t of this.craftTexts) t.setVisible(false)
      return
    }

    // Get recipes
    this.craftRecipes = this.craftingManager.getAvailableRecipes(
      player.sprite.x, player.sprite.y, chunks
    )
    this.craftingManager.checkCraftable(this.craftRecipes, inv)

    // Draw panel background
    const { width, height } = this.scale
    const craftX = (width - CRAFT_W) / 2
    const craftY = (height - CRAFT_H) / 2 - 20

    this.craftGfx.fillStyle(0x0a0a1a, 0.95)
    this.craftGfx.fillRect(craftX, craftY, CRAFT_W, CRAFT_H)
    this.craftGfx.lineStyle(2, 0x444466)
    this.craftGfx.strokeRect(craftX, craftY, CRAFT_W, CRAFT_H)

    // Clamp scroll
    const maxVisible = this.craftTexts.length
    const maxScroll = Math.max(0, this.craftRecipes.length - maxVisible)
    this.craftScroll = Phaser.Math.Clamp(this.craftScroll, 0, maxScroll)

    // Render recipe rows
    for (let i = 0; i < maxVisible; i++) {
      const recipeIdx = i + this.craftScroll
      const txt = this.craftTexts[i]!

      const entry = this.craftRecipes[recipeIdx]
      if (entry) {
        const { recipe, canCraft } = entry
        const outDef = getItemDef(recipe.output.itemId)
        const outName = outDef?.name ?? `Item ${recipe.output.itemId}`
        const qty = recipe.output.count > 1 ? ` x${recipe.output.count}` : ''

        const inputStr = recipe.inputs.map((inp: { itemId: number; count: number }) => {
          const def = getItemDef(inp.itemId)
          const name = def?.name ?? TILE_PROPERTIES[inp.itemId as TileType]?.name ?? '?'
          return `${name}x${inp.count}`
        }).join(', ')

        txt.setText(`${outName}${qty}  [${inputStr}]`)
        txt.setColor(canCraft ? '#00ff88' : '#666666')
        txt.setVisible(true)
        txt.setPosition(craftX + 10, craftY + 38 + i * CRAFT_ROW_H)

        if (canCraft) {
          this.craftGfx.fillStyle(0x003322, 0.3)
        } else {
          this.craftGfx.fillStyle(0x111122, 0.3)
        }
        this.craftGfx.fillRect(craftX + 2, craftY + 36 + i * CRAFT_ROW_H, CRAFT_W - 4, CRAFT_ROW_H)
      } else {
        txt.setVisible(false)
      }
    }
  }

  private onCraftClick(rowIndex: number) {
    if (!this.craftVisible) return
    const recipeIdx = rowIndex + this.craftScroll
    const entry = this.craftRecipes[recipeIdx]
    if (!entry || !entry.canCraft) return

    const worldScene = this.scene.get('WorldScene') as any
    const player = worldScene?.getPlayer()
    if (!player) return

    this.craftingManager.craft(entry.recipe, player.inventory)
    AudioManager.get()?.play(SoundId.CRAFT_SUCCESS)
  }

  private refreshCraftRowColor(txt: Phaser.GameObjects.Text, rowIndex: number) {
    const recipeIdx = rowIndex + this.craftScroll
    const entry = this.craftRecipes[recipeIdx]
    if (entry) {
      txt.setColor(entry.canCraft ? '#00ff88' : '#666666')
    }
  }

  // ── Inventory Panel ───────────────────────────────────

  private updateInventoryPanel(player: any, inv: InventoryManager) {
    const shouldShow = player.inventoryOpen === true
    if (shouldShow !== this.invVisible) {
      this.invVisible = shouldShow
    }

    this.invGfx.clear()
    this.armorGfx.clear()
    this.invTitle.setVisible(this.invVisible)
    this.invTooltipText.setVisible(false)

    if (!this.invVisible) {
      for (let i = 0; i < INV_TOTAL_SLOTS; i++) {
        this.invSlotIcons[i]!.setVisible(false)
        this.invSlotTexts[i]!.setVisible(false)
        this.invSlotZones[i]!.setActive(false)
        if (this.invSlotImages[i]) {
          this.invSlotImages[i]!.setVisible(false)
        }
      }
      for (let i = 0; i < 4; i++) {
        this.armorSlotIcons[i]!.setVisible(false)
        this.armorSlotLabels[i]!.setVisible(false)
        this.armorSlotZones[i]!.setActive(false)
        if (this.armorSlotImages[i]) {
          this.armorSlotImages[i]!.setVisible(false)
        }
      }
      this.armorDefenseText.setVisible(false)
      this.heldIcon.setVisible(false)
      this.heldText.setVisible(false)
      if (this.heldImage) this.heldImage.setVisible(false)
      return
    }

    const { width, height } = this.scale
    const invX = (width - INV_W) / 2
    const invY = (height - INV_H) / 2

    // Draw panel background
    this.invGfx.fillStyle(0x0a0a1a, 0.95)
    this.invGfx.fillRect(invX, invY, INV_W, INV_H)
    this.invGfx.lineStyle(2, 0x444466)
    this.invGfx.strokeRect(invX, invY, INV_W, INV_H)

    const mainStartY = invY + INV_PAD + INV_TITLE_H
    const hotbarStartY = mainStartY + INV_MAIN_H + INV_SEP

    // Separator line above hotbar row
    this.invGfx.lineStyle(1, 0x333355)
    this.invGfx.lineBetween(
      invX + INV_PAD, hotbarStartY - INV_SEP / 2,
      invX + INV_W - INV_PAD, hotbarStartY - INV_SEP / 2
    )

    // Track hovered slot for tooltip
    const pointer = this.input.activePointer
    let hoveredItem: ItemStack | null = null

    for (let i = 0; i < INV_TOTAL_SLOTS; i++) {
      let sx: number, sy: number
      let item: ItemStack | null
      if (i < 30) {
        const row = Math.floor(i / INV_COLS)
        const col = i % INV_COLS
        sx = invX + INV_PAD + col * (SLOT_SIZE + SLOT_GAP)
        sy = mainStartY + row * (SLOT_SIZE + SLOT_GAP)
        item = inv.mainInventory[i] ?? null
      } else {
        const col = i - 30
        sx = invX + INV_PAD + col * (SLOT_SIZE + SLOT_GAP)
        sy = hotbarStartY
        item = inv.hotbar[col] ?? null
      }

      // Slot background
      this.invGfx.fillStyle(0x111111, 0.85)
      this.invGfx.fillRect(sx, sy, SLOT_SIZE, SLOT_SIZE)
      this.invGfx.lineStyle(1, 0x444444, 0.9)
      this.invGfx.strokeRect(sx, sy, SLOT_SIZE, SLOT_SIZE)

      // Highlight selected hotbar slot
      if (i >= 30 && i - 30 === inv.selectedSlot) {
        this.invGfx.lineStyle(2, 0xffff00, 1)
        this.invGfx.strokeRect(sx - 1, sy - 1, SLOT_SIZE + 2, SLOT_SIZE + 2)
      }

      // Hover highlight + tooltip
      if (pointer.x >= sx && pointer.x < sx + SLOT_SIZE &&
          pointer.y >= sy && pointer.y < sy + SLOT_SIZE && item) {
        hoveredItem = item
        this.invGfx.fillStyle(0xffffff, 0.1)
        this.invGfx.fillRect(sx, sy, SLOT_SIZE, SLOT_SIZE)
      }

      this.invSlotZones[i]!.setActive(true)

      // Render item
      const icon = this.invSlotIcons[i]!
      const txt = this.invSlotTexts[i]!
      icon.setPosition(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2)
      txt.setPosition(sx + SLOT_SIZE - 4, sy + SLOT_SIZE - 4)

      if (item) {
        const def = getItemDef(item.id)
        const tileProps = TILE_PROPERTIES[item.id as TileType]
        const texKey = this.getItemTexKey(item.id)

        if (this.textures.exists(texKey)) {
          icon.fillAlpha = 0
          icon.setVisible(true)
          const existingImg = this.invSlotImages[i]
          if (!existingImg || existingImg.texture.key !== texKey) {
            if (existingImg) existingImg.destroy()
            this.invSlotImages[i] = this.add.image(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2, texKey)
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

    // Tooltip
    if (hoveredItem) {
      const def = getItemDef(hoveredItem.id)
      const tileProps = TILE_PROPERTIES[hoveredItem.id as TileType]
      let name = def?.name ?? tileProps?.name ?? `Item ${hoveredItem.id}`
      if (def?.defense) name += ` (+${def.defense} def)`
      this.invTooltipText.setText(name)
      this.invTooltipText.setPosition(width / 2, invY - 4)
      this.invTooltipText.setVisible(true)
    }

    // ── Armor slots (right of inventory panel) ──────
    this.updateArmorPanel(inv, invX, invY, pointer)

    this.updateHeldItem(inv)
  }

  private updateArmorPanel(inv: InventoryManager, invX: number, invY: number, pointer: Phaser.Input.Pointer) {
    const armorPanelX = invX + INV_W + 6
    const armorPanelW = SLOT_SIZE + INV_PAD * 2
    const armorPanelH = INV_PAD + INV_TITLE_H + 4 * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP + INV_PAD + 16

    // Panel background
    this.armorGfx.fillStyle(0x0a0a1a, 0.95)
    this.armorGfx.fillRect(armorPanelX, invY, armorPanelW, armorPanelH)
    this.armorGfx.lineStyle(2, 0x444466)
    this.armorGfx.strokeRect(armorPanelX, invY, armorPanelW, armorPanelH)

    for (let i = 0; i < 4; i++) {
      const slot = ARMOR_SLOT_ORDER[i]!
      const item = inv.armorSlots[slot]
      const sy = invY + INV_PAD + INV_TITLE_H + i * (SLOT_SIZE + SLOT_GAP)
      const sx = armorPanelX + INV_PAD

      // Slot background
      this.armorGfx.fillStyle(0x1a1a2e, 0.85)
      this.armorGfx.fillRect(sx, sy, SLOT_SIZE, SLOT_SIZE)
      this.armorGfx.lineStyle(1, 0x555577, 0.9)
      this.armorGfx.strokeRect(sx, sy, SLOT_SIZE, SLOT_SIZE)

      // Hover highlight
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

      this.armorSlotZones[i]!.setActive(true)
      this.armorSlotZones[i]!.setPosition(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2)
      this.armorSlotLabels[i]!.setPosition(sx - 2, sy + SLOT_SIZE / 2)
      this.armorSlotLabels[i]!.setVisible(true)

      const icon = this.armorSlotIcons[i]!
      icon.setPosition(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2)

      if (item) {
        const def = getItemDef(item.id)
        const texKey = this.getItemTexKey(item.id)

        if (this.textures.exists(texKey)) {
          icon.fillAlpha = 0
          icon.setVisible(true)
          const existing = this.armorSlotImages[i]
          if (!existing || existing.texture.key !== texKey) {
            if (existing) existing.destroy()
            this.armorSlotImages[i] = this.add.image(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2, texKey)
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

    // Defense total
    const totalDef = inv.getTotalDefense()
    this.armorDefenseText.setText(`DEF ${totalDef}`)
    this.armorDefenseText.setPosition(
      armorPanelX + armorPanelW / 2,
      invY + INV_PAD + INV_TITLE_H + 4 * (SLOT_SIZE + SLOT_GAP) + 2
    )
    this.armorDefenseText.setVisible(true)
  }

  private updateHeldItem(inv: InventoryManager) {
    const held = inv.heldItem
    if (!held) {
      this.heldIcon.setVisible(false)
      this.heldText.setVisible(false)
      if (this.heldImage) this.heldImage.setVisible(false)
      return
    }

    const pointer = this.input.activePointer
    const cx = pointer.x
    const cy = pointer.y

    const def = getItemDef(held.id)
    const tileProps = TILE_PROPERTIES[held.id as TileType]
    const texKey = this.getItemTexKey(held.id)

    if (this.textures.exists(texKey)) {
      this.heldIcon.setVisible(false)
      if (!this.heldImage || this.heldImage.texture.key !== texKey) {
        if (this.heldImage) this.heldImage.destroy()
        this.heldImage = this.add.image(cx, cy, texKey)
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

  private onArmorSlotClick(index: number) {
    if (!this.invVisible) return
    const worldScene = this.scene.get('WorldScene') as any
    const player = worldScene?.getPlayer()
    if (!player) return

    const inv: InventoryManager = player.inventory
    const slot = ARMOR_SLOT_ORDER[index]!
    inv.clickArmorSlot(slot)
    AudioManager.get()?.play(SoundId.SLOT_CHANGE)
  }

  private onInvSlotClick(slotIndex: number, pointer: Phaser.Input.Pointer) {
    if (!this.invVisible) return

    const worldScene = this.scene.get('WorldScene') as any
    const player = worldScene?.getPlayer()
    if (!player) return

    const inv: InventoryManager = player.inventory
    const area: 'hotbar' | 'main' = slotIndex >= 30 ? 'hotbar' : 'main'
    const idx = slotIndex >= 30 ? slotIndex - 30 : slotIndex

    if (pointer.button === 2) {
      inv.rightClickSlot(area, idx)
    } else {
      inv.clickSlot(area, idx)
    }

    AudioManager.get()?.play(SoundId.SLOT_CHANGE)
  }
}
