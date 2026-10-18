import type { FlightPoint } from '@bounty/shared'
import { BufferAttribute, BufferGeometry, Group, Line, LineBasicMaterial } from 'three'

const MAX_POINTS = 180

/** Thin preview of where the nocked arrow will travel. */
export class AimLine {
  readonly group = new Group()
  private readonly positions = new Float32Array(MAX_POINTS * 3)
  private readonly geometry = new BufferGeometry()
  private readonly material: LineBasicMaterial

  constructor() {
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3))
    this.geometry.setDrawRange(0, 0)
    this.material = new LineBasicMaterial({
      color: 0xf3e2b0,
      transparent: true,
      opacity: 0.9,
    })
    const line = new Line(this.geometry, this.material)
    line.frustumCulled = false
    this.group.add(line)
    this.group.visible = false
  }

  setPath(points: readonly FlightPoint[]): void {
    const count = Math.min(points.length, MAX_POINTS)
    if (count < 2) {
      this.group.visible = false
      return
    }
    for (let index = 0; index < count; index += 1) {
      const point = points[index]
      if (!point) continue
      this.positions[index * 3] = point.x
      this.positions[index * 3 + 1] = Math.max(point.y, 0.06)
      this.positions[index * 3 + 2] = point.z
    }
    this.geometry.setDrawRange(0, count)
    const position = this.geometry.getAttribute('position')
    position.needsUpdate = true
    this.geometry.computeBoundingSphere()
    this.group.visible = true
  }

  dispose(): void {
    this.group.removeFromParent()
    this.geometry.dispose()
    this.material.dispose()
  }
}
