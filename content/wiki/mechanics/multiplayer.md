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

1. From the title screen, select **Host Game**.
2. Choose a **difficulty** (Easy, Normal, Hard, or Hardcore). All players in the session play under this difficulty.
3. Enter your **player name**.
4. A **room code** is generated. Share this code with the players you want to join (up to **8 players** total).
5. Your world is now open for other players to join.

The host's world seed, tile changes, and game state are shared with all connected clients. The room code is displayed on the pause screen so you can share it at any time.

## Joining a Game

1. From the title screen, select **Join Game**.
2. Enter the **room code** provided by the host and your **player name**.
3. The connection goes through a two-phase handshake:
   - First, you join the relay room.
   - Then, a JOIN_REQUEST is sent to the host for approval.
4. Once connected, you receive the world seed and any tile changes (deltas) that have occurred since world generation.
5. Your client generates the world from the seed and applies the deltas, so you see the same world as the host.

## What Syncs

### Currently Synced
- **World seed**: All clients generate the same base world.
- **Tile changes**: When any player mines or places a block, the change is broadcast to all players. The host records a tile change history so late-joining players get all deltas.
- **Player positions and animations**: Remote players are visible with interpolated movement, mining/attack animations, and name tags.
- **Enemy positions and states**: The host simulates all enemies and broadcasts their positions at 10 Hz. Clients render enemy sprites based on these snapshots.
- **Boss state**: Boss positions, HP, and phase are synced at 10 Hz.
- **Combat events**: Damage numbers and hit events are synced.
- **Projectiles**: Weapon projectiles are synced at 20 Hz.
- **Dropped items**: Item entities on the ground are synced.
- **Day/night cycle**: Time of day is synced every 5 seconds.
- **Player vitals**: Each client reports their own HP, mana, and alive/dead status.

### Sync Rates

| Data | Update Rate |
|------|-------------|
| Player positions | 50ms (20 Hz) |
| Enemy/Boss state | 100ms (10 Hz) |
| Projectiles | 50ms (20 Hz) |
| Dropped items | 100ms (10 Hz) |
| Day/night | 5 seconds |
| Client status (HP/mana) | 100ms |

### How Remote Players Work
- The host runs lightweight AABB physics simulations for remote players (movement + collision).
- Clients report their position, and the host uses it for physics grounding and water detection.
- Remote player positions are included in regular state broadcasts with interpolation on the client side.
- Action animations (mining, attacking) are synced so you can see what other players are doing.
- Name tags appear above remote players for identification.

## Chat

Press **T** to open the chat overlay. Type your message and press **Enter** to send. All connected players see chat messages. Press **T** or **Escape** to close the chat.

## Reconnection

If your connection drops, the game automatically attempts to reconnect:

- **3 retry attempts** with exponential backoff (2s, 4s, 8s delays).
- If reconnection succeeds, you rejoin seamlessly with your player state preserved.
- If all retries fail, you are returned to the title screen.

A "Reconnecting..." indicator appears while the game attempts to restore your connection.

## Current Limitations

Multiplayer is in development. The following features are not yet fully implemented:

- **Combat authority**: Who "owns" damage calculations for PvE is still being refined. Clients can send attack requests but host-side validation is not complete.
- **Client tile requests**: Clients can mine/place but the authority model for tile changes is being improved.
- **Boss summoning**: Requesting boss summons as a client is not yet fully validated.
- **Disconnect handling**: Basic reconnection works, but player state persistence across disconnects needs refinement.

## Technical Details

- **Max players**: 8 (including host)
- **Protocol version**: 1
- **Server tick rate**: 20 Hz
- **Relay server**: Uses Nuxt's built-in WebSocket server -- no external services needed
- **Heartbeat**: 45-second keepalive to detect dead connections
- **Ping display**: RTT is measured via automatic ping/pong every 2 seconds

## Tips

- The host should have a stable internet connection. All game state flows through the host.
- Multiplayer works best on a local network (LAN) for lowest latency.
- If you experience desync (enemies appearing in wrong positions), the host's view is always correct.
- Coordinate with your team via chat. Call out boss fights, resource locations, and danger zones.
- The host's world is the persistent world. When the host saves, all progress (including client contributions like mined blocks) is saved.
- Clients cannot save the game -- only the host and single-player worlds can be saved.
- The room code is shown on the pause screen, so you can share it with friends at any time.
