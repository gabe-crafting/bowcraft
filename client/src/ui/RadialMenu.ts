import type { WeaponAction } from '@bounty/shared'

const MENU_SIZE = 280
const OUTER_RADIUS = 108
const INNER_RADIUS = 42
const SVG_NS = 'http://www.w3.org/2000/svg'

export interface RadialOption {
  id: WeaponAction
  label: string
}

export class RadialMenu {
  private readonly root: HTMLDivElement
  private readonly svg: SVGSVGElement
  private readonly caption: HTMLParagraphElement
  private options: RadialOption[] = []
  private optionKey = ''
  private highlight: WeaponAction | null = null

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'radial'
    this.root.hidden = true

    this.svg = document.createElementNS(SVG_NS, 'svg')
    this.svg.setAttribute('class', 'radial-svg')
    this.svg.setAttribute('viewBox', `0 0 ${MENU_SIZE} ${MENU_SIZE}`)
    this.svg.setAttribute('width', String(MENU_SIZE))
    this.svg.setAttribute('height', String(MENU_SIZE))

    this.caption = document.createElement('p')
    this.caption.className = 'radial-caption'

    this.root.append(this.svg, this.caption)
    parent.append(this.root)
    this.draw()
  }

  setOptions(options: readonly RadialOption[]): void {
    const key = options.map((option) => `${option.id}:${option.label}`).join('|')
    this.options = [...options]
    if (key === this.optionKey) return
    this.optionKey = key
    this.highlight = null
    this.draw()
  }

  setOpen(open: boolean): void {
    this.root.hidden = !open
  }

  pointAt(clientX: number, clientY: number): void {
    if (this.options.length === 0) {
      this.highlight = null
      this.setCaption('Nothing nearby', false)
      this.paintHighlight()
      return
    }

    const rect = this.root.getBoundingClientRect()
    const dx = clientX - (rect.left + rect.width / 2)
    const dy = clientY - (rect.top + rect.height / 2)
    if (Math.hypot(dx, dy) < INNER_RADIUS) {
      this.highlight = null
      this.setCaption('Cancel', false)
      this.paintHighlight()
      return
    }

    let angle = Math.atan2(dx, -dy)
    if (angle < 0) angle += Math.PI * 2
    const sector = (Math.PI * 2) / this.options.length
    const index = Math.min(this.options.length - 1, Math.floor(angle / sector))
    const option = this.options[index]
    this.highlight = option?.id ?? null
    this.setCaption(option?.label ?? '', option !== undefined)
    this.paintHighlight()
  }

  selected(): WeaponAction | null {
    return this.highlight
  }

  dispose(): void {
    this.root.remove()
  }

  private setCaption(label: string, armed: boolean): void {
    this.caption.textContent = label
    this.caption.classList.toggle('is-armed', armed)
  }

  private draw(): void {
    this.svg.replaceChildren()
    if (this.options.length === 0) {
      this.addDonut(null)
      this.addCenter()
      return
    }

    if (this.options.length === 1) {
      const option = this.options[0]
      if (!option) return
      this.addDonut(option)
      this.addLabel(option, 0)
      this.addCenter()
      return
    }

    const sector = (Math.PI * 2) / this.options.length
    for (let index = 0; index < this.options.length; index += 1) {
      const option = this.options[index]
      if (!option) continue
      const start = index * sector
      this.addSector(option, start, start + sector)
      this.addLabel(option, start + sector / 2)
    }
    this.addCenter()
  }

  private addDonut(option: RadialOption | null): void {
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('class', 'radial-sector')
    path.setAttribute('d', donutPath(MENU_SIZE / 2, MENU_SIZE / 2, INNER_RADIUS, OUTER_RADIUS))
    if (option) path.dataset.action = option.id
    this.svg.append(path)
  }

  private addCenter(): void {
    const circle = document.createElementNS(SVG_NS, 'circle')
    circle.setAttribute('class', 'radial-center')
    circle.setAttribute('cx', String(MENU_SIZE / 2))
    circle.setAttribute('cy', String(MENU_SIZE / 2))
    circle.setAttribute('r', String(INNER_RADIUS - 1))
    this.svg.append(circle)
  }

  private addSector(option: RadialOption | null, start: number, end: number): void {
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('class', 'radial-sector')
    path.setAttribute(
      'd',
      sectorPath(MENU_SIZE / 2, MENU_SIZE / 2, INNER_RADIUS, OUTER_RADIUS, start, end),
    )
    if (option) path.dataset.action = option.id
    this.svg.append(path)
  }

  private addLabel(option: RadialOption, angle: number): void {
    const labelRadius = (INNER_RADIUS + OUTER_RADIUS) / 2
    const point = polar(MENU_SIZE / 2, MENU_SIZE / 2, labelRadius, angle)
    const text = document.createElementNS(SVG_NS, 'text')
    text.setAttribute('class', 'radial-label')
    text.setAttribute('x', String(point.x))
    text.setAttribute('y', String(point.y))
    text.dataset.action = option.id
    text.textContent = option.label
    this.svg.append(text)
  }

  private paintHighlight(): void {
    const sectors = this.svg.querySelectorAll('path')
    for (const sector of sectors) {
      const selected = this.highlight !== null && sector.dataset.action === this.highlight
      sector.classList.toggle('is-selected', selected)
    }
    const labels = this.svg.querySelectorAll('text')
    for (const label of labels) {
      const selected = this.highlight !== null && label.dataset.action === this.highlight
      label.classList.toggle('is-selected', selected)
    }
  }
}

function donutPath(cx: number, cy: number, inner: number, outer: number): string {
  return [
    `M ${cx} ${cy - outer}`,
    `A ${outer} ${outer} 0 1 1 ${cx} ${cy + outer}`,
    `A ${outer} ${outer} 0 1 1 ${cx} ${cy - outer}`,
    `M ${cx} ${cy - inner}`,
    `A ${inner} ${inner} 0 1 0 ${cx} ${cy + inner}`,
    `A ${inner} ${inner} 0 1 0 ${cx} ${cy - inner}`,
    'Z',
  ].join(' ')
}

function sectorPath(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  start: number,
  end: number,
): string {
  const large = end - start > Math.PI ? 1 : 0
  const outerStart = polar(cx, cy, outer, start)
  const outerEnd = polar(cx, cy, outer, end)
  const innerEnd = polar(cx, cy, inner, end)
  const innerStart = polar(cx, cy, inner, start)
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outer} ${outer} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${inner} ${inner} 0 ${large} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}

function polar(cx: number, cy: number, radius: number, angle: number): { x: number; y: number } {
  return {
    x: cx + Math.sin(angle) * radius,
    y: cy - Math.cos(angle) * radius,
  }
}
