---
title: Multiplayer
description: How multiplayer works in Starfall - hosting, joining, syncing, and chat.
category: mechanic
tags: [mechanic, multiplayer, networking, co-op, hosting]
---

# Multiplayer Mechanics

Starfall features a **Valheim-style player-hosted multiplayer** system. One player acts as the host (server authority), and other players join their world via a room code. This page explains how multiplayer works and what to expect.

**Note:** Multiplayer is currently in active development. Some features described here may be incomplete or subject to change.

## Architecture

Starfall uses a **host-authoritative** model:

- **Host**: One player runs the game as the host. Their machine simulates the world, enemies, physics, and is the source of truth for game state.
- **Clients**: Other players connect to the host via WebSocket. They receive world data and send their inputs to the host for processing.
- **Relay Server**: The game uses Nuxt's built-in WebSocket server as a relay for connections. No external servers or dependencies are required.

## Hosting a Game

1. Start the game normally.
2. Open the multiplayer menu.
3. Select **Host Game**.
4. A **room code** is generated. Share this code with the players you want to join.
5. Your world is now open for other players to join.

The host's world seed, tile changes, and game state are shared with all connected clients.

## Joining a Game

1. Start the game.
2. Open the multiplayer menu.
3. Select **Join Game**.
4. Enter the **room code** provided by the host.
5. The connection goes through a two-phase handshake:
   - First, you join the relay room.
   - Then, a JOIN_REQUEST is sent to the host for approval.
6. Once connected, you receive the world seed and any tile changes (deltas) that have occurred since world generation.
7. Your client generates the world from the seed and applies the deltas, so you see the same world as the host.

## What Syncs

### Currently Synced
- **World seed**: All clients generate the same base world.
- **Tile changes**: When any player mines or places a block, the change is broadcast to all players. The host records a tile change history.
- **Player positions**: Remote players are visible as characters moving around the world.
- **Enemy positions and states**: The host simulates all enemies and broadcasts their positions. Clients render enemy sprites based on these snapshots.
- **Combat events**: Damage numbers and hit events are synced.

### How Remote Players Work
- The host runs lightweight AABB physics simulations for remote players (movement + collision).
- Remote player positions are included in regular state broadcasts.
- All clients see all connected players moving in real-time.

## Chat

Press **T** to open the chat overlay. Type your message and press **Enter** to send. All connected players see chat messages. Press **T** or **Escape** to close the chat.

## Current Limitations

Multiplayer is in development. The following features are not yet fully implemented:

- **Combat authority**: Who "owns" damage calculations for PvE is still being refined.
- **Client tile requests**: Clients can mine/place but the authority model for tile changes is being improved.
- **Boss summoning**: Requesting boss summons as a client is not yet implemented.
- **Dropped items**: Item drops are not yet synced between players.
- **Disconnect handling**: Graceful reconnection after connection loss is not yet complete.

## Tips

- The host should have a stable internet connection. All game state flows through the host.
- Multiplayer works best on a local network (LAN) for lowest latency.
- If you experience desync (enemies appearing in wrong positions), the host's view is always correct.
- Coordinate with your team via chat. Call out boss fights, resource locations, and danger zones.
- The host's world is the persistent world. When the host saves, all progress (including client contributions like mined blocks) is saved.
