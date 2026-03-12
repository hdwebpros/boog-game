import Phaser from 'phaser'
import type { InventoryManager } from '../systems/InventoryManager'
import { getItemDef } from '../data/items'
import { AudioManager } from '../systems/AudioManager'
import { SoundId } from '../data/sounds'
import { SHOP_INVENTORY, SELL_PRICES } from '../data/shop'
import { ACCESSORY_EFFECTS } from '../data/accessories'

export class ShopPanel {
  private scene: Phaser.Scene
  private shopGfx!: Phaser.GameObjects.Graphics
  private shopTexts: Phaser.GameObjects.Text[] = []
  private shopTitle!: Phaser.GameObjects.Text
  private shopVisible = false
  private shopTab: 'buy' | 'sell' = 'buy'
  private shopScroll = 0
  private shopClickPending: { x: number; y: number } | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  get visible() { return this.shopVisible }

  setGraphics(gfx: Phaser.GameObjects.Graphics, title: Phaser.GameObjects.Text) {
    this.shopGfx = gfx
    this.shopTitle = title
  }

  /** Called from UIScene's pointerdown handler */
  onPointerDown(x: number, y: number) {
    if (this.shopVisible) {
      this.shopClickPending = { x, y }
    }
  }

  onScroll(deltaY: number) {
    if (!this.shopVisible) return
    this.shopScroll += deltaY > 0 ? 1 : -1
    this.shopScroll = Math.max(0, this.shopScroll)
  }

  update(player: any, inv: InventoryManager, pointerJustDown: boolean) {
    const shouldShow = player.shopOpen === true
    if (shouldShow !== this.shopVisible) {
      this.shopVisible = shouldShow
      if (!shouldShow) this.shopScroll = 0
    }

    this.shopGfx.clear()
    this.shopTitle.setVisible(false)

    for (const t of this.shopTexts) t.destroy()
    this.shopTexts = []

    if (!this.shopVisible) {
      this.shopClickPending = null
      return
    }

    const { width, height } = this.scene.scale
    const SHOP_W = 360
    const SHOP_H = 420
    const shopX = (width - SHOP_W) / 2
    const shopY = (height - SHOP_H) / 2

    this.shopGfx.fillStyle(0x0a0a1a, 0.95)
    this.shopGfx.fillRect(shopX, shopY, SHOP_W, SHOP_H)
    this.shopGfx.lineStyle(2, 0xddaa44)
    this.shopGfx.strokeRect(shopX, shopY, SHOP_W, SHOP_H)

    this.shopTitle.setText('Sky Merchant')
    this.shopTitle.setPosition(shopX + SHOP_W / 2, shopY + 6)
    this.shopTitle.setVisible(true)

    const coins = inv.getCount(250)
    const coinText = this.scene.add.text(shopX + SHOP_W - 10, shopY + 8, `${coins} coins`, {
      fontSize: '12px', color: '#ccccdd', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(332)
    this.shopTexts.push(coinText)

    const tabY = shopY + 28
    const pointer = this.scene.input.activePointer

    for (const tab of ['buy', 'sell'] as const) {
      const tx = tab === 'buy' ? shopX + SHOP_W / 4 : shopX + (SHOP_W * 3) / 4
      const isActive = this.shopTab === tab
      this.shopGfx.fillStyle(isActive ? 0x334466 : 0x1a1a2e, 0.9)
      this.shopGfx.fillRect(tx - 60, tabY, 120, 22)
      this.shopGfx.lineStyle(1, isActive ? 0x6688aa : 0x333355)
      this.shopGfx.strokeRect(tx - 60, tabY, 120, 22)

      const tabLabel = this.scene.add.text(tx, tabY + 11, tab.toUpperCase(), {
        fontSize: '12px', color: isActive ? '#ffdd44' : '#666666', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5).setDepth(332)
      this.shopTexts.push(tabLabel)

      const tabClicked = pointerJustDown || this.shopClickPending !== null
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
      this.renderBuyTab(inv, shopX, listY, SHOP_W, ROW_H, maxRows, pointer, coins, pointerJustDown)
      this.shopClickPending = null
    } else {
      this.renderSellTab(inv, shopX, listY, SHOP_W, ROW_H, maxRows, pointer, pointerJustDown)
    }
  }

  private renderBuyTab(
    inv: InventoryManager, shopX: number, listY: number,
    shopW: number, rowH: number, maxRows: number,
    pointer: Phaser.Input.Pointer, coins: number, pointerJustDown: boolean
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

      if (i % 2 === 0) {
        this.shopGfx.fillStyle(0x111122, 0.3)
        this.shopGfx.fillRect(shopX + 4, ry, shopW - 8, rowH)
      }

      const hovered = pointer.x >= shopX + 4 && pointer.x < shopX + shopW - 4 &&
                       pointer.y >= ry && pointer.y < ry + rowH
      if (hovered) {
        this.shopGfx.fillStyle(0xffffff, 0.08)
        this.shopGfx.fillRect(shopX + 4, ry, shopW - 8, rowH)
      }

      this.shopGfx.fillStyle(def.color, 0.9)
      this.shopGfx.fillRect(shopX + 10, ry + 4, 24, 24)
      this.shopGfx.lineStyle(1, 0x555577)
      this.shopGfx.strokeRect(shopX + 10, ry + 4, 24, 24)

      const nameColor = alreadyOwned ? '#666666' : canAfford ? '#ffffff' : '#884444'
      const nameText = this.scene.add.text(shopX + 40, ry + 4, def.name, {
        fontSize: '11px', color: nameColor, fontFamily: 'monospace',
      }).setDepth(332)
      this.shopTexts.push(nameText)

      const descText = this.scene.add.text(shopX + 40, ry + 18, eff?.description ?? '', {
        fontSize: '9px', color: '#888888', fontFamily: 'monospace',
      }).setDepth(332)
      this.shopTexts.push(descText)

      const priceStr = alreadyOwned ? 'OWNED' : `${item.price}c`
      const priceColor = alreadyOwned ? '#666666' : canAfford ? '#ccccdd' : '#884444'
      const priceText = this.scene.add.text(shopX + shopW - 10, ry + 10, priceStr, {
        fontSize: '11px', color: priceColor, fontFamily: 'monospace',
      }).setOrigin(1, 0).setDepth(332)
      this.shopTexts.push(priceText)

      const buyClicked = pointerJustDown || this.shopClickPending !== null
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
    pointer: Phaser.Input.Pointer, pointerJustDown: boolean
  ) {
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
      const emptyText = this.scene.add.text(shopX + shopW / 2, listY + 40, 'No sellable items', {
        fontSize: '12px', color: '#666666', fontFamily: 'monospace',
      }).setOrigin(0.5, 0).setDepth(332)
      this.shopTexts.push(emptyText)
      this.shopClickPending = null
      return
    }

    const maxScroll = Math.max(0, sellable.length - maxRows)
    this.shopScroll = Phaser.Math.Clamp(this.shopScroll, 0, maxScroll)

    const SELL_ALL_W = 52
    const SELL_ALL_H = 20

    if (this.shopScroll > 0) {
      const upText = this.scene.add.text(shopX + shopW / 2, listY - 12, '\u25B2 scroll up', {
        fontSize: '9px', color: '#888888', fontFamily: 'monospace',
      }).setOrigin(0.5, 0.5).setDepth(332)
      this.shopTexts.push(upText)
    }
    if (this.shopScroll < maxScroll) {
      const downY = listY + maxRows * rowH + 4
      const downText = this.scene.add.text(shopX + shopW / 2, downY, '\u25BC scroll down', {
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

      const sellAllX = shopX + shopW - SELL_ALL_W - 8
      const sellAllY = ry + (rowH - SELL_ALL_H) / 2

      const hoveredSellAll = pointer.x >= sellAllX && pointer.x < sellAllX + SELL_ALL_W &&
                             pointer.y >= sellAllY && pointer.y < sellAllY + SELL_ALL_H

      const hoveredRow = pointer.x >= shopX + 4 && pointer.x < sellAllX - 4 &&
                         pointer.y >= ry && pointer.y < ry + rowH

      if (hoveredRow || hoveredSellAll) {
        this.shopGfx.fillStyle(0xffffff, 0.08)
        this.shopGfx.fillRect(shopX + 4, ry, shopW - 8, rowH)
      }

      const color = def?.color ?? 0xffffff
      this.shopGfx.fillStyle(color, 0.9)
      this.shopGfx.fillRect(shopX + 10, ry + 6, 20, 20)

      const nameText = this.scene.add.text(shopX + 36, ry + 6, `${name} x${entry.count}`, {
        fontSize: '11px', color: '#ffffff', fontFamily: 'monospace',
      }).setDepth(332)
      this.shopTexts.push(nameText)

      const priceText = this.scene.add.text(sellAllX - 6, ry + 6, `${entry.price}c`, {
        fontSize: '10px', color: '#ccccdd', fontFamily: 'monospace',
      }).setOrigin(1, 0).setDepth(332)
      this.shopTexts.push(priceText)

      const sellAllBtnColor = hoveredSellAll ? 0x446644 : 0x223322
      this.shopGfx.fillStyle(sellAllBtnColor, 0.9)
      this.shopGfx.fillRect(sellAllX, sellAllY, SELL_ALL_W, SELL_ALL_H)
      this.shopGfx.lineStyle(1, hoveredSellAll ? 0x88cc88 : 0x446644)
      this.shopGfx.strokeRect(sellAllX, sellAllY, SELL_ALL_W, SELL_ALL_H)

      const sellAllLabel = this.scene.add.text(sellAllX + SELL_ALL_W / 2, sellAllY + SELL_ALL_H / 2, 'Sell All', {
        fontSize: '9px', color: hoveredSellAll ? '#88ff88' : '#66aa66', fontFamily: 'monospace',
      }).setOrigin(0.5, 0.5).setDepth(332)
      this.shopTexts.push(sellAllLabel)

      const clicked = pointerJustDown || this.shopClickPending !== null
      const clickX = this.shopClickPending?.x ?? pointer.x
      const clickY = this.shopClickPending?.y ?? pointer.y

      const clickedSellAll = clicked &&
        clickX >= sellAllX && clickX < sellAllX + SELL_ALL_W &&
        clickY >= sellAllY && clickY < sellAllY + SELL_ALL_H

      const clickedRow = clicked && !clickedSellAll &&
        clickX >= shopX + 4 && clickX < sellAllX - 4 &&
        clickY >= ry && clickY < ry + rowH

      if (clickedRow) {
        const sold = this.sellItem(inv, entry.id, 1)
        if (sold > 0) AudioManager.get()?.play(SoundId.CRAFT_SUCCESS)
      }

      if (clickedSellAll) {
        const sold = this.sellItem(inv, entry.id, entry.count)
        if (sold > 0) AudioManager.get()?.play(SoundId.CRAFT_SUCCESS)
      }
    }

    this.shopClickPending = null
  }
}
