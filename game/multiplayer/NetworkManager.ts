/**
 * Client-side network manager.
 * Handles WebSocket connection to host and message routing.
 * Includes automatic reconnection with exponential backoff.
 */

import {
  type NetworkMessage,
  type InputState,
  type TileChangeRequest,
  type JoinRequest,
  type JoinAccepted,
  type JoinRejected,
  type ChatMessage,
  type AttackRequest,
  MessageType,
  PROTOCOL_VERSION,
  PLAYER_SYNC_INTERVAL,
  encodeMessage,
} from './protocol'

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

type MessageHandler = (msg: NetworkMessage) => void

/** Max reconnection attempts before giving up */
const MAX_RECONNECT_ATTEMPTS = 3
/** Base delay between reconnect attempts (doubles each time) */
const RECONNECT_BASE_DELAY = 2000

export class NetworkManager {
  private ws: WebSocket | null = null
  private _state: ConnectionState = 'disconnected'
  private handlers = new Map<MessageType, MessageHandler[]>()
  private _playerId = 0
  private _playerName = ''
  private _isHost = false
  private _ping = 0
  private pingTimer = 0
  private lastPingSent = 0
  private inputBuffer: InputState[] = []
  private inputSendTimer = 0

  /** Stored connection params for reconnection */
  private _url = ''
  private _roomCode = ''

  /** Reconnection state */
  private _reconnectAttempt = 0
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private _intentionalDisconnect = false

  /** Callbacks for reconnection events */
  onReconnecting: ((attempt: number, maxAttempts: number) => void) | null = null
  onReconnected: (() => void) | null = null
  onReconnectFailed: ((reason: string) => void) | null = null

  get state(): ConnectionState { return this._state }
  get playerId(): number { return this._playerId }
  get playerName(): string { return this._playerName }
  get isHost(): boolean { return this._isHost }
  get ping(): number { return this._ping }
  get reconnectAttempt(): number { return this._reconnectAttempt }

  /** Register a handler for a specific message type */
  on(type: MessageType, handler: MessageHandler) {
    const list = this.handlers.get(type) ?? []
    list.push(handler)
    this.handlers.set(type, list)
  }

  /** Remove all handlers for a type */
  off(type: MessageType) {
    this.handlers.delete(type)
  }

  /** Connect to a multiplayer session via relay server (two-phase: join room, then game handshake) */
  connect(url: string, playerName: string, roomCode: string): Promise<JoinAccepted> {
    return new Promise((resolve, reject) => {
      if (this.ws) {
        this._intentionalDisconnect = true
        this.ws.close()
        this.ws = null
      }

      this._state = 'connecting'
      this._playerName = playerName
      this._url = url
      this._roomCode = roomCode
      this._intentionalDisconnect = false
      this._reconnectAttempt = 0

      this.connectInternal(resolve, reject)
    })
  }

  /** Internal connection logic shared by connect() and reconnect() */
  private connectInternal(
    resolve: (data: JoinAccepted) => void,
    reject: (err: Error) => void,
  ) {
    try {
      this.ws = new WebSocket(this._url)
    } catch (err) {
      this._state = 'error'
      reject(new Error(`Failed to create WebSocket: ${err}`))
      return
    }

    this.ws.onopen = () => {
      // Phase 1: join the relay room
      this.ws!.send(JSON.stringify({ type: 'join_room', code: this._roomCode }))
    }

    this.ws.onmessage = (event) => {
      let raw: any
      try {
        raw = JSON.parse(event.data as string)
      } catch { return }

      // During connection/reconnection, handle both relay and game protocol messages
      if (this._state === 'connecting' || this._state === 'reconnecting') {
        // Relay management messages have string type fields
        if (typeof raw.type === 'string') {
          if (raw.type === 'welcome') return // ignore
          if (raw.type === 'room_joined') {
            // Phase 2: room joined, now send game-level JOIN_REQUEST
            this.send({
              type: MessageType.JOIN_REQUEST,
              senderId: 0,
              data: {
                playerName: this._playerName,
                protocolVersion: PROTOCOL_VERSION,
              } satisfies JoinRequest,
            })
            return
          }
          if (raw.type === 'room_error') {
            if (this._state === 'reconnecting') {
              // Room gone — host left, no point retrying
              this._state = 'error'
              this.ws?.close()
              this.onReconnectFailed?.(raw.error ?? 'Room no longer exists')
              return
            }
            this._state = 'error'
            this.ws?.close()
            reject(new Error(raw.error ?? 'Room error'))
            return
          }
          if (raw.type === 'room_closed') {
            if (this._state === 'reconnecting') {
              this._state = 'error'
              this.ws?.close()
              this.onReconnectFailed?.('Room closed')
              return
            }
            this._state = 'error'
            this.ws?.close()
            reject(new Error('Room closed'))
            return
          }
          return
        }

        // Game protocol messages (numeric type)
        const msg = raw as NetworkMessage
        if (msg.type === MessageType.JOIN_ACCEPTED) {
          const data = msg.data as JoinAccepted
          this._playerId = data.playerId
          const wasReconnecting = this._state === 'reconnecting'
          this._state = 'connected'
          this._reconnectAttempt = 0
          if (!wasReconnecting) {
            this.setupMessageHandling()
          }
          if (wasReconnecting) {
            console.log('[Net] Reconnected successfully, new playerId:', data.playerId)
            this.onReconnected?.()
          }
          resolve(data)
          return
        }
        if (msg.type === MessageType.JOIN_REJECTED) {
          const data = msg.data as JoinRejected
          if (this._state === 'reconnecting') {
            this._state = 'error'
            this.ws?.close()
            this.onReconnectFailed?.(data.reason)
            return
          }
          this._state = 'error'
          this.ws?.close()
          reject(new Error(data.reason))
          return
        }
        return
      }

      // Handle relay messages after connected (e.g. room_closed, heartbeat)
      if (typeof raw.type === 'string') {
        if (raw.type === 'heartbeat') {
          // Respond to server keepalive
          try { this.ws?.send(JSON.stringify({ type: 'heartbeat_ack' })) } catch {}
          return
        }
        if (raw.type === 'room_closed') {
          // Host deliberately closed — no reconnection possible
          this._intentionalDisconnect = true
          this._state = 'disconnected'
          this.ws?.close()
          // Dispatch as a disconnect event
          this.dispatchMessage({
            type: MessageType.PLAYER_LEFT,
            senderId: this._playerId,
            data: { playerId: this._playerId, reason: 'Host disconnected' },
          })
        }
        return
      }

      // After connected, dispatch game protocol messages
      const msg = raw as NetworkMessage
      if (typeof msg.type === 'number') {
        this.dispatchMessage(msg)
      }
    }

    this.ws.onerror = () => {
      if (this._state === 'connecting') {
        this._state = 'error'
        reject(new Error('WebSocket connection failed'))
      }
      // For reconnecting state, onerror is followed by onclose which handles retry
    }

    this.ws.onclose = (ev: CloseEvent) => {
      console.warn(`[Net] WebSocket closed: code=${ev.code} reason="${ev.reason}" wasClean=${ev.wasClean}`)
      const wasConnected = this._state === 'connected'
      const wasReconnecting = this._state === 'reconnecting'

      if (wasConnected && !this._intentionalDisconnect) {
        // Unexpected disconnect while playing — try to reconnect
        this.attemptReconnect()
        return
      }

      if (wasReconnecting) {
        // Reconnect attempt failed at the WS level — try again if attempts remain
        this.attemptReconnect()
        return
      }

      this._state = 'disconnected'
      if (wasConnected) {
        this.dispatchMessage({
          type: MessageType.PLAYER_LEFT,
          senderId: this._playerId,
          data: { playerId: this._playerId, reason: ev.reason || 'disconnected' },
        })
      }
    }
  }

  /** Attempt automatic reconnection with exponential backoff */
  private attemptReconnect() {
    this._reconnectAttempt++

    if (this._reconnectAttempt > MAX_RECONNECT_ATTEMPTS) {
      console.warn(`[Net] Reconnect failed after ${MAX_RECONNECT_ATTEMPTS} attempts`)
      this._state = 'disconnected'
      this.onReconnectFailed?.('Connection lost after multiple retries')
      // Dispatch disconnect so MultiplayerManager can handle it
      this.dispatchMessage({
        type: MessageType.PLAYER_LEFT,
        senderId: this._playerId,
        data: { playerId: this._playerId, reason: 'Connection lost' },
      })
      return
    }

    const delay = RECONNECT_BASE_DELAY * Math.pow(2, this._reconnectAttempt - 1)
    console.log(`[Net] Reconnecting (${this._reconnectAttempt}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms...`)
    this._state = 'reconnecting'
    this.onReconnecting?.(this._reconnectAttempt, MAX_RECONNECT_ATTEMPTS)

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null
      if (this._state !== 'reconnecting') return // was cancelled

      // Create a dummy promise pair — reconnect resolves silently via onReconnected callback
      const resolve = (_data: JoinAccepted) => {
        // Handled by onReconnected callback
      }
      const reject = (_err: Error) => {
        // Will be handled by onerror/onclose → attemptReconnect
      }
      this.connectInternal(resolve, reject)
    }, delay)
  }

  /** Disconnect from the session */
  disconnect() {
    this._intentionalDisconnect = true
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
    this._reconnectAttempt = 0
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this._state = 'disconnected'
    this._playerId = 0
  }

  /** Send a raw network message */
  send(msg: NetworkMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    try {
      this.ws.send(encodeMessage(msg))
    } catch {
      // Connection died between readyState check and send — will be handled by onclose
    }
  }

  /** Queue input to be sent to host (batched at PLAYER_SYNC_INTERVAL) */
  queueInput(input: InputState) {
    this.inputBuffer.push(input)
  }

  /** Send a tile change request */
  sendTileChange(change: TileChangeRequest) {
    this.send({
      type: MessageType.TILE_CHANGE,
      senderId: this._playerId,
      data: change,
    })
  }

  /** Send a chat message */
  sendChat(text: string) {
    this.send({
      type: MessageType.CHAT_MESSAGE,
      senderId: this._playerId,
      data: { text } satisfies ChatMessage,
    })
  }

  /** Send attack request */
  sendAttack(attack: AttackRequest) {
    this.send({
      type: MessageType.ATTACK_REQUEST,
      senderId: this._playerId,
      data: attack,
    })
  }

  /** Send boss summon request */
  sendBossSummon(bossType: string, altarTx: number, altarTy: number) {
    this.send({
      type: MessageType.BOSS_SUMMON,
      senderId: this._playerId,
      data: { bossType, altarTx, altarTy },
    })
  }

  /** Send item drop request */
  sendItemDrop(itemId: number, count: number) {
    this.send({
      type: MessageType.ITEM_DROP,
      senderId: this._playerId,
      data: { itemId, count },
    })
  }

  /** Send chest request (open/close) */
  sendChestRequest(tx: number, ty: number, action: 'open' | 'close', items?: (any | null)[]) {
    this.send({
      type: MessageType.CHEST_REQUEST,
      senderId: this._playerId,
      data: { tx, ty, action, items },
    })
  }

  /** Call each frame to flush input buffer and handle ping */
  update(dt: number) {
    if (this._state !== 'connected') return

    // Flush input buffer periodically
    this.inputSendTimer += dt * 1000
    if (this.inputSendTimer >= PLAYER_SYNC_INTERVAL && this.inputBuffer.length > 0) {
      this.inputSendTimer = 0
      // Send the latest input (drop older ones — server only needs most recent)
      const latest = this.inputBuffer[this.inputBuffer.length - 1]!
      this.send({
        type: MessageType.PLAYER_INPUT,
        senderId: this._playerId,
        data: latest,
      })
      this.inputBuffer.length = 0
    }

    // Ping every 2 seconds
    this.pingTimer += dt * 1000
    if (this.pingTimer >= 2000) {
      this.pingTimer = 0
      this.lastPingSent = Date.now()
      this.send({
        type: MessageType.PING,
        senderId: this._playerId,
        data: { t: this.lastPingSent },
      })
    }
  }

  private setupMessageHandling() {
    // Handle pong for RTT calculation
    this.on(MessageType.PONG, (msg) => {
      if (msg.data?.t) {
        this._ping = Date.now() - msg.data.t
      }
    })
  }

  private dispatchMessage(msg: NetworkMessage) {
    const handlers = this.handlers.get(msg.type)
    if (handlers) {
      for (const h of handlers) {
        h(msg)
      }
    }
  }
}
