import Phaser from 'phaser'
import { TileType, TILE_PROPERTIES } from '../world/TileRegistry'
import { InventoryManager } from '../systems/InventoryManager'
import type { ItemStack } from '../systems/InventoryManager'
import { CraftingManager } from '../systems/CraftingManager'
import type { Recipe } from '../data/recipes'
import { ITEMS, getItemDef } from '../data/items'

const SLOT_SIZE = 40
const SLOT_GAP = 4
const HOTBAR_SLOTS = 10
const HOTBAR_WIDTH = HOTBAR_SLOTS * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP

// Crafting panel
const CRAFT_W = 320
const CRAFT_H = 400
const CRAFT_ROW_H = 32

export class UIScene extends Phaser.Scene {
  private hotbarGfx!: Phaser.GameObjects.Graphics
  private slotTexts: Phaser.GameObjects.Text[] = []
  private slotIcons: Phaser.GameObjects.Rectangle[] = []
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
      }).setDepth(301).setVisible(false).setInteractive()
      t.on('pointerdown', () => this.onCraftClick(i))
      t.on('pointerover', () => t.setColor('#ffffff'))
      t.on('pointerout', () => this.refreshCraftRowColor(t, i))
      this.craftTexts.push(t)
    }

    // Scroll crafting with wheel
    this.input.on('wheel', (_p: any, _gx: any, _gy: any, _gz: any, _delta: number, deltaY: number) => {
      if (!this.craftVisible) return
      this.craftScroll += deltaY > 0 ? 1 : -1
      this.craftScroll = Math.max(0, this.craftScroll)
    })
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

  private updateSlots(inv: InventoryManager) {
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const item = inv.hotbar[i] ?? null
      const icon = this.slotIcons[i]!
      const txt = this.slotTexts[i]!

      if (item) {
        const def = getItemDef(item.id)
        const tileProps = TILE_PROPERTIES[item.id as TileType]
        const color = def?.color ?? tileProps?.color ?? 0xffffff
        icon.fillColor = color
        icon.fillAlpha = 1
        txt.setText(item.count > 1 ? `${item.count}` : '')
      } else {
        icon.fillAlpha = 0
        txt.setText('')
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
    this.hpText.setText(`HP ${Math.ceil(player.hp)}/${player.maxHp}`)

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
  }

  private refreshCraftRowColor(txt: Phaser.GameObjects.Text, rowIndex: number) {
    const recipeIdx = rowIndex + this.craftScroll
    const entry = this.craftRecipes[recipeIdx]
    if (entry) {
      txt.setColor(entry.canCraft ? '#00ff88' : '#666666')
    }
  }
}
