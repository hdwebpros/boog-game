export { MultiplayerManager } from './MultiplayerManager'
export { RoomConnector } from './RoomConnector'
export type { MultiplayerMode, RemotePlayerState } from './MultiplayerManager'
export { NetworkManager } from './NetworkManager'
export { HostSession } from './HostSession'
export { EntityRegistry } from './EntityRegistry'
export type { EntityType, EntityRef } from './EntityRegistry'
export { InputCollector } from './InputCollector'
export { ChatOverlay } from './ChatOverlay'
export { RemotePlayerSim, REMOTE_COL_W, REMOTE_COL_H } from './RemotePlayerSim'
export {
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
  type JoinRequest,
  type ChatMessage,
  type AttackRequest,
  MessageType,
  PROTOCOL_VERSION,
  SERVER_TICK_RATE,
  ENEMY_SYNC_INTERVAL,
  PLAYER_SYNC_INTERVAL,
  MAX_PLAYERS,
  generateEntityId,
  resetEntityIdCounter,
  encodeMessage,
  decodeMessage,
} from './protocol'
