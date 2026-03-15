import Phaser from 'phaser'
import type { InventoryManager } from '../systems/InventoryManager'
import type { SkillTreeManager } from '../systems/SkillTreeManager'
import { BUFF_DEFS } from '../data/potions'
import type { ActiveBuff } from '../systems/BuffManager'

const JETPACK_PARTS = [
  { id: 180, name: 'Fuel Cell',   color: 0xddaa33 },
  { id: 181, name: 'Thruster',    color: 0xbbbbbb },
  { id: 182, name: 'Valve',       color: 0x5599cc },
  { id: 183, name: 'Capacitor',   color: 0xcc66ff },
  { id: 184, name: 'Ignition',    color: 0xff6600 },
  { id: 185, name: 'Nav Module',  color: 0x00ffaa },
]

export class StatsPanel {
  private scene: Phaser.Scene
  private statsGfx!: Phaser.GameObjects.Graphics
  private hpText!: Phaser.GameObjects.Text
  private manaText!: Phaser.GameObjects.Text
  private armorText!: Phaser.GameObjects.Text
  private deathText!: Phaser.GameObjects.Text
  private partsLabel!: Phaser.GameObjects.Text
  private sunIcon!: Phaser.GameObjects.Graphics
  private moonIcon!: Phaser.GameObjects.Image
  skillXpText!: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  create() {
    const { width, height } = this.scene.scale

    this.statsGfx = this.scene.add.graphics().setDepth(200)
    this.hpText = this.scene.add.text(144, 46, '', {
      fontSize: '9px', color: '#ff8888', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setDepth(201)
    this.manaText = this.scene.add.text(144, 60, '', {
      fontSize: '9px', color: '#8899ff', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setDepth(201)
    this.armorText = this.scene.add.text(144, 74, '', {
      fontSize: '9px', color: '#ffdd66', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setDepth(201)

    // Day/Night indicator
    const iconX = width - 18
    const iconY = 14
    this.sunIcon = this.scene.add.graphics().setDepth(201)
    this.sunIcon.setPosition(iconX, iconY)
    this.drawSun(this.sunIcon)
    this.createMoonTexture()
    this.moonIcon = this.scene.add.image(iconX, iconY, 'moon_icon').setDepth(201)

    // Jetpack parts tracker label
    this.partsLabel = this.scene.add.text(width - 10, 28, '', {
      fontSize: '9px', color: '#aaaaaa', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(201)

    // Death overlay
    this.deathText = this.scene.add.text(width / 2, height / 2, 'YOU DIED\nRespawning...', {
      fontSize: '28px', color: '#ff4444', fontFamily: 'monospace',
      align: 'center', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(400).setVisible(false)

    // XP text under stats bars
    this.skillXpText = this.scene.add.text(10, 90, '', {
      fontSize: '9px', color: '#44ffff', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setDepth(201)
  }

  update(player: any, worldScene: any) {
    this.updateStatsBars(player)
    this.updateJetpackTracker(player)
    this.updateDayNight(worldScene)
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

  // ── Stats bars ──────────────────────────────────────────

  private updateStatsBars(player: any) {
    this.statsGfx.clear()

    const x = 10
    const iconR = 5
    const iconSpacing = 13
    const iconCount = 10
    const textX = x + iconCount * iconSpacing + 4
    const hpY = 46
    const manaY = 60

    // HP Stars
    const hpFilled = (player.hp / player.maxHp) * iconCount
    const lowHp = player.hp / player.maxHp < 0.25
    const pulse = lowHp ? 0.5 + 0.5 * Math.sin(this.scene.time.now * 0.008) : 1

    for (let i = 0; i < iconCount; i++) {
      const cx = x + i * iconSpacing + iconR
      const cy = hpY + iconR
      const pts = this.starPoints(cx, cy, iconR)
      const fill = Math.max(0, Math.min(1, hpFilled - i))

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

    const totalDef = typeof player.getEffectiveDefense === 'function' ? player.getEffectiveDefense() : player.inventory.getTotalDefense()
    this.hpText.setPosition(textX, hpY)
    this.hpText.setText(`${Math.ceil(player.hp)}/${player.maxHp}`)

    // Mana Diamonds
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

    // Armor Shields
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

    // Jetpack fuel bar
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

    // Oxygen bar
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

    // Level + SP display
    const spStr = skills.skillPoints > 0 ? ` [${skills.skillPoints}SP]` : ''
    this.skillXpText.setText(`Lv${skills.level} ${skills.xp}/${xpNeeded}${spStr}`)
    this.skillXpText.setPosition(x, xpY + barH + 2)
    this.skillXpText.setVisible(true)

    // Buff icons (below XP bar)
    this.drawBuffBar(player, x, xpY + barH + 16)

    // Death overlay
    this.deathText.setVisible(player.dead === true)

    // Boss HP bar (top center) + off-screen indicator
    const worldScene = this.scene.scene.get('WorldScene') as any
    const boss = worldScene?.getActiveBoss?.()
    if (boss && boss.alive) {
      const { width, height } = this.scene.scale
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
        const vl = cam.worldView.x
        const vt = cam.worldView.y
        const vr = vl + cam.worldView.width
        const vb = vt + cam.worldView.height
        const margin = 16
        const offScreen = bsx < vl + margin || bsx > vr - margin || bsy < vt + margin || bsy > vb - margin

        if (offScreen) {
          const ccx = cam.worldView.centerX
          const ccy = cam.worldView.centerY
          const dx = bsx - ccx
          const dy = bsy - ccy
          const angle = Math.atan2(dy, dx)

          const pad = 30
          const hw = width / 2 - pad
          const hh = height / 2 - pad

          const absCos = Math.abs(Math.cos(angle))
          const absSin = Math.abs(Math.sin(angle))
          let ax: number, ay: number
          if (absCos * hh > absSin * hw) {
            ax = width / 2 + Math.sign(Math.cos(angle)) * hw
            ay = height / 2 + Math.tan(angle) * Math.sign(Math.cos(angle)) * hw
          } else {
            ax = width / 2 + (1 / Math.tan(angle)) * Math.sign(Math.sin(angle)) * hh
            ay = height / 2 + Math.sign(Math.sin(angle)) * hh
          }
          ay = Phaser.Math.Clamp(ay, pad, height - pad)
          ax = Phaser.Math.Clamp(ax, pad, width - pad)

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
          this.statsGfx.lineStyle(2, 0xff6666, 0.8)
          this.statsGfx.strokeTriangle(
            ax + Math.cos(angle) * arrowSize,
            ay + Math.sin(angle) * arrowSize,
            ax + Math.cos(angle + 2.4) * arrowSize,
            ay + Math.sin(angle + 2.4) * arrowSize,
            ax + Math.cos(angle - 2.4) * arrowSize,
            ay + Math.sin(angle - 2.4) * arrowSize,
          )

          const bpulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.005)
          this.statsGfx.fillStyle(0xff2222, 0.3 * bpulse)
          this.statsGfx.fillCircle(ax, ay, arrowSize + 4)
        }
      }
    }
  }

  // ── Buff Bar ──────────────────────────────────────────

  private drawBuffBar(player: any, startX: number, startY: number) {
    const activeBuffs: ActiveBuff[] = player.buffs?.getActiveBuffs?.() ?? []
    if (activeBuffs.length === 0) return

    const iconSize = 14
    const gap = 3
    const maxPerRow = 8

    for (let i = 0; i < activeBuffs.length; i++) {
      const buff = activeBuffs[i]!
      const def = BUFF_DEFS[buff.type]
      if (!def) continue

      const col = i % maxPerRow
      const row = Math.floor(i / maxPerRow)
      const bx = startX + col * (iconSize + gap)
      const by = startY + row * (iconSize + gap + 8)

      // Background
      this.statsGfx.fillStyle(0x111111, 0.8)
      this.statsGfx.fillRect(bx, by, iconSize, iconSize)

      // Colored fill (fades as buff expires)
      const pct = Math.max(0, buff.remaining / buff.duration)
      this.statsGfx.fillStyle(def.color, 0.6 + 0.4 * pct)
      this.statsGfx.fillRect(bx + 1, by + 1, iconSize - 2, iconSize - 2)

      // Duration underbar
      this.statsGfx.fillStyle(def.color, 0.9)
      this.statsGfx.fillRect(bx, by + iconSize + 1, (iconSize) * pct, 2)

      // Flashing when about to expire (<5s)
      if (buff.remaining < 5000) {
        const flash = Math.sin(Date.now() * 0.01) > 0 ? 0.6 : 0.2
        this.statsGfx.fillStyle(0xffffff, flash)
        this.statsGfx.fillRect(bx + 1, by + 1, iconSize - 2, iconSize - 2)
      }

      // Border
      this.statsGfx.lineStyle(1, def.color, 0.6)
      this.statsGfx.strokeRect(bx, by, iconSize, iconSize)

      // Draw a small symbol shape based on buff type
      const cx = bx + iconSize / 2
      const cy = by + iconSize / 2

      switch (buff.type) {
        case 'ironskin': // shield shape
          this.statsGfx.fillStyle(0xffffff, 0.8)
          this.statsGfx.fillPoints(this.shieldPoints(cx, cy, 8, 8), true, true)
          break
        case 'swiftness': // arrow right
          this.statsGfx.fillTriangle(cx + 4, cy, cx - 3, cy - 3, cx - 3, cy + 3)
          break
        case 'regeneration': // plus sign
          this.statsGfx.fillRect(cx - 1, cy - 3, 2, 6)
          this.statsGfx.fillRect(cx - 3, cy - 1, 6, 2)
          break
        case 'wrath': case 'rage': // skull/X
          this.statsGfx.lineStyle(2, 0xffffff, 0.8)
          this.statsGfx.beginPath()
          this.statsGfx.moveTo(cx - 3, cy - 3)
          this.statsGfx.lineTo(cx + 3, cy + 3)
          this.statsGfx.moveTo(cx + 3, cy - 3)
          this.statsGfx.lineTo(cx - 3, cy + 3)
          this.statsGfx.strokePath()
          break
        default: // circle dot
          this.statsGfx.fillStyle(0xffffff, 0.7)
          this.statsGfx.fillCircle(cx, cy, 3)
          break
      }
    }
  }

  // ── Jetpack Parts Tracker ──────────────────────────────

  private updateJetpackTracker(player: any) {
    const inv: InventoryManager = player.inventory
    const { width } = this.scene.scale

    let collected = 0
    const has: boolean[] = []
    for (const part of JETPACK_PARTS) {
      const owned = inv.getCount(part.id) > 0
      has.push(owned)
      if (owned) collected++
    }

    const complete = player.hasJetpack || collected === 6

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
        const color = complete ? 0xffdd00 : JETPACK_PARTS[i]!.color
        const ppulse = complete ? 0.8 + 0.2 * Math.sin(this.scene.time.now * 0.004 + i * 0.5) : 1

        this.statsGfx.fillStyle(color, 0.2 * ppulse)
        this.statsGfx.fillCircle(px + partSize / 2, py + partSize / 2, partSize * 0.8)

        this.statsGfx.fillStyle(color, 0.9 * ppulse)
        this.statsGfx.fillRect(px + 1, py + 1, partSize - 2, partSize - 2)

        this.statsGfx.lineStyle(1, 0xffffff, 0.5)
        this.statsGfx.strokeRect(px, py, partSize, partSize)
      } else {
        this.statsGfx.fillStyle(0x222222, 0.5)
        this.statsGfx.fillRect(px + 1, py + 1, partSize - 2, partSize - 2)

        this.statsGfx.lineStyle(1, 0x555555, 0.4)
        this.statsGfx.strokeRect(px, py, partSize, partSize)
      }
    }

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

  // ── Day/Night ──────────────────────────────────────────

  private updateDayNight(worldScene: any) {
    const dn = worldScene?.getDayNight?.()
    if (!dn) return

    const t = dn.time as number
    let sunAlpha = 0
    if (t >= 0.30 && t < 0.70) sunAlpha = 1
    else if (t >= 0.20 && t < 0.30) sunAlpha = (t - 0.20) / 0.10
    else if (t >= 0.70 && t < 0.80) sunAlpha = 1 - (t - 0.70) / 0.10
    this.sunIcon.setAlpha(sunAlpha)

    let moonAlpha = 0
    if (t < 0.20 || t >= 0.80) moonAlpha = 1
    else if (t >= 0.20 && t < 0.30) moonAlpha = 1 - (t - 0.20) / 0.10
    else if (t >= 0.70 && t < 0.80) moonAlpha = (t - 0.70) / 0.10
    this.moonIcon.setAlpha(moonAlpha)
  }

  private drawSun(g: Phaser.GameObjects.Graphics) {
    g.fillStyle(0xffdd44, 0.3)
    g.fillCircle(0, 0, 10)
    g.fillStyle(0xffdd44, 1)
    g.fillCircle(0, 0, 5)
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
    const rt = this.scene.make.renderTexture({ x: 0, y: 0, width: size, height: size }, false)
    const glow = this.scene.make.graphics({}, false)
    glow.fillStyle(0xaabbdd, 0.25)
    glow.fillCircle(cx, cy, 9)
    rt.draw(glow)
    glow.destroy()
    const circle = this.scene.make.graphics({}, false)
    circle.fillStyle(0xddddff, 1)
    circle.fillCircle(cx, cy, 5)
    rt.draw(circle)
    circle.destroy()
    const cutout = this.scene.make.graphics({}, false)
    cutout.fillStyle(0xffffff, 1)
    cutout.fillCircle(cx + 3, cy - 2, 4)
    rt.erase(cutout)
    cutout.destroy()
    if (!this.scene.textures.exists('moon_icon')) {
      rt.saveTexture('moon_icon')
    }
    rt.destroy()
  }
}
