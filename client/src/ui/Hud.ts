import { MAX_HP } from '@bounty/shared'

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

export class Hud {
  private readonly root: HTMLDivElement
  private readonly plates = new Map<string, PlateView>()

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'hud'
    parent.append(this.root)
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

  clear(): void {
    for (const view of this.plates.values()) view.root.remove()
    this.plates.clear()
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
