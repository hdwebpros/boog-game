/**
 * Multiplayer protocol — shared types for client ↔ server communication.
 *
 * Architecture: Valheim-style player-hosted.
 * - Host runs authoritative world state
 * - Clients send input actions, receive state updates
 * - Relaxed authority for movement (client-predicted), strict for tiles/combat/loot
 */

// ── Entity IDs ────────────────────────────────────────────

let _nextEntityId = 1

export function generateEntityId(): number {
  return _nextEntityId++
}

export function resetEntityIdCounter(start = 1) {
  _nextEntityId = start
}

// ── Message Types ─────────────────────────────────────────

export enum MessageType {
  // Connection
  JOIN_REQUEST     = 1,
  JOIN_ACCEPTED    = 2,
  JOIN_REJECTED    = 3,
  PLAYER_JOINED    = 4,
  PLAYER_LEFT      = 5,
  PING             = 6,
  PONG             = 7,

  // Input (client → host)
  PLAYER_INPUT     = 10,
  TILE_CHANGE      = 11,
  CRAFT_REQUEST    = 12,
  ITEM_DROP        = 13,
  BOSS_SUMMON      = 14,
  CHAT_MESSAGE     = 15,
  ATTACK_REQUEST   = 16,

  // State (host → clients)
  WORLD_SEED       = 20,
  TILE_UPDATE      = 21,
  PLAYER_STATE     = 22,
  ENEMY_SYNC       = 23,
  BOSS_SYNC        = 24,
  PROJECTILE_SYNC  = 25,
  DROPPED_ITEM_SYNC = 26,
  COMBAT_EVENT     = 27,
  DAY_NIGHT_SYNC   = 28,
  ENTITY_SPAWN     = 29,
  ENTITY_DESPAWN   = 30,

  // Full state (for joining players)
  WORLD_CHUNK_DATA = 40,
  FULL_STATE_BEGIN = 41,
  FULL_STATE_END   = 42,
}

// ── Input Actions ─────────────────────────────────────────

export interface InputState {
  left: boolean
  right: boolean
  up: boolean
  down: boolean
  jump: boolean
  /** World-space cursor position */
  cursorX: number
  cursorY: number
  /** Mouse buttons */
  lmb: boolean
  rmb: boolean
  /** Sequence number for reconciliation */
  seq: number
  /** Delta time this input applies to */
  dt: number
}

export interface TileChangeRequest {
  tx: number
  ty: number
  newType: number  // TileType enum
  oldType: number  // for validation
}

export interface CraftRequest {
  recipeIndex: number
}

export interface ItemDropRequest {
  slotArea: 'hotbar' | 'main'
  slotIndex: number
  count: number
}

export interface BossSummonRequest {
  bossType: string
  altarTx: number
  altarTy: number
}

export interface ChatMessage {
  text: string
}

export interface AttackRequest {
  /** Attacker position (from RemotePlayerSim on host) */
  x: number
  y: number
  /** World-space cursor target */
  cursorX: number
  cursorY: number
  /** Weapon info */
  weaponStyle: 'melee' | 'ranged' | 'magic' | 'summon'
  damage: number
  color: number
  projectileSpeed?: number
  manaCost?: number
  attackSpeed?: number
  facingRight: boolean
}

// ── State Snapshots ───────────────────────────────────────

export interface PlayerSnapshot {
  id: number
  name: string
  x: number
  y: number
  vx: number
  vy: number
  hp: number
  maxHp: number
  mana: number
  maxMana: number
  facingRight: boolean
  dead: boolean
  isInWater: boolean
  hasJetpack: boolean
  /** Input sequence last processed (for client reconciliation) */
  lastInputSeq: number
}

export interface EnemySnapshot {
  id: number
  type: string      // EnemyType enum key (e.g. 'space_slug')
  x: number
  y: number
  vx: number
  vy: number
  hp: number
  alive: boolean
  facingRight: boolean
  intangible: boolean
}

export interface BossSnapshot {
  id: number
  type: string       // BossType enum
  x: number
  y: number
  vx: number
  vy: number
  hp: number
  maxHp: number
  alive: boolean
  phaseIndex: number
  shieldActive: boolean
}

export interface ProjectileSnapshot {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  color: number
  fromPlayer: boolean
  ownerId: number    // player or enemy who fired
}

export interface DroppedItemSnapshot {
  id: number
  x: number
  y: number
  itemId: number
  count: number
}

export interface CombatEvent {
  type: 'damage' | 'heal' | 'death' | 'knockback'
  targetType?: 'player' | 'enemy'
  targetId: number
  sourceId: number
  amount: number
  x: number
  y: number
  kbx?: number
  kby?: number
  color?: number
}

// ── Network Messages ──────────────────────────────────────

export interface NetworkMessage {
  type: MessageType
  /** Sender's player ID (0 for host/server) */
  senderId: number
  /** Message payload */
  data: any
}

// ── Join / Session ────────────────────────────────────────

export interface JoinRequest {
  playerName: string
  /** Protocol version for compat check */
  protocolVersion: number
}

export interface JoinAccepted {
  playerId: number
  hostName: string
  seed: string
  worldWidth: number
  worldHeight: number
  dayNightTime: number
  /** Tile modifications since world gen (delta only) */
  tileChanges: TileChangeRequest[]
  /** All current players */
  players: PlayerSnapshot[]
  /** All current enemies */
  enemies: EnemySnapshot[]
  /** Active boss if any */
  boss: BossSnapshot | null
  /** Placed stations */
  stations: { tx: number; ty: number; itemId: number }[]
}

export interface JoinRejected {
  reason: string
}

// ── Session Config ────────────────────────────────────────

export const PROTOCOL_VERSION = 1

/** Tick rate for state broadcasts (Hz) */
export const SERVER_TICK_RATE = 20

/** How often to send full enemy sync (ms) */
export const ENEMY_SYNC_INTERVAL = 100

/** How often to send player positions (ms) */
export const PLAYER_SYNC_INTERVAL = 50

/** Max players per session */
export const MAX_PLAYERS = 8

/** Chunk size for streaming tile data */
export const TILE_CHUNK_SIZE = 32

// ── Serialization helpers ─────────────────────────────────

export function encodeMessage(msg: NetworkMessage): string {
  return JSON.stringify(msg)
}

export function decodeMessage(raw: string): NetworkMessage | null {
  try {
    return JSON.parse(raw) as NetworkMessage
  } catch {
    return null
  }
}
