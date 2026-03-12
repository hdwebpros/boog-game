import Phaser from 'phaser'
import { TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT } from '../world/TileRegistry'
import { SurfaceBiome } from '../world/WorldGenerator'
import type { WorldData } from '../world/WorldGenerator'
import type { BossMarker } from '../systems/MiniMap'

// Map cell dimensions (must match MiniMap)
const MAP_W = 240
const MAP_H = 64
const CELL_W = Math.ceil(WORLD_WIDTH / MAP_W)
const CELL_H = Math.ceil(WORLD_HEIGHT / MAP_H)

// Display
const SCREEN_W = 800
const SCREEN_H = 600
const BASE_SCALE = SCREEN_W / MAP_W // ~3.33

// Zoom
const MIN_ZOOM = 1
const MAX_ZOOM = 10
const ZOOM_SPEED = 0.15

// Waypoint colors
const WP_COLORS = [0xff4444, 0x44dd44, 0x4488ff, 0xffcc00, 0xff66cc, 0xff8800]

// Layer Y boundaries in tile coordinates
const LAYER_SKY = 80
const LAYER_SURFACE = 100
const LAYER_UNDERGROUND = 180
const LAYER_DEEP = 640
const LAYER_CORE = 1320

// Base depth for all full-map objects
const DEPTH = 500

export interface Waypoint {
  id: number
  name: string
  tileX: number
  tileY: number
  color: number
}

export class WorldMapPanel {
  private scene: Phaser.Scene
  private _visible = false

  // Display objects
  private bg!: Phaser.GameObjects.Graphics
  private mapImage!: Phaser.GameObjects.Image
  private overlay!: Phaser.GameObjects.Graphics
  private titleText!: Phaser.GameObjects.Text
  private coordsText!: Phaser.GameObjects.Text
  private controlsText!: Phaser.GameObjects.Text
  private zoomText!: Phaser.GameObjects.Text
  private biomeText!: Phaser.GameObjects.Text

  // Color picker
  private colorSwatches: Phaser.GameObjects.Arc[] = []
  private colorSelectRing!: Phaser.GameObjects.Arc

  // View state
  private centerX = MAP_W / 2
  private centerY = MAP_H / 2
  private zoom = MIN_ZOOM

  // Drag state
  private dragging = false
  private dragStartSX = 0
  private dragStartSY = 0
  private dragStartCX = 0
  private dragStartCY = 0

  // Waypoints
  private waypoints: Waypoint[] = []
  private selectedWpId = -1
  private nextWpId = 1
  private currentColorIdx = 0

  // References
  private explored: Uint8Array | null = null
  private worldData: WorldData | null = null
  private playerMapX = 0
  private playerMapY = 0
  private bossMarkers: BossMarker[] = []

  // Waypoint text labels
  private wpLabels: Map<number, Phaser.GameObjects.Text> = new Map()

  // Layer labels (drawn at left edge)
  private layerLabels: Phaser.GameObjects.Text[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  get visible() { return this._visible }

  create() {
    // Dark background overlay
    this.bg = this.scene.add.graphics().setDepth(DEPTH).setVisible(false)

    // Map image (uses minimap canvas texture)
    if (this.scene.textures.exists('_minimap')) {
      this.mapImage = this.scene.add.image(0, 0, '_minimap')
        .setOrigin(0, 0).setDepth(DEPTH + 1).setVisible(false)
    } else {
      // Placeholder — will be set once minimap texture exists
      this.mapImage = this.scene.add.image(0, 0, '__DEFAULT')
        .setOrigin(0, 0).setDepth(DEPTH + 1).setVisible(false)
    }

    // Overlay graphics for border, player, waypoints, grid
    this.overlay = this.scene.add.graphics().setDepth(DEPTH + 2).setVisible(false)

    // Title
    this.titleText = this.scene.add.text(SCREEN_W / 2, 14, 'WORLD MAP', {
      fontFamily: 'monospace', fontSize: '16px', color: '#aabbdd',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(DEPTH + 5).setVisible(false)

    // Coordinates display (top-right)
    this.coordsText = this.scene.add.text(SCREEN_W - 10, 12, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(DEPTH + 5).setVisible(false)

    // Zoom level (top-left)
    this.zoomText = this.scene.add.text(10, 12, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0, 0).setDepth(DEPTH + 5).setVisible(false)

    // Biome at cursor (bottom-center)
    this.biomeText = this.scene.add.text(SCREEN_W / 2, SCREEN_H - 10, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#bbccdd',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(DEPTH + 5).setVisible(false)

    // Controls hint
    this.controlsText = this.scene.add.text(SCREEN_W / 2, SCREEN_H - 26,
      'Scroll=Zoom  Drag=Pan  RightClick=Waypoint  C=Center  DEL=Remove  M/ESC=Close', {
        fontFamily: 'monospace', fontSize: '8px', color: '#556677',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 1).setDepth(DEPTH + 5).setVisible(false)

    // Color picker swatches (top-right area, below coords)
    this.createColorPicker()

    // Layer labels
    const layerDefs = [
      { name: 'Sky', tileY: 40 },
      { name: 'Surface', tileY: 90 },
      { name: 'Underground', tileY: 140 },
      { name: 'Deep', tileY: 400 },
      { name: 'Core', tileY: 1400 },
    ]
    for (const def of layerDefs) {
      const label = this.scene.add.text(0, 0, def.name, {
        fontFamily: 'monospace', fontSize: '9px', color: '#556688',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0, 0.5).setDepth(DEPTH + 4).setVisible(false)
      ;(label as any)._layerTileY = def.tileY
      this.layerLabels.push(label)
    }
  }

  private createColorPicker() {
    const startX = SCREEN_W - 14
    const startY = 36
    const spacing = 18
    const radius = 6

    for (let i = 0; i < WP_COLORS.length; i++) {
      const x = startX - (WP_COLORS.length - 1 - i) * spacing
      const swatch = this.scene.add.circle(x, startY, radius, WP_COLORS[i]!, 1)
        .setDepth(DEPTH + 6).setVisible(false).setInteractive()
      swatch.on('pointerdown', () => {
        this.currentColorIdx = i
        this.updateColorPickerSelection()
      })
      this.colorSwatches.push(swatch)
    }

    // Selection ring
    const selX = startX - (WP_COLORS.length - 1 - this.currentColorIdx) * spacing
    this.colorSelectRing = this.scene.add.circle(selX, startY, radius + 3)
      .setDepth(DEPTH + 5).setVisible(false)
    this.colorSelectRing.setStrokeStyle(2, 0xffffff, 0.9)
    this.colorSelectRing.setFillStyle(0x000000, 0)
  }

  private updateColorPickerSelection() {
    const startX = SCREEN_W - 14
    const spacing = 18
    const x = startX - (WP_COLORS.length - 1 - this.currentColorIdx) * spacing
    this.colorSelectRing.setPosition(x, 36)
  }

  setExplored(explored: Uint8Array) {
    this.explored = explored
  }

  setWorldData(worldData: WorldData) {
    this.worldData = worldData
  }

  open(playerMapX: number, playerMapY: number) {
    this._visible = true
    this.playerMapX = playerMapX
    this.playerMapY = playerMapY
    this.dragging = false

    // Center on player
    this.centerX = playerMapX
    this.centerY = playerMapY
    this.clampCenter()

    // Ensure map image uses the minimap texture
    if (this.scene.textures.exists('_minimap')) {
      this.mapImage.setTexture('_minimap')
    }

    this.setAllVisible(true)
  }

  close() {
    this._visible = false
    this.dragging = false
    this.setAllVisible(false)
    this.overlay.clear()
    this.bg.clear()

    // Hide waypoint labels
    for (const label of this.wpLabels.values()) {
      label.setVisible(false)
    }
    // Hide layer labels
    for (const label of this.layerLabels) {
      label.setVisible(false)
    }
  }

  private setAllVisible(v: boolean) {
    this.bg.setVisible(v)
    this.mapImage.setVisible(v)
    this.overlay.setVisible(v)
    this.titleText.setVisible(v)
    this.coordsText.setVisible(v)
    this.zoomText.setVisible(v)
    this.biomeText.setVisible(v)
    this.controlsText.setVisible(v)
    for (const swatch of this.colorSwatches) swatch.setVisible(v)
    this.colorSelectRing.setVisible(v)
  }

  // ── Coordinate transforms ──────────────────────────────

  private mapToScreen(mx: number, my: number): { sx: number; sy: number } {
    const s = this.zoom * BASE_SCALE
    return {
      sx: SCREEN_W / 2 + (mx - this.centerX) * s,
      sy: SCREEN_H / 2 + (my - this.centerY) * s,
    }
  }

  private screenToMap(sx: number, sy: number): { mx: number; my: number } {
    const s = this.zoom * BASE_SCALE
    return {
      mx: this.centerX + (sx - SCREEN_W / 2) / s,
      my: this.centerY + (sy - SCREEN_H / 2) / s,
    }
  }

  private mapToTile(mx: number, my: number): { tx: number; ty: number } {
    return {
      tx: Math.floor(mx * CELL_W),
      ty: Math.floor(my * CELL_H),
    }
  }

  private tileToMap(tx: number, ty: number): { mx: number; my: number } {
    return {
      mx: (tx + 0.5) / CELL_W,
      my: (ty + 0.5) / CELL_H,
    }
  }

  // ── Input handlers ─────────────────────────────────────

  onScroll(deltaY: number) {
    if (!this._visible) return

    const pointer = this.scene.input.activePointer

    // Get map position under cursor with current zoom
    const mapPos = this.screenToMap(pointer.x, pointer.y)

    // Apply zoom
    if (deltaY < 0) {
      this.zoom = Math.min(MAX_ZOOM, this.zoom * (1 + ZOOM_SPEED))
    } else {
      this.zoom = Math.max(MIN_ZOOM, this.zoom / (1 + ZOOM_SPEED))
    }

    // Adjust center so the point under cursor stays fixed
    const newS = this.zoom * BASE_SCALE
    this.centerX = mapPos.mx - (pointer.x - SCREEN_W / 2) / newS
    this.centerY = mapPos.my - (pointer.y - SCREEN_H / 2) / newS
    this.clampCenter()
  }

  onPointerDown(pointer: Phaser.Input.Pointer) {
    if (!this._visible) return

    // Check color picker hit
    for (let i = 0; i < this.colorSwatches.length; i++) {
      const sw = this.colorSwatches[i]!
      const dx = pointer.x - sw.x
      const dy = pointer.y - sw.y
      if (dx * dx + dy * dy < 100) return // Handled by interactive swatch
    }

    if (pointer.rightButtonDown()) {
      this.handleWaypointPlace(pointer.x, pointer.y)
      return
    }

    // Left-click: check waypoint hit first
    const clickedWp = this.findWaypointAt(pointer.x, pointer.y)
    if (clickedWp) {
      if (this.selectedWpId === clickedWp.id) {
        // Double-click-like: center on it
        const { mx, my } = this.tileToMap(clickedWp.tileX, clickedWp.tileY)
        this.centerX = mx
        this.centerY = my
        this.clampCenter()
      } else {
        this.selectedWpId = clickedWp.id
      }
      return
    }

    // Start drag
    this.selectedWpId = -1
    this.dragging = true
    this.dragStartSX = pointer.x
    this.dragStartSY = pointer.y
    this.dragStartCX = this.centerX
    this.dragStartCY = this.centerY
  }

  onPointerMove(pointer: Phaser.Input.Pointer) {
    if (!this._visible || !this.dragging) return

    const dx = pointer.x - this.dragStartSX
    const dy = pointer.y - this.dragStartSY

    const s = this.zoom * BASE_SCALE
    this.centerX = this.dragStartCX - dx / s
    this.centerY = this.dragStartCY - dy / s
    this.clampCenter()
  }

  onPointerUp() {
    this.dragging = false
  }

  centerOnPlayer() {
    if (!this._visible) return
    this.centerX = this.playerMapX
    this.centerY = this.playerMapY
    this.clampCenter()
  }

  deleteSelectedWaypoint() {
    if (!this._visible || this.selectedWpId < 0) return
    const idx = this.waypoints.findIndex(w => w.id === this.selectedWpId)
    if (idx >= 0) {
      const removed = this.waypoints.splice(idx, 1)[0]!
      const label = this.wpLabels.get(removed.id)
      if (label) { label.destroy(); this.wpLabels.delete(removed.id) }
    }
    this.selectedWpId = -1
  }

  renameSelectedWaypoint() {
    if (!this._visible || this.selectedWpId < 0) return
    const wp = this.waypoints.find(w => w.id === this.selectedWpId)
    if (!wp) return
    const name = window.prompt('Rename waypoint:', wp.name)
    if (name) wp.name = name
  }

  private clampCenter() {
    // Allow some padding so player can see edges
    const pad = 2
    this.centerX = Math.max(-pad, Math.min(MAP_W + pad, this.centerX))
    this.centerY = Math.max(-pad, Math.min(MAP_H + pad, this.centerY))
  }

  private handleWaypointPlace(sx: number, sy: number) {
    const { mx, my } = this.screenToMap(sx, sy)
    if (mx < 0 || mx >= MAP_W || my < 0 || my >= MAP_H) return

    // Check if explored
    if (this.explored) {
      const cellX = Math.floor(mx)
      const cellY = Math.floor(my)
      if (cellX >= 0 && cellX < MAP_W && cellY >= 0 && cellY < MAP_H) {
        if (!this.explored[cellY * MAP_W + cellX]) return
      }
    }

    const { tx, ty } = this.mapToTile(mx, my)

    const defaultName = `Waypoint ${this.nextWpId}`
    const name = window.prompt('Waypoint name:', defaultName)
    if (!name) return

    const wp: Waypoint = {
      id: this.nextWpId++,
      name,
      tileX: tx,
      tileY: ty,
      color: WP_COLORS[this.currentColorIdx]!,
    }
    this.waypoints.push(wp)
  }

  private findWaypointAt(sx: number, sy: number): Waypoint | null {
    const hitRadius = 14
    for (const wp of this.waypoints) {
      const { mx, my } = this.tileToMap(wp.tileX, wp.tileY)
      const pos = this.mapToScreen(mx, my)
      const dx = sx - pos.sx
      const dy = sy - pos.sy
      if (dx * dx + dy * dy < hitRadius * hitRadius) return wp
    }
    return null
  }

  // ── Rendering ──────────────────────────────────────────

  update(playerMapX: number, playerMapY: number, bossMarkers: BossMarker[]) {
    if (!this._visible) return
    this.playerMapX = playerMapX
    this.playerMapY = playerMapY
    this.bossMarkers = bossMarkers
    this.render()
  }

  private render() {
    const s = this.zoom * BASE_SCALE

    // Background
    this.bg.clear()
    this.bg.fillStyle(0x080818, 0.95)
    this.bg.fillRect(0, 0, SCREEN_W, SCREEN_H)

    // Subtle vignette edges
    this.bg.fillStyle(0x000000, 0.3)
    this.bg.fillRect(0, 0, SCREEN_W, 4)
    this.bg.fillRect(0, SCREEN_H - 4, SCREEN_W, 4)
    this.bg.fillRect(0, 0, 4, SCREEN_H)
    this.bg.fillRect(SCREEN_W - 4, 0, 4, SCREEN_H)

    // Position and scale the map image
    const topLeft = this.mapToScreen(0, 0)
    this.mapImage.setPosition(topLeft.sx, topLeft.sy)
    this.mapImage.setScale(s)
    this.mapImage.setCrop(0, 0, MAP_W, MAP_H)

    // Overlay
    this.overlay.clear()

    // Layer boundary lines
    this.drawLayerLines()

    // Grid lines at high zoom
    if (this.zoom >= 4) {
      this.drawGrid()
    }

    // Map border
    const tl = this.mapToScreen(0, 0)
    const br = this.mapToScreen(MAP_W, MAP_H)
    this.overlay.lineStyle(2, 0x334466, 0.5)
    this.overlay.strokeRect(tl.sx, tl.sy, br.sx - tl.sx, br.sy - tl.sy)

    // Viewport rectangle
    this.drawViewport()

    // Boss markers
    this.drawBossMarkers()

    // Waypoints
    this.drawWaypoints()

    // Player position (drawn last, on top)
    this.drawPlayer()

    // Layer labels
    this.updateLayerLabels()

    // Update text displays
    this.zoomText.setText(`Zoom: ${this.zoom.toFixed(1)}x`)

    const pointer = this.scene.input.activePointer
    const { mx, my } = this.screenToMap(pointer.x, pointer.y)
    const { tx, ty } = this.mapToTile(mx, my)
    if (tx >= 0 && tx < WORLD_WIDTH && ty >= 0 && ty < WORLD_HEIGHT) {
      this.coordsText.setText(`${tx}, ${ty}`)
    } else {
      this.coordsText.setText('')
    }

    this.updateBiomeText(tx, ty)
  }

  private drawLayerLines() {
    const boundaries = [
      { tileY: LAYER_SKY, color: 0x4466aa, label: 'Sky' },
      { tileY: LAYER_SURFACE, color: 0x448844, label: 'Surface' },
      { tileY: LAYER_UNDERGROUND, color: 0x886644, label: 'Underground' },
      { tileY: LAYER_DEEP, color: 0x664444, label: 'Deep' },
      { tileY: LAYER_CORE, color: 0xff4422, label: 'Core' },
    ]

    for (const b of boundaries) {
      const mapY = b.tileY / CELL_H
      const left = this.mapToScreen(0, mapY)
      const right = this.mapToScreen(MAP_W, mapY)

      if (left.sy < -10 || left.sy > SCREEN_H + 10) continue

      this.overlay.lineStyle(1, b.color, 0.3)
      this.overlay.lineBetween(
        Math.max(0, left.sx), left.sy,
        Math.min(SCREEN_W, right.sx), right.sy,
      )
    }
  }

  private drawGrid() {
    // Chunk grid (32 tiles per chunk)
    const chunkTiles = 32
    const chunkMapW = chunkTiles / CELL_W
    const chunkMapH = chunkTiles / CELL_H

    this.overlay.lineStyle(1, 0x334466, 0.1)

    // Vertical lines
    for (let x = 0; x <= MAP_W; x += chunkMapW) {
      const top = this.mapToScreen(x, 0)
      const bot = this.mapToScreen(x, MAP_H)
      if (top.sx < -1 || top.sx > SCREEN_W + 1) continue
      this.overlay.lineBetween(top.sx, Math.max(0, top.sy), top.sx, Math.min(SCREEN_H, bot.sy))
    }

    // Horizontal lines
    for (let y = 0; y <= MAP_H; y += chunkMapH) {
      const left = this.mapToScreen(0, y)
      const right = this.mapToScreen(MAP_W, y)
      if (left.sy < -1 || left.sy > SCREEN_H + 1) continue
      this.overlay.lineBetween(Math.max(0, left.sx), left.sy, Math.min(SCREEN_W, right.sx), left.sy)
    }
  }

  private drawPlayer() {
    const { sx, sy } = this.mapToScreen(this.playerMapX, this.playerMapY)
    if (sx < -30 || sx > SCREEN_W + 30 || sy < -30 || sy > SCREEN_H + 30) return

    const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.005)
    const dotSize = Math.max(4, Math.round(this.zoom * 1.5))

    // Outer glow
    this.overlay.fillStyle(0x4488ff, pulse * 0.15)
    this.overlay.fillCircle(sx, sy, dotSize + 6)

    // Inner glow
    this.overlay.fillStyle(0x88bbff, pulse * 0.3)
    this.overlay.fillCircle(sx, sy, dotSize + 3)

    // Player dot
    this.overlay.fillStyle(0xffffff, pulse)
    this.overlay.fillCircle(sx, sy, dotSize)

    // Arrow above player
    const arrowH = Math.max(6, dotSize)
    this.overlay.fillStyle(0xffffff, pulse)
    this.overlay.fillTriangle(
      sx, sy - dotSize - 3,
      sx - arrowH * 0.6, sy - dotSize - 3 - arrowH,
      sx + arrowH * 0.6, sy - dotSize - 3 - arrowH,
    )
  }

  private drawBossMarkers() {
    const worldPxW = WORLD_WIDTH * TILE_SIZE
    const worldPxH = WORLD_HEIGHT * TILE_SIZE

    for (const marker of this.bossMarkers) {
      const mx = (marker.worldX / worldPxW) * MAP_W
      const my = (marker.worldY / worldPxH) * MAP_H
      const { sx, sy } = this.mapToScreen(mx, my)
      if (sx < -30 || sx > SCREEN_W + 30 || sy < -30 || sy > SCREEN_H + 30) continue

      const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.003 + marker.bossType.length)
      const size = Math.max(5, Math.round(this.zoom * 2))

      // Red diamond
      this.overlay.fillStyle(0xff2222, pulse)
      this.overlay.fillTriangle(sx, sy - size, sx - size * 0.7, sy, sx + size * 0.7, sy)
      this.overlay.fillTriangle(sx, sy + size, sx - size * 0.7, sy, sx + size * 0.7, sy)

      // Dark border
      this.overlay.lineStyle(1, 0x000000, 0.5)
      this.overlay.lineBetween(sx, sy - size, sx + size * 0.7, sy)
      this.overlay.lineBetween(sx + size * 0.7, sy, sx, sy + size)
      this.overlay.lineBetween(sx, sy + size, sx - size * 0.7, sy)
      this.overlay.lineBetween(sx - size * 0.7, sy, sx, sy - size)
    }
  }

  private drawWaypoints() {
    for (const wp of this.waypoints) {
      const { mx, my } = this.tileToMap(wp.tileX, wp.tileY)
      const { sx, sy } = this.mapToScreen(mx, my)
      if (sx < -40 || sx > SCREEN_W + 40 || sy < -40 || sy > SCREEN_H + 40) continue

      const isSelected = wp.id === this.selectedWpId
      const pinR = isSelected ? 7 : 5
      const pinH = isSelected ? 12 : 9

      // Pin tail (triangle pointing down to exact position)
      this.overlay.fillStyle(wp.color, 1)
      this.overlay.fillTriangle(
        sx, sy,
        sx - pinR * 0.7, sy - pinH * 0.5,
        sx + pinR * 0.7, sy - pinH * 0.5,
      )

      // Pin head (circle)
      this.overlay.fillStyle(wp.color, 1)
      this.overlay.fillCircle(sx, sy - pinH, pinR)

      // Inner dot
      this.overlay.fillStyle(0xffffff, 0.4)
      this.overlay.fillCircle(sx, sy - pinH, pinR * 0.4)

      // Dark outline
      this.overlay.lineStyle(1, 0x000000, 0.6)
      this.overlay.strokeCircle(sx, sy - pinH, pinR)

      // Selection ring
      if (isSelected) {
        const ringPulse = 0.6 + 0.4 * Math.sin(Date.now() * 0.006)
        this.overlay.lineStyle(2, 0xffffff, ringPulse)
        this.overlay.strokeCircle(sx, sy - pinH, pinR + 4)
      }

      // Name label
      this.updateWpLabel(wp, sx, sy - pinH - pinR - 4)
    }
  }

  private updateWpLabel(wp: Waypoint, sx: number, sy: number) {
    let label = this.wpLabels.get(wp.id)
    if (!label) {
      label = this.scene.add.text(0, 0, '', {
        fontFamily: 'monospace', fontSize: '9px', color: '#ffffff',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 1).setDepth(DEPTH + 3)
      this.wpLabels.set(wp.id, label)
    }
    label.setText(wp.name)
    label.setPosition(Math.round(sx), Math.round(sy))

    const showLabel = this._visible && (this.zoom >= 2 || wp.id === this.selectedWpId)
    label.setVisible(showLabel)
  }

  private drawViewport() {
    const worldScene = this.scene.scene.get('WorldScene')
    const cam = worldScene?.cameras?.main
    if (!cam) return

    const worldPxW = WORLD_WIDTH * TILE_SIZE
    const worldPxH = WORLD_HEIGHT * TILE_SIZE

    const vx1 = (cam.worldView.x / worldPxW) * MAP_W
    const vy1 = (cam.worldView.y / worldPxH) * MAP_H
    const vw = (cam.worldView.width / worldPxW) * MAP_W
    const vh = (cam.worldView.height / worldPxH) * MAP_H

    const tl = this.mapToScreen(vx1, vy1)
    const br = this.mapToScreen(vx1 + vw, vy1 + vh)

    this.overlay.lineStyle(1, 0xffffff, 0.25)
    this.overlay.strokeRect(tl.sx, tl.sy, br.sx - tl.sx, br.sy - tl.sy)
  }

  private updateLayerLabels() {
    for (const label of this.layerLabels) {
      const tileY = (label as any)._layerTileY as number
      const mapY = tileY / CELL_H
      const { sy } = this.mapToScreen(0, mapY)
      const { sx: leftEdge } = this.mapToScreen(0, 0)

      const x = Math.max(6, leftEdge + 4)
      label.setPosition(x, sy)
      label.setVisible(this._visible && this.zoom >= 2 && sy > 36 && sy < SCREEN_H - 30)
    }
  }

  private updateBiomeText(tx: number, ty: number) {
    if (!this.worldData || tx < 0 || tx >= WORLD_WIDTH || ty < 0 || ty >= WORLD_HEIGHT) {
      this.biomeText.setText('')
      return
    }

    let zoneName = ''
    if (ty < LAYER_SKY) zoneName = 'Cloud City'
    else if (ty >= LAYER_CORE) zoneName = 'The Core'
    else if (ty >= LAYER_DEEP) zoneName = 'Deep Underground'
    else if (ty >= LAYER_UNDERGROUND) zoneName = 'Underground'
    else if (ty >= LAYER_SURFACE) zoneName = 'Underground'
    else {
      const biome = this.worldData.surfaceBiomes?.[tx] ?? SurfaceBiome.PLAINS
      switch (biome) {
        case SurfaceBiome.FOREST: zoneName = 'Forest'; break
        case SurfaceBiome.DESERT: zoneName = 'Desert'; break
        case SurfaceBiome.MOUNTAINS: zoneName = 'Mountains'; break
        case SurfaceBiome.LAKE: zoneName = 'Lake'; break
        case SurfaceBiome.SNOW: zoneName = 'Snowfields'; break
        case SurfaceBiome.JUNGLE: zoneName = 'Jungle'; break
        case SurfaceBiome.MUSHROOM: zoneName = 'Mushroom Grotto'; break
        default: zoneName = 'Plains'; break
      }
    }

    this.biomeText.setText(zoneName)
  }

  // ── Waypoint persistence ───────────────────────────────

  getWaypoints(): Waypoint[] {
    return this.waypoints.map(w => ({ ...w }))
  }

  loadWaypoints(data: Waypoint[]) {
    // Clean up old labels
    for (const label of this.wpLabels.values()) label.destroy()
    this.wpLabels.clear()

    this.waypoints = data.map(w => ({ ...w }))
    this.nextWpId = data.reduce((max, w) => Math.max(max, w.id + 1), 1)
  }

  // ── Cleanup ────────────────────────────────────────────

  destroy() {
    this.bg.destroy()
    this.mapImage.destroy()
    this.overlay.destroy()
    this.titleText.destroy()
    this.coordsText.destroy()
    this.zoomText.destroy()
    this.biomeText.destroy()
    this.controlsText.destroy()
    for (const swatch of this.colorSwatches) swatch.destroy()
    this.colorSelectRing.destroy()
    for (const label of this.wpLabels.values()) label.destroy()
    this.wpLabels.clear()
    for (const label of this.layerLabels) label.destroy()
    this.layerLabels = []
  }
}
