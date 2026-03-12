import Phaser from 'phaser'
import { TILE_SIZE, WORLD_WIDTH } from '../world/TileRegistry'
import type { InventoryManager } from '../systems/InventoryManager'
import { SurfaceBiome } from '../world/WorldGenerator'
import type { WorldData } from '../world/WorldGenerator'
import { MiniMap } from '../systems/MiniMap'
import type { BossMarker } from '../systems/MiniMap'
import { ChatOverlay } from '../multiplayer/ChatOverlay'
import { HotbarPanel } from '../ui/HotbarPanel'
import { StatsPanel } from '../ui/StatsPanel'
import { CraftingPanel } from '../ui/CraftingPanel'
import { InventoryPanel } from '../ui/InventoryPanel'
import { SkillTreePanel } from '../ui/SkillTreePanel'
import { ShopPanel } from '../ui/ShopPanel'
import { ChestPanel } from '../ui/ChestPanel'

export class UIScene extends Phaser.Scene {
  private hotbar!: HotbarPanel
  private stats!: StatsPanel
  private crafting!: CraftingPanel
  private inventory!: InventoryPanel
  private skillTree!: SkillTreePanel
  private shop!: ShopPanel
  private chest!: ChestPanel

  // Shared pointer state
  private prevPointerDown = false
  private pointerJustDown = false

  // Mini-map
  private miniMap!: MiniMap

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
    this.prevPointerDown = false
    this.pointerJustDown = false
    this.visitedZones = new Set<string>()
    this.currentZoneName = ''

    // Create panels
    this.hotbar = new HotbarPanel(this)
    this.stats = new StatsPanel(this)
    this.crafting = new CraftingPanel(this)
    this.inventory = new InventoryPanel(this)
    this.skillTree = new SkillTreePanel(this)
    this.shop = new ShopPanel(this)
    this.chest = new ChestPanel(this)

    this.hotbar.create()
    this.stats.create()
    this.crafting.create()
    this.inventory.create()
    this.skillTree.create()

    // Shop and chest share graphics objects created by inventory panel
    this.shop.setGraphics(this.inventory.shopGfx, this.inventory.shopTitle)
    this.chest.setGraphics(this.inventory.chestGfx, this.inventory.chestTitle)

    // Scroll handler — dispatch to active panel
    this.input.on('wheel', (_pointer: any, _gameObjects: any, _deltaX: number, deltaY: number) => {
      if (this.shop.visible) {
        this.shop.onScroll(deltaY)
        return
      }
      if (this.inventory.visible) return
      this.crafting.onScroll(deltaY)
    })

    // Pointerdown — dispatch shop click tracking
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.shop.onPointerDown(pointer.x, pointer.y)
    })

    // Mini-map
    const worldData = this.registry.get('worldData') as WorldData
    if (worldData) {
      this.miniMap = new MiniMap(this, worldData)
      const exploredMap = this.registry.get('exploredMap') as number[] | undefined
      if (exploredMap) {
        this.miniMap.loadExplored(exploredMap)
        this.registry.remove('exploredMap')
      }
    }

    // Biome banner
    const { width } = this.scale
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

    // Chat overlay (multiplayer)
    const worldScene = this.scene.get('WorldScene') as any
    const mp = worldScene?.getMultiplayer?.()
    if (mp && mp.isOnline) {
      this.chatOverlay = new ChatOverlay(this, mp)
    }

    // Cleanup
    this.events.on('shutdown', () => {
      if (this.miniMap) this.miniMap.destroy()
      if (this.chatOverlay) {
        this.chatOverlay.destroy()
        this.chatOverlay = null
      }
    })
  }

  override update() {
    const worldScene = this.scene.get('WorldScene') as any
    if (!worldScene?.getPlayer) return
    const player = worldScene.getPlayer()
    if (!player) return
    const chunks = worldScene.getChunkManager()
    const inv: InventoryManager = player.inventory

    // Shared pointer state
    const pointer = this.input.activePointer
    this.pointerJustDown = pointer.isDown && !this.prevPointerDown
    this.prevPointerDown = pointer.isDown

    // Update panels
    this.hotbar.update(inv)
    this.stats.update(player, worldScene)
    this.crafting.update(player, inv, chunks)
    this.inventory.update(player, inv, this.pointerJustDown)
    this.skillTree.update(player, this.pointerJustDown)
    this.shop.update(player, inv, this.pointerJustDown)
    this.chest.update(player, inv, this.pointerJustDown)

    // Chest panel also needs to render held item
    if (player.chestOpen) {
      this.inventory.updateHeldItem(inv)
    }

    // Mini-map
    if (this.miniMap) {
      this.miniMap.update(player.sprite.x, player.sprite.y)
      this.updateMinimapBossMarkers(worldScene)
    }

    this.updateBiomeBanner(player)
    this.chatOverlay?.update()
  }

  getExploredMap(): number[] | null {
    return this.miniMap?.getExplored() ?? null
  }

  // ── Biome banner ─────────────────────────────────────

  private getZoneName(px: number, py: number): string {
    const tileX = Math.floor(px / TILE_SIZE)

    if (py < 80 * 16) return 'Cloud City'
    if (py >= 640 * 16) return 'The Core'
    if (py >= 130 * 16) return 'Underground'
    if (tileX < 80 || tileX > WORLD_WIDTH - 80) return 'Ocean'

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

  // ── Minimap boss markers ─────────────────────────────

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
}
