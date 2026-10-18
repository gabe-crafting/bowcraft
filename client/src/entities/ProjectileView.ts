import { arrowLook, PROJECTILE_Y, type ShotArrow } from '@bounty/shared'
import { Group } from 'three'
import { disposeObject } from '../scene/dispose'
import { makeArrow, makeFlareArrow } from './Arrow'

const ARROW_LENGTH = 0.74
const FLARE_LENGTH = 0.46

export class ProjectileView {
  readonly group = new Group()

  constructor(arrow: ShotArrow) {
    const mesh =
      arrow === 'flare' ? makeFlareArrow(FLARE_LENGTH) : makeArrow(ARROW_LENGTH, arrowLook(arrow))
    this.group.add(mesh)
    this.group.rotation.order = 'YXZ'
    this.group.position.y = PROJECTILE_Y
  }

  setPose(x: number, y: number, z: number, dirX: number, dirY: number, dirZ: number): void {
    this.group.position.set(x, Math.max(y, 0.06), z)
    const horizontal = Math.hypot(dirX, dirZ)
    this.group.rotation.y = Math.atan2(dirX, dirZ)
    this.group.rotation.x = -Math.atan2(dirY, horizontal)
  }

  dispose(): void {
    this.group.removeFromParent()
    disposeObject(this.group)
  }
}
