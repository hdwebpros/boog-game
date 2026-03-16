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
import { WorldMapPanel } from '../ui/WorldMapPanel'
import type { Waypoint } from '../ui/WorldMapPanel'

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

  // Full-screen world map
  private worldMap!: WorldMapPanel

  // Biome banner
  private biomeBannerText!: Phaser.GameObjects.Text
  private visitedZones = new Set<string>()
  private currentZoneName = ''

  // Coordinate display
  private coordText!: Phaser.GameObjects.Text

  // Chat overlay (multiplayer)
  private chatOverlay: ChatOverlay | null = null

  // Boss markers cache (shared between minimap and world map)
  private cachedBossMarkers: BossMarker[] = []

  // Mystical Compass HUD
  private compassGfx!: Phaser.GameObjects.Graphics
  private compassDistText!: Phaser.GameObjects.Text

  // Shard Compass HUD (up to 5 shard compasses stacked)
  private shardCompassGfx!: Phaser.GameObjects.Graphics
  private shardCompassTexts: Phaser.GameObjects.Text[] = []

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

    // Scroll handler — dispatch to active panel or world map
    this.input.on('wheel', (_pointer: any, _gameObjects: any, _deltaX: number, deltaY: number) => {
      if (this.worldMap?.visible) {
        this.worldMap.onScroll(deltaY)
        return
      }
      if (this.shop.visible) {
        this.shop.onScroll(deltaY)
        return
      }
      if (this.inventory.visible) return
      this.crafting.onScroll(deltaY)
    })

    // Pointerdown — dispatch to world map or shop
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.worldMap?.visible) {
        this.worldMap.onPointerDown(pointer)
        return
      }
      this.shop.onPointerDown(pointer.x, pointer.y)
    })

    // Pointermove — dispatch to world map for drag panning
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.worldMap?.visible) {
        this.worldMap.onPointerMove(pointer)
      }
    })

    // Pointerup — end world map drag
    this.input.on('pointerup', () => {
      if (this.worldMap?.visible) {
        this.worldMap.onPointerUp()
      }
    })

    // Disable right-click context menu on the game canvas
    this.game.canvas.addEventListener('contextmenu', (e) => { e.preventDefault() })

    // Mini-map
    const worldData = this.registry.get('worldData') as WorldData
    if (worldData) {
      this.miniMap = new MiniMap(this, worldData)
      const exploredMap = this.registry.get('exploredMap') as number[] | undefined
      if (exploredMap) {
        this.miniMap.loadExplored(exploredMap)
        this.registry.remove('exploredMap')
      }

      // Full-screen world map
      this.worldMap = new WorldMapPanel(this)
      this.worldMap.create()
      this.worldMap.setWorldData(worldData)

      // Load waypoints from save data
      const savedWaypoints = this.registry.get('waypoints') as Waypoint[] | undefined
      if (savedWaypoints) {
        this.worldMap.loadWaypoints(savedWaypoints)
        this.registry.remove('waypoints')
      }
    }

    // Coordinate display (top-left, below any sky elements)
    this.coordText = this.add.text(6, 6, '', {
      fontSize: '11px', color: '#dddddd', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 3,
    }).setDepth(210).setAlpha(0.8)

    // Mystical Compass HUD
    this.compassGfx = this.add.graphics().setDepth(210).setVisible(false)
    this.compassDistText = this.add.text(0, 0, '', {
      fontSize: '10px', color: '#88ccff', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5, 0).setDepth(210).setVisible(false)

    // Shard Compass HUD
    this.shardCompassGfx = this.add.graphics().setDepth(210).setVisible(false)
    for (let i = 0; i < 5; i++) {
      const txt = this.add.text(0, 0, '', {
        fontSize: '9px', color: '#ffffff', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 3, align: 'center',
      }).setOrigin(0.5, 0).setDepth(210).setVisible(false)
      this.shardCompassTexts.push(txt)
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

    // M key — toggle full-screen world map
    const keyM = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M)
    keyM.on('down', () => { this.toggleWorldMap() })

    // C key — center on player (when world map is open)
    const keyC_map = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C)
    keyC_map.on('down', () => {
      if (this.worldMap?.visible) {
        this.worldMap.centerOnPlayer()
      }
    })

    // DEL key — delete selected waypoint
    const keyDel = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DELETE)
    keyDel.on('down', () => {
      if (this.worldMap?.visible) {
        this.worldMap.deleteSelectedWaypoint()
      }
    })
    // Backspace as alternative delete
    const keyBack = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE)
    keyBack.on('down', () => {
      if (this.worldMap?.visible) {
        this.worldMap.deleteSelectedWaypoint()
      }
    })

    // R key — rename selected waypoint
    const keyR = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R)
    keyR.on('down', () => {
      if (this.worldMap?.visible) {
        this.worldMap.renameSelectedWaypoint()
      }
    })

    // Chat overlay (multiplayer)
    const worldScene = this.scene.get('WorldScene') as any
    const mp = worldScene?.getMultiplayer?.()
    if (mp && mp.isOnline) {
      this.chatOverlay = new ChatOverlay(this, mp)
    }

    // Cleanup
    this.events.on('shutdown', () => {
      this.input.off('wheel')
      this.input.off('pointerdown')
      this.input.off('pointermove')
      this.input.off('pointerup')
      this.input.keyboard?.removeAllKeys(true)
      if (this.miniMap) this.miniMap.destroy()
      if (this.worldMap) this.worldMap.destroy()
      if (this.chatOverlay) {
        this.chatOverlay.destroy()
        this.chatOverlay = null
      }
    })
  }

  private toggleWorldMap() {
    if (!this.worldMap || !this.miniMap) return

    const worldScene = this.scene.get('WorldScene') as any
    const player = worldScene?.getPlayer?.()
    if (!player) return

    if (this.worldMap.visible) {
      // Close world map
      this.worldMap.close()
      player.mapOpen = false
    } else {
      // Close other panels first
      player.inventoryOpen = false
      player.craftingOpen = false
      player.skillTreeOpen = false
      player.inventory.returnHeldItem()

      // Open world map
      const pos = this.miniMap.getPlayerMapPos()
      this.worldMap.setExplored(this.miniMap.getExploredArray())
      this.worldMap.open(pos.x, pos.y)
      player.mapOpen = true

      // Hide minimap while fullscreen map is open
      if (this.miniMap.visible) this.miniMap.toggle()
    }
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
      this.updateBossMarkers(worldScene)
      const pois = worldScene?.getDiscoveredPOIs?.() as { type: 'runestone' | 'altar'; bossType: string; worldX: number; worldY: number }[] | undefined
      if (pois) this.miniMap.updatePOIMarkers(pois)

      // LMB click on minimap cycles zoom
      if (this.pointerJustDown && pointer.leftButtonDown() &&
          this.miniMap.hitTest(pointer.x, pointer.y)) {
        this.miniMap.cycleZoom()
      }
    }

    // Full-screen world map
    if (this.worldMap?.visible && this.miniMap) {
      const pos = this.miniMap.getPlayerMapPos()
      this.worldMap.setExplored(this.miniMap.getExploredArray())
      this.worldMap.update(pos.x, pos.y, this.cachedBossMarkers)
    }

    // Update coordinate display
    const ptx = Math.floor(player.sprite.x / TILE_SIZE)
    const pty = Math.floor(player.sprite.y / TILE_SIZE)
    this.coordText.setText(`X: ${ptx}  Y: ${pty}`)

    this.updateCompass(worldScene)
    this.updateShardCompasses(worldScene)
    this.updateBiomeBanner(player)
    this.chatOverlay?.update()
  }

  getExploredMap(): number[] | null {
    return this.miniMap?.getExplored() ?? null
  }

  getWaypoints(): Waypoint[] | null {
    return this.worldMap?.getWaypoints() ?? null
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

  // ── Boss markers (shared between minimap and world map) ──

  private updateBossMarkers(worldScene: any) {
    if (!this.miniMap) return
    const discovered = worldScene?.getDiscoveredAltars?.() as Set<string> | undefined
    if (!discovered || discovered.size === 0) {
      this.cachedBossMarkers = []
      this.miniMap.updateBossMarkers([])
      return
    }

    const markers: BossMarker[] = []
    for (const bossType of discovered) {
      const pos = worldScene.getDiscoveredAltarPosition?.(bossType) as { px: number; py: number } | null
      if (!pos) continue
      markers.push({ bossType, worldX: pos.px, worldY: pos.py })
    }
    this.cachedBossMarkers = markers
    this.miniMap.updateBossMarkers(markers)
  }

  private updateCompass(worldScene: any) {
    const target = worldScene?.getCompassTarget?.() as { angle: number; dist: number } | null
    if (!target) {
      this.compassGfx.setVisible(false)
      this.compassDistText.setVisible(false)
      return
    }

    const cx = 760
    const cy = 140
    const radius = 20

    this.compassGfx.clear()

    // Outer ring
    this.compassGfx.lineStyle(2, 0x336699, 0.8)
    this.compassGfx.strokeCircle(cx, cy, radius + 4)

    // Inner fill
    this.compassGfx.fillStyle(0x112233, 0.7)
    this.compassGfx.fillCircle(cx, cy, radius + 2)

    // Arrow pointing toward nearest runestone
    const arrowLen = radius - 2
    const tipX = cx + Math.cos(target.angle) * arrowLen
    const tipY = cy + Math.sin(target.angle) * arrowLen
    const baseL = cx + Math.cos(target.angle + 2.6) * 8
    const baseR = cx + Math.cos(target.angle - 2.6) * 8
    const baseLY = cy + Math.sin(target.angle + 2.6) * 8
    const baseRY = cy + Math.sin(target.angle - 2.6) * 8

    this.compassGfx.fillStyle(0x66aaff, 1)
    this.compassGfx.fillTriangle(tipX, tipY, baseL, baseLY, baseR, baseRY)

    // Small dot at center
    this.compassGfx.fillStyle(0xffffff, 0.8)
    this.compassGfx.fillCircle(cx, cy, 2)

    this.compassGfx.setVisible(true)

    // Distance text below compass
    const tileDist = Math.round(target.dist / TILE_SIZE)
    this.compassDistText.setText(`${tileDist}m`)
    this.compassDistText.setPosition(cx, cy + radius + 8)
    this.compassDistText.setVisible(true)
  }

  private updateShardCompasses(worldScene: any) {
    const targets = worldScene?.getShardCompassTargets?.() as
      Array<{ angle: number; dist: number; color: number; label: string }> | null

    if (!targets || targets.length === 0) {
      this.shardCompassGfx.setVisible(false)
      for (const txt of this.shardCompassTexts) txt.setVisible(false)
      return
    }

    this.shardCompassGfx.clear()

    const baseX = 760
    // Stack below the mystical compass area (y=140 is mystical compass center)
    const baseY = 190
    const radius = 14
    const spacing = 42

    for (let i = 0; i < targets.length && i < 5; i++) {
      const t = targets[i]!
      const cx = baseX
      const cy = baseY + i * spacing

      // Outer ring (tinted with shard color)
      this.shardCompassGfx.lineStyle(2, t.color, 0.8)
      this.shardCompassGfx.strokeCircle(cx, cy, radius + 3)

      // Inner fill
      this.shardCompassGfx.fillStyle(0x112233, 0.7)
      this.shardCompassGfx.fillCircle(cx, cy, radius + 1)

      // Arrow pointing toward shard
      const arrowLen = radius - 2
      const tipX = cx + Math.cos(t.angle) * arrowLen
      const tipY = cy + Math.sin(t.angle) * arrowLen
      const baseL = cx + Math.cos(t.angle + 2.6) * 6
      const baseR = cx + Math.cos(t.angle - 2.6) * 6
      const baseLY = cy + Math.sin(t.angle + 2.6) * 6
      const baseRY = cy + Math.sin(t.angle - 2.6) * 6

      this.shardCompassGfx.fillStyle(t.color, 1)
      this.shardCompassGfx.fillTriangle(tipX, tipY, baseL, baseLY, baseR, baseRY)

      // Center dot
      this.shardCompassGfx.fillStyle(0xffffff, 0.8)
      this.shardCompassGfx.fillCircle(cx, cy, 1.5)

      // Label + distance
      const tileDist = Math.round(t.dist / TILE_SIZE)
      const txt = this.shardCompassTexts[i]!
      txt.setText(`${t.label} ${tileDist}m`)
      txt.setPosition(cx, cy + radius + 5)
      txt.setColor(`#${t.color.toString(16).padStart(6, '0')}`)
      txt.setVisible(true)
    }

    // Hide unused text labels
    for (let i = targets.length; i < 5; i++) {
      this.shardCompassTexts[i]!.setVisible(false)
    }

    this.shardCompassGfx.setVisible(true)
  }

  /** Close the world map if open (called by WorldScene ESC handler) */
  closeWorldMap() {
    if (!this.worldMap?.visible) return
    this.worldMap.close()
    const worldScene = this.scene.get('WorldScene') as any
    const player = worldScene?.getPlayer?.()
    if (player) player.mapOpen = false
  }

  isWorldMapOpen(): boolean {
    return this.worldMap?.visible ?? false
  }
}
