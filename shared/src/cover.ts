import { ARENA_SIZE, TREE_TRUNK_RADIUS } from './constants'
import { TREES, WALLS, wallBounds } from './map'

export interface CoverHit {
  t: number
  nx: number
  nz: number
}

export function arenaLimit(entityRadius: number): number {
  return ARENA_SIZE / 2 - entityRadius
}

export function isInsideArena(x: number, z: number, radius: number): boolean {
  const limit = arenaLimit(radius)
  return Math.abs(x) <= limit && Math.abs(z) <= limit
}

/** Earliest 0..1 hit against a wall or trunk, with the outward normal. */
export function coverHit(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  radius: number,
): CoverHit | null {
  let closest: CoverHit | null = null
  for (const wall of WALLS) {
    const bounds = wallBounds(wall, radius)
    const hit = segmentAabbHit(x0, z0, x1, z1, bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ)
    if (!hit) continue
    if (!closest || hit.t < closest.t) closest = hit
  }
  for (const tree of TREES) {
    const hit = circleEntry(x0, z0, x1, z1, tree.x, tree.z, TREE_TRUNK_RADIUS + radius)
    if (!hit) continue
    if (!closest || hit.t < closest.t) closest = hit
  }
  return closest
}

/** Earliest 0..1 hit on the inner arena edge. The normal points back into the arena. */
export function arenaBorderHit(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  radius: number,
): CoverHit | null {
  const limit = arenaLimit(radius)
  let closest: CoverHit | null = null
  const faces = [
    { crossed: x1 > limit, delta: x1 - x0, start: limit - x0, nx: -1, nz: 0 },
    { crossed: x1 < -limit, delta: x1 - x0, start: -limit - x0, nx: 1, nz: 0 },
    { crossed: z1 > limit, delta: z1 - z0, start: limit - z0, nx: 0, nz: -1 },
    { crossed: z1 < -limit, delta: z1 - z0, start: -limit - z0, nx: 0, nz: 1 },
  ]
  for (const face of faces) {
    if (!face.crossed || Math.abs(face.delta) < 1e-8) continue
    const t = face.start / face.delta
    if (t < 0 || t > 1) continue
    if (closest && t >= closest.t) continue
    closest = { t, nx: face.nx, nz: face.nz }
  }
  return closest
}

/** First 0..1 entry into a circle, with the outward normal. */
export function circleEntry(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  cx: number,
  cz: number,
  radius: number,
): CoverHit | null {
  const dx = x1 - x0
  const dz = z1 - z0
  const fx = x0 - cx
  const fz = z0 - cz
  const a = dx * dx + dz * dz
  if (a < 1e-10) return null
  const b = 2 * (fx * dx + fz * dz)
  const c = fx * fx + fz * fz - radius * radius
  const disc = b * b - 4 * a * c
  if (disc < 0) return null
  const t = (-b - Math.sqrt(disc)) / (2 * a)
  if (t < 0 || t > 1) return null
  const nx = x0 + dx * t - cx
  const nz = z0 + dz * t - cz
  const length = Math.hypot(nx, nz)
  if (length < 1e-8) return null
  return { t, nx: nx / length, nz: nz / length }
}

function segmentAabbHit(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): CoverHit | null {
  const dx = x1 - x0
  const dz = z1 - z0
  let tMin = 0
  let tMax = 1
  let nx = 0
  let nz = 0
  if (!slab(dx, minX - x0, maxX - x0, 1, 0)) return null
  if (!slab(dz, minZ - z0, maxZ - z0, 0, 1)) return null
  if (tMin < 0 || tMin > 1 || nx * nx + nz * nz < 0.5) return null
  return { t: tMin, nx, nz }

  function slab(
    delta: number,
    enter: number,
    exit: number,
    axisX: number,
    axisZ: number,
  ): boolean {
    if (Math.abs(delta) < 1e-8) return enter <= 0 && exit >= 0
    let tEnter = enter / delta
    let tExit = exit / delta
    const outward = delta > 0 ? -1 : 1
    if (tEnter > tExit) {
      const swap = tEnter
      tEnter = tExit
      tExit = swap
    }
    if (tEnter > tMin || (tEnter === tMin && nx === 0 && nz === 0)) {
      tMin = tEnter
      nx = axisX * outward
      nz = axisZ * outward
    }
    tMax = Math.min(tMax, tExit)
    return tMin <= tMax
  }
}
