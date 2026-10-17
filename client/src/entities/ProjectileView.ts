import { PROJECTILE_Y } from '@bounty/shared'
import { Group } from 'three'
import { disposeObject } from '../scene/dispose'
import { makeArrow } from './Arrow'

const ARROW_LENGTH = 0.74

export class ProjectileView {
  readonly group = new Group()

  constructor() {
    this.group.add(makeArrow(ARROW_LENGTH))
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
