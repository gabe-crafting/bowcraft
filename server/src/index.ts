import { randomUUID } from 'node:crypto'
import { Buffer } from 'node:buffer'
import {
  MAX_CLIENT_MESSAGE_CHARS,
  MAX_PLAYERS,
  SERVER_PORT,
  TICK_MS,
  parseClientMessage,
  type ServerMessage,
} from '@bounty/shared'
import { WebSocket, WebSocketServer, type RawData } from 'ws'
import { Game } from './Game'
import { sanitizeUsername } from './sanitize'

const game = new Game()
const sockets = new Map<string, WebSocket>()

function toText(data: RawData): string {
  if (typeof data === 'string') return data
  if (Buffer.isBuffer(data)) return data.toString('utf8')
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8')
  return Buffer.concat(data).toString('utf8')
}

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState !== WebSocket.OPEN) return
  socket.send(JSON.stringify(message))
}

function broadcastState(): void {
  for (const [id, socket] of sockets) send(socket, game.snapshotFor(id))
}

function startLoop(): void {
  const step = (): void => {
    const started = performance.now()
    game.tick()
    broadcastState()
    const delay = Math.max(0, TICK_MS - (performance.now() - started))
    setTimeout(step, delay)
  }
  setTimeout(step, TICK_MS)
}

const wss = new WebSocketServer({ port: SERVER_PORT }, () => {
  console.log(`server listening on ws://localhost:${SERVER_PORT}`)
})

wss.on('connection', (socket) => {
  let playerId: string | null = null
  let username = ''

  socket.on('message', (data) => {
    const text = toText(data)
    if (text.length > MAX_CLIENT_MESSAGE_CHARS) return

    let payload: unknown
    try {
      payload = JSON.parse(text) as unknown
    } catch {
      return
    }

    const message = parseClientMessage(payload)
    if (!message) return

    if (message.type === 'join') {
      if (playerId !== null) return
      if (game.playerCount >= MAX_PLAYERS) {
        send(socket, { type: 'arena_full' })
        socket.close()
        return
      }

      username = sanitizeUsername(message.username)
      const id = randomUUID()
      if (!game.addPlayer(id, username)) {
        send(socket, { type: 'arena_full' })
        socket.close()
        return
      }

      playerId = id
      sockets.set(id, socket)
      send(socket, { type: 'welcome', playerId: id })
      console.log(`${username} joined (${game.playerCount}/${MAX_PLAYERS})`)
      return
    }

    if (playerId === null) return
    if (message.type === 'action') {
      game.applyAction(playerId, message.action)
      return
    }
    game.setInput(playerId, message)
  })

  socket.on('close', () => {
    if (playerId === null) return
    game.removePlayer(playerId)
    sockets.delete(playerId)
    console.log(`${username} left (${game.playerCount}/${MAX_PLAYERS})`)
  })

  socket.on('error', () => {
    socket.close()
  })
})

wss.on('error', (error) => {
  console.error(error)
  process.exit(1)
})

startLoop()
