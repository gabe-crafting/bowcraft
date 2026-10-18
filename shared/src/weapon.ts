import {
  ARROW_FALL_SECONDS,
  EXPLOSION_RADIUS,
  LONGBOW_COOLDOWN_MS,
  LONGBOW_DAMAGE,
  LONGBOW_SPEED,
  PROJECTILE_RADIUS,
  RECURVE_COOLDOWN_MS,
  RECURVE_DAMAGE,
  RECURVE_POWER,
  SHORTBOW_COOLDOWN_MS,
  SHORTBOW_DAMAGE,
  SHORTBOW_POWER,
} from './constants'

/**
 * Shot profile copied onto each arrow a bow creates.
 * `explodes` deals splash damage when the arrow hits the ground, a wall, a tree, or a hunter.
 * `penetrates` lets the arrow pass walls and trunks; it still stops at max range and on players.
 * `ricochets` bounces off walls, trunks, and the arena edge.
 * `power` sets speed and distance for a forward bow. A longbow's power is infinite and does not set its speed.
 * `flat` flies along the facing and drops. `lob` drops on the click. `hook` aims at the click and bends once around the first wall or trunk on that line.
 */
export type Trajectory = 'flat' | 'lob' | 'hook'

export interface ProjectileSpec {
  /** Forward bows turn this into speed and distance. Longbow power is infinite. */
  readonly power: number
  readonly speed: number
  readonly maxRange: number
  readonly damage: number
  readonly radius: number
  readonly explodes: boolean
  readonly penetrates: boolean
  readonly ricochets: boolean
  readonly explosionRadius: number
  readonly fireCooldownMs: number
  readonly trajectory: Trajectory
}

export type WeaponKind = 'longbow' | 'shortbow' | 'recurve'

export const BOW_NAMES: Record<WeaponKind, { readonly name: string; readonly detail: string }> = {
  longbow: {
    name: 'Longbow',
    detail: 'Lofts the arrow onto any spot you click. Its speed stays the same however far that is.',
  },
  shortbow: {
    name: 'Shortbow',
    detail: 'Shoots straight ahead. Power sets how fast the arrow flies and where it drops.',
  },
  recurve: {
    name: 'Recurve',
    detail: 'Aims at the click. Bends once around a wall or tree when that line is blocked.',
  },
}

export const BOWS: Record<WeaponKind, ProjectileSpec> = {
  longbow: {
    power: Number.POSITIVE_INFINITY,
    speed: LONGBOW_SPEED,
    maxRange: Number.POSITIVE_INFINITY,
    damage: LONGBOW_DAMAGE,
    radius: PROJECTILE_RADIUS,
    explodes: false,
    penetrates: false,
    ricochets: false,
    explosionRadius: EXPLOSION_RADIUS,
    fireCooldownMs: LONGBOW_COOLDOWN_MS,
    trajectory: 'lob',
  },
  shortbow: {
    power: SHORTBOW_POWER,
    speed: SHORTBOW_POWER,
    maxRange: SHORTBOW_POWER * ARROW_FALL_SECONDS,
    damage: SHORTBOW_DAMAGE,
    radius: PROJECTILE_RADIUS,
    explodes: false,
    penetrates: false,
    ricochets: false,
    explosionRadius: EXPLOSION_RADIUS,
    fireCooldownMs: SHORTBOW_COOLDOWN_MS,
    trajectory: 'flat',
  },
  recurve: {
    power: RECURVE_POWER,
    speed: RECURVE_POWER,
    maxRange: RECURVE_POWER * ARROW_FALL_SECONDS,
    damage: RECURVE_DAMAGE,
    radius: PROJECTILE_RADIUS,
    explodes: false,
    penetrates: false,
    ricochets: false,
    explosionRadius: EXPLOSION_RADIUS,
    fireCooldownMs: RECURVE_COOLDOWN_MS,
    trajectory: 'hook',
  },
}

export function isWeaponKind(value: unknown): value is WeaponKind {
  return value === 'longbow' || value === 'shortbow' || value === 'recurve'
}
