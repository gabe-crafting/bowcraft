import {
  EXPLOSION_RADIUS,
  LONGBOW_COOLDOWN_MS,
  LONGBOW_DAMAGE,
  LONGBOW_RANGE,
  LONGBOW_SPEED,
  PROJECTILE_RADIUS,
  RECURVE_COOLDOWN_MS,
  RECURVE_DAMAGE,
  RECURVE_RANGE,
  RECURVE_SPEED,
  SHORTBOW_COOLDOWN_MS,
  SHORTBOW_DAMAGE,
  SHORTBOW_RANGE,
  SHORTBOW_SPEED,
} from './constants'

/**
 * Shot profile copied onto each arrow a bow creates.
 * `explodes` deals splash damage when the arrow hits the ground, a wall, a tree, or a hunter.
 * `penetrates` lets the arrow pass walls and trunks; it still stops at max range and on players.
 * `ricochets` bounces off walls, trunks, and the arena edge.
 * `flat` flies along the facing and drops. `lob` drops on the click. `hook` can bend once around cover.
 */
export type Trajectory = 'flat' | 'lob' | 'hook'

export interface ProjectileSpec {
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
    detail: 'Lofts the arrow so it falls on the spot you click.',
  },
  shortbow: {
    name: 'Shortbow',
    detail: 'Shoots straight where you face. The arrow drops after a short flight.',
  },
  recurve: {
    name: 'Recurve',
    detail: 'Curves onto your click. Hooks once around a wall, with a longer reach and a slower draw.',
  },
}

export const BOWS: Record<WeaponKind, ProjectileSpec> = {
  longbow: {
    speed: LONGBOW_SPEED,
    maxRange: LONGBOW_RANGE,
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
    speed: SHORTBOW_SPEED,
    maxRange: SHORTBOW_RANGE,
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
    speed: RECURVE_SPEED,
    maxRange: RECURVE_RANGE,
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
