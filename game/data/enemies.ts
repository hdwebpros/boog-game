import { SurfaceBiome } from '../world/WorldGenerator'
import { WORLD_HEIGHT, SURFACE_Y, UNDERGROUND_Y, DEEP_UNDERGROUND_Y, CORE_Y } from '../world/TileRegistry'

export enum EnemyType {
  SPACE_SLUG = 'space_slug',
  CAVE_BAT = 'cave_bat',
  ROCK_GOLEM = 'rock_golem',
  ANGLERFISH = 'anglerfish',
  LAVA_SERPENT = 'lava_serpent',
  CORRUPTED_DRONE = 'corrupted_drone',
  VAMPIRE = 'vampire',
  FUNGAL_SHAMBLER = 'fungal_shambler',
  SPORELING = 'sporeling',
  PHANTOM_WRAITH = 'phantom_wraith',
  MIMIC = 'mimic',
  GLOOM_MOTH = 'gloom_moth',
  SHOCK_BEETLE = 'shock_beetle',
  FISH = 'fish',
  // Biome-specific enemies
  FROST_WOLF = 'frost_wolf',
  ICE_WISP = 'ice_wisp',
  SAND_SCORPION = 'sand_scorpion',
  DUST_DEVIL = 'dust_devil',
  JUNGLE_SPIDER = 'jungle_spider',
  VINE_STRANGLER = 'vine_strangler',
  MOUNTAIN_HAWK = 'mountain_hawk',
  // Void dimension enemies
  VOID_WRAITH = 'void_wraith',
  SHADOW_STALKER = 'shadow_stalker',
  HELLFIRE_IMP = 'hellfire_imp',
  NETHER_GOLEM = 'nether_golem',
  SOUL_EATER = 'soul_eater',
  VOID_SERPENT = 'void_serpent',
  CHAOS_ELEMENTAL = 'chaos_elemental',
  DARK_KNIGHT = 'dark_knight',
}

export enum EnemyAI {
  PATROL = 'patrol',       // walk back and forth
  SWOOP = 'swoop',         // fly, dive at player
  CHARGE = 'charge',       // walk, charge when close
  LURE = 'lure',           // float, lunge when close
  EMERGE = 'emerge',       // hide in lava, emerge to attack
  RANGED = 'ranged',       // fly, shoot projectiles
  PHASE = 'phase',         // fly, phase between tangible/intangible
  AMBUSH = 'ambush',       // disguised, spring when player is close
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
  voidDimension?: boolean // only spawns in void dimension
  oceanOnly?: boolean // only spawn in ocean biome edges
  nightOnly?: boolean // only spawn at night
  surfaceBiome?: SurfaceBiome // only spawn in this surface biome (surface enemies)
  xp: number
  loot: { itemId: number; count: number; chance: number }[]
  knockbackResist: number // 0 = full knockback, 1 = none
  // Conditional quirks
  splitsInto?: EnemyType   // spawn copies of this type on death
  splitCount?: number      // how many to spawn (default 2)
  lifetime?: number        // auto-despawn after ms (0 = infinite)
  passiveDuringDay?: boolean // passive/flee during daytime, aggressive at night
  retaliateOnHit?: boolean // fires projectile back when struck
  noNaturalSpawn?: boolean // only spawned by other enemies, not by EnemySpawner
}

const SURFACE = SURFACE_Y
const UNDERGROUND = UNDERGROUND_Y
const DEEP = DEEP_UNDERGROUND_Y
const CORE = CORE_Y

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
  [EnemyType.FISH]: {
    type: EnemyType.FISH,
    name: 'Fish',
    hp: 8,
    damage: 0,
    speed: 45,
    color: 0xff8844,
    width: 14,
    height: 8,
    ai: EnemyAI.LURE,
    biomeYMin: SURFACE - 10,
    biomeYMax: UNDERGROUND,
    oceanOnly: true,
    xp: 2,
    loot: [
      { itemId: 11, count: 1, chance: 0.6 },    // sand
    ],
    knockbackResist: 0.0,
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
    biomeYMax: WORLD_HEIGHT,
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
    biomeYMax: WORLD_HEIGHT,
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

  // ── Conditional-quirk enemies ──────────────────────────────

  [EnemyType.FUNGAL_SHAMBLER]: {
    type: EnemyType.FUNGAL_SHAMBLER,
    name: 'Fungal Shambler',
    hp: 35,
    damage: 10,
    speed: 25,
    color: 0x779944,
    width: 18,
    height: 20,
    ai: EnemyAI.PATROL,
    biomeYMin: UNDERGROUND,
    biomeYMax: DEEP,
    xp: 10,
    loot: [
      { itemId: 105, count: 3, chance: 0.6 },   // plant fiber
      { itemId: 190, count: 1, chance: 0.3 },   // healing herb
    ],
    knockbackResist: 0.2,
    splitsInto: EnemyType.SPORELING,
    splitCount: 3,
  },
  [EnemyType.SPORELING]: {
    type: EnemyType.SPORELING,
    name: 'Sporeling',
    hp: 10,
    damage: 6,
    speed: 90,
    color: 0xaacc55,
    width: 10,
    height: 8,
    ai: EnemyAI.PATROL,
    biomeYMin: 0,
    biomeYMax: WORLD_HEIGHT,
    xp: 3,
    loot: [
      { itemId: 105, count: 1, chance: 0.3 },   // plant fiber
    ],
    knockbackResist: 0,
    lifetime: 6000,
    noNaturalSpawn: true,
  },
  [EnemyType.PHANTOM_WRAITH]: {
    type: EnemyType.PHANTOM_WRAITH,
    name: 'Phantom Wraith',
    hp: 55,
    damage: 22,
    speed: 65,
    color: 0x5544aa,
    width: 16,
    height: 20,
    ai: EnemyAI.PHASE,
    biomeYMin: DEEP,
    biomeYMax: CORE,
    xp: 22,
    loot: [
      { itemId: 101, count: 1, chance: 0.25 },  // diamond
      { itemId: 190, count: 1, chance: 0.4 },   // healing herb
    ],
    knockbackResist: 0.3,
  },
  [EnemyType.MIMIC]: {
    type: EnemyType.MIMIC,
    name: 'Mimic',
    hp: 60,
    damage: 30,
    speed: 50,
    color: 0xaa8833,
    width: 16,
    height: 16,
    ai: EnemyAI.AMBUSH,
    biomeYMin: UNDERGROUND,
    biomeYMax: DEEP + 100,
    xp: 18,
    loot: [
      { itemId: 100, count: 2, chance: 0.5 },   // iron bar
      { itemId: 101, count: 1, chance: 0.2 },   // diamond
      { itemId: 190, count: 2, chance: 0.6 },   // healing herb
    ],
    knockbackResist: 0.1,
  },
  [EnemyType.GLOOM_MOTH]: {
    type: EnemyType.GLOOM_MOTH,
    name: 'Gloom Moth',
    hp: 30,
    damage: 14,
    speed: 75,
    color: 0x334466,
    width: 14,
    height: 12,
    ai: EnemyAI.SWOOP,
    biomeYMin: SURFACE - 10,
    biomeYMax: DEEP,
    xp: 10,
    loot: [
      { itemId: 105, count: 2, chance: 0.5 },   // plant fiber
      { itemId: 190, count: 1, chance: 0.3 },   // healing herb
    ],
    knockbackResist: 0.1,
    passiveDuringDay: true,
  },
  [EnemyType.SHOCK_BEETLE]: {
    type: EnemyType.SHOCK_BEETLE,
    name: 'Shock Beetle',
    hp: 50,
    damage: 16,
    speed: 45,
    color: 0xccaa22,
    width: 14,
    height: 12,
    ai: EnemyAI.CHARGE,
    biomeYMin: UNDERGROUND,
    biomeYMax: DEEP + 200,
    xp: 15,
    loot: [
      { itemId: 6, count: 2, chance: 0.5 },     // iron ore
      { itemId: 100, count: 1, chance: 0.2 },   // iron bar
    ],
    knockbackResist: 0.4,
    retaliateOnHit: true,
  },

  // ── Biome-Specific Enemies ────────────────────────────────

  [EnemyType.FROST_WOLF]: {
    type: EnemyType.FROST_WOLF,
    name: 'Frost Wolf',
    hp: 40,
    damage: 14,
    speed: 70,
    color: 0xaabbcc,
    width: 22,
    height: 16,
    ai: EnemyAI.CHARGE,
    biomeYMin: SURFACE - 10,
    biomeYMax: UNDERGROUND,
    surfaceBiome: SurfaceBiome.SNOW,
    xp: 12,
    loot: [
      { itemId: 191, count: 1, chance: 0.4 },   // cooked meat
      { itemId: 105, count: 2, chance: 0.5 },   // plant fiber
    ],
    knockbackResist: 0.3,
  },
  [EnemyType.ICE_WISP]: {
    type: EnemyType.ICE_WISP,
    name: 'Ice Wisp',
    hp: 25,
    damage: 10,
    speed: 85,
    color: 0x88ddff,
    width: 12,
    height: 12,
    ai: EnemyAI.SWOOP,
    biomeYMin: SURFACE - 10,
    biomeYMax: UNDERGROUND,
    surfaceBiome: SurfaceBiome.SNOW,
    xp: 8,
    loot: [
      { itemId: 21, count: 2, chance: 0.5 },    // ice
      { itemId: 190, count: 1, chance: 0.3 },   // healing herb
    ],
    knockbackResist: 0,
  },
  [EnemyType.SAND_SCORPION]: {
    type: EnemyType.SAND_SCORPION,
    name: 'Sand Scorpion',
    hp: 45,
    damage: 18,
    speed: 55,
    color: 0xcc9944,
    width: 20,
    height: 12,
    ai: EnemyAI.CHARGE,
    biomeYMin: SURFACE - 10,
    biomeYMax: UNDERGROUND,
    surfaceBiome: SurfaceBiome.DESERT,
    xp: 14,
    loot: [
      { itemId: 11, count: 3, chance: 0.5 },    // sand
      { itemId: 191, count: 1, chance: 0.3 },   // cooked meat
    ],
    knockbackResist: 0.3,
  },
  [EnemyType.DUST_DEVIL]: {
    type: EnemyType.DUST_DEVIL,
    name: 'Dust Devil',
    hp: 30,
    damage: 12,
    speed: 90,
    color: 0xddbb88,
    width: 14,
    height: 18,
    ai: EnemyAI.RANGED,
    biomeYMin: SURFACE - 10,
    biomeYMax: UNDERGROUND,
    surfaceBiome: SurfaceBiome.DESERT,
    xp: 10,
    loot: [
      { itemId: 27, count: 2, chance: 0.5 },    // sandstone
      { itemId: 190, count: 1, chance: 0.3 },   // healing herb
    ],
    knockbackResist: 0.1,
  },
  [EnemyType.JUNGLE_SPIDER]: {
    type: EnemyType.JUNGLE_SPIDER,
    name: 'Jungle Spider',
    hp: 35,
    damage: 16,
    speed: 65,
    color: 0x336622,
    width: 18,
    height: 12,
    ai: EnemyAI.AMBUSH,
    biomeYMin: SURFACE - 10,
    biomeYMax: UNDERGROUND,
    surfaceBiome: SurfaceBiome.JUNGLE,
    xp: 12,
    loot: [
      { itemId: 105, count: 3, chance: 0.6 },   // plant fiber
      { itemId: 190, count: 1, chance: 0.4 },   // healing herb
    ],
    knockbackResist: 0.1,
  },
  [EnemyType.VINE_STRANGLER]: {
    type: EnemyType.VINE_STRANGLER,
    name: 'Vine Strangler',
    hp: 50,
    damage: 12,
    speed: 35,
    color: 0x225511,
    width: 16,
    height: 24,
    ai: EnemyAI.PATROL,
    biomeYMin: SURFACE - 10,
    biomeYMax: UNDERGROUND,
    surfaceBiome: SurfaceBiome.JUNGLE,
    xp: 14,
    loot: [
      { itemId: 4, count: 3, chance: 0.6 },     // wood
      { itemId: 105, count: 4, chance: 0.7 },   // plant fiber
    ],
    knockbackResist: 0.5,
  },
  [EnemyType.MOUNTAIN_HAWK]: {
    type: EnemyType.MOUNTAIN_HAWK,
    name: 'Mountain Hawk',
    hp: 30,
    damage: 16,
    speed: 100,
    color: 0x886644,
    width: 16,
    height: 12,
    ai: EnemyAI.SWOOP,
    biomeYMin: SURFACE - 20,
    biomeYMax: UNDERGROUND,
    surfaceBiome: SurfaceBiome.MOUNTAINS,
    xp: 10,
    loot: [
      { itemId: 191, count: 1, chance: 0.4 },   // cooked meat
      { itemId: 105, count: 2, chance: 0.3 },   // plant fiber
    ],
    knockbackResist: 0.1,
  },

  // ── Void Dimension Enemies ──────────────────────────────

  [EnemyType.VOID_WRAITH]: {
    type: EnemyType.VOID_WRAITH,
    name: 'Void Wraith',
    hp: 120,
    damage: 35,
    speed: 180,
    color: 0x9933ff,
    width: 28,
    height: 36,
    ai: EnemyAI.PHASE,
    biomeYMin: 0,
    biomeYMax: WORLD_HEIGHT,
    voidDimension: true,
    xp: 80,
    loot: [
      { itemId: 350, count: 3, chance: 0.6 },   // Void Essence
      { itemId: 352, count: 2, chance: 0.3 },   // Soul Fragment
    ],
    knockbackResist: 0,
  },
  [EnemyType.SHADOW_STALKER]: {
    type: EnemyType.SHADOW_STALKER,
    name: 'Shadow Stalker',
    hp: 200,
    damage: 50,
    speed: 140,
    color: 0x1a0033,
    width: 32,
    height: 40,
    ai: EnemyAI.AMBUSH,
    biomeYMin: 0,
    biomeYMax: WORLD_HEIGHT,
    voidDimension: true,
    xp: 120,
    loot: [
      { itemId: 352, count: 3, chance: 0.5 },   // Soul Fragment
      { itemId: 353, count: 1, chance: 0.1 },   // Chaos Shard
    ],
    knockbackResist: 0.5,
  },
  [EnemyType.HELLFIRE_IMP]: {
    type: EnemyType.HELLFIRE_IMP,
    name: 'Hellfire Imp',
    hp: 80,
    damage: 30,
    speed: 200,
    color: 0xff4400,
    width: 20,
    height: 24,
    ai: EnemyAI.RANGED,
    biomeYMin: 0,
    biomeYMax: WORLD_HEIGHT,
    voidDimension: true,
    xp: 60,
    loot: [
      { itemId: 350, count: 2, chance: 0.5 },   // Void Essence
      { itemId: 351, count: 1, chance: 0.2 },   // Hellfire Core
    ],
    knockbackResist: 0,
  },
  [EnemyType.NETHER_GOLEM]: {
    type: EnemyType.NETHER_GOLEM,
    name: 'Nether Golem',
    hp: 400,
    damage: 60,
    speed: 80,
    color: 0x4a1a2a,
    width: 40,
    height: 48,
    ai: EnemyAI.CHARGE,
    biomeYMin: 0,
    biomeYMax: WORLD_HEIGHT,
    voidDimension: true,
    xp: 200,
    loot: [
      { itemId: 354, count: 2, chance: 0.3 },   // Abyssal Ingot
      { itemId: 353, count: 1, chance: 0.15 },  // Chaos Shard
    ],
    knockbackResist: 0.8,
  },
  [EnemyType.SOUL_EATER]: {
    type: EnemyType.SOUL_EATER,
    name: 'Soul Eater',
    hp: 150,
    damage: 25,
    speed: 160,
    color: 0x66ccff,
    width: 30,
    height: 34,
    ai: EnemyAI.SWOOP,
    biomeYMin: 0,
    biomeYMax: WORLD_HEIGHT,
    voidDimension: true,
    xp: 90,
    loot: [
      { itemId: 352, count: 4, chance: 0.7 },   // Soul Fragment
    ],
    knockbackResist: 0,
  },
  [EnemyType.VOID_SERPENT]: {
    type: EnemyType.VOID_SERPENT,
    name: 'Void Serpent',
    hp: 300,
    damage: 45,
    speed: 120,
    color: 0x2a1040,
    width: 48,
    height: 24,
    ai: EnemyAI.EMERGE,
    biomeYMin: 0,
    biomeYMax: WORLD_HEIGHT,
    voidDimension: true,
    xp: 150,
    loot: [
      { itemId: 350, count: 5, chance: 0.8 },   // Void Essence
      { itemId: 355, count: 1, chance: 0.05 },  // Dimensional Fabric
    ],
    knockbackResist: 0,
  },
  [EnemyType.CHAOS_ELEMENTAL]: {
    type: EnemyType.CHAOS_ELEMENTAL,
    name: 'Chaos Elemental',
    hp: 250,
    damage: 55,
    speed: 150,
    color: 0xff00ff,
    width: 32,
    height: 38,
    ai: EnemyAI.RANGED,
    biomeYMin: 0,
    biomeYMax: WORLD_HEIGHT,
    voidDimension: true,
    xp: 180,
    loot: [
      { itemId: 353, count: 2, chance: 0.25 },  // Chaos Shard
      { itemId: 355, count: 1, chance: 0.08 },  // Dimensional Fabric
    ],
    knockbackResist: 0,
  },
  [EnemyType.DARK_KNIGHT]: {
    type: EnemyType.DARK_KNIGHT,
    name: 'Dark Knight',
    hp: 350,
    damage: 70,
    speed: 100,
    color: 0x1a0a2e,
    width: 36,
    height: 48,
    ai: EnemyAI.PATROL,
    biomeYMin: 0,
    biomeYMax: WORLD_HEIGHT,
    voidDimension: true,
    xp: 220,
    loot: [
      { itemId: 354, count: 2, chance: 0.4 },   // Abyssal Ingot
      { itemId: 353, count: 1, chance: 0.2 },   // Chaos Shard
      { itemId: 355, count: 1, chance: 0.1 },   // Dimensional Fabric
    ],
    knockbackResist: 0.6,
  },
}
