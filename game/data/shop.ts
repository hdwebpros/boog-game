import { TileType } from '../world/TileRegistry'

export interface ShopItem {
  itemId: number
  price: number
}

export const SHOP_INVENTORY: ShopItem[] = [
  { itemId: 300, price: 50 },   // Cloud Boots
  { itemId: 301, price: 80 },   // Star Compass
  { itemId: 302, price: 120 },  // Gravity Belt
  { itemId: 303, price: 200 },  // Miner's Lantern
  { itemId: 304, price: 150 },  // Lucky Charm
  { itemId: 305, price: 300 },  // Celestial Cape
  { itemId: 310, price: 15 },   // Star Lantern
  { itemId: 311, price: 20 },   // Celestial Banner
  { itemId: 312, price: 10 },   // Starfall Flower
  { itemId: 313, price: 25 },   // Sky Crystal Lamp
]

export const SELL_PRICES: Record<number, number> = {
  // Common blocks
  [TileType.DIRT]: 1,
  [TileType.GRASS]: 1,
  [TileType.SAND]: 1,
  [TileType.STONE]: 1,
  [TileType.WOOD]: 1,
  [TileType.LEAVES]: 1,
  [TileType.CLAY]: 1,
  [TileType.MOSS]: 1,
  [TileType.SNOW]: 1,
  [TileType.SANDSTONE]: 1,
  [TileType.CORAL]: 2,
  [TileType.MUSHROOM_BLOCK]: 2,
  [TileType.ICE]: 2,
  [TileType.FROZEN_STONE]: 2,
  [TileType.CLOUD_BLOCK]: 1,
  [TileType.CLOUD_BRICK]: 2,

  // Ores & rare blocks
  [TileType.IRON_ORE]: 3,
  [TileType.OBSIDIAN]: 5,
  [TileType.CRYSTAL]: 5,
  [TileType.DIAMOND_ORE]: 8,
  [TileType.TITANIUM_ORE]: 10,
  [TileType.CARBON_FIBER]: 15,

  // Crystals
  [TileType.CRYSTAL_LIFE]: 4,
  [TileType.CRYSTAL_FROST]: 5,
  [TileType.CRYSTAL_STORM]: 6,
  [TileType.CRYSTAL_EMBER]: 7,
  [TileType.CRYSTAL_VOID]: 10,

  // Processed materials
  100: 5,   // Iron Bar
  101: 12,  // Diamond
  102: 15,  // Titanium Bar
  103: 20,  // Carbon Plate
  104: 2,   // Glass
  105: 1,   // Plant Fiber

  // Shards
  230: 6,   // Ember Shard
  231: 6,   // Frost Shard
  232: 6,   // Storm Shard
  233: 10,  // Void Shard
  234: 4,   // Life Shard
  235: 3,   // Arcane Dust

  // Decorations
  310: 5,   // Star Lantern
  311: 7,   // Celestial Banner
  312: 3,   // Starfall Flower
  313: 8,   // Sky Crystal Lamp
}
