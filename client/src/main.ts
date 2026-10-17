import { Connection } from './net/Connection'
import { SnapshotBuffer } from './net/SnapshotBuffer'
import { InputManager } from './input/InputManager'
import { SceneManager } from './scene/SceneManager'
import { Hud } from './ui/Hud'
import { JoinScreen } from './ui/JoinScreen'
import './style.css'

const app = document.querySelector('#app')
if (!(app instanceof HTMLElement)) {
  throw new Error('Missing #app')
}

const join = new JoinScreen(app)
const hud = new Hud(app)
const input = new InputManager()
let connection: Connection | null = null
let scene: SceneManager | null = null

join.onPlay((username) => {
  if (connection) return

  const next = new Connection()
  const buffer = new SnapshotBuffer()
  let arenaFull = false
  connection = next
  join.setBusy(true)
  join.setStatus('')

  next.start(username, {
    onWelcome: (playerId) => {
      join.hide()
      input.attach()
      scene = new SceneManager({
        parent: app,
        connection: next,
        buffer,
        input,
        hud,
        playerId,
      })
      scene.start()
    },
    onArenaFull: () => {
      arenaFull = true
      join.setStatus('Arena full')
    },
    onState: (state) => {
      buffer.push(state, performance.now())
    },
    onClose: () => {
      const wasPlaying = scene !== null
      scene?.stop()
      scene = null
      input.detach()
      hud.clear()
      connection = null
      join.setBusy(false)
      join.show()
      if (wasPlaying) join.setStatus('Disconnected')
      else if (!arenaFull) join.setStatus('Could not connect')
    },
  })
})
