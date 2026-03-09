import { TileType } from '../world/TileRegistry'

export enum StationType {
  HAND = 'hand',           // no station needed
  WORKBENCH = 'workbench',
  FURNACE = 'furnace',
  ANVIL = 'anvil',
  TECH_BENCH = 'tech_bench',
  FUSION_STATION = 'fusion_station',
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
  { id: 'vine_beacon',  station: StationType.WORKBENCH,  inputs: [{ itemId: TileType.LEAVES, count: 20 }, { itemId: TileType.WOOD, count: 10 }, { itemId: 105, count: 5 }], output: { itemId: 170, count: 1 } },
  { id: 'plant_fiber',  station: StationType.WORKBENCH,  inputs: [{ itemId: TileType.LEAVES, count: 3 }], output: { itemId: 105, count: 2 } },
  { id: 'healing_herb', station: StationType.WORKBENCH,  inputs: [{ itemId: TileType.LEAVES, count: 5 }, { itemId: 105, count: 2 }], output: { itemId: 190, count: 1 } },

  // ── Furnace ────────────────────────────────────────────
  { id: 'furnace',      station: StationType.WORKBENCH,  inputs: [{ itemId: TileType.STONE, count: 20 }], output: { itemId: 111, count: 1 } },
  { id: 'iron_bar',     station: StationType.FURNACE,    inputs: [{ itemId: TileType.IRON_ORE, count: 3 }], output: { itemId: 100, count: 1 } },
  { id: 'glass',        station: StationType.FURNACE,    inputs: [{ itemId: TileType.SAND, count: 4 }], output: { itemId: 104, count: 1 } },
  { id: 'stone_pick',   station: StationType.FURNACE,    inputs: [{ itemId: TileType.STONE, count: 12 }, { itemId: TileType.WOOD, count: 4 }], output: { itemId: 121, count: 1 } },
  { id: 'stone_sword',  station: StationType.FURNACE,    inputs: [{ itemId: TileType.STONE, count: 10 }, { itemId: TileType.WOOD, count: 3 }], output: { itemId: 131, count: 1 } },

  // ── Anvil ──────────────────────────────────────────────
  { id: 'anvil',        station: StationType.FURNACE,    inputs: [{ itemId: 100, count: 10 }], output: { itemId: 112, count: 1 } },
  { id: 'iron_pick',    station: StationType.ANVIL,      inputs: [{ itemId: 100, count: 8 }, { itemId: TileType.WOOD, count: 4 }], output: { itemId: 122, count: 1 } },
  { id: 'iron_sword',   station: StationType.ANVIL,      inputs: [{ itemId: 100, count: 6 }, { itemId: TileType.WOOD, count: 3 }], output: { itemId: 132, count: 1 } },
  { id: 'iron_bow',     station: StationType.ANVIL,      inputs: [{ itemId: 100, count: 4 }, { itemId: TileType.WOOD, count: 5 }, { itemId: 105, count: 4 }], output: { itemId: 141, count: 1 } },
  { id: 'app_staff',    station: StationType.ANVIL,      inputs: [{ itemId: 100, count: 5 }, { itemId: TileType.DIAMOND_ORE, count: 2 }], output: { itemId: 150, count: 1 } },
  { id: 'drone_totem',  station: StationType.ANVIL,      inputs: [{ itemId: 100, count: 8 }, { itemId: 104, count: 4 }], output: { itemId: 160, count: 1 } },

  // ── Tech Bench ─────────────────────────────────────────
  { id: 'tech_bench',   station: StationType.ANVIL,      inputs: [{ itemId: 101, count: 8 }, { itemId: 100, count: 5 }, { itemId: 104, count: 3 }], output: { itemId: 113, count: 1 } },
  { id: 'diamond',      station: StationType.TECH_BENCH, inputs: [{ itemId: TileType.DIAMOND_ORE, count: 3 }], output: { itemId: 101, count: 1 } },
  { id: 'titanium_bar', station: StationType.TECH_BENCH, inputs: [{ itemId: TileType.TITANIUM_ORE, count: 4 }], output: { itemId: 102, count: 1 } },
  { id: 'dia_pick',     station: StationType.TECH_BENCH, inputs: [{ itemId: 101, count: 6 }, { itemId: 100, count: 3 }], output: { itemId: 123, count: 1 } },
  { id: 'dia_sword',    station: StationType.TECH_BENCH, inputs: [{ itemId: 101, count: 5 }, { itemId: 100, count: 2 }], output: { itemId: 133, count: 1 } },
  { id: 'crys_staff',   station: StationType.TECH_BENCH, inputs: [{ itemId: 101, count: 8 }, { itemId: 102, count: 2 }], output: { itemId: 151, count: 1 } },

  // ── Fusion Station ─────────────────────────────────────
  { id: 'fusion',       station: StationType.TECH_BENCH, inputs: [{ itemId: 102, count: 10 }, { itemId: 101, count: 5 }, { itemId: 104, count: 5 }], output: { itemId: 114, count: 1 } },
  { id: 'carbon_plate', station: StationType.FUSION_STATION, inputs: [{ itemId: TileType.CARBON_FIBER, count: 4 }], output: { itemId: 103, count: 1 } },
  { id: 'ti_pick',      station: StationType.FUSION_STATION, inputs: [{ itemId: 102, count: 8 }, { itemId: 103, count: 2 }], output: { itemId: 124, count: 1 } },
  { id: 'ti_sword',     station: StationType.FUSION_STATION, inputs: [{ itemId: 102, count: 6 }, { itemId: 103, count: 2 }], output: { itemId: 134, count: 1 } },
  { id: 'laser_gun',    station: StationType.FUSION_STATION, inputs: [{ itemId: 102, count: 5 }, { itemId: 103, count: 3 }, { itemId: 101, count: 3 }], output: { itemId: 142, count: 1 } },
  { id: 'swarm_beacon', station: StationType.FUSION_STATION, inputs: [{ itemId: 102, count: 6 }, { itemId: 103, count: 4 }], output: { itemId: 161, count: 1 } },
  { id: 'sig_beacon',   station: StationType.FUSION_STATION, inputs: [{ itemId: 103, count: 10 }, { itemId: 102, count: 5 }, { itemId: 101, count: 5 }], output: { itemId: 171, count: 1 } },
  { id: 'jetpack',      station: StationType.FUSION_STATION, inputs: [
    { itemId: 180, count: 1 }, { itemId: 181, count: 1 }, { itemId: 182, count: 1 },
    { itemId: 183, count: 1 }, { itemId: 184, count: 1 }, { itemId: 185, count: 1 },
  ], output: { itemId: 186, count: 1 } },
]

// Station item ID → StationType mapping
export const STATION_ITEM_MAP: Record<number, StationType> = {
  110: StationType.WORKBENCH,
  111: StationType.FURNACE,
  112: StationType.ANVIL,
  113: StationType.TECH_BENCH,
  114: StationType.FUSION_STATION,
}
