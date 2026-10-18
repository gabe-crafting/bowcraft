import {
  ARROW_KINDS,
  ARROWS,
  arrowShot,
  BOW_NAMES,
  BOWS,
  MAX_HP,
  type ArrowKind,
  type PlayerSnapshot,
  type ShotArrow,
  type WeaponKind,
} from '@bounty/shared'

export interface Nameplate {
  id: string
  username: string
  hp: number
  screenX: number
  screenY: number
  visible: boolean
}

interface PlateView {
  root: HTMLDivElement
  name: HTMLSpanElement
  hp: HTMLSpanElement
  fill: HTMLDivElement
}

interface HotbarSlot {
  root: HTMLDivElement
  icon: HTMLDivElement
  tip: HTMLDivElement
  count: HTMLSpanElement | null
  sweep: HTMLDivElement | null
  timer: HTMLSpanElement | null
  iconKey: string
}

const SLOT_KEYS = ['Q', '1', '2', '3', '4']

export class Hud {
  private readonly root: HTMLDivElement
  private readonly plates = new Map<string, PlateView>()
  private readonly hotbar: HTMLDivElement
  private readonly slots: HotbarSlot[]
  private onSelectHandler: ((slot: number) => void) | null = null

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'hud'
    this.hotbar = document.createElement('div')
    this.hotbar.className = 'hotbar'
    this.hotbar.hidden = true
    this.slots = SLOT_KEYS.map((key, index) => this.createSlot(key, index))
    for (const slot of this.slots) this.hotbar.append(slot.root)
    this.root.append(this.hotbar)
    parent.append(this.root)
  }

  onSelect(handler: (slot: number) => void): void {
    this.onSelectHandler = handler
  }

  sync(nameplates: readonly Nameplate[]): void {
    const seen = new Set<string>()

    for (const plate of nameplates) {
      seen.add(plate.id)
      const view = this.plates.get(plate.id) ?? this.createPlate(plate.id)
      view.name.textContent = plate.username
      view.hp.textContent = String(plate.hp)
      const ratio = Math.min(1, Math.max(0, plate.hp / MAX_HP))
      view.fill.style.width = `${ratio * 100}%`
      view.root.style.display = plate.visible ? 'block' : 'none'
      view.root.style.left = `${plate.screenX}px`
      view.root.style.top = `${plate.screenY}px`
    }

    for (const [id, view] of this.plates) {
      if (seen.has(id)) continue
      view.root.remove()
      this.plates.delete(id)
    }
  }

  syncLoadout(player: PlayerSnapshot | null, weapon: WeaponKind | null): void {
    if (!player) {
      this.hotbar.hidden = true
      return
    }
    this.hotbar.hidden = false
    this.paintBow(weapon, player.selected, player.cooldownMs)
    ARROW_KINDS.forEach((kind, index) => {
      const count = player.quiver[index] ?? 0
      this.paintArrow(index + 1, kind, count, player.selected === kind, weapon)
    })
  }

  clear(): void {
    for (const view of this.plates.values()) view.root.remove()
    this.plates.clear()
    this.hotbar.hidden = true
  }

  private createSlot(key: string, index: number): HotbarSlot {
    const root = document.createElement('div')
    root.className = 'slot'
    const keyLabel = document.createElement('span')
    keyLabel.className = 'key'
    keyLabel.textContent = key
    const icon = document.createElement('div')
    icon.className = 'icon'
    const tip = document.createElement('div')
    tip.className = 'tip'
    root.append(keyLabel, icon, tip)

    let count: HTMLSpanElement | null = null
    let sweep: HTMLDivElement | null = null
    let timer: HTMLSpanElement | null = null
    if (index === 0) {
      sweep = document.createElement('div')
      sweep.className = 'sweep'
      sweep.hidden = true
      timer = document.createElement('span')
      timer.className = 'timer'
      timer.hidden = true
      root.append(sweep, timer)
    } else {
      count = document.createElement('span')
      count.className = 'count'
      count.textContent = '0'
      root.append(count)
    }

    root.addEventListener('click', () => {
      this.onSelectHandler?.(index)
    })

    return { root, icon, tip, count, sweep, timer, iconKey: '' }
  }

  private paintBow(weapon: WeaponKind | null, selected: ShotArrow, cooldownMs: number): void {
    const slot = this.slots[0]
    if (!slot) return
    slot.root.classList.toggle('is-selected', selected === 'normal')
    slot.root.classList.toggle('is-empty', weapon === null)
    const key = weapon ?? 'empty'
    if (slot.iconKey !== key) {
      slot.iconKey = key
      slot.icon.innerHTML = bowMarkup(weapon)
    }
    slot.tip.textContent = bowTip(weapon)
    const total = weapon ? BOWS[weapon].fireCooldownMs : 0
    const cooling = weapon !== null && cooldownMs >= 50 && total > 0
    if (slot.sweep) {
      slot.sweep.hidden = !cooling
      const ratio = cooling ? Math.min(1, cooldownMs / total) : 0
      slot.sweep.style.background = `conic-gradient(rgba(8, 10, 14, 0.72) ${ratio * 360}deg, transparent 0)`
    }
    if (slot.timer) {
      slot.timer.hidden = !cooling
      slot.timer.textContent = (cooldownMs / 1000).toFixed(1)
    }
  }

  private paintArrow(
    index: number,
    kind: ArrowKind,
    count: number,
    selected: boolean,
    weapon: WeaponKind | null,
  ): void {
    const slot = this.slots[index]
    if (!slot) return
    slot.root.classList.toggle('is-selected', selected)
    slot.root.classList.toggle('is-empty', count <= 0)
    if (slot.iconKey !== kind) {
      slot.iconKey = kind
      slot.icon.innerHTML = arrowMarkup(kind)
    }
    if (slot.count) slot.count.textContent = String(count)
    slot.tip.textContent = arrowTip(kind, count, weapon)
  }

  private createPlate(id: string): PlateView {
    const root = document.createElement('div')
    root.className = 'nameplate'

    const row = document.createElement('div')
    row.className = 'nameplate-row'
    const name = document.createElement('span')
    const hp = document.createElement('span')
    hp.className = 'hp'
    row.append(name, hp)

    const track = document.createElement('div')
    track.className = 'hp-track'
    const fill = document.createElement('div')
    fill.className = 'hp-fill'
    track.append(fill)

    root.append(row, track)
    this.root.append(root)

    const view = { root, name, hp, fill }
    this.plates.set(id, view)
    return view
  }
}

function bowMarkup(kind: WeaponKind | null): string {
  const wood = kind === 'shortbow' ? '#c49255' : kind === 'recurve' ? '#8a3b2a' : kind === 'longbow' ? '#6b3f24' : '#8a8175'
  const stave =
    kind === 'shortbow'
      ? 'M22 14 C34 24 34 40 22 50'
      : kind === 'recurve'
        ? 'M24 8 C10 16 10 48 24 56'
        : 'M20 6 C36 20 36 44 20 58'
  const string = kind === 'shortbow' ? 'M22 14 L22 50' : kind === 'recurve' ? 'M24 8 L24 56' : 'M20 6 L20 58'
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="${stave}" fill="none" stroke="${wood}" stroke-width="4" stroke-linecap="round"/><path d="${string}" fill="none" stroke="#f4f0e8" stroke-width="1.5"/></svg>`
}

function arrowMarkup(kind: ArrowKind): string {
  const look = ARROWS[kind]
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><line x1="12" y1="32" x2="44" y2="32" stroke="${hex(look.shaft)}" stroke-width="3" stroke-linecap="round"/><polygon points="46,32 34,24 34,40" fill="${hex(look.head)}"/><polygon points="12,32 22,24 22,40" fill="${hex(look.fletching)}"/></svg>`
}

function bowTip(kind: WeaponKind | null): string {
  if (!kind) return 'No bow\nPick one up from the ground.\nQ shoots normal arrows.'
  const spec = BOWS[kind]
  const info = BOW_NAMES[kind]
  return [
    info.name,
    info.detail,
    `${spec.damage} damage`,
    `${compact(spec.speed)} speed`,
    `${compact(spec.maxRange)} range`,
    `${(spec.fireCooldownMs / 1000).toFixed(2)}s between shots`,
    'Normal arrows never run out.',
  ].join('\n')
}

function arrowTip(kind: ArrowKind, count: number, weapon: WeaponKind | null): string {
  const profile = ARROWS[kind]
  const lines = [profile.name, profile.detail]
  if (weapon) {
    const spec = arrowShot(BOWS[weapon], kind)
    lines.push(
      `${spec.damage} damage`,
      `${compact(spec.speed)} speed`,
      `${compact(spec.maxRange)} range`,
    )
  } else {
    lines.push('Pick up a bow to shoot them.')
  }
  lines.push(count === 0 ? 'None carried' : `${count} carried`)
  return lines.join('\n')
}

function compact(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}
