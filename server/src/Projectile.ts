import type { ProjectileSpec } from '@bounty/shared'

let nextProjectileId = 1

export class Projectile {
  readonly id: string
  x: number
  z: number
  traveled = 0

  constructor(
    readonly ownerId: string,
    x: number,
    z: number,
    readonly dirX: number,
    readonly dirZ: number,
    readonly spec: ProjectileSpec,
  ) {
    this.id = `p${nextProjectileId}`
    nextProjectileId += 1
    this.x = x
    this.z = z
  }

  advance(step: number): { x0: number; z0: number; x1: number; z1: number } {
    const x0 = this.x
    const z0 = this.z
    this.x += this.dirX * step
    this.z += this.dirZ * step
    this.traveled += step
    return { x0, z0, x1: this.x, z1: this.z }
  }
}
