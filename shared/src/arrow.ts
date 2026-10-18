import {
  EXPLOSION_RADIUS,
  FLARE_DAMAGE_SCALE,
  FLARE_RANGE_SCALE,
  FLARE_SPEED_SCALE,
  PROJECTILE_COLOR,
} from './constants'
import type { ProjectileSpec } from './weapon'

/** Picked up from the ground. Slot order is the 1, 2, 3, and 4 keys. */
export const ARROW_KINDS = ['ricochet', 'explosion', 'bodkin', 'flare'] as const

export type ArrowKind = (typeof ARROW_KINDS)[number]

/** `normal` is the bow's own arrow and never runs out. */
export type ShotArrow = 'normal' | ArrowKind

export type QuiverCounts = [number, number, number, number]

const SHAFT = 0xc9a36a

export interface ArrowLook {
  readonly shaft: number
  readonly head: number
  readonly fletching: number
}

export interface ArrowProfile extends ArrowLook {
  readonly name: string
  readonly detail: string
  readonly damageScale: number
  readonly speedScale: number
  readonly rangeScale: number
  readonly explodes: boolean
  readonly penetrates: boolean
  readonly ricochets: boolean
}

export const NORMAL_ARROW: ArrowLook & { readonly name: string; readonly detail: string } = {
  name: 'Normal arrow',
  detail: 'A plain arrow. You never run out.',
  shaft: SHAFT,
  head: 0xd5d8df,
  fletching: PROJECTILE_COLOR,
}

export const ARROWS: Record<ArrowKind, ArrowProfile> = {
  ricochet: {
    name: 'Ricochet',
    detail: 'Glances off walls, trees, and the arena edge.',
    damageScale: 0.9,
    speedScale: 1,
    rangeScale: 1.1,
    explodes: false,
    penetrates: false,
    ricochets: true,
    shaft: SHAFT,
    head: 0xd5e4f2,
    fletching: 0x6aa4d6,
  },
  explosion: {
    name: 'Explosion arrow',
    detail: 'Bursts on walls, trees, and hunters.',
    damageScale: 0.7,
    speedScale: 0.95,
    rangeScale: 0.9,
    explodes: true,
    penetrates: false,
    ricochets: false,
    shaft: SHAFT,
    head: 0xffb03a,
    fletching: 0xe25822,
  },
  bodkin: {
    name: 'Bodkin',
    detail: 'A narrow point that punches through walls and trees.',
    damageScale: 0.8,
    speedScale: 1.12,
    rangeScale: 1.05,
    explodes: false,
    penetrates: true,
    ricochets: false,
    shaft: SHAFT,
    head: 0x8d99a6,
    fletching: 0xd5dbe3,
  },
  flare: {
    name: 'Flare',
    detail: 'Crawls through the air and lights a full circle until it lands.',
    damageScale: FLARE_DAMAGE_SCALE,
    speedScale: FLARE_SPEED_SCALE,
    rangeScale: FLARE_RANGE_SCALE,
    explodes: false,
    penetrates: false,
    ricochets: false,
    shaft: SHAFT,
    head: 0xfff3c4,
    fletching: 0xff7a1a,
  },
}

export function isArrowKind(value: unknown): value is ArrowKind {
  return ARROW_KINDS.some((kind) => kind === value)
}

export function isShotArrow(value: unknown): value is ShotArrow {
  return value === 'normal' || isArrowKind(value)
}

export function arrowLook(arrow: ShotArrow): ArrowLook {
  if (arrow === 'normal') return NORMAL_ARROW
  return ARROWS[arrow]
}

/** Flight stats for one loose. The bow still decides how soon you can shoot again. */
export function arrowShot(bow: ProjectileSpec, arrow: ShotArrow): ProjectileSpec {
  if (arrow === 'normal') return bow
  const profile = ARROWS[arrow]
  return {
    speed: bow.speed * profile.speedScale,
    maxRange: bow.maxRange * profile.rangeScale,
    damage: Math.round(bow.damage * profile.damageScale),
    radius: bow.radius,
    explodes: profile.explodes,
    penetrates: profile.penetrates,
    ricochets: profile.ricochets,
    explosionRadius: profile.explodes ? EXPLOSION_RADIUS : bow.explosionRadius,
    fireCooldownMs: bow.fireCooldownMs,
  }
}
