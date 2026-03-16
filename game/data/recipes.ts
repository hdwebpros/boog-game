import { TileType } from '../world/TileRegistry'

export enum StationType {
  HAND = 'hand',           // no station needed
  WORKBENCH = 'workbench',
  WORKBENCH_2 = 'workbench_2',
  FURNACE = 'furnace',
  ANVIL = 'anvil',
  TECH_BENCH = 'tech_bench',
  FUSION_STATION = 'fusion_station',
  ARCANE_ANVIL = 'arcane_anvil',
  VOID_FORGE = 'void_forge',
  BREWING_STAND = 'brewing_stand',
}

export interface Recipe {
  id: string
  station: StationType
  inputs: { itemId: number; count: number }[]
  output: { itemId: number; count: number }
}

export const RECIPES: Recipe[] = [
  // ── Hand (no station) ──────────────────────────────────
  { id: 'torch',        station: StationType.HAND, inputs: [{ itemId: TileType.WOOD, count: 1 }, { itemId: 105, count: 1 }], output: { itemId: 106, count: 4 } },

  // ── Workbench ──────────────────────────────────────────
  { id: 'workbench',    station: StationType.HAND,      inputs: [{ itemId: TileType.WOOD, count: 10 }], output: { itemId: 110, count: 1 } },
  { id: 'wood_pick',    station: StationType.WORKBENCH,  inputs: [{ itemId: TileType.WOOD, count: 8 }],  output: { itemId: 120, count: 1 } },
  { id: 'wood_sword',   station: StationType.WORKBENCH,  inputs: [{ itemId: TileType.WOOD, count: 7 }],  output: { itemId: 130, count: 1 } },
  { id: 'wood_bow',     station: StationType.WORKBENCH,  inputs: [{ itemId: TileType.WOOD, count: 6 }, { itemId: 105, count: 3 }], output: { itemId: 140, count: 1 } },
  // Boss summon items removed — bosses are now summoned at altars with ingredients
  { id: 'plant_fiber',  station: StationType.WORKBENCH,  inputs: [{ itemId: TileType.LEAVES, count: 3 }], output: { itemId: 105, count: 2 } },
  { id: 'vine_rope',   station: StationType.WORKBENCH,  inputs: [{ itemId: 105, count: 3 }, { itemId: TileType.WOOD, count: 2 }], output: { itemId: TileType.VINE, count: 8 } },
  { id: 'healing_herb', station: StationType.WORKBENCH,  inputs: [{ itemId: TileType.LEAVES, count: 5 }, { itemId: 105, count: 2 }], output: { itemId: 190, count: 1 } },
  { id: 'wood_helmet',  station: StationType.WORKBENCH,  inputs: [{ itemId: TileType.WOOD, count: 8 }], output: { itemId: 200, count: 1 } },
  { id: 'wood_chest',   station: StationType.WORKBENCH,  inputs: [{ itemId: TileType.WOOD, count: 12 }], output: { itemId: 201, count: 1 } },
  { id: 'wood_legs',    station: StationType.WORKBENCH,  inputs: [{ itemId: TileType.WOOD, count: 10 }], output: { itemId: 202, count: 1 } },
  { id: 'wood_boots',   station: StationType.WORKBENCH,  inputs: [{ itemId: TileType.WOOD, count: 6 }], output: { itemId: 203, count: 1 } },
  { id: 'chest',        station: StationType.WORKBENCH,  inputs: [{ itemId: TileType.WOOD, count: 15 }], output: { itemId: 116, count: 1 } },

  // ── Workbench Mk2 ────────────────────────────────────────
  { id: 'workbench_2',  station: StationType.WORKBENCH,  inputs: [{ itemId: TileType.WOOD, count: 15 }, { itemId: TileType.STONE, count: 10 }], output: { itemId: 115, count: 1 } },
  { id: 'furnace',      station: StationType.WORKBENCH_2, inputs: [{ itemId: TileType.STONE, count: 20 }], output: { itemId: 111, count: 1 } },
  { id: 'stone_pick',   station: StationType.WORKBENCH_2, inputs: [{ itemId: TileType.STONE, count: 12 }, { itemId: TileType.WOOD, count: 4 }], output: { itemId: 121, count: 1 } },
  { id: 'stone_sword',  station: StationType.WORKBENCH_2, inputs: [{ itemId: TileType.STONE, count: 10 }, { itemId: TileType.WOOD, count: 3 }], output: { itemId: 131, count: 1 } },
  { id: 'stone_helmet', station: StationType.WORKBENCH_2, inputs: [{ itemId: TileType.STONE, count: 10 }, { itemId: TileType.WOOD, count: 3 }], output: { itemId: 204, count: 1 } },
  { id: 'stone_chest',  station: StationType.WORKBENCH_2, inputs: [{ itemId: TileType.STONE, count: 15 }, { itemId: TileType.WOOD, count: 4 }], output: { itemId: 205, count: 1 } },
  { id: 'stone_legs',   station: StationType.WORKBENCH_2, inputs: [{ itemId: TileType.STONE, count: 12 }, { itemId: TileType.WOOD, count: 3 }], output: { itemId: 206, count: 1 } },
  { id: 'stone_boots',  station: StationType.WORKBENCH_2, inputs: [{ itemId: TileType.STONE, count: 8 }, { itemId: TileType.WOOD, count: 2 }], output: { itemId: 207, count: 1 } },

  // ── Furnace ────────────────────────────────────────────
  { id: 'iron_bar',     station: StationType.FURNACE,    inputs: [{ itemId: TileType.IRON_ORE, count: 3 }], output: { itemId: 100, count: 1 } },
  { id: 'glass',        station: StationType.FURNACE,    inputs: [{ itemId: TileType.SAND, count: 4 }], output: { itemId: 104, count: 1 } },

  // ── Anvil ──────────────────────────────────────────────
  { id: 'anvil',        station: StationType.FURNACE,    inputs: [{ itemId: 100, count: 10 }], output: { itemId: 112, count: 1 } },
  { id: 'iron_pick',    station: StationType.ANVIL,      inputs: [{ itemId: 100, count: 8 }, { itemId: TileType.WOOD, count: 4 }], output: { itemId: 122, count: 1 } },
  { id: 'iron_sword',   station: StationType.ANVIL,      inputs: [{ itemId: 100, count: 6 }, { itemId: TileType.WOOD, count: 3 }], output: { itemId: 132, count: 1 } },
  { id: 'iron_bow',     station: StationType.ANVIL,      inputs: [{ itemId: 100, count: 4 }, { itemId: TileType.WOOD, count: 5 }, { itemId: 105, count: 4 }], output: { itemId: 141, count: 1 } },
  { id: 'app_staff',    station: StationType.ANVIL,      inputs: [{ itemId: 100, count: 5 }, { itemId: TileType.DIAMOND_ORE, count: 2 }], output: { itemId: 150, count: 1 } },
  { id: 'drone_totem',  station: StationType.ANVIL,      inputs: [{ itemId: 100, count: 8 }, { itemId: 104, count: 4 }], output: { itemId: 160, count: 1 } },
  // Crystal Lens recipe removed — Crystal Golem summoned at altar
  { id: 'rebreather',   station: StationType.ANVIL,      inputs: [{ itemId: TileType.CORAL, count: 30 }, { itemId: TileType.SAND, count: 20 }, { itemId: 104, count: 5 }, { itemId: 100, count: 3 }], output: { itemId: 192, count: 1 } },
  { id: 'iron_helmet',  station: StationType.ANVIL,      inputs: [{ itemId: 100, count: 6 }, { itemId: TileType.WOOD, count: 2 }], output: { itemId: 208, count: 1 } },
  { id: 'iron_chest',   station: StationType.ANVIL,      inputs: [{ itemId: 100, count: 10 }, { itemId: TileType.WOOD, count: 3 }], output: { itemId: 209, count: 1 } },
  { id: 'iron_legs',    station: StationType.ANVIL,      inputs: [{ itemId: 100, count: 8 }, { itemId: TileType.WOOD, count: 2 }], output: { itemId: 210, count: 1 } },
  { id: 'iron_boots',   station: StationType.ANVIL,      inputs: [{ itemId: 100, count: 5 }, { itemId: TileType.WOOD, count: 1 }], output: { itemId: 211, count: 1 } },
  { id: 'forcefield_potion', station: StationType.ANVIL, inputs: [{ itemId: 100, count: 3 }, { itemId: 104, count: 2 }, { itemId: TileType.LEAVES, count: 5 }], output: { itemId: 193, count: 1 } },

  // ── Brewing Stand (crafted at Workbench Mk2) ────────────
  { id: 'brewing_stand', station: StationType.WORKBENCH_2, inputs: [{ itemId: TileType.STONE, count: 15 }, { itemId: 100, count: 3 }, { itemId: 104, count: 2 }], output: { itemId: 118, count: 1 } },

  // ── Potions (crafted at Brewing Stand) ──────────────────
  // Tier 0: basic ingredients
  { id: 'swiftness_potion',    station: StationType.BREWING_STAND, inputs: [{ itemId: TileType.CACTUS, count: 3 }, { itemId: 105, count: 2 }],                                   output: { itemId: 401, count: 3 } },
  { id: 'night_owl_potion',    station: StationType.BREWING_STAND, inputs: [{ itemId: TileType.MUSHROOM_BLOCK, count: 3 }, { itemId: 105, count: 2 }],                             output: { itemId: 403, count: 3 } },
  { id: 'featherfall_potion',  station: StationType.BREWING_STAND, inputs: [{ itemId: TileType.CLOUD_BLOCK, count: 5 }, { itemId: TileType.LEAVES, count: 3 }],                    output: { itemId: 404, count: 3 } },

  // Tier 1: iron-level ingredients
  { id: 'ironskin_potion',     station: StationType.BREWING_STAND, inputs: [{ itemId: 100, count: 2 }, { itemId: TileType.STONE, count: 5 }],                                     output: { itemId: 400, count: 3 } },
  { id: 'regen_potion',        station: StationType.BREWING_STAND, inputs: [{ itemId: TileType.CRYSTAL_LIFE, count: 2 }, { itemId: 105, count: 3 }],                               output: { itemId: 406, count: 3 } },
  { id: 'mana_surge_potion',   station: StationType.BREWING_STAND, inputs: [{ itemId: TileType.CRYSTAL, count: 2 }, { itemId: TileType.MUSHROOM_BLOCK, count: 3 }],                output: { itemId: 407, count: 3 } },
  { id: 'spelunker_potion',    station: StationType.BREWING_STAND, inputs: [{ itemId: TileType.CRYSTAL_EMBER, count: 1 }, { itemId: TileType.CRYSTAL_FROST, count: 1 }, { itemId: 104, count: 2 }], output: { itemId: 402, count: 3 } },
  { id: 'water_walking_potion', station: StationType.BREWING_STAND, inputs: [{ itemId: TileType.CORAL, count: 5 }, { itemId: TileType.ICE, count: 3 }],                            output: { itemId: 409, count: 3 } },
  { id: 'archery_potion',      station: StationType.BREWING_STAND, inputs: [{ itemId: TileType.CACTUS, count: 3 }, { itemId: TileType.JUNGLE_GRASS, count: 3 }],                   output: { itemId: 411, count: 3 } },
  { id: 'mining_potion',       station: StationType.BREWING_STAND, inputs: [{ itemId: TileType.IRON_ORE, count: 3 }, { itemId: TileType.MOSS, count: 5 }],                         output: { itemId: 413, count: 3 } },

  // Tier 2: diamond-level ingredients
  { id: 'rage_potion',         station: StationType.BREWING_STAND, inputs: [{ itemId: TileType.CRYSTAL_EMBER, count: 2 }, { itemId: 100, count: 2 }],                              output: { itemId: 405, count: 3 } },
  { id: 'thorns_potion',       station: StationType.BREWING_STAND, inputs: [{ itemId: TileType.CACTUS, count: 5 }, { itemId: 100, count: 3 }],                                    output: { itemId: 408, count: 3 } },
  { id: 'giant_potion',        station: StationType.BREWING_STAND, inputs: [{ itemId: TileType.CRYSTAL_LIFE, count: 3 }, { itemId: TileType.MUSHROOM_BLOCK, count: 5 }],           output: { itemId: 410, count: 3 } },
  { id: 'magic_power_potion',  station: StationType.BREWING_STAND, inputs: [{ itemId: TileType.CRYSTAL_STORM, count: 2 }, { itemId: TileType.CRYSTAL, count: 3 }],                 output: { itemId: 412, count: 3 } },
  { id: 'endurance_potion',    station: StationType.BREWING_STAND, inputs: [{ itemId: TileType.CRYSTAL_FROST, count: 2 }, { itemId: TileType.OBSIDIAN, count: 3 }],                output: { itemId: 414, count: 3 } },

  // Tier 3: rare ingredients
  { id: 'wrath_potion',        station: StationType.BREWING_STAND, inputs: [{ itemId: TileType.CRYSTAL_VOID, count: 2 }, { itemId: TileType.CRYSTAL_EMBER, count: 2 }, { itemId: 101, count: 1 }], output: { itemId: 415, count: 3 } },

  // ── Tech Bench ─────────────────────────────────────────
  { id: 'tech_bench',   station: StationType.ANVIL,      inputs: [{ itemId: 101, count: 8 }, { itemId: 100, count: 5 }, { itemId: 104, count: 3 }], output: { itemId: 113, count: 1 } },
  { id: 'diamond',      station: StationType.FURNACE,    inputs: [{ itemId: TileType.DIAMOND_ORE, count: 3 }], output: { itemId: 101, count: 1 } },
  { id: 'titanium_bar', station: StationType.TECH_BENCH, inputs: [{ itemId: TileType.TITANIUM_ORE, count: 4 }], output: { itemId: 102, count: 1 } },
  { id: 'dia_pick',     station: StationType.TECH_BENCH, inputs: [{ itemId: 101, count: 6 }, { itemId: 100, count: 3 }], output: { itemId: 123, count: 1 } },
  { id: 'dia_sword',    station: StationType.TECH_BENCH, inputs: [{ itemId: 101, count: 5 }, { itemId: 100, count: 2 }], output: { itemId: 133, count: 1 } },
  { id: 'crys_staff',   station: StationType.TECH_BENCH, inputs: [{ itemId: 101, count: 8 }, { itemId: 102, count: 2 }], output: { itemId: 151, count: 1 } },
  // Magma Core recipe removed — Magma Wyrm summoned at altar
  { id: 'dia_helmet',   station: StationType.TECH_BENCH, inputs: [{ itemId: 101, count: 5 }, { itemId: 100, count: 2 }], output: { itemId: 212, count: 1 } },
  { id: 'dia_chest',    station: StationType.TECH_BENCH, inputs: [{ itemId: 101, count: 8 }, { itemId: 100, count: 3 }], output: { itemId: 213, count: 1 } },
  { id: 'dia_legs',     station: StationType.TECH_BENCH, inputs: [{ itemId: 101, count: 6 }, { itemId: 100, count: 2 }], output: { itemId: 214, count: 1 } },
  { id: 'dia_boots',    station: StationType.TECH_BENCH, inputs: [{ itemId: 101, count: 4 }, { itemId: 100, count: 1 }], output: { itemId: 215, count: 1 } },

  // ── Fusion Station ─────────────────────────────────────
  { id: 'fusion',       station: StationType.TECH_BENCH, inputs: [{ itemId: 102, count: 10 }, { itemId: 101, count: 5 }, { itemId: 104, count: 5 }], output: { itemId: 114, count: 1 } },
  { id: 'carbon_plate', station: StationType.FUSION_STATION, inputs: [{ itemId: TileType.CARBON_FIBER, count: 4 }], output: { itemId: 103, count: 1 } },
  { id: 'ti_pick',      station: StationType.FUSION_STATION, inputs: [{ itemId: 102, count: 8 }, { itemId: 103, count: 2 }], output: { itemId: 124, count: 1 } },
  { id: 'ti_sword',     station: StationType.FUSION_STATION, inputs: [{ itemId: 102, count: 6 }, { itemId: 103, count: 2 }], output: { itemId: 134, count: 1 } },
  { id: 'laser_gun',    station: StationType.FUSION_STATION, inputs: [{ itemId: 102, count: 5 }, { itemId: 103, count: 3 }, { itemId: 101, count: 3 }], output: { itemId: 142, count: 1 } },
  { id: 'swarm_beacon', station: StationType.FUSION_STATION, inputs: [{ itemId: 102, count: 6 }, { itemId: 103, count: 4 }], output: { itemId: 161, count: 1 } },
  // Void Sigil + Signal Beacon recipes removed — bosses summoned at altars
  { id: 'ti_helmet',    station: StationType.FUSION_STATION, inputs: [{ itemId: 102, count: 6 }, { itemId: 103, count: 2 }], output: { itemId: 216, count: 1 } },
  { id: 'ti_chest',     station: StationType.FUSION_STATION, inputs: [{ itemId: 102, count: 10 }, { itemId: 103, count: 4 }], output: { itemId: 217, count: 1 } },
  { id: 'ti_legs',      station: StationType.FUSION_STATION, inputs: [{ itemId: 102, count: 8 }, { itemId: 103, count: 3 }], output: { itemId: 218, count: 1 } },
  { id: 'ti_boots',     station: StationType.FUSION_STATION, inputs: [{ itemId: 102, count: 5 }, { itemId: 103, count: 2 }], output: { itemId: 219, count: 1 } },
  { id: 'jetpack',      station: StationType.FUSION_STATION, inputs: [
    { itemId: 180, count: 1 }, { itemId: 181, count: 1 }, { itemId: 182, count: 1 },
    { itemId: 183, count: 1 }, { itemId: 184, count: 1 }, { itemId: 185, count: 1 },
  ], output: { itemId: 186, count: 1 } },

  // ── Portal (crafted at Tech Bench) ────────────────────
  { id: 'portal', station: StationType.TECH_BENCH, inputs: [{ itemId: 101, count: 10 }, { itemId: 102, count: 5 }, { itemId: TileType.OBSIDIAN, count: 20 }], output: { itemId: 117, count: 1 } },

  // ── Arcane Anvil (crafted at Anvil) ───────────────────
  { id: 'arcane_anvil', station: StationType.ANVIL, inputs: [{ itemId: 100, count: 8 }, { itemId: 101, count: 4 }, { itemId: 235, count: 5 }], output: { itemId: 236, count: 1 } },

  // ── Chant Orbs (crafted at Arcane Anvil) ──────────────
  { id: 'inferno_chant',  station: StationType.ARCANE_ANVIL, inputs: [{ itemId: 230, count: 5 }, { itemId: 235, count: 3 }], output: { itemId: 237, count: 1 } },
  { id: 'glacial_chant',  station: StationType.ARCANE_ANVIL, inputs: [{ itemId: 231, count: 5 }, { itemId: 235, count: 3 }], output: { itemId: 238, count: 1 } },
  { id: 'tempest_chant',  station: StationType.ARCANE_ANVIL, inputs: [{ itemId: 232, count: 5 }, { itemId: 235, count: 3 }], output: { itemId: 239, count: 1 } },
  { id: 'abyssal_chant',  station: StationType.ARCANE_ANVIL, inputs: [{ itemId: 233, count: 5 }, { itemId: 235, count: 3 }], output: { itemId: 240, count: 1 } },
  { id: 'verdant_chant',  station: StationType.ARCANE_ANVIL, inputs: [{ itemId: 234, count: 5 }, { itemId: 235, count: 3 }], output: { itemId: 241, count: 1 } },
  { id: 'eternal_chant',  station: StationType.ARCANE_ANVIL, inputs: [{ itemId: 237, count: 1 }, { itemId: 238, count: 1 }, { itemId: 239, count: 1 }, { itemId: 240, count: 1 }, { itemId: 241, count: 1 }], output: { itemId: 243, count: 1 } },

  // ── Mystical Compass (crafted at Arcane Anvil) ───────
  { id: 'mystical_compass', station: StationType.ARCANE_ANVIL, inputs: [{ itemId: 235, count: 8 }, { itemId: 101, count: 3 }, { itemId: 100, count: 5 }], output: { itemId: 242, count: 1 } },

  // ── Super Portal (crafted at Fusion Station) ────────
  { id: 'super_portal', station: StationType.FUSION_STATION, inputs: [{ itemId: TileType.OBSIDIAN, count: 99 }, { itemId: 235, count: 40 }, { itemId: 102, count: 30 }], output: { itemId: 320, count: 1 } },

  // ── Void Forge (crafted at Fusion Station) ──────────
  { id: 'void_forge', station: StationType.FUSION_STATION, inputs: [{ itemId: TileType.BRIMSTONE, count: 20 }, { itemId: 351, count: 10 }], output: { itemId: 321, count: 1 } },

  // ── Void Forge Recipes ──────────────────────────────
  { id: 'abyssal_ingot',       station: StationType.VOID_FORGE, inputs: [{ itemId: 350, count: 5 }, { itemId: 351, count: 3 }], output: { itemId: 354, count: 1 } },
  { id: 'dimensional_fabric',  station: StationType.VOID_FORGE, inputs: [{ itemId: 353, count: 3 }, { itemId: 354, count: 2 }], output: { itemId: 355, count: 1 } },
  { id: 'void_blade',          station: StationType.VOID_FORGE, inputs: [{ itemId: 354, count: 8 }, { itemId: 352, count: 10 }], output: { itemId: 330, count: 1 } },
  { id: 'abyssal_scythe',      station: StationType.VOID_FORGE, inputs: [{ itemId: 354, count: 12 }, { itemId: 353, count: 5 }], output: { itemId: 331, count: 1 } },
  { id: 'hellfire_bow',        station: StationType.VOID_FORGE, inputs: [{ itemId: 351, count: 10 }, { itemId: 354, count: 6 }], output: { itemId: 332, count: 1 } },
  { id: 'void_staff',          station: StationType.VOID_FORGE, inputs: [{ itemId: 353, count: 8 }, { itemId: 352, count: 15 }], output: { itemId: 333, count: 1 } },
  { id: 'soul_reaver',         station: StationType.VOID_FORGE, inputs: [{ itemId: 352, count: 20 }, { itemId: 355, count: 3 }], output: { itemId: 334, count: 1 } },
  { id: 'chaos_edge',          station: StationType.VOID_FORGE, inputs: [{ itemId: 355, count: 5 }, { itemId: 353, count: 10 }, { itemId: 354, count: 15 }], output: { itemId: 335, count: 1 } },
  { id: 'dimensional_rifle',   station: StationType.VOID_FORGE, inputs: [{ itemId: 355, count: 5 }, { itemId: 351, count: 15 }, { itemId: 354, count: 10 }], output: { itemId: 336, count: 1 } },
  { id: 'arcane_annihilator',  station: StationType.VOID_FORGE, inputs: [{ itemId: 355, count: 5 }, { itemId: 353, count: 15 }, { itemId: 352, count: 20 }], output: { itemId: 337, count: 1 } },
  { id: 'void_helmet',         station: StationType.VOID_FORGE, inputs: [{ itemId: 354, count: 6 }, { itemId: 352, count: 5 }], output: { itemId: 340, count: 1 } },
  { id: 'void_chestplate',     station: StationType.VOID_FORGE, inputs: [{ itemId: 354, count: 10 }, { itemId: 355, count: 2 }], output: { itemId: 341, count: 1 } },
  { id: 'void_leggings',       station: StationType.VOID_FORGE, inputs: [{ itemId: 354, count: 8 }, { itemId: 352, count: 8 }], output: { itemId: 342, count: 1 } },
  { id: 'void_boots',          station: StationType.VOID_FORGE, inputs: [{ itemId: 354, count: 5 }, { itemId: 352, count: 4 }], output: { itemId: 343, count: 1 } },
  { id: 'void_lord_summon',    station: StationType.VOID_FORGE, inputs: [{ itemId: 353, count: 10 }, { itemId: 355, count: 3 }, { itemId: 354, count: 5 }], output: { itemId: 370, count: 1 } },
]

// Station item ID → StationType mapping
export const STATION_ITEM_MAP: Record<number, StationType> = {
  110: StationType.WORKBENCH,
  111: StationType.FURNACE,
  112: StationType.ANVIL,
  113: StationType.TECH_BENCH,
  114: StationType.FUSION_STATION,
  115: StationType.WORKBENCH_2,
  118: StationType.BREWING_STAND,
  236: StationType.ARCANE_ANVIL,
  321: StationType.VOID_FORGE,
}
