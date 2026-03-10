export enum EnemyType {
  SPACE_SLUG = 'space_slug',
  CAVE_BAT = 'cave_bat',
  ROCK_GOLEM = 'rock_golem',
  ANGLERFISH = 'anglerfish',
  LAVA_SERPENT = 'lava_serpent',
  CORRUPTED_DRONE = 'corrupted_drone',
  VAMPIRE = 'vampire',
}

export enum EnemyAI {
  PATROL = 'patrol',       // walk back and forth
  SWOOP = 'swoop',         // fly, dive at player
  CHARGE = 'charge',       // walk, charge when close
  LURE = 'lure',           // float, lunge when close
  EMERGE = 'emerge',       // hide in lava, emerge to attack
  RANGED = 'ranged',       // fly, shoot projectiles
}

export interface EnemyDef {
  type: EnemyType
  name: string
  hp: number
  damage: number
  speed: number
  color: number
  width: number
  height: number
  ai: EnemyAI
  biomeYMin: number   // min Y tile coord for spawning
  biomeYMax: number   // max Y tile coord for spawning
  oceanOnly?: boolean // only spawn in ocean biome edges
  nightOnly?: boolean // only spawn at night
  xp: number
  loot: { itemId: number; count: number; chance: number }[]
  knockbackResist: number // 0 = full knockback, 1 = none
}

// Layer boundaries (must match WorldGenerator)
const SURFACE = 60
const UNDERGROUND = 130
const DEEP = 480
const CORE = 1000

export const ENEMY_DEFS: Record<EnemyType, EnemyDef> = {
  [EnemyType.SPACE_SLUG]: {
    type: EnemyType.SPACE_SLUG,
    name: 'Space Slug',
    hp: 25,
    damage: 8,
    speed: 30,
    color: 0x88cc44,
    width: 20,
    height: 12,
    ai: EnemyAI.PATROL,
    biomeYMin: SURFACE,
    biomeYMax: UNDERGROUND,
    xp: 5,
    loot: [
      { itemId: 105, count: 2, chance: 0.5 },  // plant fiber
      { itemId: 190, count: 1, chance: 0.2 },   // healing herb
    ],
    knockbackResist: 0,
  },
  [EnemyType.CAVE_BAT]: {
    type: EnemyType.CAVE_BAT,
    name: 'Cave Bat',
    hp: 20,
    damage: 12,
    speed: 80,
    color: 0x664488,
    width: 14,
    height: 10,
    ai: EnemyAI.SWOOP,
    biomeYMin: UNDERGROUND,
    biomeYMax: DEEP,
    xp: 8,
    loot: [
      { itemId: 190, count: 1, chance: 0.3 },
    ],
    knockbackResist: 0.2,
  },
  [EnemyType.ROCK_GOLEM]: {
    type: EnemyType.ROCK_GOLEM,
    name: 'Rock Golem',
    hp: 80,
    damage: 20,
    speed: 40,
    color: 0x887766,
    width: 22,
    height: 28,
    ai: EnemyAI.CHARGE,
    biomeYMin: UNDERGROUND,
    biomeYMax: CORE,
    xp: 20,
    loot: [
      { itemId: 3, count: 5, chance: 0.8 },     // stone
      { itemId: 6, count: 2, chance: 0.3 },      // iron ore
    ],
    knockbackResist: 0.6,
  },
  [EnemyType.ANGLERFISH]: {
    type: EnemyType.ANGLERFISH,
    name: 'Anglerfish',
    hp: 40,
    damage: 15,
    speed: 50,
    color: 0x2288aa,
    width: 18,
    height: 14,
    ai: EnemyAI.LURE,
    biomeYMin: SURFACE - 10,
    biomeYMax: UNDERGROUND,
    oceanOnly: true,
    xp: 12,
    loot: [
      { itemId: 12, count: 3, chance: 0.5 },    // coral
      { itemId: 190, count: 1, chance: 0.4 },
    ],
    knockbackResist: 0.1,
  },
  [EnemyType.LAVA_SERPENT]: {
    type: EnemyType.LAVA_SERPENT,
    name: 'Lava Serpent',
    hp: 60,
    damage: 25,
    speed: 60,
    color: 0xff6622,
    width: 16,
    height: 24,
    ai: EnemyAI.EMERGE,
    biomeYMin: DEEP,
    biomeYMax: 1200,
    xp: 25,
    loot: [
      { itemId: 8, count: 2, chance: 0.4 },     // titanium ore
      { itemId: 191, count: 1, chance: 0.3 },   // cooked meat
    ],
    knockbackResist: 0.4,
  },
  [EnemyType.CORRUPTED_DRONE]: {
    type: EnemyType.CORRUPTED_DRONE,
    name: 'Corrupted Drone',
    hp: 50,
    damage: 18,
    speed: 70,
    color: 0xcc2244,
    width: 14,
    height: 14,
    ai: EnemyAI.RANGED,
    biomeYMin: CORE,
    biomeYMax: 1200,
    xp: 30,
    loot: [
      { itemId: 13, count: 2, chance: 0.5 },    // carbon fiber
      { itemId: 102, count: 1, chance: 0.15 },  // titanium bar
    ],
    knockbackResist: 0.3,
  },
  [EnemyType.VAMPIRE]: {
    type: EnemyType.VAMPIRE,
    name: 'Vampire',
    hp: 45,
    damage: 15,
    speed: 90,
    color: 0x440044,
    width: 16,
    height: 22,
    ai: EnemyAI.SWOOP,
    biomeYMin: SURFACE - 10,
    biomeYMax: UNDERGROUND,
    nightOnly: true,
    xp: 15,
    loot: [
      { itemId: 190, count: 2, chance: 0.5 },   // healing herb
      { itemId: 105, count: 3, chance: 0.4 },   // plant fiber
    ],
    knockbackResist: 0.1,
  },
}
