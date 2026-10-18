import {
  EXPLOSION_RADIUS,
  LONGBOW_COOLDOWN_MS,
  LONGBOW_DAMAGE,
  LONGBOW_RANGE,
  LONGBOW_SPEED,
  PROJECTILE_RADIUS,
  SHORTBOW_COOLDOWN_MS,
  SHORTBOW_DAMAGE,
  SHORTBOW_RANGE,
  SHORTBOW_SPEED,
} from './constants'

/**
 * Shot profile copied onto each arrow a bow creates.
 * `explodes` deals splash damage when the arrow hits a wall, a tree, or a hunter.
 * `penetrates` lets the arrow pass walls and trunks; it still stops at max range and on players.
 * `ricochets` bounces off walls, trunks, and the arena edge.
 */
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
}

export type WeaponKind = 'longbow' | 'shortbow'

export const BOW_NAMES: Record<WeaponKind, { readonly name: string; readonly detail: string }> = {
  longbow: {
    name: 'Longbow',
    detail: 'Heavy draw, long reach, slow to loose again.',
  },
  shortbow: {
    name: 'Shortbow',
    detail: 'Light draw, shorter reach, quick to loose again.',
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
  },
}

export function isWeaponKind(value: unknown): value is WeaponKind {
  return value === 'longbow' || value === 'shortbow'
}
