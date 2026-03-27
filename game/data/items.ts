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
  CURRENCY = 'currency',
  ACCESSORY = 'accessory',
}

export type EnchantmentType = 'ember' | 'frost' | 'storm' | 'void' | 'life' | 'eternal'

export const ENCHANTMENT_COLORS: Record<EnchantmentType, number> = {
  ember: 0xff6633,
  frost: 0x66ccff,
  storm: 0xffee44,
  void: 0x9933ff,
  life: 0x33ff66,
  eternal: 0xffd700,
}

export const ENCHANTMENT_NAMES: Record<EnchantmentType, string> = {
  ember: 'Inferno',
  frost: 'Glacial',
  storm: 'Tempest',
  void: 'Abyssal',
  life: 'Verdant',
  eternal: 'Eternal',
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
  thornsPct?: number     // % of damage reflected back to attacker (0-1)
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
  [TileType.SNOW]:           { id: TileType.SNOW,           name: 'Snow',           category: ItemCategory.BLOCK, stackSize: 99, tier: 0, color: 0xeeeeff, tileType: TileType.SNOW },
  [TileType.ICE]:            { id: TileType.ICE,            name: 'Ice',            category: ItemCategory.BLOCK, stackSize: 99, tier: 0, color: 0x88ccee, tileType: TileType.ICE },
  [TileType.CLAY]:           { id: TileType.CLAY,           name: 'Clay',           category: ItemCategory.BLOCK, stackSize: 99, tier: 0, color: 0xb07050, tileType: TileType.CLAY },
  [TileType.OBSIDIAN]:       { id: TileType.OBSIDIAN,       name: 'Obsidian',       category: ItemCategory.BLOCK, stackSize: 99, tier: 3, color: 0x1a1a2e, tileType: TileType.OBSIDIAN },
  [TileType.CRYSTAL]:        { id: TileType.CRYSTAL,        name: 'Crystal',        category: ItemCategory.BLOCK, stackSize: 99, tier: 2, color: 0xaa55ff, tileType: TileType.CRYSTAL },
  [TileType.MOSS]:           { id: TileType.MOSS,           name: 'Moss',           category: ItemCategory.BLOCK, stackSize: 99, tier: 0, color: 0x3d7a3d, tileType: TileType.MOSS },
  [TileType.MUSHROOM_BLOCK]: { id: TileType.MUSHROOM_BLOCK, name: 'Mushroom Block', category: ItemCategory.BLOCK, stackSize: 99, tier: 0, color: 0xcc6644, tileType: TileType.MUSHROOM_BLOCK },
  [TileType.SANDSTONE]:      { id: TileType.SANDSTONE,      name: 'Sandstone',      category: ItemCategory.BLOCK, stackSize: 99, tier: 0, color: 0xd4b483, tileType: TileType.SANDSTONE },
  [TileType.CACTUS]:         { id: TileType.CACTUS,         name: 'Cactus',         category: ItemCategory.BLOCK, stackSize: 99, tier: 0, color: 0x2d8a2d, tileType: TileType.CACTUS },
  [TileType.JUNGLE_GRASS]:   { id: TileType.JUNGLE_GRASS,   name: 'Jungle Grass',   category: ItemCategory.BLOCK, stackSize: 99, tier: 0, color: 0x2a6e1e, tileType: TileType.JUNGLE_GRASS },
  [TileType.FROZEN_STONE]:   { id: TileType.FROZEN_STONE,   name: 'Frozen Stone',   category: ItemCategory.BLOCK, stackSize: 99, tier: 1, color: 0x7799aa, tileType: TileType.FROZEN_STONE },
  [TileType.CRYSTAL_EMBER]:  { id: TileType.CRYSTAL_EMBER,  name: 'Ember Crystal',  category: ItemCategory.BLOCK, stackSize: 99, tier: 2, color: 0xff6633, tileType: TileType.CRYSTAL_EMBER },
  [TileType.CRYSTAL_FROST]:  { id: TileType.CRYSTAL_FROST,  name: 'Frost Crystal',  category: ItemCategory.BLOCK, stackSize: 99, tier: 2, color: 0x66ccff, tileType: TileType.CRYSTAL_FROST },
  [TileType.CRYSTAL_STORM]:  { id: TileType.CRYSTAL_STORM,  name: 'Storm Crystal',  category: ItemCategory.BLOCK, stackSize: 99, tier: 2, color: 0xffee44, tileType: TileType.CRYSTAL_STORM },
  [TileType.CRYSTAL_VOID]:   { id: TileType.CRYSTAL_VOID,   name: 'Void Crystal',   category: ItemCategory.BLOCK, stackSize: 99, tier: 3, color: 0x9933ff, tileType: TileType.CRYSTAL_VOID },
  [TileType.CRYSTAL_LIFE]:   { id: TileType.CRYSTAL_LIFE,   name: 'Life Crystal',   category: ItemCategory.BLOCK, stackSize: 99, tier: 1, color: 0x33ff66, tileType: TileType.CRYSTAL_LIFE },
  [TileType.VINE]:           { id: TileType.VINE,           name: 'Vine Rope',      category: ItemCategory.BLOCK, stackSize: 99, tier: 0, color: 0x33aa22, tileType: TileType.VINE },
  [TileType.CLOUD_BLOCK]:    { id: TileType.CLOUD_BLOCK,    name: 'Cloud Block',    category: ItemCategory.BLOCK, stackSize: 99, tier: 0, color: 0xddddff, tileType: TileType.CLOUD_BLOCK },
  [TileType.CLOUD_BRICK]:    { id: TileType.CLOUD_BRICK,    name: 'Cloud Brick',    category: ItemCategory.BLOCK, stackSize: 99, tier: 0, color: 0x8899bb, tileType: TileType.CLOUD_BRICK },
  [TileType.CLOUD_PILLAR]:   { id: TileType.CLOUD_PILLAR,   name: 'Cloud Pillar',   category: ItemCategory.BLOCK, stackSize: 99, tier: 0, color: 0xddaa44, tileType: TileType.CLOUD_PILLAR },

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
  116: { id: 116, name: 'Chest', category: ItemCategory.STATION, stackSize: 1, tier: 0, color: 0x8b5a2b },
  117: { id: 117, name: 'Portal', category: ItemCategory.STATION, stackSize: 1, tier: 3, color: 0x7744ff },
  118: { id: 118, name: 'Brewing Stand', category: ItemCategory.STATION, stackSize: 1, tier: 1, color: 0x884488 },

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
  193: { id: 193, name: 'Forcefield Potion', category: ItemCategory.CONSUMABLE, stackSize: 10, tier: 2, color: 0x44ddff },

  // ── Potions ─────────────────────────────────────────────
  400: { id: 400, name: 'Ironskin Potion',      category: ItemCategory.CONSUMABLE, stackSize: 10, tier: 1, color: 0xddaa44 },
  401: { id: 401, name: 'Swiftness Potion',     category: ItemCategory.CONSUMABLE, stackSize: 10, tier: 0, color: 0x44ddff },
  402: { id: 402, name: 'Spelunker Potion',     category: ItemCategory.CONSUMABLE, stackSize: 10, tier: 1, color: 0xffcc00 },
  403: { id: 403, name: 'Night Owl Potion',     category: ItemCategory.CONSUMABLE, stackSize: 10, tier: 0, color: 0xaacc44 },
  404: { id: 404, name: 'Featherfall Potion',   category: ItemCategory.CONSUMABLE, stackSize: 10, tier: 0, color: 0xddddff },
  405: { id: 405, name: 'Rage Potion',          category: ItemCategory.CONSUMABLE, stackSize: 10, tier: 2, color: 0xff4444 },
  406: { id: 406, name: 'Regeneration Potion',  category: ItemCategory.CONSUMABLE, stackSize: 10, tier: 1, color: 0xff66aa },
  407: { id: 407, name: 'Mana Surge Potion',    category: ItemCategory.CONSUMABLE, stackSize: 10, tier: 1, color: 0x6644ff },
  408: { id: 408, name: 'Thorns Potion',        category: ItemCategory.CONSUMABLE, stackSize: 10, tier: 2, color: 0x44aa44 },
  409: { id: 409, name: 'Water Walking Potion', category: ItemCategory.CONSUMABLE, stackSize: 10, tier: 1, color: 0x2288ff },
  410: { id: 410, name: 'Giant Potion',         category: ItemCategory.CONSUMABLE, stackSize: 10, tier: 2, color: 0xcc8844 },
  411: { id: 411, name: 'Archery Potion',       category: ItemCategory.CONSUMABLE, stackSize: 10, tier: 1, color: 0x88cc44 },
  412: { id: 412, name: 'Magic Power Potion',   category: ItemCategory.CONSUMABLE, stackSize: 10, tier: 2, color: 0xaa44ff },
  413: { id: 413, name: 'Mining Potion',        category: ItemCategory.CONSUMABLE, stackSize: 10, tier: 1, color: 0xffaa44 },
  414: { id: 414, name: 'Endurance Potion',     category: ItemCategory.CONSUMABLE, stackSize: 10, tier: 2, color: 0x4488cc },
  415: { id: 415, name: 'Wrath Potion',         category: ItemCategory.CONSUMABLE, stackSize: 10, tier: 3, color: 0xff2222 },

  // ── Armor: Scrap (Tier 0) ──────────────────────────────
  200: { id: 200, name: 'Scrap Helm',      category: ItemCategory.ARMOR, stackSize: 1, tier: 0, color: 0x8b6b3a, defense: 1, armorSlot: 'helmet' },
  201: { id: 201, name: 'Scrap Suit',      category: ItemCategory.ARMOR, stackSize: 1, tier: 0, color: 0x8b6b3a, defense: 2, armorSlot: 'chestplate' },
  202: { id: 202, name: 'Scrap Greaves',   category: ItemCategory.ARMOR, stackSize: 1, tier: 0, color: 0x8b6b3a, defense: 1, armorSlot: 'leggings' },
  203: { id: 203, name: 'Scrap Boots',     category: ItemCategory.ARMOR, stackSize: 1, tier: 0, color: 0x8b6b3a, defense: 1, armorSlot: 'boots' },

  // ── Armor: Barbed (Tier 0 — low defense, reflects damage) ──
  220: { id: 220, name: 'Barbed Helm',      category: ItemCategory.ARMOR, stackSize: 1, tier: 0, color: 0x2d8a2d, defense: 1, armorSlot: 'helmet',     thornsPct: 0.05 },
  221: { id: 221, name: 'Barbed Suit',      category: ItemCategory.ARMOR, stackSize: 1, tier: 0, color: 0x2d8a2d, defense: 1, armorSlot: 'chestplate', thornsPct: 0.10 },
  222: { id: 222, name: 'Barbed Greaves',   category: ItemCategory.ARMOR, stackSize: 1, tier: 0, color: 0x2d8a2d, defense: 1, armorSlot: 'leggings',   thornsPct: 0.05 },
  223: { id: 223, name: 'Barbed Boots',     category: ItemCategory.ARMOR, stackSize: 1, tier: 0, color: 0x2d8a2d, defense: 1, armorSlot: 'boots',      thornsPct: 0.05 },

  // ── Armor: Composite (Tier 1) ─────────────────────────
  204: { id: 204, name: 'Composite Helm',     category: ItemCategory.ARMOR, stackSize: 1, tier: 1, color: 0x999999, defense: 2, armorSlot: 'helmet' },
  205: { id: 205, name: 'Composite Suit',     category: ItemCategory.ARMOR, stackSize: 1, tier: 1, color: 0x999999, defense: 3, armorSlot: 'chestplate' },
  206: { id: 206, name: 'Composite Greaves',  category: ItemCategory.ARMOR, stackSize: 1, tier: 1, color: 0x999999, defense: 2, armorSlot: 'leggings' },
  207: { id: 207, name: 'Composite Boots',    category: ItemCategory.ARMOR, stackSize: 1, tier: 1, color: 0x999999, defense: 1, armorSlot: 'boots' },

  // ── Armor: Alloy (Tier 2) ─────────────────────────────
  208: { id: 208, name: 'Alloy Helm',      category: ItemCategory.ARMOR, stackSize: 1, tier: 2, color: 0xc9a96e, defense: 3, armorSlot: 'helmet' },
  209: { id: 209, name: 'Alloy Suit',      category: ItemCategory.ARMOR, stackSize: 1, tier: 2, color: 0xc9a96e, defense: 5, armorSlot: 'chestplate' },
  210: { id: 210, name: 'Alloy Greaves',   category: ItemCategory.ARMOR, stackSize: 1, tier: 2, color: 0xc9a96e, defense: 3, armorSlot: 'leggings' },
  211: { id: 211, name: 'Alloy Boots',     category: ItemCategory.ARMOR, stackSize: 1, tier: 2, color: 0xc9a96e, defense: 2, armorSlot: 'boots' },

  // ── Armor: Prismatic (Tier 3) ─────────────────────────
  212: { id: 212, name: 'Prismatic Helm',     category: ItemCategory.ARMOR, stackSize: 1, tier: 3, color: 0x7fffff, defense: 4, armorSlot: 'helmet' },
  213: { id: 213, name: 'Prismatic Suit',     category: ItemCategory.ARMOR, stackSize: 1, tier: 3, color: 0x7fffff, defense: 7, armorSlot: 'chestplate' },
  214: { id: 214, name: 'Prismatic Greaves',  category: ItemCategory.ARMOR, stackSize: 1, tier: 3, color: 0x7fffff, defense: 5, armorSlot: 'leggings' },
  215: { id: 215, name: 'Prismatic Boots',    category: ItemCategory.ARMOR, stackSize: 1, tier: 3, color: 0x7fffff, defense: 3, armorSlot: 'boots' },

  // ── Armor: Titanium (Tier 4) ──────────────────────────
  216: { id: 216, name: 'Titanium Helm',     category: ItemCategory.ARMOR, stackSize: 1, tier: 4, color: 0xe8e8e8, defense: 6, armorSlot: 'helmet' },
  217: { id: 217, name: 'Titanium Suit',     category: ItemCategory.ARMOR, stackSize: 1, tier: 4, color: 0xe8e8e8, defense: 10, armorSlot: 'chestplate' },
  218: { id: 218, name: 'Titanium Greaves',  category: ItemCategory.ARMOR, stackSize: 1, tier: 4, color: 0xe8e8e8, defense: 7, armorSlot: 'leggings' },
  219: { id: 219, name: 'Titanium Boots',    category: ItemCategory.ARMOR, stackSize: 1, tier: 4, color: 0xe8e8e8, defense: 4, armorSlot: 'boots' },

  // ── Starshards & Enchanting ──────────────────────────
  230: { id: 230, name: 'Ember Shard',   category: ItemCategory.MATERIAL, stackSize: 99, tier: 2, color: 0xff6633 },
  231: { id: 231, name: 'Frost Shard',   category: ItemCategory.MATERIAL, stackSize: 99, tier: 2, color: 0x66ccff },
  232: { id: 232, name: 'Storm Shard',   category: ItemCategory.MATERIAL, stackSize: 99, tier: 2, color: 0xffee44 },
  233: { id: 233, name: 'Void Shard',    category: ItemCategory.MATERIAL, stackSize: 99, tier: 3, color: 0x9933ff },
  234: { id: 234, name: 'Life Shard',    category: ItemCategory.MATERIAL, stackSize: 99, tier: 1, color: 0x33ff66 },
  235: { id: 235, name: 'Arcane Dust',   category: ItemCategory.MATERIAL, stackSize: 99, tier: 1, color: 0xcc99ff },
  236: { id: 236, name: 'Arcane Anvil',  category: ItemCategory.STATION,  stackSize: 1,  tier: 2, color: 0x7744cc },

  // ── Chant Orbs ─────────────────────────────────────────
  237: { id: 237, name: 'Inferno Chant',  category: ItemCategory.SPECIAL, stackSize: 10, tier: 2, color: 0xff6633 },
  238: { id: 238, name: 'Glacial Chant',  category: ItemCategory.SPECIAL, stackSize: 10, tier: 2, color: 0x66ccff },
  239: { id: 239, name: 'Tempest Chant',  category: ItemCategory.SPECIAL, stackSize: 10, tier: 2, color: 0xffee44 },
  240: { id: 240, name: 'Abyssal Chant',  category: ItemCategory.SPECIAL, stackSize: 10, tier: 3, color: 0x9933ff },
  241: { id: 241, name: 'Verdant Chant',  category: ItemCategory.SPECIAL, stackSize: 10, tier: 1, color: 0x33ff66 },
  243: { id: 243, name: 'Eternal Chant',  category: ItemCategory.SPECIAL, stackSize: 10, tier: 4, color: 0xffd700 },

  // ── Special Items ─────────────────────────────────────
  242: { id: 242, name: 'Mystical Compass', category: ItemCategory.SPECIAL, stackSize: 1, tier: 2, color: 0x66aaff },

  // ── Currency ──────────────────────────────────────────
  250: { id: 250, name: 'Silver Coin', category: ItemCategory.CURRENCY, stackSize: 999, tier: 0, color: 0xccccdd },

  // ── Accessories ───────────────────────────────────────
  300: { id: 300, name: 'Cloud Boots',      category: ItemCategory.ACCESSORY, stackSize: 1, tier: 5, color: 0xddddff },
  301: { id: 301, name: 'Star Compass',     category: ItemCategory.ACCESSORY, stackSize: 1, tier: 5, color: 0xffdd44 },
  302: { id: 302, name: 'Gravity Belt',     category: ItemCategory.ACCESSORY, stackSize: 1, tier: 5, color: 0x8866cc },
  303: { id: 303, name: "Miner's Lantern",  category: ItemCategory.ACCESSORY, stackSize: 1, tier: 5, color: 0xffaa33 },
  304: { id: 304, name: 'Lucky Charm',      category: ItemCategory.ACCESSORY, stackSize: 1, tier: 5, color: 0x44ff88 },
  305: { id: 305, name: 'Celestial Cape',   category: ItemCategory.ACCESSORY, stackSize: 1, tier: 5, color: 0x6688ff },
  306: { id: 306, name: "Explorer's Belt",  category: ItemCategory.ACCESSORY, stackSize: 1, tier: 4, color: 0xcc8844 },

  // ── Decorations ─────────────────────────────────────
  310: { id: 310, name: 'Star Lantern',      category: ItemCategory.BLOCK, stackSize: 99, tier: 0, color: 0xffdd66 },
  311: { id: 311, name: 'Celestial Banner',   category: ItemCategory.BLOCK, stackSize: 99, tier: 0, color: 0x6655cc },
  312: { id: 312, name: 'Starfall Flower',    category: ItemCategory.BLOCK, stackSize: 99, tier: 0, color: 0xff66aa },
  313: { id: 313, name: 'Sky Crystal Lamp',   category: ItemCategory.BLOCK, stackSize: 99, tier: 0, color: 0x44ccff },

  // ── Void Stations ──────────────────────────────────────
  320: { id: 320, name: 'Super Portal',  category: ItemCategory.STATION, stackSize: 1, tier: 5, color: 0x9900ff, tileType: TileType.VOID_PORTAL_BLOCK },
  321: { id: 321, name: 'Void Forge',    category: ItemCategory.STATION, stackSize: 1, tier: 5, color: 0x4a0080, tileType: TileType.NETHER_BRICK },

  // ── Void Weapons ───────────────────────────────────────
  330: { id: 330, name: 'Void Blade',          category: ItemCategory.WEAPON, stackSize: 1, tier: 5, color: 0x9933ff, damage: 85,  weaponStyle: 'melee' as WeaponStyle,  attackSpeed: 280 },
  331: { id: 331, name: 'Abyssal Scythe',      category: ItemCategory.WEAPON, stackSize: 1, tier: 5, color: 0x6600cc, damage: 110, weaponStyle: 'melee' as WeaponStyle,  attackSpeed: 450 },
  332: { id: 332, name: 'Hellfire Bow',        category: ItemCategory.WEAPON, stackSize: 1, tier: 5, color: 0xff4400, damage: 70,  weaponStyle: 'ranged' as WeaponStyle, attackSpeed: 250, projectileSpeed: 500 },
  333: { id: 333, name: 'Void Staff',          category: ItemCategory.WEAPON, stackSize: 1, tier: 5, color: 0xcc00ff, damage: 95,  weaponStyle: 'magic' as WeaponStyle,  attackSpeed: 320, manaCost: 25 },
  334: { id: 334, name: 'Soul Reaver',         category: ItemCategory.WEAPON, stackSize: 1, tier: 5, color: 0x66ccff, damage: 60,  weaponStyle: 'summon' as WeaponStyle, attackSpeed: 800, manaCost: 40 },
  335: { id: 335, name: 'Chaos Edge',          category: ItemCategory.WEAPON, stackSize: 1, tier: 6, color: 0xff00ff, damage: 150, weaponStyle: 'melee' as WeaponStyle,  attackSpeed: 250 },
  336: { id: 336, name: 'Dimensional Rifle',   category: ItemCategory.WEAPON, stackSize: 1, tier: 6, color: 0x00ffcc, damage: 120, weaponStyle: 'ranged' as WeaponStyle, attackSpeed: 200, projectileSpeed: 600 },
  337: { id: 337, name: 'Arcane Annihilator',  category: ItemCategory.WEAPON, stackSize: 1, tier: 6, color: 0xffcc00, damage: 130, weaponStyle: 'magic' as WeaponStyle,  attackSpeed: 270, manaCost: 35 },

  // ── Void Armor (Tier 5) ────────────────────────────────
  340: { id: 340, name: 'Void Helm',     category: ItemCategory.ARMOR, stackSize: 1, tier: 5, color: 0x4a0080, defense: 18, armorSlot: 'helmet' as ArmorSlot },
  341: { id: 341, name: 'Void Suit',     category: ItemCategory.ARMOR, stackSize: 1, tier: 5, color: 0x4a0080, defense: 28, armorSlot: 'chestplate' as ArmorSlot },
  342: { id: 342, name: 'Void Greaves',  category: ItemCategory.ARMOR, stackSize: 1, tier: 5, color: 0x4a0080, defense: 22, armorSlot: 'leggings' as ArmorSlot },
  343: { id: 343, name: 'Void Boots',    category: ItemCategory.ARMOR, stackSize: 1, tier: 5, color: 0x4a0080, defense: 14, armorSlot: 'boots' as ArmorSlot },

  // ── Void Materials ─────────────────────────────────────
  350: { id: 350, name: 'Void Essence',        category: ItemCategory.MATERIAL, stackSize: 99, tier: 5, color: 0x9933ff },
  351: { id: 351, name: 'Hellfire Core',       category: ItemCategory.MATERIAL, stackSize: 99, tier: 5, color: 0xff4400 },
  352: { id: 352, name: 'Soul Fragment',       category: ItemCategory.MATERIAL, stackSize: 99, tier: 5, color: 0x66ccff },
  353: { id: 353, name: 'Chaos Shard',         category: ItemCategory.MATERIAL, stackSize: 50, tier: 5, color: 0xff00ff },
  354: { id: 354, name: 'Abyssal Ingot',       category: ItemCategory.MATERIAL, stackSize: 99, tier: 5, color: 0x4a0080 },
  355: { id: 355, name: 'Dimensional Fabric',  category: ItemCategory.MATERIAL, stackSize: 30, tier: 5, color: 0xcc66ff },

  // ── Void Artifacts (Accessories) ───────────────────────
  360: { id: 360, name: 'Warp Crystal',        category: ItemCategory.ACCESSORY, stackSize: 1, tier: 5, color: 0x00ffcc },
  361: { id: 361, name: 'Soul Lantern',        category: ItemCategory.ACCESSORY, stackSize: 1, tier: 5, color: 0x66ccff },
  362: { id: 362, name: 'Chaos Heart',         category: ItemCategory.ACCESSORY, stackSize: 1, tier: 5, color: 0xff0066 },
  363: { id: 363, name: 'Void Eye',            category: ItemCategory.ACCESSORY, stackSize: 1, tier: 5, color: 0x9933ff },
  364: { id: 364, name: 'Temporal Shard',      category: ItemCategory.ACCESSORY, stackSize: 1, tier: 5, color: 0xffcc00 },
  365: { id: 365, name: 'Dimensional Anchor',  category: ItemCategory.ACCESSORY, stackSize: 1, tier: 5, color: 0xcc6600 },

  // ── Void Special Items ─────────────────────────────────
  370: { id: 370, name: 'Void Lord Summon Token',  category: ItemCategory.SPECIAL, stackSize: 1, tier: 6, color: 0xff00ff },
  380: { id: 380, name: 'Trophy of the Void Lord', category: ItemCategory.SPECIAL, stackSize: 1, tier: 6, color: 0xffcc00 },

  // ── Shard Compasses ──────────────────────────────────
  385: { id: 385, name: 'Ember Shard Compass',  category: ItemCategory.SPECIAL, stackSize: 1, tier: 3, color: 0xff6633 },
  386: { id: 386, name: 'Frost Shard Compass',  category: ItemCategory.SPECIAL, stackSize: 1, tier: 3, color: 0x66ccff },
  387: { id: 387, name: 'Storm Shard Compass',  category: ItemCategory.SPECIAL, stackSize: 1, tier: 3, color: 0xffee44 },
  388: { id: 388, name: 'Void Shard Compass',   category: ItemCategory.SPECIAL, stackSize: 1, tier: 4, color: 0x9933ff },
  389: { id: 389, name: 'Life Shard Compass',   category: ItemCategory.SPECIAL, stackSize: 1, tier: 3, color: 0x33ff66 },

  // ── Boring Drill ───────────────────────────────────────
  420: { id: 420, name: 'Boring Drill', category: ItemCategory.SPECIAL, stackSize: 5, tier: 2, color: 0xcc8844 },

  // ── Tree Chomper ──────────────────────────────────────
  421: { id: 421, name: 'Tree Chomper', category: ItemCategory.TOOL, stackSize: 1, tier: 2, color: 0x4a8c3f, miningSpeed: 3, miningTier: 0 },
}

export function getItemDef(id: number): ItemDef | undefined {
  return ITEMS[id]
}
