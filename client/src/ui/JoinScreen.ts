import { USERNAME_MAX_LENGTH } from '@bounty/shared'

export class JoinScreen {
  private readonly root: HTMLDivElement
  private readonly input: HTMLInputElement
  private readonly button: HTMLButtonElement
  private readonly statusEl: HTMLParagraphElement
  private statusText = ''
  private onPlayHandler: ((username: string) => void) | null = null

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'join-screen'

    const card = document.createElement('form')
    card.className = 'join-card'

    const title = document.createElement('h1')
    title.textContent = 'Bounty Hunter'

    const hint = document.createElement('p')
    hint.className = 'hint'
    hint.textContent =
      'WASD to move. Mouse to aim. Click to loose. A shortbow and a recurve shoot ahead, and bow power sets their speed and distance. A longbow lofts onto any spot you click. Q is a normal arrow. 1 ricochets, 2 explodes, 3 punches through, and 4 lights a circle until it lands. Hold E for the weapon menu. You only see ahead of you. Walls and trees block that view. A bush hides you until you loose an arrow.'

    this.input = document.createElement('input')
    this.input.type = 'text'
    this.input.maxLength = USERNAME_MAX_LENGTH
    this.input.placeholder = 'Username'
    this.input.autocomplete = 'off'
    this.input.required = true
    this.input.autofocus = true

    this.button = document.createElement('button')
    this.button.type = 'submit'
    this.button.textContent = 'Play'

    this.statusEl = document.createElement('p')
    this.statusEl.className = 'status'

    card.append(title, hint, this.input, this.button, this.statusEl)
    this.root.append(card)
    parent.append(this.root)

    card.addEventListener('submit', (event) => {
      event.preventDefault()
      const username = this.input.value.trim()
      if (username.length === 0) {
        this.setStatus('Enter a username')
        return
      }
      this.onPlayHandler?.(username)
    })
  }

  get status(): string {
    return this.statusText
  }

  onPlay(handler: (username: string) => void): void {
    this.onPlayHandler = handler
  }

  setStatus(message: string): void {
    this.statusText = message
    this.statusEl.textContent = message
  }

  setBusy(busy: boolean): void {
    this.input.disabled = busy
    this.button.disabled = busy
  }

  hide(): void {
    this.root.hidden = true
    this.input.blur()
  }

  show(): void {
    this.root.hidden = false
    if (!this.input.disabled) this.input.focus()
  }
}
