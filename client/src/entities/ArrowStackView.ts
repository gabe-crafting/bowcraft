import { arrowLook, type ArrowKind } from '@bounty/shared'
import { Group } from 'three'
import { disposeObject } from '../scene/dispose'
import { makeArrow, makeFlareArrow } from './Arrow'

const SPREAD = [
  { x: -0.12, z: 0.04, yaw: -0.4 },
  { x: 0, z: 0, yaw: 0.05 },
  { x: 0.13, z: -0.03, yaw: 0.38 },
] as const

export class ArrowStackView {
  readonly group = new Group()

  constructor(kind: ArrowKind) {
    const look = arrowLook(kind)
    for (const offset of SPREAD) {
      const arrow = kind === 'flare' ? makeFlareArrow(0.5) : makeArrow(0.62, look)
      arrow.position.set(offset.x, 0.05, offset.z)
      arrow.rotation.y = offset.yaw
      this.group.add(arrow)
    }
  }

  setPosition(x: number, z: number): void {
    this.group.position.set(x, 0, z)
  }

  dispose(): void {
    this.group.removeFromParent()
    disposeObject(this.group)
  }
}
