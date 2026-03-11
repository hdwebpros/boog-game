/**
 * Host session manager — runs on the host player's game.
 * Manages connected clients, validates inputs, broadcasts state.
 *
 * This is NOT a separate server process — it runs inside the host's Phaser game.
 * The Nitro WebSocket server just relays messages to/from this.
 */

import {
  type NetworkMessage,
  type InputState,
  type TileChangeRequest,
  type PlayerSnapshot,
  type EnemySnapshot,
  type BossSnapshot,
  type DroppedItemSnapshot,
  type CombatEvent,
  type JoinAccepted,
  type JoinRejected,
  MessageType,
  PROTOCOL_VERSION,
  MAX_PLAYERS,
  SERVER_TICK_RATE,
  ENEMY_SYNC_INTERVAL,
  PLAYER_SYNC_INTERVAL,
  encodeMessage,
  decodeMessage,
} from './protocol'
import type { EntityRegistry } from './EntityRegistry'

export interface RemotePlayer {
  id: number
  name: string
  ws: any  // WebSocket reference (browser or server)
  lastInput: InputState | null
  snapshot: PlayerSnapshot
  joinedAt: number
}

export class HostSession {
  private players = new Map<number, RemotePlayer>()
  private nextPlayerId = 1
  private _hostPlayerId = 0
  private broadcastFn: ((msg: string, excludeId?: number) => void) | null = null
  private tileChanges: TileChangeRequest[] = []
  /** Persistent history of all tile changes (for joining players) */
  private allTileChanges: TileChangeRequest[] = []
  private syncTimers = {
    player: 0,
    enemy: 0,
    boss: 0,
  }

  // World state references (set by WorldScene)
  seed = ''
  worldWidth = 0
  worldHeight = 0

  get hostPlayerId(): number { return this._hostPlayerId }
  get playerCount(): number { return this.players.size + 1 } // +1 for host
  get remotePlayers(): RemotePlayer[] { return Array.from(this.players.values()) }

  /** Initialize host session. Returns the host player ID. */
  init(seed: string, worldWidth: number, worldHeight: number): number {
    this.seed = seed
    this.worldWidth = worldWidth
    this.worldHeight = worldHeight
    this._hostPlayerId = this.nextPlayerId++
    return this._hostPlayerId
  }

  /** Set the broadcast function (called by WebSocket server setup) */
  setBroadcast(fn: (msg: string, excludeId?: number) => void) {
    this.broadcastFn = fn
  }

  /** Handle a message from a remote client */
  handleMessage(msg: NetworkMessage, sendFn: (response: string) => void): NetworkMessage | null {
    switch (msg.type) {
      case MessageType.JOIN_REQUEST:
        return this.handleJoinRequest(msg, sendFn)

      case MessageType.PLAYER_INPUT:
        return this.handlePlayerInput(msg)

      case MessageType.TILE_CHANGE:
        return this.handleTileChange(msg)

      case MessageType.PING:
        sendFn(encodeMessage({
          type: MessageType.PONG,
          senderId: 0,
          data: msg.data,
        }))
        return null

      case MessageType.CHAT_MESSAGE:
        // Relay chat to all
        this.broadcast({
          type: MessageType.CHAT_MESSAGE,
          senderId: msg.senderId,
          data: msg.data,
        })
        return null

      case MessageType.BOSS_SUMMON:
        // Forward to WorldScene for validation
        return msg

      default:
        return null
    }
  }

  /** Handle a player joining */
  private handleJoinRequest(
    msg: NetworkMessage,
    sendFn: (response: string) => void
  ): NetworkMessage | null {
    const req = msg.data as { playerName: string; protocolVersion: number }

    // Version check
    if (req.protocolVersion !== PROTOCOL_VERSION) {
      sendFn(encodeMessage({
        type: MessageType.JOIN_REJECTED,
        senderId: 0,
        data: { reason: `Protocol version mismatch. Expected ${PROTOCOL_VERSION}, got ${req.protocolVersion}` } satisfies JoinRejected,
      }))
      return null
    }

    // Player limit
    if (this.playerCount >= MAX_PLAYERS) {
      sendFn(encodeMessage({
        type: MessageType.JOIN_REJECTED,
        senderId: 0,
        data: { reason: 'Session is full' } satisfies JoinRejected,
      }))
      return null
    }

    const playerId = this.nextPlayerId++
    const player: RemotePlayer = {
      id: playerId,
      name: req.playerName,
      ws: null,
      lastInput: null,
      snapshot: {
        id: playerId,
        name: req.playerName,
        x: 0, y: 0, vx: 0, vy: 0,
        hp: 100, maxHp: 100,
        mana: 100, maxMana: 100,
        facingRight: true,
        dead: false,
        isInWater: false,
        hasJetpack: false,
        lastInputSeq: 0,
      },
      joinedAt: Date.now(),
    }
    this.players.set(playerId, player)

    // Return the join message — WorldScene will fill in world state and send accept
    return {
      type: MessageType.JOIN_REQUEST,
      senderId: playerId,
      data: { ...req, _sendFn: sendFn, _playerId: playerId },
    }
  }

  /** Handle player input from remote */
  private handlePlayerInput(msg: NetworkMessage): NetworkMessage | null {
    const player = this.players.get(msg.senderId)
    if (!player) return null
    player.lastInput = msg.data as InputState
    return msg // Forward to WorldScene for processing
  }

  /** Handle tile change request — validates and records */
  private handleTileChange(msg: NetworkMessage): NetworkMessage | null {
    const change = msg.data as TileChangeRequest
    // Basic bounds check
    if (change.tx < 0 || change.tx >= this.worldWidth ||
        change.ty < 0 || change.ty >= this.worldHeight) {
      return null
    }
    this.tileChanges.push(change)
    this.allTileChanges.push(change)
    return msg // Forward to WorldScene for full validation
  }

  /** Remove a disconnected player */
  removePlayer(playerId: number) {
    this.players.delete(playerId)
    this.broadcast({
      type: MessageType.PLAYER_LEFT,
      senderId: 0,
      data: { playerId },
    })
  }

  /** Get the last input for a remote player */
  getPlayerInput(playerId: number): InputState | null {
    return this.players.get(playerId)?.lastInput ?? null
  }

  /** Update player snapshot (called by WorldScene after simulation) */
  updatePlayerSnapshot(playerId: number, snapshot: Partial<PlayerSnapshot>) {
    const player = this.players.get(playerId)
    if (player) {
      Object.assign(player.snapshot, snapshot)
    }
  }

  /** Record a tile change made by the host player (for joining players) */
  recordLocalTileChange(change: TileChangeRequest) {
    this.allTileChanges.push(change)
  }

  /** Get all tile changes since world gen (for JoinAccepted) */
  getAllTileChanges(): TileChangeRequest[] {
    return this.allTileChanges
  }

  /** Get accumulated tile changes and clear the buffer */
  consumeTileChanges(): TileChangeRequest[] {
    const changes = this.tileChanges
    this.tileChanges = []
    return changes
  }

  /** Broadcast a message to all connected clients */
  broadcast(msg: NetworkMessage, excludeId?: number) {
    if (this.broadcastFn) {
      this.broadcastFn(encodeMessage(msg), excludeId)
    }
  }

  /** Send to a specific player */
  sendTo(playerId: number, msg: NetworkMessage, sendFn?: (data: string) => void) {
    if (sendFn) {
      sendFn(encodeMessage(msg))
    }
  }

  /** Periodic state sync — call from WorldScene.update() */
  syncTick(
    dt: number,
    playerSnapshots: PlayerSnapshot[],
    enemySnapshots: EnemySnapshot[],
    bossSnapshot: BossSnapshot | null,
    droppedItems: DroppedItemSnapshot[],
    dayNightTime: number,
  ) {
    // Player positions (high frequency)
    this.syncTimers.player += dt * 1000
    if (this.syncTimers.player >= PLAYER_SYNC_INTERVAL) {
      this.syncTimers.player = 0
      this.broadcast({
        type: MessageType.PLAYER_STATE,
        senderId: 0,
        data: playerSnapshots,
      })
    }

    // Enemy state (medium frequency)
    this.syncTimers.enemy += dt * 1000
    if (this.syncTimers.enemy >= ENEMY_SYNC_INTERVAL) {
      this.syncTimers.enemy = 0
      this.broadcast({
        type: MessageType.ENEMY_SYNC,
        senderId: 0,
        data: enemySnapshots,
      })
    }

    // Boss state (same as enemies)
    if (bossSnapshot) {
      this.broadcast({
        type: MessageType.BOSS_SYNC,
        senderId: 0,
        data: bossSnapshot,
      })
    }
  }

  /** Clean up */
  destroy() {
    this.players.clear()
    this.broadcastFn = null
    this.tileChanges = []
    this.allTileChanges = []
  }
}
