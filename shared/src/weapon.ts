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
 * `explodes` deals splash damage at impact and at the end of the range.
 * `penetrates` lets the arrow pass arena walls; it still stops at max range and on players.
 */
export interface ProjectileSpec {
  readonly speed: number
  readonly maxRange: number
  readonly damage: number
  readonly radius: number
  readonly explodes: boolean
  readonly penetrates: boolean
  readonly explosionRadius: number
  readonly fireCooldownMs: number
}

export type WeaponKind = 'longbow' | 'shortbow'

export const BOWS: Record<WeaponKind, ProjectileSpec> = {
  longbow: {
    speed: LONGBOW_SPEED,
    maxRange: LONGBOW_RANGE,
    damage: LONGBOW_DAMAGE,
    radius: PROJECTILE_RADIUS,
    explodes: false,
    penetrates: false,
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
    explosionRadius: EXPLOSION_RADIUS,
    fireCooldownMs: SHORTBOW_COOLDOWN_MS,
  },
}

export function isWeaponKind(value: unknown): value is WeaponKind {
  return value === 'longbow' || value === 'shortbow'
}
