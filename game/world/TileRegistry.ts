export enum TileType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  WOOD = 4,
  LEAVES = 5,
  IRON_ORE = 6,
  DIAMOND_ORE = 7,
  TITANIUM_ORE = 8,
  LAVA = 9,
  WATER = 10,
  SAND = 11,
  CORAL = 12,
  CARBON_FIBER = 13,
  STATION_WORKBENCH = 14,
  STATION_FURNACE = 15,
  STATION_ANVIL = 16,
  STATION_TECH_BENCH = 17,
  STATION_FUSION = 18,
  STATION_WORKBENCH_MK2 = 19,
  SNOW = 20,
  ICE = 21,
  CLAY = 22,
  OBSIDIAN = 23,
  CRYSTAL = 24,
  MOSS = 25,
  MUSHROOM_BLOCK = 26,
  SANDSTONE = 27,
  CACTUS = 28,
  JUNGLE_GRASS = 29,
  FROZEN_STONE = 30,
  CRYSTAL_EMBER = 31,
  CRYSTAL_FROST = 32,
  CRYSTAL_STORM = 33,
  CRYSTAL_VOID = 34,
  CRYSTAL_LIFE = 35,
  STATION_ARCANE_ANVIL = 36,
  VINE = 37,
  CLOUD_BLOCK = 38,
  CLOUD_BRICK = 39,
  CLOUD_PILLAR = 40,
  SEAWEED = 41,
  CHEST = 42,
}

export interface TileProperties {
  name: string
  color: number
  hardness: number
  solid: boolean
  mineable: boolean
  tier: number
  liquid?: boolean
  transparent?: boolean
  damaging?: boolean
  climbable?: boolean
}

export const TILE_PROPERTIES: Record<TileType, TileProperties> = {
  [TileType.AIR]:          { name: 'Air',          color: 0x000000, hardness: 0,   solid: false, mineable: false, tier: 0, transparent: true },
  [TileType.GRASS]:        { name: 'Grass',        color: 0x4a8c2a, hardness: 1,   solid: true,  mineable: true,  tier: 0 },
  [TileType.DIRT]:         { name: 'Dirt',         color: 0x8b5e3c, hardness: 1,   solid: true,  mineable: true,  tier: 0 },
  [TileType.STONE]:        { name: 'Stone',        color: 0x808080, hardness: 2,   solid: true,  mineable: true,  tier: 1 },
  [TileType.WOOD]:         { name: 'Wood',         color: 0x6b4226, hardness: 1,   solid: true,  mineable: true,  tier: 0 },
  [TileType.LEAVES]:       { name: 'Leaves',       color: 0x2d6b1e, hardness: 0.5, solid: false, mineable: true,  tier: 0, transparent: true },
  [TileType.IRON_ORE]:     { name: 'Iron Ore',     color: 0xc19a6b, hardness: 3,   solid: true,  mineable: true,  tier: 1 },
  [TileType.DIAMOND_ORE]:  { name: 'Diamond Ore',  color: 0x4af0e0, hardness: 5,   solid: true,  mineable: true,  tier: 2 },
  [TileType.TITANIUM_ORE]: { name: 'Titanium Ore', color: 0xd4d4d4, hardness: 6,   solid: true,  mineable: true,  tier: 3 },
  [TileType.LAVA]:         { name: 'Lava',         color: 0xff4400, hardness: 0,   solid: false, mineable: false, tier: 0, liquid: true, damaging: true },
  [TileType.WATER]:        { name: 'Water',        color: 0x2266cc, hardness: 0,   solid: false, mineable: false, tier: 0, liquid: true, transparent: true },
  [TileType.SAND]:         { name: 'Sand',         color: 0xe6d5a8, hardness: 0.5, solid: true,  mineable: true,  tier: 0 },
  [TileType.CORAL]:        { name: 'Coral',        color: 0xff6b9d, hardness: 1,   solid: true,  mineable: true,  tier: 0 },
  [TileType.CARBON_FIBER]: { name: 'Carbon Fiber', color: 0x2a2a4e, hardness: 8,   solid: true,  mineable: true,  tier: 4 },
  [TileType.STATION_WORKBENCH]:     { name: 'Workbench',       color: 0x8b6b3a, hardness: 2, solid: true, mineable: true, tier: 0 },
  [TileType.STATION_FURNACE]:       { name: 'Furnace',         color: 0xaa4422, hardness: 3, solid: true, mineable: true, tier: 1 },
  [TileType.STATION_ANVIL]:         { name: 'Anvil',           color: 0x666688, hardness: 4, solid: true, mineable: true, tier: 2 },
  [TileType.STATION_TECH_BENCH]:    { name: 'Tech Bench',      color: 0x4488aa, hardness: 5, solid: true, mineable: true, tier: 3 },
  [TileType.STATION_FUSION]:        { name: 'Fusion Station',  color: 0x8844cc, hardness: 6, solid: true, mineable: true, tier: 4 },
  [TileType.STATION_WORKBENCH_MK2]: { name: 'Workbench Mk2',   color: 0xa0824a, hardness: 3, solid: true, mineable: true, tier: 1 },
  [TileType.SNOW]:           { name: 'Snow',           color: 0xeeeeff, hardness: 0.5, solid: true,  mineable: true,  tier: 0 },
  [TileType.ICE]:            { name: 'Ice',            color: 0x88ccee, hardness: 2,   solid: true,  mineable: true,  tier: 0, transparent: true },
  [TileType.CLAY]:           { name: 'Clay',           color: 0xb07050, hardness: 1.5, solid: true,  mineable: true,  tier: 0 },
  [TileType.OBSIDIAN]:       { name: 'Obsidian',       color: 0x1a1a2e, hardness: 7,   solid: true,  mineable: true,  tier: 3 },
  [TileType.CRYSTAL]:        { name: 'Crystal',        color: 0xaa55ff, hardness: 4,   solid: true,  mineable: true,  tier: 2, transparent: true },
  [TileType.MOSS]:           { name: 'Moss',           color: 0x3d7a3d, hardness: 0.5, solid: true,  mineable: true,  tier: 0 },
  [TileType.MUSHROOM_BLOCK]: { name: 'Mushroom Block', color: 0xcc6644, hardness: 1,   solid: true,  mineable: true,  tier: 0 },
  [TileType.SANDSTONE]:      { name: 'Sandstone',      color: 0xd4b483, hardness: 2,   solid: true,  mineable: true,  tier: 0 },
  [TileType.CACTUS]:         { name: 'Cactus',         color: 0x2d8a2d, hardness: 1,   solid: true,  mineable: true,  tier: 0, damaging: true },
  [TileType.JUNGLE_GRASS]:   { name: 'Jungle Grass',   color: 0x2a6e1e, hardness: 1,   solid: true,  mineable: true,  tier: 0 },
  [TileType.FROZEN_STONE]:   { name: 'Frozen Stone',   color: 0x7799aa, hardness: 3,   solid: true,  mineable: true,  tier: 1 },
  [TileType.CRYSTAL_EMBER]:  { name: 'Ember Crystal',  color: 0xff6633, hardness: 4,   solid: true,  mineable: true,  tier: 2, transparent: true },
  [TileType.CRYSTAL_FROST]:  { name: 'Frost Crystal',  color: 0x66ccff, hardness: 4,   solid: true,  mineable: true,  tier: 2, transparent: true },
  [TileType.CRYSTAL_STORM]:  { name: 'Storm Crystal',  color: 0xffee44, hardness: 4,   solid: true,  mineable: true,  tier: 2, transparent: true },
  [TileType.CRYSTAL_VOID]:   { name: 'Void Crystal',   color: 0x9933ff, hardness: 5,   solid: true,  mineable: true,  tier: 3, transparent: true },
  [TileType.CRYSTAL_LIFE]:   { name: 'Life Crystal',   color: 0x33ff66, hardness: 3,   solid: true,  mineable: true,  tier: 1, transparent: true },
  [TileType.STATION_ARCANE_ANVIL]: { name: 'Arcane Anvil', color: 0x7744cc, hardness: 5, solid: true, mineable: true, tier: 2 },
  [TileType.VINE]:               { name: 'Vine Rope', color: 0x33aa22, hardness: 0.3, solid: false, mineable: true, tier: 0, transparent: true, climbable: true },
  [TileType.CLOUD_BLOCK]:        { name: 'Cloud Block', color: 0xddddff, hardness: 1, solid: true, mineable: true, tier: 0 },
  [TileType.CLOUD_BRICK]:        { name: 'Cloud Brick', color: 0x8899bb, hardness: 2, solid: true, mineable: true, tier: 0 },
  [TileType.CLOUD_PILLAR]:       { name: 'Cloud Pillar', color: 0xddaa44, hardness: 0, solid: true, mineable: false, tier: 0 },
  [TileType.SEAWEED]:            { name: 'Seaweed', color: 0x1a7a30, hardness: 0.2, solid: false, mineable: true, tier: 0, transparent: true },
  [TileType.CHEST]:              { name: 'Chest', color: 0x8b5a2b, hardness: 2, solid: true, mineable: true, tier: 0 },
}

/** Map station item IDs to their tile types */
export const STATION_TILE_TYPE: Record<number, TileType> = {
  110: TileType.STATION_WORKBENCH,
  111: TileType.STATION_FURNACE,
  112: TileType.STATION_ANVIL,
  113: TileType.STATION_TECH_BENCH,
  114: TileType.STATION_FUSION,
  115: TileType.STATION_WORKBENCH_MK2,
  236: TileType.STATION_ARCANE_ANVIL,
  116: TileType.CHEST,
}

export const TILE_SIZE = 16
export const WORLD_WIDTH = 6000
export const WORLD_HEIGHT = 1600
