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
    this.group.position.y = PROJECTILE_Y
  }

  setPose(x: number, z: number, dirX: number, dirZ: number): void {
    this.group.position.set(x, PROJECTILE_Y, z)
    this.group.rotation.y = Math.atan2(dirX, dirZ)
  }

  dispose(): void {
    this.group.removeFromParent()
    disposeObject(this.group)
  }
}
