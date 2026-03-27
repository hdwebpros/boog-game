---
title: Jetpack
description: How the jetpack works in Starfall - assembly, flight mechanics, fuel, and the ending trigger.
category: mechanic
icon: item_186.png
tags: [mechanic, jetpack, flight, fuel, ending, bosses]
---

# Jetpack Mechanics

The Jetpack is the central goal of Starfall. Assembling it from 6 boss-dropped components and using it to escape the planet is how you complete the main game.

## Obtaining the Jetpack

### Step 1: Defeat All 6 Bosses

Each boss drops one unique jetpack component:

| Boss | Component Dropped |
|------|-------------------|
| Vine Guardian | Fuel Cell Casing |
| Deep Sea Leviathan | Thrust Regulator |
| Crystal Golem | Pressure Valve |
| Magma Wyrm | Energy Capacitor |
| Core Sentinel | Ignition Core |
| Mothership | Navigation Module |

Components are special items (stack size 1). You need all 6 to assemble the jetpack. See the [Boss Strategy Guide](/wiki/guides/boss-strategies) for details on each fight.

### Step 2: Assemble at Fusion Station

Bring all 6 components to a **Fusion Station** and press **C** to open crafting. The Jetpack recipe requires:

- 1 Fuel Cell Casing
- 1 Thrust Regulator
- 1 Pressure Valve
- 1 Energy Capacitor
- 1 Ignition Core
- 1 Navigation Module

Craft to receive the **Jetpack** item (ID 186).

### Step 3: Equip

The Jetpack is equipped as a special item. Once in your inventory, it activates automatically.

## Flight Controls

| Action | Control |
|--------|---------|
| Fly upward | Hold **Space** while airborne |
| Move while flying | **A/D** or **Left/Right Arrow** to move horizontally while holding Space |
| Stop flying | Release **Space** |
| Land | Release Space and touch the ground |

**Important:** You must already be in the air (jumping or falling) before the jetpack activates. You cannot activate it while standing on the ground. Jump first (press Space), then hold Space to engage the jetpack thrusters.

## Fuel System

The jetpack runs on fuel, displayed as a **fuel bar** on the HUD.

- **Flying drains fuel** at a constant rate while Space is held in the air.
- **Landing recharges fuel.** When you stand on solid ground, the fuel bar refills over time.
- If fuel runs out mid-flight, the jetpack cuts off and you fall. Make sure to land before the bar empties completely.

### Fuel Conservation

Several upgrades reduce fuel consumption:

| Source | Fuel Reduction |
|--------|---------------|
| Fuel Saver skill (Mobility branch, tier 2) | -40% fuel use |
| Gravity Belt accessory | -40% fuel use |

These bonuses stack. With both Fuel Saver and Gravity Belt, fuel consumption is drastically reduced, allowing much longer flights.

### Flight Speed

Base flight speed can be increased:

| Source | Speed Bonus |
|--------|------------|
| Gravity Belt accessory | +20% flight speed |

## The Ending Trigger

The main game ends when you reach **y < 32** (very high altitude) with the jetpack. When you fly above this threshold:

1. The game detects your altitude.
2. The **EndingScene** triggers automatically.
3. A credits sequence plays showing your escape from the planet.
4. After the ending, you return to your world to continue playing (endgame content becomes available).

### How High Is y < 32?

The world is 1600 tiles tall. The surface is at approximately y=100. y=32 is well above the Cloud City (y=60). You need sustained flight from the highest accessible point upward. With a full fuel bar and basic fuel management, this is easily achievable.

### Reaching the Top

**Strategy for the escape flight:**
1. Go to Cloud City (y=60) or the highest point you can reach.
2. Make sure your fuel bar is full (stand on ground for a few seconds).
3. Jump and immediately hold Space.
4. Fly straight up. You only need to reach y=32, which is about 28 tiles above Cloud City.
5. The ending triggers automatically when you cross the threshold.

## Post-Jetpack Content

After escaping once, the game continues:
- You return to your world with all items and progress.
- The **Super Portal** recipe unlocks at the Fusion Station, giving access to the **Void Dimension**.
- The overworld continues to function normally until you visit the Void (after which enemy spawn rates increase 20x).
- The **Void Lord** true final boss becomes accessible after visiting the void.

## Tips

- Do not panic if your fuel runs out. You fall, take fall damage (mitigated by Cloud Boots or Feather Fall skill), and can try again once fuel recharges.
- The Gravity Belt is the single most important accessory for jetpack use: -40% fuel and +20% speed.
- You can fly horizontally to explore the surface quickly. The jetpack is not just for going up -- it is a fast travel tool.
- Build tall pillars or towers near your base as "launch pads" so you start your flights from a higher altitude.
- The jetpack works in both the overworld and the Void Dimension.
