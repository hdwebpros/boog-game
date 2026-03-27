/**
 * Main multiplayer manager — orchestrates networking for WorldScene.
 *
 * Modes:
 * - 'offline': Single-player (no networking, backward-compatible)
 * - 'host': This player hosts the session and runs authoritative simulation
 * - 'client': This player is a remote client connected to a host
 */

import Phaser from 'phaser'
import { NetworkManager } from './NetworkManager'
import { HostSession } from './HostSession'
import { EntityRegistry } from './EntityRegistry'
import { InputCollector } from './InputCollector'
import {
  type NetworkMessage,
  type InputState,
  type PlayerSnapshot,
  type EnemySnapshot,
  type BossSnapshot,
  type DroppedItemSnapshot,
  type ProjectileSnapshot,
  type TileChangeRequest,
  type JoinAccepted,
  type CombatEvent,
  type AttackRequest,
  type ClientStatus,
  MessageType,
  PLAYER_SYNC_INTERVAL,
} from './protocol'

export type MultiplayerMode = 'offline' | 'host' | 'client'

/** Interpolation state for rendering remote players */
export interface RemotePlayerState {
  id: number
  name: string
  x: number
  y: number
  prevX: number
  prevY: number
  targetX: number
  targetY: number
  vx: number
  vy: number
  hp: number
  maxHp: number
  facingRight: boolean
  dead: boolean
  actionAnim: string
  weaponStyle: string
  interpT: number
  sprite: Phaser.GameObjects.Image | null
  nameText: Phaser.GameObjects.Text | null
}

export class MultiplayerManager {
  private _mode: MultiplayerMode = 'offline'
  private network: NetworkManager | null = null
  private host: HostSession | null = null
  private scene: Phaser.Scene | null = null

  /** Entity registry — used in all modes for consistent ID tracking */
  readonly entities = new EntityRegistry()

  /** Input collector for local player */
  private inputCollector: InputCollector | null = null

  /** Remote players visible in the world */
  private _remotePlayers = new Map<number, RemotePlayerState>()

  /** Local player ID */
  private _localPlayerId = 0

  /** Host's player ID and name (stored on client for chat display) */
  private _hostPlayerId = 0
  private _hostName = 'Host'

  /** Pending tile changes from remote (for client mode) */
  private pendingTileChanges: TileChangeRequest[] = []

  /** Pending enemy snapshots from host (for client mode) */
  private pendingEnemySync: EnemySnapshot[] | null = null

  /** Pending boss snapshot from host (for client mode) */
  private pendingBossSync: BossSnapshot | null = null

  /** Pending combat events from host (for client mode) */
  private pendingCombatEvents: CombatEvent[] = []

  /** Pending dropped item snapshots from host (for client mode) */
  private pendingDroppedItemSync: DroppedItemSnapshot[] | null = null

  /** Pending projectile snapshots from host (for client mode) */
  private pendingProjectileSync: ProjectileSnapshot[] | null = null

  /** Pending day/night time from host (for client mode) */
  private pendingDayNightTime: number | null = null

  /** Pending local player correction from host (for client mode) */
  private pendingLocalPlayerCorrection: PlayerSnapshot | null = null

  /** Pending item pickups from host (for client mode) */
  private pendingItemPickups: { itemId: number; count: number; enchantment?: string }[] = []

  /** Pending chest contents from host (for client mode) */
  private pendingChestContents: { tx: number; ty: number; items: any[] } | null = null

  /** Chat messages (ring buffer, last 50) */
  private chatMessages: { senderId: number; name: string; text: string; time: number }[] = []

  /** Callback to WorldScene for handling host messages */
  onHostMessage: ((msg: NetworkMessage) => void) | null = null
  /** Callback when disconnected from host (client mode) — only fires after all reconnect attempts fail */
  onDisconnected: ((reason: string) => void) | null = null
  /** Callback when reconnection is being attempted */
  onReconnecting: ((attempt: number, maxAttempts: number) => void) | null = null
  /** Callback when reconnection succeeds */
  onReconnected: (() => void) | null = null

  get mode(): MultiplayerMode { return this._mode }
  get isOnline(): boolean { return this._mode !== 'offline' }
  get isHost(): boolean { return this._mode === 'host' }
  get isClient(): boolean { return this._mode === 'client' }
  get localPlayerId(): number { return this._localPlayerId }
  get remotePlayers(): Map<number, RemotePlayerState> { return this._remotePlayers }
  get ping(): number { return this.network?.ping ?? 0 }
  get playerCount(): number {
    if (this._mode === 'host') return (this.host?.playerCount ?? 1)
    if (this._mode === 'client') return this._remotePlayers.size + 1
    return 1
  }
  get chat(): typeof this.chatMessages { return this.chatMessages }

  /** Initialize for single-player (default) */
  initOffline() {
    this._mode = 'offline'
    this._localPlayerId = 1
    this.entities.clear()
  }

  /** Initialize as host */
  initHost(scene: Phaser.Scene, seed: string, worldWidth: number, worldHeight: number) {
    this._mode = 'host'
    this.scene = scene
    this.host = new HostSession()
    this._localPlayerId = this.host.init(seed, worldWidth, worldHeight)
    this.entities.clear()
    this.inputCollector = new InputCollector(scene)
  }

  /** Initialize as client and connect to host */
  async initClient(scene: Phaser.Scene, url: string, playerName: string, roomCode: string): Promise<JoinAccepted> {
    this._mode = 'client'
    this.scene = scene
    this.network = new NetworkManager()
    this.entities.clear()
    this.inputCollector = new InputCollector(scene)

    // Set up message handlers before connecting
    this.setupClientHandlers()
    this.setupReconnectHandlers()

    const joinData = await this.network.connect(url, playerName, roomCode)
    this._localPlayerId = joinData.playerId
    this._hostPlayerId = 1  // host is always player 1
    this._hostName = joinData.hostName

    return joinData
  }

  /** Initialize as client from an already-connected NetworkManager (used when BootScene handles connection) */
  initClientFromExisting(scene: Phaser.Scene, network: NetworkManager, joinData: JoinAccepted) {
    this._mode = 'client'
    this.scene = scene
    this.network = network
    this._localPlayerId = joinData.playerId
    this._hostPlayerId = 1  // host is always player 1
    this._hostName = joinData.hostName
    this.entities.clear()
    this.inputCollector = new InputCollector(scene)
    this.setupClientHandlers()
    this.setupReconnectHandlers()
  }

  /** Get the host session (only valid in host mode) */
  getHostSession(): HostSession | null {
    return this.host
  }

  /** Get the network manager (only valid in client mode) */
  getNetwork(): NetworkManager | null {
    return this.network
  }

  /** Collect local input this frame */
  collectInput(dt: number): InputState | null {
    if (!this.inputCollector) return null
    return this.inputCollector.sample(dt)
  }

  /** Send local input to host (client mode only) */
  sendInput(input: InputState) {
    if (this._mode === 'client' && this.network) {
      this.network.queueInput(input)
    }
  }

  /** Send a tile change (client mode: request to host; host mode: broadcast to clients) */
  sendTileChange(change: TileChangeRequest) {
    if (this._mode === 'client' && this.network) {
      this.network.sendTileChange(change)
    } else if (this._mode === 'host' && this.host) {
      // Host applies immediately and broadcasts
      this.host.broadcast({
        type: MessageType.TILE_UPDATE,
        senderId: 0,
        data: change,
      })
    }
  }

  /** Send chat message */
  sendChat(text: string) {
    if (this._mode === 'client' && this.network) {
      // Add locally so sender sees their own message immediately
      this.addChatMessage(this._localPlayerId, 'You', text)
      this.network.sendChat(text)
    } else if (this._mode === 'host' && this.host) {
      this.addChatMessage(this._localPlayerId, 'Host', text)
      this.host.broadcast({
        type: MessageType.CHAT_MESSAGE,
        senderId: this._localPlayerId,
        data: { text },
      })
    }
  }

  /** Send attack request to host (client mode only) */
  sendAttack(attack: AttackRequest) {
    if (this._mode === 'client' && this.network) {
      this.network.sendAttack(attack)
    }
  }

  /** Send boss summon request to host (client mode only) */
  sendBossSummon(bossType: string, altarTx: number, altarTy: number) {
    if (this._mode === 'client' && this.network) {
      this.network.sendBossSummon(bossType, altarTx, altarTy)
    }
  }

  /** Send item drop to host (client mode only) */
  sendItemDrop(itemId: number, count: number) {
    if (this._mode === 'client' && this.network) {
      this.network.sendItemDrop(itemId, count)
    }
  }

  /** Send chest request to host (client mode only) */
  sendChestRequest(tx: number, ty: number, action: 'open' | 'close', items?: (any | null)[]) {
    if (this._mode === 'client' && this.network) {
      this.network.sendChestRequest(tx, ty, action, items)
    }
  }

  /** Send client vitals/position to host (client mode only) */
  sendClientStatus(status: ClientStatus) {
    if (this._mode === 'client' && this.network) {
      this.network.sendClientStatus(status)
    }
  }

  /** Broadcast state to clients (host mode only) */
  broadcastState(
    dt: number,
    playerSnapshots: PlayerSnapshot[],
    enemySnapshots: EnemySnapshot[],
    bossSnapshot: BossSnapshot | null,
    droppedItems: DroppedItemSnapshot[],
    projectiles: ProjectileSnapshot[],
    dayNightTime: number,
  ) {
    if (this._mode !== 'host' || !this.host) return
    this.host.syncTick(dt, playerSnapshots, enemySnapshots, bossSnapshot, droppedItems, projectiles, dayNightTime)
  }

  /** Broadcast a combat event (host → clients) */
  broadcastCombatEvent(event: CombatEvent) {
    if (this._mode !== 'host' || !this.host) return
    this.host.broadcast({
      type: MessageType.COMBAT_EVENT,
      senderId: 0,
      data: event,
    })
  }

  /** Consume pending tile changes (client mode) */
  consumeTileChanges(): TileChangeRequest[] {
    const changes = this.pendingTileChanges
    this.pendingTileChanges = []
    return changes
  }

  /** Consume pending enemy sync data (client mode) */
  consumeEnemySync(): EnemySnapshot[] | null {
    const data = this.pendingEnemySync
    this.pendingEnemySync = null
    return data
  }

  /** Consume pending boss sync data (client mode) */
  consumeBossSync(): BossSnapshot | null {
    const data = this.pendingBossSync
    this.pendingBossSync = null
    return data
  }

  /** Consume pending combat events (client mode) */
  consumeCombatEvents(): CombatEvent[] {
    const events = this.pendingCombatEvents
    this.pendingCombatEvents = []
    return events
  }

  /** Consume pending dropped item sync data (client mode) */
  consumeDroppedItemSync(): DroppedItemSnapshot[] | null {
    const data = this.pendingDroppedItemSync
    this.pendingDroppedItemSync = null
    return data
  }

  /** Consume pending projectile sync data (client mode) */
  consumeProjectileSync(): ProjectileSnapshot[] | null {
    const data = this.pendingProjectileSync
    this.pendingProjectileSync = null
    return data
  }

  /** Consume pending day/night time (client mode) */
  consumeDayNightTime(): number | null {
    const data = this.pendingDayNightTime
    this.pendingDayNightTime = null
    return data
  }

  /** Consume pending local player correction (client mode) */
  consumeLocalPlayerCorrection(): PlayerSnapshot | null {
    const data = this.pendingLocalPlayerCorrection
    this.pendingLocalPlayerCorrection = null
    return data
  }

  /** Consume pending item pickups (client mode) */
  consumeItemPickups(): { itemId: number; count: number; enchantment?: string }[] {
    const data = this.pendingItemPickups
    this.pendingItemPickups = []
    return data
  }

  /** Consume pending chest contents (client mode) */
  consumeChestContents(): { tx: number; ty: number; items: any[] } | null {
    const data = this.pendingChestContents
    this.pendingChestContents = null
    return data
  }

  /** Update remote player interpolation (call each frame) */
  updateRemotePlayers(dt: number) {
    for (const [, rp] of this._remotePlayers) {
      // Interpolate toward target position
      rp.interpT += dt * (1000 / PLAYER_SYNC_INTERVAL)
      const t = Math.min(1, rp.interpT)
      rp.x = rp.prevX + (rp.targetX - rp.prevX) * t
      rp.y = rp.prevY + (rp.targetY - rp.prevY) * t

      // Update sprite position and action animation texture
      if (rp.sprite) {
        rp.sprite.x = rp.x
        rp.sprite.y = rp.y
        rp.sprite.setFlipX(!rp.facingRight)
        rp.sprite.setAlpha(rp.dead ? 0.3 : 1)

        // Swap texture for action animations
        let desiredTex = ''
        if (rp.actionAnim === 'mining') {
          desiredTex = 'player_mine1'
        } else if (rp.actionAnim === 'attacking') {
          desiredTex = 'player_attack1'
        } else if (Math.abs(rp.vx) > 1) {
          desiredTex = 'player_idle1' // walk uses same base
        } else {
          desiredTex = 'player_idle1'
        }
        if (desiredTex && rp.sprite.texture.key !== desiredTex && rp.sprite.scene.textures.exists(desiredTex)) {
          rp.sprite.setTexture(desiredTex)
          // Action sprites are 48x64, idle is 32x64 — rescale
          const frame = rp.sprite.scene.textures.getFrame(desiredTex)
          if (frame) {
            rp.sprite.setScale(16 / frame.width, 32 / frame.height)
          }
        }
      }
      if (rp.nameText) {
        rp.nameText.setPosition(rp.x, rp.y - 24)
      }
    }
  }

  /** Create sprite for a remote player */
  createRemotePlayerSprite(id: number, scene: Phaser.Scene) {
    const rp = this._remotePlayers.get(id)
    if (!rp || rp.sprite) return

    const texKey = scene.textures.exists('player_idle1') ? 'player_idle1' : 'player'
    rp.sprite = scene.add.image(rp.x, rp.y, texKey)
    rp.sprite.setOrigin(0.5, 0.5)
    rp.sprite.setDepth(10)
    // Scale to match local player (16x32 display)
    const frame = scene.textures.getFrame(texKey)
    if (frame) {
      rp.sprite.setScale(16 / frame.width, 32 / frame.height)
    }
    // Tint slightly to differentiate
    rp.sprite.setTint(0xaaddff)

    rp.nameText = scene.add.text(rp.x, rp.y - 24, rp.name, {
      fontSize: '10px',
      color: '#aaddff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(100)
  }

  /** Remove sprite for a remote player */
  removeRemotePlayerSprite(id: number) {
    const rp = this._remotePlayers.get(id)
    if (!rp) return
    if (rp.sprite) { rp.sprite.destroy(); rp.sprite = null }
    if (rp.nameText) { rp.nameText.destroy(); rp.nameText = null }
  }

  /** Per-frame update */
  update(dt: number) {
    if (this._mode === 'client' && this.network) {
      this.network.update(dt)
    }
    this.updateRemotePlayers(dt)
  }

  /** Add a chat message to the buffer */
  addChatMessage(senderId: number, name: string, text: string) {
    this.chatMessages.push({ senderId, name, text, time: Date.now() })
    if (this.chatMessages.length > 50) {
      this.chatMessages.shift()
    }
  }

  /** Set up client-side message handlers */
  private setupClientHandlers() {
    if (!this.network) return

    // Player state updates (includes local player correction)
    this.network.on(MessageType.PLAYER_STATE, (msg) => {
      const snapshots = msg.data as PlayerSnapshot[]
      for (const snap of snapshots) {
        if (snap.id === this._localPlayerId) {
          // Store for position/HP correction (Fix #13)
          this.pendingLocalPlayerCorrection = snap
          continue
        }

        let rp = this._remotePlayers.get(snap.id)
        if (!rp) {
          rp = {
            id: snap.id,
            name: snap.name,
            x: snap.x, y: snap.y,
            prevX: snap.x, prevY: snap.y,
            targetX: snap.x, targetY: snap.y,
            vx: snap.vx, vy: snap.vy,
            hp: snap.hp, maxHp: snap.maxHp,
            facingRight: snap.facingRight,
            dead: snap.dead,
            actionAnim: snap.actionAnim ?? '',
            weaponStyle: snap.weaponStyle ?? '',
            interpT: 0,
            sprite: null,
            nameText: null,
          }
          this._remotePlayers.set(snap.id, rp)
          if (this.scene) {
            this.createRemotePlayerSprite(snap.id, this.scene)
          }
        } else {
          rp.prevX = rp.x
          rp.prevY = rp.y
          rp.targetX = snap.x
          rp.targetY = snap.y
          rp.vx = snap.vx
          rp.vy = snap.vy
          rp.hp = snap.hp
          rp.maxHp = snap.maxHp
          rp.facingRight = snap.facingRight
          rp.dead = snap.dead
          rp.actionAnim = snap.actionAnim ?? ''
          rp.weaponStyle = snap.weaponStyle ?? ''
          rp.interpT = 0
        }
      }
    })

    // Tile updates
    this.network.on(MessageType.TILE_UPDATE, (msg) => {
      this.pendingTileChanges.push(msg.data as TileChangeRequest)
    })

    // Enemy sync
    this.network.on(MessageType.ENEMY_SYNC, (msg) => {
      this.pendingEnemySync = msg.data as EnemySnapshot[]
    })

    // Boss sync
    this.network.on(MessageType.BOSS_SYNC, (msg) => {
      this.pendingBossSync = msg.data as BossSnapshot
    })

    // Combat events
    this.network.on(MessageType.COMBAT_EVENT, (msg) => {
      this.pendingCombatEvents.push(msg.data as CombatEvent)
    })

    // Dropped item sync (Fix #1)
    this.network.on(MessageType.DROPPED_ITEM_SYNC, (msg) => {
      this.pendingDroppedItemSync = msg.data as DroppedItemSnapshot[]
    })

    // Projectile sync (Fix #2)
    this.network.on(MessageType.PROJECTILE_SYNC, (msg) => {
      this.pendingProjectileSync = msg.data as ProjectileSnapshot[]
    })

    // Day/night sync (Fix #6)
    this.network.on(MessageType.DAY_NIGHT_SYNC, (msg) => {
      this.pendingDayNightTime = (msg.data as { time: number }).time
    })

    // Player join notification
    this.network.on(MessageType.PLAYER_JOINED, (msg) => {
      const data = msg.data as PlayerSnapshot
      this.addChatMessage(0, 'System', `${data.name} joined the game`)
    })

    // Player leave notification
    this.network.on(MessageType.PLAYER_LEFT, (msg) => {
      const { playerId, reason } = msg.data
      if (playerId === this._localPlayerId) {
        // We were disconnected — but if reconnecting, don't kick to menu
        if (this.network && this.network.state === 'reconnecting') return
        this.onDisconnected?.(reason ?? 'Disconnected')
        return
      }
      const rp = this._remotePlayers.get(playerId)
      if (rp) {
        this.addChatMessage(0, 'System', `${rp.name} left the game`)
        this.removeRemotePlayerSprite(playerId)
        this._remotePlayers.delete(playerId)
      }
    })

    // Chat (skip own messages — already added locally in sendChat)
    this.network.on(MessageType.CHAT_MESSAGE, (msg) => {
      if (msg.senderId === this._localPlayerId) return
      const rp = this._remotePlayers.get(msg.senderId)
      const name = rp?.name ?? (msg.senderId === this._hostPlayerId ? this._hostName : 'Unknown')
      this.addChatMessage(msg.senderId, name, msg.data.text)
    })

    // Item pickup notification (host → client)
    this.network.on(MessageType.ITEM_PICKUP, (msg) => {
      const data = msg.data as { playerId: number; itemId: number; count: number; enchantment?: string }
      if (data.playerId === this._localPlayerId) {
        this.pendingItemPickups.push({ itemId: data.itemId, count: data.count, enchantment: data.enchantment })
      }
    })

    // Chest contents from host
    this.network.on(MessageType.CHEST_CONTENTS, (msg) => {
      const data = msg.data as { playerId: number; tx: number; ty: number; items: any[] }
      if (data.playerId === this._localPlayerId) {
        this.pendingChestContents = { tx: data.tx, ty: data.ty, items: data.items }
      }
    })

    // Entity spawn/despawn
    this.network.on(MessageType.ENTITY_SPAWN, (msg) => {
      this.onHostMessage?.(msg)
    })
    this.network.on(MessageType.ENTITY_DESPAWN, (msg) => {
      this.onHostMessage?.(msg)
    })
  }

  /** Wire up NetworkManager reconnection callbacks to MultiplayerManager events */
  private setupReconnectHandlers() {
    if (!this.network) return

    this.network.onReconnecting = (attempt, max) => {
      console.log(`[MP] Reconnecting (${attempt}/${max})...`)
      this.onReconnecting?.(attempt, max)
    }

    this.network.onReconnected = () => {
      console.log('[MP] Reconnected, new playerId:', this.network?.playerId)
      // Update local player ID since we rejoined as a new player
      if (this.network) {
        this._localPlayerId = this.network.playerId
      }
      this.onReconnected?.()
    }

    this.network.onReconnectFailed = (reason) => {
      console.warn('[MP] Reconnect failed:', reason)
      this.onDisconnected?.(reason)
    }
  }

  /** Clean up everything */
  destroy() {
    if (this.network) {
      this.network.disconnect()
      this.network = null
    }
    if (this.host) {
      this.host.destroy()
      this.host = null
    }
    for (const [id] of this._remotePlayers) {
      this.removeRemotePlayerSprite(id)
    }
    this._remotePlayers.clear()
    this.entities.clear()
    this.pendingTileChanges = []
    this.pendingEnemySync = null
    this.pendingBossSync = null
    this.pendingCombatEvents = []
    this.pendingDroppedItemSync = null
    this.pendingProjectileSync = null
    this.pendingDayNightTime = null
    this.pendingLocalPlayerCorrection = null
    this.pendingItemPickups = []
    this.pendingChestContents = null
    this.chatMessages = []
    this._mode = 'offline'
  }
}
