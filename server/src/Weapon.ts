import {
  BOWS,
  PLAYER_RADIUS,
  PROJECTILE_SPAWN_CLEARANCE,
  type ProjectileSpec,
  type WeaponKind,
} from '@bounty/shared'
import { Projectile } from './Projectile'

let nextWeaponId = 1

export class Weapon {
  readonly id: string
  holderId: string | null = null
  x: number
  z: number

  readonly spec: ProjectileSpec

  constructor(
    readonly kind: WeaponKind,
    x: number,
    z: number,
  ) {
    this.id = `w${nextWeaponId}`
    nextWeaponId += 1
    this.spec = BOWS[kind]
    this.x = x
    this.z = z
  }

  spawnProjectile(ownerId: string, x: number, z: number, aim: number): Projectile {
    const dirX = Math.sin(aim)
    const dirZ = Math.cos(aim)
    const spawnDistance = PLAYER_RADIUS + this.spec.radius + PROJECTILE_SPAWN_CLEARANCE
    return new Projectile(
      ownerId,
      x + dirX * spawnDistance,
      z + dirZ * spawnDistance,
      dirX,
      dirZ,
      this.spec,
    )
  }
}
