import { TileType } from '../world/TileRegistry'

export enum ItemCategory {
  BLOCK = 'block',
  TOOL = 'tool',
  WEAPON = 'weapon',
  MATERIAL = 'material',
  STATION = 'station',
  ARMOR = 'armor',
  CONSUMABLE = 'consumable',
  SPECIAL = 'special',
}

export type WeaponStyle = 'melee' | 'ranged' | 'magic' | 'summon'
export type ArmorSlot = 'helmet' | 'chestplate' | 'leggings' | 'boots'

export interface ItemDef {
  id: number
  name: string
  category: ItemCategory
  stackSize: number
  tier: number
  color: number // placeholder icon color
  tileType?: TileType // if this item can be placed as a block
  miningSpeed?: number // multiplier (tools only)
  miningTier?: number  // what tier blocks this tool can mine
  damage?: number
  weaponStyle?: WeaponStyle
  attackSpeed?: number   // cooldown in ms
  manaCost?: number      // mana cost per use (magic weapons)
  projectileSpeed?: number // pixels/sec (ranged/magic)
  healAmount?: number    // for consumables
  defense?: number       // damage reduction (armor only)
  armorSlot?: ArmorSlot  // which slot this armor equips to
}

// IDs 0-99: blocks (match TileType)
// IDs 100+: non-block items

export const ITEMS: Record<number, ItemDef> = {
  // ── Blocks (ID = TileType) ──────────────────────────────
  [TileType.GRASS]:        { id: TileType.GRASS,        name: 'Grass',        category: ItemCategory.BLOCK, stackSize: 99, tier: 0, color: 0x4a8c2a, tileType: TileType.GRASS },
  [TileType.DIRT]:         { id: TileType.DIRT,         name: 'Dirt',         category: ItemCategory.BLOCK, stackSize: 99, tier: 0, color: 0x8b5e3c, tileType: TileType.DIRT },
  [TileType.STONE]:        { id: TileType.STONE,        name: 'Stone',        category: ItemCategory.BLOCK, stackSize: 99, tier: 0, color: 0x808080, tileType: TileType.STONE },
  [TileType.WOOD]:         { id: TileType.WOOD,         name: 'Wood',         category: ItemCategory.BLOCK, stackSize: 99, tier: 0, color: 0x6b4226, tileType: TileType.WOOD },
  [TileType.LEAVES]:       { id: TileType.LEAVES,       name: 'Leaves',       category: ItemCategory.BLOCK, stackSize: 99, tier: 0, color: 0x2d6b1e, tileType: TileType.LEAVES },
  [TileType.IRON_ORE]:     { id: TileType.IRON_ORE,     name: 'Iron Ore',     category: ItemCategory.BLOCK, stackSize: 99, tier: 1, color: 0xc19a6b, tileType: TileType.IRON_ORE },
  [TileType.DIAMOND_ORE]:  { id: TileType.DIAMOND_ORE,  name: 'Diamond Ore',  category: ItemCategory.BLOCK, stackSize: 99, tier: 2, color: 0x4af0e0, tileType: TileType.DIAMOND_ORE },
  [TileType.TITANIUM_ORE]: { id: TileType.TITANIUM_ORE, name: 'Titanium Ore', category: ItemCategory.BLOCK, stackSize: 99, tier: 3, color: 0xd4d4d4, tileType: TileType.TITANIUM_ORE },
  [TileType.SAND]:         { id: TileType.SAND,         name: 'Sand',         category: ItemCategory.BLOCK, stackSize: 99, tier: 0, color: 0xe6d5a8, tileType: TileType.SAND },
  [TileType.CORAL]:        { id: TileType.CORAL,        name: 'Coral',        category: ItemCategory.BLOCK, stackSize: 99, tier: 0, color: 0xff6b9d, tileType: TileType.CORAL },
  [TileType.CARBON_FIBER]: { id: TileType.CARBON_FIBER, name: 'Carbon Fiber', category: ItemCategory.BLOCK, stackSize: 99, tier: 4, color: 0x2a2a4e, tileType: TileType.CARBON_FIBER },

  // ── Materials ───────────────────────────────────────────
  100: { id: 100, name: 'Iron Bar',      category: ItemCategory.MATERIAL, stackSize: 99, tier: 1, color: 0xc9a96e },
  101: { id: 101, name: 'Diamond',       category: ItemCategory.MATERIAL, stackSize: 99, tier: 2, color: 0x7fffff },
  102: { id: 102, name: 'Titanium Bar',  category: ItemCategory.MATERIAL, stackSize: 99, tier: 3, color: 0xe8e8e8 },
  103: { id: 103, name: 'Carbon Plate',  category: ItemCategory.MATERIAL, stackSize: 99, tier: 4, color: 0x3a3a5e },
  104: { id: 104, name: 'Glass',         category: ItemCategory.MATERIAL, stackSize: 99, tier: 0, color: 0xccddee },
  105: { id: 105, name: 'Plant Fiber',   category: ItemCategory.MATERIAL, stackSize: 99, tier: 0, color: 0x66aa44 },
  106: { id: 106, name: 'Torch',         category: ItemCategory.BLOCK,    stackSize: 99, tier: 0, color: 0xffaa00 },

  // ── Stations (placeable) ────────────────────────────────
  110: { id: 110, name: 'Workbench',      category: ItemCategory.STATION, stackSize: 1, tier: 0, color: 0x8b6b3a },
  111: { id: 111, name: 'Furnace',        category: ItemCategory.STATION, stackSize: 1, tier: 1, color: 0xaa4422 },
  112: { id: 112, name: 'Anvil',          category: ItemCategory.STATION, stackSize: 1, tier: 2, color: 0x666688 },
  113: { id: 113, name: 'Tech Bench',     category: ItemCategory.STATION, stackSize: 1, tier: 3, color: 0x4488aa },
  114: { id: 114, name: 'Fusion Station', category: ItemCategory.STATION, stackSize: 1, tier: 4, color: 0x8844cc },
  115: { id: 115, name: 'Workbench Mk2', category: ItemCategory.STATION, stackSize: 1, tier: 1, color: 0xa0824a },

  // ── Tools ───────────────────────────────────────────────
  120: { id: 120, name: 'Wood Pickaxe',     category: ItemCategory.TOOL, stackSize: 1, tier: 0, color: 0x8b6b3a, miningSpeed: 1.5, miningTier: 0 },
  121: { id: 121, name: 'Stone Pickaxe',    category: ItemCategory.TOOL, stackSize: 1, tier: 1, color: 0x999999, miningSpeed: 2.0, miningTier: 1 },
  122: { id: 122, name: 'Iron Pickaxe',     category: ItemCategory.TOOL, stackSize: 1, tier: 2, color: 0xc9a96e, miningSpeed: 3.0, miningTier: 2 },
  123: { id: 123, name: 'Diamond Pickaxe',  category: ItemCategory.TOOL, stackSize: 1, tier: 3, color: 0x7fffff, miningSpeed: 4.0, miningTier: 3 },
  124: { id: 124, name: 'Titanium Pickaxe', category: ItemCategory.TOOL, stackSize: 1, tier: 4, color: 0xe8e8e8, miningSpeed: 5.0, miningTier: 4 },

  // ── Melee Weapons ───────────────────────────────────────
  130: { id: 130, name: 'Wood Sword',     category: ItemCategory.WEAPON, stackSize: 1, tier: 0, color: 0x8b6b3a, damage: 8,  weaponStyle: 'melee', attackSpeed: 400 },
  131: { id: 131, name: 'Stone Sword',    category: ItemCategory.WEAPON, stackSize: 1, tier: 1, color: 0x999999, damage: 14, weaponStyle: 'melee', attackSpeed: 380 },
  132: { id: 132, name: 'Iron Sword',     category: ItemCategory.WEAPON, stackSize: 1, tier: 2, color: 0xc9a96e, damage: 22, weaponStyle: 'melee', attackSpeed: 350 },
  133: { id: 133, name: 'Diamond Sword',  category: ItemCategory.WEAPON, stackSize: 1, tier: 3, color: 0x7fffff, damage: 35, weaponStyle: 'melee', attackSpeed: 320 },
  134: { id: 134, name: 'Titanium Sword', category: ItemCategory.WEAPON, stackSize: 1, tier: 4, color: 0xe8e8e8, damage: 50, weaponStyle: 'melee', attackSpeed: 300 },

  // ── Ranged Weapons ──────────────────────────────────────
  140: { id: 140, name: 'Wood Bow',  category: ItemCategory.WEAPON, stackSize: 1, tier: 0, color: 0x8b6b3a, damage: 6,  weaponStyle: 'ranged', attackSpeed: 600, projectileSpeed: 400 },
  141: { id: 141, name: 'Iron Bow',  category: ItemCategory.WEAPON, stackSize: 1, tier: 2, color: 0xc9a96e, damage: 18, weaponStyle: 'ranged', attackSpeed: 500, projectileSpeed: 500 },
  142: { id: 142, name: 'Laser Gun', category: ItemCategory.WEAPON, stackSize: 1, tier: 4, color: 0xff4444, damage: 45, weaponStyle: 'ranged', attackSpeed: 300, projectileSpeed: 700 },

  // ── Magic Weapons ───────────────────────────────────────
  150: { id: 150, name: 'Apprentice Staff', category: ItemCategory.WEAPON, stackSize: 1, tier: 1, color: 0x6644cc, damage: 12, weaponStyle: 'magic', attackSpeed: 500, manaCost: 8,  projectileSpeed: 350 },
  151: { id: 151, name: 'Crystal Staff',    category: ItemCategory.WEAPON, stackSize: 1, tier: 3, color: 0xaa66ff, damage: 32, weaponStyle: 'magic', attackSpeed: 400, manaCost: 15, projectileSpeed: 450 },

  // ── Summon Weapons ──────────────────────────────────────
  160: { id: 160, name: 'Drone Totem',   category: ItemCategory.WEAPON, stackSize: 1, tier: 2, color: 0x44aa88, damage: 10, weaponStyle: 'summon', attackSpeed: 1000, manaCost: 20 },
  161: { id: 161, name: 'Swarm Beacon',  category: ItemCategory.WEAPON, stackSize: 1, tier: 4, color: 0x88ffcc, damage: 28, weaponStyle: 'summon', attackSpeed: 800,  manaCost: 30 },

  // ── Boss Summon Items ───────────────────────────────────
  170: { id: 170, name: 'Vine Beacon',    category: ItemCategory.SPECIAL, stackSize: 1, tier: 0, color: 0x44cc44 },
  171: { id: 171, name: 'Tidal Pearl',    category: ItemCategory.SPECIAL, stackSize: 1, tier: 1, color: 0x2288cc },
  172: { id: 172, name: 'Crystal Lens',   category: ItemCategory.SPECIAL, stackSize: 1, tier: 2, color: 0x66ddff },
  173: { id: 173, name: 'Magma Core',     category: ItemCategory.SPECIAL, stackSize: 1, tier: 3, color: 0xff4400 },
  174: { id: 174, name: 'Void Sigil',     category: ItemCategory.SPECIAL, stackSize: 1, tier: 4, color: 0xaa22ff },
  175: { id: 175, name: 'Signal Beacon',  category: ItemCategory.SPECIAL, stackSize: 1, tier: 5, color: 0xff44ff },

  // ── Jetpack Components ──────────────────────────────────
  180: { id: 180, name: 'Fuel Cell Casing',  category: ItemCategory.SPECIAL, stackSize: 1, tier: 0, color: 0xddaa33 },
  181: { id: 181, name: 'Thrust Regulator',  category: ItemCategory.SPECIAL, stackSize: 1, tier: 1, color: 0xbbbbbb },
  182: { id: 182, name: 'Pressure Valve',    category: ItemCategory.SPECIAL, stackSize: 1, tier: 2, color: 0x5599cc },
  183: { id: 183, name: 'Energy Capacitor',  category: ItemCategory.SPECIAL, stackSize: 1, tier: 3, color: 0xcc66ff },
  184: { id: 184, name: 'Ignition Core',     category: ItemCategory.SPECIAL, stackSize: 1, tier: 3, color: 0xff6600 },
  185: { id: 185, name: 'Navigation Module', category: ItemCategory.SPECIAL, stackSize: 1, tier: 4, color: 0x00ffaa },
  186: { id: 186, name: 'Jetpack',           category: ItemCategory.SPECIAL, stackSize: 1, tier: 5, color: 0xffdd00 },

  // ── Consumables ─────────────────────────────────────────
  190: { id: 190, name: 'Healing Herb',  category: ItemCategory.CONSUMABLE, stackSize: 30, tier: 0, color: 0x33cc33, healAmount: 25 },
  191: { id: 191, name: 'Cooked Meat',   category: ItemCategory.CONSUMABLE, stackSize: 20, tier: 0, color: 0xcc6633, healAmount: 50 },
  192: { id: 192, name: 'Rebreather',    category: ItemCategory.SPECIAL,    stackSize: 1,  tier: 2, color: 0x00cccc },

  // ── Armor: Wood (Tier 0) ──────────────────────────────
  200: { id: 200, name: 'Wood Helmet',      category: ItemCategory.ARMOR, stackSize: 1, tier: 0, color: 0x8b6b3a, defense: 1, armorSlot: 'helmet' },
  201: { id: 201, name: 'Wood Chestplate',  category: ItemCategory.ARMOR, stackSize: 1, tier: 0, color: 0x8b6b3a, defense: 2, armorSlot: 'chestplate' },
  202: { id: 202, name: 'Wood Leggings',   category: ItemCategory.ARMOR, stackSize: 1, tier: 0, color: 0x8b6b3a, defense: 1, armorSlot: 'leggings' },
  203: { id: 203, name: 'Wood Boots',      category: ItemCategory.ARMOR, stackSize: 1, tier: 0, color: 0x8b6b3a, defense: 1, armorSlot: 'boots' },

  // ── Armor: Stone (Tier 1) ─────────────────────────────
  204: { id: 204, name: 'Stone Helmet',     category: ItemCategory.ARMOR, stackSize: 1, tier: 1, color: 0x999999, defense: 2, armorSlot: 'helmet' },
  205: { id: 205, name: 'Stone Chestplate', category: ItemCategory.ARMOR, stackSize: 1, tier: 1, color: 0x999999, defense: 3, armorSlot: 'chestplate' },
  206: { id: 206, name: 'Stone Leggings',  category: ItemCategory.ARMOR, stackSize: 1, tier: 1, color: 0x999999, defense: 2, armorSlot: 'leggings' },
  207: { id: 207, name: 'Stone Boots',     category: ItemCategory.ARMOR, stackSize: 1, tier: 1, color: 0x999999, defense: 1, armorSlot: 'boots' },

  // ── Armor: Iron (Tier 2) ──────────────────────────────
  208: { id: 208, name: 'Iron Helmet',      category: ItemCategory.ARMOR, stackSize: 1, tier: 2, color: 0xc9a96e, defense: 3, armorSlot: 'helmet' },
  209: { id: 209, name: 'Iron Chestplate',  category: ItemCategory.ARMOR, stackSize: 1, tier: 2, color: 0xc9a96e, defense: 5, armorSlot: 'chestplate' },
  210: { id: 210, name: 'Iron Leggings',   category: ItemCategory.ARMOR, stackSize: 1, tier: 2, color: 0xc9a96e, defense: 3, armorSlot: 'leggings' },
  211: { id: 211, name: 'Iron Boots',      category: ItemCategory.ARMOR, stackSize: 1, tier: 2, color: 0xc9a96e, defense: 2, armorSlot: 'boots' },

  // ── Armor: Diamond (Tier 3) ───────────────────────────
  212: { id: 212, name: 'Diamond Helmet',     category: ItemCategory.ARMOR, stackSize: 1, tier: 3, color: 0x7fffff, defense: 4, armorSlot: 'helmet' },
  213: { id: 213, name: 'Diamond Chestplate', category: ItemCategory.ARMOR, stackSize: 1, tier: 3, color: 0x7fffff, defense: 7, armorSlot: 'chestplate' },
  214: { id: 214, name: 'Diamond Leggings',  category: ItemCategory.ARMOR, stackSize: 1, tier: 3, color: 0x7fffff, defense: 5, armorSlot: 'leggings' },
  215: { id: 215, name: 'Diamond Boots',     category: ItemCategory.ARMOR, stackSize: 1, tier: 3, color: 0x7fffff, defense: 3, armorSlot: 'boots' },

  // ── Armor: Titanium (Tier 4) ──────────────────────────
  216: { id: 216, name: 'Titanium Helmet',     category: ItemCategory.ARMOR, stackSize: 1, tier: 4, color: 0xe8e8e8, defense: 6, armorSlot: 'helmet' },
  217: { id: 217, name: 'Titanium Chestplate', category: ItemCategory.ARMOR, stackSize: 1, tier: 4, color: 0xe8e8e8, defense: 10, armorSlot: 'chestplate' },
  218: { id: 218, name: 'Titanium Leggings',  category: ItemCategory.ARMOR, stackSize: 1, tier: 4, color: 0xe8e8e8, defense: 7, armorSlot: 'leggings' },
  219: { id: 219, name: 'Titanium Boots',     category: ItemCategory.ARMOR, stackSize: 1, tier: 4, color: 0xe8e8e8, defense: 4, armorSlot: 'boots' },
}

export function getItemDef(id: number): ItemDef | undefined {
  return ITEMS[id]
}
