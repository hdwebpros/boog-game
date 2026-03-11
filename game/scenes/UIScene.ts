import Phaser from 'phaser'
import { TileType, TILE_PROPERTIES, TILE_SIZE, WORLD_WIDTH } from '../world/TileRegistry'
import { InventoryManager, ARMOR_SLOT_ORDER } from '../systems/InventoryManager'
import type { ItemStack } from '../systems/InventoryManager'
import type { ArmorSlot } from '../data/items'
import { CraftingManager } from '../systems/CraftingManager'
import type { Recipe } from '../data/recipes'
import { ITEMS, getItemDef, ItemCategory, ENCHANTMENT_NAMES, ENCHANTMENT_COLORS } from '../data/items'
import { AudioManager } from '../systems/AudioManager'
import { SoundId } from '../data/sounds'
import { SKILLS, SKILL_MAP, BRANCH_INFO, BRANCH_ORDER, SUPER_TREES, SUPER_TREE_MAP, xpForLevel } from '../data/skills'
import type { SkillDef } from '../data/skills'
import type { SkillTreeManager } from '../systems/SkillTreeManager'
import { MiniMap } from '../systems/MiniMap'
import type { BossMarker } from '../systems/MiniMap'
import { SurfaceBiome } from '../world/WorldGenerator'
import type { WorldData } from '../world/WorldGenerator'
import { SHOP_INVENTORY, SELL_PRICES } from '../data/shop'
import { ACCESSORY_EFFECTS } from '../data/accessories'
import { CHEST_SLOTS } from '../world/ChunkManager'
import { ChatOverlay } from '../multiplayer/ChatOverlay'

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

// Skill tree panel
const SKILL_W = 520
const SKILL_H = 440
const SKILL_NODE_SIZE = 36
const SKILL_NODE_GAP_X = 56
const SKILL_NODE_GAP_Y = 70
const SKILL_BRANCH_PAD = 10
const SUPER_ROW_Y_OFFSET = 235 // px below startY for super tier row

// Jetpack parts tracker (IDs 180-185, dropped by bosses)
const JETPACK_PARTS = [
  { id: 180, name: 'Fuel Cell',   color: 0xddaa33 },
  { id: 181, name: 'Thruster',    color: 0xbbbbbb },
  { id: 182, name: 'Valve',       color: 0x5599cc },
  { id: 183, name: 'Capacitor',   color: 0xcc66ff },
  { id: 184, name: 'Ignition',    color: 0xff6600 },
  { id: 185, name: 'Nav Module',  color: 0x00ffaa },
]

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
  private armorText!: Phaser.GameObjects.Text
  private deathText!: Phaser.GameObjects.Text

  // Crafting
  private craftingManager = new CraftingManager()
  private craftGfx!: Phaser.GameObjects.Graphics
  private craftTexts: Phaser.GameObjects.Text[] = []
  private craftTitle!: Phaser.GameObjects.Text
  private craftVisible = false
  private craftScroll = 0
  private craftRecipes: { recipe: Recipe; canCraft: boolean }[] = []
  private craftHoveredRow = -1

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

  // Trash slot
  private trashZone!: Phaser.GameObjects.Zone
  private trashLabel!: Phaser.GameObjects.Text

  // Day/night indicator (sun & moon icons)
  private sunIcon!: Phaser.GameObjects.Graphics
  private moonIcon!: Phaser.GameObjects.Image

  // Jetpack parts tracker
  private partsLabel!: Phaser.GameObjects.Text

  // Mini-map
  private miniMap!: MiniMap

  // Skill tree
  private skillGfx!: Phaser.GameObjects.Graphics
  private skillTitle!: Phaser.GameObjects.Text
  private skillInfoText!: Phaser.GameObjects.Text
  private skillNodeZones: Phaser.GameObjects.Zone[] = []
  private skillNodeTexts: Phaser.GameObjects.Text[] = [] // abbreviation labels
  private skillNameTexts: Phaser.GameObjects.Text[] = [] // name labels below nodes
  private skillBranchLabels: Phaser.GameObjects.Text[] = []
  private skillNodeSkills: SkillDef[] = [] // parallel array with zones
  private skillVisible = false
  private skillXpText!: Phaser.GameObjects.Text

  // Shop panel
  private shopGfx!: Phaser.GameObjects.Graphics
  private shopTexts: Phaser.GameObjects.Text[] = []
  private shopTitle!: Phaser.GameObjects.Text
  private shopVisible = false
  private shopTab: 'buy' | 'sell' = 'buy'
  private shopScroll = 0
  private shopClickCooldown = 0  // prevent rapid clicks
  private prevPointerDown = false // for justDown detection
  private pointerJustDown = false
  private shopClickPending: { x: number; y: number } | null = null

  // Chest panel
  private chestGfx!: Phaser.GameObjects.Graphics
  private chestTexts: Phaser.GameObjects.Text[] = []
  private chestTitle!: Phaser.GameObjects.Text
  private chestVisible = false

  // Biome banner
  private biomeBannerText!: Phaser.GameObjects.Text
  private visitedZones = new Set<string>()
  private currentZoneName = ''

  // Chat overlay (multiplayer)
  private chatOverlay: ChatOverlay | null = null

  constructor() {
    super({ key: 'UIScene' })
  }

  create() {
    // Reset arrays to prevent stale references after scene restart
    this.slotTexts = []
    this.slotIcons = []
    this.slotImages = []
    this.invSlotIcons = []
    this.invSlotImages = []
    this.invSlotTexts = []
    this.invSlotZones = []
    this.armorSlotIcons = []
    this.armorSlotImages = []
    this.armorSlotLabels = []
    this.armorSlotZones = []
    this.craftTexts = []
    this.skillNodeZones = []
    this.skillNodeTexts = []
    this.skillNameTexts = []
    this.skillBranchLabels = []
    this.skillNodeSkills = []
    this.shopTexts = []
    this.chestTexts = []
    this.invVisible = false
    this.craftVisible = false
    this.skillVisible = false
    this.shopVisible = false
    this.chestVisible = false

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
    this.hpText = this.add.text(144, 46, '', {
      fontSize: '9px', color: '#ff8888', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setDepth(201)
    this.manaText = this.add.text(144, 60, '', {
      fontSize: '9px', color: '#8899ff', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setDepth(201)
    this.armorText = this.add.text(144, 74, '', {
      fontSize: '9px', color: '#ffdd66', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setDepth(201)

    // Day/Night indicator — sun & moon icons (top-right)
    const iconX = width - 18
    const iconY = 14

    // Sun: yellow circle with rays
    this.sunIcon = this.add.graphics().setDepth(201)
    this.sunIcon.setPosition(iconX, iconY)
    this.drawSun(this.sunIcon)

    // Moon: white crescent (pre-rendered to texture for proper transparency)
    this.createMoonTexture()
    this.moonIcon = this.add.image(iconX, iconY, 'moon_icon').setDepth(201)

    // Jetpack parts tracker label (below day/night)
    this.partsLabel = this.add.text(width - 10, 28, '', {
      fontSize: '9px', color: '#aaaaaa', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(201)

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
      this.craftTexts.push(t)
    }

    // Craft click & scroll via scene-level input (avoids depth/hit-area issues)
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Shop click tracking (event-based, more reliable than polling)
      if (this.shopVisible) {
        this.shopClickPending = { x: pointer.x, y: pointer.y }
      }

      if (!this.craftVisible || this.invVisible) return
      const cx = (this.scale.width - CRAFT_W) / 2
      const cy = (this.scale.height - CRAFT_H) / 2 - 20
      const listTop = cy + 36
      const listBot = listTop + this.craftTexts.length * CRAFT_ROW_H
      if (pointer.x < cx + 2 || pointer.x > cx + CRAFT_W - 2) return
      if (pointer.y < listTop || pointer.y >= listBot) return
      const row = Math.floor((pointer.y - listTop) / CRAFT_ROW_H)
      this.onCraftClick(row)
    })

    this.input.on('wheel', (_pointer: any, _gameObjects: any, _deltaX: number, deltaY: number) => {
      if (this.shopVisible) {
        this.shopScroll += deltaY > 0 ? 1 : -1
        this.shopScroll = Math.max(0, this.shopScroll)
        return
      }
      if (this.invVisible) return
      if (!this.craftVisible) return
      this.craftScroll += deltaY > 0 ? 1 : -1
      this.craftScroll = Math.max(0, this.craftScroll)
    })

    // ── Inventory panel ──────────────────────────────────
    this.createInventoryPanel()

    // ── Skill tree panel ──────────────────────────────
    this.createSkillTreePanel()

    // ── Mini-map ──────────────────────────────────────
    const worldData = this.registry.get('worldData') as WorldData
    if (worldData) {
      this.miniMap = new MiniMap(this, worldData)

      // Restore explored data from save
      const exploredMap = this.registry.get('exploredMap') as number[] | undefined
      if (exploredMap) {
        this.miniMap.loadExplored(exploredMap)
        this.registry.remove('exploredMap')
      }
    }

    // ── Biome banner ─────────────────────────────────
    this.biomeBannerText = this.add.text(width / 2, 80, '', {
      fontSize: '24px', color: '#ffffff', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5, 0.5).setDepth(210).setAlpha(0)

    // Map toggle (N) and zoom ([ / ])
    const keyN = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.N)
    keyN.on('down', () => { if (this.miniMap) this.miniMap.toggle() })
    const keyBracketOpen = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.OPEN_BRACKET)
    keyBracketOpen.on('down', () => { if (this.miniMap) this.miniMap.zoomOut() })
    const keyBracketClose = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.CLOSED_BRACKET)
    keyBracketClose.on('down', () => { if (this.miniMap) this.miniMap.zoomIn() })

    // ── Chat overlay (multiplayer) ──────────────────
    const worldScene = this.scene.get('WorldScene') as any
    const mp = worldScene?.getMultiplayer?.()
    if (mp && mp.isOnline) {
      this.chatOverlay = new ChatOverlay(this, mp)
    }

    // Clean up on scene shutdown
    this.events.on('shutdown', () => {
      if (this.miniMap) {
        this.miniMap.destroy()
      }
      if (this.chatOverlay) {
        this.chatOverlay.destroy()
        this.chatOverlay = null
      }
    })
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

    // Trash slot (below inventory, right-aligned)
    const trashX = invX + INV_W - SLOT_SIZE - INV_PAD
    const trashY = invY + INV_H + 4
    this.trashZone = this.add.zone(trashX + SLOT_SIZE / 2, trashY + SLOT_SIZE / 2, SLOT_SIZE, SLOT_SIZE)
      .setInteractive().setDepth(313)
    this.trashZone.on('pointerdown', () => this.onTrashClick())
    this.trashLabel = this.add.text(trashX + SLOT_SIZE / 2, trashY + SLOT_SIZE / 2, 'X', {
      fontSize: '16px', color: '#ff4444', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(312).setVisible(false)

    // Shop panel
    this.shopGfx = this.add.graphics().setDepth(330)
    this.shopTitle = this.add.text(0, 0, '', {
      fontSize: '14px', color: '#ffdd44', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(332).setVisible(false)

    // Chest panel
    this.chestGfx = this.add.graphics().setDepth(340)
    this.chestTitle = this.add.text(0, 0, '', {
      fontSize: '14px', color: '#ddaa55', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(342).setVisible(false)
  }

  override update() {
    if (!this.scene?.sys?.input) return
    const worldScene = this.scene.get('WorldScene') as any
    if (!worldScene?.getPlayer) return
    const player = worldScene.getPlayer()
    if (!player) return
    const chunks = worldScene.getChunkManager()

    const inv: InventoryManager = player.inventory

    // Track just-clicked state for shop/accessory panels
    const pointer = this.input.activePointer
    this.pointerJustDown = pointer.isDown && !this.prevPointerDown
    this.prevPointerDown = pointer.isDown
    this.shopClickCooldown = Math.max(0, this.shopClickCooldown - 1)

    this.updateSlots(inv)
    this.updateSelector(inv.selectedSlot)
    this.updateTooltip(inv)
    this.updateStatsBars(player)
    this.updateJetpackTracker(player)
    this.updateDayNight(worldScene)
    this.updateCrafting(player, inv, chunks)
    this.updateInventoryPanel(player, inv)
    this.updateSkillTree(player)
    this.updateShopPanel(player, inv)
    this.updateChestPanel(player, inv)
    if (this.miniMap) {
      this.miniMap.update(player.sprite.x, player.sprite.y)
      // Pass discovered altar positions to minimap for boss icons
      this.updateMinimapBossMarkers(worldScene)
    }
    this.updateBiomeBanner(player)
    this.chatOverlay?.update()
  }

  private getZoneName(px: number, py: number): string {
    const tileX = Math.floor(px / TILE_SIZE)
    const tileY = Math.floor(py / TILE_SIZE)

    // Sky / Cloud City
    if (py < 80 * 16) return 'Cloud City'
    // Deep underground / Core
    if (py >= 640 * 16) return 'The Core'
    // Underground
    if (py >= 130 * 16) return 'Underground'
    // Ocean edges
    if (tileX < 80 || tileX > WORLD_WIDTH - 80) return 'Ocean'

    // Surface biomes
    const worldData = this.registry.get('worldData') as WorldData | undefined
    const biome = worldData?.surfaceBiomes?.[tileX] ?? SurfaceBiome.PLAINS
    switch (biome) {
      case SurfaceBiome.FOREST:    return 'Forest'
      case SurfaceBiome.DESERT:    return 'Desert'
      case SurfaceBiome.MOUNTAINS: return 'Mountains'
      case SurfaceBiome.LAKE:      return 'Lake'
      case SurfaceBiome.SNOW:      return 'Snowfields'
      case SurfaceBiome.JUNGLE:    return 'Jungle'
      case SurfaceBiome.MUSHROOM:  return 'Mushroom Grotto'
      default:                     return 'Plains'
    }
  }

  private updateBiomeBanner(player: any) {
    const zoneName = this.getZoneName(player.sprite.x, player.sprite.y)
    if (zoneName === this.currentZoneName) return
    this.currentZoneName = zoneName

    if (this.visitedZones.has(zoneName)) return
    this.visitedZones.add(zoneName)

    // Fade in, hold, fade out
    this.biomeBannerText.setText(zoneName)
    this.tweens.killTweensOf(this.biomeBannerText)
    this.biomeBannerText.setAlpha(0)
    this.tweens.add({
      targets: this.biomeBannerText,
      alpha: 1,
      duration: 800,
      ease: 'Sine.easeIn',
      hold: 1500,
      yoyo: true,
    })
  }

  getExploredMap(): number[] | null {
    return this.miniMap?.getExplored() ?? null
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

    // Redraw hotbar background each frame (needed for enchantment glow pulse)
    this.drawHotbarBackground(hotbarX, hotbarY)

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
        // Enchantment glow border
        if (item.enchantment) {
          const enchColor = ENCHANTMENT_COLORS[item.enchantment] ?? 0xffffff
          const pulse = 0.5 + 0.3 * Math.sin(Date.now() * 0.004)
          this.hotbarGfx.lineStyle(2, enchColor, pulse)
          this.hotbarGfx.strokeRect(hotbarX + i * (SLOT_SIZE + SLOT_GAP) + 1, hotbarY + 1, SLOT_SIZE - 2, SLOT_SIZE - 2)
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

  // ── Icon shape helpers ─────────────────────────────────

  private starPoints(cx: number, cy: number, r: number): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = []
    for (let i = 0; i < 5; i++) {
      const outerAngle = -Math.PI / 2 + (2 * Math.PI / 5) * i
      pts.push({ x: cx + Math.cos(outerAngle) * r, y: cy + Math.sin(outerAngle) * r })
      const innerAngle = outerAngle + Math.PI / 5
      pts.push({ x: cx + Math.cos(innerAngle) * r * 0.38, y: cy + Math.sin(innerAngle) * r * 0.38 })
    }
    return pts
  }

  private diamondPoints(cx: number, cy: number, w: number, h: number): { x: number; y: number }[] {
    return [
      { x: cx, y: cy - h / 2 },
      { x: cx + w / 2, y: cy },
      { x: cx, y: cy + h / 2 },
      { x: cx - w / 2, y: cy },
    ]
  }

  private shieldPoints(cx: number, cy: number, w: number, h: number): { x: number; y: number }[] {
    return [
      { x: cx - w / 2, y: cy - h * 0.4 },
      { x: cx + w / 2, y: cy - h * 0.4 },
      { x: cx + w / 2, y: cy + h * 0.1 },
      { x: cx, y: cy + h * 0.6 },
      { x: cx - w / 2, y: cy + h * 0.1 },
    ]
  }

  // ── HP/Mana/Armor icons ──────────────────────────────────

  private updateStatsBars(player: any) {
    this.statsGfx.clear()

    const x = 10
    const iconR = 5
    const iconSpacing = 13
    const iconCount = 10
    const textX = x + iconCount * iconSpacing + 4
    const hpY = 46
    const manaY = 60

    // ── HP Stars ──
    const hpFilled = (player.hp / player.maxHp) * iconCount
    const lowHp = player.hp / player.maxHp < 0.25
    const pulse = lowHp ? 0.5 + 0.5 * Math.sin(this.time.now * 0.008) : 1

    for (let i = 0; i < iconCount; i++) {
      const cx = x + i * iconSpacing + iconR
      const cy = hpY + iconR
      const pts = this.starPoints(cx, cy, iconR)
      const fill = Math.max(0, Math.min(1, hpFilled - i))

      // Empty star background
      this.statsGfx.fillStyle(0x441111, 0.7)
      this.statsGfx.fillPoints(pts, true, true)

      if (fill > 0) {
        const alpha = (fill >= 1 ? 1 : fill * 0.5 + 0.4) * pulse
        this.statsGfx.fillStyle(0xff3333, alpha)
        this.statsGfx.fillPoints(pts, true, true)
      }

      this.statsGfx.lineStyle(1, lowHp ? 0xff4444 : 0xff6666, 0.3 * pulse)
      this.statsGfx.strokePoints(pts, true, true)
    }

    const totalDef = player.inventory.getTotalDefense()
    this.hpText.setPosition(textX, hpY)
    this.hpText.setText(`${Math.ceil(player.hp)}/${player.maxHp}`)

    // ── Mana Diamonds ──
    const manaFilled = (player.mana / player.maxMana) * iconCount

    for (let i = 0; i < iconCount; i++) {
      const cx = x + i * iconSpacing + iconR
      const cy = manaY + iconR
      const pts = this.diamondPoints(cx, cy, iconR * 1.6, iconR * 2)
      const fill = Math.max(0, Math.min(1, manaFilled - i))

      this.statsGfx.fillStyle(0x111133, 0.7)
      this.statsGfx.fillPoints(pts, true, true)

      if (fill > 0) {
        const alpha = fill >= 1 ? 1 : fill * 0.5 + 0.4
        this.statsGfx.fillStyle(0x4466ff, alpha)
        this.statsGfx.fillPoints(pts, true, true)
      }

      this.statsGfx.lineStyle(1, 0x6688ff, 0.3)
      this.statsGfx.strokePoints(pts, true, true)
    }

    this.manaText.setPosition(textX, manaY)
    this.manaText.setText(`${Math.ceil(player.mana)}/${player.maxMana}`)

    // ── Armor Shields ──
    let nextBarY = 74

    if (totalDef > 0) {
      const armorY = nextBarY
      const shieldCount = Math.min(10, Math.ceil(totalDef / 2))

      for (let i = 0; i < shieldCount; i++) {
        const cx = x + i * iconSpacing + iconR
        const cy = armorY + iconR
        const pts = this.shieldPoints(cx, cy, iconR * 1.5, iconR * 1.6)

        this.statsGfx.fillStyle(0xffcc22, 0.9)
        this.statsGfx.fillPoints(pts, true, true)
        this.statsGfx.lineStyle(1, 0xddaa00, 0.5)
        this.statsGfx.strokePoints(pts, true, true)
      }

      this.armorText.setPosition(x + shieldCount * iconSpacing + iconR + 4, armorY)
      this.armorText.setText(`${totalDef} DEF`)
      this.armorText.setVisible(true)
      nextBarY += 14
    } else {
      this.armorText.setVisible(false)
    }

    // Jetpack fuel bar (only if player has jetpack)
    const barW = 120
    const barH = 10
    if (player.hasJetpack) {
      const fuelY = nextBarY
      this.statsGfx.fillStyle(0x333300, 0.8)
      this.statsGfx.fillRect(x, fuelY, barW, barH)
      const fuelPct = Math.max(0, player.jetpackFuel / player.maxJetpackFuel)
      this.statsGfx.fillStyle(0xffaa00, 0.9)
      this.statsGfx.fillRect(x, fuelY, barW * fuelPct, barH)
      this.statsGfx.lineStyle(1, 0x886622)
      this.statsGfx.strokeRect(x, fuelY, barW, barH)
      nextBarY += 16
    }

    // Oxygen bar (visible when in water or oxygen not full)
    const showOxygen = player.isInWater || player.oxygen < player.maxOxygen
    if (showOxygen) {
      const o2Y = nextBarY
      this.statsGfx.fillStyle(0x003333, 0.8)
      this.statsGfx.fillRect(x, o2Y, barW, barH)
      const o2Pct = Math.max(0, player.oxygen / player.maxOxygen)
      const o2Color = o2Pct > 0.3 ? 0x00cccc : 0xcc4444
      this.statsGfx.fillStyle(o2Color, 0.9)
      this.statsGfx.fillRect(x, o2Y, barW * o2Pct, barH)
      this.statsGfx.lineStyle(1, 0x006666)
      this.statsGfx.strokeRect(x, o2Y, barW, barH)
      nextBarY += 16
    }

    // XP bar
    const skills: SkillTreeManager = player.skills
    const xpY = nextBarY
    this.statsGfx.fillStyle(0x002233, 0.8)
    this.statsGfx.fillRect(x, xpY, barW, barH)
    const xpNeeded = skills.xpToNextLevel()
    const xpPct = xpNeeded > 0 ? Math.min(1, skills.xp / xpNeeded) : 0
    this.statsGfx.fillStyle(0x44ffff, 0.9)
    this.statsGfx.fillRect(x, xpY, barW * xpPct, barH)
    this.statsGfx.lineStyle(1, 0x226688)
    this.statsGfx.strokeRect(x, xpY, barW, barH)

    // Level + SP display to the right of XP bar
    const spStr = skills.skillPoints > 0 ? ` [${skills.skillPoints}SP]` : ''
    if (!this.skillXpText) {
      // will be created in createSkillTreePanel
    } else {
      this.skillXpText.setText(`Lv${skills.level} ${skills.xp}/${xpNeeded}${spStr}`)
      this.skillXpText.setPosition(x, xpY + barH + 2)
      this.skillXpText.setVisible(true)
    }

    // Death overlay
    this.deathText.setVisible(player.dead === true)

    // Boss HP bar (top center) + off-screen indicator
    const worldScene = this.scene.get('WorldScene') as any
    const boss = worldScene?.getActiveBoss?.()
    if (boss && boss.alive) {
      const { width, height } = this.scale
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

      // Off-screen boss indicator arrow
      const cam = worldScene.cameras?.main as Phaser.Cameras.Scene2D.Camera | undefined
      if (cam) {
        const bsx = boss.sprite.x as number
        const bsy = boss.sprite.y as number
        // Camera world view (what's visible)
        const vl = cam.worldView.x
        const vt = cam.worldView.y
        const vr = vl + cam.worldView.width
        const vb = vt + cam.worldView.height
        const margin = 16
        const offScreen = bsx < vl + margin || bsx > vr - margin || bsy < vt + margin || bsy > vb - margin

        if (offScreen) {
          // Map boss world position to screen-space direction
          const cx = cam.worldView.centerX
          const cy = cam.worldView.centerY
          const dx = bsx - cx
          const dy = bsy - cy
          const angle = Math.atan2(dy, dx)

          // Place arrow at edge of screen with padding
          const pad = 30
          const hw = width / 2 - pad
          const hh = height / 2 - pad

          // Clamp to screen edge
          const absCos = Math.abs(Math.cos(angle))
          const absSin = Math.abs(Math.sin(angle))
          let ax: number, ay: number
          if (absCos * hh > absSin * hw) {
            // Hits left/right edge
            ax = width / 2 + Math.sign(Math.cos(angle)) * hw
            ay = height / 2 + Math.tan(angle) * Math.sign(Math.cos(angle)) * hw
          } else {
            // Hits top/bottom edge
            ax = width / 2 + (1 / Math.tan(angle)) * Math.sign(Math.sin(angle)) * hh
            ay = height / 2 + Math.sign(Math.sin(angle)) * hh
          }
          ay = Phaser.Math.Clamp(ay, pad, height - pad)
          ax = Phaser.Math.Clamp(ax, pad, width - pad)

          // Draw arrow triangle pointing toward boss
          const arrowSize = 10
          this.statsGfx.fillStyle(0xff2222, 0.9)
          this.statsGfx.fillTriangle(
            ax + Math.cos(angle) * arrowSize,
            ay + Math.sin(angle) * arrowSize,
            ax + Math.cos(angle + 2.4) * arrowSize,
            ay + Math.sin(angle + 2.4) * arrowSize,
            ax + Math.cos(angle - 2.4) * arrowSize,
            ay + Math.sin(angle - 2.4) * arrowSize,
          )
          // Outline
          this.statsGfx.lineStyle(2, 0xff6666, 0.8)
          this.statsGfx.strokeTriangle(
            ax + Math.cos(angle) * arrowSize,
            ay + Math.sin(angle) * arrowSize,
            ax + Math.cos(angle + 2.4) * arrowSize,
            ay + Math.sin(angle + 2.4) * arrowSize,
            ax + Math.cos(angle - 2.4) * arrowSize,
            ay + Math.sin(angle - 2.4) * arrowSize,
          )

          // Pulsing glow circle behind arrow
          const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.005)
          this.statsGfx.fillStyle(0xff2222, 0.3 * pulse)
          this.statsGfx.fillCircle(ax, ay, arrowSize + 4)
        }
      }
    }

  }

  private updateMinimapBossMarkers(worldScene: any) {
    if (!this.miniMap) return
    const discovered = worldScene?.getDiscoveredAltars?.() as Set<string> | undefined
    if (!discovered || discovered.size === 0) {
      this.miniMap.updateBossMarkers([])
      return
    }

    const markers: BossMarker[] = []
    for (const bossType of discovered) {
      const pos = worldScene.getDiscoveredAltarPosition?.(bossType) as { px: number; py: number } | null
      if (!pos) continue
      markers.push({ bossType, worldX: pos.px, worldY: pos.py })
    }
    this.miniMap.updateBossMarkers(markers)
  }

  // ── Day/Night indicator ────────────────────────────────

  private updateDayNight(worldScene: any) {
    const dn = worldScene?.getDayNight?.()
    if (!dn) return

    const t = dn.time as number
    // Sun visible during day: fade in at dawn (0.20-0.30), fade out at dusk (0.70-0.80)
    let sunAlpha = 0
    if (t >= 0.30 && t < 0.70) {
      sunAlpha = 1
    } else if (t >= 0.20 && t < 0.30) {
      sunAlpha = (t - 0.20) / 0.10
    } else if (t >= 0.70 && t < 0.80) {
      sunAlpha = 1 - (t - 0.70) / 0.10
    }
    this.sunIcon.setAlpha(sunAlpha)

    // Moon visible at night: inverse of sun
    let moonAlpha = 0
    if (t < 0.20 || t >= 0.80) {
      moonAlpha = 1
    } else if (t >= 0.20 && t < 0.30) {
      moonAlpha = 1 - (t - 0.20) / 0.10
    } else if (t >= 0.70 && t < 0.80) {
      moonAlpha = (t - 0.70) / 0.10
    }
    this.moonIcon.setAlpha(moonAlpha)
  }

  private drawSun(g: Phaser.GameObjects.Graphics) {
    // Glow
    g.fillStyle(0xffdd44, 0.3)
    g.fillCircle(0, 0, 10)
    // Core
    g.fillStyle(0xffdd44, 1)
    g.fillCircle(0, 0, 5)
    // Rays
    g.lineStyle(1.5, 0xffdd44, 0.8)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      g.beginPath()
      g.moveTo(cos * 7, sin * 7)
      g.lineTo(cos * 10, sin * 10)
      g.strokePath()
    }
  }

  private createMoonTexture() {
    const size = 24
    const cx = size / 2
    const cy = size / 2
    const rt = this.make.renderTexture({ x: 0, y: 0, width: size, height: size }, false)
    // Glow
    const glow = this.make.graphics({}, false)
    glow.fillStyle(0xaabbdd, 0.25)
    glow.fillCircle(cx, cy, 9)
    rt.draw(glow)
    glow.destroy()
    // Full moon circle
    const circle = this.make.graphics({}, false)
    circle.fillStyle(0xddddff, 1)
    circle.fillCircle(cx, cy, 5)
    rt.draw(circle)
    circle.destroy()
    // Erase portion to create crescent
    const cutout = this.make.graphics({}, false)
    cutout.fillStyle(0xffffff, 1)
    cutout.fillCircle(cx + 3, cy - 2, 4)
    rt.erase(cutout)
    cutout.destroy()
    // Save as reusable texture (guard against re-creation on scene restart)
    if (!this.textures.exists('moon_icon')) {
      rt.saveTexture('moon_icon')
    }
    rt.destroy()
  }

  // ── Jetpack Parts Tracker ──────────────────────────────

  private updateJetpackTracker(player: any) {
    const inv: InventoryManager = player.inventory
    const { width } = this.scale

    // Count collected parts
    let collected = 0
    const has: boolean[] = []
    for (const part of JETPACK_PARTS) {
      const owned = inv.getCount(part.id) > 0
      has.push(owned)
      if (owned) collected++
    }

    // Also complete if player already assembled jetpack
    const complete = player.hasJetpack || collected === 6

    // Draw part icons on statsGfx (already cleared each frame)
    const partSize = 8
    const partGap = 4
    const totalW = JETPACK_PARTS.length * (partSize + partGap) - partGap
    const rightX = width - 10
    const startX = rightX - totalW
    const partY = 28

    for (let i = 0; i < JETPACK_PARTS.length; i++) {
      const px = startX + i * (partSize + partGap)
      const py = partY
      const owned = has[i]!

      if (owned || complete) {
        // Filled part - glow effect
        const color = complete ? 0xffdd00 : JETPACK_PARTS[i]!.color
        const pulse = complete ? 0.8 + 0.2 * Math.sin(this.time.now * 0.004 + i * 0.5) : 1

        // Glow behind
        this.statsGfx.fillStyle(color, 0.2 * pulse)
        this.statsGfx.fillCircle(px + partSize / 2, py + partSize / 2, partSize * 0.8)

        // Filled square with rounded feel
        this.statsGfx.fillStyle(color, 0.9 * pulse)
        this.statsGfx.fillRect(px + 1, py + 1, partSize - 2, partSize - 2)

        this.statsGfx.lineStyle(1, 0xffffff, 0.5)
        this.statsGfx.strokeRect(px, py, partSize, partSize)
      } else {
        // Empty slot - dim outline
        this.statsGfx.fillStyle(0x222222, 0.5)
        this.statsGfx.fillRect(px + 1, py + 1, partSize - 2, partSize - 2)

        this.statsGfx.lineStyle(1, 0x555555, 0.4)
        this.statsGfx.strokeRect(px, py, partSize, partSize)
      }
    }

    // Label text
    if (complete) {
      this.partsLabel.setText('JETPACK READY')
      this.partsLabel.setColor('#ffdd00')
      this.partsLabel.setPosition(startX - 6, partY - 1)
      this.partsLabel.setOrigin(1, 0)
    } else {
      this.partsLabel.setText(`${collected}/6`)
      this.partsLabel.setColor('#aaaaaa')
      this.partsLabel.setPosition(startX - 6, partY - 1)
      this.partsLabel.setOrigin(1, 0)
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

    // Detect hovered row from pointer position
    const pointer = this.input.activePointer
    const listTop = craftY + 36
    const listBot = listTop + maxVisible * CRAFT_ROW_H
    if (pointer.x >= craftX + 2 && pointer.x <= craftX + CRAFT_W - 2 &&
        pointer.y >= listTop && pointer.y < listBot) {
      this.craftHoveredRow = Math.floor((pointer.y - listTop) / CRAFT_ROW_H)
    } else {
      this.craftHoveredRow = -1
    }

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
        const hovered = i === this.craftHoveredRow
        txt.setColor(hovered ? '#ffffff' : canCraft ? '#00ff88' : '#666666')
        txt.setVisible(true)
        txt.setPosition(craftX + 10, craftY + 38 + i * CRAFT_ROW_H)

        if (hovered && canCraft) {
          this.craftGfx.fillStyle(0x004433, 0.5)
        } else if (canCraft) {
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
      this.heldIcon?.setVisible(false)
      this.heldText?.setVisible(false)
      if (this.heldImage) this.heldImage.setVisible(false)
      this.trashLabel?.setVisible(false)
      this.trashZone?.disableInteractive()
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

      this.invSlotZones[i]!.setInteractive()

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
        if (item.enchantment) {
          const enchColor = ENCHANTMENT_COLORS[item.enchantment] ?? 0xffffff
          const pulse = 0.5 + 0.3 * Math.sin(Date.now() * 0.004)
          this.invGfx.lineStyle(2, enchColor, pulse)
          this.invGfx.strokeRect(sx + 1, sy + 1, SLOT_SIZE - 2, SLOT_SIZE - 2)
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

    // Tooltip
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

      this.armorSlotZones[i]!.setInteractive()
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

    // ── Accessory slots (below armor) ──────
    const accStartY = invY + INV_PAD + INV_TITLE_H + 4 * (SLOT_SIZE + SLOT_GAP) + 20
    const accLabels = ['A1', 'A2', 'A3']
    for (let i = 0; i < 3; i++) {
      const sx = armorPanelX + INV_PAD
      const sy = accStartY + i * (SLOT_SIZE + SLOT_GAP)
      const accItem = inv.accessorySlots[i] ?? null

      this.armorGfx.fillStyle(0x1a1a2e, 0.85)
      this.armorGfx.fillRect(sx, sy, SLOT_SIZE, SLOT_SIZE)
      this.armorGfx.lineStyle(1, 0x6688aa, 0.9)
      this.armorGfx.strokeRect(sx, sy, SLOT_SIZE, SLOT_SIZE)

      // Hover
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

        // Click to equip/swap
        if (this.pointerJustDown) {
          inv.clickAccessorySlot(i)
          AudioManager.get()?.play(SoundId.SLOT_CHANGE)
        }
      }

      // Draw item
      if (accItem) {
        const accDef = getItemDef(accItem.id)
        if (accDef) {
          this.armorGfx.fillStyle(accDef.color, 0.9)
          this.armorGfx.fillRect(sx + 6, sy + 6, SLOT_SIZE - 12, SLOT_SIZE - 12)
        }
      }
    }

    // Extend armor panel height to cover accessory slots
    const extendedH = armorPanelH + 3 * (SLOT_SIZE + SLOT_GAP) + 10
    this.armorGfx.fillStyle(0x0a0a1a, 0.95)
    this.armorGfx.fillRect(armorPanelX, invY + armorPanelH, armorPanelW, extendedH - armorPanelH)
    this.armorGfx.lineStyle(2, 0x444466)
    this.armorGfx.strokeRect(armorPanelX, invY, armorPanelW, extendedH)

    // ── Trash slot (below inventory, right-aligned) ──
    const trashX = invX + INV_W - SLOT_SIZE - INV_PAD
    const trashY = invY + INV_H + 4
    this.invGfx.fillStyle(0x1a0a0a, 0.95)
    this.invGfx.fillRect(trashX, trashY, SLOT_SIZE, SLOT_SIZE)
    this.invGfx.lineStyle(1, 0x884444, 0.9)
    this.invGfx.strokeRect(trashX, trashY, SLOT_SIZE, SLOT_SIZE)
    // Hover highlight
    if (pointer.x >= trashX && pointer.x < trashX + SLOT_SIZE &&
        pointer.y >= trashY && pointer.y < trashY + SLOT_SIZE) {
      this.invGfx.fillStyle(0xff4444, 0.15)
      this.invGfx.fillRect(trashX, trashY, SLOT_SIZE, SLOT_SIZE)
      if (inv.heldItem) {
        this.invTooltipText.setText('Trash item')
        this.invTooltipText.setVisible(true)
      }
    }
    this.trashZone.setPosition(trashX + SLOT_SIZE / 2, trashY + SLOT_SIZE / 2)
    this.trashZone.setInteractive()
    this.trashLabel.setPosition(trashX + SLOT_SIZE / 2, trashY + SLOT_SIZE / 2)
    this.trashLabel.setVisible(true)
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

  // ── Skill Tree ─────────────────────────────────────

  private createSkillTreePanel() {
    this.skillGfx = this.add.graphics().setDepth(320)

    const { width, height } = this.scale
    const panelX = (width - SKILL_W) / 2
    const panelY = (height - SKILL_H) / 2

    this.skillTitle = this.add.text(width / 2, panelY + 10, 'SKILL TREE', {
      fontSize: '16px', color: '#ffff00', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(321).setVisible(false)

    this.skillInfoText = this.add.text(width / 2, panelY + SKILL_H - 14, '', {
      fontSize: '10px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5, 1).setDepth(321).setVisible(false)

    // XP text under stats bars (always visible)
    this.skillXpText = this.add.text(10, 90, '', {
      fontSize: '9px', color: '#44ffff', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setDepth(201)

    // Create branch header labels
    const startX = panelX + 30
    const startY = panelY + 55

    for (let bi = 0; bi < BRANCH_ORDER.length; bi++) {
      const branch = BRANCH_ORDER[bi]!
      const info = BRANCH_INFO[branch]
      const bx = startX + bi * (SKILL_NODE_SIZE + SKILL_NODE_GAP_X) + SKILL_NODE_SIZE / 2
      const label = this.add.text(bx, panelY + 34, `[${info.icon}] ${info.name}`, {
        fontSize: '9px', color: info.colorStr, fontFamily: 'monospace',
      }).setOrigin(0.5, 0).setDepth(321).setVisible(false)
      this.skillBranchLabels.push(label)
    }

    // Create clickable zones and text labels for each skill node
    // Layout: 5 columns (branches), up to 3 rows (tiers 1-3)
    const normalSkills = SKILLS.filter(s => !s.superTree)
    for (const branch of BRANCH_ORDER) {
      const branchIdx = BRANCH_ORDER.indexOf(branch)
      const branchSkills = normalSkills.filter(s => s.branch === branch)

      for (const skill of branchSkills) {
        const tierSkills = branchSkills.filter(s => s.tier === skill.tier)
        const tierIdx = tierSkills.indexOf(skill)
        const tierCount = tierSkills.length

        const col = branchIdx
        const row = skill.tier - 1
        const subOffset = tierCount > 1 ? (tierIdx - (tierCount - 1) / 2) * (SKILL_NODE_SIZE + 4) : 0

        const nx = startX + col * (SKILL_NODE_SIZE + SKILL_NODE_GAP_X) + subOffset
        const ny = startY + row * SKILL_NODE_GAP_Y
        const cx = nx + SKILL_NODE_SIZE / 2
        const cy = ny + SKILL_NODE_SIZE / 2

        const zone = this.add.zone(cx, cy, SKILL_NODE_SIZE, SKILL_NODE_SIZE)
          .setInteractive().setDepth(323)
        zone.on('pointerdown', () => this.onSkillNodeClick(skill.id))
        this.skillNodeZones.push(zone)
        this.skillNodeSkills.push(skill)

        // Abbreviation label inside node
        const abbr = skill.name.split(' ').map(w => w[0]).join('').substring(0, 3)
        const nodeText = this.add.text(cx, cy - 2, abbr, {
          fontSize: '11px', color: '#ffffff', fontFamily: 'monospace',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(322).setVisible(false)
        this.skillNodeTexts.push(nodeText)

        // Small name label below the node
        const nameText = this.add.text(cx, ny + SKILL_NODE_SIZE + 2, skill.name, {
          fontSize: '7px', color: '#888888', fontFamily: 'monospace',
        }).setOrigin(0.5, 0).setDepth(321).setVisible(false)
        this.skillNameTexts.push(nameText)
      }
    }

    // ── Super Tree Nodes (tier 4) ──────────────────────
    // Laid out in a row below the normal tiers, grouped by super tree
    const superY = startY + SUPER_ROW_Y_OFFSET
    const superSkills = SKILLS.filter(s => !!s.superTree)
    const groupWidth = 2 * SKILL_NODE_SIZE + 8 // 2 nodes + gap
    const totalSuperWidth = SUPER_TREES.length * groupWidth + (SUPER_TREES.length - 1) * 30
    const superStartX = panelX + (SKILL_W - totalSuperWidth) / 2

    for (let gi = 0; gi < SUPER_TREES.length; gi++) {
      const st = SUPER_TREES[gi]!
      const groupX = superStartX + gi * (groupWidth + 30)

      // Super tree header label
      const labelX = groupX + groupWidth / 2
      const stLabel = this.add.text(labelX, superY - 14, `[${st.icon}] ${st.name}`, {
        fontSize: '8px', color: st.colorStr, fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5, 0).setDepth(321).setVisible(false)
      this.skillBranchLabels.push(stLabel)

      // Create nodes for this super tree's skills
      const stSkills = superSkills.filter(s => s.superTree === st.id)
      for (let si = 0; si < stSkills.length; si++) {
        const skill = stSkills[si]!
        const nx = groupX + si * (SKILL_NODE_SIZE + 8)
        const ny = superY
        const cx = nx + SKILL_NODE_SIZE / 2
        const cy = ny + SKILL_NODE_SIZE / 2

        const zone = this.add.zone(cx, cy, SKILL_NODE_SIZE, SKILL_NODE_SIZE)
          .setInteractive().setDepth(323)
        zone.on('pointerdown', () => this.onSkillNodeClick(skill.id))
        this.skillNodeZones.push(zone)
        this.skillNodeSkills.push(skill)

        const abbr = skill.name.split(' ').map(w => w[0]).join('').substring(0, 3)
        const nodeText = this.add.text(cx, cy - 2, abbr, {
          fontSize: '11px', color: '#ffffff', fontFamily: 'monospace',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(322).setVisible(false)
        this.skillNodeTexts.push(nodeText)

        const nameText = this.add.text(cx, ny + SKILL_NODE_SIZE + 2, skill.name, {
          fontSize: '7px', color: '#888888', fontFamily: 'monospace',
        }).setOrigin(0.5, 0).setDepth(321).setVisible(false)
        this.skillNameTexts.push(nameText)
      }
    }
  }

  private updateSkillTree(player: any) {
    const shouldShow = player.skillTreeOpen === true
    if (shouldShow !== this.skillVisible) {
      this.skillVisible = shouldShow
    }

    this.skillGfx.clear()
    this.skillTitle.setVisible(this.skillVisible)
    this.skillInfoText.setVisible(this.skillVisible)

    for (const z of this.skillNodeZones) {
      if (this.skillVisible) z.setInteractive()
      else z.disableInteractive()
    }
    for (const t of this.skillNodeTexts) t.setVisible(this.skillVisible)
    for (const t of this.skillNameTexts) t.setVisible(this.skillVisible)
    for (const l of this.skillBranchLabels) l.setVisible(this.skillVisible)

    if (!this.skillVisible) return

    const { width, height } = this.scale
    const panelX = (width - SKILL_W) / 2
    const panelY = (height - SKILL_H) / 2
    const skills: SkillTreeManager = player.skills

    // Panel background
    this.skillGfx.fillStyle(0x0a0a1a, 0.95)
    this.skillGfx.fillRect(panelX, panelY, SKILL_W, SKILL_H)
    this.skillGfx.lineStyle(2, 0x444466)
    this.skillGfx.strokeRect(panelX, panelY, SKILL_W, SKILL_H)

    // Skill points display
    this.skillTitle.setText(`SKILL TREE  [${skills.skillPoints} SP]`)

    // Track pointer for hover
    const pointer = this.input.activePointer
    let hoveredSkill: SkillDef | null = null

    // Draw connecting lines first, then nodes on top
    for (let i = 0; i < this.skillNodeSkills.length; i++) {
      const skill = this.skillNodeSkills[i]!
      if (!skill.requires) continue

      // Find parent node position
      const parentIdx = this.skillNodeSkills.findIndex(s => s.id === skill.requires)
      if (parentIdx < 0) continue

      const parentZone = this.skillNodeZones[parentIdx]!
      const childZone = this.skillNodeZones[i]!

      const unlocked = skills.hasSkill(skill.id)
      const parentUnlocked = skills.hasSkill(skill.requires)
      const isSuper = !!skill.superTree
      const superColor = isSuper ? (SUPER_TREE_MAP[skill.superTree!]?.color ?? 0x666688) : 0
      const lineColor = unlocked ? (isSuper ? superColor : 0x44ff44) : parentUnlocked ? 0x666688 : 0x333344
      const lineAlpha = unlocked ? 0.8 : 0.4

      this.skillGfx.lineStyle(2, lineColor, lineAlpha)
      this.skillGfx.lineBetween(parentZone.x, parentZone.y, childZone.x, childZone.y)
    }

    // Draw divider line between normal and super tiers
    const startY = panelY + 55
    const dividerY = startY + SUPER_ROW_Y_OFFSET - 20
    this.skillGfx.lineStyle(1, 0x444466, 0.5)
    this.skillGfx.lineBetween(panelX + 20, dividerY, panelX + SKILL_W - 20, dividerY)

    // Draw nodes
    for (let i = 0; i < this.skillNodeSkills.length; i++) {
      const skill = this.skillNodeSkills[i]!
      const zone = this.skillNodeZones[i]!
      const nx = zone.x - SKILL_NODE_SIZE / 2
      const ny = zone.y - SKILL_NODE_SIZE / 2

      const unlocked = skills.hasSkill(skill.id)
      const canUnlockSkill = skills.canUnlock(skill.id)
      const isSuper = !!skill.superTree
      const superTreeDef = isSuper ? SUPER_TREE_MAP[skill.superTree!] : null
      const nodeColor = superTreeDef ? superTreeDef.color : BRANCH_INFO[skill.branch].color
      const nodeColorStr = superTreeDef ? superTreeDef.colorStr : BRANCH_INFO[skill.branch].colorStr
      const superAvailable = superTreeDef ? skills.isSuperTreeUnlocked(skill.superTree!) : true
      // Check if prereq is met but just needs more SP
      const prereqMet = !skill.requires || skills.hasSkill(skill.requires)
      const needsMoreSP = !unlocked && prereqMet && skills.skillPoints < skill.cost

      // Node background
      if (unlocked) {
        this.skillGfx.fillStyle(nodeColor, 0.7)
      } else if (canUnlockSkill) {
        this.skillGfx.fillStyle(nodeColor, 0.3)
      } else if (needsMoreSP && (!isSuper || superAvailable)) {
        // Prereq met but not enough SP — show dimmed branch color
        this.skillGfx.fillStyle(nodeColor, 0.15)
      } else if (isSuper && !superAvailable) {
        // Super tree locked — very dark with a hint of color
        this.skillGfx.fillStyle(nodeColor, 0.08)
      } else {
        this.skillGfx.fillStyle(0x222233, 0.7)
      }
      this.skillGfx.fillRect(nx, ny, SKILL_NODE_SIZE, SKILL_NODE_SIZE)

      // Node border
      if (unlocked) {
        this.skillGfx.lineStyle(2, isSuper ? nodeColor : 0xffffff, 0.9)
      } else if (canUnlockSkill) {
        this.skillGfx.lineStyle(2, nodeColor, 0.8)
      } else if (needsMoreSP && (!isSuper || superAvailable)) {
        this.skillGfx.lineStyle(1, nodeColor, 0.4)
      } else {
        this.skillGfx.lineStyle(1, 0x444455, 0.6)
      }
      this.skillGfx.strokeRect(nx, ny, SKILL_NODE_SIZE, SKILL_NODE_SIZE)

      // Update node text color
      const nodeText = this.skillNodeTexts[i]!
      const nameText = this.skillNameTexts[i]!
      if (unlocked) {
        nodeText.setColor('#ffffff')
        nameText.setColor(nodeColorStr)
      } else if (canUnlockSkill) {
        nodeText.setColor('#ffff00')
        nameText.setColor('#aaaaaa')
      } else if (needsMoreSP && (!isSuper || superAvailable)) {
        nodeText.setColor('#888899')
        nameText.setColor('#666666')
      } else {
        nodeText.setColor('#555566')
        nameText.setColor('#444444')
      }

      // Cost badge (top-right corner)
      if (!unlocked) {
        const badgeX = nx + SKILL_NODE_SIZE - 2
        const badgeY = ny - 2
        this.skillGfx.fillStyle(canUnlockSkill ? 0xffff00 : needsMoreSP ? 0x886622 : 0x333344, 0.9)
        this.skillGfx.fillCircle(badgeX, badgeY, 6)
      }

      // Checkmark for unlocked
      if (unlocked) {
        this.skillGfx.fillStyle(isSuper ? nodeColor : 0x44ff44, 0.9)
        this.skillGfx.fillCircle(nx + SKILL_NODE_SIZE - 2, ny - 2, 5)
      }

      // Hover & click detection
      if (pointer.x >= nx && pointer.x < nx + SKILL_NODE_SIZE &&
          pointer.y >= ny && pointer.y < ny + SKILL_NODE_SIZE) {
        hoveredSkill = skill
        this.skillGfx.lineStyle(2, 0xffffff, 0.5)
        this.skillGfx.strokeRect(nx - 1, ny - 1, SKILL_NODE_SIZE + 2, SKILL_NODE_SIZE + 2)

        // Click to unlock (manual hit test — zones are unreliable)
        if (this.pointerJustDown) {
          if (skills.unlock(skill.id)) {
            AudioManager.get()?.play(SoundId.CRAFT_SUCCESS)
          }
        }
      }
    }

    // Info text at bottom
    if (hoveredSkill) {
      const unlocked = skills.hasSkill(hoveredSkill.id)
      const isSuper = !!hoveredSkill.superTree
      const canUnlockIt = skills.canUnlock(hoveredSkill.id)
      const status = unlocked ? ' [UNLOCKED]' : ` (${hoveredSkill.cost} SP)`
      let label: string
      if (isSuper) {
        const stDef = SUPER_TREE_MAP[hoveredSkill.superTree!]!
        const b1 = BRANCH_INFO[stDef.branches[0]].name
        const b2 = BRANCH_INFO[stDef.branches[1]].name
        const available = skills.isSuperTreeUnlocked(hoveredSkill.superTree!)
        const req = available ? '' : ` [Requires: max ${b1} + ${b2}]`
        label = `${hoveredSkill.name}${status} - ${hoveredSkill.description}  [${stDef.name}]${req}`
      } else {
        const branchName = BRANCH_INFO[hoveredSkill.branch].name
        label = `${hoveredSkill.name}${status} - ${hoveredSkill.description}  [${branchName}]`
      }
      // Show specific lock reason
      if (!unlocked && !canUnlockIt) {
        const reasons: string[] = []
        if (hoveredSkill.requires && !skills.hasSkill(hoveredSkill.requires)) {
          const reqSkill = SKILL_MAP[hoveredSkill.requires]
          reasons.push(`Requires: ${reqSkill ? reqSkill.name : hoveredSkill.requires}`)
        }
        if (skills.skillPoints < hoveredSkill.cost) {
          reasons.push(`Need ${hoveredSkill.cost - skills.skillPoints} more SP`)
        }
        if (reasons.length > 0) label += `  [${reasons.join(' | ')}]`
      }
      this.skillInfoText.setText(label)
      this.skillInfoText.setColor(unlocked ? '#44ff44' : canUnlockIt ? '#ffff00' : '#666666')
    } else {
      this.skillInfoText.setText('Hover over a node to see details. Click to unlock.')
      this.skillInfoText.setColor('#555555')
    }
  }

  private onSkillNodeClick(skillId: string) {
    if (!this.skillVisible) return
    const worldScene = this.scene.get('WorldScene') as any
    const player = worldScene?.getPlayer()
    if (!player) return

    const skills: SkillTreeManager = player.skills
    if (skills.unlock(skillId)) {
      AudioManager.get()?.play(SoundId.CRAFT_SUCCESS)
    }
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

  private onTrashClick() {
    if (!this.invVisible) return
    const worldScene = this.scene.get('WorldScene') as any
    const player = worldScene?.getPlayer()
    if (!player) return
    const inv: InventoryManager = player.inventory
    if (inv.heldItem) {
      inv.heldItem = null
      AudioManager.get()?.play(SoundId.SLOT_CHANGE)
    }
  }

  // ── Shop Panel ───────────────────────────────────────

  private updateShopPanel(player: any, inv: InventoryManager) {
    const shouldShow = player.shopOpen === true
    if (shouldShow !== this.shopVisible) {
      this.shopVisible = shouldShow
      if (!shouldShow) this.shopScroll = 0
    }

    this.shopGfx.clear()
    this.shopTitle.setVisible(false)

    // Cleanup old texts
    for (const t of this.shopTexts) t.destroy()
    this.shopTexts = []

    if (!this.shopVisible) {
      this.shopClickPending = null
      return
    }

    const { width, height } = this.scale
    const SHOP_W = 360
    const SHOP_H = 420
    const shopX = (width - SHOP_W) / 2
    const shopY = (height - SHOP_H) / 2

    // Background
    this.shopGfx.fillStyle(0x0a0a1a, 0.95)
    this.shopGfx.fillRect(shopX, shopY, SHOP_W, SHOP_H)
    this.shopGfx.lineStyle(2, 0xddaa44)
    this.shopGfx.strokeRect(shopX, shopY, SHOP_W, SHOP_H)

    // Title
    this.shopTitle.setText('Sky Merchant')
    this.shopTitle.setPosition(shopX + SHOP_W / 2, shopY + 6)
    this.shopTitle.setVisible(true)

    // Coin balance
    const coins = inv.getCount(250)
    const coinText = this.add.text(shopX + SHOP_W - 10, shopY + 8, `${coins} coins`, {
      fontSize: '12px', color: '#ccccdd', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(332)
    this.shopTexts.push(coinText)

    // Tab buttons
    const tabY = shopY + 28
    const pointer = this.input.activePointer

    for (const tab of ['buy', 'sell'] as const) {
      const tx = tab === 'buy' ? shopX + SHOP_W / 4 : shopX + (SHOP_W * 3) / 4
      const isActive = this.shopTab === tab
      this.shopGfx.fillStyle(isActive ? 0x334466 : 0x1a1a2e, 0.9)
      this.shopGfx.fillRect(tx - 60, tabY, 120, 22)
      this.shopGfx.lineStyle(1, isActive ? 0x6688aa : 0x333355)
      this.shopGfx.strokeRect(tx - 60, tabY, 120, 22)

      const tabLabel = this.add.text(tx, tabY + 11, tab.toUpperCase(), {
        fontSize: '12px', color: isActive ? '#ffdd44' : '#666666', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5).setDepth(332)
      this.shopTexts.push(tabLabel)

      // Tab click detection (poll-based + event-based)
      const tabClicked = this.pointerJustDown || this.shopClickPending !== null
      const tabClickX = this.shopClickPending?.x ?? pointer.x
      const tabClickY = this.shopClickPending?.y ?? pointer.y
      if (tabClicked && tabClickX >= tx - 60 && tabClickX < tx + 60 &&
          tabClickY >= tabY && tabClickY < tabY + 22) {
        this.shopTab = tab
        this.shopScroll = 0
      }
    }

    const listY = tabY + 30
    const ROW_H = 36
    const maxRows = Math.floor((SHOP_H - 70) / ROW_H)

    if (this.shopTab === 'buy') {
      this.renderBuyTab(inv, shopX, listY, SHOP_W, ROW_H, maxRows, pointer, coins)
      this.shopClickPending = null
    } else {
      this.renderSellTab(inv, shopX, listY, SHOP_W, ROW_H, maxRows, pointer, coins)
    }
  }

  private renderBuyTab(
    inv: InventoryManager, shopX: number, listY: number,
    shopW: number, rowH: number, maxRows: number,
    pointer: Phaser.Input.Pointer, coins: number
  ) {
    const buyMaxScroll = Math.max(0, SHOP_INVENTORY.length - maxRows)
    this.shopScroll = Phaser.Math.Clamp(this.shopScroll, 0, buyMaxScroll)

    for (let i = 0; i < Math.min(SHOP_INVENTORY.length - this.shopScroll, maxRows); i++) {
      const item = SHOP_INVENTORY[i + this.shopScroll]
      if (!item) continue
      const def = getItemDef(item.itemId)
      if (!def) continue
      const eff = ACCESSORY_EFFECTS[item.itemId]

      const ry = listY + i * rowH
      const canAfford = coins >= item.price
      const alreadyOwned = inv.getCount(item.itemId) > 0

      // Row background
      if (i % 2 === 0) {
        this.shopGfx.fillStyle(0x111122, 0.3)
        this.shopGfx.fillRect(shopX + 4, ry, shopW - 8, rowH)
      }

      // Hover highlight
      const hovered = pointer.x >= shopX + 4 && pointer.x < shopX + shopW - 4 &&
                       pointer.y >= ry && pointer.y < ry + rowH
      if (hovered) {
        this.shopGfx.fillStyle(0xffffff, 0.08)
        this.shopGfx.fillRect(shopX + 4, ry, shopW - 8, rowH)
      }

      // Color swatch
      this.shopGfx.fillStyle(def.color, 0.9)
      this.shopGfx.fillRect(shopX + 10, ry + 4, 24, 24)
      this.shopGfx.lineStyle(1, 0x555577)
      this.shopGfx.strokeRect(shopX + 10, ry + 4, 24, 24)

      // Name & description
      const nameColor = alreadyOwned ? '#666666' : canAfford ? '#ffffff' : '#884444'
      const nameText = this.add.text(shopX + 40, ry + 4, def.name, {
        fontSize: '11px', color: nameColor, fontFamily: 'monospace',
      }).setDepth(332)
      this.shopTexts.push(nameText)

      const descText = this.add.text(shopX + 40, ry + 18, eff?.description ?? '', {
        fontSize: '9px', color: '#888888', fontFamily: 'monospace',
      }).setDepth(332)
      this.shopTexts.push(descText)

      // Price
      const priceStr = alreadyOwned ? 'OWNED' : `${item.price}c`
      const priceColor = alreadyOwned ? '#666666' : canAfford ? '#ccccdd' : '#884444'
      const priceText = this.add.text(shopX + shopW - 10, ry + 10, priceStr, {
        fontSize: '11px', color: priceColor, fontFamily: 'monospace',
      }).setOrigin(1, 0).setDepth(332)
      this.shopTexts.push(priceText)

      // Buy on click (poll-based + event-based)
      const buyClicked = this.pointerJustDown || this.shopClickPending !== null
      const buyClickX = this.shopClickPending?.x ?? pointer.x
      const buyClickY = this.shopClickPending?.y ?? pointer.y
      const clickedBuyRow = buyClicked && canAfford && !alreadyOwned &&
        buyClickX >= shopX + 4 && buyClickX < shopX + shopW - 4 &&
        buyClickY >= ry && buyClickY < ry + rowH
      if (clickedBuyRow) {
        inv.removeItem(250, item.price)
        inv.addItem(item.itemId, 1)
        AudioManager.get()?.play(SoundId.CRAFT_SUCCESS)
      }
    }
  }

  private sellItem(inv: InventoryManager, itemId: number, count: number): number {
    const price = SELL_PRICES[itemId]
    if (!price || price <= 0) return 0
    let sold = 0
    for (let i = 0; i < count; i++) {
      if (!inv.removeItem(itemId, 1)) break
      inv.addItem(250, price)
      sold++
    }
    return sold
  }

  private renderSellTab(
    inv: InventoryManager, shopX: number, listY: number,
    shopW: number, rowH: number, maxRows: number,
    pointer: Phaser.Input.Pointer, _coins: number
  ) {
    // Build list of sellable items in player inventory
    const sellable: { id: number; count: number; price: number }[] = []
    const seen = new Set<number>()
    const allSlots = [...inv.hotbar, ...inv.mainInventory]
    for (const slot of allSlots) {
      if (!slot || seen.has(slot.id)) continue
      const price = SELL_PRICES[slot.id]
      if (price && price > 0) {
        seen.add(slot.id)
        sellable.push({ id: slot.id, count: inv.getCount(slot.id), price })
      }
    }

    if (sellable.length === 0) {
      const emptyText = this.add.text(shopX + shopW / 2, listY + 40, 'No sellable items', {
        fontSize: '12px', color: '#666666', fontFamily: 'monospace',
      }).setOrigin(0.5, 0).setDepth(332)
      this.shopTexts.push(emptyText)
      this.shopClickPending = null
      return
    }

    // Clamp scroll
    const maxScroll = Math.max(0, sellable.length - maxRows)
    this.shopScroll = Phaser.Math.Clamp(this.shopScroll, 0, maxScroll)

    const SELL_ALL_W = 52
    const SELL_ALL_H = 20

    // Scroll indicators
    if (this.shopScroll > 0) {
      const upText = this.add.text(shopX + shopW / 2, listY - 12, '\u25B2 scroll up', {
        fontSize: '9px', color: '#888888', fontFamily: 'monospace',
      }).setOrigin(0.5, 0.5).setDepth(332)
      this.shopTexts.push(upText)
    }
    if (this.shopScroll < maxScroll) {
      const downY = listY + maxRows * rowH + 4
      const downText = this.add.text(shopX + shopW / 2, downY, '\u25BC scroll down', {
        fontSize: '9px', color: '#888888', fontFamily: 'monospace',
      }).setOrigin(0.5, 0).setDepth(332)
      this.shopTexts.push(downText)
    }

    for (let i = 0; i < Math.min(sellable.length - this.shopScroll, maxRows); i++) {
      const entry = sellable[i + this.shopScroll]
      if (!entry) continue
      const def = getItemDef(entry.id)
      const name = def?.name ?? `Item ${entry.id}`

      const ry = listY + i * rowH

      if (i % 2 === 0) {
        this.shopGfx.fillStyle(0x111122, 0.3)
        this.shopGfx.fillRect(shopX + 4, ry, shopW - 8, rowH)
      }

      // "Sell All" button area (right side)
      const sellAllX = shopX + shopW - SELL_ALL_W - 8
      const sellAllY = ry + (rowH - SELL_ALL_H) / 2

      const hoveredSellAll = pointer.x >= sellAllX && pointer.x < sellAllX + SELL_ALL_W &&
                             pointer.y >= sellAllY && pointer.y < sellAllY + SELL_ALL_H

      // Row hover (excluding sell-all button area)
      const hoveredRow = pointer.x >= shopX + 4 && pointer.x < sellAllX - 4 &&
                         pointer.y >= ry && pointer.y < ry + rowH

      if (hoveredRow || hoveredSellAll) {
        this.shopGfx.fillStyle(0xffffff, 0.08)
        this.shopGfx.fillRect(shopX + 4, ry, shopW - 8, rowH)
      }

      // Color swatch
      const color = def?.color ?? 0xffffff
      this.shopGfx.fillStyle(color, 0.9)
      this.shopGfx.fillRect(shopX + 10, ry + 6, 20, 20)

      const nameText = this.add.text(shopX + 36, ry + 6, `${name} x${entry.count}`, {
        fontSize: '11px', color: '#ffffff', fontFamily: 'monospace',
      }).setDepth(332)
      this.shopTexts.push(nameText)

      const priceText = this.add.text(sellAllX - 6, ry + 6, `${entry.price}c`, {
        fontSize: '10px', color: '#ccccdd', fontFamily: 'monospace',
      }).setOrigin(1, 0).setDepth(332)
      this.shopTexts.push(priceText)

      // "Sell All" button
      const sellAllBtnColor = hoveredSellAll ? 0x446644 : 0x223322
      this.shopGfx.fillStyle(sellAllBtnColor, 0.9)
      this.shopGfx.fillRect(sellAllX, sellAllY, SELL_ALL_W, SELL_ALL_H)
      this.shopGfx.lineStyle(1, hoveredSellAll ? 0x88cc88 : 0x446644)
      this.shopGfx.strokeRect(sellAllX, sellAllY, SELL_ALL_W, SELL_ALL_H)

      const sellAllLabel = this.add.text(sellAllX + SELL_ALL_W / 2, sellAllY + SELL_ALL_H / 2, 'Sell All', {
        fontSize: '9px', color: hoveredSellAll ? '#88ff88' : '#66aa66', fontFamily: 'monospace',
      }).setOrigin(0.5, 0.5).setDepth(332)
      this.shopTexts.push(sellAllLabel)

      // Use both poll-based and event-based click detection
      const clicked = this.pointerJustDown || this.shopClickPending !== null
      const clickX = this.shopClickPending?.x ?? pointer.x
      const clickY = this.shopClickPending?.y ?? pointer.y

      const clickedSellAll = clicked &&
        clickX >= sellAllX && clickX < sellAllX + SELL_ALL_W &&
        clickY >= sellAllY && clickY < sellAllY + SELL_ALL_H

      const clickedRow = clicked && !clickedSellAll &&
        clickX >= shopX + 4 && clickX < sellAllX - 4 &&
        clickY >= ry && clickY < ry + rowH

      // Sell on click — sell one
      if (clickedRow) {
        const sold = this.sellItem(inv, entry.id, 1)
        if (sold > 0) AudioManager.get()?.play(SoundId.CRAFT_SUCCESS)
      }

      // Sell all on click
      if (clickedSellAll) {
        const sold = this.sellItem(inv, entry.id, entry.count)
        if (sold > 0) AudioManager.get()?.play(SoundId.CRAFT_SUCCESS)
      }
    }

    // Clear pending click after processing all rows
    this.shopClickPending = null
  }

  // ── Chest Panel ───────────────────────────────────────

  private updateChestPanel(player: any, inv: InventoryManager) {
    const shouldShow = player.chestOpen === true
    if (shouldShow !== this.chestVisible) {
      this.chestVisible = shouldShow
    }

    this.chestGfx.clear()
    this.chestTitle.setVisible(false)
    for (const t of this.chestTexts) t.destroy()
    this.chestTexts = []

    if (!this.chestVisible) return

    const worldScene = this.scene.get('WorldScene') as any
    const chunks = worldScene?.getChunkManager?.()
    if (!chunks || !player.openChestPos) return

    const chestInv: (ItemStack | null)[] = chunks.getChestInventory(
      player.openChestPos.tx, player.openChestPos.ty
    )

    const { width, height } = this.scale
    const CHEST_COLS = 10
    const CHEST_ROWS = Math.ceil(CHEST_SLOTS / CHEST_COLS)
    const S = 36 // slightly smaller slot size for compact panel
    const G = 3  // gap
    const PAD = 10
    const COL_W = CHEST_COLS * (S + G) - G // 387
    const PANEL_W = COL_W + PAD * 2 // 407

    // Heights
    const TITLE_H = 24
    const SEP = 8
    const chestRowsH = CHEST_ROWS * (S + G) - G
    const invRowsH = 3 * (S + G) - G // main inventory
    const hotbarH = S
    const PANEL_H = PAD + TITLE_H + chestRowsH + SEP + 18 + invRowsH + SEP + 18 + hotbarH + PAD

    const px = (width - PANEL_W) / 2
    const py = (height - PANEL_H) / 2

    // Background
    this.chestGfx.fillStyle(0x0a0a1a, 0.95)
    this.chestGfx.fillRect(px, py, PANEL_W, PANEL_H)
    this.chestGfx.lineStyle(2, 0xddaa55)
    this.chestGfx.strokeRect(px, py, PANEL_W, PANEL_H)

    // Title
    this.chestTitle.setText('Chest')
    this.chestTitle.setPosition(px + PANEL_W / 2, py + PAD)
    this.chestTitle.setVisible(true)

    const pointer = this.input.activePointer
    let curY = py + PAD + TITLE_H

    // ── Chest slots ──
    for (let row = 0; row < CHEST_ROWS; row++) {
      for (let col = 0; col < CHEST_COLS; col++) {
        const idx = row * CHEST_COLS + col
        if (idx >= CHEST_SLOTS) break
        const sx = px + PAD + col * (S + G)
        const sy = curY + row * (S + G)
        const slot = chestInv[idx] ?? null
        this.drawChestSlot(sx, sy, S, slot, pointer, () => {
          inv.clickExternalSlot(chestInv, idx)
          AudioManager.get()?.play(SoundId.SLOT_CHANGE)
        })
      }
    }

    curY += chestRowsH + SEP

    // ── "Inventory" label ──
    const invLabel = this.add.text(px + PANEL_W / 2, curY, 'Inventory', {
      fontSize: '11px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setDepth(342)
    this.chestTexts.push(invLabel)
    curY += 18

    // ── Main inventory slots (3 rows × 10 cols) ──
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 10; col++) {
        const idx = row * 10 + col
        const sx = px + PAD + col * (S + G)
        const sy = curY + row * (S + G)
        const slot = inv.mainInventory[idx] ?? null
        this.drawChestSlot(sx, sy, S, slot, pointer, () => {
          inv.clickSlot('main', idx)
          AudioManager.get()?.play(SoundId.SLOT_CHANGE)
        })
      }
    }

    curY += invRowsH + SEP

    // ── "Hotbar" label ──
    const hotLabel = this.add.text(px + PANEL_W / 2, curY, 'Hotbar', {
      fontSize: '11px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setDepth(342)
    this.chestTexts.push(hotLabel)
    curY += 18

    // ── Hotbar slots ──
    for (let col = 0; col < 10; col++) {
      const sx = px + PAD + col * (S + G)
      const sy = curY
      const slot = inv.hotbar[col] ?? null
      this.drawChestSlot(sx, sy, S, slot, pointer, () => {
        inv.clickSlot('hotbar', col)
        AudioManager.get()?.play(SoundId.SLOT_CHANGE)
      })
    }

    // ── Render held item cursor ──
    this.updateHeldItem(inv)
  }

  private drawChestSlot(
    x: number, y: number, size: number,
    slot: ItemStack | null,
    pointer: Phaser.Input.Pointer,
    onClick: () => void
  ) {
    // Background
    this.chestGfx.fillStyle(0x111122, 0.85)
    this.chestGfx.fillRect(x, y, size, size)
    this.chestGfx.lineStyle(1, 0x333344)
    this.chestGfx.strokeRect(x, y, size, size)

    // Hover highlight
    const hovered = pointer.x >= x && pointer.x < x + size &&
                    pointer.y >= y && pointer.y < y + size
    if (hovered) {
      this.chestGfx.fillStyle(0xffffff, 0.1)
      this.chestGfx.fillRect(x, y, size, size)
    }

    // Click
    if (hovered && this.pointerJustDown) {
      onClick()
    }

    if (!slot) return

    // Item icon
    const def = getItemDef(slot.id)
    const texKey = this.getItemTexKey(slot.id)
    const cx = x + size / 2
    const cy = y + size / 2

    if (this.textures.exists(texKey)) {
      const img = this.add.image(cx, cy, texKey)
        .setDisplaySize(size - 8, size - 8)
        .setDepth(342)
      this.chestTexts.push(img as any)
    } else {
      const color = def?.color ?? TILE_PROPERTIES[slot.id as TileType]?.color ?? 0xffffff
      this.chestGfx.fillStyle(color, 0.9)
      this.chestGfx.fillRect(x + 4, y + 4, size - 8, size - 8)
    }

    // Count
    if (slot.count > 1) {
      const txt = this.add.text(x + size - 2, y + size - 2, `${slot.count}`, {
        fontSize: '9px', color: '#ffffff', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(1, 1).setDepth(343)
      this.chestTexts.push(txt)
    }

    // Tooltip on hover
    if (hovered && def) {
      const tip = this.add.text(pointer.x, pointer.y - 16, def.name, {
        fontSize: '10px', color: '#ffffff', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 2,
        backgroundColor: '#000000aa', padding: { x: 4, y: 2 },
      }).setOrigin(0.5, 1).setDepth(350)
      this.chestTexts.push(tip)
    }
  }
}
