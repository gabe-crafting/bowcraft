import { BOWS, type ProjectileSpec, type ShotArrow, type WeaponKind } from '@bounty/shared'
import { planLaunch } from './ballistics'
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

  spawnProjectile(
    ownerId: string,
    x: number,
    z: number,
    aim: number,
    targetX: number,
    targetZ: number,
    spec: ProjectileSpec = this.spec,
    arrow: ShotArrow = 'normal',
  ): Projectile {
    const launch = planLaunch(spec, x, z, aim, targetX, targetZ)
    return new Projectile(
      ownerId,
      launch.x,
      launch.y,
      launch.z,
      launch.vx,
      launch.vy,
      launch.vz,
      launch.landX,
      launch.landZ,
      launch.bendX,
      launch.bendZ,
      spec,
      arrow,
    )
  }
}
