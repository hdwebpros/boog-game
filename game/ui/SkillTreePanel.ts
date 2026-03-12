import Phaser from 'phaser'
import { SKILLS, BRANCH_INFO, BRANCH_ORDER, SUPER_TREES, SUPER_TREE_MAP } from '../data/skills'
import type { SkillDef } from '../data/skills'
import type { SkillTreeManager } from '../systems/SkillTreeManager'
import { AudioManager } from '../systems/AudioManager'
import { SoundId } from '../data/sounds'
import { SKILL_MAP } from '../data/skills'

const SKILL_W = 520
const SKILL_H = 440
const SKILL_NODE_SIZE = 36
const SKILL_NODE_GAP_X = 56
const SKILL_NODE_GAP_Y = 70
const SUPER_ROW_Y_OFFSET = 235

export class SkillTreePanel {
  private scene: Phaser.Scene
  private skillGfx!: Phaser.GameObjects.Graphics
  private skillTitle!: Phaser.GameObjects.Text
  private skillInfoText!: Phaser.GameObjects.Text
  private skillNodeZones: Phaser.GameObjects.Zone[] = []
  private skillNodeTexts: Phaser.GameObjects.Text[] = []
  private skillNameTexts: Phaser.GameObjects.Text[] = []
  private skillBranchLabels: Phaser.GameObjects.Text[] = []
  private skillNodeSkills: SkillDef[] = []
  private skillVisible = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  create() {
    this.skillNodeZones = []
    this.skillNodeTexts = []
    this.skillNameTexts = []
    this.skillBranchLabels = []
    this.skillNodeSkills = []
    this.skillVisible = false

    this.skillGfx = this.scene.add.graphics().setDepth(320)

    const { width, height } = this.scene.scale
    const panelX = (width - SKILL_W) / 2
    const panelY = (height - SKILL_H) / 2

    this.skillTitle = this.scene.add.text(width / 2, panelY + 10, 'SKILL TREE', {
      fontSize: '16px', color: '#ffff00', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(321).setVisible(false)

    this.skillInfoText = this.scene.add.text(width / 2, panelY + SKILL_H - 14, '', {
      fontSize: '10px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5, 1).setDepth(321).setVisible(false)

    // Branch header labels
    const startX = panelX + 30
    const startY = panelY + 55

    for (let bi = 0; bi < BRANCH_ORDER.length; bi++) {
      const branch = BRANCH_ORDER[bi]!
      const info = BRANCH_INFO[branch]
      const bx = startX + bi * (SKILL_NODE_SIZE + SKILL_NODE_GAP_X) + SKILL_NODE_SIZE / 2
      const label = this.scene.add.text(bx, panelY + 34, `[${info.icon}] ${info.name}`, {
        fontSize: '9px', color: info.colorStr, fontFamily: 'monospace',
      }).setOrigin(0.5, 0).setDepth(321).setVisible(false)
      this.skillBranchLabels.push(label)
    }

    // Normal skill nodes
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

        const zone = this.scene.add.zone(cx, cy, SKILL_NODE_SIZE, SKILL_NODE_SIZE)
          .setInteractive().setDepth(323)
        zone.on('pointerdown', () => this.onSkillNodeClick(skill.id))
        this.skillNodeZones.push(zone)
        this.skillNodeSkills.push(skill)

        const abbr = skill.name.split(' ').map(w => w[0]).join('').substring(0, 3)
        const nodeText = this.scene.add.text(cx, cy - 2, abbr, {
          fontSize: '11px', color: '#ffffff', fontFamily: 'monospace',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(322).setVisible(false)
        this.skillNodeTexts.push(nodeText)

        const nameText = this.scene.add.text(cx, ny + SKILL_NODE_SIZE + 2, skill.name, {
          fontSize: '7px', color: '#888888', fontFamily: 'monospace',
        }).setOrigin(0.5, 0).setDepth(321).setVisible(false)
        this.skillNameTexts.push(nameText)
      }
    }

    // Super tree nodes
    const superY = startY + SUPER_ROW_Y_OFFSET
    const superSkills = SKILLS.filter(s => !!s.superTree)
    const groupWidth = 2 * SKILL_NODE_SIZE + 8
    const totalSuperWidth = SUPER_TREES.length * groupWidth + (SUPER_TREES.length - 1) * 30
    const superStartX = panelX + (SKILL_W - totalSuperWidth) / 2

    for (let gi = 0; gi < SUPER_TREES.length; gi++) {
      const st = SUPER_TREES[gi]!
      const groupX = superStartX + gi * (groupWidth + 30)

      const labelX = groupX + groupWidth / 2
      const stLabel = this.scene.add.text(labelX, superY - 14, `[${st.icon}] ${st.name}`, {
        fontSize: '8px', color: st.colorStr, fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5, 0).setDepth(321).setVisible(false)
      this.skillBranchLabels.push(stLabel)

      const stSkills = superSkills.filter(s => s.superTree === st.id)
      for (let si = 0; si < stSkills.length; si++) {
        const skill = stSkills[si]!
        const nx = groupX + si * (SKILL_NODE_SIZE + 8)
        const ny = superY
        const cx = nx + SKILL_NODE_SIZE / 2
        const cy = ny + SKILL_NODE_SIZE / 2

        const zone = this.scene.add.zone(cx, cy, SKILL_NODE_SIZE, SKILL_NODE_SIZE)
          .setInteractive().setDepth(323)
        zone.on('pointerdown', () => this.onSkillNodeClick(skill.id))
        this.skillNodeZones.push(zone)
        this.skillNodeSkills.push(skill)

        const abbr = skill.name.split(' ').map(w => w[0]).join('').substring(0, 3)
        const nodeText = this.scene.add.text(cx, cy - 2, abbr, {
          fontSize: '11px', color: '#ffffff', fontFamily: 'monospace',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(322).setVisible(false)
        this.skillNodeTexts.push(nodeText)

        const nameText = this.scene.add.text(cx, ny + SKILL_NODE_SIZE + 2, skill.name, {
          fontSize: '7px', color: '#888888', fontFamily: 'monospace',
        }).setOrigin(0.5, 0).setDepth(321).setVisible(false)
        this.skillNameTexts.push(nameText)
      }
    }
  }

  update(player: any, pointerJustDown: boolean) {
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

    const { width, height } = this.scene.scale
    const panelX = (width - SKILL_W) / 2
    const panelY = (height - SKILL_H) / 2
    const skills: SkillTreeManager = player.skills

    this.skillGfx.fillStyle(0x0a0a1a, 0.95)
    this.skillGfx.fillRect(panelX, panelY, SKILL_W, SKILL_H)
    this.skillGfx.lineStyle(2, 0x444466)
    this.skillGfx.strokeRect(panelX, panelY, SKILL_W, SKILL_H)

    this.skillTitle.setText(`SKILL TREE  [${skills.skillPoints} SP]`)

    const pointer = this.scene.input.activePointer
    let hoveredSkill: SkillDef | null = null

    // Connecting lines
    for (let i = 0; i < this.skillNodeSkills.length; i++) {
      const skill = this.skillNodeSkills[i]!
      if (!skill.requires) continue

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

    // Divider
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
      const prereqMet = !skill.requires || skills.hasSkill(skill.requires)
      const needsMoreSP = !unlocked && prereqMet && skills.skillPoints < skill.cost

      // Node background
      if (unlocked) {
        this.skillGfx.fillStyle(nodeColor, 0.7)
      } else if (canUnlockSkill) {
        this.skillGfx.fillStyle(nodeColor, 0.3)
      } else if (needsMoreSP && (!isSuper || superAvailable)) {
        this.skillGfx.fillStyle(nodeColor, 0.15)
      } else if (isSuper && !superAvailable) {
        this.skillGfx.fillStyle(nodeColor, 0.08)
      } else {
        this.skillGfx.fillStyle(0x222233, 0.7)
      }
      this.skillGfx.fillRect(nx, ny, SKILL_NODE_SIZE, SKILL_NODE_SIZE)

      // Border
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

      // Text colors
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

      // Cost badge
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

      // Hover detection
      if (pointer.x >= nx && pointer.x < nx + SKILL_NODE_SIZE &&
          pointer.y >= ny && pointer.y < ny + SKILL_NODE_SIZE) {
        hoveredSkill = skill
        this.skillGfx.lineStyle(2, 0xffffff, 0.5)
        this.skillGfx.strokeRect(nx - 1, ny - 1, SKILL_NODE_SIZE + 2, SKILL_NODE_SIZE + 2)

        if (pointerJustDown) {
          if (skills.unlock(skill.id)) {
            AudioManager.get()?.play(SoundId.CRAFT_SUCCESS)
          }
        }
      }
    }

    // Info text
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
    const worldScene = this.scene.scene.get('WorldScene') as any
    const player = worldScene?.getPlayer()
    if (!player) return

    const skills: SkillTreeManager = player.skills
    if (skills.unlock(skillId)) {
      AudioManager.get()?.play(SoundId.CRAFT_SUCCESS)
    }
  }
}
