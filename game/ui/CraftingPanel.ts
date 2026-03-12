import Phaser from 'phaser'
import type { InventoryManager } from '../systems/InventoryManager'
import type { Recipe } from '../data/recipes'
import { CraftingManager } from '../systems/CraftingManager'
import { TileType, TILE_PROPERTIES } from '../world/TileRegistry'
import { getItemDef } from '../data/items'
import { AudioManager } from '../systems/AudioManager'
import { SoundId } from '../data/sounds'

const CRAFT_W = 320
const CRAFT_H = 400
const CRAFT_ROW_H = 32

export class CraftingPanel {
  private scene: Phaser.Scene
  private craftingManager = new CraftingManager()
  private craftGfx!: Phaser.GameObjects.Graphics
  private craftTexts: Phaser.GameObjects.Text[] = []
  private craftTitle!: Phaser.GameObjects.Text
  private craftVisible = false
  private craftScroll = 0
  private craftRecipes: { recipe: Recipe; canCraft: boolean }[] = []
  private craftHoveredRow = -1

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  get visible() { return this.craftVisible }

  create() {
    this.craftTexts = []
    this.craftVisible = false

    const { width, height } = this.scene.scale
    const craftX = (width - CRAFT_W) / 2
    const craftY = (height - CRAFT_H) / 2 - 20

    this.craftGfx = this.scene.add.graphics().setDepth(300)
    this.craftTitle = this.scene.add.text(width / 2, craftY + 12, 'CRAFTING', {
      fontSize: '16px', color: '#ffff00', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(301).setVisible(false)

    const maxVisible = Math.floor((CRAFT_H - 40) / CRAFT_ROW_H)
    for (let i = 0; i < maxVisible; i++) {
      const t = this.scene.add.text(craftX + 10, craftY + 38 + i * CRAFT_ROW_H, '', {
        fontSize: '11px', color: '#cccccc', fontFamily: 'monospace',
      }).setDepth(301).setVisible(false)
      this.craftTexts.push(t)
    }

    // Click handler
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.craftVisible) return
      const cx = (this.scene.scale.width - CRAFT_W) / 2
      const cy = (this.scene.scale.height - CRAFT_H) / 2 - 20
      const listTop = cy + 36
      const listBot = listTop + this.craftTexts.length * CRAFT_ROW_H
      if (pointer.x < cx + 2 || pointer.x > cx + CRAFT_W - 2) return
      if (pointer.y < listTop || pointer.y >= listBot) return
      const row = Math.floor((pointer.y - listTop) / CRAFT_ROW_H)
      this.onCraftClick(row)
    })
  }

  onScroll(deltaY: number) {
    if (!this.craftVisible) return
    this.craftScroll += deltaY > 0 ? 1 : -1
    this.craftScroll = Math.max(0, this.craftScroll)
  }

  update(player: any, inv: InventoryManager, chunks: any) {
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

    this.craftRecipes = this.craftingManager.getAvailableRecipes(
      player.sprite.x, player.sprite.y, chunks
    )
    this.craftingManager.checkCraftable(this.craftRecipes, inv)

    const { width, height } = this.scene.scale
    const craftX = (width - CRAFT_W) / 2
    const craftY = (height - CRAFT_H) / 2 - 20

    this.craftGfx.fillStyle(0x0a0a1a, 0.95)
    this.craftGfx.fillRect(craftX, craftY, CRAFT_W, CRAFT_H)
    this.craftGfx.lineStyle(2, 0x444466)
    this.craftGfx.strokeRect(craftX, craftY, CRAFT_W, CRAFT_H)

    const maxVisible = this.craftTexts.length
    const maxScroll = Math.max(0, this.craftRecipes.length - maxVisible)
    this.craftScroll = Phaser.Math.Clamp(this.craftScroll, 0, maxScroll)

    const pointer = this.scene.input.activePointer
    const listTop = craftY + 36
    const listBot = listTop + maxVisible * CRAFT_ROW_H
    if (pointer.x >= craftX + 2 && pointer.x <= craftX + CRAFT_W - 2 &&
        pointer.y >= listTop && pointer.y < listBot) {
      this.craftHoveredRow = Math.floor((pointer.y - listTop) / CRAFT_ROW_H)
    } else {
      this.craftHoveredRow = -1
    }

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

    const worldScene = this.scene.scene.get('WorldScene') as any
    const player = worldScene?.getPlayer()
    if (!player) return

    this.craftingManager.craft(entry.recipe, player.inventory)
    AudioManager.get()?.play(SoundId.CRAFT_SUCCESS)
  }
}
