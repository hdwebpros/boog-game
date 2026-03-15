export interface ArtifactTier {
  level: number
  cost: number  // silver coins to upgrade to this level
  effects: Record<string, number>
  description: string
}

export interface ArtifactDef {
  itemId: number
  name: string
  maxLevel: number
  tiers: ArtifactTier[]
}

export const ARTIFACTS: ArtifactDef[] = [
  {
    itemId: 360,
    name: 'Warp Crystal',
    maxLevel: 3,
    tiers: [
      { level: 1, cost: 0, effects: { dashDistance: 100, dashCooldown: 5000 }, description: 'Teleport dash (5s cooldown)' },
      { level: 2, cost: 300, effects: { dashDistance: 150, dashCooldown: 3500 }, description: 'Longer dash (3.5s cooldown)' },
      { level: 3, cost: 600, effects: { dashDistance: 200, dashCooldown: 2000, dashDamage: 30 }, description: 'Damaging dash (2s cooldown)' },
    ],
  },
  {
    itemId: 361,
    name: 'Soul Lantern',
    maxLevel: 3,
    tiers: [
      { level: 1, cost: 0, effects: { lifestealPercent: 0.05, auraRange: 48 }, description: '5% lifesteal aura' },
      { level: 2, cost: 300, effects: { lifestealPercent: 0.10, auraRange: 64 }, description: '10% lifesteal aura' },
      { level: 3, cost: 600, effects: { lifestealPercent: 0.15, auraRange: 80, healNearbyAllies: 2 }, description: '15% lifesteal, heals nearby allies' },
    ],
  },
  {
    itemId: 362,
    name: 'Chaos Heart',
    maxLevel: 3,
    tiers: [
      { level: 1, cost: 0, effects: { bonusHp: 100, thornsDamage: 10 }, description: '+100 HP, thorns damage' },
      { level: 2, cost: 400, effects: { bonusHp: 150, thornsDamage: 25 }, description: '+150 HP, stronger thorns' },
      { level: 3, cost: 800, effects: { bonusHp: 200, thornsDamage: 50, thornsRange: 64 }, description: '+200 HP, ranged thorns' },
    ],
  },
  {
    itemId: 363,
    name: 'Void Eye',
    maxLevel: 3,
    tiers: [
      { level: 1, cost: 0, effects: { wallVisionRange: 5, enemyRevealRange: 200 }, description: 'See through walls, reveal enemies' },
      { level: 2, cost: 400, effects: { wallVisionRange: 8, enemyRevealRange: 350, critBonusRevealed: 0.15 }, description: 'Wider vision, +15% crit vs revealed' },
      { level: 3, cost: 800, effects: { wallVisionRange: 12, enemyRevealRange: 500, critBonusRevealed: 0.30, autoMark: 1 }, description: 'Massive vision, auto-mark enemies' },
    ],
  },
  {
    itemId: 364,
    name: 'Temporal Shard',
    maxLevel: 3,
    tiers: [
      { level: 1, cost: 0, effects: { cooldownReduction: 0.15, attackSpeedBonus: 0.1 }, description: '15% CDR, 10% attack speed' },
      { level: 2, cost: 350, effects: { cooldownReduction: 0.25, attackSpeedBonus: 0.2 }, description: '25% CDR, 20% attack speed' },
      { level: 3, cost: 700, effects: { cooldownReduction: 0.35, attackSpeedBonus: 0.3, timeSlowOnHit: 0.3 }, description: '35% CDR, 30% AS, slow enemies on hit' },
    ],
  },
  {
    itemId: 365,
    name: 'Dimensional Anchor',
    maxLevel: 3,
    tiers: [
      { level: 1, cost: 0, effects: { knockbackImmune: 1, damageBonus: 0.25 }, description: 'Knockback immune, +25% damage' },
      { level: 2, cost: 500, effects: { knockbackImmune: 1, damageBonus: 0.40, armorBonus: 15 }, description: '+40% damage, +15 armor' },
      { level: 3, cost: 1000, effects: { knockbackImmune: 1, damageBonus: 0.60, armorBonus: 30, unstoppable: 1 }, description: '+60% damage, +30 armor, unstoppable' },
    ],
  },
]

// Get artifact definition by item ID
export function getArtifactDef(itemId: number): ArtifactDef | undefined {
  return ARTIFACTS.find(a => a.itemId === itemId)
}
