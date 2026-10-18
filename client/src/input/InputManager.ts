import type { InputMessage } from '@bounty/shared'

type FrameInput = Omit<InputMessage, 'type'>

const MOVE_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
])

export class InputManager {
  private readonly keys = new Set<string>()
  private pointerX = window.innerWidth / 2
  private pointerY = window.innerHeight / 2
  private primaryDown = false
  private shootLatched = false
  private menuDown = false
  private menuReleaseLatched = false
  private slot = 0
  private attached = false

  get pointer(): { x: number; y: number } {
    return { x: this.pointerX, y: this.pointerY }
  }

  attach(): void {
    if (this.attached) return
    this.attached = true
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.clear)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mouseup', this.onMouseUp)
  }

  detach(): void {
    if (!this.attached) return
    this.attached = false
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.clear)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mouseup', this.onMouseUp)
    this.clear()
  }

  pullMenu(): { held: boolean; released: boolean } {
    const released = this.menuReleaseLatched
    this.menuReleaseLatched = false
    return { held: this.menuDown, released }
  }

  select(slot: number): void {
    if (slot !== 0 && slot !== 1 && slot !== 2 && slot !== 3 && slot !== 4) return
    this.slot = slot
  }

  consume(aim: number, aimX: number, aimZ: number): FrameInput {
    const shoot = !this.menuDown && (this.shootLatched || this.primaryDown)
    this.shootLatched = false
    return {
      up: this.held('KeyW', 'ArrowUp'),
      down: this.held('KeyS', 'ArrowDown'),
      left: this.held('KeyA', 'ArrowLeft'),
      right: this.held('KeyD', 'ArrowRight'),
      aim,
      aimX,
      aimZ,
      shoot,
      slot: this.slot,
    }
  }

  private held(...codes: string[]): boolean {
    return codes.some((code) => this.keys.has(code))
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const slot = slotFrom(event.code)
    if (slot !== null) {
      event.preventDefault()
      this.slot = slot
      return
    }
    if (event.code === 'KeyE') {
      if (event.repeat || this.menuDown) return
      this.menuDown = true
      return
    }
    if (MOVE_CODES.has(event.code)) event.preventDefault()
    this.keys.add(event.code)
  }

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === 'KeyE') {
      if (!this.menuDown) return
      this.menuDown = false
      this.menuReleaseLatched = true
      return
    }
    this.keys.delete(event.code)
  }

  private readonly onMouseMove = (event: MouseEvent): void => {
    this.pointerX = event.clientX
    this.pointerY = event.clientY
  }

  private readonly onMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return
    if (event.target instanceof Element && event.target.closest('.hotbar')) return
    this.primaryDown = true
    this.shootLatched = true
  }

  private readonly onMouseUp = (event: MouseEvent): void => {
    if (event.button !== 0) return
    this.primaryDown = false
  }

  private readonly clear = (): void => {
    this.keys.clear()
    this.primaryDown = false
    this.shootLatched = false
    this.menuDown = false
    this.menuReleaseLatched = false
  }
}

function slotFrom(code: string): number | null {
  if (code === 'KeyQ') return 0
  if (code === 'Digit1' || code === 'Numpad1') return 1
  if (code === 'Digit2' || code === 'Numpad2') return 2
  if (code === 'Digit3' || code === 'Numpad3') return 3
  if (code === 'Digit4' || code === 'Numpad4') return 4
  return null
}
