import type { WeaponKind } from '@bounty/shared'
import { Group } from 'three'
import { disposeObject } from '../scene/dispose'
import { BowView } from './BowView'

const GROUND_YAW = 0.5

export class WeaponView {
  readonly group = new Group()

  constructor(kind: WeaponKind) {
    const bow = new BowView(kind, false)
    bow.group.rotation.z = Math.PI / 2
    bow.group.position.y = 0.06
    this.group.add(bow.group)
    this.group.rotation.y = GROUND_YAW
  }

  setPosition(x: number, z: number): void {
    this.group.position.set(x, 0, z)
  }

  dispose(): void {
    this.group.removeFromParent()
    disposeObject(this.group)
  }
}
