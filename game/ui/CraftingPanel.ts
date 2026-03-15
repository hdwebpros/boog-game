import Phaser from 'phaser'
import type { InventoryManager } from '../systems/InventoryManager'
import type { Recipe } from '../data/recipes'
import { CraftingManager } from '../systems/CraftingManager'
import { TileType, TILE_PROPERTIES } from '../world/TileRegistry'
import { getItemDef } from '../data/items'
import { AudioManager } from '../systems/AudioManager'
import { SoundId } from '../data/sounds'

const CRAFT_W = 380
const CRAFT_H = 400
const CRAFT_ROW_H = 32
const MAX_INPUTS_PER_ROW = 6
const CHAR_W = 6.6 // approximate monospace char width at 10px

export class CraftingPanel {
  private scene: Phaser.Scene
  private craftingManager = new CraftingManager()
  private craftGfx!: Phaser.GameObjects.Graphics
  private craftOutputTexts: Phaser.GameObjects.Text[] = []
  private craftInputTexts: Phaser.GameObjects.Text[][] = []
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
    this.craftOutputTexts = []
    this.craftInputTexts = []
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
      const output = this.scene.add.text(craftX + 10, craftY + 38 + i * CRAFT_ROW_H, '', {
        fontSize: '11px', color: '#cccccc', fontFamily: 'monospace',
      }).setDepth(301).setVisible(false)
      this.craftOutputTexts.push(output)

      const inputs: Phaser.GameObjects.Text[] = []
      for (let j = 0; j < MAX_INPUTS_PER_ROW; j++) {
        const t = this.scene.add.text(0, craftY + 38 + i * CRAFT_ROW_H + 1, '', {
          fontSize: '10px', color: '#666666', fontFamily: 'monospace',
        }).setDepth(301).setVisible(false)
        inputs.push(t)
      }
      this.craftInputTexts.push(inputs)
    }

    // Click handler
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.craftVisible) return
      const cx = (this.scene.scale.width - CRAFT_W) / 2
      const cy = (this.scene.scale.height - CRAFT_H) / 2 - 20
      const listTop = cy + 36
      const listBot = listTop + this.craftOutputTexts.length * CRAFT_ROW_H
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
      for (const t of this.craftOutputTexts) t.setVisible(false)
      for (const row of this.craftInputTexts) {
        for (const t of row) t.setVisible(false)
      }
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

    const maxVisible = this.craftOutputTexts.length
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
      const outputTxt = this.craftOutputTexts[i]!
      const inputRow = this.craftInputTexts[i]!

      const entry = this.craftRecipes[recipeIdx]
      if (entry) {
        const { recipe, canCraft } = entry
        const outDef = getItemDef(recipe.output.itemId)
        const outName = outDef?.name ?? `Item ${recipe.output.itemId}`
        const qty = recipe.output.count > 1 ? ` x${recipe.output.count}` : ''
        const hovered = i === this.craftHoveredRow

        // Output name
        outputTxt.setText(`${outName}${qty}`)
        outputTxt.setColor(hovered ? '#ffffff' : canCraft ? '#00ff88' : '#bbbbbb')
        outputTxt.setVisible(true)
        outputTxt.setPosition(craftX + 10, craftY + 38 + i * CRAFT_ROW_H)

        // Ingredient texts — position after output name
        const outputChars = outName.length + qty.length
        let curX = craftX + 10 + (outputChars + 2) * CHAR_W // 2 chars gap
        const maxX = craftX + CRAFT_W - 12

        for (let j = 0; j < MAX_INPUTS_PER_ROW; j++) {
          const inputTxt = inputRow[j]!
          const inp = recipe.inputs[j]
          if (!inp) { inputTxt.setVisible(false); continue }

          const def = getItemDef(inp.itemId)
          const matName = def?.name ?? TILE_PROPERTIES[inp.itemId as TileType]?.name ?? '?'
          // Truncate long names
          const shortName = matName.length > 10 ? matName.slice(0, 9) + '…' : matName
          const label = `${shortName}x${inp.count}`
          const labelW = label.length * CHAR_W + 6

          // Skip if it won't fit
          if (curX + labelW > maxX) {
            inputTxt.setText('...')
            inputTxt.setColor('#555555')
            inputTxt.setPosition(curX, craftY + 39 + i * CRAFT_ROW_H)
            inputTxt.setVisible(true)
            // Hide remaining
            for (let k = j + 1; k < MAX_INPUTS_PER_ROW; k++) {
              inputRow[k]!.setVisible(false)
            }
            break
          }

          const hasCount = inv.getCount(inp.itemId)
          const hasEnough = hasCount >= inp.count
          let color: string
          if (hovered) {
            color = hasEnough ? '#ffffff' : '#aa6666'
          } else if (canCraft) {
            color = '#00cc66'
          } else {
            color = hasEnough ? '#66bb77' : '#664444'
          }

          inputTxt.setText(label)
          inputTxt.setColor(color)
          inputTxt.setPosition(curX, craftY + 39 + i * CRAFT_ROW_H)
          inputTxt.setVisible(true)

          curX += labelW
        }

        // Row background
        if (hovered && canCraft) {
          this.craftGfx.fillStyle(0x004433, 0.5)
        } else if (canCraft) {
          this.craftGfx.fillStyle(0x003322, 0.3)
        } else {
          this.craftGfx.fillStyle(0x111122, 0.3)
        }
        this.craftGfx.fillRect(craftX + 2, craftY + 36 + i * CRAFT_ROW_H, CRAFT_W - 4, CRAFT_ROW_H)
      } else {
        outputTxt.setVisible(false)
        for (const t of inputRow) t.setVisible(false)
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
