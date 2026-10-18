import {
  SERVER_PORT,
  parseServerMessage,
  type ActionMessage,
  type InputMessage,
  type JoinMessage,
  type StateMessage,
  type WeaponAction,
} from '@bounty/shared'

export interface ConnectionHandlers {
  onWelcome: (playerId: string) => void
  onArenaFull: () => void
  onState: (state: StateMessage) => void
  onClose: () => void
}

export class Connection {
  private socket: WebSocket | null = null
  private welcomed = false
  private notifiedClose = false

  start(username: string, handlers: ConnectionHandlers): void {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
    const url =
      location.port === '5173'
        ? `${protocol}://${location.hostname}:${SERVER_PORT}`
        : `${protocol}://${location.host}`
    const socket = new WebSocket(url)
    this.socket = socket

    socket.addEventListener('open', () => {
      const message: JoinMessage = { type: 'join', username }
      socket.send(JSON.stringify(message))
    })

    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return
      const message = decodeServerMessage(event.data)
      if (!message) return
      if (message.type === 'welcome') {
        this.welcomed = true
        handlers.onWelcome(message.playerId)
        return
      }
      if (message.type === 'arena_full') {
        handlers.onArenaFull()
        return
      }
      handlers.onState(message)
    })

    socket.addEventListener('error', () => {
      socket.close()
    })

    socket.addEventListener('close', () => {
      if (this.notifiedClose) return
      this.notifiedClose = true
      handlers.onClose()
    })
  }

  sendInput(input: Omit<InputMessage, 'type'>): void {
    this.send({ type: 'input', ...input })
  }

  sendAction(action: WeaponAction, weaponId: string | null): void {
    const message: ActionMessage = { type: 'action', action, weaponId }
    this.send(message)
  }

  private send(message: InputMessage | ActionMessage): void {
    const socket = this.socket
    if (!this.welcomed || !socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify(message))
  }

  close(): void {
    this.socket?.close()
  }
}

function decodeServerMessage(raw: string) {
  try {
    return parseServerMessage(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}
