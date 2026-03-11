/**
 * Connects the host game to the Nitro WebSocket relay server.
 * The host creates a room, gets a code, and manages game messages.
 *
 * Flow:
 * 1. Host connects to ws://localhost:3000/_ws
 * 2. Sends 'create_room' → receives room code
 * 3. When other players join, relayed messages arrive here
 * 4. Host processes game messages via HostSession
 * 5. Host broadcasts state updates back through the relay
 */

import { HostSession } from './HostSession'
import {
  type NetworkMessage,
  encodeMessage,
  decodeMessage,
  MessageType,
} from './protocol'

export class RoomConnector {
  private ws: WebSocket | null = null
  private _roomCode = ''
  private _connected = false
  private hostSession: HostSession
  private clientIdMap = new Map<string, number>() // WebSocket clientId → playerId
  private playerIdToClientId = new Map<number, string>()

  /** Callback for messages the host game logic needs to process */
  onGameMessage: ((msg: NetworkMessage) => void) | null = null

  get roomCode(): string { return this._roomCode }
  get connected(): boolean { return this._connected }

  constructor(hostSession: HostSession) {
    this.hostSession = hostSession

    // Wire up the broadcast function
    this.hostSession.setBroadcast((msgStr: string, excludeId?: number) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
      // Send through relay — it broadcasts to all non-host clients
      // If we need to exclude a specific player, we can't easily with relay
      // (relay broadcasts to all) — but for most messages that's fine
      this.ws.send(msgStr)
    })
  }

  /** Connect to the relay server and create a room */
  async createRoom(): Promise<string> {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/_ws`

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url)
      } catch (err) {
        reject(new Error(`Failed to connect: ${err}`))
        return
      }

      this.ws.onopen = () => {
        this.ws!.send(JSON.stringify({ type: 'create_room' }))
      }

      this.ws.onmessage = (event) => {
        let msg: any
        try {
          msg = JSON.parse(event.data as string)
        } catch { return }

        // Handle relay management messages
        if (msg.type === 'room_created') {
          this._roomCode = msg.code
          this._connected = true
          resolve(msg.code)
          return
        }

        if (msg.type === 'room_error') {
          reject(new Error(msg.error))
          return
        }

        if (msg.type === 'room_closed') {
          this._connected = false
          return
        }

        // Handle game protocol messages from clients (relayed through server)
        const clientId = msg._fromClientId as string | undefined
        const gameMsg = msg as NetworkMessage

        if (gameMsg.type === MessageType.JOIN_REQUEST && clientId) {
          // New player joining
          const sendFn = (response: string) => {
            // Send response back through relay, tagged for specific client
            const parsed = JSON.parse(response)
            parsed._targetId = clientId
            this.ws?.send(JSON.stringify(parsed))
          }

          const result = this.hostSession.handleMessage(gameMsg, sendFn)
          if (result) {
            // Store client-player mapping
            const playerId = (result.data as any)?._playerId as number
            if (playerId && clientId) {
              this.clientIdMap.set(clientId, playerId)
              this.playerIdToClientId.set(playerId, clientId)
              result.senderId = playerId
            }
            this.onGameMessage?.(result)
          }
          return
        }

        // Map clientId to playerId for other messages
        if (clientId) {
          const playerId = this.clientIdMap.get(clientId)
          if (playerId) {
            gameMsg.senderId = playerId
          }
        }

        const sendFn = (response: string) => {
          if (clientId) {
            const parsed = JSON.parse(response)
            parsed._targetId = clientId
            this.ws?.send(JSON.stringify(parsed))
          }
        }

        const result = this.hostSession.handleMessage(gameMsg, sendFn)
        if (result) {
          this.onGameMessage?.(result)
        }
      }

      this.ws.onclose = () => {
        this._connected = false
      }

      this.ws.onerror = () => {
        if (!this._connected) {
          reject(new Error('WebSocket connection failed'))
        }
      }
    })
  }

  /** Disconnect and close the room */
  disconnect() {
    if (this.ws) {
      this.ws.send(JSON.stringify({ type: 'leave_room' }))
      this.ws.close()
      this.ws = null
    }
    this._connected = false
    this._roomCode = ''
    this.clientIdMap.clear()
    this.playerIdToClientId.clear()
  }
}
