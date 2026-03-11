/**
 * Client-side network manager.
 * Handles WebSocket connection to host and message routing.
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
  type JoinRequest,
  type JoinAccepted,
  type JoinRejected,
  type ChatMessage,
  type AttackRequest,
  MessageType,
  PROTOCOL_VERSION,
  PLAYER_SYNC_INTERVAL,
  encodeMessage,
  decodeMessage,
} from './protocol'

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

type MessageHandler = (msg: NetworkMessage) => void

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

  get state(): ConnectionState { return this._state }
  get playerId(): number { return this._playerId }
  get playerName(): string { return this._playerName }
  get isHost(): boolean { return this._isHost }
  get ping(): number { return this._ping }

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
        this.disconnect()
      }

      this._state = 'connecting'
      this._playerName = playerName
      let joinedRoom = false

      try {
        this.ws = new WebSocket(url)
      } catch (err) {
        this._state = 'error'
        reject(new Error(`Failed to create WebSocket: ${err}`))
        return
      }

      this.ws.onopen = () => {
        // Phase 1: join the relay room
        this.ws!.send(JSON.stringify({ type: 'join_room', code: roomCode }))
      }

      this.ws.onmessage = (event) => {
        let raw: any
        try {
          raw = JSON.parse(event.data as string)
        } catch { return }

        // During connection, handle both relay and game protocol messages
        if (this._state === 'connecting') {
          // Relay management messages have string type fields
          if (typeof raw.type === 'string') {
            if (raw.type === 'welcome') return // ignore
            if (raw.type === 'room_joined') {
              // Phase 2: room joined, now send game-level JOIN_REQUEST
              joinedRoom = true
              this.send({
                type: MessageType.JOIN_REQUEST,
                senderId: 0,
                data: {
                  playerName,
                  protocolVersion: PROTOCOL_VERSION,
                } satisfies JoinRequest,
              })
              return
            }
            if (raw.type === 'room_error') {
              this._state = 'error'
              this.ws?.close()
              reject(new Error(raw.error ?? 'Room error'))
              return
            }
            if (raw.type === 'room_closed') {
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
            this._state = 'connected'
            this.setupMessageHandling()
            resolve(data)
            return
          }
          if (msg.type === MessageType.JOIN_REJECTED) {
            const data = msg.data as JoinRejected
            this._state = 'error'
            this.ws?.close()
            reject(new Error(data.reason))
            return
          }
          return
        }

        // Handle relay messages after connected (e.g. room_closed)
        if (typeof raw.type === 'string') {
          if (raw.type === 'room_closed') {
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
      }

      this.ws.onclose = () => {
        const wasConnected = this._state === 'connected'
        this._state = 'disconnected'
        if (wasConnected) {
          this.dispatchMessage({
            type: MessageType.PLAYER_LEFT,
            senderId: this._playerId,
            data: { playerId: this._playerId, reason: 'disconnected' },
          })
        }
      }
    })
  }

  /** Disconnect from the session */
  disconnect() {
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
    this.ws.send(encodeMessage(msg))
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
