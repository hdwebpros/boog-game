export interface AccessoryEffect {
  id: number
  name: string
  description: string
  moveSpeedMult?: number
  jetpackFuelMult?: number
  flightSpeedMult?: number
  mineSpeedMult?: number
  miningRangeBonus?: number
  doubleDropChance?: number
  maxHpBonus?: number
  maxManaBonus?: number
  noFallDamage?: boolean
  magnetRadius?: number
  luckyDropBonus?: number
  extraInventorySlots?: number
}

export const ACCESSORY_EFFECTS: Record<number, AccessoryEffect> = {
  300: {
    id: 300, name: 'Cloud Boots',
    description: 'No fall damage. +15% move speed.',
    noFallDamage: true, moveSpeedMult: 1.15,
  },
  301: {
    id: 301, name: 'Star Compass',
    description: 'Reveals ores on minimap. +50 max mana.',
    maxManaBonus: 50,
  },
  302: {
    id: 302, name: 'Gravity Belt',
    description: '-40% jetpack fuel use. +20% flight speed.',
    jetpackFuelMult: 0.6, flightSpeedMult: 1.2,
  },
  303: {
    id: 303, name: "Miner's Lantern",
    description: '+40% mining speed. +1 mining range.',
    mineSpeedMult: 1.4, miningRangeBonus: 1,
  },
  304: {
    id: 304, name: 'Lucky Charm',
    description: '+25% double drop chance. Better loot.',
    doubleDropChance: 0.25, luckyDropBonus: 0.15,
  },
  305: {
    id: 305, name: 'Celestial Cape',
    description: '+30 max HP. +30 max mana. Magnetic pickup.',
    maxHpBonus: 30, maxManaBonus: 30, magnetRadius: 80,
  },
  306: {
    id: 306, name: "Explorer's Belt",
    description: '+10 inventory slots (extra row).',
    extraInventorySlots: 10,
  },
}
