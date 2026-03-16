# Starfall Wiki — Implementation Plan

> Built with Nuxt Content v3 collections, MDC components, Nuxt 4, and Tailwind CSS (neobrutalism style).

## Wiki Category Structure

```
/wiki                          ← Main wiki portal (category tiles, search, tip of the day)
├── /wiki/items                ← All items index (filterable by category)
│   ├── /wiki/items/weapons    ← Weapons index (melee, ranged, magic, summon tabs)
│   │   └── /wiki/items/weapons/iron-sword
│   ├── /wiki/items/tools      ← Pickaxes, etc.
│   │   └── /wiki/items/tools/titanium-pickaxe
│   ├── /wiki/items/armor      ← Armor sets index (by tier)
│   │   └── /wiki/items/armor/diamond-chestplate
│   ├── /wiki/items/materials  ← Ores, bars, drops, shards
│   │   └── /wiki/items/materials/iron-bar
│   ├── /wiki/items/consumables ← Potions, food, healing
│   │   └── /wiki/items/consumables/ironskin-potion
│   ├── /wiki/items/accessories ← Base accessories + void artifacts
│   │   └── /wiki/items/accessories/cloud-boots
│   └── /wiki/items/blocks     ← Placeable blocks & decorations
│       └── /wiki/items/blocks/obsidian
├── /wiki/enemies              ← Bestiary index (by biome/layer)
│   └── /wiki/enemies/rock-golem
├── /wiki/bosses               ← Boss index (progression order)
│   └── /wiki/bosses/crystal-golem
├── /wiki/biomes               ← Biome index (overworld + void)
│   └── /wiki/biomes/desert
├── /wiki/crafting             ← Crafting overview + station pages
│   └── /wiki/crafting/anvil
├── /wiki/skills               ← Skill tree browser
│   └── /wiki/skills/combat
├── /wiki/guides               ← Strategy & how-to guides
│   ├── /wiki/guides/getting-started
│   ├── /wiki/guides/boss-strategies
│   └── /wiki/guides/void-dimension
└── /wiki/mechanics            ← Game systems reference
    ├── /wiki/mechanics/combat
    ├── /wiki/mechanics/enchanting
    ├── /wiki/mechanics/multiplayer
    └── /wiki/mechanics/jetpack
```

---

## Content Collections (content.config.ts)

### Collections

| Collection | Type | Source | Description |
|---|---|---|---|
| `wiki` | `page` | `wiki/**/*.md` | All wiki pages (items, enemies, bosses, etc.) |
| `guides` | `page` | `wiki/guides/**/*.md` | Strategy guides (separate for querying) |

### Schema Fields (wiki collection)

```
category:     enum (item, enemy, boss, biome, crafting, skill, mechanic, guide)
subcategory:  string (weapon, tool, armor, material, consumable, accessory, block)
gameId:       number (item/tile/enemy ID from game data)
tier:         number (0-6, material/progression tier)
tags:         string[] (searchable tags)
icon:         string (sprite filename, e.g. "enemy_rock_golem.png")
stats:        object (flexible key-value for infobox rendering)
craftedAt:    string (station name, for recipe cross-linking)
relatedItems: number[] (IDs for "See Also" / "Used In" links)
```

---

## MDC Components Needed

### Infobox Components (inspired by all 3 wikis)

| Component | Purpose | Used On |
|---|---|---|
| `::item-infobox` | Sidebar with sprite, stats, tier badge, category | Item pages |
| `::enemy-infobox` | HP, damage, AI type, biome, drops table | Enemy pages |
| `::boss-infobox` | Phase stats, summon item, drops, aftermath | Boss pages |
| `::biome-infobox` | Layer range, enemies, resources, structures | Biome pages |
| `::station-infobox` | Recipes available, upgrade materials | Crafting station pages |

### Recipe & Data Components

| Component | Purpose | Inspired By |
|---|---|---|
| `::recipe-box` | Shows inputs → station → output with icons | Minecraft recipe grid |
| `::crafting-tree` | Expandable ingredient hierarchy (recursive) | Terraria crafting trees |
| `::used-in` | "This item is used in..." reverse recipe lookup | Terraria bidirectional crafting |
| `::drop-table` | Item, quantity range, % chance table | All three wikis |
| `::loot-table` | Chest/structure loot with probabilities | Valheim |
| `::stat-table` | Sortable stat comparison table | Valheim sortable tables |
| `::upgrade-table` | Per-level stats + cumulative material totals | Valheim upgrade tables |

### Navigation Components

| Component | Purpose | Inspired By |
|---|---|---|
| `::navbox` | Footer category navigation grid | All three wikis |
| `::item-link` | Inline sprite icon + linked text | Terraria (best-in-class) |
| `::category-grid` | Visual tile grid for index pages | Valheim featured pages |
| `::breadcrumb` | Wiki > Items > Weapons > Iron Sword | Standard |
| `::search-bar` | Full-text search using queryCollectionSearchSections | Standard |
| `::tip-of-the-day` | Randomized gameplay tips on portal page | Valheim |

### Content Components

| Component | Purpose | Inspired By |
|---|---|---|
| `::boss-phases` | Phase transition diagram/timeline | Minecraft state diagrams |
| `::progression-gate` | "Unlocked after defeating [Boss]" badge | Valheim |
| `::version-badge` | Shows when content was added/changed | Minecraft/Terraria |
| `::spoiler` | Collapsible spoiler sections | Standard |
| `::skill-tree` | Interactive skill tree visualization | Custom |

---

## Implementation Phases

### Phase 1 — Scaffold & Core Infrastructure
1. Create `content.config.ts` with wiki + guides collections and Zod schema
2. Create `content/wiki/` directory structure matching category tree above
3. Create `app/pages/wiki/[...slug].vue` catch-all page (uses `queryCollection` + `<ContentRenderer>`)
4. Create `app/pages/wiki/index.vue` portal page
5. Create `app/layouts/wiki.vue` layout with sidebar nav, breadcrumbs, search
6. Basic CSS theme (dark mode, pixel-art accents, game-themed colors)

### Phase 2 — Infobox & Navigation Components
7. Build `::item-infobox` component (reads frontmatter stats, renders sprite + stat table)
8. Build `::enemy-infobox` and `::boss-infobox` components
9. Build `::biome-infobox` component
10. Build `::item-link` inline component (sprite icon + text)
11. Build `::navbox` footer component
12. Build `::breadcrumb` component using route path
13. Build `::category-grid` for index pages

### Phase 3 — Recipe & Data Components
14. Build `::recipe-box` (inputs with icons → station → output)
15. Build `::crafting-tree` (recursive expandable ingredient tree)
16. Build `::used-in` (reverse recipe lookup)
17. Build `::drop-table` and `::loot-table` components
18. Build `::upgrade-table` with cumulative totals
19. Build `::stat-table` (sortable)

### Phase 4 — Content Pages: Items
20. Write a script to generate markdown stubs from `game/data/items.ts`
    - One .md file per item with frontmatter pre-populated from game data
    - Organized into subdirectories by category
21. Manually enrich key items with descriptions, tips, crafting trees
22. Create index pages for each subcategory (weapons, tools, armor, etc.)
    - Filterable/sortable tables using `queryCollection`

### Phase 5 — Content Pages: Enemies & Bosses
23. Generate enemy .md stubs from `game/data/enemies.ts` (28 pages)
24. Generate boss .md stubs from `game/data/bosses.ts` (7 pages)
    - Include phase breakdowns, aftermath sections, strategy links
25. Create bestiary index page with biome/layer filtering
26. Create boss index page in progression order
27. Write boss strategy guide pages in `/wiki/guides/`

### Phase 6 — Content Pages: Biomes & World
28. Write 8 overworld biome pages + 4 void dimension zone pages
    - Atmospheric intro prose + enemy lists + resource lists + loot tables
    - Progression-gated content annotations
29. Write world overview page (layers, dimensions, generation)

### Phase 7 — Content Pages: Crafting, Skills, Mechanics
30. Write 9 crafting station pages with recipe lists (grouped by output category)
31. Write 6 skill branch pages with tree visualization
32. Write mechanics pages: combat, enchanting, multiplayer, jetpack, potions/buffs
33. Write guide pages: getting-started, boss-strategies, void-dimension

### Phase 8 — Search & Polish
34. Implement full-text search using `queryCollectionSearchSections`
35. Build `::tip-of-the-day` with randomized tips array
36. Build `::search-bar` with results dropdown
37. Add `::progression-gate` badges throughout
38. Cross-link all pages (relatedItems, "See Also" sections, navboxes)
39. Mobile-responsive layout adjustments
40. SEO meta tags via `useHead()` from frontmatter

---

## Example Content File

```markdown
---
title: Crystal Staff
description: A tier 4 magic weapon that fires piercing crystal shards.
category: item
subcategory: weapon
gameId: 151
tier: 4
icon: weapon_crystal_staff.png
tags: [magic, weapon, crystal, tier-4, ranged]
stats:
  damage: 35
  weaponStyle: magic
  manaCost: 12
  knockback: 3
  projectileSpeed: 350
craftedAt: Tech Bench
relatedItems: [150, 182, 8]
---

::item-infobox
---
title: Crystal Staff
icon: weapon_crystal_staff.png
---
::

The **Crystal Staff** is a tier 4 :item-link[magic weapon]{id=151} crafted at the
:item-link[Tech Bench]{id=117}. It fires piercing crystal projectiles that pass through
multiple enemies.

## Obtaining

::recipe-box
---
result: 151
station: tech_bench
ingredients: [{id: 8, qty: 15}, {id: 100, qty: 5}, {id: 231, qty: 3}]
---
::

## Used In

::used-in{item=151}
::

## Stats

| Stat | Value |
|------|-------|
| Damage | 35 |
| Mana Cost | 12 |
| Style | Magic |
| Projectile Speed | 350 |
| Knockback | 3 |

## Tips

- Crystal shards pierce through enemies, making it excellent for crowd control.
- Pair with :item-link[Mana Surge potion]{id=407} for sustained DPS.
- The :item-link[Star Compass]{id=301} accessory provides +50 max mana, extending your casting window.

::navbox{category="weapons"}
::
```

---

## File Count Estimates

| Category | Pages | Notes |
|---|---|---|
| Items — Weapons | ~20 | 5 melee + 3 ranged + 2 magic + 2 summon + 8 void |
| Items — Tools | ~5 | 5 pickaxe tiers |
| Items — Armor | ~24 | 5 tiers × 4 slots + 4 void |
| Items — Materials | ~25 | Ores, bars, shards, void materials |
| Items — Consumables | ~20 | 16 potions + food + special |
| Items — Accessories | ~13 | 7 base + 6 artifacts |
| Items — Blocks | ~15 | Key blocks only (not all 61 tiles) |
| Enemies | 28 | One per enemy type |
| Bosses | 7 | One per boss |
| Biomes | 12 | 8 overworld + 4 void zones |
| Crafting Stations | 9 | One per station type |
| Skills | 6 | One per branch + overview |
| Guides | ~6 | Getting started, bosses, void, etc. |
| Mechanics | ~6 | Combat, enchanting, potions, jetpack, etc. |
| Index Pages | ~15 | Category landing pages |
| **Total** | **~210** | |

---

## Styling: Tailwind CSS + Neobrutalism

### Setup
- **@nuxtjs/tailwindcss** module (already installed) — NOT manual PostCSS setup
- Module auto-handles PostCSS, content scanning, CSS injection
- Optional `tailwind.config.ts` in project root for customization
- Config also possible inline via `tailwindcss: { config: {} }` in nuxt.config.ts

### Neobrutalism Design System
The wiki uses a **neobrutalism** aesthetic — bold borders, flat saturated colors, offset shadows.
This is NOT a library dependency — it's ~15 lines of Tailwind utilities applied to our own components.

**Core design tokens (in `tailwind.config.ts` or CSS):**
```css
/* Base neobrutalism utilities */
.neo {
  @apply border-2 border-black shadow-[4px_4px_0_black];
}
.neo:hover {
  @apply shadow-[2px_2px_0_black] translate-x-[2px] translate-y-[2px];
}
.neo:active {
  @apply shadow-none translate-x-1 translate-y-1;
}
```

**Color palette** — flat, saturated game-themed colors:
| Token | Use | Color |
|---|---|---|
| `bg-wiki-surface` | Page/card backgrounds | warm white / dark slate |
| `bg-wiki-primary` | Buttons, active tabs | bright blue |
| `bg-wiki-accent` | Highlights, badges | bright yellow |
| `bg-wiki-danger` | HP, damage, lava | bright red |
| `bg-wiki-success` | Healing, drops, XP | bright green |
| `bg-wiki-magic` | Mana, magic items | purple |
| `bg-wiki-tier-*` | Tier 0-6 item borders | gray → green → blue → purple → orange → red → gold |

**Typography:**
- Headings: pixel/retro font (e.g. Press Start 2P, Silkscreen, or similar)
- Body: clean sans-serif (system font stack or Inter)
- Code/stats: monospace

**Component patterns:**
- Cards/infoboxes: `neo` class + colored top border for category
- Buttons: `neo` + flat color fill + hover push effect
- Tables: alternating row colors, thick header border, no rounded corners
- Navboxes: grid of `neo` pills with sprite icons
- Badges/tags: small `neo` pills with tier colors
- No border-radius anywhere — sharp corners are the aesthetic

### Why NOT a component library
- neobrutalism-components is React-only & unmaintained
- shadcn-vue would be overkill — we're building custom MDC components anyway
- The aesthetic is 3 CSS rules, not a framework dependency
- Our components (infoboxes, recipe boxes, crafting trees) are game-specific — no UI library covers them

---

## Technical Notes

- **Nuxt Content v3 only** — collections in `content.config.ts`, `queryCollection()`, `<ContentRenderer>`
- **No v2 APIs** — no `queryContent`, no `<ContentDoc>`, no `_dir.yml`
- **@nuxtjs/tailwindcss module** — NOT manual Tailwind/PostCSS setup
- **Neobrutalism** — hand-rolled with Tailwind utilities, no external component library
- **Sprites** already exist in `public/sprites/` — reference directly in infoboxes
- **Game data** can be imported into a generation script to auto-populate frontmatter
- **queryCollectionSearchSections** for wiki-wide search with heading-based sections
- **Dark mode** — game-themed dark palette as default, with neobrutalist borders in lighter accent color
- MDC components go in `app/components/content/` for auto-registration
