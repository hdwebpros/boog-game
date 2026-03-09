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
}

export const TILE_SIZE = 16
export const WORLD_WIDTH = 4000
export const WORLD_HEIGHT = 1200
