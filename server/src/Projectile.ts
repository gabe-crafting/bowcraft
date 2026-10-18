import type { ProjectileSpec, ShotArrow } from '@bounty/shared'

let nextProjectileId = 1

export class Projectile {
  readonly id: string
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  /** One optional bend. After the arrow passes it, the heading changes once. */
  bendX: number | null
  bendZ: number | null
  turned = false
  landX: number
  landZ: number
  traveled = 0
  age = 0
  /** Set once the arrow has dropped onto the ground. */
  grounded = false
  groundedAt = 0

  constructor(
    readonly ownerId: string,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    landX: number,
    landZ: number,
    bendX: number | null,
    bendZ: number | null,
    readonly spec: ProjectileSpec,
    readonly arrow: ShotArrow,
  ) {
    this.id = `p${nextProjectileId}`
    nextProjectileId += 1
    this.x = x
    this.y = y
    this.z = z
    this.vx = vx
    this.vy = vy
    this.vz = vz
    this.landX = landX
    this.landZ = landZ
    this.bendX = bendX
    this.bendZ = bendZ
  }

  heading(): { dirX: number; dirY: number; dirZ: number } {
    const magnitude = Math.hypot(this.vx, this.vy, this.vz)
    if (magnitude < 1e-6) return { dirX: 0, dirY: 0, dirZ: 1 }
    return { dirX: this.vx / magnitude, dirY: this.vy / magnitude, dirZ: this.vz / magnitude }
  }
}
