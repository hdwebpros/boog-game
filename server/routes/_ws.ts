/**
 * Nitro WebSocket relay server for Starfall multiplayer.
 *
 * This is a lightweight relay — the actual game logic runs on the host client.
 * The server just:
 * 1. Manages rooms (sessions)
 * 2. Relays messages between clients
 * 3. Tracks which client is the host
 *
 * Uses Nitro's built-in WebSocket support (H3 + crossws).
 */

interface Client {
  id: string
  playerId: number
  peer: any
  roomCode: string
  isHost: boolean
}

interface Room {
  code: string
  host: Client | null
  clients: Map<string, Client>
  createdAt: number
}

const rooms = new Map<string, Room>()
const clientMap = new Map<string, Client>()

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export default defineWebSocketHandler({
  open(peer) {
    // Client connected — wait for them to create or join a room
    const client: Client = {
      id: peer.id ?? crypto.randomUUID(),
      playerId: 0,
      peer,
      roomCode: '',
      isHost: false,
    }
    clientMap.set(client.id, client)

    peer.send(JSON.stringify({
      type: 'welcome',
      clientId: client.id,
    }))
  },

  message(peer, rawMessage) {
    const client = findClientByPeer(peer)
    if (!client) return

    let msg: any
    try {
      const text = typeof rawMessage === 'string' ? rawMessage : rawMessage.text()
      msg = JSON.parse(text)
    } catch {
      return
    }

    // Room management messages (before game protocol)
    switch (msg.type) {
      case 'create_room': {
        const code = generateRoomCode()
        const room: Room = {
          code,
          host: client,
          clients: new Map(),
          createdAt: Date.now(),
        }
        room.clients.set(client.id, client)
        rooms.set(code, room)
        client.roomCode = code
        client.isHost = true

        peer.send(JSON.stringify({
          type: 'room_created',
          code,
          isHost: true,
        }))
        return
      }

      case 'join_room': {
        const code = (msg.code as string)?.toUpperCase()
        const room = rooms.get(code)
        if (!room) {
          peer.send(JSON.stringify({
            type: 'room_error',
            error: `Room ${code} not found`,
          }))
          return
        }
        if (room.clients.size >= 8) {
          peer.send(JSON.stringify({
            type: 'room_error',
            error: 'Room is full',
          }))
          return
        }

        room.clients.set(client.id, client)
        client.roomCode = code

        peer.send(JSON.stringify({
          type: 'room_joined',
          code,
          isHost: false,
        }))
        return
      }

      case 'leave_room': {
        handleLeave(client)
        return
      }
    }

    // Game protocol relay — forward to room
    const room = rooms.get(client.roomCode)
    if (!room) return

    const text = typeof rawMessage === 'string' ? rawMessage : rawMessage.text()

    if (client.isHost) {
      // Host → broadcast to all other clients
      const targetId = msg._targetId as string | undefined
      if (targetId) {
        // Unicast to specific client
        const target = room.clients.get(targetId)
        if (target && target.id !== client.id) {
          target.peer.send(text)
        }
      } else {
        // Broadcast to all non-host clients
        for (const [, c] of room.clients) {
          if (c.id !== client.id) {
            c.peer.send(text)
          }
        }
      }
    } else {
      // Client → forward to host only
      if (room.host) {
        // Tag the sender so host knows who sent it
        msg._fromClientId = client.id
        room.host.peer.send(JSON.stringify(msg))
      }
    }
  },

  close(peer) {
    const client = findClientByPeer(peer)
    if (client) {
      handleLeave(client)
      clientMap.delete(client.id)
    }
  },

  error(peer, error) {
    console.error('[WS] Error:', error)
    const client = findClientByPeer(peer)
    if (client) {
      handleLeave(client)
      clientMap.delete(client.id)
    }
  },
})

function findClientByPeer(peer: any): Client | undefined {
  for (const [, client] of clientMap) {
    if (client.peer === peer || client.peer.id === peer.id) {
      return client
    }
  }
  return undefined
}

function handleLeave(client: Client) {
  const room = rooms.get(client.roomCode)
  if (!room) return

  room.clients.delete(client.id)

  if (client.isHost) {
    // Host left — close the room
    for (const [, c] of room.clients) {
      c.peer.send(JSON.stringify({
        type: 'room_closed',
        reason: 'Host disconnected',
      }))
    }
    rooms.delete(client.roomCode)
  } else {
    // Client left — notify host
    if (room.host) {
      room.host.peer.send(JSON.stringify({
        type: MessageType_PLAYER_LEFT,
        senderId: 0,
        data: { playerId: client.playerId, clientId: client.id },
      }))
    }
    // Clean up empty rooms
    if (room.clients.size === 0) {
      rooms.delete(client.roomCode)
    }
  }

  client.roomCode = ''
  client.isHost = false
}

// Mirror the protocol MessageType for the one we need
const MessageType_PLAYER_LEFT = 5
